import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { adminService } from '../../services/adminService';
import { NotificationService } from '../../services/notificationService';
import { NOTIFICATION_MESSAGES } from '../../utils/notificationMessages';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { ShieldCheck, CheckCircle2, Save, Key, Users } from 'lucide-react';

export default function AdminRolesPage() {
  const { user: currentUser } = useAuth();

  const [roles, setRoles] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  const allPermissions = [
    { id: 'users.view', label: 'View Users Directory' },
    { id: 'users.edit', label: 'Edit User Profiles' },
    { id: 'users.suspend', label: 'Suspend User Accounts' },
    { id: 'users.delete', label: 'Cascade Delete Users' },
    { id: 'workspaces.view', label: 'View Workspaces Directory' },
    { id: 'workspaces.delete', label: 'Cascade Delete Workspaces' },
    { id: 'ideas.view', label: 'View Proposals' },
    { id: 'ideas.delete', label: 'Delete Proposals' },
    { id: 'reports.view', label: 'View Reports Center' },
    { id: 'reports.resolve', label: 'Resolve Moderation Reports' },
    { id: 'analytics.view', label: 'View Analytics Center' },
    { id: 'analytics.export', label: 'Export Analytics Reports' },
    { id: 'settings.view', label: 'View Platform Settings' },
    { id: 'settings.edit', label: 'Edit System Configuration' },
    { id: 'audit.view', label: 'View Audit Logs' },
    { id: 'roles.manage', label: 'Manage RBAC Matrix' },
  ];

  useEffect(() => {
    setLoading(true);
    const unsubscribe = adminService.subscribeToRbacRoles((data) => {
      setRoles(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleTogglePermission = (roleId, permId) => {
    if (roleId === 'superadmin') return; // Super admin permissions cannot be reduced
    const role = roles[roleId];
    const currentPerms = role.permissions || [];
    const hasPerm = currentPerms.includes(permId);

    const updatedPerms = hasPerm
      ? currentPerms.filter((p) => p !== permId)
      : [...currentPerms, permId];

    setRoles({
      ...roles,
      [roleId]: {
        ...role,
        permissions: updatedPerms,
      },
    });
  };

  const handleSaveRole = async (roleId) => {
    setSavingId(roleId);
    try {
      await adminService.updateRbacRolePermissions(
        currentUser.uid,
        currentUser.displayName || currentUser.email,
        roleId,
        roles[roleId].permissions
      );
      NotificationService.success(NOTIFICATION_MESSAGES.ADMIN.ROLE_UPDATED);
    } catch (err) {
      NotificationService.error(err);
    } finally {
      setSavingId(null);
    }
  };

  if (loading || !roles) {
    return (
      <div className="space-y-6 w-full">
        <LoadingSkeleton variant="card" count={3} />
      </div>
    );
  }

  const roleList = Object.values(roles);

  return (
    <div className="space-y-6 w-full pb-16">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <ShieldCheck className="h-6 w-6 text-purple-400" /> RBAC Roles & Granular Permission Matrix
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Define role boundaries, grant or revoke granular permissions, and enforce administrative access control.
          </p>
        </div>

        <Badge variant="default" className="bg-purple-950 text-purple-300 border border-purple-800 font-mono text-xs self-start md:self-auto">
          {roleList.length} Defined RBAC Roles
        </Badge>
      </div>

      {/* Permission Matrix Table */}
      <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
            <Key className="h-4 w-4 text-purple-400" /> Granular Permission Matrix
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-medium text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-mono border-b border-slate-800">
              <tr>
                <th className="p-3">Permission Description</th>
                {roleList.map((r) => (
                  <th key={r.roleId} className="p-3 text-center">
                    <div className="space-y-1">
                      <p className="text-white font-bold">{r.name}</p>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleSaveRole(r.roleId)}
                        isLoading={savingId === r.roleId}
                        disabled={r.roleId === 'superadmin'}
                        className="bg-slate-800 text-[10px] py-0.5 px-2 font-bold"
                      >
                        Save
                      </Button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {allPermissions.map((perm) => (
                <tr key={perm.id} className="hover:bg-slate-850 transition-colors">
                  <td className="p-3 space-y-0.5">
                    <p className="font-bold text-white text-xs">{perm.label}</p>
                    <span className="font-mono text-purple-400 text-[10px]">{perm.id}</span>
                  </td>

                  {roleList.map((r) => {
                    const isChecked = (r.permissions || []).includes(perm.id);
                    const isSuper = r.roleId === 'superadmin';
                    return (
                      <td key={r.roleId} className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isSuper}
                          onChange={() => handleTogglePermission(r.roleId, perm.id)}
                          className="h-4 w-4 rounded bg-slate-950 border-slate-700 text-purple-600 focus:ring-0 cursor-pointer disabled:opacity-50"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
