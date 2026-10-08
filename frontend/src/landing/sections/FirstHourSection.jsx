import React, { useState } from 'react';
import { Clock, AlertTriangle, ArrowRight, XCircle, Sparkles } from 'lucide-react';

const WASTED_TIME_STAGES = [
  {
    step: '01',
    time: '0:00 - 0:20',
    title: 'Brainstorming',
    subtitle: 'Scattered thoughts in chat',
    description: 'Everyone drops random links, ideas, and tech stacks into a single chat channel.',
    impact: 'Low Structure',
  },
  {
    step: '02',
    time: '0:20 - 0:40',
    title: 'Confusion',
    subtitle: '5 different competing ideas',
    description: 'No central place to evaluate proposals side-by-side or analyze trade-offs.',
    impact: 'High Friction',
  },
  {
    step: '03',
    time: '0:40 - 1:00',
    title: 'Endless Debates',
    subtitle: '1+ hour arguing pros & cons',
    description: 'Team members debate which idea is more innovative without objective metrics.',
    impact: 'Time Drain',
  },
  {
    step: '04',
    time: '1:00 - 1:30',
    title: 'Changing Ideas',
    subtitle: 'Pivoting before starting',
    description: 'Doubt sets in and the team pivots to a completely new concept mid-meeting.',
    impact: 'Momentum Lost',
  },
  {
    step: '05',
    time: '1:30 - 2:00',
    title: 'No Clear Direction',
    subtitle: 'Uncertainty on tech stack & PRD',
    description: 'No architecture document or task list created. Nobody knows who builds what.',
    impact: 'Paralysis',
  },
  {
    step: '06',
    time: '2:00+',
    title: 'Late Start',
    subtitle: 'Coding begins under severe stress',
    description: 'First lines of code are written 2 hours late. Development is rushed and buggy.',
    impact: 'Sprint Failure',
  },
];

export function FirstHourSection() {
  const [activeStep, setActiveStep] = useState(2);

  return (
    <section className="py-24 bg-slate-950/95 border-b border-slate-800/80 relative overflow-hidden">
      {/* Glow Effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-rose-600/10 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Section Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono font-bold">
            <Clock className="h-3.5 w-3.5" />
            <span>The Sprint Time Paradox</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            The First Hour Decides <br />
            <span className="bg-gradient-to-r from-rose-400 via-amber-300 to-orange-400 bg-clip-text text-transparent">
              The Next 36.
            </span>
          </h2>

          <p className="text-base sm:text-lg text-slate-300 font-medium leading-relaxed">
            Most sprint teams don&apos;t fail because they can&apos;t build. <br className="hidden sm:inline" />
            They fail because they spend too much time deciding <span className="text-white font-bold">what to build</span>.
          </p>
        </div>

        {/* Timeline Stage Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {WASTED_TIME_STAGES.map((stg, idx) => {
            const isHovered = activeStep === idx;
            return (
              <div
                key={stg.step}
                onMouseEnter={() => setActiveStep(idx)}
                className={`p-7 rounded-3xl border transition-all duration-300 cursor-pointer relative overflow-hidden ${
                  isHovered
                    ? 'bg-slate-900/90 border-rose-500/50 shadow-2xl shadow-rose-950/30 scale-[1.02]'
                    : 'bg-slate-900/50 border-slate-800/80 hover:bg-slate-900/70 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-extrabold bg-slate-950 text-rose-400 border border-rose-500/20">
                    {stg.time}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-500">
                    STAGE {stg.step}
                  </span>
                </div>

                <h3 className="text-xl font-extrabold text-white mb-1">{stg.title}</h3>
                <p className="text-xs font-mono font-semibold text-rose-400/90 mb-3">{stg.subtitle}</p>

                <p className="text-xs text-slate-300 leading-relaxed font-medium mb-4">
                  {stg.description}
                </p>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400">Bottleneck:</span>
                  <span className="px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-800/60 font-bold">
                    {stg.impact}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
