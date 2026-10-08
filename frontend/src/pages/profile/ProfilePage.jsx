import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useUser } from '../../hooks/useUser';
import { useToast } from '../../hooks/useToast';
import { dashboardService } from '../../services/dashboardService';
import { authService } from '../../services/authService';
import { Card } from '../../components/ui/Card';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/feedback/Spinner';
import { Input } from '../../components/ui/Input';
import { EditProfileModal } from '../../features/profile/EditProfileModal';
import { DeleteAccountModal } from '../../features/profile/DeleteAccountModal';
import { ReauthenticateModal } from '../../components/auth/ReauthenticateModal';
import { UserReportsList } from '../../features/reports/UserReportsList';
import { formatPlatformJoinDate } from '../../utils/formatting';
import { resolveUserDisplayName, resolveUserFullName } from '../../utils/memberIdentity';
import {
  isFcmSupported,
  getNotificationPermission,
  enableWebPushNotifications,
  disableWebPushNotifications,
  isPushNotificationsEnabledLocally,
} from '../../services/fcmService';
import {
  Pencil,
  Calendar,
  ShieldCheck,
  Sparkles,
  Globe,
  Github,
  Linkedin,
  ExternalLink,
  Bell,
  Lock,
  Trash2,
  Copy,
  Check,
  Award,
  Trophy,
  AlertTriangle,
  Key,
  Mail,
  RefreshCw,
  Code2,
  Tag,
  Star,
  Activity,
} from 'lucide-react';

export default function ProfilePage() {
  const { user, reloadUser } = useAuth();
  const { userProfile, loadingProfile, updateProfile } = useUser();
  const { toast } = useToast();

  // Silently reload user status on mount if unverified so verification in another tab is automatically reflected
  useEffect(() => {
    if (user && !user.emailVerified && typeof reloadUser === 'function') {
      reloadUser().catch(() => {});
    }
  }, [user?.uid, user?.emailVerified, reloadUser]);

  // Modals & Feedback
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);

  // Security Center State
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isReauthOpen, setIsReauthOpen] = useState(false);

  // Compact Activity Summary Data (lightweight contribution metrics)
  const [activityStats, setActivityStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Notification Preferences State
  const [notifPrefs, setNotifPrefs] = useState({
    emailNotifs: true,
    invitations: true,
    taskUpdates: true,
    mvpAnnouncements: true,
    commentNotifs: true,
    suggestionNotifs: true,
  });
  const [savingNotifs, setSavingNotifs] = useState(false);

  // Web Push Notification State
  const [isPushSupported, setIsPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState('default');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    if (userProfile?.notificationPreferences) {
      setNotifPrefs((prev) => ({
        ...prev,
        ...userProfile.notificationPreferences,
      }));
    }
  }, [userProfile]);

  useEffect(() => {
    isFcmSupported().then((supported) => {
      setIsPushSupported(supported);
      if (supported) {
        setPushPermission(getNotificationPermission());
        setPushEnabled(isPushNotificationsEnabledLocally(user?.uid));
      }
    });
  }, [user?.uid]);

  // Fetch compact contribution stats without duplicating full dashboard
  useEffect(() => {
    if (!user) return;
    let active = true;

    dashboardService
      .fetchFreshDashboardData(user)
      .then((data) => {
        if (active && data) {
          setActivityStats({
            stats: data.stats || {
              totalWorkspaces: 0,
              ideasCreated: 0,
              ideasVoted: 0,
              assignedTasks: 0,
              completedTasks: 0,
            },
            isMvpCreator: Boolean(
              data.organizations?.some(
                (o) => o?.selectedMvp && (o.selectedMvp.authorUid === user.uid || o.selectedMvp.authorId === user.uid)
              )
            ),
          });
          setLoadingStats(false);
        }
      })
      .catch((err) => {
        console.warn('[ProfilePage] Error fetching stats:', err);
        setLoadingStats(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  const handleSendVerificationEmail = async () => {
    if (isSendingVerification) return;
    setIsSendingVerification(true);
    try {
      await authService.sendVerificationEmail();
      toast.success('✓ Verification email sent successfully. Please check your inbox!');
    } catch (err) {
      toast.error(err.message || 'Unable to send verification email. Please try again.');
    } finally {
      setIsSendingVerification(false);
    }
  };

  const handleRefreshVerificationStatus = async () => {
    if (isRefreshingStatus) return;
    setIsRefreshingStatus(true);
    try {
      const reloadedUser = await reloadUser();
      if (reloadedUser?.emailVerified) {
        toast.success('🎉 Email verified! Account security updated.');
      } else {
        toast.info('Verification status: Email is not yet verified.');
      }
    } catch (err) {
      toast.error('Failed to reload verification status.');
    } finally {
      setIsRefreshingStatus(false);
    }
  };

  const handleUpdateEmail = async (e) => {
    if (e) e.preventDefault();
    if (!newEmail || !newEmail.includes('@')) {
      toast.error('Please enter a valid new email address.');
      return;
    }

    setIsUpdatingEmail(true);
    try {
      await authService.updateUserEmail(newEmail.trim());
      toast.success('✓ Verification link sent to new email! Please verify to complete email change.');
      setNewEmail('');
    } catch (err) {
      if (err.message && (err.message.includes('recent login') || err.message.includes('requires-recent-login'))) {
        toast.info('Security reauthentication required. Please enter your password.');
        setIsReauthOpen(true);
      } else {
        toast.error(err.message || 'Unable to update email address.');
      }
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const handleReauthSuccess = async () => {
    toast.success('Reauthenticated! Resuming email update...');
    handleUpdateEmail();
  };

  const handleTogglePushNotifications = async () => {
    if (pushLoading) return;
    setPushLoading(true);

    try {
      if (pushEnabled) {
        await disableWebPushNotifications();
        setPushEnabled(false);
        toast.info('Push notifications disabled.');
      } else {
        const result = await enableWebPushNotifications({ currentUid: user?.uid });
        setPushPermission(result.permission);
        if (result.success) {
          setPushEnabled(true);
          toast.success('Push notifications enabled.');
        } else if (result.permission === 'denied') {
          toast.error('Notifications blocked by browser. Please allow notifications in site settings.');
        } else {
          toast.error(result.error || 'Failed to enable push notifications.');
        }
      }
    } catch (err) {
      toast.error('Error toggling push notifications: ' + err.message);
    } finally {
      setPushLoading(false);
    }
  };

  const handleCopyUid = () => {
    if (!userProfile?.uid) return;
    navigator.clipboard.writeText(userProfile.uid);
    setCopiedUid(true);
    toast.success('User ID copied to clipboard!');
    setTimeout(() => setCopiedUid(false), 2000);
  };

  const handleSaveNotifPrefs = async () => {
    setSavingNotifs(true);
    try {
      await updateProfile({ notificationPreferences: notifPrefs });
      toast.success('Notification preferences saved!');
    } catch (err) {
      toast.error('Failed to save preferences.');
    } finally {
      setSavingNotifs(false);
    }
  };

  const handleResetPassword = async () => {
    if (!user?.email) return;
    setIsSendingReset(true);
    try {
      await authService.sendPasswordResetEmail(user.email);
      toast.success(`Password reset link sent to ${user.email}`);
    } catch (err) {
      toast.error(err.message || 'Failed to send reset email.');
    } finally {
      setIsSendingReset(false);
    }
  };

  if (loadingProfile) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500 font-medium">Profile data not available.</p>
      </div>
    );
  }

  const skillsList = userProfile.skills
    ? userProfile.skills.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const techStackList = userProfile.techStack
    ? userProfile.techStack.split(',').map((t) => t.trim()).filter(Boolean)
    : [];

  const interestsList = userProfile.interests
    ? userProfile.interests.split(',').map((item) => item.trim()).filter(Boolean)
    : [];

  const isSuperAdmin = Boolean(
    userProfile?.role === 'superadmin' ||
    userProfile?.role === 'admin' ||
    userProfile?.isAdmin === true ||
    ((import.meta.env.VITE_ADMIN_EMAIL || 'admin@convia.dev').toLowerCase().trim() === (user?.email || '').toLowerCase().trim())
  );

  const achievements = [
    {
      id: 'early_adopter',
      title: 'Platform Innovator',
      desc: 'Early Convia project collaborator',
      icon: Award,
      unlocked: true,
    },
    {
      id: 'mvp_creator',
      title: 'Blueprint Champion',
      desc: 'Authored an approved project blueprint',
      icon: Trophy,
      unlocked: Boolean(activityStats?.isMvpCreator),
    },
  ];

  const resolvedDisplayName = resolveUserDisplayName(userProfile, user);

  return (
    <div className="space-y-8 max-w-5xl mx-auto px-4 py-8">
      {/* 1. Identity Hero Card */}
      <Card className="bg-gradient-to-r from-slate-900 via-primary-950 to-slate-900 text-white p-8 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 h-56 w-56 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-6 relative z-10">
          {/* Avatar & Core Identity */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
            <div className="relative shrink-0">
              <Avatar
                src={userProfile.photoURL || user?.photoURL}
                name={resolvedDisplayName}
                size="lg"
                className="h-24 w-24 text-2xl border-4 border-primary-500/50 shadow-xl ring-4 ring-primary-500/20"
              />
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  @{resolvedDisplayName.replace(/^@/, '')}
                </h1>
                {userProfile.primaryRole && (
                  <Badge variant="primary" className="bg-primary-500/30 text-primary-200 border-primary-400/40 font-bold">
                    {userProfile.primaryRole}
                  </Badge>
                )}
              </div>

              {userProfile.bio && (
                <p className="text-sm text-slate-300 max-w-xl line-clamp-2 font-medium">
                  {userProfile.bio}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-slate-400 pt-1">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-primary-400" />
                  Member since {formatPlatformJoinDate(userProfile.firstSignedInAt || userProfile.joinedAt || userProfile.createdAt)}
                </span>
              </div>

              {/* Social Links inside Hero */}
              {(userProfile.github || userProfile.linkedin || userProfile.portfolio) && (
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-2">
                  {userProfile.github && (
                    <a
                      href={userProfile.github}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-200 bg-white/10 hover:bg-white/20 px-3 py-1 rounded-lg transition-colors border border-white/10"
                    >
                      <Github className="h-3.5 w-3.5" /> GitHub <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                    </a>
                  )}
                  {userProfile.linkedin && (
                    <a
                      href={userProfile.linkedin}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-200 bg-primary-500/20 hover:bg-primary-500/30 px-3 py-1 rounded-lg transition-colors border border-primary-400/20"
                    >
                      <Linkedin className="h-3.5 w-3.5" /> LinkedIn <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                    </a>
                  )}
                  {userProfile.portfolio && (
                    <a
                      href={userProfile.portfolio}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-200 bg-teal-500/20 hover:bg-teal-500/30 px-3 py-1 rounded-lg transition-colors border border-teal-400/20"
                    >
                      <Globe className="h-3.5 w-3.5" /> Portfolio <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {isSuperAdmin && (
              <Link to="/admin/dashboard">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<ShieldCheck className="h-4 w-4 text-primary-600" />}
                  className="bg-primary-50 hover:bg-primary-100 text-primary-900 border-primary-200 font-extrabold text-xs"
                >
                  Admin Portal
                </Button>
              </Link>
            )}

            <Button
              variant="primary"
              size="sm"
              icon={<Pencil className="h-4 w-4" />}
              onClick={() => setIsEditModalOpen(true)}
              className="bg-primary-600 hover:bg-primary-700 text-white font-bold shadow-lg shadow-primary-600/30 border-none"
            >
              Edit Profile
            </Button>
          </div>
        </div>
      </Card>

      {/* Main Two-Column Identity Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (2 cols): Identity, Skills, Activity, Reports */}
        <div className="lg:col-span-2 space-y-8">
          {/* 2. About & Background Card */}
          <Card className="p-6 bg-white border border-slate-200 shadow-sm space-y-5">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary-600" /> About & Overview
              </h3>
              {userProfile.experienceLevel && (
                <Badge variant="secondary" className="font-semibold text-xs">
                  {userProfile.experienceLevel} Level
                </Badge>
              )}
            </div>

            {/* Bio */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Biography
              </h4>
              <p className="text-sm text-slate-700 leading-relaxed font-medium bg-slate-50 p-4 rounded-xl border border-slate-100">
                {userProfile.bio || (
                  <span className="text-slate-400 italic">
                    No bio added yet. Click &quot;Edit Profile&quot; to share your technical background and what you build!
                  </span>
                )}
              </p>
            </div>


            {/* Project Interests (Fixed: now displayed!) */}
            <div className="pt-2 border-t border-slate-100">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-primary-600" /> Project Interests
              </h4>
              {interestsList.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {interestsList.map((interest, i) => (
                    <span
                      key={i}
                      className="rounded-lg bg-primary-50/70 border border-primary-200/80 px-2.5 py-1 text-xs font-semibold text-primary-800"
                    >
                      {interest}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  No project interests specified. Add topics like AI/ML, Web3, or Mobile in Edit Profile.
                </p>
              )}
            </div>
          </Card>

          {/* 3. Skills & Tech Stack Card */}
          <Card className="p-6 bg-white border border-slate-200 shadow-sm space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Code2 className="h-4 w-4 text-primary-600" /> Skills & Technical Stack
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                  Skills
                </h4>
                {skillsList.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {skillsList.map((skill, i) => (
                      <span
                        key={i}
                        className="rounded-md bg-primary-50 border border-primary-100 px-2.5 py-1 text-xs font-semibold text-primary-700"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No skills listed yet.</p>
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                  Preferred Tech Stack
                </h4>
                {techStackList.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {techStackList.map((tech, i) => (
                      <span
                        key={i}
                        className="rounded-md bg-slate-100 border border-slate-200 px-2.5 py-1 text-xs font-mono font-bold text-slate-700"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No tech stack specified.</p>
                )}
              </div>
            </div>
          </Card>

          {/* 4. Convia Activity Summary (Compact contribution metrics — NOT Dashboard duplicate) */}
          <Card className="p-6 bg-white border border-slate-200 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary-600" /> Convia Collaboration Activity
              </h3>
              <Link
                to="/dashboard"
                className="text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                Go to Workspace Dashboard &rarr;
              </Link>
            </div>

            {loadingStats ? (
              <div className="h-16 animate-pulse bg-slate-50 rounded-xl" />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">Workspaces</span>
                  <span className="text-xl font-black text-slate-900">{activityStats?.stats?.totalWorkspaces || 0}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">Ideas Proposed</span>
                  <span className="text-xl font-black text-slate-900">{activityStats?.stats?.ideasCreated || 0}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">Votes Cast</span>
                  <span className="text-xl font-black text-slate-900">{activityStats?.stats?.ideasVoted || 0}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">Tasks Done</span>
                  <span className="text-xl font-black text-slate-900">{activityStats?.stats?.completedTasks || 0}</span>
                </div>
              </div>
            )}

            {/* Achievements */}
            <div className="pt-3 border-t border-slate-100">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                <Award className="h-3.5 w-3.5 text-amber-500" /> Platform Milestones
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {achievements.map((item) => {
                  const IconComp = item.icon;
                  return (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-xl border flex items-center gap-3 transition-all ${
                        item.unlocked
                          ? 'bg-amber-50/60 border-amber-200'
                          : 'bg-slate-50 border-slate-200 opacity-40 grayscale'
                      }`}
                    >
                      <div className={`p-2 rounded-full shrink-0 ${item.unlocked ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-300 text-slate-600'}`}>
                        <IconComp className="h-4 w-4" />
                      </div>
                      <div>
                        <h5 className="font-extrabold text-slate-900 text-xs">{item.title}</h5>
                        <p className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* 5. User Reports List */}
          <UserReportsList />
        </div>

        {/* Right Column (1 col): Security & Account, Notifications, Danger Zone */}
        <div className="space-y-8">
          {/* 6. Authoritative Security & Account Center */}
          <Card className="p-6 bg-white border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary-600" /> Account & Security
              </h3>
              <div className="flex items-center gap-1 text-amber-500" title="Security Health">
                {[...Array(user?.emailVerified ? 5 : 4)].map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-current" />
                ))}
              </div>
            </div>

            {/* Private Full Name (Owner Only) */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Full Name</span>
                <span className="text-[10px] font-semibold text-slate-400">Only visible to you</span>
              </div>
              <p className="text-sm font-semibold text-slate-800">
                {resolveUserFullName(userProfile) || <span className="text-slate-400 font-normal italic">Not set</span>}
              </p>
            </div>

            {/* Email Verification */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Email Address</span>
                {user?.emailVerified ? (
                  <Badge variant="success" className="flex items-center gap-1 font-bold text-[10px]">
                    <Check className="h-3 w-3" /> Verified
                  </Badge>
                ) : (
                  <Badge variant="warning" className="flex items-center gap-1 font-bold text-[10px]">
                    <AlertTriangle className="h-3 w-3" /> Unverified
                  </Badge>
                )}
              </div>

              <p className="font-mono text-xs text-slate-800 break-all font-semibold">
                {user?.email || userProfile?.email}
              </p>

              {!user?.emailVerified && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    variant="primary"
                    size="sm"
                    isLoading={isSendingVerification}
                    onClick={handleSendVerificationEmail}
                    icon={<Mail className="h-3.5 w-3.5" />}
                    className="bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs"
                  >
                    Verify Email
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    isLoading={isRefreshingStatus}
                    onClick={handleRefreshVerificationStatus}
                    icon={<RefreshCw className={`h-3.5 w-3.5 ${isRefreshingStatus ? 'animate-spin' : ''}`} />}
                    className="text-xs font-bold"
                  >
                    Refresh Status
                  </Button>
                </div>
              )}
            </div>

            {/* UID Copy */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">User ID (UID)</span>
              <div className="flex items-center gap-2">
                <p className="font-mono text-slate-700 text-[11px] truncate flex-1">
                  {userProfile.uid}
                </p>
                <button
                  type="button"
                  onClick={handleCopyUid}
                  className="p-1 rounded bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                  title="Copy UID"
                >
                  {copiedUid ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {/* Password Reset */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Password Reset</span>
              <p className="text-xs text-slate-600 font-medium">
                Send a secure reset link to your verified address.
              </p>

              <Button
                variant="secondary"
                size="sm"
                isLoading={isSendingReset}
                icon={<Key className="h-3.5 w-3.5 text-primary-600" />}
                onClick={handleResetPassword}
                className="text-xs font-bold"
              >
                Send Reset Email
              </Button>
            </div>

            {/* Change Email Address */}
            <form onSubmit={handleUpdateEmail} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Change Email</span>
              <Input
                type="email"
                placeholder="Enter new email address"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="text-xs"
              />

              <Button
                type="submit"
                variant="secondary"
                size="sm"
                isLoading={isUpdatingEmail}
                disabled={!newEmail}
                className="text-xs font-bold border-slate-300 w-full"
              >
                Update Email Address
              </Button>
            </form>
          </Card>

          {/* 7. Notification Preferences Card */}
          <Card className="p-6 bg-white border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
              <Bell className="h-4 w-4 text-primary-600" /> Notifications
            </h3>

            <div className="space-y-3 text-xs font-medium text-slate-700">
              <label className="flex items-center justify-between cursor-pointer">
                <span>Email Notifications</span>
                <input
                  type="checkbox"
                  checked={notifPrefs.emailNotifs}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, emailNotifs: e.target.checked })}
                  className="rounded text-primary-600 focus:ring-primary-500 h-4 w-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span>Workspace Invitations</span>
                <input
                  type="checkbox"
                  checked={notifPrefs.invitations}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, invitations: e.target.checked })}
                  className="rounded text-primary-600 focus:ring-primary-500 h-4 w-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span>Task Updates</span>
                <input
                  type="checkbox"
                  checked={notifPrefs.taskUpdates}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, taskUpdates: e.target.checked })}
                  className="rounded text-primary-600 focus:ring-primary-500 h-4 w-4 cursor-pointer"
                />
              </label>

              {/* Web Push */}
              <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">Browser Push Alerts</span>
                  {pushEnabled ? (
                    <Badge variant="success" className="text-[10px]">Active</Badge>
                  ) : pushPermission === 'denied' ? (
                    <Badge variant="danger" className="text-[10px]">Blocked</Badge>
                  ) : !isPushSupported ? (
                    <Badge variant="secondary" className="text-[10px]">Unsupported</Badge>
                  ) : (
                    <Badge variant="warning" className="text-[10px]">Disabled</Badge>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Instant browser notifications for mentions and project updates.
                </p>
                {isPushSupported && (
                  <Button
                    variant={pushEnabled ? 'outline' : 'primary'}
                    size="sm"
                    fullWidth
                    isLoading={pushLoading}
                    disabled={pushPermission === 'denied'}
                    onClick={handleTogglePushNotifications}
                    className="text-xs font-bold mt-1"
                  >
                    {pushEnabled ? 'Disable Push on This Device' : 'Enable Browser Push'}
                  </Button>
                )}
              </div>
            </div>

            <Button
              variant="secondary"
              fullWidth
              size="sm"
              isLoading={savingNotifs}
              onClick={handleSaveNotifPrefs}
              className="mt-2 text-xs font-bold"
            >
              Save Preferences
            </Button>
          </Card>

          {/* 8. Danger Zone */}
          <Card className="p-6 bg-rose-50/50 border border-rose-200 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-rose-900 uppercase tracking-wider flex items-center gap-2 border-b border-rose-200 pb-3">
              <AlertTriangle className="h-4 w-4 text-rose-600" /> Danger Zone
            </h3>

            <p className="text-xs text-rose-700 leading-relaxed font-medium">
              Deleting your account permanently removes your identity and contribution records.
            </p>

            <Button
              variant="danger"
              fullWidth
              size="sm"
              icon={<Trash2 className="h-3.5 w-3.5" />}
              onClick={() => setIsDeleteAccountOpen(true)}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
            >
              Delete Account
            </Button>
          </Card>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={() => {}}
      />

      {/* Reauthenticate Sensitive Action Modal */}
      <ReauthenticateModal
        isOpen={isReauthOpen}
        onClose={() => setIsReauthOpen(false)}
        onSuccess={handleReauthSuccess}
      />

      {/* Account Deletion Confirmation Modal */}
      <DeleteAccountModal
        isOpen={isDeleteAccountOpen}
        onClose={() => setIsDeleteAccountOpen(false)}
      />
    </div>
  );
}
