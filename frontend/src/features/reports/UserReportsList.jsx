import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { reportService } from '../../services/reportService';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { formatTimestamp } from '../../utils/formatting';
import {
  Flag,
  Trash2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  Lock,
} from 'lucide-react';

export function UserReportsList() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingReportId, setDeletingReportId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const unsubscribe = reportService.subscribeToUserReports(user.uid, (reportsList) => {
      setReports(reportsList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleConfirmDelete = async () => {
    if (!user || !deletingReportId) return;
    setIsDeleting(true);

    try {
      await reportService.deleteReport(user.uid, deletingReportId);
      setToastMessage('Report removed successfully.');
      setDeletingReportId(null);
    } catch (err) {
      setToastMessage(err.message || 'Unable to delete report.');
    } finally {
      setIsDeleting(false);
    }
  };

  const statusVariants = {
    OPEN: { bg: 'bg-amber-50 text-amber-800 border-amber-200', label: 'OPEN' },
    IN_REVIEW: { bg: 'bg-primary-50 text-primary-800 border-primary-200', label: 'IN REVIEW' },
    RESOLVED: { bg: 'bg-emerald-50 text-emerald-800 border-emerald-200', label: 'RESOLVED' },
    CLOSED: { bg: 'bg-slate-100 text-slate-700 border-slate-200', label: 'CLOSED' },
  };

  const severityBadges = {
    Low: 'bg-slate-100 text-slate-700 border-slate-200',
    Medium: 'bg-blue-50 text-blue-700 border-blue-200',
    High: 'bg-amber-50 text-amber-800 border-amber-200',
    Critical: 'bg-rose-50 text-rose-800 border-rose-200',
  };

  if (loading) {
    return (
      <Card className="p-6 space-y-4">
        <LoadingSkeleton variant="card" count={2} />
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-6 bg-white border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary-50 text-primary-600">
            <Flag className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">My Submitted Reports</h2>
            <p className="text-xs text-slate-500 font-medium">
              Track platform issue reports, bug dispatches, and admin status updates in real-time.
            </p>
          </div>
        </div>

        <Badge variant="default" className="bg-primary-100 text-primary-800 font-bold border-none">
          {reports.length} Total Reports
        </Badge>
      </div>

      {toastMessage && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" /> {toastMessage}
        </div>
      )}

      {reports.length === 0 ? (
        <div className="text-center py-8 space-y-2 bg-slate-50 rounded-xl border border-dashed border-slate-200 p-6">
          <FileText className="h-8 w-8 text-slate-400 mx-auto" />
          <h4 className="text-sm font-bold text-slate-800">No Reports Submitted Yet</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            You haven't submitted any bug dispatches or issue reports. You can report platform issues directly from your profile menu.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => {
            const statusConfig = statusVariants[report.status] || statusVariants.OPEN;
            const canDelete = report.status === 'OPEN';

            return (
              <div
                key={report.reportId}
                className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 space-y-3 transition-all hover:bg-slate-50"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-xs text-primary-900 bg-primary-100 px-2 py-0.5 rounded-md">
                        {report.reportId}
                      </span>
                      <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${statusConfig.bg}`}>
                        {statusConfig.label}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${severityBadges[report.severity] || severityBadges.Medium}`}>
                        {report.severity} Severity
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500">
                        Category: {report.category}
                      </span>
                    </div>

                    <h3 className="text-sm font-extrabold text-slate-900 pt-1">{report.title}</h3>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    {canDelete ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Trash2 className="h-4 w-4 text-rose-500" />}
                        onClick={() => setDeletingReportId(report.reportId)}
                        className="text-rose-600 hover:bg-rose-50"
                      >
                        Delete
                      </Button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg">
                        <Lock className="h-3 w-3" /> Reviewed
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed bg-white p-3 rounded-lg border border-slate-200/80 font-medium">
                  {report.description}
                </p>

                <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                  <span>Affected Area: <strong className="text-slate-700">{report.affectedArea}</strong></span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-slate-400" /> Submitted {formatTimestamp(report.createdAt)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Report Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingReportId)}
        title="Delete Issue Report?"
        description="Are you sure you want to delete this open report? This action cannot be undone."
        confirmLabel="Delete Report"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingReportId(null)}
      />
    </Card>
  );
}
