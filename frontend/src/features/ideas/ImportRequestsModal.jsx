import React, { useState, useEffect, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { importRequestService } from '../../services/importRequestService';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { formatTimestamp } from '../../utils/formatting';
import {
  Inbox,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  Building,
  User,
  MessageSquare,
  Send,
  ExternalLink,
  Ban,
  Loader2,
  Sparkles,
} from 'lucide-react';

export function ImportRequestsModal({ isOpen, onClose, onToast = () => {}, defaultTab = 'received' }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Primary mode: 'received' (as Creator) | 'sent' (as Requester)
  const [mainTab, setMainTab] = useState(defaultTab);
  // Sub-tab for received: 'pending' | 'history'
  const [receivedSubTab, setReceivedSubTab] = useState('pending');
  // Filter for sent requests: 'ALL' | 'PENDING' | 'IMPORTED' | 'REJECTED'
  const [sentFilter, setSentFilter] = useState('ALL');

  const [receivedRequests, setReceivedRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  // Action states
  const [processingId, setProcessingId] = useState(null);
  const [rejectingRequest, setRejectingRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const quickRejectionTemplates = [
    'Idea is still under active development.',
    'Not comfortable with this use case at this time.',
    'Please contact me directly before proceeding.',
    'Not a good fit for this workspace focus.',
  ];

  const fetchAllRequests = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [received, sent] = await Promise.all([
        importRequestService.getReceivedRequests(),
        importRequestService.getSentRequests(),
      ]);
      setReceivedRequests(received || []);
      setSentRequests(sent || []);

      // If opening without received requests but user has sent requests, switch to sent
      if ((!received || received.length === 0) && (sent && sent.length > 0) && defaultTab !== 'received') {
        setMainTab('sent');
      }
    } catch (err) {
      console.warn('[ImportRequestsModal] Failed to fetch requests:', err);
    } finally {
      setLoading(false);
    }
  }, [user, defaultTab]);

  useEffect(() => {
    if (isOpen) {
      fetchAllRequests();
      setRejectingRequest(null);
      setRejectionReason('');
    }
  }, [isOpen, fetchAllRequests]);

  // Derived Received Requests
  const pendingReceived = useMemo(
    () => receivedRequests.filter((r) => r.status === 'PENDING'),
    [receivedRequests]
  );

  const historyReceived = useMemo(
    () => receivedRequests.filter((r) => r.status !== 'PENDING'),
    [receivedRequests]
  );

  // Derived Sent Requests
  const filteredSentRequests = useMemo(() => {
    if (sentFilter === 'ALL') return sentRequests;
    return sentRequests.filter((r) => r.status === sentFilter);
  }, [sentRequests, sentFilter]);

  const sentCounts = useMemo(() => {
    return {
      all: sentRequests.length,
      pending: sentRequests.filter((r) => r.status === 'PENDING').length,
      approved: sentRequests.filter((r) => r.status === 'IMPORTED').length,
      rejected: sentRequests.filter((r) => r.status === 'REJECTED').length,
    };
  }, [sentRequests]);

  // Handler: Creator Approves Received Request
  const handleApprove = async (request) => {
    if (!request || processingId) return;
    setProcessingId(request.requestId);

    try {
      await importRequestService.approveRequest(request.requestId);
      const msg = `✓ Approved import of "${request.ideaTitle}" for ${request.requesterName}!`;
      onToast(msg);
      toast.success(msg);
      await fetchAllRequests();
    } catch (err) {
      console.error('[ImportRequestsModal] Approve error:', err);
      toast.error(err.message || 'Failed to approve request.');
    } finally {
      setProcessingId(null);
    }
  };

  // Handler: Creator Confirms Rejection with Reason
  const handleConfirmReject = async () => {
    if (!rejectingRequest || processingId) return;

    const trimmedReason = rejectionReason.trim();
    if (trimmedReason.length < 5 || trimmedReason.length > 500) {
      toast.error('Please provide a reason between 5 and 500 characters.');
      return;
    }

    setProcessingId(rejectingRequest.requestId);
    try {
      await importRequestService.rejectRequest(rejectingRequest.requestId, trimmedReason);
      toast.success('Request declined with feedback.');
      setRejectingRequest(null);
      setRejectionReason('');
      await fetchAllRequests();
    } catch (err) {
      console.error('[ImportRequestsModal] Reject error:', err);
      toast.error(err.message || 'Failed to reject request.');
    } finally {
      setProcessingId(null);
    }
  };

  // Handler: Requester Cancels Pending Sent Request
  const handleCancelSent = async (requestId) => {
    if (!requestId || processingId) return;
    setProcessingId(requestId);

    try {
      await importRequestService.cancelRequest(requestId);
      toast.success('Import request cancelled.');
      await fetchAllRequests();
    } catch (err) {
      console.error('[ImportRequestsModal] Cancel error:', err);
      toast.error(err.message || 'Failed to cancel request.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Public Idea Import Requests" size="lg">
      <div className="space-y-6">
        {/* Top-Level Mode Selector: Received vs Sent */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMainTab('received')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                mainTab === 'received'
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Inbox className="h-3.5 w-3.5" />
              <span>Received Requests</span>
              {pendingReceived.length > 0 && (
                <span
                  className={`px-1.5 py-0.5 text-[10px] rounded-full font-extrabold ${
                    mainTab === 'received' ? 'bg-white text-primary-700' : 'bg-primary-600 text-white'
                  }`}
                >
                  {pendingReceived.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setMainTab('sent')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                mainTab === 'sent'
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Send className="h-3.5 w-3.5" />
              <span>My Sent Requests</span>
              {sentRequests.length > 0 && (
                <span
                  className={`px-1.5 py-0.5 text-[10px] rounded-full font-extrabold ${
                    mainTab === 'sent' ? 'bg-white text-primary-700' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {sentRequests.length}
                </span>
              )}
            </button>
          </div>

          {loading && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary-500" />
              <span>Updating...</span>
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* SECTION 1: RECEIVED REQUESTS (Creator Review Workflow)         */}
        {/* ============================================================== */}
        {mainTab === 'received' && (
          <div className="space-y-4">
            {/* Sub-tabs for Received */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setReceivedSubTab('pending')}
                className={`text-xs px-2.5 py-1 rounded-md font-semibold transition-colors ${
                  receivedSubTab === 'pending'
                    ? 'bg-slate-200 text-slate-800'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Pending Review ({pendingReceived.length})
              </button>
              <button
                onClick={() => setReceivedSubTab('history')}
                className={`text-xs px-2.5 py-1 rounded-md font-semibold transition-colors ${
                  receivedSubTab === 'history'
                    ? 'bg-slate-200 text-slate-800'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Decision History ({historyReceived.length})
              </button>
            </div>

            {/* Received: Pending Requests */}
            {receivedSubTab === 'pending' && (
              <div className="space-y-3">
                {pendingReceived.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                    <h4 className="font-bold text-slate-900 text-sm">All caught up!</h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      You have no pending import requests awaiting your review.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                    {pendingReceived.map((req) => (
                      <div
                        key={req.requestId}
                        className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-slate-300 transition-colors space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant="info">Public Proposal</Badge>
                              <span className="text-[11px] text-slate-400">
                                Requested {formatTimestamp(req.createdAt)}
                              </span>
                            </div>
                            <h4 className="font-bold text-slate-900 text-base mt-1">{req.ideaTitle}</h4>
                          </div>
                          <Badge variant="warning">Awaiting Your Approval</Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60">
                          <div className="flex items-center gap-1.5 font-medium">
                            <User className="h-3.5 w-3.5 text-primary-600" />
                            <span>@{req.requesterName}</span>
                          </div>
                          <div className="flex items-center gap-1.5 font-medium">
                            <Building className="h-3.5 w-3.5 text-indigo-600" />
                            <span>
                              Workspace: <strong>{req.requesterWorkspaceName}</strong>
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" /> Requester's Note:
                          </span>
                          <p className="text-xs text-slate-700 bg-amber-50/60 p-3 rounded-lg border border-amber-200/60 italic leading-relaxed">
                            "{req.requestNote}"
                          </p>
                        </div>

                        <div className="flex items-center justify-end gap-2.5 pt-1">
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={Boolean(processingId)}
                            onClick={() => {
                              setRejectingRequest(req);
                              setRejectionReason('');
                            }}
                            className="text-rose-600 hover:bg-rose-50 border-rose-200 text-xs font-semibold"
                          >
                            Decline...
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            isLoading={processingId === req.requestId}
                            disabled={Boolean(processingId)}
                            onClick={() => handleApprove(req)}
                            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs"
                          >
                            Approve Import
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Received: Decision History */}
            {receivedSubTab === 'history' && (
              <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                {historyReceived.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
                    <Inbox className="h-8 w-8 text-slate-400 mx-auto" />
                    <h4 className="font-bold text-slate-900 text-sm">No historical requests</h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Completed import requests will appear here once reviewed.
                    </p>
                  </div>
                ) : (
                  historyReceived.map((req) => (
                    <div
                      key={req.requestId}
                      className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h5 className="font-bold text-slate-900 text-sm">{req.ideaTitle}</h5>
                          <span className="text-[11px] text-slate-500">
                            Requested by @{req.requesterName} for {req.requesterWorkspaceName} ·{' '}
                            {formatTimestamp(req.createdAt)}
                          </span>
                        </div>
                        {req.status === 'IMPORTED' ? (
                          <Badge variant="success">Approved & Imported</Badge>
                        ) : req.status === 'REJECTED' ? (
                          <Badge variant="danger">Declined</Badge>
                        ) : (
                          <Badge variant="secondary">{req.status}</Badge>
                        )}
                      </div>

                      {req.requestNote && (
                        <p className="text-slate-600 italic bg-slate-50 p-2 rounded border border-slate-100 text-[11px]">
                          "{req.requestNote}"
                        </p>
                      )}

                      {req.rejectionReason && (
                        <div className="bg-rose-50 border border-rose-200 rounded p-2 text-rose-800 text-[11px]">
                          <strong>Decline Reason:</strong> {req.rejectionReason}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* SECTION 2: MY SENT REQUESTS (Requester Status & History View)  */}
        {/* ============================================================== */}
        {mainTab === 'sent' && (
          <div className="space-y-4">
            {/* Status Filter Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'ALL', label: `All (${sentCounts.all})` },
                { id: 'PENDING', label: `Pending (${sentCounts.pending})` },
                { id: 'IMPORTED', label: `Approved (${sentCounts.approved})` },
                { id: 'REJECTED', label: `Declined (${sentCounts.rejected})` },
              ].map((chip) => (
                <button
                  key={chip.id}
                  onClick={() => setSentFilter(chip.id)}
                  className={`text-xs px-2.5 py-1 rounded-md font-semibold transition-colors ${
                    sentFilter === chip.id
                      ? 'bg-slate-800 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {filteredSentRequests.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
                <Send className="h-8 w-8 text-slate-400 mx-auto" />
                <h4 className="font-bold text-slate-900 text-sm">No requests found</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {sentFilter === 'ALL'
                    ? "You haven't submitted any import requests for public ideas yet."
                    : `No sent requests with status "${sentFilter}".`}
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                {filteredSentRequests.map((req) => (
                  <div
                    key={req.requestId}
                    className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-slate-300 transition-colors space-y-3"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-400">
                            Requested {formatTimestamp(req.createdAt)}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="text-[11px] font-medium text-slate-600">
                            Target: <strong>{req.requesterWorkspaceName}</strong>
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-900 text-base mt-1">{req.ideaTitle}</h4>
                        <p className="text-xs text-slate-500">
                          Original proposal by @{req.creatorName || 'Innovator'}
                        </p>
                      </div>

                      {/* Status Badges */}
                      {req.status === 'PENDING' && (
                        <Badge variant="warning" className="flex items-center gap-1">
                          <Clock className="h-3 w-3 animate-pulse" /> Pending Approval
                        </Badge>
                      )}
                      {req.status === 'IMPORTED' && (
                        <Badge variant="success" className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Approved & Imported
                        </Badge>
                      )}
                      {req.status === 'REJECTED' && (
                        <Badge variant="danger" className="flex items-center gap-1">
                          <XCircle className="h-3 w-3" /> Declined
                        </Badge>
                      )}
                      {req.status === 'CANCELLED' && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Ban className="h-3 w-3" /> Cancelled
                        </Badge>
                      )}
                    </div>

                    {/* Requester Explanation Note */}
                    {req.requestNote && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                          Your Explanation:
                        </span>
                        <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 italic leading-relaxed">
                          "{req.requestNote}"
                        </p>
                      </div>
                    )}

                    {/* Prominent Decline Reason Box (Requirement 1) */}
                    {req.status === 'REJECTED' && (
                      <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-1">
                        <div className="flex items-center gap-1.5 text-rose-800 font-bold text-xs">
                          <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
                          <span>Decline Reason from @{req.creatorName || 'Creator'}:</span>
                        </div>
                        <p className="text-xs text-rose-950 font-medium pl-5 leading-relaxed">
                          "{req.rejectionReason || 'No specific reason provided.'}"
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2.5 pt-1 border-t border-slate-100">
                      {req.status === 'PENDING' && (
                        <Button
                          variant="danger"
                          size="sm"
                          isLoading={processingId === req.requestId}
                          disabled={Boolean(processingId)}
                          onClick={() => handleCancelSent(req.requestId)}
                          className="bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-xs font-semibold"
                        >
                          Cancel Request
                        </Button>
                      )}

                      {req.status === 'IMPORTED' && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            onClose();
                            navigate(`/workspaces/${req.requesterWorkspaceId}/ideas`);
                          }}
                          icon={<ExternalLink className="h-3.5 w-3.5" />}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                        >
                          Open in Workspace →
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modal Sub-Dialog: Rejection Reason Prompt (for Creator) */}
        {rejectingRequest && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-base">Decline Import Request</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Provide a brief reason to @{rejectingRequest.requesterName}.
                  </p>
                </div>
                <button
                  onClick={() => setRejectingRequest(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              {/* Quick Template Chips */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Quick Responses:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {quickRejectionTemplates.map((template, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setRejectionReason(template)}
                      className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-md text-left transition-colors"
                    >
                      {template}
                    </button>
                  ))}
                </div>
              </div>

              {/* Textarea */}
              <div className="space-y-1">
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter a brief, practical explanation..."
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                />
                <span className="text-[10px] text-slate-400 block text-right">
                  {rejectionReason.trim().length} / 500 characters (min 5)
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRejectingRequest(null)}
                  disabled={Boolean(processingId)}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  isLoading={Boolean(processingId)}
                  disabled={rejectionReason.trim().length < 5}
                  onClick={handleConfirmReject}
                >
                  Confirm Decline
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Approved ideas become independent attributed copies in their workspace.
          </span>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

ImportRequestsModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onToast: PropTypes.func,
  defaultTab: PropTypes.string,
};
