import React from 'react';
import { ShieldCheck, BarChart2, Users, AlertTriangle, Bell, Activity } from 'lucide-react';

export function AdminPortalPreview() {
  return (
    <div className="p-6 sm:p-7 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-primary-600 text-white font-bold shadow-md shadow-primary-500/20">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-base font-extrabold text-white">Platform Operations & Governance</h4>
            <p className="text-xs text-slate-400 font-medium">Enterprise system monitoring & security controls</p>
          </div>
        </div>

        <span className="px-3 py-1 rounded-full text-xs font-mono font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5" /> Platform Healthy
        </span>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
          <span className="text-[10px] font-mono text-slate-500 uppercase">Users</span>
          <p className="text-lg font-extrabold text-white">1,420</p>
        </div>
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
          <span className="text-[10px] font-mono text-slate-500 uppercase">Workspaces</span>
          <p className="text-lg font-extrabold text-primary-400">380</p>
        </div>
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
          <span className="text-[10px] font-mono text-slate-500 uppercase">Ideas</span>
          <p className="text-lg font-extrabold text-primary-300">2,850</p>
        </div>
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
          <span className="text-[10px] font-mono text-slate-500 uppercase">System Uptime</span>
          <p className="text-lg font-extrabold text-emerald-400">99.98%</p>
        </div>
      </div>

      {/* Audit Log & Feature Toggles Snippet */}
      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2.5 text-xs font-mono">
        <div className="flex items-center justify-between text-slate-400">
          <span>Real-Time Audit Log Stream</span>
          <span className="text-primary-400">100% Immutable</span>
        </div>
        <div className="space-y-1.5 text-[11px] text-slate-300">
          <div className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
            <span>[AUDIT_LOG] Admin updated maxIdeasPerUser setting to 10</span>
            <span className="text-slate-500">Just now</span>
          </div>
          <div className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
            <span>[ANNOUNCEMENT] Broadcasted Global Update anc_17842</span>
            <span className="text-slate-500">5m ago</span>
          </div>
        </div>
      </div>
    </div>
  );
}
