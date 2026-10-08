import React from 'react';
import { Layers, Zap, CheckSquare, CheckCircle2 } from 'lucide-react';

const WORKFLOW_CAPABILITIES = [
  {
    phase: 'Phase 01: Alignment',
    capability: 'Democratic Consensus',
    icon: Layers,
    workflow: 'Idea Consensus & Prioritization',
    highlight: 'Converge scattered team proposals into a single validated MVP.',
    gradient: 'from-primary-950/80 via-slate-900 to-primary-900/60 border-primary-500/40',
  },
  {
    phase: 'Phase 02: Blueprint',
    capability: 'AI Architecture Engine',
    icon: Zap,
    workflow: 'Technical PRD & Schema Specs',
    highlight: 'Generate database models and API endpoints automatically in seconds.',
    gradient: 'from-primary-950/80 via-slate-900 to-slate-950 border-primary-500/40',
  },
  {
    phase: 'Phase 03: Delivery',
    capability: 'Sprint Coordination',
    icon: CheckSquare,
    workflow: 'Auto-Populated Kanban Backlog',
    highlight: 'Map blueprint deliverables directly into assignable team task cards.',
    gradient: 'from-slate-950 via-slate-900 to-primary-950/80 border-slate-700',
  },
];

export function SuccessStoriesSection() {
  return (
    <section className="py-24 bg-slate-950 border-b border-slate-800/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <span className="px-3 py-1 rounded-full bg-slate-900 border border-primary-500/30 text-primary-300 text-xs font-mono font-bold">
            Execution Framework
          </span>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Structured Workflow Patterns
          </h2>

          <p className="text-base text-slate-400 font-medium">
            Discover how Convia transforms raw brainstorming into structured technical execution.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {WORKFLOW_CAPABILITIES.map((wf) => {
            const Icon = wf.icon;
            return (
              <div
                key={wf.workflow}
                className={`p-8 rounded-3xl bg-gradient-to-b ${wf.gradient} border shadow-2xl space-y-6 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden`}
              >
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full text-[10px] font-mono font-extrabold bg-primary-500/20 text-primary-300 border border-primary-500/40 flex items-center gap-1.5">
                    <Icon className="h-3 w-3" /> {wf.capability}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-400">
                    {wf.phase}
                  </span>
                </div>

                <div>
                  <h3 className="text-xl font-extrabold text-white mt-1 leading-snug">
                    {wf.workflow}
                  </h3>
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex items-center gap-2 text-xs font-semibold text-emerald-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{wf.highlight}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

