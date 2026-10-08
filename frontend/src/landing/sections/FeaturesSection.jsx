import React from 'react';
import { Lightbulb, MessageSquare, ThumbsUp, Zap, CheckSquare, BarChart3, ShieldCheck, Sparkles } from 'lucide-react';

const FEATURES = [
  {
    icon: Lightbulb,
    title: 'Real-Time Ideation Board',
    description: 'Submit raw problem statements and solution proposals instantly. Sync across all workspace members in real time via Firebase RTDB.',
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  },
  {
    icon: MessageSquare,
    title: 'Peer Refinement & Suggestions',
    description: 'Add constructive feedback, technical suggestions, and architectural refinements directly to proposal threads without cluttering chat channels.',
    color: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
  },
  {
    icon: ThumbsUp,
    title: 'Democratic Upvoting',
    description: 'Empower your team to vote on high-impact proposals. Live leaderboard automatically highlights top-voted project concepts.',
    color: 'text-primary-400 bg-primary-500/10 border-primary-500/20',
  },
  {
    icon: Zap,
    title: 'AI Technical Blueprint Engine',
    description: 'Transform selected MVP proposals into production-ready specifications, database schemas, REST/GraphQL endpoints, and technical PRDs.',
    color: 'text-primary-300 bg-primary-500/10 border-primary-500/20',
  },
  {
    icon: CheckSquare,
    title: 'Automated Kanban Sprint Board',
    description: 'Convert Blueprint specs into actionable frontend, backend, and integration task cards with real-time status updates and assignee tracking.',
    color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  },
  {
    icon: BarChart3,
    title: 'Platform Operations & Analytics',
    description: 'Track team velocity, completion metrics, and workspace audit logs to ensure your project ships on schedule before the deadline.',
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
];

export function FeaturesSection() {
  return (
    <section id="legacy-features" className="py-24 bg-slate-950 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Section Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-primary-500/30 text-primary-300 text-xs font-mono font-bold">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Complete Feature Suite</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Everything Your Team Needs <br />
            <span className="bg-gradient-to-r from-primary-300 to-primary-400 bg-clip-text text-transparent">
              From Idea to Shipped MVP
            </span>
          </h2>
          <p className="text-base text-slate-400 font-medium">
            Designed specifically to solve team indecision, scattered notes, and delayed project starts.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {FEATURES.map((f) => {
            const IconComp = f.icon;
            return (
              <div
                key={f.title}
                className="p-7 rounded-3xl bg-slate-900/80 border border-slate-800/80 hover:border-primary-500/40 shadow-xl transition-all duration-300 hover:-translate-y-1 group relative overflow-hidden"
              >
                <div className={`p-3.5 rounded-2xl border ${f.color} w-fit mb-5 group-hover:scale-110 transition-transform duration-200`}>
                  <IconComp className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-extrabold text-white mb-2.5">{f.title}</h3>
                <p className="text-sm text-slate-300 leading-relaxed font-normal">
                  {f.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
