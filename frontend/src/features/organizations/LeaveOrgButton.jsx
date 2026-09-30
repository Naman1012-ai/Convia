import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useOrg } from '../../hooks/useOrg';
import { orgService } from '../../services/orgService';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { DoorOpen } from 'lucide-react';

export function LeaveOrgButton({ onToast = () => {} }) {
  const { user } = useAuth();
  const { org, isLeader, members } = useOrg();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const handleConfirmLeave = async () => {
    if (!user || !org) return;

    setIsLeaving(true);
    try {
      if (isSoleOwner) {
        await orgService.deleteWorkspace(org.orgId);
        onToast('Workspace deleted permanently.');
      } else {
        await orgService.leaveOrganization(user.uid, org.orgId);
        onToast('You left the workspace.');
      }
      setIsOpen(false);
      navigate('/workspaces');
    } catch (err) {
      onToast(err.message || 'Failed to leave organization.');
    } finally {
      setIsLeaving(false);
    }
  };

  const isSoleOwner = isLeader && members.length === 1;

  return (
    <>
      <Button
        variant="ghost"
        className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
        icon={<DoorOpen className="h-4 w-4" />}
        onClick={() => setIsOpen(true)}
      >
        Leave Organization
      </Button>

      <ConfirmDialog
        isOpen={isOpen}
        title="Leave Organization"
        description={
          isSoleOwner
            ? 'You are the sole member of this organization. Leaving will permanently archive and delete this workspace.'
            : 'Are you sure you want to leave this organization workspace?'
        }
        confirmLabel={isSoleOwner ? 'Leave & Delete' : 'Leave Workspace'}
        variant="danger"
        isLoading={isLeaving}
        onConfirm={handleConfirmLeave}
        onCancel={() => setIsOpen(false)}
      />
    </>
  );
}

LeaveOrgButton.propTypes = {
  onToast: PropTypes.func,
};
