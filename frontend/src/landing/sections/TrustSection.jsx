import React from 'react';
import { Rocket, GraduationCap, Lightbulb, Zap, Code2 } from 'lucide-react';
import { SocialProofPlaceholder } from '../components/SocialProofPlaceholder';

const AUDIENCE_BADGES = [
  { label: 'Hackathons', icon: Rocket, color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
  { label: 'Students', icon: GraduationCap, color: 'text-primary-400 border-primary-500/30 bg-primary-500/10' },
  { label: 'Innovators', icon: Lightbulb, color: 'text-primary-300 border-primary-500/30 bg-primary-500/10' },
  { label: 'Startups', icon: Zap, color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
  { label: 'Open Source Teams', icon: Code2, color: 'text-sky-400 border-sky-500/30 bg-sky-500/10' },
];

export function TrustSection() {
  return (
    <section className="py-12 border-y border-slate-800/80 bg-slate-950/70 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 text-center">
        <div className="space-y-2">
          <p className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400">
            Engineered for High-Speed Collaboration
          </p>
          <h3 className="text-sm sm:text-base font-extrabold text-slate-300">
            Built for ambitious teams shipping under tight deadlines
          </h3>
        </div>

        {/* Audience Badges */}
        <div className="flex items-center justify-center gap-3 flex-wrap">
          {AUDIENCE_BADGES.map((b) => {
            const IconComponent = b.icon;
            return (
              <div
                key={b.label}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl border ${b.color} text-xs font-bold transition-all duration-200 hover:scale-105 shadow-md`}
              >
                <IconComponent className="h-4 w-4" />
                <span>{b.label}</span>
              </div>
            );
          })}
        </div>

        {/* Social Proof Placeholder Component */}
        <div className="pt-4 max-w-4xl mx-auto">
          <SocialProofPlaceholder />
        </div>
      </div>
    </section>
  );
}
