import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { orgService } from '../../services/orgService';
import { PageHeader } from '../../components/layout/PageHeader';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { NotificationService } from '../../services/notificationService';
import { NOTIFICATION_MESSAGES } from '../../utils/notificationMessages';
import { OrgCard } from '../../features/organizations/OrgCard';
import { CreateOrgForm } from '../../features/organizations/CreateOrgForm';
import { JoinOrgForm } from '../../features/organizations/JoinOrgForm';
import { Card } from '../../components/ui/Card';
import { Plus, LogIn, Users, AlertTriangle, Clock, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getProjectTypeLabel } from '../../constants/workspaceConstants';

export default function WorkspacesPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Data States
  const [organizations, setOrganizations] = useState([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);

  // Modals & Feedback
  const [isCreateOrgOpen, setIsCreateOrgOpen] = useState(false);
  const [isJoinOrgOpen, setIsJoinOrgOpen] = useState(false);
  const [workspaceToRestore, setWorkspaceToRestore] = useState(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // Load Workspaces
  const loadWorkspaces = useCallback(async () => {
    if (!user) {
      setLoadingOrgs(false);
      return;
    }
    try {
      const orgs = await orgService.getUserOrganizations(user.uid);
      setOrganizations(orgs);
    } catch (err) {
      console.error('[WorkspacesPage] Load workspaces error:', err);
    } finally {
      setLoadingOrgs(false);
    }
  }, [user]);

  // Subscribe to Real-Time Workspaces updates
  useEffect(() => {
    if (!authLoading && user) {
      setLoadingOrgs(true);
      const unsubscribe = orgService.subscribeToUserOrganizations(user.uid, (orgs) => {
        setOrganizations(orgs);
        setLoadingOrgs(false);
      });
      return unsubscribe;
    } else if (!authLoading && !user) {
      setLoadingOrgs(false);
    }
  }, [user, authLoading]);

  const handleWorkspaceCreated = (newOrg) => {
    setIsCreateOrgOpen(false);
    NotificationService.success(NOTIFICATION_MESSAGES.WORKSPACE.CREATED);
    if (newOrg && newOrg.orgId) {
      setOrganizations((prev) => [newOrg, ...prev]);
      navigate(`/workspaces/${newOrg.orgId}/ideas`);
    } else {
      loadWorkspaces();
    }
  };

  const confirmRestoreWorkspace = async () => {
    if (!workspaceToRestore?.orgId) return;
    setIsRestoring(true);
    try {
      await orgService.restoreWorkspace(workspaceToRestore.orgId);
      NotificationService.success(NOTIFICATION_MESSAGES.WORKSPACE.RESTORED);
      setWorkspaceToRestore(null);
      loadWorkspaces();
    } catch (err) {
      NotificationService.error('Failed to restore workspace: ' + (err.message || err));
    } finally {
      setIsRestoring(false);
    }
  };

  const activeWorkspaces = organizations.filter((org) => !org.isDeleted);
  const pendingDeletionWorkspaces = organizations.filter((org) => org.isDeleted);

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 py-8">
      {/* Header Toolbar */}
      <PageHeader
        title="Workspaces"
        subtitle="Manage private spaces to coordinate ideas, consensus voting, and sprint execution boards"
        action={
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              icon={<LogIn className="h-4 w-4" />}
              onClick={() => setIsJoinOrgOpen(true)}
            >
              Join Workspace
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setIsCreateOrgOpen(true)}
            >
              Create Workspace
            </Button>
          </div>
        }
      />

      {/* Grid listing */}
      <div className="space-y-10">
        {loadingOrgs || authLoading ? (
          <LoadingSkeleton variant="card" count={3} />
        ) : (
          <>
            {activeWorkspaces.length === 0 ? (
              <EmptyState
                icon={<Users className="h-8 w-8 text-primary-500" />}
                title="No Active Workspaces Found"
                description="Create a new private workspace for your team, or join an existing one using an 8-character invite code."
                action={
                  <div className="flex items-center gap-3">
                    <Button variant="secondary" onClick={() => setIsJoinOrgOpen(true)}>
                      Join Workspace
                    </Button>
                    <Button variant="primary" onClick={() => setIsCreateOrgOpen(true)}>
                      Create Workspace
                    </Button>
                  </div>
                }
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeWorkspaces.map((org) => (
                  <OrgCard
                    key={org.orgId}
                    org={org}
                    currentUid={user?.uid || ''}
                    onJoinClick={() => setIsJoinOrgOpen(true)}
                  />
                ))}
              </div>
            )}

            {pendingDeletionWorkspaces.length > 0 && (
              <div className="space-y-4 pt-6 border-t border-slate-200">
                <div className="flex items-center gap-2 text-rose-600 animate-pulse">
                  <AlertTriangle className="h-5 w-5" />
                  <h3 className="font-bold text-slate-800">Pending Deletion (Grace Period)</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {pendingDeletionWorkspaces.map((org) => {
                    const daysLeft = Math.max(1, Math.round((org.scheduledDeletionAt - Date.now()) / (24 * 60 * 60 * 1000)));
                    return (
                      <Card key={org.orgId} className="p-6 border border-rose-200 bg-rose-50/10 flex flex-col justify-between h-48 hover:shadow-md transition-shadow">
                        <div>
                          <h4 className="font-bold text-slate-900 truncate">{org.name}</h4>
                          <p className="text-xs text-slate-500 mt-1">
                            {org.projectType ? getProjectTypeLabel(org.projectType) : (org.hackathonName || 'General Project')}
                          </p>
                          <div className="mt-4 flex items-center gap-1 text-[11px] font-semibold text-rose-600">
                            <Clock className="h-3.5 w-3.5" /> Deletes permanently in {daysLeft} days
                          </div>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setWorkspaceToRestore(org)}
                          icon={<RotateCcw className="h-3.5 w-3.5" />}
                          className="border-rose-200 text-rose-700 bg-white hover:bg-rose-50 w-full font-bold"
                        >
                          Restore Workspace
                        </Button>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      <Modal
        isOpen={isCreateOrgOpen}
        onClose={() => setIsCreateOrgOpen(false)}
        title="Create a Workspace"
        size="lg"
      >
        <CreateOrgForm
          onSuccess={handleWorkspaceCreated}
          onCancel={() => setIsCreateOrgOpen(false)}
        />
      </Modal>

      <Modal
        isOpen={isJoinOrgOpen}
        onClose={() => setIsJoinOrgOpen(false)}
        title="Join Workspace"
        size="md"
      >
        <JoinOrgForm
          onSuccess={(orgId) => {
            setIsJoinOrgOpen(false);
            NotificationService.success('Joined workspace successfully!');
            loadWorkspaces();
            if (orgId) {
              navigate(`/workspaces/${orgId}/ideas`);
            }
          }}
        />
      </Modal>

      {/* Restore Workspace Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!workspaceToRestore}
        onCancel={() => setWorkspaceToRestore(null)}
        onConfirm={confirmRestoreWorkspace}
        isLoading={isRestoring}
        title="Restore Workspace"
        description={`Are you sure you want to restore "${workspaceToRestore?.name}"? It will be returned to your active workspaces with all ideas, boards, and members intact.`}
        confirmLabel="Restore Workspace"
        cancelLabel="Cancel"
        variant="primary"
      />
    </div>
  );
}
