import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Quote, Sparkles, Compass, Cpu, Layers } from 'lucide-react';

const PRINCIPLES_DATA = [
  {
    id: 1,
    theme: 'Structured Consensus',
    pillar: 'Clarity Over Circular Debate',
    icon: Compass,
    tag: 'Decision Architecture',
    statement: 'Unstructured chat channels create circular arguments and lost context. Structured proposal cards and democratic upvoting align team energy on what to build.',
  },
  {
    id: 2,
    theme: 'Automated Blueprinting',
    pillar: 'Seconds From Idea to Architecture',
    icon: Cpu,
    tag: 'AI Technical Engine',
    statement: 'The transition from an agreed MVP to an engineering backlog should be seamless. Convia generates database models, REST contracts, and Kanban backlogs automatically.',
  },
  {
    id: 3,
    theme: 'Sprint Traceability',
    pillar: 'Deterministic Task Alignment',
    icon: Layers,
    tag: 'Execution Engine',
    statement: 'Every sprint card traces directly back to an architectural specification. Team members work with complete context, clear requirements, and shared ownership.',
  },
];

export function TestimonialsCarousel() {
  const [currentIdx, setCurrentIdx] = useState(0);

  const prevSlide = () => {
    setCurrentIdx((prev) => (prev === 0 ? PRINCIPLES_DATA.length - 1 : prev - 1));
  };

  const nextSlide = () => {
    setCurrentIdx((prev) => (prev === PRINCIPLES_DATA.length - 1 ? 0 : prev + 1));
  };

  const item = PRINCIPLES_DATA[currentIdx];
  const IconComp = item.icon;

  return (
    <section className="py-24 bg-slate-950/95 border-b border-slate-800/80 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-primary-500/10 border border-primary-500/30 text-primary-300 text-xs font-mono font-bold">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Platform Philosophy</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Built for Technical Execution
          </h2>

          <p className="text-base text-slate-400 font-medium">
            How Convia is architected to eliminate noise, accelerate decisions, and drive team velocity.
          </p>
        </div>

        {/* Carousel Container */}
        <div className="p-8 sm:p-12 rounded-3xl bg-slate-900/90 border border-primary-500/40 shadow-2xl max-w-4xl mx-auto relative space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-primary-600/20 text-primary-400 border border-primary-500/30">
                <Quote className="h-6 w-6" />
              </div>
              <div>
                <span className="text-xs font-mono font-extrabold text-primary-400">
                  {item.theme}
                </span>
                <h4 className="text-lg font-extrabold text-white">{item.pillar}</h4>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <IconComp className="h-4 w-4 text-primary-400" />
              <span>{item.tag}</span>
            </div>
          </div>

          <p className="text-base sm:text-lg text-slate-200 leading-relaxed font-medium italic">
            &ldquo;{item.statement}&rdquo;
          </p>

          <div className="flex items-center justify-between pt-6 border-t border-slate-800">
            <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>Core Design Tenet</span>
            </div>

            {/* Stepper Controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={prevSlide}
                className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-primary-500/40 transition-colors"
                aria-label="Previous Principle"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <span className="text-xs font-mono text-slate-500">
                {currentIdx + 1} / {PRINCIPLES_DATA.length}
              </span>

              <button
                onClick={nextSlide}
                className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-primary-500/40 transition-colors"
                aria-label="Next Principle"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

