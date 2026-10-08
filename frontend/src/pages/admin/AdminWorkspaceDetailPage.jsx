import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { adminService } from '../../services/adminService';
import { NotificationService } from '../../services/notificationService';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Select } from '../../components/ui/Select';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { formatTimestamp } from '../../utils/formatting';
import { getWorkspaceMemberHistory } from '../../utils/workspaceMemberHistory';
import {
  Briefcase,
  ArrowLeft,
  Users,
  Lightbulb,
  CheckSquare,
  Trophy,
  Activity,
  Lock,
  Unlock,
  Archive,
  RotateCcw,
  Trash2,
  CheckCircle2,
  Copy,
  Check,
  FileText,
  Crown,
  Heart,
  Calendar,
  Layers,
} from 'lucide-react';

export default function AdminWorkspaceDetailPage() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('mvp');

  // Moderation & Ownership Transfer States
  const [selectedNewOwner, setSelectedNewOwner] = useState('');
  const [lockReason, setLockReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Dialog Controls
  const [isLockDialogOpen, setIsLockDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;
    setLoading(true);

    const unsubscribe = adminService.subscribeToWorkspaceDetail(workspaceId, (detail) => {
      setData(detail);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [workspaceId]);

  if (loading || !data || !data.workspace) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <LoadingSkeleton variant="card" count={3} />
      </div>
    );
  }

  const { workspace, members, ideas, selectedMvp, tasks, blueprint, timeline, auditLogs, stats } = data;
  const isLocked = workspace.isLocked;
  const isArchived = workspace.isArchived;

  const handleCopyId = () => {
    navigator.clipboard.writeText(workspace.orgId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleConfirmLock = async () => {
    if (!lockReason.trim()) return;
    setActionLoading(true);
    try {
      await adminService.lockWorkspace(
        currentUser.uid,
        currentUser.displayName || currentUser.email,
        workspaceId,
        lockReason
      );
      setIsLockDialogOpen(false);
      setLockReason('');
      NotificationService.success('Workspace has been locked.');
    } catch (err) {
      NotificationService.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnlock = async () => {
    setActionLoading(true);
    try {
      await adminService.unlockWorkspace(
        currentUser.uid,
        currentUser.displayName || currentUser.email,
        workspaceId
      );
      NotificationService.success('Workspace unlocked.');
    } catch (err) {
      NotificationService.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchiveToggle = async () => {
    setActionLoading(true);
    try {
      if (isArchived) {
        await adminService.restoreWorkspace(
          currentUser.uid,
          currentUser.displayName || currentUser.email,
          workspaceId
        );
        NotificationService.success('Workspace restored from archive.');
      } else {
        await adminService.archiveWorkspace(
          currentUser.uid,
          currentUser.displayName || currentUser.email,
          workspaceId
        );
        NotificationService.success('Workspace archived.');
      }
    } catch (err) {
      NotificationService.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleTransferOwnership = async (e) => {
    e.preventDefault();
    if (!selectedNewOwner) return;
    const targetMember = members.find((m) => m.uid === selectedNewOwner);
    if (!targetMember) return;

    setActionLoading(true);
    try {
      await adminService.transferWorkspaceOwnership(
        currentUser.uid,
        currentUser.displayName || currentUser.email,
        workspaceId,
        targetMember.uid,
        targetMember.displayName
      );
      setSelectedNewOwner('');
      NotificationService.success(`Ownership transferred to ${targetMember.displayName}.`);
    } catch (err) {
      NotificationService.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    setActionLoading(true);
    try {
      await adminService.deleteWorkspaceByAdmin(
        currentUser.uid,
        currentUser.displayName || currentUser.email,
        workspaceId
      );
      NotificationService.success('Workspace deleted permanently.');
      navigate('/admin/workspaces');
    } catch (err) {
      NotificationService.error(err);
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <Button
          variant="secondary"
          size="sm"
          icon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => navigate('/admin/workspaces')}
          className="bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
        >
          Back to Workspaces Directory
        </Button>

        <Badge variant="default" className="bg-purple-950 text-purple-300 border border-purple-800 font-mono text-xs">
          Workspace ID: {workspace.orgId}
        </Badge>
      </div>

      {/* Header Banner */}
      <Card className="p-6 bg-slate-900 border border-slate-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-black text-white">{workspace.name}</h1>
              <span className={`px-3 py-0.5 rounded-full text-xs font-bold ${
                isLocked
                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                  : isArchived
                  ? 'bg-slate-800 text-slate-400'
                  : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
              }`}>
                {workspace.statusTag}
              </span>
            </div>

            <p className="text-xs text-slate-400 font-medium">
              Hackathon: <strong className="text-slate-200">{workspace.hackathonName || 'General Workspace'}</strong> · Owner: <strong className="text-purple-400">{workspace.ownerName}</strong>
            </p>

            <div className="flex items-center gap-3 text-[11px] font-mono text-slate-500 pt-1">
              <span>Created {formatTimestamp(workspace.createdAt)}</span>
              <span>·</span>
              <button onClick={handleCopyId} className="flex items-center gap-1 hover:text-purple-400 transition-colors">
                {copiedId ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                <span>Copy ID</span>
              </button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            {isLocked ? (
              <Button
                variant="secondary"
                size="sm"
                icon={<Unlock className="h-4 w-4 text-emerald-400" />}
                onClick={handleUnlock}
                isLoading={actionLoading}
                className="bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold"
              >
                Unlock
              </Button>
            ) : (
              <Button
                variant="danger"
                size="sm"
                icon={<Lock className="h-4 w-4" />}
                onClick={() => setIsLockDialogOpen(true)}
                className="bg-rose-950 text-rose-300 border border-rose-800 font-bold"
              >
                Lock Workspace
              </Button>
            )}

            <Button
              variant="secondary"
              size="sm"
              icon={isArchived ? <RotateCcw className="h-4 w-4 text-emerald-400" /> : <Archive className="h-4 w-4 text-slate-400" />}
              onClick={handleArchiveToggle}
              isLoading={actionLoading}
              className="bg-slate-800 text-slate-200 border border-slate-700 font-bold"
            >
              {isArchived ? 'Restore' : 'Archive'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Statistics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Team Members</span>
          <div className="text-2xl font-black text-white">{stats.membersCount}</div>
          <span className="text-[11px] text-purple-400 font-medium">Active Roster</span>
        </Card>

        <Card className="p-4 bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Proposals</span>
          <div className="text-2xl font-black text-white">{stats.ideasCount}</div>
          <span className="text-[11px] text-amber-400 font-medium">{selectedMvp ? '1 MVP Selected' : '0 MVP Selected'}</span>
        </Card>

        <Card className="p-4 bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Sprint Tasks</span>
          <div className="text-2xl font-black text-white">{stats.tasksCount}</div>
          <span className="text-[11px] text-emerald-400 font-medium">{stats.completedTasks} Completed</span>
        </Card>

        <Card className="p-4 bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Completion Rate</span>
          <div className="text-2xl font-black text-white">{stats.progressRate}%</div>
          <ProgressBar value={stats.progressRate} size="sm" className="mt-1" />
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        {[
          { id: 'mvp', label: 'Selected MVP & Blueprint', icon: Trophy },
          { id: 'members', label: `Members (${members.length})`, icon: Users },
          { id: 'ideas', label: `Proposals (${ideas.length})`, icon: Lightbulb },
          { id: 'tasks', label: `Sprint Tasks (${tasks.length})`, icon: CheckSquare },
          { id: 'timeline', label: 'Activity & Audit Log', icon: Activity },
          { id: 'moderation', label: 'Moderation & Danger Zone', icon: Lock },
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

      {/* Tab 1: MVP & Blueprint */}
      {activeTab === 'mvp' && (
        <div className="space-y-6">
          {selectedMvp ? (
            <Card className="p-6 bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900 border border-amber-900/60 space-y-4">
              <div className="flex items-center justify-between border-b border-amber-900/40 pb-3">
                <span className="text-xs font-mono font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                  <Trophy className="h-4 w-4" /> Active Workspace Selected MVP
                </span>
                <span className="text-xs font-bold text-slate-300">{selectedMvp.voteCount || 0} Votes</span>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-black text-white">{selectedMvp.title}</h3>
                <p className="text-xs text-slate-300 font-medium leading-relaxed">{selectedMvp.problemStatement || selectedMvp.description}</p>
              </div>

              {selectedMvp.proposedSolution && (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-amber-400 font-bold">Proposed Solution</span>
                  <p className="text-xs text-slate-300">{selectedMvp.proposedSolution}</p>
                </div>
              )}
            </Card>
          ) : (
            <Card className="p-8 text-center bg-slate-900 border border-slate-800 space-y-2">
              <Trophy className="h-8 w-8 text-slate-600 mx-auto" />
              <h3 className="text-sm font-bold text-slate-300">No MVP Selected Yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">This workspace is currently in the Ideation phase and has not selected an active MVP proposal.</p>
            </Card>
          )}

          {/* Blueprint Status */}
          <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Layers className="h-4 w-4 text-purple-400" /> Project Architecture Blueprint
            </h3>
            {blueprint ? (
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                <span className="text-purple-300 font-mono font-bold">Blueprint Version: 1.0</span>
                <p className="text-slate-300">{blueprint.description || 'Full technical specification generated.'}</p>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">No blueprint document generated yet.</p>
            )}
          </Card>
        </div>
      )}

      {/* Tab 2: Members Management */}
      {activeTab === 'members' && (
        <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Users className="h-4 w-4 text-purple-400" /> Workspace Member Roster & Ownership
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-medium text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-mono border-b border-slate-800">
                <tr>
                  <th className="p-3">Member</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Joined Date</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {members.map((m) => {
                  const history = getWorkspaceMemberHistory(m, workspace);
                  return (
                    <tr key={m.uid} className="hover:bg-slate-850 transition-colors">
                      <td className="p-3 flex items-center gap-2.5 font-bold text-white">
                        <Avatar name={m.displayName || m.email} size="sm" />
                        <span>{m.displayName}</span>
                        {history.isOriginalCreator && !history.isOwner && (
                          <span className="text-[10px] bg-slate-800 text-slate-400 font-bold px-1.5 py-0.5 rounded border border-slate-700">
                            Creator
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-slate-400">{m.email}</td>
                      <td className="p-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                          history.isOwner ? 'bg-purple-950 text-purple-300 border border-purple-800' : 'bg-slate-800 text-slate-300'
                        }`}>
                          {history.isOwner ? '👑 LEADER' : history.isCaptain ? '⚡ CAPTAIN' : 'MEMBER'}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-400">{history.dateText}</td>
                      <td className="p-3 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/admin/users/${m.uid}`)}
                        className="bg-slate-800 text-xs text-white font-bold"
                      >
                        User Profile
                      </Button>
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 3: Workspace Ideas */}
      {activeTab === 'ideas' && (
        <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Lightbulb className="h-4 w-4 text-amber-400" /> Workspace Proposals
          </h3>

          <div className="space-y-3">
            {ideas.map((i) => (
              <div key={i.ideaId} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-white">{i.title}</h4>
                  <p className="text-xs text-slate-400">Authored by {i.authorName || 'Member'} · {i.voteCount || 0} Votes</p>
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

      {/* Tab 4: Sprint Tasks */}
      {activeTab === 'tasks' && (
        <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <CheckSquare className="h-4 w-4 text-emerald-400" /> Workspace Sprint Tasks
          </h3>

          <div className="space-y-3">
            {tasks.map((t) => (
              <div key={t.taskId} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-white">{t.title}</h4>
                  <p className="text-xs text-slate-400">Assigned to: {t.assigneeName || 'Developer'} · Priority: {t.priority || 'Medium'}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  t.status === 'Completed' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-amber-950 text-amber-300 border border-amber-800'
                }`}>
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tab 5: Activity & Audit Log */}
      {activeTab === 'timeline' && (
        <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Activity className="h-4 w-4 text-purple-400" /> Chronological Event Stream & Admin Audit Trail
          </h3>

          <div className="space-y-3">
            {timeline.map((item) => (
              <div key={item.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-slate-200">{item.title}</p>
                  <span className="text-[11px] text-slate-400">by {item.user}</span>
                </div>
                <span className="font-mono text-slate-400 text-[11px]">{formatTimestamp(item.timestamp)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tab 6: Moderation Panel */}
      {activeTab === 'moderation' && (
        <div className="space-y-6">
          <Card className="p-6 bg-slate-900 border border-slate-800 space-y-5">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Crown className="h-4 w-4 text-purple-400" /> Transfer Workspace Ownership
            </h3>

            <form onSubmit={handleTransferOwnership} className="space-y-3 max-w-md">
              <Select
                label="Select New Workspace Leader *"
                options={members.map((m) => ({ value: m.uid, label: `${m.displayName} (${m.email})` }))}
                value={selectedNewOwner}
                onChange={(e) => setSelectedNewOwner(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white"
              />

              <Button
                variant="primary"
                type="submit"
                size="sm"
                isLoading={actionLoading}
                disabled={!selectedNewOwner}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold"
              >
                Transfer Ownership
              </Button>
            </form>
          </Card>

          <Card className="p-6 bg-rose-950/40 border border-rose-900/60 space-y-4">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-rose-300 flex items-center gap-2 border-b border-rose-900/60 pb-3">
              <Trash2 className="h-4 w-4 text-rose-400" /> Danger Zone — Permanent Deletion
            </h3>

            <p className="text-xs text-rose-300 font-medium">
              Cascade delete this workspace and purge all proposals, tasks, blueprints, and team rosters permanently.
            </p>

            <Button
              variant="danger"
              size="sm"
              icon={<Trash2 className="h-4 w-4" />}
              onClick={() => setIsDeleteDialogOpen(true)}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
            >
              Cascade Delete Workspace
            </Button>
          </Card>
        </div>
      )}

      {/* Lock Dialog */}
      <ConfirmDialog
        isOpen={isLockDialogOpen}
        title={`Lock Workspace: ${workspace.name}`}
        description="Locking restricts proposal posting, voting, and task updates."
        confirmLabel="Confirm Lock"
        variant="danger"
        isLoading={actionLoading}
        onConfirm={handleConfirmLock}
        onCancel={() => setIsLockDialogOpen(false)}
      >
        <div className="mt-4">
          <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase">
            Reason for Lock *
          </label>
          <textarea
            placeholder="Explain why this workspace is locked..."
            value={lockReason}
            onChange={(e) => setLockReason(e.target.value)}
            rows={3}
            className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
          />
        </div>
      </ConfirmDialog>

      {/* Delete Dialog */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        title={`Delete Workspace: ${workspace.name}?`}
        description="Permanently deletes workspace document, proposals, tasks, and member references. This action cannot be undone."
        confirmLabel="Delete Workspace Data"
        variant="danger"
        isLoading={actionLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsDeleteDialogOpen(false)}
      />
    </div>
  );
}
