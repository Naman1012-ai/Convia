import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { invitationService } from '../../services/invitationService';
import { formatTimestamp } from '../../utils/formatting';
import {
  formatInvitationExpiry,
  isInvitationExpired,
  formatInvitationStatusDate,
  INVITATION_EXPIRATION_MS,
} from '../../utils/invitationCodeHelper';
import {
  Mail,
  Copy,
  Check,
  RotateCcw,
  Trash2,
  Shield,
  UserPlus,
  Clock,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

function formatUserFriendlyError(err, fallback = "We couldn't generate the invitation right now. Please try again.") {
  if (!err) return fallback;
  const code = err.code || '';
  const msg = err.message || '';
  const lowerMsg = msg.toLowerCase();

  // Differentiate specific validation errors (Section 5)
  if (code === 'INVALID_EMAIL' || lowerMsg.includes('valid email')) {
    return 'Please enter a valid email address.';
  }
  if (code === 'NOT_REGISTERED' || lowerMsg.includes('not registered')) {
    return 'This email is not registered with Convia.';
  }
  if (code === 'ALREADY_MEMBER' || lowerMsg.includes('already a member')) {
    return 'This user is already a member of this workspace.';
  }
  if (
    code === 'WORKSPACE_FULL' ||
    code === 'CAPACITY_REACHED' ||
    lowerMsg.includes('member limit') ||
    lowerMsg.includes('capacity')
  ) {
    return 'This workspace has reached its member limit.';
  }
  if (
    code === 'EXISTING_INVITATION' ||
    code === 'ACTIVE_INVITATION_EXISTS' ||
    lowerMsg.includes('active pending invitation') ||
    lowerMsg.includes('active invitation already exists')
  ) {
    return 'An active invitation already exists for this email.';
  }
  if (
    code === 'UNAUTHORIZED' ||
    code === 'FORBIDDEN' ||
    code === 'FORBIDDEN_NOT_WORKSPACE_ROLE' ||
    code === 'FORBIDDEN_NOT_WORKSPACE_MEMBER' ||
    lowerMsg.includes('permission') ||
    lowerMsg.includes('unauthorized')
  ) {
    return "You don't have permission to invite members to this workspace.";
  }

  // Infrastructure / network / server errors
  if (
    code === 'ENDPOINT_NOT_FOUND' ||
    code === 'BACKEND_UNAVAILABLE' ||
    code === 'HTML_RESPONSE_ERROR' ||
    code === 'JSON_PARSE_ERROR' ||
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    err.status >= 500
  ) {
    return "We couldn't generate the invitation right now. Please try again.";
  }

  // Clean user-facing message if not technical markup
  if (
    msg &&
    !msg.includes('<!DOCTYPE') &&
    !msg.includes('SyntaxError') &&
    !msg.includes('Cannot POST') &&
    !msg.includes('Cannot GET')
  ) {
    return msg;
  }

  return "We couldn't generate the invitation right now. Please try again.";
}

export function WorkspaceInvitationsManager({
  workspaceId,
  workspaceName = 'Workspace',
  isOwner = false,
  isAdmin = false,
  onToast = () => {},
}) {
  const canManage = isOwner || isAdmin;

  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [roleInput, setRoleInput] = useState('member');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Active Created / Selected Invitation Modal
  const [createdInvite, setCreatedInvite] = useState(null);
  const [showCreatedModal, setShowCreatedModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Existing Pending Alert Modal (Section 14)
  const [existingInvite, setExistingInvite] = useState(null);
  const [showExistingModal, setShowExistingModal] = useState(false);

  // Revoke Dialog
  const [invitationToRevoke, setInvitationToRevoke] = useState(null);
  const [isRevoking, setIsRevoking] = useState(false);

  // Load Invitations
  const loadInvitations = useCallback(async () => {
    if (!workspaceId || !canManage) return;
    try {
      setLoading(true);
      const list = await invitationService.getWorkspaceInvitations(workspaceId);
      setInvitations(list);
    } catch (err) {
      console.warn('⚠️ [WorkspaceInvitationsManager] Failed to load invitations:', err.message);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, canManage]);

  useEffect(() => {
    loadInvitations();
  }, [loadInvitations]);

  // Lightweight real-time countdown timer (local rendering only, zero backend writes)
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const hasActivePending = invitations.some(
      (inv) => inv.status === 'pending' && inv.expiresAt && Date.now() < Number(inv.expiresAt)
    );
    if (!hasActivePending) return;

    const timer = setInterval(() => {
      const now = Date.now();
      setCurrentTime(now);
      const stillHasPending = invitations.some(
        (inv) => inv.status === 'pending' && inv.expiresAt && now < Number(inv.expiresAt)
      );
      if (!stillHasPending) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [invitations]);

  // Handle Generate Code
  const handleGenerateCode = async (e) => {
    e.preventDefault();
    setValidationError('');

    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setValidationError('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await invitationService.createInvitation(workspaceId, cleanEmail, roleInput);

      if (res.existing && res.invitation) {
        // Section 14: Existing invitation found
        setExistingInvite(res.invitation);
        setShowExistingModal(true);
        onToast('Existing pending invitation found for this email.');
      } else {
        setCreatedInvite(res.invitation);
        setShowCreatedModal(true);
        setEmailInput('');
        onToast('Invitation code generated successfully!');
        loadInvitations();
      }
    } catch (err) {
      const friendlyMsg = formatUserFriendlyError(err, 'Failed to generate invitation code.');
      setValidationError(friendlyMsg);
      onToast(friendlyMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Copy Code
  const handleCopyCode = (code) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    onToast('Invitation code copied to clipboard!');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Handle Regenerate Code
  const handleRegenerate = async (invitationId) => {
    try {
      const res = await invitationService.regenerateInvitation(workspaceId, invitationId);
      if (res.invitation) {
        setCreatedInvite(res.invitation);
        setShowCreatedModal(true);
        if (showExistingModal) setShowExistingModal(false);
        onToast('Invitation code regenerated successfully!');
        loadInvitations();
      }
    } catch (err) {
      onToast(formatUserFriendlyError(err, 'Failed to regenerate invitation code.'));
    }
  };

  // Handle Revoke Invitation
  const confirmRevokeInvitation = async () => {
    if (!invitationToRevoke) return;
    setIsRevoking(true);
    try {
      await invitationService.revokeInvitation(workspaceId, invitationToRevoke.invitationId);
      onToast('Invitation revoked.');
      setInvitationToRevoke(null);
      if (showExistingModal) setShowExistingModal(false);
      loadInvitations();
    } catch (err) {
      onToast(formatUserFriendlyError(err, 'Failed to revoke invitation.'));
    } finally {
      setIsRevoking(false);
    }
  };

  if (!canManage) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* 1. Generate Invitation Code Card */}
      <Card>
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
          <UserPlus className="h-5 w-5 text-indigo-600" />
          <div>
            <h2 className="text-base font-bold text-slate-900">Invite a Teammate</h2>
            <p className="text-xs text-slate-500">
              Generate a unique, email-bound invitation code for a specific teammate.
            </p>
          </div>
        </div>

        <form onSubmit={handleGenerateCode} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-7">
              <label htmlFor="invite-email" className="block text-xs font-semibold text-slate-700 mb-1">
                Teammate's Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  id="invite-email"
                  type="email"
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    if (validationError) setValidationError('');
                  }}
                  placeholder="teammate@example.com"
                  className="pl-9 text-sm"
                  disabled={isSubmitting}
                />
              </div>
              {validationError && (
                <p className="mt-1 text-xs text-rose-600 font-medium">{validationError}</p>
              )}
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="invite-role" className="block text-xs font-semibold text-slate-700 mb-1">
                Role
              </label>
              <Select
                id="invite-role"
                value={roleInput}
                onChange={(e) => setRoleInput(e.target.value)}
                options={[
                  { value: 'member', label: 'Member' },
                  { value: 'admin', label: 'Admin' },
                ]}
                disabled={isSubmitting}
                className="text-sm"
              />
            </div>

            <div className="sm:col-span-2 flex items-end">
              <Button
                type="submit"
                variant="primary"
                className="w-full h-10 text-xs font-medium flex items-center justify-center gap-1.5"
                disabled={isSubmitting}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {isSubmitting ? 'Generating...' : 'Generate'}
              </Button>
            </div>
          </div>
        </form>
      </Card>

      {/* 2. Invitation Created Modal (Prominent Code Display) */}
      <Modal
        isOpen={showCreatedModal}
        onClose={() => setShowCreatedModal(false)}
        title="Invitation Created"
        size="md"
      >
        {createdInvite && (
          <div className="space-y-5 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Check className="h-6 w-6" />
            </div>

            <div>
              <p className="text-sm text-slate-600">
                A unique invitation code has been generated for:
              </p>
              <p className="text-base font-bold text-slate-900 mt-1">{createdInvite.invitedEmail}</p>
              <div className="flex items-center justify-center gap-2 mt-1">
                <Badge variant={createdInvite.role === 'admin' ? 'purple' : 'blue'}>
                  {createdInvite.role === 'admin' ? 'Admin' : 'Member'}
                </Badge>
                <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded border border-amber-200">
                  {formatInvitationExpiry(createdInvite.expiresAt, currentTime)}
                </span>
              </div>
            </div>

            {/* Prominent Code Box */}
            <div className="bg-slate-50 border-2 border-dashed border-indigo-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Invitation Code
              </p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-2xl sm:text-3xl font-mono font-bold tracking-wider text-indigo-700 select-all">
                  {createdInvite.codeDisplay || createdInvite.code}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleCopyCode(createdInvite.codeDisplay || createdInvite.code)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold"
                >
                  {copiedCode ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-slate-600" /> Copy Code
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Instruction Callout per Section 12 & 41 */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-left">
              <p className="text-xs text-amber-900 leading-relaxed font-medium">
                <strong>Next Step:</strong> Send this code to the invited teammate via WhatsApp, Slack,
                Discord, or personal message. They must sign in to Convia using{' '}
                <span className="underline font-bold">{createdInvite.invitedEmail}</span> before entering
                the code.
              </p>
            </div>

            <div className="pt-2">
              <Button
                type="button"
                variant="primary"
                className="w-full"
                onClick={() => setShowCreatedModal(false)}
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 3. Existing Pending Invitation Modal (Section 14) */}
      <Modal
        isOpen={showExistingModal}
        onClose={() => setShowExistingModal(false)}
        title="Existing Invitation Found"
        size="md"
      >
        {existingInvite && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900">
                <p className="font-semibold">An active pending invitation already exists for:</p>
                <p className="font-mono mt-0.5 text-slate-800 font-bold">{existingInvite.invitedEmail}</p>
                <p className="mt-1">
                  Role: <strong>{existingInvite.role}</strong> • Status:{' '}
                  <strong>{formatInvitationExpiry(existingInvite.expiresAt, currentTime)}</strong>
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-500 mb-1">Current Code</p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-xl font-mono font-bold text-slate-800">
                  {existingInvite.codeDisplay}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyCode(existingInvite.codeDisplay)}
                >
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                </Button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1 flex items-center justify-center gap-1.5 text-xs"
                onClick={() => handleRegenerate(existingInvite.invitationId)}
              >
                <RotateCcw className="h-3.5 w-3.5" /> Regenerate Code
              </Button>
              <Button
                type="button"
                variant="danger"
                className="flex-1 flex items-center justify-center gap-1.5 text-xs"
                onClick={() => setInvitationToRevoke(existingInvite)}
              >
                <Trash2 className="h-3.5 w-3.5" /> Revoke
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 4. Revoke Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(invitationToRevoke)}
        onClose={() => setInvitationToRevoke(null)}
        onConfirm={confirmRevokeInvitation}
        title="Revoke Invitation"
        description={`Are you sure you want to revoke the invitation for ${invitationToRevoke?.invitedEmail}? The invitation code will immediately stop working.`}
        confirmText={isRevoking ? 'Revoking...' : 'Revoke Invitation'}
        variant="danger"
        disabled={isRevoking}
      />

      {/* 5. Team Invitations List (Desktop Table + Mobile Cards per Section 50) */}
      <Card>
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">Workspace Invitations</h3>
            <p className="text-xs text-slate-500">
              Track pending, accepted, expired, and revoked invitation codes.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={loadInvitations}
            disabled={loading}
            className="text-xs"
          >
            <RotateCcw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        {invitations.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            <Mail className="h-8 w-8 mx-auto mb-2 text-slate-300" />
            No invitations created yet. Use the form above to invite teammates.
          </div>
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Invited Email</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Code</th>
                    <th className="py-2.5 px-3">Expires / Date</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invitations.map((inv) => {
                    const isExpired = isInvitationExpired(inv, currentTime);
                    const effectiveStatus = isExpired ? 'expired' : inv.status;
                    const isPending = effectiveStatus === 'pending';
                    return (
                      <tr key={inv.invitationId} className="hover:bg-slate-50/60">
                        <td className="py-3 px-3 font-medium text-slate-900">
                          {inv.invitedEmail}
                        </td>
                        <td className="py-3 px-3">
                          <Badge variant={inv.role === 'admin' ? 'purple' : 'blue'}>
                            {inv.role === 'admin' ? 'Admin' : 'Member'}
                          </Badge>
                        </td>
                        <td className="py-3 px-3">
                          <Badge
                            variant={
                              effectiveStatus === 'accepted'
                                ? 'green'
                                : effectiveStatus === 'pending'
                                ? 'amber'
                                : effectiveStatus === 'revoked'
                                ? 'red'
                                : 'slate'
                            }
                          >
                            {effectiveStatus}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 font-mono font-semibold text-slate-700">
                          {isPending && inv.codeDisplay ? (
                            <span className="inline-flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded text-indigo-700">
                              {inv.codeDisplay}
                              <button
                                type="button"
                                onClick={() => handleCopyCode(inv.codeDisplay)}
                                className="text-slate-400 hover:text-slate-700"
                                title="Copy code"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            </span>
                          ) : (
                            <span className="text-slate-400">••••••••</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-500">
                          {isPending ? (
                            <span className="font-semibold text-amber-700">
                              {formatInvitationStatusDate(inv, currentTime)}
                            </span>
                          ) : effectiveStatus === 'expired' ? (
                            <span className="font-semibold text-rose-600">Expired</span>
                          ) : effectiveStatus === 'accepted' ? (
                            <span className="text-slate-500">
                              {formatInvitationStatusDate(inv, currentTime)}
                            </span>
                          ) : effectiveStatus === 'revoked' ? (
                            <span className="text-slate-400">
                              {formatInvitationStatusDate(inv, currentTime)}
                            </span>
                          ) : (
                            formatInvitationStatusDate(inv, currentTime)
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {isPending ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRegenerate(inv.invitationId)}
                                title="Regenerate code"
                                className="h-7 px-2 text-xs"
                              >
                                <RotateCcw className="h-3 w-3" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setInvitationToRevoke(inv)}
                                title="Revoke invitation"
                                className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : effectiveStatus === 'expired' ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleRegenerate(inv.invitationId)}
                                title="Regenerate new 5-minute code"
                                className="h-7 px-2 text-[11px] font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                              >
                                <RotateCcw className="h-3 w-3" />
                                <span>Regenerate</span>
                              </Button>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Card View */}
            <div className="block md:hidden divide-y divide-slate-100">
              {invitations.map((inv) => {
                const isExpired = isInvitationExpired(inv, currentTime);
                const effectiveStatus = isExpired ? 'expired' : inv.status;
                const isPending = effectiveStatus === 'pending';
                return (
                  <div key={inv.invitationId} className="py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 truncate max-w-[200px]">
                        {inv.invitedEmail}
                      </span>
                      <Badge
                        variant={
                          effectiveStatus === 'accepted'
                            ? 'green'
                            : effectiveStatus === 'pending'
                            ? 'amber'
                            : effectiveStatus === 'revoked'
                            ? 'red'
                            : 'slate'
                        }
                      >
                        {effectiveStatus}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Badge variant={inv.role === 'admin' ? 'purple' : 'blue'}>
                          {inv.role === 'admin' ? 'Admin' : 'Member'}
                        </Badge>
                        <span className="text-[11px]">
                          {isPending ? (
                            <span className="font-semibold text-amber-700">
                              {formatInvitationStatusDate(inv, currentTime)}
                            </span>
                          ) : effectiveStatus === 'expired' ? (
                            <span className="font-semibold text-rose-600">Expired</span>
                          ) : effectiveStatus === 'accepted' ? (
                            <span className="text-slate-500">
                              {formatInvitationStatusDate(inv, currentTime)}
                            </span>
                          ) : effectiveStatus === 'revoked' ? (
                            <span className="text-slate-400">
                              {formatInvitationStatusDate(inv, currentTime)}
                            </span>
                          ) : (
                            formatInvitationStatusDate(inv, currentTime)
                          )}
                        </span>
                      </div>
                    </div>

                    {isPending && inv.codeDisplay && (
                      <div className="flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-100">
                        <span className="font-mono text-xs font-bold text-indigo-700">
                          {inv.codeDisplay}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => handleCopyCode(inv.codeDisplay)}
                            className="h-6 px-2 text-[10px]"
                          >
                            Copy
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleRegenerate(inv.invitationId)}
                            className="h-6 px-2 text-[10px]"
                            title="Regenerate"
                          >
                            <RotateCcw className="h-2.5 w-2.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            onClick={() => setInvitationToRevoke(inv)}
                            className="h-6 px-2 text-[10px]"
                            title="Revoke"
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {effectiveStatus === 'expired' && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-slate-400">Code expired</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleRegenerate(inv.invitationId)}
                          className="h-6 px-2 text-[10px] text-indigo-600"
                          title="Regenerate new code"
                        >
                          <RotateCcw className="h-2.5 w-2.5 mr-1" /> Regenerate
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

WorkspaceInvitationsManager.propTypes = {
  workspaceId: PropTypes.string.isRequired,
  workspaceName: PropTypes.string,
  isOwner: PropTypes.bool,
  isAdmin: PropTypes.bool,
  onToast: PropTypes.func,
};
