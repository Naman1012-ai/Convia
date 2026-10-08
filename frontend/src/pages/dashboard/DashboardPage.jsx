import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useUser } from '../../hooks/useUser';
import { dashboardService } from '../../services/dashboardService';
import { PageHeader } from '../../components/layout/PageHeader';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Avatar } from '../../components/ui/Avatar';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { NotificationService } from '../../services/notificationService';
import { NOTIFICATION_MESSAGES } from '../../utils/notificationMessages';
import { CreateOrgForm } from '../../features/organizations/CreateOrgForm';
import { JoinOrgForm } from '../../features/organizations/JoinOrgForm';
import { formatTimestamp } from '../../utils/formatting';
import {
  Briefcase,
  Globe,
  Plus,
  LogIn,
  Layers,
  CheckSquare,
  CheckCircle,
  ThumbsUp,
  FileText,
  Calendar,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Users,
  Trophy,
} from 'lucide-react';

import { EmailVerificationBanner } from '../../components/auth/EmailVerificationBanner';
import { AnnouncementBanner } from '../../components/announcements/AnnouncementBanner';
import { resolveUserDisplayName } from '../../utils/memberIdentity';

export default function DashboardPage() {
  const { user } = useAuth();
  const { userProfile } = useUser();
  const userName = resolveUserDisplayName(userProfile, user);
  const navigate = useNavigate();

  // SWR Initializer: Synchronously read cached data on Frame 1
  const initialCache = useMemo(() => {
    return user ? dashboardService.getCachedDashboardData(user.uid) : null;
  }, [user]);

  // Reactive States initialized from cache (Instant Frame 1 Render)
  const [loading, setLoading] = useState(!initialCache);
  const [organizations, setOrganizations] = useState(initialCache?.organizations || []);
  const [stats, setStats] = useState(
    initialCache?.stats || {
      totalWorkspaces: 0,
      ideasCreated: 0,
      ideasVoted: 0,
      assignedTasks: 0,
      completedTasks: 0,
    }
  );
  const [activeOrg, setActiveOrg] = useState(initialCache?.activeOrg || null);
  const [activeOrgMembers, setActiveOrgMembers] = useState(initialCache?.activeOrgMembers || 0);
  const [activeOrgBlueprint, setActiveOrgBlueprint] = useState(initialCache?.activeOrgBlueprint || null);
  const [activeOrgProgress, setActiveOrgProgress] = useState(initialCache?.activeOrgProgress || 0);
  const [recentActivity, setRecentActivity] = useState(initialCache?.recentActivity || []);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState(initialCache?.upcomingDeadlines || []);

  // Modals & Feedback
  const [isCreateOrgOpen, setIsCreateOrgOpen] = useState(false);
  const [isJoinOrgOpen, setIsJoinOrgOpen] = useState(false);

  // Silent Background Revalidation Engine
  const revalidateDashboard = useCallback(async () => {
    if (!user) return;

    try {
      const freshData = await dashboardService.fetchFreshDashboardData(user);
      if (!freshData) return;

      // Update state without visual flickering
      setOrganizations(freshData.organizations);
      setStats(freshData.stats);
      setActiveOrg(freshData.activeOrg);
      setActiveOrgMembers(freshData.activeOrgMembers);
      setActiveOrgBlueprint(freshData.activeOrgBlueprint);
      setActiveOrgProgress(freshData.activeOrgProgress);
      setRecentActivity(freshData.recentActivity);
      setUpcomingDeadlines(freshData.upcomingDeadlines);

      // Persist to SWR Cache
      dashboardService.setCachedDashboardData(user.uid, freshData);
    } catch (err) {
      console.error('[DashboardPage] Revalidation error:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      revalidateDashboard();
    }
  }, [user, revalidateDashboard]);

  const handleWorkspaceCreated = useCallback(
    (newOrg) => {
      setIsCreateOrgOpen(false);
      NotificationService.success(NOTIFICATION_MESSAGES.WORKSPACE.CREATED);
      revalidateDashboard();
      if (newOrg && newOrg.orgId) {
        navigate(`/workspaces/${newOrg.orgId}/ideas`);
      }
    },
    [navigate, revalidateDashboard]
  );

  const handleWorkspaceJoined = useCallback(() => {
    setIsJoinOrgOpen(false);
    NotificationService.success('Joined workspace successfully.');
    revalidateDashboard();
  }, [revalidateDashboard]);

  // Derived Task Completion Percentage memoized
  const taskCompletionPercentage = useMemo(() => {
    if (stats.assignedTasks === 0) return 0;
    return Math.round((stats.completedTasks / stats.assignedTasks) * 100);
  }, [stats.assignedTasks, stats.completedTasks]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 py-8">
      {/* Email Verification Warning Banner */}
      <EmailVerificationBanner />

      {/* Global Real-time Announcement Banner */}
      <AnnouncementBanner />

      {/* 1. Welcome Command Center Header (Frame 1 Instant Mount) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-8 rounded-3xl border border-slate-700/80 shadow-2xl text-white relative overflow-hidden backdrop-blur-md">
        <div className="absolute top-0 right-0 h-40 w-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 h-40 w-40 bg-indigo-400/5 rounded-full blur-3xl pointer-events-none" />

        {/* Left Column: User Profile */}
        <div className="flex items-center gap-4 z-10">
          <Avatar
            src={userProfile?.photoURL || user?.photoURL}
            name={userName}
            size="lg"
            className="border-2 border-indigo-500/60 ring-4 ring-indigo-500/20 shrink-0"
          />
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white leading-tight">
              Welcome back,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-primary-100 to-primary-300">
                {userName}
              </span>
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-400 font-medium leading-relaxed">
              Convia Command Center &bull; Low-Latency Workspace Engine
            </p>
          </div>
        </div>

        {/* Center Column: Primary Active Workspace Badge */}
        <div className="flex flex-col justify-center bg-white/5 border border-white/10 p-4 rounded-2xl z-10 max-w-sm w-full lg:mx-auto shadow-inner">
          {activeOrg ? (
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                  Active Workspace
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                    activeOrg.status === 'project'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-amber-500/20 text-amber-300'
                  }`}
                >
                  {activeOrg.status === 'project' ? 'Sprint' : 'Ideation'}
                </span>
              </div>
              <h4 className="font-extrabold text-white text-sm truncate">{activeOrg.name}</h4>
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-white/5">
                <span>{activeOrgMembers} Members</span>
                {activeOrg.status === 'project' && (
                  <span className="text-primary-300 font-bold">{activeOrgProgress}% Progress</span>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-2 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                No Active Workspace
              </span>
              <p className="text-[11px] text-slate-400/80">Join a team to begin collaborating!</p>
            </div>
          )}
        </div>

        {/* Right Column: Fast Action Triggers */}
        <div className="flex flex-col sm:flex-row lg:flex-col items-stretch lg:items-end justify-center gap-2.5 z-10 w-full">
          <Button
            variant="primary"
            size="md"
            onClick={() => setIsCreateOrgOpen(true)}
            icon={<Plus className="h-4 w-4" />}
            className="bg-primary-600 hover:bg-primary-700 text-white font-bold border-none shadow-lg shadow-primary-500/25 text-xs w-full sm:flex-1 lg:flex-none lg:w-48 transition-all hover:scale-[1.02]"
          >
            Create Workspace
          </Button>

          <Button
            variant="secondary"
            size="md"
            onClick={() => setIsJoinOrgOpen(true)}
            icon={<LogIn className="h-4 w-4" />}
            className="bg-white/10 hover:bg-white/15 border-white/20 text-white hover:text-white font-bold text-xs w-full sm:flex-1 lg:flex-none lg:w-48 transition-all hover:scale-[1.02]"
          >
            Join Workspace
          </Button>

          <Link to="/explore" className="w-full sm:flex-1 lg:flex-none lg:w-48">
            <Button
              variant="ghost"
              size="md"
              icon={<Globe className="h-4 w-4" />}
              className="text-slate-300 hover:text-white hover:bg-white/5 font-semibold text-xs w-full transition-all"
            >
              Explore Ideas
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Quick Key Metrics Grid */}
      {loading && !initialCache ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <LoadingSkeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="p-5 bg-white border border-slate-200 shadow-sm flex flex-col justify-between hover:border-primary-300 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Workspaces</span>
              <Briefcase className="h-4 w-4 text-primary-500" />
            </div>
            <div>
              <h3 className="text-3xl font-black text-slate-950">{stats.totalWorkspaces}</h3>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Joined & Owned</p>
            </div>
          </Card>

          <Card className="p-5 bg-white border border-slate-200 shadow-sm flex flex-col justify-between hover:border-teal-300 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ideas Posted</span>
              <Layers className="h-4 w-4 text-teal-500" />
            </div>
            <div>
              <h3 className="text-3xl font-black text-slate-950">{stats.ideasCreated}</h3>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Public & Workspace</p>
            </div>
          </Card>

          <Card className="p-5 bg-white border border-slate-200 shadow-sm flex flex-col justify-between hover:border-amber-300 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Votes Cast</span>
              <ThumbsUp className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <h3 className="text-3xl font-black text-slate-950">{stats.ideasVoted}</h3>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Consensus Votes</p>
            </div>
          </Card>

          <Card className="p-5 bg-white border border-slate-200 shadow-sm flex flex-col justify-between hover:border-primary-300 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Assigned Tasks</span>
              <CheckSquare className="h-4 w-4 text-primary-500" />
            </div>
            <div>
              <h3 className="text-3xl font-black text-slate-950">{stats.assignedTasks}</h3>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Sprint Actions</p>
            </div>
          </Card>

          <Card className="p-5 bg-white border border-slate-200 shadow-sm flex flex-col justify-between hover:border-emerald-300 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tasks Done</span>
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-3xl font-black text-slate-950">{stats.completedTasks}</h3>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                {stats.assignedTasks > 0 ? `${taskCompletionPercentage}% completion` : 'No tasks assigned'}
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* 3. Main Command & Workspace Panels */}
      {loading && !initialCache ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <LoadingSkeleton className="h-48 rounded-3xl" />
            <LoadingSkeleton className="h-48 rounded-3xl" />
          </div>
          <div className="space-y-6">
            <LoadingSkeleton className="h-48 rounded-3xl" />
            <LoadingSkeleton className="h-36 rounded-3xl" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Primary Active Workspace Card */}
            <Card className="p-6 bg-white border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary-700 bg-primary-50 border border-primary-200/60 px-2.5 py-1 rounded-full">
                    Primary Workspace
                  </span>
                  <h2 className="text-xl font-black text-slate-900 mt-2">
                    {activeOrg ? activeOrg.name : 'No active workspace'}
                  </h2>
                </div>
                {activeOrg && (
                  <Link to={`/workspaces/${activeOrg.orgId}/ideas`}>
                    <Button variant="ghost" size="sm" className="text-primary-600 hover:text-primary-700">
                      Enter Workspace <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                )}
              </div>

              {activeOrg ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl text-xs font-medium text-slate-500 border border-slate-100">
                    <div>
                      <span>Status:</span>
                      <p className="font-bold text-slate-800 mt-0.5">
                        {activeOrg.status === 'project' ? '⚡ Sprint Execution' : '📝 Ideation & Voting'}
                      </p>
                    </div>

                    <div>
                      <span>Team Size:</span>
                      <p className="font-bold text-slate-800 mt-0.5">{activeOrgMembers} Members</p>
                    </div>

                    <div>
                      <span>Active MVP Project:</span>
                      <p className="font-bold text-primary-700 mt-0.5 truncate">
                        {activeOrgBlueprint ? activeOrgBlueprint.ideaTitle : 'Not selected yet'}
                      </p>
                    </div>
                  </div>

                  {activeOrg.status === 'project' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-700">Sprint Tasks Board Completion</span>
                        <span className="text-primary-600">{activeOrgProgress}%</span>
                      </div>
                      <ProgressBar percentage={activeOrgProgress} size="md" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-6">
                  <p className="text-sm text-slate-600 font-medium mb-4">
                    Create or join a workspace to start brainstorming and tracking consensus!
                  </p>
                  <div className="inline-flex gap-3">
                    <Button variant="primary" size="sm" onClick={() => setIsCreateOrgOpen(true)}>
                      Create Workspace
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setIsJoinOrgOpen(true)}>
                      Join Workspace
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            {/* Recent Activity Log */}
            <Card className="p-6 bg-white border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary-600" /> Recent Activity Log
              </h3>

              {recentActivity.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No recent actions recorded. Go cast some votes or propose ideas!
                </p>
              ) : (
                <div className="space-y-3">
                  {recentActivity.map((activity, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-2 border-b border-slate-100 last:border-b-0 text-xs"
                    >
                      <span className="font-semibold text-slate-800">{activity.title}</span>
                      <span className="text-slate-400 font-medium">
                        {formatTimestamp(activity.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Sidebar Column: Deadlines & Quick Navigation */}
          <div className="space-y-6">
            {/* Upcoming Deadlines */}
            <Card className="p-6 bg-white border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="h-4 w-4 text-rose-500" /> My Upcoming Deadlines
              </h3>

              {upcomingDeadlines.length === 0 ? (
                <div className="text-center py-4 space-y-2">
                  <p className="text-xs text-slate-500 font-medium">All tasks are up to date! Good job!</p>
                  <span className="inline-block text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded">
                    No Deadlines
                  </span>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingDeadlines.map((task) => (
                    <div
                      key={task.taskId}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 truncate max-w-[150px]">
                          {task.title}
                        </span>
                        <span className="text-[10px] font-extrabold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                          {task.dueDate}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                        Priority: {task.priority}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Quick Link Card */}
            <Card className="p-6 bg-gradient-to-br from-primary-50/70 to-primary-100/60 border border-primary-200/60 shadow-sm space-y-4">
              <div className="space-y-2">
                <h3 className="text-sm font-extrabold text-primary-950 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary-600 animate-spin" /> Explore Open Ideas
                </h3>
                <p className="text-xs text-primary-900/80 leading-relaxed">
                  Check out what other hackathon participants are drafting. Share technical iterations or ask questions!
                </p>
              </div>
              <Link to="/explore">
                <Button
                  variant="primary"
                  fullWidth
                  size="sm"
                  className="bg-primary-600 hover:bg-primary-700 text-white font-bold shadow-sm shadow-primary-500/20"
                >
                  Explore Public Brainstorms <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              </Link>
            </Card>
          </div>
        </div>
      )}

      {/* Modals */}
      <Modal
        isOpen={isCreateOrgOpen}
        onClose={() => setIsCreateOrgOpen(false)}
        title="Create a Workspace"
        size="lg"
      >
        <CreateOrgForm
          onSuccess={handleWorkspaceCreated}
          onCancel={() => setIsCreateOrgOpen(false)}
        />
      </Modal>

      <Modal
        isOpen={isJoinOrgOpen}
        onClose={() => setIsJoinOrgOpen(false)}
        title="Join Workspace"
        size="md"
      >
        <JoinOrgForm onSuccess={handleWorkspaceJoined} />
      </Modal>
    </div>
  );
}
