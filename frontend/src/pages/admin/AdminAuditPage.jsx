import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { adminService } from '../../services/adminService';
import { NotificationService } from '../../services/notificationService';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { formatTimestamp } from '../../utils/formatting';
import {
  Lock,
  Search,
  Download,
  Filter,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
  ShieldCheck,
  FileText,
} from 'lucide-react';

export default function AdminAuditPage() {
  const { user: currentUser } = useAuth();

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = adminService.subscribeToAuditLogs((data) => {
      setLogs(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const processedLogs = useMemo(() => {
    let result = [...logs];

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (l) =>
          (l.adminName && l.adminName.toLowerCase().includes(q)) ||
          (l.actionType && l.actionType.toLowerCase().includes(q)) ||
          (l.targetId && l.targetId.toLowerCase().includes(q)) ||
          (l.details && l.details.toLowerCase().includes(q))
      );
    }

    if (actionFilter !== 'ALL') {
      result = result.filter((l) => l.actionType === actionFilter);
    }

    return result.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [logs, search, actionFilter]);

  const handleExportJson = () => {
    const jsonStr = JSON.stringify(processedLogs, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `convia_audit_logs_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    NotificationService.success('Audit logs exported as JSON.');
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <LoadingSkeleton variant="card" count={3} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
            <ShieldCheck className="h-7 w-7 text-purple-400" />
            Audit & System Logs
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-1">
            Complete, immutable audit trail of every administrative action executed across Convia.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          <Button
            variant="secondary"
            size="sm"
            icon={<Download className="h-4 w-4 text-purple-400" />}
            onClick={handleExportJson}
            className="bg-purple-950 hover:bg-purple-900 text-purple-200 border border-purple-800 text-xs font-bold"
          >
            Export Logs JSON
          </Button>

          <Badge variant="default" className="bg-purple-950 text-purple-300 border border-purple-800 font-mono text-xs">
            {processedLogs.length} Audit Entries
          </Badge>
        </div>
      </div>

      {/* Controls Bar */}
      <Card className="p-5 bg-slate-900 border border-slate-800 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="lg:col-span-3 relative">
            <input
              type="text"
              placeholder="Search audit logs by admin name, action, target ID, details..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-medium"
            />
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
          </div>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-white text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500"
          >
            <option value="ALL">Action: All Types</option>
            <option value="SUSPEND_USER">SUSPEND_USER</option>
            <option value="DELETE_USER">DELETE_USER</option>
            <option value="LOCK_WORKSPACE">LOCK_WORKSPACE</option>
            <option value="DELETE_WORKSPACE">DELETE_WORKSPACE</option>
            <option value="TOGGLE_FEATURED">TOGGLE_FEATURED</option>
            <option value="UPDATE_PLATFORM_SETTINGS">UPDATE_PLATFORM_SETTINGS</option>
            <option value="UPDATE_RBAC_ROLE">UPDATE_RBAC_ROLE</option>
          </select>
        </div>
      </Card>

      {/* Audit Log Table */}
      <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
        {processedLogs.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs italic">
            No audit logs match the specified query or filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-medium text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-mono border-b border-slate-800">
                <tr>
                  <th className="p-3">Action Type</th>
                  <th className="p-3">Administrator</th>
                  <th className="p-3">Target ID</th>
                  <th className="p-3">Details & Audit Summary</th>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {processedLogs.map((log) => (
                  <tr key={log.auditId} className="hover:bg-slate-850 transition-colors">
                    <td className="p-3 font-mono font-bold text-purple-400">
                      {log.actionType}
                    </td>
                    <td className="p-3 font-bold text-white">
                      {log.adminName}
                    </td>
                    <td className="p-3 font-mono text-slate-400 text-[11px]">
                      {log.targetId}
                    </td>
                    <td className="p-3 text-slate-300 max-w-md truncate">
                      {log.details}
                    </td>
                    <td className="p-3 font-mono text-slate-400 text-[11px]">
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<Eye className="h-3.5 w-3.5 text-purple-400" />}
                        onClick={() => setSelectedLog(log)}
                        className="bg-slate-800 text-xs text-white font-bold"
                      >
                        Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal Inspector */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <Card className="max-w-lg w-full p-6 bg-slate-900 border border-slate-800 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Shield className="h-4 w-4 text-purple-400" /> Audit Record Inspection
              </h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div>
                <span className="text-slate-400 uppercase text-[10px]">Audit Log ID</span>
                <p className="text-purple-300 font-bold">{selectedLog.auditId}</p>
              </div>
              <div>
                <span className="text-slate-400 uppercase text-[10px]">Action Type</span>
                <p className="text-purple-400 font-bold">{selectedLog.actionType}</p>
              </div>
              <div>
                <span className="text-slate-400 uppercase text-[10px]">Executed By</span>
                <p className="text-white font-bold">{selectedLog.adminName} ({selectedLog.adminUid})</p>
              </div>
              <div>
                <span className="text-slate-400 uppercase text-[10px]">Target Identifier</span>
                <p className="text-amber-300 font-bold">{selectedLog.targetId}</p>
              </div>
              <div>
                <span className="text-slate-400 uppercase text-[10px]">Details & Explanation</span>
                <p className="text-slate-200 font-sans p-3 rounded-xl bg-slate-950 border border-slate-800 mt-1">
                  {selectedLog.details}
                </p>
              </div>
              <div>
                <span className="text-slate-400 uppercase text-[10px]">Timestamp</span>
                <p className="text-slate-300">{formatTimestamp(selectedLog.timestamp)}</p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
