import React from 'react';
import { Users, UserPlus, MessageSquare, ThumbsUp, CheckSquare, Zap, ArrowRight, ShieldCheck } from 'lucide-react';

const COLLAB_CARDS = [
  { title: 'Invite Teammates Instantly', desc: 'Share your 6-character Join Code to get all members into the live ideation room in seconds.', icon: UserPlus },
  { title: 'Sub-Second Realtime Updates', desc: 'Edits, new ideas, and votes sync instantly across all member screens via Firebase RTDB.', icon: Users },
  { title: 'Structured Peer Discussions', desc: 'Add technical feedback and architectural suggestions directly on proposal cards.', icon: MessageSquare },
  { title: 'Democratic Vote Consensus', desc: 'Live leaderboard surfaces the team’s highest-rated project concepts objectively.', icon: ThumbsUp },
  { title: 'Auto-Assigned Sprint Tasks', desc: 'Tasks generated from AI Blueprints are automatically assigned to frontend & backend devs.', icon: CheckSquare },
  { title: 'Collaborative Blueprinting', desc: 'Co-design system architecture, REST endpoints, and database models before writing code.', icon: Zap },
];

export function TeamCollaborationSection() {
  return (
    <section className="py-24 bg-slate-950/95 border-b border-slate-800/80 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <span className="px-3 py-1 rounded-full bg-slate-900 border border-primary-500/30 text-primary-300 text-xs font-mono font-bold">
            Team Dynamics
          </span>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Built Around Teams, Not Individuals
          </h2>

          <p className="text-base text-slate-400 font-medium">
            Convia creates radical transparency so every teammate feels ownership over the project.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {COLLAB_CARDS.map((c) => {
            const IconComp = c.icon;
            return (
              <div
                key={c.title}
                className="p-7 rounded-3xl bg-slate-900/80 border border-slate-800/80 hover:border-primary-500/40 shadow-xl space-y-4 hover:-translate-y-1 transition-all duration-300 group"
              >
                <div className="p-3 rounded-2xl bg-primary-500/10 text-primary-400 border border-primary-500/20 w-fit group-hover:scale-110 transition-transform">
                  <IconComp className="h-6 w-6" />
                </div>

                <h3 className="text-xl font-extrabold text-white">{c.title}</h3>

                <p className="text-xs text-slate-300 leading-relaxed font-medium">
                  {c.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
