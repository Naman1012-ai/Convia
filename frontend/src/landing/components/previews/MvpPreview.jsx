import React from 'react';
import { Trophy, ThumbsUp, CheckCircle, MessageSquare, Zap, ArrowRight } from 'lucide-react';

export function MvpPreview() {
  return (
    <div className="p-6 sm:p-7 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-base font-extrabold text-white">Democratic MVP Consensus</h4>
            <p className="text-xs text-slate-400 font-medium">Top-voted proposal locked for development</p>
          </div>
        </div>

        <span className="px-3 py-1 rounded-full text-xs font-mono font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
          ✓ Winner Locked
        </span>
      </div>

      {/* Selected Winner Card */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-primary-950/80 via-slate-950 to-primary-900/60 border border-primary-500/50 shadow-xl space-y-3">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-extrabold flex items-center gap-1">
            <Trophy className="h-3 w-3" /> OFFICIAL WORKSPACE MVP
          </span>
          <span className="text-primary-300 font-bold">+28 Upvotes (100% Consensus)</span>
        </div>

        <h5 className="text-base font-extrabold text-white">Convia Real-Time AI Code Synthesizer</h5>
        <p className="text-xs text-slate-300 leading-relaxed font-medium">
          An interactive web surface enabling hackathon teams to submit problem statements, upvote top concepts, and generate technical PRDs instantly.
        </p>

        <div className="flex items-center gap-2 pt-2 text-[11px] font-mono text-slate-400 border-t border-primary-900/40">
          <span>Author: <strong>Alex Chen</strong></span>
          <span>&bull;</span>
          <span className="text-emerald-400 font-bold">Approved by Workspace Lead</span>
        </div>
      </div>

      {/* Peer Suggestions Thread Preview */}
      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2.5">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400">
          <span>Community Suggestions</span>
          <span className="text-primary-400">3 Refinements Incorporated</span>
        </div>
        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 font-medium">
          &ldquo;Add WebSocket fallback so real-time upvotes update without page reloads.&rdquo; — <strong>Sarah J.</strong>
        </div>
      </div>
    </div>
  );
}
