import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Globe, Sparkles } from 'lucide-react';

export function CommunityCtaSection() {
  return (
    <section className="py-24 bg-slate-950 relative overflow-hidden">
      {/* Glow Effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[34rem] w-[34rem] rounded-full bg-gradient-to-tr from-primary-600/20 via-primary-700/20 to-emerald-600/10 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-10 sm:p-16 rounded-3xl bg-gradient-to-r from-primary-950/90 via-slate-900 to-primary-900/70 border border-primary-500/50 shadow-2xl shadow-primary-950/60 text-center space-y-8 relative overflow-hidden">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-950/80 border border-primary-500/30 text-primary-300 text-xs font-mono font-bold">
            <Sparkles className="h-3.5 w-3.5 text-primary-400" />
            <span>Join the Convia Community</span>
          </div>

          <div className="space-y-4 max-w-3xl mx-auto">
            <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-tight">
              Join Teams Building Faster.
            </h2>

            <p className="text-base sm:text-lg text-slate-300 font-medium max-w-xl mx-auto">
              Transform your next hackathon project from brainstorm to blueprint in minutes.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link
              to="/signup"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl bg-gradient-to-r from-primary-600 via-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white font-extrabold text-sm shadow-xl shadow-primary-500/30 transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <span>Create Free Workspace</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              to="/explore"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-4 rounded-2xl bg-slate-950/90 hover:bg-slate-900 border border-slate-800 text-slate-200 font-bold text-sm transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <Globe className="h-4 w-4 text-primary-400" />
              <span>Browse Public Ideas</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
