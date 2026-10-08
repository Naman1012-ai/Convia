import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { adminService } from '../../services/adminService';
import { authService } from '../../services/authService';
import { NotificationService } from '../../services/notificationService';
import { NOTIFICATION_MESSAGES } from '../../utils/notificationMessages';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { formatTimestamp } from '../../utils/formatting';
import {
  User,
  ShieldAlert,
  ArrowLeft,
  Activity,
  Briefcase,
  Lightbulb,
  CheckSquare,
  FileText,
  AlertTriangle,
  Ban,
  RotateCcw,
  KeyRound,
  Mail,
  Copy,
  Check,
  Clock,
  Send,
  Lock,
  Sparkles,
  UserPlus,
} from 'lucide-react';

export default function AdminUserDetailPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('timeline');

  // Form & Action States
  const [newNote, setNewNote] = useState('');
  const [warningReason, setWarningReason] = useState('');
  const [warningSeverity, setWarningSeverity] = useState('Medium');
  const [suspendReason, setSuspendReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);

  // Dialog Controls
  const [isSuspendDialogOpen, setIsSuspendDialogOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);

    const unsubscribe = adminService.subscribeToUserDetail(userId, (detail) => {
      setData(detail);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  if (loading || !data || !data.user) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <LoadingSkeleton variant="card" count={3} />
      </div>
    );
  }

  const { user: profileUser, stats, workspaces, ideas, tasks, blueprints = [], invitations = [], timeline, notes, warnings, auditLogs } = data;
  const isSuspended = profileUser.isSuspended;

  const handleCopyUid = () => {
    navigator.clipboard.writeText(profileUser.uid);
    setCopiedUid(true);
    setTimeout(() => setCopiedUid(false), 2000);
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setActionLoading(true);
    try {
      await adminService.addUserNote(
        currentUser.uid,
        currentUser.displayName || currentUser.email,
        userId,
        newNote
      );
      setNewNote('');
      NotificationService.success('Internal admin note saved successfully.');
    } catch (err) {
      NotificationService.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleIssueWarning = async (e) => {
    e.preventDefault();
    if (!warningReason.trim()) return;
    setActionLoading(true);
    try {
      await adminService.addUserWarning(
        currentUser.uid,
        currentUser.displayName || currentUser.email,
        userId,
        warningReason,
        warningSeverity
      );
      setWarningReason('');
      NotificationService.success(`Issued ${warningSeverity} severity warning to user.`);
    } catch (err) {
      NotificationService.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmSuspend = async () => {
    if (!suspendReason.trim()) return;
    setActionLoading(true);
    try {
      await adminService.suspendUser(
        currentUser.uid,
        currentUser.displayName || currentUser.email,
        userId,
        suspendReason
      );
      setIsSuspendDialogOpen(false);
      setSuspendReason('');
      NotificationService.success('User account has been suspended.');
    } catch (err) {
      NotificationService.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestoreUser = async () => {
    setActionLoading(true);
    try {
      await adminService.restoreUser(
        currentUser.uid,
        currentUser.displayName || currentUser.email,
        userId
      );
      NotificationService.success('User account access restored.');
    } catch (err) {
      NotificationService.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    setActionLoading(true);
    try {
      await authService.sendPasswordResetEmail(profileUser.email);
      NotificationService.success(NOTIFICATION_MESSAGES.AUTH.PASSWORD_RESET);
    } catch (err) {
      NotificationService.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Navigation */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <Button
          variant="secondary"
          size="sm"
          icon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => navigate('/admin/users')}
          className="bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
        >
          Back to Users Directory
        </Button>

        <Badge variant="default" className="bg-purple-950 text-purple-300 border border-purple-800 font-mono text-xs">
          UID: {profileUser.uid}
        </Badge>
      </div>

      {/* User Header Profile Card */}
      <Card className="p-6 bg-slate-900 border border-slate-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Avatar name={profileUser.displayName || profileUser.email} size="lg" />
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-extrabold text-white">{profileUser.displayName || 'User'}</h1>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                  profileUser.role === 'superadmin' ? 'bg-purple-950 text-purple-300 border border-purple-800' : 'bg-slate-800 text-slate-300'
                }`}>
                  {profileUser.role === 'superadmin' ? 'SUPER ADMIN' : 'USER'}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isSuspended
                    ? 'bg-rose-950 text-rose-300 border border-rose-800'
                    : profileUser.onlineStatus === 'online'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {isSuspended ? '⛔ SUSPENDED' : profileUser.onlineStatus === 'online' ? '● Online' : 'Offline'}
                </span>
              </div>

              <p className="text-xs text-slate-400 font-mono">{profileUser.email}</p>

              <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-500 pt-1">
                <span>Joined {formatTimestamp(profileUser.joinedAt)}</span>
                <span>·</span>
                <span className="text-slate-300 font-bold">
                  Last Login: {profileUser.lastLoginAt ? formatTimestamp(profileUser.lastLoginAt) : 'Never logged in / legacy account'}
                </span>
                <span>·</span>
                <button
                  onClick={handleCopyUid}
                  className="flex items-center gap-1 hover:text-purple-400 transition-colors"
                >
                  {copiedUid ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  <span>Copy UID</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Action Controls */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            {isSuspended ? (
              <Button
                variant="secondary"
                size="sm"
                icon={<RotateCcw className="h-4 w-4 text-emerald-400" />}
                onClick={handleRestoreUser}
                isLoading={actionLoading}
                className="bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 font-bold"
              >
                Restore Account Access
              </Button>
            ) : (
              <Button
                variant="danger"
                size="sm"
                icon={<Ban className="h-4 w-4" />}
                onClick={() => setIsSuspendDialogOpen(true)}
                className="bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 font-bold"
              >
                Suspend User
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              icon={<KeyRound className="h-4 w-4 text-purple-400" />}
              onClick={handlePasswordReset}
              isLoading={actionLoading}
              className="bg-slate-800 hover:bg-slate-750 text-white font-bold"
            >
              Reset Password
            </Button>
          </div>
        </div>
      </Card>

      {/* User Statistics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Workspaces</span>
          <div className="text-2xl font-black text-white">{stats.totalWorkspaces}</div>
          <span className="text-[11px] text-purple-400 font-medium">{stats.ownedWorkspaces} Owned</span>
        </Card>

        <Card className="p-4 bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Proposals Authored</span>
          <div className="text-2xl font-black text-white">{stats.totalIdeas}</div>
          <span className="text-[11px] text-amber-400 font-medium">{stats.selectedMvps} Selected MVPs</span>
        </Card>

        <Card className="p-4 bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Assigned Tasks</span>
          <div className="text-2xl font-black text-white">{stats.totalTasks}</div>
          <span className="text-[11px] text-emerald-400 font-medium">{stats.completedTasks} Completed</span>
        </Card>

        <Card className="p-4 bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Completion Rate</span>
          <div className="text-2xl font-black text-white">{stats.completionRate}%</div>
          <span className="text-[11px] text-slate-400 font-medium">Sprint Performance</span>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        {[
          { id: 'timeline', label: `Activity Timeline (${timeline.length})`, icon: Activity },
          { id: 'workspaces', label: `Workspaces (${workspaces.length})`, icon: Briefcase },
          { id: 'ideas', label: `Proposals (${ideas.length})`, icon: Lightbulb },
          { id: 'tasks', label: `Developer Tasks (${tasks.length})`, icon: CheckSquare },
          { id: 'blueprints', label: `AI Blueprints (${blueprints.length})`, icon: Sparkles },
          { id: 'invitations', label: `Invitations (${invitations.length})`, icon: UserPlus },
          { id: 'notes', label: `Admin Notes & Warnings (${notes.length + warnings.length})`, icon: FileText },
          { id: 'moderation', label: `Audit Log (${auditLogs.length})`, icon: Lock },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-900/40'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Activity Timeline */}
      {activeTab === 'timeline' && (
        <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
              <Activity className="h-4 w-4 text-purple-400" /> Chronological User Activity Stream
            </h3>
            <Badge variant="default" className="bg-purple-950 text-purple-300 border border-purple-800 text-[10px] font-mono">
              {timeline.length} Historical Events
            </Badge>
          </div>

          {timeline.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-500 italic bg-slate-950/50 rounded-xl border border-dashed border-slate-800">
              No historical activity events recorded for this user yet.
            </div>
          ) : (
            <div className="space-y-3">
              {timeline.map((item) => (
                <div key={item.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-850 text-purple-400 shrink-0">
                      <Clock className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <span className="font-bold text-slate-200">{item.title}</span>
                      {item.workspaceId && (
                        <span className="ml-2 font-mono text-[10px] bg-slate-900 text-purple-300 px-2 py-0.5 rounded border border-purple-900/40">
                          Workspace: {workspaces.find((w) => w.orgId === item.workspaceId)?.name || item.workspaceId}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="font-mono text-slate-400 text-[11px] shrink-0">{formatTimestamp(item.timestamp)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Tab 2: Workspaces */}
      {activeTab === 'workspaces' && (
        <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Briefcase className="h-4 w-4 text-purple-400" /> Joined & Owned Workspaces
          </h3>

          <div className="space-y-3">
            {workspaces.map((w) => (
              <div key={w.orgId} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-white">{w.name}</h4>
                  <p className="text-xs text-slate-400">Hackathon: {w.hackathonName || 'General Workspace'} · Created {formatTimestamp(w.createdAt)}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  w.ownerId === userId ? 'bg-purple-950 text-purple-300 border border-purple-800' : 'bg-slate-800 text-slate-300'
                }`}>
                  {w.ownerId === userId ? '👑 Workspace Leader' : 'Member'}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tab 3: Proposals & Ideas */}
      {activeTab === 'ideas' && (
        <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Lightbulb className="h-4 w-4 text-amber-400" /> Authored Proposals
          </h3>

          <div className="space-y-3">
            {ideas.map((i) => (
              <div key={i.ideaId} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-white">{i.title}</h4>
                  <p className="text-xs text-slate-400">{i.voteCount || 0} Votes · Created {formatTimestamp(i.createdAt)}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  i.isSelected ? 'bg-amber-950 text-amber-300 border border-amber-700' : 'bg-slate-800 text-slate-300'
                }`}>
                  {i.isSelected ? '🏆 Selected MVP' : (i.projectStatus || 'Ideation')}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tab 4: Developer Tasks */}
      {activeTab === 'tasks' && (
        <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <CheckSquare className="h-4 w-4 text-emerald-400" /> Sprint Tasks ({tasks.length})
          </h3>

          {tasks.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500 italic">No tasks created or assigned for this user.</div>
          ) : (
            <div className="space-y-3">
              {tasks.map((t) => (
                <div key={t.taskId} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-white">{t.title}</h4>
                    <p className="text-xs text-slate-400">Priority: {t.priority || 'Medium'} · Due: {t.dueDate ? formatTimestamp(t.dueDate) : 'No deadline'}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    t.status === 'Completed' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-amber-950 text-amber-300 border border-amber-800'
                  }`}>
                    {t.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Tab: AI Blueprints */}
      {activeTab === 'blueprints' && (
        <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Sparkles className="h-4 w-4 text-purple-400" /> AI Blueprint Generations ({blueprints.length})
          </h3>

          {blueprints.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500 italic">No AI blueprints associated with this user.</div>
          ) : (
            <div className="space-y-3">
              {blueprints.map((bp) => (
                <div key={bp.blueprintId || bp.updatedAt} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-white">{bp.ideaTitle || 'Workspace Blueprint'}</h4>
                    <p className="text-xs text-slate-400">
                      Model: {bp.aiModel || 'gemini-2.0-flash'} · Version: v{bp.version || '1.0'} · Updated {formatTimestamp(bp.generationCompletedAt || bp.updatedAt || bp.createdAt)}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    bp.status === 'completed'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : bp.status === 'failed'
                      ? 'bg-rose-950 text-rose-300 border border-rose-800'
                      : 'bg-purple-950 text-purple-300 border border-purple-800'
                  }`}>
                    {bp.status || 'Generated'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Tab: Invitations */}
      {activeTab === 'invitations' && (
        <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <UserPlus className="h-4 w-4 text-purple-400" /> Workspace Invitations ({invitations.length})
          </h3>

          {invitations.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500 italic">No invitations sent or received by this user.</div>
          ) : (
            <div className="space-y-3">
              {invitations.map((inv) => (
                <div key={inv.invitationId || inv.inviteCode || inv.createdAt} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-white">To: {inv.invitedEmail || 'Team Member'}</h4>
                    <p className="text-xs text-slate-400">
                      Code: <span className="font-mono text-purple-300">{inv.inviteCode || 'N/A'}</span> · Role: {inv.role || 'member'} · Sent {formatTimestamp(inv.createdAt)}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    inv.status === 'accepted'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : inv.status === 'expired'
                      ? 'bg-slate-800 text-slate-400'
                      : 'bg-amber-950 text-amber-300 border border-amber-800'
                  }`}>
                    {inv.status || 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Tab 5: Admin Notes & Warnings */}
      {activeTab === 'notes' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Internal Admin Notes */}
          <Card className="p-6 bg-slate-900 border border-slate-800 space-y-5">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <FileText className="h-4 w-4 text-purple-400" /> Internal Admin Notes (Private)
            </h3>

            <form onSubmit={handleAddNote} className="space-y-3">
              <Textarea
                placeholder="Add confidential internal note regarding this user..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={3}
                required
                className="bg-slate-950 border-slate-800 text-xs text-white"
              />
              <Button
                variant="primary"
                type="submit"
                size="sm"
                isLoading={actionLoading}
                icon={<Send className="h-3.5 w-3.5" />}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold"
              >
                Add Internal Note
              </Button>
            </form>

            <div className="space-y-3 pt-2">
              {notes.map((n) => (
                <div key={n.noteId} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1 text-xs">
                  <div className="flex items-center justify-between text-[11px] font-mono text-purple-300">
                    <span>by {n.adminName}</span>
                    <span>{formatTimestamp(n.createdAt)}</span>
                  </div>
                  <p className="text-slate-300 font-medium leading-relaxed">{n.content}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* User Warning System */}
          <Card className="p-6 bg-slate-900 border border-slate-800 space-y-5">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <AlertTriangle className="h-4 w-4 text-amber-400" /> Issue Official User Warning
            </h3>

            <form onSubmit={handleIssueWarning} className="space-y-3">
              <Select
                label="Warning Severity"
                options={[
                  { value: 'Low', label: 'Low Severity' },
                  { value: 'Medium', label: 'Medium Severity' },
                  { value: 'High', label: 'High Severity' },
                  { value: 'Critical', label: 'Critical Violation' },
                ]}
                value={warningSeverity}
                onChange={(e) => setWarningSeverity(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white"
              />

              <Textarea
                label="Warning Reason *"
                placeholder="Explain the guideline or platform rule violation..."
                value={warningReason}
                onChange={(e) => setWarningReason(e.target.value)}
                rows={3}
                required
                className="bg-slate-950 border-slate-800 text-xs text-white"
              />

              <Button
                variant="danger"
                type="submit"
                size="sm"
                isLoading={actionLoading}
                icon={<AlertTriangle className="h-3.5 w-3.5" />}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
              >
                Issue Warning to User
              </Button>
            </form>

            <div className="space-y-3 pt-2">
              {warnings.map((w) => (
                <div key={w.warningId} className="p-3.5 rounded-xl bg-slate-950 border border-amber-900/60 space-y-1 text-xs">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-amber-400 font-bold">{w.severity} Severity Warning</span>
                    <span className="text-slate-400">{formatTimestamp(w.createdAt)}</span>
                  </div>
                  <p className="text-slate-300 font-medium">{w.reason}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Tab 6: Audit Log */}
      {activeTab === 'moderation' && (
        <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Lock className="h-4 w-4 text-purple-400" /> Moderation Audit Trail
          </h3>

          {auditLogs.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500 italic">No admin audit logs for this user.</div>
          ) : (
            <div className="space-y-3">
              {auditLogs.map((log) => (
                <div key={log.auditId} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-mono">
                  <div>
                    <span className="text-purple-400 font-bold">{log.actionType}</span>
                    <p className="text-slate-300 font-sans text-xs mt-0.5">{log.details}</p>
                  </div>
                  <div className="text-right text-[11px] text-slate-400">
                    <p>by {log.adminName}</p>
                    <p>{formatTimestamp(log.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Suspend Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isSuspendDialogOpen}
        title={`Suspend User: ${profileUser.displayName || profileUser.email}`}
        description="Suspending this account restricts user login and platform editing privileges."
        confirmLabel="Confirm Suspension"
        variant="danger"
        isLoading={actionLoading}
        onConfirm={handleConfirmSuspend}
        onCancel={() => setIsSuspendDialogOpen(false)}
      >
        <div className="mt-4">
          <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase">
            Reason for Suspension *
          </label>
          <textarea
            placeholder="Explain why this account is being suspended..."
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
            rows={3}
            className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}
