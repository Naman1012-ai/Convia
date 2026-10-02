import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Quote, Sparkles, GraduationCap, Award } from 'lucide-react';
import { Avatar } from '../../components/ui/Avatar';

const TESTIMONIALS_DATA = [
  {
    id: 1,
    name: 'Alex Chen',
    role: 'Full Stack Lead',
    university: 'Stanford University',
    hackathon: 'TreeHacks 2026 Winner',
    photo: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
    review: 'Convia eliminated our usual 3-hour debate on Friday night. We locked our MVP in 15 minutes, generated our AI Blueprint, and had initial commits pushed before midnight.',
  },
  {
    id: 2,
    name: 'Sarah Jenkins',
    role: 'AI / ML Engineer',
    university: 'MIT',
    hackathon: 'HackMIT 2026 Finalist',
    photo: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
    review: 'The AI Technical PRD generator is unreal. Having database schemas and API endpoints auto-populated directly into Kanban tasks saved us hours of architectural planning.',
  },
  {
    id: 3,
    name: 'Marcus Vance',
    role: 'Backend Architect',
    university: 'UC Berkeley',
    hackathon: 'CalHacks 2026 Grand Prize',
    photo: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Marcus',
    review: 'Convia keeps technical discussions organized. No more digging through 200 Discord messages to find what feature we agreed to build.',
  },
];

export function TestimonialsCarousel() {
  const [currentIdx, setCurrentIdx] = useState(0);

  const prevSlide = () => {
    setCurrentIdx((prev) => (prev === 0 ? TESTIMONIALS_DATA.length - 1 : prev - 1));
  };

  const nextSlide = () => {
    setCurrentIdx((prev) => (prev === TESTIMONIALS_DATA.length - 1 ? 0 : prev + 1));
  };

  const item = TESTIMONIALS_DATA[currentIdx];

  return (
    <section className="py-24 bg-slate-950/95 border-b border-slate-800/80 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-primary-500/10 border border-primary-500/30 text-primary-300 text-xs font-mono font-bold">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Community Wall of Fame</span>
            <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Coming Soon
            </span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Loved By Hackathon Winners
          </h2>

          <p className="text-base text-slate-400 font-medium">
            Hear how student teams and builders use Convia to ship winning projects under pressure.
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
                  {item.hackathon}
                </span>
                <h4 className="text-lg font-extrabold text-white">{item.name}</h4>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <GraduationCap className="h-4 w-4 text-primary-400" />
              <span>{item.university}</span>
            </div>
          </div>

          <p className="text-base sm:text-lg text-slate-200 leading-relaxed font-medium italic">
            &ldquo;{item.review}&rdquo;
          </p>

          <div className="flex items-center justify-between pt-6 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <Avatar src={item.photo} alt={item.name} size="sm" fallback={item.name.charAt(0)} />
              <div>
                <p className="text-xs font-extrabold text-white">{item.name}</p>
                <p className="text-[11px] text-slate-400 font-medium">{item.role}</p>
              </div>
            </div>

            {/* Stepper Controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={prevSlide}
                className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-primary-500/40 transition-colors"
                aria-label="Previous Testimonial"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <span className="text-xs font-mono text-slate-500">
                {currentIdx + 1} / {TESTIMONIALS_DATA.length}
              </span>

              <button
                onClick={nextSlide}
                className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-primary-500/40 transition-colors"
                aria-label="Next Testimonial"
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
