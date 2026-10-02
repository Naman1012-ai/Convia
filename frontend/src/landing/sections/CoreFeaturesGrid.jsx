import React from 'react';
import {
  Lightbulb,
  MessageSquare,
  ThumbsUp,
  Trophy,
  Zap,
  CheckSquare,
  Users,
  Briefcase,
  Globe,
  ShieldCheck,
  Megaphone,
  Sliders,
  Bell,
  Sparkles,
} from 'lucide-react';

const ALL_FEATURES = [
  { title: 'Structured Brainstorming', icon: Lightbulb, desc: 'Submit problem statements and solution ideas without unstructured chat noise.', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  { title: 'Technical Suggestions', icon: MessageSquare, desc: 'Add constructive peer feedback and architectural refinements directly to proposal threads.', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  { title: 'Community Voting', icon: ThumbsUp, desc: 'Cast votes transparently to elevate top-rated proposals into workspace leaderboards.', color: 'text-primary-400 bg-primary-500/10 border-primary-500/20' },
  { title: 'MVP Selection', icon: Trophy, desc: 'Workspace lead locks the winning proposal as the official project MVP.', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  { title: 'AI Blueprint Generation', icon: Zap, desc: 'Instantly generate technical PRDs, architecture specs, database schemas, and REST endpoints.', color: 'text-primary-300 bg-primary-500/10 border-primary-500/20' },
  { title: 'Task Management', icon: CheckSquare, desc: 'Auto-populated Kanban board assigns frontend, backend, and integration task cards to teammates.', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
  { title: 'Realtime Collaboration', icon: Users, desc: 'Instant real-time state synchronization across all workspace team members.', color: 'text-primary-400 bg-primary-500/10 border-primary-500/20' },
  { title: 'Workspace Management', icon: Briefcase, desc: 'Join via code, manage team rosters, enforce member limits, and configure settings.', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  { title: 'Announcement System', icon: Megaphone, desc: 'Broadcast team alerts, platform notices, and system updates with per-user dismissal.', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  { title: 'Feature Flags & Controls', icon: Sliders, desc: 'Dynamic feature toggles and platform limits enforced across workspace modules.', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
  { title: 'Notification Center', icon: Bell, desc: 'Real-time notifications for upvotes, comments, MVP selection, and assignment updates.', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
];

export function CoreFeaturesGrid() {
  return (
    <section id="features" className="py-24 bg-slate-950/90 border-b border-slate-800/80 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-primary-500/30 text-primary-300 text-xs font-mono font-bold">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Complete Platform Architecture</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Everything You Need Before Writing Your First Line of Code
          </h2>

          <p className="text-base text-slate-400 font-medium">
            Thirteen built-in modules designed to turn ideation into execution.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {ALL_FEATURES.map((f) => {
            const IconComp = f.icon;
            return (
              <div
                key={f.title}
                className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800/80 hover:border-primary-500/40 shadow-xl space-y-3 hover:-translate-y-1 transition-all duration-300 group"
              >
                <div className={`p-3 rounded-xl border ${f.color} w-fit group-hover:scale-110 transition-transform`}>
                  <IconComp className="h-5 w-5" />
                </div>
                <h3 className="text-base font-extrabold text-white">{f.title}</h3>
                <p className="text-xs text-slate-300 leading-relaxed font-medium">
                  {f.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
