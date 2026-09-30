import React, { useState } from 'react';
import { useOrg } from '../../hooks/useOrg';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { NotificationService } from '../../services/notificationService';
import { WorkspaceInvitationsManager } from '../../features/organizations/WorkspaceInvitationsManager';
import { OrgMemberList } from '../../features/organizations/OrgMemberList';
import { LeaveOrgButton } from '../../features/organizations/LeaveOrgButton';
import { OrgSettingsModal } from '../../features/organizations/OrgSettingsModal';
import { Settings, Users } from 'lucide-react';

export default function MembersPage() {
  const { org, isLeader, isOrgAdmin, members } = useOrg();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  if (!org) return null;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 overflow-x-hidden">
      {/* Team Roster Card */}
      <Card>
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600" /> Team Roster ({members.length} / {org.maxMembers || org.teamSizeLimit || 5})
          </h2>
        </div>
        <OrgMemberList onToast={(msg) => NotificationService.info(msg)} />
      </Card>

      {/* Phase 2: Email-Bound Team Invitations (Owner & Admin Only) */}
      {(isLeader || isOrgAdmin) && (
        <WorkspaceInvitationsManager
          workspaceId={org.orgId || org.id}
          workspaceName={org.name}
          isOwner={isLeader}
          isAdmin={isOrgAdmin}
          onToast={(msg) => NotificationService.info(msg)}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      )}

      {/* Leave Org Action */}
      <div className="pt-4 text-center">
        <LeaveOrgButton onToast={(msg) => NotificationService.info(msg)} />
      </div>

      {/* Org Settings Modal */}
      <OrgSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSuccess={(msg) => NotificationService.success(msg)}
      />
    </div>
  );
}
