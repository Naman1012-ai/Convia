import React from 'react';
import { Briefcase, Users, Lightbulb, CheckSquare, Trophy, ShieldCheck, Zap } from 'lucide-react';

export function WorkspacePreview() {
  return (
    <div className="p-6 sm:p-7 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl space-y-6">
      {/* Workspace Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary-600 text-white font-bold shadow-md shadow-primary-500/20">
            <Briefcase className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-base font-extrabold text-white">Hackathon Alpha Workspace</h4>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-primary-500/20 text-primary-300 border border-primary-500/30">
                Code: HACK26
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">Project Lead: Naman (Owner)</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-primary-400" /> 4 Active Members
          </span>
        </div>
      </div>

      {/* Workspace Telemetry Cards */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
          <span className="text-[10px] font-mono text-slate-500 font-bold uppercase">Proposals</span>
          <p className="text-lg font-extrabold text-white">6 Ideas</p>
        </div>
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
          <span className="text-[10px] font-mono text-slate-500 font-bold uppercase">MVP Status</span>
          <p className="text-lg font-extrabold text-emerald-400">Locked</p>
        </div>
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
          <span className="text-[10px] font-mono text-slate-500 font-bold uppercase">Progress</span>
          <p className="text-lg font-extrabold text-primary-400">75% Sprint</p>
        </div>
      </div>

      {/* Active Team Roster Preview */}
      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-3">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400">
          <span>Active Team Members</span>
          <span className="text-emerald-400 font-bold flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> All Online
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {['Naman (Lead)', 'Sarah (Frontend)', 'Alex (AI Backend)', 'Marcus (DevOps)'].map((m) => (
            <div key={m} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-semibold text-slate-200 truncate">
              {m}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
