import React from 'react';
import { Rocket, GraduationCap, Zap, Code2, Building2, Users, Flame, BookOpen } from 'lucide-react';

const EXPANDED_USE_CASES = [
  { title: 'Rapid Sprints', icon: Rocket, scenario: 'Sprint Planning', desc: 'Lock in your project proposal rapidly and ship code with clear architectural specifications.', color: 'border-amber-500/30 text-amber-400 bg-amber-500/10' },
  { title: 'College Projects', icon: GraduationCap, scenario: 'Semester Capstone', desc: 'Organize team proposals fairly with transparent contribution tracking and clear task ownership.', color: 'border-primary-500/30 text-primary-400 bg-primary-500/10' },
  { title: 'Startup Teams', icon: Zap, scenario: 'MVP Product Validation', desc: 'Test feature ideas with co-founders, generate technical blueprints, and maintain sprint velocity.', color: 'border-primary-500/30 text-primary-300 bg-primary-500/10' },
  { title: 'Open Source', icon: Code2, scenario: 'Community Feature Sprints', desc: 'Gather feature proposals from community contributors, upvote priorities, and assign tasks.', color: 'border-sky-500/30 text-sky-400 bg-sky-500/10' },
  { title: 'Innovation Labs', icon: Building2, scenario: 'Internal Sprints', desc: 'Run internal team innovation sprints with secure workspace privacy and administrative audit logs.', color: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' },
  { title: 'Student Clubs', icon: Users, scenario: 'Developer Society Sprints', desc: 'Host internal coding competitions and collaborative project builds across student chapters.', color: 'border-rose-500/30 text-rose-400 bg-rose-500/10' },
  { title: 'Accelerators', icon: Flame, scenario: 'Incubator Cohorts', desc: 'Help early-stage founders turn raw pitch ideas into structured technical execution plans.', color: 'border-amber-500/30 text-amber-400 bg-amber-500/10' },
  { title: 'Research Groups', icon: BookOpen, scenario: 'Academic Collaborations', desc: 'Structure technical research hypotheses, peer refinements, and multi-contributor paper roadmaps.', color: 'border-primary-500/30 text-primary-400 bg-primary-500/10' },
];

export function ExpandedUseCasesSection() {
  return (
    <section id="use-cases" className="py-24 bg-slate-950 border-b border-slate-800/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <span className="px-3 py-1 rounded-full bg-slate-900 border border-primary-500/30 text-primary-300 text-xs font-mono font-bold">
            Target Audiences
          </span>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Built For Every Innovation Team
          </h2>

          <p className="text-base text-slate-400 font-medium">
            Whether you are running an engineering sprint or launching an open-source project, Convia keeps everyone aligned.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {EXPANDED_USE_CASES.map((u) => {
            const IconComp = u.icon;
            return (
              <div
                key={u.title}
                className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800/80 hover:border-primary-500/40 shadow-xl space-y-3.5 hover:-translate-y-1 transition-all duration-300 group"
              >
                <div className="flex items-center justify-between">
                  <div className={`p-2.5 rounded-xl border ${u.color}`}>
                    <IconComp className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-400 px-2 py-0.5 rounded bg-slate-950 border border-slate-800">
                    {u.scenario}
                  </span>
                </div>

                <h3 className="text-lg font-extrabold text-white">{u.title}</h3>

                <p className="text-xs text-slate-300 leading-relaxed font-medium">
                  {u.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
