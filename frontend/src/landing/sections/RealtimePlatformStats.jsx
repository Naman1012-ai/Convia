import React, { useState, useEffect } from 'react';
import { rtdbService } from '../../services/rtdbService';
import { Users, Briefcase, Globe, ThumbsUp, MessageSquare, CheckSquare, Zap, Megaphone } from 'lucide-react';

export function RealtimePlatformStats() {
  const [counts, setCounts] = useState({
    users: 0,
    workspaces: 0,
    proposals: 0,
    votes: 0,
    comments: 0,
    tasks: 0,
    blueprints: 0,
    announcements: 0,
  });

  useEffect(() => {
    // Single secure subscription to public aggregate node 'globalStats'
    // Guarantees zero download of private user profiles, workspaces, or ideas
    const unsubscribe = rtdbService.subscribe('globalStats', (data) => {
      if (data && typeof data === 'object') {
        setCounts({
          users: Number(data.totalUsers ?? data.users) || 0,
          workspaces: Number(data.totalWorkspaces ?? data.workspaces) || 0,
          proposals: Number(data.totalIdeas ?? data.proposals) || 0,
          votes: Number(data.totalVotes ?? data.votes) || 0,
          comments: Number(data.totalComments ?? data.comments) || 0,
          tasks: Number(data.totalTasks ?? data.tasks) || 0,
          blueprints: Number(data.totalBlueprints ?? data.blueprints) || 0,
          announcements: Number(data.totalAnnouncements ?? data.announcements) || 0,
        });
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const ALL_ITEMS = [
    { label: 'Active Users', val: counts.users, icon: Users, color: 'text-primary-400' },
    { label: 'Workspaces', val: counts.workspaces, icon: Briefcase, color: 'text-primary-300' },
    { label: 'Proposals', val: counts.proposals, icon: Globe, color: 'text-sky-400' },
    { label: 'Upvotes Cast', val: counts.votes, icon: ThumbsUp, color: 'text-emerald-400' },
    { label: 'Comments', val: counts.comments, icon: MessageSquare, color: 'text-amber-400' },
    { label: 'Tasks Created', val: counts.tasks, icon: CheckSquare, color: 'text-rose-400' },
    { label: 'AI Blueprints', val: counts.blueprints, icon: Zap, color: 'text-primary-400' },
    { label: 'Announcements', val: counts.announcements, icon: Megaphone, color: 'text-primary-300' },
  ];

  // Display ONLY items with REAL active data (> 0)
  const activeItems = ALL_ITEMS.filter((item) => item.val > 0);
  const itemsToRender = activeItems.length > 0 ? activeItems : ALL_ITEMS.filter(item => item.val > 0);

  if (itemsToRender.length === 0) {
    return null; // Don't render empty zeros section if no telemetry data
  }

  return (
    <section id="stats" className="py-20 bg-slate-950 border-b border-slate-800/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <span className="px-3 py-1 rounded-full bg-slate-900 border border-primary-500/30 text-primary-300 text-xs font-mono font-bold">
            Live Platform Telemetry
          </span>

          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Realtime Platform Statistics
          </h2>

          <p className="text-xs sm:text-sm text-slate-400 font-medium">
            Live activity telemetry metrics from active workspaces.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 max-w-5xl mx-auto">
          {itemsToRender.map((item) => {
            const IconComp = item.icon;
            return (
              <div
                key={item.label}
                className="w-36 sm:w-44 p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col items-center justify-center text-center space-y-3 shadow-xl hover:border-primary-500/40 transition-all"
              >
                <div className={`p-2.5 rounded-xl bg-slate-950 border border-slate-800 ${item.color}`}>
                  <IconComp className="h-5 w-5" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white tracking-tight font-mono">
                  {item.val}
                </div>
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  {item.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
