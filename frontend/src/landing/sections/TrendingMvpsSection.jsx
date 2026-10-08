import React from 'react';
import { Trophy, CheckCircle2, ThumbsUp, Zap, Sparkles } from 'lucide-react';

const DEMO_TRENDING_MVPS = [
  {
    workspace: 'Core Engineering Team',
    ideaName: 'Real-Time AI Code Synthesizer',
    selectionDate: 'July 24, 2026',
    votes: 48,
    status: 'Official MVP Locked',
    gradient: 'from-primary-950/80 via-slate-900 to-primary-900/60 border-primary-500/50',
  },
  {
    workspace: 'Quantum Innovators',
    ideaName: 'Zero-Knowledge Document Verification',
    selectionDate: 'July 23, 2026',
    votes: 36,
    status: 'Sprint in Progress',
    gradient: 'from-primary-950/80 via-slate-900 to-slate-950 border-primary-500/50',
  },
  {
    workspace: 'DevLabs Open Source',
    ideaName: 'Distributed Web3 State Synchronizer',
    selectionDate: 'July 22, 2026',
    votes: 42,
    status: 'AI Blueprint Ready',
    gradient: 'from-slate-950 via-slate-900 to-primary-950/80 border-slate-700',
  },
];

export function TrendingMvpsSection() {
  return (
    <section className="py-24 bg-slate-950/95 border-b border-slate-800/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold">
            <Trophy className="h-3.5 w-3.5" />
            <span>Consensus Winners</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Recently Selected MVPs
          </h2>

          <p className="text-base text-slate-400 font-medium">
            Proposals that achieved 100% team consensus and moved straight into sprint execution.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {DEMO_TRENDING_MVPS.map((mvp) => (
            <div
              key={mvp.ideaName}
              className={`p-8 rounded-3xl bg-gradient-to-b ${mvp.gradient} border shadow-2xl space-y-6 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden`}
            >
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full text-[10px] font-mono font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                  <Trophy className="h-3 w-3" /> MVP LOCKED
                </span>
                <span className="text-xs font-mono font-bold text-primary-300 flex items-center gap-1">
                  <ThumbsUp className="h-3.5 w-3.5" /> +{mvp.votes} Votes
                </span>
              </div>

              <div>
                <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wide">
                  {mvp.workspace}
                </span>
                <h3 className="text-xl font-extrabold text-white mt-1 leading-snug">
                  {mvp.ideaName}
                </h3>
              </div>

              <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">{mvp.selectionDate}</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {mvp.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
