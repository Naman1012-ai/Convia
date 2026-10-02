import React from 'react';
import { Briefcase, Zap, Activity, Clock, CheckCircle, ArrowRight } from 'lucide-react';

const RECENT_ACTIVITIES = [
  { type: 'workspace', text: 'Hackathon Alpha Team created a new workspace', time: '2m ago' },
  { type: 'blueprint', text: 'Generated AI Blueprint for "Zero-Knowledge Vault"', time: '8m ago' },
  { type: 'mvp', text: 'Quantum Innovators locked "Real-Time Code Synthesizer" as MVP', time: '14m ago' },
  { type: 'vote', text: 'Alex Chen upvoted "Decentralized Ledger"', time: '22m ago' },
];

export function CommunityHighlightsSection() {
  return (
    <section className="py-24 bg-slate-950/90 border-b border-slate-800/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <span className="px-3 py-1 rounded-full bg-slate-900 border border-primary-500/30 text-primary-300 text-xs font-mono font-bold">
            Live Ecosystem Pulse
          </span>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Community Highlights & Activity
          </h2>

          <p className="text-base text-slate-400 font-medium">
            See active teams and blueprints generated in real time across the platform.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Active Workspaces Card */}
          <div className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-primary-400 font-bold text-base">
                <Briefcase className="h-5 w-5" />
                <span>Recently Active Workspaces</span>
              </div>
              <span className="text-xs font-mono text-emerald-400 font-bold flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" /> Realtime
              </span>
            </div>

            <div className="space-y-3 font-mono text-xs">
              {['Hackathon Alpha Team (4 Members)', 'Quantum Innovators (5 Members)', 'DevLabs Open Source (6 Members)'].map((ws) => (
                <div key={ws} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-slate-200">
                  <span>{ws}</span>
                  <span className="text-primary-300 font-bold text-[10px] px-2 py-0.5 rounded bg-primary-500/10 border border-primary-500/20">
                    Active Sprint
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Live Activity Feed Card */}
          <div className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-primary-400 font-bold text-base">
                <Activity className="h-5 w-5 text-primary-400 animate-pulse" />
                <span>Live Public Activity Stream</span>
              </div>
              <span className="text-xs font-mono text-slate-500 font-bold">Auto-Updating</span>
            </div>

            <div className="space-y-3 font-mono text-xs">
              {RECENT_ACTIVITIES.map((act, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-slate-300">
                  <span className="truncate">{act.text}</span>
                  <span className="text-slate-500 text-[10px] shrink-0">{act.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
