import React, { useState, useEffect } from 'react';
import { rtdbService } from '../../services/rtdbService';
import { Users, Globe, Briefcase, Trophy, CheckSquare, ThumbsUp, Activity } from 'lucide-react';

export function LivePlatformOverview() {
  const [stats, setStats] = useState({
    users: 0,
    publicIdeas: 0,
    workspaces: 0,
    mvps: 0,
    tasks: 0,
    votes: 0,
  });

  useEffect(() => {
    // Single secure subscription to public aggregate node 'globalStats'
    const unsubscribe = rtdbService.subscribe('globalStats', (data) => {
      if (data && typeof data === 'object') {
        setStats({
          users: Number(data.totalUsers ?? data.users ?? 0),
          publicIdeas: Number(data.totalPublicIdeas ?? data.publicIdeas ?? 0),
          workspaces: Number(data.totalWorkspaces ?? data.workspaces ?? 0),
          mvps: Number(data.totalMvps ?? data.mvps ?? 0),
          tasks: Number(data.totalTasks ?? data.tasks ?? 0),
          votes: Number(data.totalVotes ?? data.votes ?? 0),
        });
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const METRICS = [
    { label: 'Registered Builders', value: stats.users.toLocaleString(), icon: Users, color: 'text-primary-400' },
    { label: 'Public Ideas', value: stats.publicIdeas.toLocaleString(), icon: Globe, color: 'text-primary-300' },
    { label: 'Active Workspaces', value: stats.workspaces.toLocaleString(), icon: Briefcase, color: 'text-sky-400' },
    { label: 'Selected MVPs', value: stats.mvps.toLocaleString(), icon: Trophy, color: 'text-amber-400' },
    { label: 'Sprint Tasks Created', value: stats.tasks.toLocaleString(), icon: CheckSquare, color: 'text-rose-400' },
    { label: 'Community Upvotes', value: stats.votes.toLocaleString(), icon: ThumbsUp, color: 'text-emerald-400' },
  ];

  return (
    <section className="py-24 bg-slate-950 border-b border-slate-800/80 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-primary-500/30 text-primary-300 text-xs font-mono font-bold">
            <Activity className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
            <span>Real-Time Telemetry</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Live Platform Telemetry
          </h2>

          <p className="text-base text-slate-400 font-medium">
            Powering real-time collaboration for engineering teams, open-source communities, and agile builders.
          </p>
        </div>

        {/* 6 Stats Counters Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {METRICS.map((m) => {
            const IconComp = m.icon;
            return (
              <div
                key={m.label}
                className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 text-center space-y-2 hover:border-primary-500/40 transition-all duration-300 group"
              >
                <div className={`p-2.5 rounded-xl bg-slate-950 border border-slate-800 w-fit mx-auto ${m.color}`}>
                  <IconComp className="h-5 w-5" />
                </div>
                <p className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{m.value}</p>
                <p className="text-[11px] font-mono text-slate-400 font-semibold">{m.label}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
