import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { adminService } from '../../services/adminService';
import { NotificationService } from '../../services/notificationService';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import {
  BarChart3,
  TrendingUp,
  Users,
  Briefcase,
  Lightbulb,
  Trophy,
  CheckCircle2,
  Download,
  Calendar,
  Layers,
  Award,
} from 'lucide-react';

export default function AdminAnalyticsPage() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('ALL');

  useEffect(() => {
    setLoading(true);

    const unsubscribe = adminService.subscribeToFullAnalytics((data) => {
      setAnalytics(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [timeRange]);

  const handleExportCsv = () => {
    if (!analytics) return;
    const { kpis } = analytics;
    const csvContent =
      `Metric,Value\n` +
      `Total Users,${kpis.totalUsers}\n` +
      `Verified Users,${kpis.verifiedUsers}\n` +
      `Verification Rate %,${kpis.verificationRate}%\n` +
      `Total Workspaces,${kpis.totalWorkspaces}\n` +
      `Total Ideas,${kpis.totalIdeas}\n` +
      `Selected MVPs,${kpis.mvpCount}\n` +
      `Completed Projects,${kpis.completedCount}\n` +
      `Idea Conversion Rate %,${kpis.conversionRate}%\n` +
      `Total Tasks,${kpis.totalTasks}\n` +
      `Completed Tasks,${kpis.completedTasks}\n` +
      `Task Completion Rate %,${kpis.taskCompletionRate}%\n`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `convia_analytics_${Date.now()}.csv`;
    a.click();
    NotificationService.success('Analytics data exported as CSV.');
  };

  if (loading || !analytics) {
    return (
      <div className="space-y-6 w-full">
        <LoadingSkeleton variant="card" count={3} />
      </div>
    );
  }

  const { kpis, funnel, topContributors, topWorkspaces } = analytics;

  return (
    <div className="space-y-6 w-full pb-16">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <BarChart3 className="h-6 w-6 text-purple-400" /> Platform Analytics & Business Intelligence
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Authoritative, real-time platform telemetry computed directly from Firebase operational trees.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-white text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500"
          >
            <option value="ALL">Timeframe: All Time</option>
            <option value="90D">Last 90 Days</option>
            <option value="30D">Last 30 Days</option>
            <option value="7D">Last 7 Days</option>
          </select>

          <Button
            variant="secondary"
            size="sm"
            icon={<Download className="h-4 w-4 text-purple-400" />}
            onClick={handleExportCsv}
            className="bg-purple-950 hover:bg-purple-900 text-purple-200 border border-purple-800 text-xs font-bold"
          >
            Export CSV
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">User Registrations</span>
            <Users className="h-4 w-4 text-purple-400" />
          </div>
          <div className="text-3xl font-black text-white">{kpis.totalUsers}</div>
          <div className="space-y-1">
            <ProgressBar value={kpis.verificationRate} max={100} size="sm" color="purple" />
            <span className="text-[11px] text-purple-300 font-mono font-bold">{kpis.verificationRate}% Verified Profiles</span>
          </div>
        </Card>

        <Card className="p-5 bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">Workspaces Created</span>
            <Briefcase className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="text-3xl font-black text-white">{kpis.totalWorkspaces}</div>
          <span className="text-[11px] text-indigo-300 font-medium">Active Collaboration Environments</span>
        </Card>

        <Card className="p-5 bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">Proposals & MVPs</span>
            <Trophy className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-3xl font-black text-amber-400">{kpis.totalIdeas}</div>
          <div className="space-y-1">
            <ProgressBar value={kpis.conversionRate} max={100} size="sm" color="amber" />
            <span className="text-[11px] text-amber-300 font-mono font-bold">{kpis.mvpCount} Promoted MVPs ({kpis.conversionRate}% Funnel)</span>
          </div>
        </Card>

        <Card className="p-5 bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">Sprint Tasks Execution</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-black text-white">{kpis.completedTasks} / {kpis.totalTasks}</div>
          <div className="space-y-1">
            <ProgressBar value={kpis.taskCompletionRate} max={100} size="sm" color="emerald" />
            <span className="text-[11px] text-emerald-300 font-mono font-bold">{kpis.taskCompletionRate}% Productivity Rate</span>
          </div>
        </Card>
      </div>

      {/* Conversion Funnel */}
      <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
        <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2 border-b border-slate-800 pb-3">
          <TrendingUp className="h-4 w-4 text-purple-400" /> Proposal Conversion Lifecycle Funnel
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {[
            { label: 'Ideation', count: funnel.ideationCount, color: 'bg-slate-700' },
            { label: 'Voting', count: funnel.votingCount, color: 'bg-indigo-600' },
            { label: 'Selected MVP', count: funnel.mvpCount, color: 'bg-amber-600' },
            { label: 'Project Phase', count: funnel.projectCount, color: 'bg-purple-600' },
            { label: 'Completed', count: funnel.completedCount, color: 'bg-emerald-600' },
          ].map((stage, i) => (
            <div key={i} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-center">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">{stage.label}</span>
              <div className="text-2xl font-black text-white">{stage.count}</div>
              <div className={`h-1.5 w-full rounded-full ${stage.color}`} />
            </div>
          ))}
        </div>
      </Card>

      {/* Leaderboards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Contributors */}
        <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Award className="h-4 w-4 text-amber-400" /> Top Community Contributors
          </h3>

          <div className="space-y-3">
            {topContributors.map((u, i) => (
              <div key={u.uid} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-amber-400 text-sm">#{i + 1}</span>
                  <div>
                    <p className="font-bold text-white">{u.displayName || u.email}</p>
                    <p className="text-[11px] text-slate-400 font-mono">{u.uIdeas} Ideas · {u.uTasksCompleted} Tasks Completed</p>
                  </div>
                </div>

                <Badge variant="default" className="bg-purple-950 text-purple-300 border border-purple-800 font-mono text-xs">
                  {u.collabScore} Score
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        {/* Top Workspaces */}
        <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Briefcase className="h-4 w-4 text-indigo-400" /> Highest Performing Workspaces
          </h3>

          <div className="space-y-3">
            {topWorkspaces.map((w, i) => (
              <div key={w.orgId} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-indigo-400 text-sm">#{i + 1}</span>
                  <div>
                    <p className="font-bold text-white">{w.name}</p>
                    <p className="text-[11px] text-slate-400 font-mono">{w.completedCount} / {w.taskCount} Tasks Completed</p>
                  </div>
                </div>

                <Badge variant="default" className="bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono text-xs">
                  {w.rate}% Sprint Rate
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
