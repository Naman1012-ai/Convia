import React from 'react';
import { Zap, Code2, Database, Layers, CheckCircle2, Cpu } from 'lucide-react';

export function BlueprintPreview() {
  return (
    <div className="p-6 sm:p-7 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-primary-600 text-white font-bold shadow-md shadow-primary-500/20">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-base font-extrabold text-white">AI Technical PRD & Blueprint</h4>
            <p className="text-xs text-slate-400 font-medium">Automated Spec via Convia AI Engine</p>
          </div>
        </div>

        <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-primary-500/20 text-primary-300 border border-primary-500/30">
          Architecture Locked
        </span>
      </div>

      {/* Tech Stack Pills */}
      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
        <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">Recommended Tech Stack:</span>
        <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
          <span className="px-2.5 py-1 rounded bg-primary-950/80 text-primary-300 border border-primary-800">React 19</span>
          <span className="px-2.5 py-1 rounded bg-primary-900/60 text-primary-200 border border-primary-700">Tailwind v4</span>
          <span className="px-2.5 py-1 rounded bg-sky-950/80 text-sky-300 border border-sky-800">Firebase RTDB</span>
          <span className="px-2.5 py-1 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800">Vite Code Split</span>
        </div>
      </div>

      {/* Database Schema & Endpoints Snippet */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
          <div className="flex items-center gap-1.5 text-primary-400 font-bold">
            <Database className="h-3.5 w-3.5" />
            <span>Database Schema Models</span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            Structured schema models with real-time state synchronization.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
          <div className="flex items-center gap-1.5 text-primary-300 font-bold">
            <Code2 className="h-3.5 w-3.5" />
            <span>API Endpoints & Contracts</span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            Documented endpoint handlers and security rule validations mapped.
          </p>
        </div>
      </div>
    </div>
  );
}
