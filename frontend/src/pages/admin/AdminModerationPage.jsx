import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { adminService } from '../../services/adminService';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { formatTimestamp } from '../../utils/formatting';
import {
  ShieldAlert,
  AlertTriangle,
  FileCheck,
  CheckCircle2,
  Lock,
  Search,
  Eye,
  RefreshCw,
  Copy,
  Clock,
} from 'lucide-react';

export default function AdminModerationPage() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  const [queueData, setQueueData] = useState({ queue: [], history: [] });
  const [spamData, setSpamData] = useState({ duplicates: [] });
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('queue');

  useEffect(() => {
    setLoading(true);

    const unsubQueue = adminService.subscribeToModerationQueue((data) => {
      setQueueData(data);
      setLoading(false);
    });

    const unsubSpam = adminService.detectSpamAndDuplicates((detected) => {
      setSpamData(detected);
    });

    const unsubAudit = adminService.subscribeToAuditLogs((logs) => {
      setAuditLogs(logs);
    });

    return () => {
      if (typeof unsubQueue === 'function') unsubQueue();
      if (typeof unsubSpam === 'function') unsubSpam();
      if (typeof unsubAudit === 'function') unsubAudit();
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 w-full">
        <LoadingSkeleton variant="card" count={3} />
      </div>
    );
  }

  const { queue, history } = queueData;
  const { duplicates } = spamData;

  return (
    <div className="space-y-6 w-full pb-16">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <ShieldAlert className="h-6 w-6 text-purple-400" /> Trust & Safety Moderation Portal
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Review moderation queues, detect duplicate content & spam, inspect audit logs, and enforce community safety.
          </p>
        </div>

        <Badge variant="default" className="bg-purple-950 text-purple-300 border border-purple-800 font-mono text-xs self-start md:self-auto">
          {queue.length} Reports Pending Review
        </Badge>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        {[
          { id: 'queue', label: `Moderation Queue (${queue.length})`, icon: ShieldAlert },
          { id: 'spam', label: `Spam & Duplicates (${duplicates.length})`, icon: AlertTriangle },
          { id: 'audit', label: `Audit Log History (${auditLogs.length})`, icon: Lock },
          { id: 'resolved', label: `Resolved History (${history.length})`, icon: FileCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-900/40'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Moderation Queue */}
      {activeTab === 'queue' && (
        <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <ShieldAlert className="h-4 w-4 text-purple-400" /> Pending Moderation Reports
          </h3>

          {queue.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs italic">
              All quiet! No pending reports currently require moderation review.
            </div>
          ) : (
            <div className="space-y-4">
              {queue.map((report) => (
                <div key={report.reportId} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-purple-300 font-bold text-xs">{report.reportId}</span>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                        {report.status}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">Category: {report.category}</span>
                    </div>

                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Eye className="h-3.5 w-3.5 text-purple-400" />}
                      onClick={() => navigate(`/admin/reports/${report.reportId}`)}
                      className="bg-slate-800 text-xs text-white font-bold"
                    >
                      Inspect Report
                    </Button>
                  </div>

                  <p className="text-xs text-slate-300 font-bold">{report.title}</p>
                  <p className="text-xs text-slate-400 line-clamp-2">{report.description}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Tab 2: Spam & Duplicates */}
      {activeTab === 'spam' && (
        <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <AlertTriangle className="h-4 w-4 text-amber-400" /> Real-time Spam & Duplicate Proposal Scanner
          </h3>

          {duplicates.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs italic">
              No potential duplicate proposals detected.
            </div>
          ) : (
            <div className="space-y-4">
              {duplicates.map((dup, i) => (
                <div key={i} className="p-4 rounded-xl bg-slate-950 border border-amber-900/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-sm text-white">{dup.title}</h4>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800 font-mono">
                      {dup.count} Matching Instances
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">Multiple proposals share identical titles. Review for possible plagiarism or multi-posting.</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Tab 3: Audit Logs */}
      {activeTab === 'audit' && (
        <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Lock className="h-4 w-4 text-purple-400" /> Complete Platform Audit Trail
          </h3>

          <div className="space-y-3">
            {auditLogs.map((log) => (
              <div key={log.auditId} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-mono">
                <div>
                  <span className="text-purple-400 font-bold">{log.actionType}</span>
                  <p className="text-slate-300 font-sans text-xs mt-0.5">{log.details}</p>
                </div>
                <div className="text-right text-[11px] text-slate-400">
                  <p>by {log.adminName}</p>
                  <p>{formatTimestamp(log.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tab 4: Resolved History */}
      {activeTab === 'resolved' && (
        <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <FileCheck className="h-4 w-4 text-emerald-400" /> Resolved Moderation Reports
          </h3>

          <div className="space-y-3">
            {history.map((r) => (
              <div key={r.reportId} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="font-mono text-emerald-400 font-bold">{r.reportId}</span>
                  <h4 className="font-bold text-white mt-0.5">{r.title}</h4>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 uppercase">
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
