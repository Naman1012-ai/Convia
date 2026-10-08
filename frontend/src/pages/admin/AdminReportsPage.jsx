import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Search,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  RotateCcw,
  AlertTriangle,
  FileText,
} from 'lucide-react';

export default function AdminReportsPage() {
  const navigate = useNavigate();

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingReportId, setUpdatingReportId] = useState(null);

  // Operational Filters & Sorting
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('NEWEST');

  useEffect(() => {
    setLoading(true);

    // 1. Authoritative API fetch
    adminService
      .getAllReports()
      .then((initialReports) => {
        if (Array.isArray(initialReports) && initialReports.length > 0) {
          setReports(initialReports);
        }
      })
      .catch((err) => {
        console.warn('[AdminReportsPage] Initial API fetch fallback warning:', err);
      })
      .finally(() => {
        setLoading(false);
      });

    // 2. Real-time RTDB subscription
    const unsubscribe = rtdbService.subscribe('reports', (data) => {
      if (data) {
        const list = Object.values(data).filter(Boolean);
        setReports(list);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleStatusChange = async (reportId, newStatus, targetUid) => {
    setUpdatingReportId(reportId);
    try {
      await adminService.updateReportStatus(reportId, newStatus, targetUid);
      NotificationService.success(`Report ${reportId} marked as ${newStatus}.`);
    } catch (err) {
      console.error('[AdminReportsPage] Error updating report status:', err);
      NotificationService.error(err.message || 'Failed to update report status.');
    } finally {
      setUpdatingReportId(null);
    }
  };

  const statusVariants = {
    OPEN: 'bg-amber-950 text-amber-300 border-amber-800',
    IN_REVIEW: 'bg-purple-950 text-purple-300 border-purple-800',
    RESOLVED: 'bg-emerald-950 text-emerald-300 border-emerald-800',
    CLOSED: 'bg-slate-800 text-slate-400 border-slate-700',
    REOPENED: 'bg-blue-950 text-blue-300 border-blue-800',
    DISMISSED: 'bg-slate-850 text-slate-400 border-slate-750',
  };

  const severityVariants = {
    Critical: 'bg-rose-950 text-rose-300 border-rose-800',
    High: 'bg-orange-950 text-orange-300 border-orange-800',
    Medium: 'bg-amber-950 text-amber-300 border-amber-800',
    Low: 'bg-slate-850 text-slate-400 border-slate-750',
  };

  // Filtered & Sorted Reports Computation
  const processedReports = useMemo(() => {
    let result = [...reports];

    // 1. Search Query Filter
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (r) =>
          (r.reportId && r.reportId.toLowerCase().includes(q)) ||
          (r.title && r.title.toLowerCase().includes(q)) ||
          (r.description && r.description.toLowerCase().includes(q)) ||
          (r.category && r.category.toLowerCase().includes(q)) ||
          (r.createdBy?.name && r.createdBy.name.toLowerCase().includes(q)) ||
          (r.createdBy?.email && r.createdBy.email.toLowerCase().includes(q)) ||
          (r.createdBy?.uid && r.createdBy.uid.toLowerCase().includes(q))
      );
    }

    // 2. Status Filter
    if (statusFilter !== 'ALL') {
      result = result.filter((r) => r.status === statusFilter);
    }

    // 3. Severity Filter
    if (severityFilter !== 'ALL') {
      result = result.filter((r) => r.severity === severityFilter);
    }

    // 4. Category Filter
    if (categoryFilter !== 'ALL') {
      result = result.filter((r) => r.category === categoryFilter);
    }

    // 5. Sorting
    const severityWeight = { Critical: 4, High: 3, Medium: 2, Low: 1 };
    result.sort((a, b) => {
      if (sortBy === 'NEWEST') return (b.createdAt || 0) - (a.createdAt || 0);
      if (sortBy === 'OLDEST') return (a.createdAt || 0) - (b.createdAt || 0);
      if (sortBy === 'UPDATED') return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
      if (sortBy === 'SEVERITY') return (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0);
      return 0;
    });

    return result;
  }, [reports, search, statusFilter, severityFilter, categoryFilter, sortBy]);

  // Quick Metrics
  const openCount = reports.filter((r) => r.status === 'OPEN' || r.status === 'REOPENED').length;
  const inReviewCount = reports.filter((r) => r.status === 'IN_REVIEW').length;
  const resolvedCount = reports.filter((r) => r.status === 'RESOLVED').length;

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <LoadingSkeleton variant="card" count={3} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <Flag className="h-6 w-6 text-purple-400" /> Platform Moderation & Issue Dispatches
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Review user-submitted bug dispatches, security vulnerabilities, UI feedback, and manage server-authoritative status lifecycles.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="default" className="bg-amber-950 text-amber-300 border border-amber-800 font-mono text-xs">
            {openCount} Open
          </Badge>
          <Badge variant="default" className="bg-purple-950 text-purple-300 border border-purple-800 font-mono text-xs">
            {inReviewCount} In Review
          </Badge>
          <Badge variant="default" className="bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono text-xs">
            {resolvedCount} Resolved
          </Badge>
        </div>
      </div>

      {/* Operational Controls & Filter Bar */}
      <Card className="p-5 bg-slate-900 border border-slate-800 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search title, reporter, ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-medium"
            />
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-white text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500"
          >
            <option value="ALL">Status: All</option>
            <option value="OPEN">Status: OPEN</option>
            <option value="IN_REVIEW">Status: IN_REVIEW</option>
            <option value="RESOLVED">Status: RESOLVED</option>
            <option value="CLOSED">Status: CLOSED</option>
            <option value="REOPENED">Status: REOPENED</option>
          </select>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-white text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500"
          >
            <option value="ALL">Severity: All</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-white text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500"
          >
            <option value="ALL">Category: All</option>
            <option value="Bug Report">Bug Report</option>
            <option value="Feature Request">Feature Request</option>
            <option value="Security">Security</option>
            <option value="UI/UX Issue">UI/UX Issue</option>
            <option value="Account / Auth">Account / Auth</option>
            <option value="Other">Other</option>
          </select>

          {/* Sort By Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-white text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500"
          >
            <option value="NEWEST">Sort: Newest First</option>
            <option value="OLDEST">Sort: Oldest First</option>
            <option value="UPDATED">Sort: Recently Updated</option>
            <option value="SEVERITY">Sort: Highest Severity</option>
          </select>
        </div>
      </Card>

      {/* Reports Directory List */}
      <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
        {processedReports.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-xs italic space-y-2">
            <FileText className="h-8 w-8 text-slate-600 mx-auto" />
            <p>No issue reports match the selected filters or search parameters.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {processedReports.map((report) => (
              <div
                key={report.reportId}
                className="p-5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all space-y-4"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-850 pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-xs text-purple-300 bg-purple-950 px-2 py-0.5 rounded-md border border-purple-800">
                        {report.reportId}
                      </span>
                      <span className={`text-[10px] font-mono font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${statusVariants[report.status] || statusVariants.OPEN}`}>
                        {report.status}
                      </span>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${severityVariants[report.severity] || severityVariants.Medium}`}>
                        {report.severity || 'Medium'} Severity
                      </span>
                      <span className="text-xs text-slate-400 font-medium">Category: {report.category || 'General'}</span>
                    </div>

                    <h3 className="text-base font-extrabold text-white pt-1">{report.title}</h3>
                  </div>

                  {/* Operational Status Action Controls */}
                  <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                    <span className="text-xs font-mono text-slate-400">Status:</span>
                    <select
                      value={report.status}
                      disabled={updatingReportId === report.reportId}
                      onChange={(e) => handleStatusChange(report.reportId, e.target.value, report.createdBy?.uid)}
                      className="bg-slate-900 border border-slate-700 text-white text-xs font-bold rounded-lg px-3 py-1.5 focus:outline-none focus:border-purple-500 cursor-pointer disabled:opacity-50"
                    >
                      <option value="OPEN">OPEN</option>
                      <option value="IN_REVIEW">IN_REVIEW</option>
                      <option value="RESOLVED">RESOLVED</option>
                      <option value="CLOSED">CLOSED</option>
                      <option value="REOPENED">REOPENED</option>
                    </select>

                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<ChevronRight className="h-3.5 w-3.5 text-purple-400" />}
                      onClick={() => navigate(`/admin/reports/${report.reportId}`)}
                      className="bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs"
                    >
                      Inspect Detail
                    </Button>
                  </div>
                </div>

                {/* Description Body */}
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-900 p-4 rounded-xl border border-slate-800 font-medium">
                  {report.description}
                </p>

                {/* Admin Resolution Note if already resolved */}
                {report.resolutionNotes && (
                  <div className="p-3 bg-emerald-950/40 border border-emerald-900/60 rounded-xl text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold uppercase text-[10px] font-mono">
                      <ShieldCheck className="h-3.5 w-3.5" /> Resolution Record:
                    </div>
                    <p className="text-emerald-200 font-medium">{report.resolutionNotes}</p>
                    {report.resolvedBy && (
                      <p className="text-[10px] text-emerald-400 font-mono">
                        Resolved by {report.resolvedBy} • {formatTimestamp(report.resolvedAt)}
                      </p>
                    )}
                  </div>
                )}

                {/* Attachment Link if present */}
                {report.attachmentUrl && (
                  <div className="flex items-center gap-2 text-xs font-medium text-purple-300 bg-purple-950/40 p-2.5 rounded-xl border border-purple-900/60">
                    <ExternalLink className="h-4 w-4 text-purple-400 shrink-0" />
                    <span className="truncate">Evidence: {report.attachmentName || 'Attachment File'}</span>
                    <a
                      href={report.attachmentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-auto underline text-purple-400 hover:text-purple-200 font-bold shrink-0"
                    >
                      View Evidence
                    </a>
                  </div>
                )}

                {/* Footer Metadata & Telemetry */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono text-slate-400 pt-2 border-t border-slate-850">
                  <div>
                    Reporter: <strong className="text-slate-200">{report.createdBy?.name || 'User'}</strong>{' '}
                    <span className="text-slate-500">({report.createdBy?.email})</span>
                  </div>
                  <div>
                    Route: <strong className="text-slate-200">{report.context?.currentRoute || 'N/A'}</strong>
                  </div>
                  <div className="sm:text-right">
                    Submitted {formatTimestamp(report.createdAt)}
                    {report.updatedAt && report.updatedAt !== report.createdAt && (
                      <span className="text-slate-500"> • Updated {formatTimestamp(report.updatedAt)}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
