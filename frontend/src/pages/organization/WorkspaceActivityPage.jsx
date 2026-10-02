import React from 'react';
import { useParams } from 'react-router-dom';
import { useOrg } from '../../hooks/useOrg';
import { WorkspaceActivityFeed } from '../../components/activity/WorkspaceActivityFeed';
import { Card } from '../../components/ui/Card';
import { Activity, ShieldCheck, Clock } from 'lucide-react';

/**
 * Workspace Activity Audit Trail Page (/workspaces/:orgId/activity)
 * Provides a comprehensive, real-time audit log of all meaningful events in the workspace.
 */
export default function WorkspaceActivityPage() {
  const { orgId } = useParams();
  const { org } = useOrg();

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* 1. Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-primary-950 text-white p-8 rounded-3xl border border-slate-700/60 shadow-2xl backdrop-blur-md">
        <div className="absolute top-0 right-0 h-40 w-40 bg-primary-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
        <div className="absolute bottom-0 left-0 h-40 w-40 bg-primary-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-primary-950 text-primary-300 border border-primary-800">
                Audit Trail & History
              </span>
              <span className="text-slate-400 text-xs font-mono">• {org?.name || 'Workspace'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <Activity className="h-7 w-7 text-primary-400" />
              <span>Workspace Activity</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Real-time chronological timeline recording proposal submissions, blueprint generations, discussions, and team updates.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-slate-400 bg-slate-900/60 border border-slate-700/60 px-4 py-3 rounded-2xl">
            <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold text-slate-200">Immutable Audit Trail</p>
              <p className="text-[10px]">Workspace-isolated & verified</p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Activity Timeline Card */}
      <Card className="p-6 sm:p-8 bg-slate-950 border border-slate-800/80 rounded-3xl shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h2 className="text-base font-extrabold text-white flex items-center gap-2 font-mono">
            <Clock className="h-4 w-4 text-primary-400" />
            <span>Event History Log</span>
          </h2>
        </div>

        <WorkspaceActivityFeed workspaceId={orgId} maxItems={100} showFilters={true} />
      </Card>
    </div>
  );
}
