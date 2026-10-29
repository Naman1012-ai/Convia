import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { adminService } from '../../services/adminService';
import { NotificationService } from '../../services/notificationService';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { formatTimestamp } from '../../utils/formatting';
import {
  Briefcase,
  Search,
  Lock,
  Unlock,
  Archive,
  RotateCcw,
  Trash2,
  Eye,
  CheckCircle2,
  Users,
  Lightbulb,
  CheckSquare,
} from 'lucide-react';

export default function AdminWorkspacesPage() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('NEWEST');

  // Moderation Dialog Controls
  const [lockingOrg, setLockingOrg] = useState(null);
  const [lockReason, setLockReason] = useState('');
  const [deletingOrg, setDeletingOrg] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = adminService.subscribeToAllWorkspacesWithStats((allOrgs) => {
      setWorkspaces(allOrgs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const processedWorkspaces = useMemo(() => {
    let result = [...workspaces];

    // Search Filter
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (w) =>
          (w.name && w.name.toLowerCase().includes(q)) ||
          (w.orgId && w.orgId.toLowerCase().includes(q)) ||
          (w.ownerName && w.ownerName.toLowerCase().includes(q)) ||
          (w.hackathonName && w.hackathonName.toLowerCase().includes(q))
      );
    }

    // Visibility Filter
    if (visibilityFilter !== 'ALL') {
      const isPublic = visibilityFilter === 'PUBLIC';
      result = result.filter((w) => Boolean(w.isPublic) === isPublic);
    }

    // Status Filter
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'LOCKED') result = result.filter((w) => w.isLocked);
      else if (statusFilter === 'ARCHIVED') result = result.filter((w) => w.isArchived);
      else if (statusFilter === 'ACTIVE') result = result.filter((w) => !w.isLocked && !w.isArchived);
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'NEWEST') return (b.createdAt || 0) - (a.createdAt || 0);
      if (sortBy === 'OLDEST') return (a.createdAt || 0) - (b.createdAt || 0);
      if (sortBy === 'MEMBERS') return (b.membersCount || 0) - (a.membersCount || 0);
      if (sortBy === 'IDEAS') return (b.totalIdeas || 0) - (a.totalIdeas || 0);
      if (sortBy === 'PROGRESS') return (b.progressRate || 0) - (a.progressRate || 0);
      if (sortBy === 'ALPHABETICAL') return a.name.localeCompare(b.name);
      return 0;
    });

    return result;
  }, [workspaces, search, visibilityFilter, statusFilter, sortBy]);

  // Moderation Action Handlers
  const handleConfirmLock = async () => {
    if (!lockingOrg || !lockReason.trim()) return;
    setActionLoading(true);
    try {
      await adminService.lockWorkspace(
        currentUser.uid,
        currentUser.displayName || currentUser.email,
        lockingOrg.orgId,
        lockReason
      );
      NotificationService.success(`Workspace "${lockingOrg.name}" has been locked.`);
      setLockingOrg(null);
      setLockReason('');
    } catch (err) {
      NotificationService.error(err.message || 'Failed to lock workspace.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnlock = async (org) => {
    setActionLoading(true);
    try {
      await adminService.unlockWorkspace(
        currentUser.uid,
        currentUser.displayName || currentUser.email,
        org.orgId
      );
      NotificationService.success(`Workspace "${org.name}" has been unlocked.`);
    } catch (err) {
      NotificationService.error(err.message || 'Failed to unlock workspace.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchiveToggle = async (org) => {
    setActionLoading(true);
    try {
      if (org.isArchived) {
        await adminService.restoreWorkspace(
          currentUser.uid,
          currentUser.displayName || currentUser.email,
          org.orgId
        );
        NotificationService.success(`Workspace "${org.name}" restored from archive.`);
      } else {
        await adminService.archiveWorkspace(
          currentUser.uid,
          currentUser.displayName || currentUser.email,
          org.orgId
        );
        NotificationService.success(`Workspace "${org.name}" archived.`);
      }
    } catch (err) {
      NotificationService.error(err.message || 'Failed to toggle archive status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingOrg) return;
    setActionLoading(true);
    try {
      await adminService.deleteWorkspaceByAdmin(
        currentUser.uid,
        currentUser.displayName || currentUser.email,
        deletingOrg.orgId
      );
      NotificationService.success(`Workspace "${deletingOrg.name}" deleted permanently.`);
      setDeletingOrg(null);
    } catch (err) {
      NotificationService.error(err.message || 'Failed to delete workspace.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 w-full">
        <LoadingSkeleton variant="card" count={3} />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full pb-16">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <Briefcase className="h-6 w-6 text-purple-400" /> Platform Workspace Directory & Oversight
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Monitor hackathon teams, sprint progress, lock/archive workspaces, and perform administrative oversight.
          </p>
        </div>

        <Badge variant="default" className="bg-purple-950 text-purple-300 border border-purple-800 font-mono text-xs self-start md:self-auto">
          {processedWorkspaces.length} of {workspaces.length} Workspaces
        </Badge>
      </div>

      {/* Controls Bar */}
      <Card className="p-5 bg-slate-900 border border-slate-800 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by workspace name, ID, owner..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-medium"
            />
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-white text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500"
          >
            <option value="ALL">Status: All Workspaces</option>
            <option value="ACTIVE">Status: Active</option>
            <option value="LOCKED">Status: Locked</option>
            <option value="ARCHIVED">Status: Archived</option>
          </select>

          <select
            value={visibilityFilter}
            onChange={(e) => setVisibilityFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-white text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500"
          >
            <option value="ALL">Visibility: All</option>
            <option value="PUBLIC">Public</option>
            <option value="PRIVATE">Private</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-white text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500"
          >
            <option value="NEWEST">Sort: Newest First</option>
            <option value="OLDEST">Sort: Oldest First</option>
            <option value="MEMBERS">Sort: Most Members</option>
            <option value="IDEAS">Sort: Most Proposals</option>
            <option value="PROGRESS">Sort: Highest Progress %</option>
            <option value="ALPHABETICAL">Sort: Alphabetical</option>
          </select>
        </div>
      </Card>

      {/* Directory Table */}
      <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
        {processedWorkspaces.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs italic">
            No workspaces match the specified search query or filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-medium text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-mono border-b border-slate-800">
                <tr>
                  <th className="p-3">Workspace Name</th>
                  <th className="p-3">Owner & ID</th>
                  <th className="p-3">Hackathon</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Sprint Progress</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {processedWorkspaces.map((w) => (
                  <tr key={w.orgId} className="hover:bg-slate-850 transition-colors">
                    {/* Workspace Info */}
                    <td className="p-3">
                      <div className="space-y-0.5">
                        <p className="font-extrabold text-white text-xs">{w.name}</p>
                        <p className="text-[11px] text-purple-400 font-mono flex items-center gap-2">
                          <span>{w.membersCount} Members</span>
                          <span>·</span>
                          <span>{w.totalIdeas} Proposals</span>
                        </p>
                      </div>
                    </td>

                    {/* Owner & ID */}
                    <td className="p-3">
                      <p className="font-bold text-slate-200 text-xs">{w.ownerName}</p>
                      <p className="text-[10px] font-mono text-slate-500">{w.orgId}</p>
                    </td>

                    {/* Hackathon */}
                    <td className="p-3 text-slate-300 font-medium">
                      {w.hackathonName || 'General Workspace'}
                    </td>

                    {/* Status Pill */}
                    <td className="p-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        w.isLocked
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : w.isArchived
                          ? 'bg-slate-800 text-slate-400'
                          : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      }`}>
                        {w.statusTag}
                      </span>
                    </td>

                    {/* Progress */}
                    <td className="p-3 w-40">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-mono text-slate-400">
                          <span>{w.completedTasks}/{w.totalTasks} Tasks</span>
                          <span>{w.progressRate}%</span>
                        </div>
                        <ProgressBar value={w.progressRate} size="sm" />
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<Eye className="h-3.5 w-3.5 text-purple-400" />}
                          onClick={() => navigate(`/admin/workspaces/${w.orgId}`)}
                          className="bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs"
                        >
                          View
                        </Button>

                        {w.isLocked ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={<Unlock className="h-3.5 w-3.5 text-emerald-400" />}
                            onClick={() => handleUnlock(w)}
                            className="bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 text-xs font-bold"
                          >
                            Unlock
                          </Button>
                        ) : (
                          <Button
                            variant="danger"
                            size="sm"
                            icon={<Lock className="h-3.5 w-3.5" />}
                            onClick={() => setLockingOrg(w)}
                            className="bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 text-xs font-bold"
                          >
                            Lock
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Lock Workspace Dialog */}
      <ConfirmDialog
        isOpen={Boolean(lockingOrg)}
        title={`Lock Workspace: ${lockingOrg?.name}`}
        description="Locking a workspace restricts member proposal creation, voting, and task updates while preserving read access."
        confirmLabel="Confirm Lock"
        variant="danger"
        isLoading={actionLoading}
        onConfirm={handleConfirmLock}
        onCancel={() => {
          setLockingOrg(null);
          setLockReason('');
        }}
      >
        <div className="mt-4">
          <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase">
            Reason for Locking *
          </label>
          <textarea
            placeholder="Explain why this workspace is being locked..."
            value={lockReason}
            onChange={(e) => setLockReason(e.target.value)}
            rows={3}
            className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
          />
        </div>
      </ConfirmDialog>

      {/* Delete Workspace Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingOrg)}
        title={`Delete Workspace: ${deletingOrg?.name}?`}
        description="Permanently deletes this workspace and all associated proposals, blueprints, sprint tasks, and member records. This action cannot be undone."
        confirmLabel="Delete Workspace Data"
        variant="danger"
        isLoading={actionLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingOrg(null)}
      />
    </div>
  );
}
