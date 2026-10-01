import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { orgService } from '../../services/orgService';
import { Crown, Zap, UserCheck, AlertTriangle, ShieldAlert } from 'lucide-react';
import { cn } from '../../utils/cn';

export function TransferOwnershipModal({
  isOpen,
  onClose,
  onSuccess = () => {},
  workspaceId,
  workspaceName = 'Workspace',
  members = [],
  currentOwnerUid,
}) {
  const [selectedRecipientUid, setSelectedRecipientUid] = useState('');
  const [formerOwnerRole, setFormerOwnerRole] = useState('team_captain');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Filter eligible candidate members (all active members except current owner)
  const candidateMembers = useMemo(() => {
    if (!Array.isArray(members)) return [];
    return members.filter((m) => {
      const uid = m.uid || m.id;
      return uid && uid !== currentOwnerUid && m.status !== 'removed' && m.status !== 'inactive';
    });
  }, [members, currentOwnerUid]);

  // Set default recipient when modal opens or candidates change
  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      if (candidateMembers.length > 0 && !selectedRecipientUid) {
        setSelectedRecipientUid(candidateMembers[0].uid || candidateMembers[0].id);
      }
    }
  }, [isOpen, candidateMembers]);

  // Calculate current Team Captains & resulting count after proposed transfer
  const selectedRecipient = useMemo(() => {
    return candidateMembers.find((m) => (m.uid || m.id) === selectedRecipientUid) || null;
  }, [candidateMembers, selectedRecipientUid]);

  const { activeCaptainCount, recipientIsCaptain, resultingCaptainCount } = useMemo(() => {
    let captainsCount = 0;
    if (Array.isArray(members)) {
      captainsCount = members.filter((m) => {
        const uid = m.uid || m.id;
        if (uid === currentOwnerUid) return false;
        return m.isTeamCaptain || m.role === 'team_captain' || m.isSecondOwner || m.role === 'second_owner';
      }).length;
    }

    const recIsCap = Boolean(
      selectedRecipient &&
        (selectedRecipient.isTeamCaptain ||
          selectedRecipient.role === 'team_captain' ||
          selectedRecipient.isSecondOwner ||
          selectedRecipient.role === 'second_owner')
    );

    // New owner no longer counts as captain
    const netCaptains = captainsCount - (recIsCap ? 1 : 0) + (formerOwnerRole === 'team_captain' ? 1 : 0);

    return {
      activeCaptainCount: captainsCount,
      recipientIsCaptain: recIsCap,
      resultingCaptainCount: netCaptains,
    };
  }, [members, currentOwnerUid, selectedRecipient, formerOwnerRole]);

  const isCaptainLimitExceeded = resultingCaptainCount > 2;

  const handleTransfer = async (e) => {
    e.preventDefault();
    if (!selectedRecipientUid) {
      setErrorMsg('Please select a team member to receive workspace ownership.');
      return;
    }

    if (isCaptainLimitExceeded && formerOwnerRole === 'team_captain') {
      setErrorMsg('Cannot assign former Owner as Team Captain because the workspace would exceed the limit of 2 Team Captains.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const result = await orgService.transferOwnership(
        workspaceId,
        selectedRecipientUid,
        formerOwnerRole
      );

      onSuccess(result?.message || 'Workspace ownership successfully transferred!');
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to transfer workspace ownership.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Transfer Workspace Ownership" maxWidth="max-w-lg">
      <form onSubmit={handleTransfer} className="space-y-5">
        <div className="flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
          <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 leading-relaxed font-medium">
            <p className="font-bold">Important Security Transfer Notice</p>
            <p className="mt-0.5">
              Transferring ownership will grant full workspace control and protected administrative rights to the selected recipient. As the former owner, your authority will be updated to your selected role.
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Step 1: Select Recipient */}
        <div className="space-y-1.5">
          <label htmlFor="new-owner-select" className="block text-xs font-bold text-slate-800">
            1. Select New Owner
          </label>
          {candidateMembers.length === 0 ? (
            <p className="text-xs text-slate-500 italic bg-slate-50 p-3 rounded-xl border border-slate-200">
              No other active team members exist in this workspace. Invite members before transferring ownership.
            </p>
          ) : (
            <Select
              id="new-owner-select"
              value={selectedRecipientUid}
              onChange={(e) => setSelectedRecipientUid(e.target.value)}
              options={candidateMembers.map((m) => {
                const uid = m.uid || m.id;
                const roleLabel =
                  m.isTeamCaptain || m.role === 'team_captain' || m.isSecondOwner || m.role === 'second_owner'
                    ? '⚡ Team Captain'
                    : 'Member';
                return {
                  value: uid,
                  label: `${m.displayName || m.name || m.email} (${m.email}) — [${roleLabel}]`,
                };
              })}
              disabled={isSubmitting}
              className="text-sm"
            />
          )}
        </div>

        {/* Step 2: Select Former Owner Role */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-800">
            2. Your Role After Transfer
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setFormerOwnerRole('team_captain')}
              className={cn(
                'p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer disabled:cursor-not-allowed disabled:opacity-75 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2',
                formerOwnerRole === 'team_captain'
                  ? 'border-purple-600 bg-purple-50/70 ring-2 ring-purple-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-purple-600" /> Team Captain
                </span>
                {formerOwnerRole === 'team_captain' && (
                  <UserCheck className="h-4 w-4 text-purple-600 shrink-0" />
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">
                Full workspace management capabilities (members, invitations, settings).
              </p>
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setFormerOwnerRole('member')}
              className={cn(
                'p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer disabled:cursor-not-allowed disabled:opacity-75 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
                formerOwnerRole === 'member'
                  ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Member</span>
                {formerOwnerRole === 'member' && (
                  <UserCheck className="h-4 w-4 text-indigo-600 shrink-0" />
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">
                Standard collaboration access without workspace management rights.
              </p>
            </button>
          </div>

          {isCaptainLimitExceeded && formerOwnerRole === 'team_captain' && (
            <p className="text-xs text-rose-600 font-semibold bg-rose-50 p-2.5 rounded-xl border border-rose-200">
              ⚠️ Selecting Team Captain would exceed the limit of 2 Team Captains. Please select Member or demote an existing Team Captain first.
            </p>
          )}
        </div>

        {/* Step 3: Review Transfer Summary */}
        {selectedRecipient && (
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">
              Transfer Summary Review
            </span>
            <div className="text-xs space-y-1.5 text-slate-700 font-medium">
              <div className="flex items-center justify-between">
                <span>New Workspace Owner:</span>
                <Badge variant="warning" className="font-bold">
                  👑 {selectedRecipient.displayName || selectedRecipient.name || 'Selected Member'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Your New Role:</span>
                <Badge variant={formerOwnerRole === 'team_captain' ? 'purple' : 'default'} className="font-bold">
                  {formerOwnerRole === 'team_captain' ? '⚡ Team Captain' : 'Member'}
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="warning"
            isLoading={isSubmitting}
            disabled={isSubmitting || candidateMembers.length === 0 || (isCaptainLimitExceeded && formerOwnerRole === 'team_captain')}
            className="font-bold flex items-center gap-1.5 shadow-xs"
          >
            <Crown className="h-4 w-4 shrink-0" />
            <span>{isSubmitting ? 'Transferring Ownership...' : 'Confirm Transfer Ownership'}</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
}

TransferOwnershipModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
  workspaceId: PropTypes.string.isRequired,
  workspaceName: PropTypes.string,
  members: PropTypes.array,
  currentOwnerUid: PropTypes.string,
};
