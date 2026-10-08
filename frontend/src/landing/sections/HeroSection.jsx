import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { WorkflowVisualizer } from '../components/WorkflowVisualizer';

export function HeroSection() {
  return (
    <section className="relative pt-12 pb-20 md:pt-20 md:pb-28 overflow-hidden">
      {/* Background Radial Glow Effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-primary-900/30 via-primary-950/20 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-20 left-1/4 h-80 w-80 rounded-full bg-primary-600/10 blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-40 right-1/4 h-80 w-80 rounded-full bg-primary-700/10 blur-3xl pointer-events-none -z-10" />

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 text-center">
        {/* Top Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-primary-500/30 text-primary-300 text-xs font-mono font-bold shadow-lg shadow-primary-950/40 animate-in fade-in slide-in-from-top-2 duration-300">
          <Sparkles className="h-3.5 w-3.5 text-primary-400" />
          <span>From Idea to Architecture & Execution</span>
        </div>

        {/* Hero Title & Subtitle */}
        <div className="space-y-6 max-w-4xl mx-auto flex flex-col items-center">
          <img
            src="/convia-logo.png"
            alt="Convia Logo"
            className="h-20 w-20 rounded-2xl shadow-2xl shadow-primary-500/20 border border-slate-700/50 object-contain"
          />

          <div className="space-y-3 text-center">
            <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black text-white tracking-tight leading-none">
              Convia
            </h1>
            <p className="text-xl sm:text-3xl lg:text-4xl font-extrabold bg-gradient-to-r from-primary-300 via-primary-200 to-primary-400 bg-clip-text text-transparent tracking-tight">
              Where Ideas Converge into Action.
            </p>
          </div>

          <p className="text-base sm:text-lg text-slate-300 font-medium leading-relaxed max-w-2xl mx-auto">
            Convia brings together scattered ideas, team feedback, weighted democratic voting, and instant AI technical blueprints into one clear direction your team can act on immediately.
          </p>
        </div>

        {/* CTA Button Group */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <Link
            to="/signup"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-primary-600 via-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white font-extrabold text-sm shadow-xl shadow-primary-600/30 transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]"
          >
            <span>Create Free Workspace</span>
            <ArrowRight className="h-4 w-4" />
          </Link>

          <button
            onClick={() => {
              const elem = document.getElementById('how-it-works');
              if (elem) {
                const yOffset = -80;
                const y = elem.getBoundingClientRect().top + window.pageYOffset + yOffset;
                window.scrollTo({ top: y, behavior: 'smooth' });
              }
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="p-1 rounded-lg bg-primary-500/20 text-primary-400">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <span>See How Convia Works</span>
          </button>
        </div>

        {/* Animated Workflow Visualization Visual */}
        <div className="pt-8 max-w-5xl mx-auto">
          <WorkflowVisualizer />
        </div>
      </div>
    </section>
  );
}
