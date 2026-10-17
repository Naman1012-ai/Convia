import React, { useState, useEffect, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { importRequestService } from '../../services/importRequestService';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  FolderPlus,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Users,
  AlertTriangle,
  AlertCircle,
  Plus,
  LogIn,
  Loader2,
} from 'lucide-react';

export function ImportToWorkspaceModal({
  isOpen,
  idea,
  workspaces = [],
  onClose,
  onToast = () => {},
  onCreateWorkspaceClick = null,
  onJoinWorkspaceClick = null,
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(null);
  const [requestNote, setRequestNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importStatusData, setImportStatusData] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  const isCreator = user && idea && user.uid === idea.authorId;

  // Sync selected workspace
  useEffect(() => {
    if (workspaces.length > 0) {
      const exists = workspaces.some((w) => w.orgId === selectedWorkspaceId);
      if (!exists) {
        setSelectedWorkspaceId(workspaces[0].orgId);
      }
    }
  }, [workspaces, selectedWorkspaceId]);

  // Fetch status for this idea across user's workspaces
  const fetchStatus = useCallback(async () => {
    if (!idea?.ideaId || !user) return;
    setLoadingStatus(true);
    try {
      const orgIds = workspaces.map((w) => w.orgId);
      const data = await importRequestService.getIdeaImportStatus(idea.ideaId, orgIds);
      setImportStatusData(data || null);
    } catch (err) {
      console.warn('[ImportToWorkspaceModal] Failed to load idea import status:', err);
    } finally {
      setLoadingStatus(false);
    }
  }, [idea?.ideaId, user, workspaces]);

  // Load status whenever modal opens or idea changes
  useEffect(() => {
    if (isOpen && idea) {
      fetchStatus();
    } else {
      setImportStatusData(null);
      setRequestNote('');
    }
  }, [isOpen, idea?.ideaId, fetchStatus]);

  // Calculate status for currently selected workspace
  const selectedWsObj = useMemo(() => {
    return workspaces.find((w) => w.orgId === selectedWorkspaceId) || workspaces[0] || null;
  }, [workspaces, selectedWorkspaceId]);

  const selectedWsStatus = useMemo(() => {
    if (!importStatusData?.workspaceStatuses || !selectedWorkspaceId) return null;
    return importStatusData.workspaceStatuses[selectedWorkspaceId] || null;
  }, [importStatusData, selectedWorkspaceId]);

  const isAlreadyImportedInWs = Boolean(selectedWsStatus?.isImported);
  const activePendingInWs = selectedWsStatus?.pendingRequest || null;
  const isSelfPending = Boolean(activePendingInWs?.isSelf);
  const isTeammatePending = Boolean(activePendingInWs && !activePendingInWs.isSelf);

  // Cross-workspace lock: User has active pending request in a different workspace
  const userOtherPending = useMemo(() => {
    if (
      importStatusData?.userPendingRequest &&
      importStatusData.userPendingRequest.requesterWorkspaceId !== selectedWorkspaceId
    ) {
      return importStatusData.userPendingRequest;
    }
    return null;
  }, [importStatusData, selectedWorkspaceId]);

  if (!idea) return null;

  const handleSendRequest = async () => {
    if (!user || !selectedWorkspaceId || isSubmitting) return;

    // Self-import bypasses note validation on backend
    if (!isCreator) {
      const trimmed = requestNote.trim();
      if (trimmed.length < 20 || trimmed.length > 500) {
        toast.error('Please enter an explanation between 20 and 500 characters.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const targetWs = selectedWsObj || { name: 'workspace' };
      const result = await importRequestService.createImportRequest(
        idea.ideaId,
        selectedWorkspaceId,
        isCreator ? 'Creator direct self-import' : requestNote.trim()
      );

      if (result.selfImport) {
        const msg = `✓ "${idea.title}" imported directly into ${targetWs.name}!`;
        toast.success(
          <div className="flex items-center justify-between gap-3 w-full">
            <span>{msg}</span>
            <button
              onClick={() => navigate(`/workspaces/${selectedWorkspaceId}/ideas`)}
              className="font-bold underline text-xs text-primary-700 hover:text-primary-900 shrink-0"
            >
              Go to Workspace →
            </button>
          </div>
        );
        onClose();
      } else {
        const msg = `Import request sent to @${idea.authorName || 'creator'}!`;
        toast.success(msg);
        setRequestNote('');
        await fetchStatus();
      }
    } catch (err) {
      console.error('[ImportToWorkspaceModal] Error:', err);
      const errorMsg = err.message || 'Failed to submit import request.';
      toast.error(errorMsg);
      await fetchStatus();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelRequest = async (requestId) => {
    if (!requestId || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await importRequestService.cancelRequest(requestId);
      toast.success('Import request cancelled.');
      await fetchStatus();
    } catch (err) {
      console.error('[ImportToWorkspaceModal] Cancel error:', err);
      toast.error(err.message || 'Failed to cancel request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isZeroWorkspaces = workspaces.length === 0;
  const noteLength = requestNote.trim().length;
  const isNoteValid = isCreator || (noteLength >= 20 && noteLength <= 500);

  // Can submit request only if not imported, no pending in current ws, and no user pending in another ws
  const canSubmit =
    !isZeroWorkspaces &&
    !isAlreadyImportedInWs &&
    !activePendingInWs &&
    !userOtherPending &&
    (isCreator || isNoteValid);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isCreator ? 'Import Idea into Workspace' : 'Request to Import Public Idea'}
      size="md"
    >
      <div className="space-y-6">
        {/* Source Idea Summary Card */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="info">{idea.category || 'Public Proposal'}</Badge>
            <span className="text-xs text-slate-500 font-medium">
              {isCreator ? 'Created by You' : `Original proposal by @${idea.authorName || 'creator'}`}
            </span>
          </div>
          <h4 className="font-extrabold text-slate-900 text-base">{idea.title}</h4>
          <p className="text-xs text-slate-600 line-clamp-2">{idea.problemStatement}</p>
        </div>

        {/* Zero Workspaces Warning */}
        {isZeroWorkspaces && (
          <div className="text-center py-6 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-300 space-y-4">
            <div className="flex justify-center text-slate-400">
              <Users className="h-10 w-10 text-indigo-500" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">You are not a member of any workspace.</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Create a team workspace or join an existing workspace to import or request public ideas.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  onClose();
                  if (onJoinWorkspaceClick) onJoinWorkspaceClick();
                  else navigate('/workspaces');
                }}
                icon={<LogIn className="h-3.5 w-3.5" />}
              >
                Join Workspace
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  onClose();
                  if (onCreateWorkspaceClick) onCreateWorkspaceClick();
                  else navigate('/workspaces');
                }}
                icon={<Plus className="h-3.5 w-3.5" />}
              >
                Create Workspace
              </Button>
            </div>
          </div>
        )}

        {!isZeroWorkspaces && (
          <div className="space-y-4">
            {/* Target Workspace Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Destination Workspace
              </label>
              {workspaces.length === 1 ? (
                <div className="bg-white p-3 rounded-lg border border-slate-200 flex items-center justify-between">
                  <div>
                    <h5 className="font-bold text-slate-900 text-sm">{workspaces[0].name}</h5>
                    <p className="text-xs text-slate-500">{workspaces[0].hackathonName || 'Team Workspace'}</p>
                  </div>
                  <Badge variant="success">Active Workspace</Badge>
                </div>
              ) : (
                <select
                  value={selectedWorkspaceId || ''}
                  onChange={(e) => setSelectedWorkspaceId(e.target.value)}
                  className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-slate-800 font-medium focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  {workspaces.map((ws) => (
                    <option key={ws.orgId} value={ws.orgId}>
                      {ws.name} ({ws.memberCount || 1} members)
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Loading Indicator */}
            {loadingStatus && !importStatusData && (
              <div className="flex items-center justify-center py-4 text-xs text-slate-400 gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary-500" />
                <span>Checking workspace import status...</span>
              </div>
            )}

            {/* State 1: Already Imported in this Workspace */}
            {isAlreadyImportedInWs && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1.5 flex-1">
                  <h5 className="font-bold text-emerald-900">Already in this workspace</h5>
                  {selectedWsStatus?.importedBy && !selectedWsStatus.importedBy.isSelf ? (
                    <>
                      <p className="text-emerald-800 leading-relaxed">
                        <strong className="text-emerald-950 font-semibold">@{selectedWsStatus.importedBy.name}</strong> has already imported this idea into <strong>{selectedWsObj?.name || 'this workspace'}</strong>.
                      </p>
                      <p className="text-emerald-600 text-[11px]">
                        {isCreator
                          ? 'Even though you created this public proposal, your teammate has already imported an active copy for the workspace. No duplicate copy is needed.'
                          : 'A teammate has already imported an active copy for the workspace. No duplicate copy is needed.'}
                      </p>
                    </>
                  ) : (
                    <p className="text-emerald-700">
                      This public idea has already been approved and copied into {selectedWsObj?.name || 'this workspace'}.
                    </p>
                  )}
                  <button
                    onClick={() => {
                      onClose();
                      navigate(`/workspaces/${selectedWorkspaceId}/ideas`);
                    }}
                    className="text-emerald-800 font-bold underline pt-1 inline-block hover:text-emerald-950"
                  >
                    Open Workspace Ideas →
                  </button>
                </div>
              </div>
            )}

            {/* State 2: Current User has a Pending Request in this Workspace */}
            {!isAlreadyImportedInWs && isSelfPending && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
                  <div className="text-xs space-y-1 flex-1">
                    <h5 className="font-bold text-amber-900">Import Request Pending Creator Approval</h5>
                    <p className="text-amber-800">
                      You submitted an import request for this idea into {selectedWsObj?.name || 'this workspace'}. The creator (@{idea.authorName || 'author'}) has been notified.
                    </p>
                    {activePendingInWs.requestNote && (
                      <div className="bg-white/80 p-2.5 rounded border border-amber-200/80 mt-2 text-slate-700 italic">
                        "{activePendingInWs.requestNote}"
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <Button
                    variant="danger"
                    size="sm"
                    isLoading={isSubmitting}
                    onClick={() => handleCancelRequest(activePendingInWs.requestId)}
                    className="bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-xs"
                  >
                    Cancel Request
                  </Button>
                </div>
              </div>
            )}

            {/* State 3: Teammate has already requested for this Workspace */}
            {!isAlreadyImportedInWs && isTeammatePending && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-2">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-indigo-100 rounded-lg text-indigo-700 shrink-0 mt-0.5">
                    <Users className="h-5 w-5" />
                  </div>
                  <div className="text-xs space-y-1 flex-1">
                    <h5 className="font-bold text-indigo-950 text-sm">
                      Teammate Request Pending Approval
                    </h5>
                    <p className="text-indigo-800 leading-relaxed">
                      <strong className="text-indigo-950 font-semibold">@{activePendingInWs.requesterName || 'A teammate'}</strong> has already submitted an import request for this idea into <strong>{selectedWsObj?.name || 'this workspace'}</strong>.
                    </p>
                    <p className="text-indigo-600 text-[11px] pt-1">
                      Once approved by the creator, this idea will be added directly to the workspace for all team members to view and collaborate on. No duplicate request is needed.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* State 4: User has an active request for this idea in ANOTHER workspace */}
            {!isAlreadyImportedInWs && !activePendingInWs && userOtherPending && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg text-amber-700 shrink-0 mt-0.5">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div className="text-xs space-y-1 flex-1">
                    <h5 className="font-bold text-amber-950 text-sm">
                      Active Request in Another Workspace
                    </h5>
                    <p className="text-amber-800 leading-relaxed">
                      You already have a pending import request for this idea in workspace <strong className="text-amber-950 font-semibold">{userOtherPending.requesterWorkspaceName || 'another workspace'}</strong>.
                    </p>
                    <p className="text-amber-700 text-[11px] pt-1">
                      To prevent conflicting requests, Convia requires that pending requests be approved, rejected, or cancelled before requesting the same idea for another workspace.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* State 5: Request Explanation Form (Available when no conflicts exist and not creator) */}
            {!isAlreadyImportedInWs && !activePendingInWs && !userOtherPending && !isCreator && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Why do you want to import this idea? <span className="text-rose-500">*</span>
                  </label>
                  <span
                    className={`text-[11px] font-semibold ${
                      noteLength > 0 && (noteLength < 20 || noteLength > 500)
                        ? 'text-rose-600'
                        : 'text-slate-400'
                    }`}
                  >
                    {noteLength} / 500 chars (min 20)
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={requestNote}
                  onChange={(e) => setRequestNote(e.target.value)}
                  placeholder="Explain why your workspace wants to work on this idea (e.g. how your team plans to build, iterate, or contribute)..."
                  className="w-full text-sm bg-white border border-slate-300 rounded-lg p-3 text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                {noteLength > 0 && noteLength < 20 && (
                  <p className="text-[11px] text-rose-600 flex items-center gap-1 font-medium">
                    <AlertCircle className="h-3 w-3" /> Please enter at least 20 characters to help the creator understand your intent.
                  </p>
                )}
              </div>
            )}

            {/* Creator Self-Import Note */}
            {isCreator && (
              <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-lg text-xs text-indigo-900 space-y-1">
                <span className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-indigo-600" /> Original Creator Shortcut
                </span>
                <p className="text-indigo-700">
                  As the creator of this public proposal, you can import it directly to your workspace without requiring approval.
                </p>
              </div>
            )}

            {/* Governance Attribution Footer Notice */}
            <div className="flex items-start gap-2 text-[11px] text-slate-500 bg-slate-100/70 p-3 rounded-lg border border-slate-200">
              <ShieldCheck className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
              <span>
                <strong>Attributed Copy:</strong> Importing creates an independent private copy in your workspace. The original public proposal remains owned by the author.
              </span>
            </div>
          </div>
        )}

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>

          {canSubmit && (
            <Button
              variant="primary"
              isLoading={isSubmitting}
              disabled={!isNoteValid}
              onClick={handleSendRequest}
              icon={isCreator ? <FolderPlus className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              className="bg-primary-600 hover:bg-primary-700 text-white font-bold"
            >
              {isCreator ? 'Import to Workspace' : 'Send Import Request'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

ImportToWorkspaceModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  idea: PropTypes.object,
  workspaces: PropTypes.array,
  onClose: PropTypes.func.isRequired,
  onToast: PropTypes.func,
  onCreateWorkspaceClick: PropTypes.func,
  onJoinWorkspaceClick: PropTypes.func,
};
