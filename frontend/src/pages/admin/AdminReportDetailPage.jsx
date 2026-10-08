import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { rtdbService } from '../../services/rtdbService';
import { adminService } from '../../services/adminService';
import { NotificationService } from '../../services/notificationService';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { formatTimestamp } from '../../utils/formatting';
import {
  Flag,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  RotateCcw,
  XCircle,
  FileText,
  User,
  Clock,
  Layers,
  Sparkles,
  Send,
  MessageSquare,
} from 'lucide-react';

export default function AdminReportDetailPage() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');

  useEffect(() => {
    if (!reportId) return;
    setLoading(true);

    // 1. Authoritative API fetch
    adminService
      .getReportDetail(reportId)
      .then((detail) => {
        if (detail) {
          setReport(detail);
          if (detail.resolutionNotes) {
            setResolutionNotes(detail.resolutionNotes);
          }
        }
      })
      .catch((err) => {
        console.warn('[AdminReportDetailPage] API fallback warning:', err);
      })
      .finally(() => {
        setLoading(false);
      });

    // 2. Real-time RTDB subscription
    const unsubscribe = rtdbService.subscribe(`reports/${reportId}`, (data) => {
      if (data) {
        setReport(data);
        if (data.resolutionNotes) {
          setResolutionNotes(data.resolutionNotes);
        }
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [reportId]);

  const handleUpdateStatus = async (newStatus, notesToSave = null) => {
    if (!report) return;
    setActionLoading(true);
    try {
      const activeNotes = notesToSave !== null ? notesToSave : resolutionNotes;
      await adminService.updateReportStatus(
        reportId,
        newStatus,
        report.createdBy?.uid,
        activeNotes
      );
      NotificationService.success(`Report status updated to "${newStatus}".`);
    } catch (err) {
      console.error('[AdminReportDetailPage] Error updating status:', err);
      NotificationService.error(err.message || 'Failed to update report status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveNotesOnly = async () => {
    if (!report) return;
    setActionLoading(true);
    try {
      await adminService.updateReportStatus(
        reportId,
        report.status || 'OPEN',
        report.createdBy?.uid,
        resolutionNotes
      );
      NotificationService.success('Admin resolution notes updated.');
    } catch (err) {
      NotificationService.error(err.message || 'Failed to update resolution notes.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !report) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <LoadingSkeleton variant="card" count={3} />
      </div>
    );
  }

  const statusColors = {
    OPEN: 'bg-amber-950 text-amber-300 border-amber-800',
    IN_REVIEW: 'bg-purple-950 text-purple-300 border-purple-800',
    RESOLVED: 'bg-emerald-950 text-emerald-300 border-emerald-800',
    CLOSED: 'bg-slate-800 text-slate-400 border-slate-700',
    REOPENED: 'bg-blue-950 text-blue-300 border-blue-800',
    DISMISSED: 'bg-slate-850 text-slate-400 border-slate-750',
  };

  const severityColors = {
    Critical: 'bg-rose-950 text-rose-300 border-rose-800',
    High: 'bg-orange-950 text-orange-300 border-orange-800',
    Medium: 'bg-amber-950 text-amber-300 border-amber-800',
    Low: 'bg-slate-850 text-slate-400 border-slate-750',
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <Button
          variant="secondary"
          size="sm"
          icon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => navigate('/admin/reports')}
          className="bg-slate-900 border border-slate-800 text-slate-300 hover:text-white font-bold text-xs"
        >
          Back to Reports Center
        </Button>

        <div className="flex items-center gap-2">
          <Badge variant="default" className="bg-purple-950 text-purple-300 border border-purple-800 font-mono text-xs">
            REF: {report.reportId}
          </Badge>
          <span className={`text-[10px] font-mono font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${statusColors[report.status] || statusColors.OPEN}`}>
            {report.status}
          </span>
        </div>
      </div>

      {/* Main Report Summary Card */}
      <Card className="p-6 bg-slate-900 border border-slate-800 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-md border ${severityColors[report.severity] || severityColors.Medium}`}>
                {report.severity || 'Medium'} Severity
              </span>
              <span className="text-xs font-bold text-slate-300">Category: {report.category || 'General'}</span>
              <span className="text-xs text-slate-500 font-mono">Area: {report.affectedArea || 'General'}</span>
            </div>
            <h1 className="text-xl font-black text-white pt-1">{report.title}</h1>
          </div>

          {/* Quick Lifecycle Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {report.status !== 'IN_REVIEW' && (
              <Button
                variant="secondary"
                size="sm"
                icon={<Clock className="h-3.5 w-3.5 text-purple-400" />}
                onClick={() => handleUpdateStatus('IN_REVIEW')}
                isLoading={actionLoading}
                className="bg-purple-950 hover:bg-purple-900 text-purple-200 border border-purple-800 font-bold text-xs"
              >
                In Review
              </Button>
            )}

            {report.status !== 'RESOLVED' && (
              <Button
                variant="primary"
                size="sm"
                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                onClick={() => handleUpdateStatus('RESOLVED')}
                isLoading={actionLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
              >
                Resolve
              </Button>
            )}

            {report.status !== 'CLOSED' && (
              <Button
                variant="secondary"
                size="sm"
                icon={<XCircle className="h-3.5 w-3.5 text-slate-400" />}
                onClick={() => handleUpdateStatus('CLOSED')}
                isLoading={actionLoading}
                className="bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-bold text-xs"
              >
                Close
              </Button>
            )}

            {(report.status === 'RESOLVED' || report.status === 'CLOSED') && (
              <Button
                variant="secondary"
                size="sm"
                icon={<RotateCcw className="h-3.5 w-3.5 text-blue-400" />}
                onClick={() => handleUpdateStatus('REOPENED')}
                isLoading={actionLoading}
                className="bg-blue-950 hover:bg-blue-900 text-blue-200 border border-blue-800 font-bold text-xs"
              >
                Reopen
              </Button>
            )}
          </div>
        </div>

        {/* Detailed Explanation */}
        <div className="space-y-2">
          <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
            Report Description & Reproduction Steps
          </label>
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 leading-relaxed font-medium whitespace-pre-wrap">
            {report.description}
          </div>
        </div>

        {/* Attached Evidence File */}
        {report.attachmentUrl && (
          <div className="space-y-2">
            <label className="text-[10px] font-mono uppercase tracking-wider text-purple-400 font-bold">
              Attached Evidence File
            </label>
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-purple-950/40 border border-purple-900/60 text-xs font-mono text-purple-200">
              <span className="truncate">{report.attachmentName || 'Attachment File'}</span>
              <a
                href={report.attachmentUrl}
                target="_blank"
                rel="noreferrer"
                className="underline text-purple-400 hover:text-purple-200 font-bold flex items-center gap-1 shrink-0"
              >
                <ExternalLink className="h-3.5 w-3.5" /> View Evidence
              </a>
            </div>
          </div>
        )}

        {/* Admin Resolution Notes & Internal Log */}
        <div className="space-y-3 pt-2 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4" /> Administrative Resolution Notes
            </label>
            {report.resolvedBy && (
              <span className="text-[10px] font-mono text-slate-500">
                Last resolved by <strong className="text-slate-300">{report.resolvedBy}</strong> at {formatTimestamp(report.resolvedAt)}
              </span>
            )}
          </div>

          <textarea
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            rows={3}
            placeholder="Document technical cause, bugfix commits, or response notes to reporter..."
            className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 font-medium"
          />

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<Send className="h-3 w-3 text-purple-400" />}
              onClick={handleSaveNotesOnly}
              isLoading={actionLoading}
              className="bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs"
            >
              Save Notes Only
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<CheckCircle2 className="h-3 w-3" />}
              onClick={() => handleUpdateStatus('RESOLVED', resolutionNotes)}
              isLoading={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
            >
              Save & Mark Resolved
            </Button>
          </div>
        </div>

        {/* Reporter Attribution & Telemetric Context */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800 text-xs font-mono">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
            <span className="text-slate-400 font-bold uppercase text-[10px] flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-purple-400" /> Reporter Attribution
            </span>
            <p className="text-white font-bold">{report.createdBy?.name || 'User'}</p>
            <p className="text-slate-400">{report.createdBy?.email}</p>
            <p className="text-purple-400 text-[10px]">UID: {report.createdBy?.uid}</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
            <span className="text-slate-400 font-bold uppercase text-[10px] flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-amber-400" /> Telemetric Context
            </span>
            <p className="text-slate-300">Route: <span className="text-white">{report.context?.currentRoute || 'N/A'}</span></p>
            <p className="text-slate-300">OS / Platform: <span className="text-white">{report.context?.os || 'Unknown'}</span></p>
            {report.context?.workspaceId && (
              <p className="text-slate-300">Workspace: <span className="text-purple-300">{report.context.workspaceId}</span></p>
            )}
            {report.context?.ideaId && (
              <p className="text-slate-300">Idea Proposal: <span className="text-amber-300">{report.context.ideaId}</span></p>
            )}
            <p className="text-slate-500 text-[10px]">
              Created: {formatTimestamp(report.createdAt)}
              {report.updatedAt && ` • Updated: ${formatTimestamp(report.updatedAt)}`}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
