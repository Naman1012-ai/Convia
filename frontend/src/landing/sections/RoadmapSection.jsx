import React from 'react';
import { Sparkles, Code2, GitBranch, MessageSquare, Presentation, Clock } from 'lucide-react';

const ROADMAP_ITEMS = [
  {
    icon: Code2,
    title: 'AI Agent Code Generator',
    status: 'In Development',
    description: 'Auto-generate starter code boilerplate directly from your approved AI Blueprint specs.',
    color: 'border-primary-500/30 text-primary-300 bg-primary-500/10',
  },
  {
    icon: GitBranch,
    title: 'GitHub & GitLab Sync',
    status: 'Q3 2026',
    description: 'Sync Kanban tasks automatically with GitHub Issues and Pull Requests.',
    color: 'border-primary-500/30 text-primary-400 bg-primary-500/10',
  },
  {
    icon: MessageSquare,
    title: 'Discord & Slack Webhooks',
    status: 'Q3 2026',
    description: 'Receive instant notifications when new proposals are submitted or upvoted.',
    color: 'border-sky-500/30 text-sky-300 bg-sky-500/10',
  },
  {
    icon: Presentation,
    title: 'Automated Pitch Exporter',
    status: 'Q4 2026',
    description: 'Export your project proposal and architectural overview directly into presentation slides for judges.',
    color: 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10',
  },
];

export function RoadmapSection() {
  return (
    <section id="roadmap" className="py-24 bg-slate-950 border-t border-slate-800/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-primary-500/30 text-primary-300 text-xs font-mono font-bold">
            <Clock className="h-3.5 w-3.5" />
            <span>Future Vision</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Product Roadmap
          </h2>
          <p className="text-base text-slate-400 font-medium">
            Here is a glimpse of what we are building next to make hackathons even faster.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {ROADMAP_ITEMS.map((item) => {
            const IconComp = item.icon;
            return (
              <div
                key={item.title}
                className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800/80 hover:border-primary-500/40 shadow-xl space-y-4 flex flex-col justify-between group transition-all duration-300"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className={`p-3 rounded-2xl border ${item.color}`}>
                      <IconComp className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-primary-500/10 text-primary-300 border border-primary-500/20">
                      {item.status}
                    </span>
                  </div>

                  <h3 className="text-lg font-extrabold text-white">{item.title}</h3>

                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    {item.description}
                  </p>
                </div>

                <div className="pt-2 text-[10px] font-mono text-primary-400 font-bold flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Coming Soon
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
