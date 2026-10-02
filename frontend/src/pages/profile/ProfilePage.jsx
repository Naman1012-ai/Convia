import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useUser } from '../../hooks/useUser';
import { useToast } from '../../hooks/useToast';
import { dashboardService } from '../../services/dashboardService';
import { authService } from '../../services/authService';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/ui/Card';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/feedback/Spinner';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { EditProfileModal } from '../../features/profile/EditProfileModal';
import { DeleteAccountModal } from '../../features/profile/DeleteAccountModal';
import { UserReportsList } from '../../features/reports/UserReportsList';
import { formatTimestamp, formatPlatformJoinDate } from '../../utils/formatting';
import {
  isFcmSupported,
  getNotificationPermission,
  enableWebPushNotifications,
  disableWebPushNotifications,
  isPushNotificationsEnabledLocally,
} from '../../services/fcmService';
import {
  Pencil,
  UserCheck,
  Calendar,
  ShieldCheck,
  Wifi,
  Briefcase,
  Layers,
  ThumbsUp,
  CheckSquare,
  CheckCircle,
  Trophy,
  Sparkles,
  Globe,
  Github,
  Linkedin,
  ExternalLink,
  GraduationCap,
  Bell,
  Lock,
  Trash2,
  Copy,
  Check,
  ArrowRight,
  TrendingUp,
  MessageCircle,
  Lightbulb,
  Award,
  AlertTriangle,
  Key,
  Mail,
  RefreshCw,
  Star,
  ShieldAlert,
} from 'lucide-react';

import { Input } from '../../components/ui/Input';
import { ReauthenticateModal } from '../../components/auth/ReauthenticateModal';

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const { userProfile, loadingProfile, updateProfile } = useUser();
  const { toast } = useToast();
  const navigate = useNavigate();

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
      const reloadedUser = await authService.reloadUser();
      if (reloadedUser?.emailVerified) {
        toast.success('🎉 Email verified! Security score updated.');
      } else {
        toast.info('Verification status reloaded: Email is not yet verified.');
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
      await updateProfile({ email: newEmail.trim() });
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

  // Live Statistics & Workspaces fetched from database
  const [dashboardData, setDashboardData] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);

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

  useEffect(() => {
    if (userProfile?.notificationPreferences) {
      setNotifPrefs((prev) => ({
        ...prev,
        ...userProfile.notificationPreferences,
      }));
    }
  }, [userProfile]);

  // Web Push Notification State
  const [isPushSupported, setIsPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState('default');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    isFcmSupported().then((supported) => {
      setIsPushSupported(supported);
      if (supported) {
        setPushPermission(getNotificationPermission());
        setPushEnabled(isPushNotificationsEnabledLocally());
      }
    });
  }, []);

  const handleTogglePushNotifications = async () => {
    if (pushLoading) return;
    setPushLoading(true);

    try {
      if (pushEnabled) {
        await disableWebPushNotifications();
        setPushEnabled(false);
        toast.info('Browser push notifications disabled for this device.');
      } else {
        const result = await enableWebPushNotifications();
        setPushPermission(result.permission);
        if (result.success) {
          setPushEnabled(true);
          toast.success('🎉 Push notifications enabled! You will now receive real-time alerts.');
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

  useEffect(() => {
    if (!user) return;
    let active = true;

    dashboardService
      .fetchFreshDashboardData(user)
      .then((data) => {
        if (active && data) {
          setDashboardData(data);
          setLoadingDashboard(false);
        }
      })
      .catch((err) => {
        console.warn('[ProfilePage] Error fetching stats:', err);
        setLoadingDashboard(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

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
    try {
      await authService.sendPasswordResetEmail(user.email);
      toast.success(`Password reset link sent to ${user.email}`);
    } catch (err) {
      toast.error(err.message || 'Failed to send reset email.');
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
        <p className="text-slate-500">Profile data not available.</p>
      </div>
    );
  }

  const isOnline = userProfile.onlineStatus === 'online';
  const stats = dashboardData?.stats || {
    totalWorkspaces: 0,
    ideasCreated: 0,
    ideasVoted: 0,
    assignedTasks: 0,
    completedTasks: 0,
  };

  const skillsList = userProfile.skills
    ? userProfile.skills.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const techStackList = userProfile.techStack
    ? userProfile.techStack.split(',').map((t) => t.trim()).filter(Boolean)
    : [];

  // Achievements Computation
  const achievements = [
    {
      id: 'first_idea',
      title: 'First Idea Posted',
      desc: 'Submitted a project proposal',
      icon: Lightbulb,
      unlocked: stats.ideasCreated > 0,
    },
    {
      id: 'mvp_creator',
      title: 'MVP Creator',
      desc: 'Proposal chosen as winning MVP',
      icon: Trophy,
      unlocked: false, // Updated dynamically if user is MVP author
    },
    {
      id: 'active_collaborator',
      title: 'Active Collaborator',
      desc: 'Joined a team workspace',
      icon: Briefcase,
      unlocked: stats.totalWorkspaces > 0,
    },
    {
      id: 'task_champion',
      title: 'Task Champion',
      desc: 'Completed sprint tasks',
      icon: CheckCircle,
      unlocked: stats.completedTasks > 0,
    },
    {
      id: 'consensus_voter',
      title: 'Consensus Voter',
      desc: 'Voted on team proposals',
      icon: ThumbsUp,
      unlocked: stats.ideasVoted > 0,
    },
    {
      id: 'early_adopter',
      title: 'Early Adopter',
      desc: 'Convia Platform Innovator',
      icon: Award,
      unlocked: true,
    },
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto px-4 py-8">
      {/* 1. Profile Header Hero */}
      <Card className="bg-gradient-to-r from-slate-900 via-primary-950 to-slate-900 text-white p-8 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 h-48 w-48 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-6 relative z-10">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
            <div className="relative shrink-0">
              <Avatar
                name={userProfile.displayName}
                size="lg"
                className="h-24 w-24 text-2xl border-4 border-primary-500/50 shadow-xl ring-4 ring-primary-500/20"
              />
              <span
                className={`absolute bottom-1 right-1 h-5 w-5 rounded-full border-2 border-slate-900 ${
                  isOnline ? 'bg-emerald-500' : 'bg-slate-500'
                }`}
                title={isOnline ? 'Online' : 'Offline'}
              />
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {userProfile.displayName}
                </h1>
                {userProfile.username && (
                  <span className="text-sm font-semibold text-primary-300">
                    @{userProfile.username}
                  </span>
                )}
                {userProfile.profileCompleted && (
                  <Badge variant="info" className="bg-primary-500/30 text-primary-200 border-primary-400/40">
                    <UserCheck className="h-3 w-3" /> Verified Member
                  </Badge>
                )}
              </div>

              <p className="text-sm text-slate-300 font-medium">{userProfile.email}</p>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-slate-400 pt-1">
                <span className="flex items-center gap-1">
                  <Wifi className="h-3.5 w-3.5 text-emerald-400" /> {userProfile.onlineStatus || 'Online'}
                </span>
                <span>&bull;</span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-primary-400" /> {formatPlatformJoinDate(userProfile.firstSignedInAt || userProfile.joinedAt || userProfile.createdAt)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {Boolean(
              userProfile?.role === 'superadmin' ||
              userProfile?.role === 'admin' ||
              userProfile?.isAdmin === true ||
              ((import.meta.env.VITE_ADMIN_EMAIL || 'admin@convia.dev').toLowerCase().trim() === (user?.email || '').toLowerCase().trim())
            ) && (
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

      {/* 2. Quick Statistics Dashboard */}
      <div className="space-y-4">
        <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary-600" /> Contribution Statistics
        </h2>

        {loadingDashboard ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="p-4 h-24 animate-pulse bg-slate-100" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <Card className="p-4 bg-white border border-slate-200 shadow-sm flex flex-col justify-between hover:border-primary-300 transition-colors">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-bold uppercase tracking-wider">Workspaces</span>
                <Briefcase className="h-4 w-4 text-primary-500" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mt-2">{stats.totalWorkspaces}</h3>
            </Card>

            <Card className="p-4 bg-white border border-slate-200 shadow-sm flex flex-col justify-between hover:border-teal-300 transition-colors">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-bold uppercase tracking-wider">Ideas Created</span>
                <Layers className="h-4 w-4 text-teal-500" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mt-2">{stats.ideasCreated}</h3>
            </Card>

            <Card className="p-4 bg-white border border-slate-200 shadow-sm flex flex-col justify-between hover:border-amber-300 transition-colors">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-bold uppercase tracking-wider">Votes Cast</span>
                <ThumbsUp className="h-4 w-4 text-amber-500" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mt-2">{stats.ideasVoted}</h3>
            </Card>

            <Card className="p-4 bg-white border border-slate-200 shadow-sm flex flex-col justify-between hover:border-primary-300 transition-colors">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-bold uppercase tracking-wider">Tasks Assigned</span>
                <CheckSquare className="h-4 w-4 text-primary-500" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mt-2">{stats.assignedTasks}</h3>
            </Card>

            <Card className="p-4 bg-white border border-slate-200 shadow-sm flex flex-col justify-between hover:border-emerald-300 transition-colors">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-bold uppercase tracking-wider">Tasks Done</span>
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mt-2">{stats.completedTasks}</h3>
            </Card>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (2 cols): About, Workspace Activity & Activity Timeline */}
        <div className="lg:col-span-2 space-y-8">
          {/* 3. About Section */}
          <Card className="p-6 bg-white border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary-600" /> About & Bio
              </h3>
              <Button
                variant="ghost"
                size="sm"
                icon={<Pencil className="h-3.5 w-3.5" />}
                onClick={() => setIsEditModalOpen(true)}
                className="text-xs text-primary-600 hover:text-primary-700"
              >
                Edit
              </Button>
            </div>

            {/* Bio */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Biography
              </h4>
              <p className="text-sm text-slate-700 leading-relaxed font-medium bg-slate-50 p-4 rounded-xl border border-slate-100">
                {userProfile.bio || (
                  <span className="text-slate-400 italic">
                    No bio added yet. Click &quot;Edit Profile&quot; to share your story with the team!
                  </span>
                )}
              </p>
            </div>

            {/* College / Organization */}
            {userProfile.college && (
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <GraduationCap className="h-4 w-4 text-primary-500" />
                <span>{userProfile.college}</span>
              </div>
            )}

            {/* Skills & Tech Stack */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
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
                  <p className="text-xs text-slate-400 italic">No skills listed</p>
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
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
                  <p className="text-xs text-slate-400 italic">No tech stack listed</p>
                )}
              </div>
            </div>

            {/* Social Links */}
            {(userProfile.github || userProfile.linkedin || userProfile.portfolio) && (
              <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-3">
                {userProfile.github && (
                  <a
                    href={userProfile.github}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Github className="h-3.5 w-3.5" /> GitHub <ExternalLink className="h-3 w-3 text-slate-400" />
                  </a>
                )}
                {userProfile.linkedin && (
                  <a
                    href={userProfile.linkedin}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-700 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Linkedin className="h-3.5 w-3.5 text-primary-600" /> LinkedIn <ExternalLink className="h-3 w-3 text-primary-400" />
                  </a>
                )}
                {userProfile.portfolio && (
                  <a
                    href={userProfile.portfolio}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Globe className="h-3.5 w-3.5 text-teal-600" /> Portfolio <ExternalLink className="h-3 w-3 text-teal-400" />
                  </a>
                )}
              </div>
            )}
          </Card>

          {/* 4. Workspace Activity */}
          <Card className="p-6 bg-white border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Briefcase className="h-4 w-4 text-primary-600" /> Current Workspaces & Activity
            </h3>

            {dashboardData?.organizations?.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2">
                You are not currently an active member of any workspace.
              </p>
            ) : (
              <div className="space-y-3">
                {dashboardData?.organizations?.map((ws) => (
                  <div
                    key={ws.orgId}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900 text-sm">{ws.name}</h4>
                        <Badge variant={ws.userRole === 'owner' ? 'warning' : 'info'} className="capitalize text-[10px]">
                          {ws.userRole || 'Member'}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500">
                        {ws.hackathonName || 'Hackathon Team'} &bull; Status: {ws.status === 'project' ? 'Sprint' : 'Ideation'}
                      </p>
                    </div>

                    <Link to={`/workspaces/${ws.orgId}/ideas`}>
                      <Button variant="secondary" size="sm" icon={<ArrowRight className="h-3.5 w-3.5 text-primary-600" />}>
                        View Workspace
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* 5. Achievements */}
          <Card className="p-6 bg-white border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Award className="h-4 w-4 text-amber-500" /> Unlocked Achievements
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {achievements.map((item) => {
                const IconComp = item.icon;
                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-xl border transition-all text-center space-y-2 ${
                      item.unlocked
                        ? 'bg-amber-50/60 border-amber-200 shadow-sm'
                        : 'bg-slate-50 border-slate-200 opacity-40 grayscale'
                    }`}
                  >
                    <div className="flex justify-center">
                      <div className={`p-2.5 rounded-full ${item.unlocked ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-300 text-slate-600'}`}>
                        <IconComp className="h-5 w-5" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-xs">{item.title}</h4>
                      <p className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* 6. My Submitted Reports */}
          <UserReportsList />
        </div>

        {/* Right Column (1 col): Account Info, Notifications, Security & Danger Zone */}
        <div className="space-y-8">
          {/* 7. Account Information */}
          <Card className="p-6 bg-white border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
              <ShieldCheck className="h-4 w-4 text-primary-600" /> Account Specs
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Email Address</span>
                <p className="font-semibold text-slate-800 truncate">{userProfile.email}</p>
              </div>

              <div>
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">User ID (UID)</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="font-mono text-slate-700 text-[11px] truncate bg-slate-100 px-2 py-1 rounded flex-1">
                    {userProfile.uid}
                  </p>
                  <button
                    onClick={handleCopyUid}
                    className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                    title="Copy UID"
                  >
                    {copiedUid ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-slate-500 font-medium">Joined Date</span>
                <span className="font-semibold text-slate-800">{formatPlatformJoinDate(userProfile.firstSignedInAt || userProfile.joinedAt || userProfile.createdAt)}</span>
              </div>
            </div>
          </Card>

          {/* 8. Notification Preferences */}
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
                  className="rounded text-primary-600 focus:ring-primary-500 h-4 w-4"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span>Workspace Invitations</span>
                <input
                  type="checkbox"
                  checked={notifPrefs.invitations}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, invitations: e.target.checked })}
                  className="rounded text-primary-600 focus:ring-primary-500 h-4 w-4"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span>Task Updates</span>
                <input
                  type="checkbox"
                  checked={notifPrefs.taskUpdates}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, taskUpdates: e.target.checked })}
                  className="rounded text-primary-600 focus:ring-primary-500 h-4 w-4"
                />
              </label>

              {/* Web Push Notifications */}
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
                  Receive instant alerts for mentions, chat replies, and blueprint approvals on this device.
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
                    {pushEnabled ? 'Disable Push on This Device' : 'Enable Browser Push Notifications'}
                  </Button>
                )}
                {pushPermission === 'denied' && (
                  <p className="text-[10px] text-amber-800 bg-amber-50 p-2 rounded border border-amber-200">
                    Notifications are blocked in your browser. Click the site settings icon in your URL bar to allow notifications.
                  </p>
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

          {/* 10. Security & Authentication Center */}
          <Card className="p-6 bg-white border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary-600" /> Security & Authentication
              </h3>
              <div className="flex items-center gap-1 text-amber-500" title="Security Score: 5 Stars">
                {[...Array(user?.emailVerified ? 5 : 4)].map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-current" />
                ))}
              </div>
            </div>

            {/* 1. Email Verification */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Email Verification</span>
                {user?.emailVerified ? (
                  <Badge variant="success" className="flex items-center gap-1 font-bold text-[10px]">
                    <Check className="h-3 w-3" /> Email Verified
                  </Badge>
                ) : (
                  <Badge variant="warning" className="flex items-center gap-1 font-bold text-[10px]">
                    <AlertTriangle className="h-3 w-3" /> Email Not Verified
                  </Badge>
                )}
              </div>

              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                {user?.emailVerified
                  ? 'Your email address has been verified with Firebase Authentication.'
                  : 'Verify your email address to unlock full workspace capabilities.'}
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

            {/* 2. Password Reset */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Password Reset</span>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Send a secure password reset email to <strong className="text-slate-800">{user?.email}</strong>.
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

            {/* 3. Change Email Address */}
            <form onSubmit={handleUpdateEmail} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Change Email Address</span>
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
                className="text-xs font-bold border-slate-300"
              >
                Update Email Address
              </Button>
            </form>
          </Card>

          {/* 11. Danger Zone */}
          <Card className="p-6 bg-rose-50/50 border border-rose-200 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-rose-900 uppercase tracking-wider flex items-center gap-2 border-b border-rose-200 pb-3">
              <AlertTriangle className="h-4 w-4 text-rose-600" /> Danger Zone
            </h3>

            <p className="text-xs text-rose-700 leading-relaxed font-medium">
              Deleting your account permanently removes your profile and cannot be undone.
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
