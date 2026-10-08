import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { adminService } from '../../services/adminService';
import { authService } from '../../services/authService';
import { NotificationService } from '../../services/notificationService';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { formatTimestamp } from '../../utils/formatting';
import {
  Users,
  Search,
  Filter,
  ShieldCheck,
  UserCheck,
  CheckCircle2,
  Ban,
  RotateCcw,
  KeyRound,
  Trash2,
  Eye,
  SlidersHorizontal,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search, Filters & Sorting State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [verificationFilter, setVerificationFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('NEWEST');

  // Moderation Dialog States
  const [suspendingUser, setSuspendingUser] = useState(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [deletingUser, setDeletingUser] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = adminService.subscribeToAllUsersWithStats((allUsers) => {
      setUsers(allUsers);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Filtered & Sorted Users Computation
  const processedUsers = useMemo(() => {
    let result = [...users];

    // 1. Search Query Filter
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (u) =>
          (u.displayName && u.displayName.toLowerCase().includes(q)) ||
          (u.email && u.email.toLowerCase().includes(q)) ||
          (u.uid && u.uid.toLowerCase().includes(q)) ||
          (u.username && u.username.toLowerCase().includes(q))
      );
    }

    // 2. Status Filter
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'SUSPENDED') {
        result = result.filter((u) => u.isSuspended);
      } else if (statusFilter === 'ACTIVE') {
        result = result.filter((u) => !u.isSuspended && u.onlineStatus === 'online');
      } else if (statusFilter === 'OFFLINE') {
        result = result.filter((u) => !u.isSuspended && u.onlineStatus !== 'online');
      }
    }

    // 3. Verification Filter
    if (verificationFilter !== 'ALL') {
      if (verificationFilter === 'VERIFIED') {
        result = result.filter((u) => u.emailVerified || u.profileCompleted);
      } else if (verificationFilter === 'UNVERIFIED') {
        result = result.filter((u) => !u.emailVerified && !u.profileCompleted);
      }
    }

    // 4. Role Filter
    if (roleFilter !== 'ALL') {
      result = result.filter((u) => u.role === roleFilter);
    }

    // 5. Sorting
    result.sort((a, b) => {
      if (sortBy === 'NEWEST') return (b.joinedAt || 0) - (a.joinedAt || 0);
      if (sortBy === 'OLDEST') return (a.joinedAt || 0) - (b.joinedAt || 0);
      if (sortBy === 'LAST_ACTIVE') return (b.lastLoginAt || b.joinedAt || 0) - (a.lastLoginAt || a.joinedAt || 0);
      if (sortBy === 'WORKSPACES') return (b.totalWorkspaces || 0) - (a.totalWorkspaces || 0);
      if (sortBy === 'IDEAS') return (b.totalIdeas || 0) - (a.totalIdeas || 0);
      if (sortBy === 'TASKS') return (b.totalTasks || 0) - (a.totalTasks || 0);
      if (sortBy === 'ALPHABETICAL') return (a.displayName || a.email).localeCompare(b.displayName || b.email);
      return 0;
    });

    return result;
  }, [users, search, statusFilter, verificationFilter, roleFilter, sortBy]);

  // Moderation Handlers
  const handleConfirmSuspend = async () => {
    if (!suspendingUser || !suspendReason.trim()) return;
    setActionLoading(true);
    try {
      await adminService.suspendUser(
        currentUser.uid,
        currentUser.displayName || currentUser.email,
        suspendingUser.uid,
        suspendReason
      );
      NotificationService.success(`User ${suspendingUser.displayName || suspendingUser.email} has been suspended.`);
      setSuspendingUser(null);
      setSuspendReason('');
    } catch (err) {
      NotificationService.error(err.message || 'Failed to suspend user.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestoreUser = async (targetUser) => {
    setActionLoading(true);
    try {
      await adminService.restoreUser(
        currentUser.uid,
        currentUser.displayName || currentUser.email,
        targetUser.uid
      );
      NotificationService.success(`User ${targetUser.displayName || targetUser.email} has been restored.`);
    } catch (err) {
      NotificationService.error(err.message || 'Failed to restore user.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendPasswordReset = async (email) => {
    try {
      await authService.sendPasswordResetEmail(email);
      NotificationService.success(`Password reset link sent to ${email}`);
    } catch (err) {
      NotificationService.error(err.message || 'Failed to send password reset email.');
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!deletingUser) return;
    setActionLoading(true);
    try {
      await adminService.deleteUserByAdmin(
        currentUser.uid,
        currentUser.displayName || currentUser.email,
        deletingUser.uid
      );
      NotificationService.success(`User account deleted permanently.`);
      setDeletingUser(null);
    } catch (err) {
      NotificationService.error(err.message || 'Failed to delete user.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <LoadingSkeleton variant="card" count={3} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <Users className="h-6 w-6 text-purple-400" /> Platform User Directory & Moderation
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Monitor registered accounts, perform administrative suspensions, reset passwords, and inspect deep telemetry.
          </p>
        </div>

        <Badge variant="default" className="bg-purple-950 text-purple-300 border border-purple-800 font-mono text-xs self-start md:self-auto">
          {processedUsers.length} of {users.length} Users
        </Badge>
      </div>

      {/* Search, Filter & Controls Bar */}
      <Card className="p-5 bg-slate-900 border border-slate-800 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="lg:col-span-2 relative">
            <input
              type="text"
              placeholder="Search by name, email, username, UID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-medium"
            />
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-white text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500"
          >
            <option value="ALL">Status: All</option>
            <option value="ACTIVE">Status: Active (Online)</option>
            <option value="OFFLINE">Status: Offline</option>
            <option value="SUSPENDED">Status: Suspended</option>
          </select>

          {/* Verification Filter */}
          <select
            value={verificationFilter}
            onChange={(e) => setVerificationFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-white text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500"
          >
            <option value="ALL">Verification: All</option>
            <option value="VERIFIED">Verified</option>
            <option value="UNVERIFIED">Unverified</option>
          </select>

          {/* Sort By Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-white text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500"
          >
            <option value="NEWEST">Sort: Newest Joined</option>
            <option value="OLDEST">Sort: Oldest Joined</option>
            <option value="LAST_ACTIVE">Sort: Most Recently Active</option>
            <option value="WORKSPACES">Sort: Most Workspaces</option>
            <option value="IDEAS">Sort: Most Proposals</option>
            <option value="TASKS">Sort: Most Tasks</option>
            <option value="ALPHABETICAL">Sort: Alphabetical</option>
          </select>
        </div>
      </Card>

      {/* Users Admin Directory Table */}
      <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
        {processedUsers.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs italic">
            No users match the selected search criteria or filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-medium text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-mono border-b border-slate-800">
                <tr>
                  <th className="p-3">User Profile</th>
                  <th className="p-3">Email & UID</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Last Active / Login</th>
                  <th className="p-3">Activity Metrics</th>
                  <th className="p-3 text-right">Moderation Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {processedUsers.map((u) => {
                  const isSuspended = u.isSuspended;

                  return (
                    <tr key={u.uid} className="hover:bg-slate-850 transition-colors">
                      {/* User Profile */}
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.displayName || u.email} size="sm" />
                          <div>
                            <p className="font-extrabold text-white text-xs">{u.displayName || 'User'}</p>
                            <span className="text-[11px] text-slate-400 font-mono">Joined {formatTimestamp(u.joinedAt)}</span>
                          </div>
                        </div>
                      </td>

                      {/* Email & UID */}
                      <td className="p-3">
                        <p className="font-mono text-slate-200 text-xs">{u.email}</p>
                        <p className="text-[10px] font-mono text-purple-400 truncate max-w-[140px]">{u.uid}</p>
                      </td>

                      {/* Role */}
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                          u.role === 'superadmin' ? 'bg-purple-950 text-purple-300 border border-purple-800' : 'bg-slate-800 text-slate-300'
                        }`}>
                          {u.role === 'superadmin' ? 'SUPER ADMIN' : 'USER'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="p-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isSuspended
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : u.onlineStatus === 'online'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {isSuspended ? '⛔ SUSPENDED' : u.onlineStatus === 'online' ? '● Online' : 'Offline'}
                        </span>
                      </td>

                      {/* Last Active / Last Login */}
                      <td className="p-3">
                        <div className="flex flex-col">
                          <span className="text-white font-mono text-xs">
                            {u.lastLoginAt ? formatTimestamp(u.lastLoginAt) : 'Never logged in'}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {u.onlineStatus === 'online' ? '● Live Session' : u.lastLoginAt ? 'Historical record' : 'Profile created only'}
                          </span>
                        </div>
                      </td>

                      {/* Activity Telemetry Metrics */}
                      <td className="p-3">
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-purple-300" title="Workspaces Joined">
                            {u.totalWorkspaces} WS
                          </span>
                          <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-amber-300" title="Proposals Authored">
                            {u.totalIdeas} Ideas
                          </span>
                          <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-emerald-300" title="Tasks Completed">
                            {u.completedTasks}/{u.totalTasks} Tasks
                          </span>
                        </div>
                      </td>

                      {/* Moderation Actions */}
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={<Eye className="h-3.5 w-3.5 text-purple-400" />}
                            onClick={() => navigate(`/admin/users/${u.uid}`)}
                            className="bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs"
                          >
                            View
                          </Button>

                          {isSuspended ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={<RotateCcw className="h-3.5 w-3.5 text-emerald-400" />}
                              onClick={() => handleRestoreUser(u)}
                              className="bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 text-xs font-bold"
                            >
                              Restore
                            </Button>
                          ) : (
                            <Button
                              variant="danger"
                              size="sm"
                              icon={<Ban className="h-3.5 w-3.5" />}
                              onClick={() => setSuspendingUser(u)}
                              className="bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 text-xs font-bold"
                            >
                              Suspend
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Suspend User Modal Dialog */}
      <ConfirmDialog
        isOpen={Boolean(suspendingUser)}
        title={`Suspend User Account: ${suspendingUser?.displayName || suspendingUser?.email}`}
        description="Suspending this account prevents the user from logging in, creating proposals, or modifying workspace tasks. Existing user data will remain preserved."
        confirmLabel="Confirm Suspension"
        variant="danger"
        isLoading={actionLoading}
        onConfirm={handleConfirmSuspend}
        onCancel={() => {
          setSuspendingUser(null);
          setSuspendReason('');
        }}
      >
        <div className="mt-4">
          <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase">
            Suspension Reason (Required *)
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

      {/* Delete User Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingUser)}
        title="Delete User Permanently?"
        description={`Are you sure you want to delete ${deletingUser?.displayName || deletingUser?.email}? This action removes user records and profile metadata permanently.`}
        confirmLabel="Delete User Data"
        variant="danger"
        isLoading={actionLoading}
        onConfirm={handleConfirmDeleteUser}
        onCancel={() => setDeletingUser(null)}
      />
    </div>
  );
}
