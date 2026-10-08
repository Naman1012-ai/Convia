import React from 'react';
import { Zap, Code2, Database, Layers, Cpu, CheckCircle2, Sparkles } from 'lucide-react';

export function AiBlueprintShowcase() {
  return (
    <section id="ai-blueprint" className="py-24 bg-slate-950 border-b border-slate-800/80 relative overflow-hidden">
      {/* Glow Effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[34rem] w-[34rem] rounded-full bg-primary-600/10 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Section Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-primary-500/30 text-primary-300 text-xs font-mono font-bold">
            <Zap className="h-3.5 w-3.5" />
            <span>AI Technical Engine</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Your Project Plan— <br />
            <span className="bg-gradient-to-r from-primary-300 via-primary-200 to-primary-400 bg-clip-text text-transparent">
              Generated Instantly.
            </span>
          </h2>

          <p className="text-base sm:text-lg text-slate-300 font-medium">
            Once an MVP proposal is selected, Convia AI automatically generates technical specifications so your team can start building immediately.
          </p>
        </div>

        {/* Blueprint Card Showcase */}
        <div className="p-8 sm:p-12 rounded-3xl bg-slate-900/90 border border-primary-500/50 shadow-2xl shadow-primary-950/50 space-y-8 max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-primary-600 text-white font-bold shadow-lg shadow-primary-500/30">
                <Zap className="h-6 w-6 fill-current" />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-white">System Architecture & Technical PRD</h3>
                <p className="text-xs font-mono text-primary-300">Target MVP: Real-Time AI Code Synthesizer</p>
              </div>
            </div>

            <span className="px-3 py-1 rounded-full text-xs font-mono font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              ⚡ Production-Ready Technical Spec
            </span>
          </div>

          {/* Grid Showcase */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs">
            {/* Tech Stack */}
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-primary-400 font-bold">
                <Code2 className="h-4 w-4" />
                <span>Recommended Stack</span>
              </div>
              <ul className="space-y-1.5 text-slate-300 font-medium">
                <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> React 19 + Vite</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Tailwind CSS v4</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Firebase Realtime DB</li>
              </ul>
            </div>

            {/* Database Schema */}
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-primary-400 font-bold">
                <Database className="h-4 w-4" />
                <span>Database Schema</span>
              </div>
              <p className="text-slate-300 leading-relaxed font-medium">
                Structured data models: <code className="text-primary-300">Workspaces</code>, <code className="text-primary-200">Proposals</code>, <code className="text-emerald-300">Decisions</code>, <code className="text-amber-300">Tasks</code>.
              </p>
            </div>

            {/* API Endpoints */}
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <Cpu className="h-4 w-4" />
                <span>API & Endpoint Specs</span>
              </div>
              <p className="text-slate-300 leading-relaxed font-medium">
                Documented REST & real-time endpoint contracts, authorization policies, and validated data schemas.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
