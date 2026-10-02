import React from 'react';
import { Clock, Layers, Zap, Rocket, CheckCircle2 } from 'lucide-react';

const REASONS = [
  {
    title: 'Decision Speed',
    icon: Clock,
    highlight: 'Save 2+ Hours',
    description: 'Stop wasting the first two hours deciding what to build. Move from scattered brainstorms to a selected MVP proposal in under 15 minutes.',
    color: 'border-amber-500/30 text-amber-400 bg-amber-500/10',
  },
  {
    title: 'Structured Collaboration',
    icon: Layers,
    highlight: 'Zero Discord Noise',
    description: 'Every idea, suggestion, and upvote has a dedicated, permanent place. Technical discussions stay clean and easy to inspect.',
    color: 'border-primary-500/30 text-primary-400 bg-primary-500/10',
  },
  {
    title: 'AI-Powered Planning',
    icon: Zap,
    highlight: 'Instant Architecture',
    description: 'Generate comprehensive PRDs, database schemas, REST endpoints, and technical blueprints instantly upon selecting your MVP.',
    color: 'border-primary-500/30 text-primary-300 bg-primary-500/10',
  },
  {
    title: 'Execution Ready',
    icon: Rocket,
    highlight: 'Sprint Ready',
    description: 'Move directly from decision to development. Auto-populated Kanban tasks ensure every teammate starts coding with clear ownership.',
    color: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10',
  },
];

export function WhyItWorksSection() {
  return (
    <section className="py-24 bg-slate-950 border-b border-slate-800/80 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Section Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <span className="px-3 py-1 rounded-full bg-slate-900 border border-primary-500/30 text-primary-300 text-xs font-mono font-bold">
            Core Competitive Advantage
          </span>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Why Convia Works
          </h2>

          <p className="text-base text-slate-400 font-medium">
            Designed from the ground up to solve hackathon indecision and streamline technical execution.
          </p>
        </div>

        {/* 4 Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {REASONS.map((r) => {
            const IconComp = r.icon;
            return (
              <div
                key={r.title}
                className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800/80 hover:border-primary-500/40 shadow-xl space-y-5 group hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <div className={`p-3 rounded-2xl border ${r.color}`}>
                    <IconComp className="h-6 w-6" />
                  </div>
                  <span className="text-[11px] font-mono font-extrabold text-primary-300 px-3 py-1 rounded-lg bg-slate-950 border border-slate-800">
                    {r.highlight}
                  </span>
                </div>

                <h3 className="text-2xl font-extrabold text-white">{r.title}</h3>

                <p className="text-sm text-slate-300 leading-relaxed font-medium">
                  {r.description}
                </p>

                <div className="pt-2 flex items-center gap-2 text-xs font-semibold text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Verified Workflow Solution</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
