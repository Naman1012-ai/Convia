import React from 'react';
import { Lightbulb, Trophy, Zap, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const STEPS = [
  {
    step: '01',
    icon: Lightbulb,
    title: 'Collect & Refine Ideas',
    description: 'Create a workspace, invite teammates, and pitch raw ideas. Community comments let everyone refine concepts in real time.',
    color: 'from-amber-500 to-orange-500',
  },
  {
    step: '02',
    stepTitle: 'Vote & Lock MVP',
    icon: Trophy,
    title: 'Democratic Voting',
    description: 'Upvote proposals transparently. The team leader locks the top-voted proposal as the official project MVP.',
    color: 'from-primary-600 to-primary-500',
  },
  {
    step: '03',
    icon: Zap,
    title: 'AI Blueprint & Build',
    description: 'AI generates system architecture, database models, and API endpoints, automatically populating your sprint Kanban board.',
    color: 'from-primary-500 to-pink-500',
  },
];

export function HowItWorksSection() {
  return (
    <section id="legacy-how-it-works" className="py-24 bg-slate-950/90 border-t border-slate-800/80 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Section Title */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <span className="px-3 py-1 rounded-full bg-slate-900 border border-primary-500/30 text-primary-300 text-xs font-mono font-bold">
            3-Step Workflow
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            How Convia Works
          </h2>
          <p className="text-base text-slate-400 font-medium">
            From chaos to clarity in three simple steps.
          </p>
        </div>

        {/* 3 Step Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {STEPS.map((s, idx) => {
            const IconComp = s.icon;
            return (
              <div
                key={s.step}
                className="p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-5 relative group hover:border-primary-500/40 transition-all duration-300"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-extrabold text-primary-400 px-3 py-1 rounded-lg bg-slate-950 border border-slate-800">
                    STEP {s.step}
                  </span>
                  <div className={`p-3 rounded-2xl bg-gradient-to-r ${s.color} text-white shadow-lg`}>
                    <IconComp className="h-5 w-5" />
                  </div>
                </div>

                <h3 className="text-2xl font-extrabold text-white pt-2">{s.title}</h3>

                <p className="text-sm text-slate-300 leading-relaxed font-medium">
                  {s.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* CTA Card */}
        <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-r from-primary-950/80 via-slate-900 to-primary-900/60 border border-primary-800/80 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
          <div className="space-y-2">
            <h3 className="text-2xl font-extrabold text-white">Ready to streamline your next project?</h3>
            <p className="text-sm text-slate-300 font-medium">
              Create your free workspace in seconds and start collaborating immediately.
            </p>
          </div>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-950 font-extrabold text-sm shadow-xl shrink-0 transition-transform hover:scale-105"
          >
            <span>Create Free Workspace</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
