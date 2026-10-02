import React from 'react';
import { Rocket, GraduationCap, Zap, Code2, CheckCircle } from 'lucide-react';

const USE_CASES = [
  {
    title: 'Hackathons & Datathons',
    icon: Rocket,
    tag: '24-48 HR SPRINTS',
    description: 'Eliminate 3 hours of arguments on Friday night. Move from idea to technical spec and initial commit before midnight.',
    benefits: ['Fast consensus upvoting', 'Automated PRD generation', 'Zero setup overhead'],
    color: 'border-amber-500/30 text-amber-400 bg-amber-500/10',
  },
  {
    title: 'University Capstones',
    icon: GraduationCap,
    tag: 'STUDENT TEAMS',
    description: 'Structure group ideation for semester projects, capstones, and research labs with transparent contribution tracking.',
    benefits: ['Clear task assignment', 'Fair democratic voting', 'Audit trail telemetry'],
    color: 'border-primary-500/30 text-primary-400 bg-primary-500/10',
  },
  {
    title: 'Early-Stage Startups',
    icon: Zap,
    tag: 'MVP BUILDERS',
    description: 'Validate feature ideas with early co-founders, generate technical blueprints, and maintain sprint execution velocity.',
    benefits: ['AI Architecture generator', 'Kanban task board', 'Real-time sync'],
    color: 'border-primary-500/30 text-primary-300 bg-primary-500/10',
  },
  {
    title: 'Open Source Sprints',
    icon: Code2,
    tag: 'COMMUNITY RUNS',
    description: 'Collect feature proposals from community contributors, upvote priorities, and assign tasks to maintainers.',
    benefits: ['Public proposal explorer', 'Transparent upvoting', 'Community governance'],
    color: 'border-sky-500/30 text-sky-400 bg-sky-500/10',
  },
];

export function UseCasesSection() {
  return (
    <section id="use-cases" className="py-24 bg-slate-950 border-t border-slate-800/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <span className="px-3 py-1 rounded-full bg-slate-900 border border-primary-500/30 text-primary-300 text-xs font-mono font-bold">
            Versatile Applications
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Tailored For Every High-Velocity Team
          </h2>
          <p className="text-base text-slate-400 font-medium">
            Whether you are competing in a 24-hour hackathon or building an open-source project, Convia keeps everyone aligned.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {USE_CASES.map((u) => {
            const IconComp = u.icon;
            return (
              <div
                key={u.title}
                className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-5 hover:border-primary-500/40 transition-all duration-300"
              >
                <div className="flex items-center justify-between">
                  <div className={`p-3 rounded-2xl border ${u.color}`}>
                    <IconComp className="h-6 w-6" />
                  </div>
                  <span className="text-[11px] font-mono font-extrabold text-slate-400 px-3 py-1 rounded-lg bg-slate-950 border border-slate-800">
                    {u.tag}
                  </span>
                </div>

                <h3 className="text-2xl font-extrabold text-white">{u.title}</h3>

                <p className="text-sm text-slate-300 leading-relaxed font-medium">
                  {u.description}
                </p>

                <div className="pt-2 space-y-2 border-t border-slate-800/60">
                  {u.benefits.map((b) => (
                    <div key={b} className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                      <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
