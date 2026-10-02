import React from 'react';
import { Trophy, Rocket, GraduationCap, CheckCircle2, ArrowRight } from 'lucide-react';

const SUCCESS_STORIES = [
  {
    team: 'Team Alpha Zero',
    hackathon: 'TreeHacks 2026',
    project: 'AI Autonomous Code Synthesizer',
    award: '1st Place Grand Champion',
    highlight: 'Went from 5 raw ideas to shipped MVP in 14 hours.',
    gradient: 'from-primary-950/80 via-slate-900 to-primary-900/60 border-primary-500/40',
  },
  {
    team: 'Quantum Builders',
    hackathon: 'HackMIT 2026',
    project: 'Zero-Knowledge Credential Vault',
    award: 'Best Privacy Hack',
    highlight: 'Generated database schema & 8 endpoints in 1.4 seconds.',
    gradient: 'from-primary-950/80 via-slate-900 to-slate-950 border-primary-500/40',
  },
  {
    team: 'DevLabs Open Source',
    hackathon: 'CalHacks 2026',
    project: 'Distributed Multi-Party Ledger',
    award: 'Best Developer Tool',
    highlight: 'Achieved 100% team upvote consensus in 10 minutes.',
    gradient: 'from-slate-950 via-slate-900 to-primary-950/80 border-slate-700',
  },
];

export function SuccessStoriesSection() {
  return (
    <section className="py-24 bg-slate-950 border-b border-slate-800/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <span className="px-3 py-1 rounded-full bg-slate-900 border border-primary-500/30 text-primary-300 text-xs font-mono font-bold">
            Hackathon Track Record
          </span>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Success Stories
          </h2>

          <p className="text-base text-slate-400 font-medium">
            Discover how teams built winning projects using Convia&apos;s decision workflow.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {SUCCESS_STORIES.map((story) => (
            <div
              key={story.team}
              className={`p-8 rounded-3xl bg-gradient-to-b ${story.gradient} border shadow-2xl space-y-6 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden`}
            >
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full text-[10px] font-mono font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                  <Trophy className="h-3 w-3" /> {story.award}
                </span>
                <span className="text-xs font-mono font-bold text-slate-400">
                  {story.hackathon}
                </span>
              </div>

              <div>
                <span className="text-xs font-mono font-bold text-primary-300 uppercase tracking-wide">
                  {story.team}
                </span>
                <h3 className="text-xl font-extrabold text-white mt-1 leading-snug">
                  {story.project}
                </h3>
              </div>

              <div className="pt-4 border-t border-slate-800/80 flex items-center gap-2 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{story.highlight}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
