import React from 'react';
import { AlertCircle, CheckCircle2, XCircle, Trophy, Zap, ArrowRight, ShieldCheck } from 'lucide-react';

export function ChaosToClaritySection() {
  return (
    <section className="py-24 bg-slate-950/90 border-b border-slate-800/80 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Section Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <span className="px-3 py-1 rounded-full bg-slate-900 border border-primary-500/30 text-primary-300 text-xs font-mono font-bold">
            Visual Comparison
          </span>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            From Chaos to Clarity
          </h2>

          <p className="text-base text-slate-400 font-medium">
            See the dramatic difference in team momentum during the critical first hour.
          </p>
        </div>

        {/* Split Screen Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          {/* LEFT: Without Convia */}
          <div className="p-8 sm:p-10 rounded-3xl bg-slate-900/40 border border-rose-900/40 space-y-6 relative overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-rose-900/40">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-rose-500" />
                <h3 className="text-xl font-extrabold text-white">Without Convia</h3>
              </div>
              <span className="px-3 py-1 rounded-lg text-xs font-mono font-bold bg-rose-950/80 text-rose-400 border border-rose-800">
                CHAOTIC & STRESSED
              </span>
            </div>

            <div className="space-y-3.5 font-mono text-xs">
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-rose-900/30 text-rose-300 flex items-center justify-between">
                <span>💬 183 Discord Messages in #general</span>
                <span className="text-rose-500 font-bold">Unread Stream</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/80 border border-rose-900/30 text-slate-400 flex items-center justify-between">
                <span>📄 Blank Notion Page</span>
                <span className="text-slate-500">0 Structure</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/80 border border-rose-900/30 text-amber-300 flex items-center justify-between">
                <span>💡 5 Competing Proposals</span>
                <span className="text-amber-500 font-bold">No Consensus</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/80 border border-rose-900/30 text-rose-400 flex items-center justify-between font-bold">
                <span>⌛ 2 Hours Lost in Debates</span>
                <span className="text-rose-500">Late Start</span>
              </div>
            </div>

            <div className="pt-2 text-center text-xs font-mono text-rose-400 font-bold">
              Result: Rushed coding, bugs, & missed hackathon deadline
            </div>
          </div>

          {/* RIGHT: With Convia */}
          <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-b from-primary-950/70 via-slate-900 to-primary-900/50 border border-primary-500/50 shadow-2xl shadow-primary-950/50 space-y-6 relative overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-primary-800/60">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                <h3 className="text-xl font-extrabold text-white">With Convia</h3>
              </div>
              <span className="px-3 py-1 rounded-lg text-xs font-mono font-bold bg-primary-500/20 text-primary-300 border border-primary-500/40">
                STRUCTURED & FOCUSED
              </span>
            </div>

            <div className="space-y-3.5 font-mono text-xs">
              <div className="p-4 rounded-2xl bg-slate-950/90 border border-emerald-500/30 text-emerald-300 flex items-center justify-between font-bold">
                <span>🏆 1 Winning Proposal Selected</span>
                <span className="text-emerald-400">Team Consensus</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/90 border border-primary-500/30 text-primary-300 flex items-center justify-between font-bold">
                <span>⚡ AI Blueprint & Tech PRD Generated</span>
                <span className="text-primary-400">Instant Architecture</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/90 border border-primary-500/30 text-primary-200 flex items-center justify-between font-bold">
                <span>📋 Kanban Tasks Assigned</span>
                <span className="text-primary-400">Sprint Ready</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/90 border border-emerald-500/40 text-white flex items-center justify-between font-extrabold bg-gradient-to-r from-emerald-950/60 to-slate-950">
                <span>🚀 Development Starts in 15 Minutes</span>
                <span className="text-emerald-400">On Track to Win</span>
              </div>
            </div>

            <div className="pt-2 text-center text-xs font-mono text-emerald-400 font-bold flex items-center justify-center gap-1.5">
              <ShieldCheck className="h-4 w-4" />
              <span>Result: Clean architecture, zero stress, & shipped MVP</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
