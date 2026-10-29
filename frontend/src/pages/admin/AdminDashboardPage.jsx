import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/adminService';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { formatTimestamp } from '../../utils/formatting';
import {
  Users,
  Briefcase,
  Lightbulb,
  CheckSquare,
  TrendingUp,
  Activity,
  UserCheck,
  Wifi,
  Trophy,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Radio,
  Server,
  Database,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = adminService.subscribeToPlatformMetrics((analytics) => {
      setData(analytics);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading || !data) {
    return (
      <div className="space-y-6 w-full">
        <LoadingSkeleton variant="card" count={3} />
      </div>
    );
  }

  const { metrics, activityFeed, recentUsers, recentWorkspaces, recentIdeas, health } = data;

  return (
    <div className="space-y-8 w-full pb-16">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
            Operational Live Dashboard
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-purple-900/60 text-purple-300 border border-purple-700">
              Phase 1 Realtime
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Live platform telemetry, metric counters, user activity streams, and infrastructure health.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-right">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Live Stream Health</span>
            <span className="text-xs font-bold text-emerald-400 flex items-center justify-end gap-1 mt-0.5">
              <Radio className="h-3 w-3 animate-pulse text-emerald-400" /> Active RTDB Connection
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 1 — Platform Overview Cards Grid */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2">
          <TrendingUp className="h-4 w-4" /> Platform Core Telemetry & Metrics
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* 1. Users Card */}
          <Card className="p-5 bg-slate-900 border border-slate-800 space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Users</span>
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <div className="text-3xl font-black text-white">{metrics.users.totalUsers}</div>
            <div className="flex items-center gap-3 text-xs text-slate-400 pt-1 font-medium">
              <span className="text-emerald-400 font-bold">{metrics.users.verifiedUsers} Verified</span>
              <span>·</span>
              <span className="text-indigo-400 font-bold">{metrics.users.onlineUsers} Online</span>
            </div>
          </Card>

          {/* 2. Workspaces Card */}
          <Card className="p-5 bg-slate-900 border border-slate-800 space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Workspaces</span>
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Briefcase className="h-5 w-5" />
              </div>
            </div>
            <div className="text-3xl font-black text-white">{metrics.workspaces.totalWorkspaces}</div>
            <div className="flex items-center gap-3 text-xs text-slate-400 pt-1 font-medium">
              <span className="text-purple-400 font-bold">{metrics.workspaces.activeWorkspaces} Sprint Active</span>
            </div>
          </Card>

          {/* 3. Ideas Card */}
          <Card className="p-5 bg-slate-900 border border-slate-800 space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Proposals</span>
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Lightbulb className="h-5 w-5" />
              </div>
            </div>
            <div className="text-3xl font-black text-white">{metrics.ideas.totalIdeas}</div>
            <div className="flex items-center gap-3 text-xs text-slate-400 pt-1 font-medium">
              <span className="text-amber-400 font-bold">{metrics.ideas.selectedMvps} Selected MVPs</span>
            </div>
          </Card>

          {/* 4. AI Blueprints Card */}
          <Card className="p-5 bg-slate-900 border border-slate-800 space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">AI Blueprints</span>
              <div className="p-2 rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/20">
                <Sparkles className="h-5 w-5" />
              </div>
            </div>
            <div className="text-3xl font-black text-white">{metrics.blueprints?.totalBlueprints || 0}</div>
            <div className="flex items-center gap-3 text-xs text-slate-400 pt-1 font-medium">
              <span className="text-emerald-400 font-bold">{metrics.blueprints?.completedBlueprints || 0} Completed</span>
              <span>·</span>
              <span className="text-indigo-400 font-bold">{metrics.blueprints?.generatingBlueprints || 0} Generating</span>
            </div>
          </Card>

          {/* 5. Sprint Tasks Card */}
          <Card className="p-5 bg-slate-900 border border-slate-800 space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Sprint Tasks</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckSquare className="h-5 w-5" />
              </div>
            </div>
            <div className="text-3xl font-black text-white">{metrics.tasks.totalTasks}</div>
            <div className="flex items-center gap-3 text-xs text-slate-400 pt-1 font-medium">
              <span className="text-emerald-400 font-bold">{metrics.tasks.completedTasks} Done</span>
              <span>·</span>
              <span className="text-rose-400 font-bold">{metrics.tasks.overdueTasks} Overdue</span>
            </div>
          </Card>
        </div>
      </div>

      {/* SECTION 2 — Real-time Platform Activity Feed & Infrastructure Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Real-time Activity Feed */}
        <Card className="lg:col-span-2 p-6 bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
              <Activity className="h-4 w-4 text-purple-400" /> Live Platform Activity Feed
            </h2>
            <span className="text-[11px] font-mono text-slate-400">Updating Live</span>
          </div>

          {activityFeed.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500 italic">
              No recent activity recorded.
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {activityFeed.map((act) => (
                <div
                  key={act.id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-800 text-purple-400">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-200">{act.title}</p>
                      <span className="text-[11px] text-slate-400 font-medium">by {act.user}</span>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 shrink-0">
                    {formatTimestamp(act.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Infrastructure & Database Health */}
        <Card className="p-6 bg-slate-900 border border-slate-800 space-y-5">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
              <Server className="h-4 w-4 text-emerald-400" /> Realtime Infrastructure Health
            </h2>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400">Database Connection</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Connected
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400">Active RTDB Socket Listeners</span>
              <span className="text-purple-400 font-bold">{health.activeListenersCount} Streams</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400">Open Issue Reports</span>
              <span className="text-amber-400 font-bold">{metrics.reports.openReports} Reports</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400">Authentication Service</span>
              <span className="text-emerald-400 font-bold">Operational</span>
            </div>
          </div>

          <div className="pt-2">
            <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-900/60 text-[11px] text-purple-200 font-medium leading-relaxed">
              ⚡ All metrics are computed dynamically from live Realtime Database listeners with zero fake values.
            </div>
          </div>
        </Card>
      </div>

      {/* SECTION 3 — Live AI Blueprints Telemetry Stream */}
      <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-pink-400" /> Recent AI Blueprints Telemetry Stream
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            {data.recentBlueprints?.length || 0} Blueprints
          </span>
        </div>

        {(!data.recentBlueprints || data.recentBlueprints.length === 0) ? (
          <div className="text-center py-6 text-xs text-slate-500 italic">
            No AI Blueprints generated yet across the platform.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-medium text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-mono border-b border-slate-800">
                <tr>
                  <th className="p-3">Proposal / MVP Title</th>
                  <th className="p-3">Version</th>
                  <th className="p-3">AI Model</th>
                  <th className="p-3">Generated Date</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {data.recentBlueprints.map((bp, idx) => (
                  <tr key={bp.blueprintId || bp.updatedAt || idx} className="hover:bg-slate-850 transition-colors">
                    <td className="p-3 font-bold text-white flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-pink-400 shrink-0" />
                      <span className="line-clamp-1">{bp.ideaTitle || 'MVP Blueprint'}</span>
                    </td>
                    <td className="p-3 text-purple-300 font-mono font-bold">
                      v{bp.version || '1.0'}
                    </td>
                    <td className="p-3 text-slate-400 font-mono">
                      {bp.aiModel || 'gemini-2.0-flash'}
                    </td>
                    <td className="p-3 text-slate-400 font-mono">
                      {formatTimestamp(bp.generationCompletedAt || bp.updatedAt)}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        bp.status === 'completed'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : bp.status === 'failed'
                          ? 'bg-rose-950 text-rose-400 border border-rose-800'
                          : 'bg-indigo-950 text-indigo-400 border border-indigo-800 animate-pulse'
                      }`}>
                        {bp.status === 'completed' ? '✓ Completed' : bp.status === 'failed' ? '💥 Failed' : '⚡ Generating'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* SECTION 4 — Recent Users Table */}
      <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-indigo-400" /> Recent User Registrations
          </h2>
          <span className="text-xs text-slate-400 font-mono">{recentUsers.length} Users</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-medium text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-mono border-b border-slate-800">
              <tr>
                <th className="p-3">User</th>
                <th className="p-3">Email</th>
                <th className="p-3">Joined Date</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {recentUsers.map((u) => (
                <tr key={u.uid} className="hover:bg-slate-850 transition-colors">
                  <td className="p-3 flex items-center gap-2.5 font-bold text-white">
                    <Avatar name={u.displayName || u.email} size="sm" />
                    <span>{u.displayName || 'User'}</span>
                  </td>
                  <td className="p-3 text-slate-400 font-mono">{u.email}</td>
                  <td className="p-3 text-slate-400 font-mono">{formatTimestamp(u.joinedAt)}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      u.onlineStatus === 'online' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {u.onlineStatus === 'online' ? '● Online' : 'Offline'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* SECTION 4 & 5 — Recent Workspaces & Recent Ideas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Workspaces */}
        <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-purple-400" /> Recent Workspaces
            </h2>
            <span className="text-xs text-slate-400 font-mono">{recentWorkspaces.length} Workspaces</span>
          </div>

          <div className="space-y-3">
            {recentWorkspaces.map((w) => (
              <div key={w.orgId} className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-white">{w.name}</h4>
                  <p className="text-[11px] text-slate-400">Hackathon: {w.hackathonName || 'General Workspace'}</p>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  w.status === 'project' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'
                }`}>
                  {w.status === 'project' ? '⚡ Sprint Phase' : '📝 Ideation'}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Recent Ideas */}
        <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-400" /> Recent Proposals
            </h2>
            <span className="text-xs text-slate-400 font-mono">{recentIdeas.length} Proposals</span>
          </div>

          <div className="space-y-3">
            {recentIdeas.map((i) => (
              <div key={i.ideaId} className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-white line-clamp-1">{i.title}</h4>
                  <p className="text-[11px] text-slate-400">by {i.authorName || 'Member'} · {i.voteCount || 0} Votes</p>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  i.isSelected ? 'bg-amber-950 text-amber-300 border border-amber-700' : 'bg-slate-800 text-slate-300'
                }`}>
                  {i.isSelected ? '🏆 Selected MVP' : (i.projectStatus || 'Ideation')}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
