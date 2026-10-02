import React, { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useOrg } from '../../hooks/useOrg';
import { useAuth } from '../../hooks/useAuth';
import { usePlatformSettings } from '../../hooks/usePlatformSettings';
import { IdeaProvider } from '../../contexts/IdeaContext';
import { workspaceDashboardService } from '../../services/workspaceDashboardService';
import { NotificationService } from '../../services/notificationService';
import { WorkspaceActivityFeed } from '../../components/activity/WorkspaceActivityFeed';
import { WorkspaceSearchModal } from '../../components/search/WorkspaceSearchModal';
import { CreateIdeaModal } from '../../features/ideas/CreateIdeaModal';
import { ErrorBoundary } from '../../components/feedback/ErrorBoundary';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { formatTimestamp } from '../../utils/formatting';
import { cn } from '../../utils/cn';
import {
  LayoutDashboard,
  Lightbulb,
  Plus,
  Search,
  Trophy,
  ThumbsUp,
  Users,
  CheckSquare,
  ArrowRight,
  Sparkles,
  Layers,
  ChevronRight,
  Clock,
  AlertTriangle,
  AlertCircle,
  Info,
  HelpCircle,
  MessageSquare,
  RefreshCw,
  Shield,
  Kanban,
  XCircle,
  Loader2,
} from 'lucide-react';

function WorkspaceDashboardContent() {
  const { orgId } = useParams();
  const navigate = useNavigate();
  const { org, members, isLeader, isFrozen } = useOrg();
  const { user } = useAuth();
  const { canCreateIdea } = usePlatformSettings();

  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [, setError] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [activeFeedbackTab, setActiveFeedbackTab] = useState('questions');

  // Handle Ctrl+K / Cmd+K shortcut for search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Real-time Dashboard Subscription with clean workspace switching isolation
  useEffect(() => {
    if (!orgId) {
      setDashboardData(null);
      setLoading(false);
      return;
    }

    // Immediately clear state for previous workspace to prevent stale data bleed
    setDashboardData(null);
    setLoading(true);
    setError(null);

    let isSubscribed = true;

    const unsubscribe = workspaceDashboardService.subscribeToWorkspaceDashboard(
      orgId,
      (data) => {
        if (!isSubscribed) return;
        setDashboardData(data);
        setLoading(false);
      },
      user
    );

    return () => {
      isSubscribed = false;
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [orgId, user]);

  const handleRefresh = useCallback(async () => {
    if (!orgId) return;
    try {
      setLoading(true);
      const fresh = await workspaceDashboardService.getWorkspaceDashboardData(orgId, user);
      setDashboardData(fresh);
    } catch (err) {
      setError(err.message || 'Failed to refresh dashboard');
    } finally {
      setLoading(false);
    }
  }, [orgId, user]);

  const handleOpenCreateModal = () => {
    const check = canCreateIdea ? canCreateIdea() : { allowed: true };
    if (!check.allowed) {
      NotificationService.warning(check.reason);
      return;
    }
    setIsCreateModalOpen(true);
  };

  const handleAttentionAction = (item) => {
    if (item.actionKey === 'create_idea') {
      handleOpenCreateModal();
    } else if (item.actionUrl) {
      navigate(item.actionUrl);
    }
  };

  const currentOrg = dashboardData?.org || org;
  const isSprintPhase = currentOrg?.status === 'project' || isFrozen;
  const bp = dashboardData?.blueprint;
  const selectedMvp = dashboardData?.selectedMvp;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8 overflow-x-hidden">
      {/* 1. DASHBOARD HEADER / HERO BANNER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-50 via-primary-50/40 to-lavender-surface p-6 sm:p-8 border border-slate-200/80 shadow-sm">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-primary-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-80 h-80 rounded-full bg-primary-400/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider bg-primary-50 text-primary-700 border border-primary-200/80 shadow-xs">
                <LayoutDashboard className="h-3.5 w-3.5" />
                Workspace Overview
              </span>

              {isSprintPhase ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-xs">
                  <Kanban className="h-3.5 w-3.5 text-emerald-600" />
                  Sprint Execution Phase
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200/80 shadow-xs">
                  <Lightbulb className="h-3.5 w-3.5 text-amber-600" />
                  Ideation & Brainstorming
                </span>
              )}

              {isLeader && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-primary-50 text-primary-800 border border-primary-200/80 shadow-xs">
                  <Shield className="h-3 w-3 text-primary-600" />
                  Lead
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-slate-900">
              {currentOrg?.name || 'Workspace Dashboard'}
            </h1>

            <p className="text-sm sm:text-base text-slate-600 line-clamp-2 max-w-xl font-normal leading-relaxed">
              {currentOrg?.description ||
                'Collaborative space for submitting proposals, shaping MVPs, synthesizing blueprints, and executing sprint delivery.'}
            </p>
          </div>

          {/* Header Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              icon={<Search className="h-4 w-4 text-slate-500" />}
              onClick={() => setIsSearchModalOpen(true)}
              className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-xs font-semibold text-xs"
            >
              Search (Ctrl+K)
            </Button>

            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw className={cn('h-3.5 w-3.5 text-slate-500', loading && 'animate-spin')} />}
              onClick={handleRefresh}
              disabled={loading}
              className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-xs font-semibold text-xs"
            >
              Refresh
            </Button>

            {!isFrozen && (
              <Button
                variant="primary"
                size="sm"
                icon={<Plus className="h-4 w-4" />}
                onClick={handleOpenCreateModal}
                className="bg-primary-600 hover:bg-primary-700 text-white font-bold shadow-md shadow-primary-500/20 text-xs"
              >
                Propose Idea
              </Button>
            )}

            <Link to={`/workspaces/${orgId}/chat`}>
              <Button
                variant="secondary"
                size="sm"
                icon={<MessageSquare className="h-4 w-4 text-slate-500" />}
                className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-xs font-semibold text-xs"
              >
                Team Chat
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* 2. ATTENTION REQUIRED / ACTION ITEMS BAR */}
      {dashboardData?.attentionItems && dashboardData.attentionItems.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-600">
              Needs Attention & Next Steps ({dashboardData.attentionItems.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {dashboardData.attentionItems.map((item) => {
              const severityStyles = {
                danger: 'bg-rose-50/80 border-rose-200 text-rose-950',
                warning: 'bg-amber-50/80 border-amber-200 text-amber-950',
                info: 'bg-primary-50/80 border-primary-200 text-primary-950',
                primary: 'bg-primary-50/80 border-primary-200 text-primary-950',
                neutral: 'bg-slate-50 border-slate-200 text-slate-900',
              }[item.severity || 'neutral'];

              const iconStyles = {
                danger: <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />,
                warning: <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />,
                info: <Info className="h-5 w-5 text-primary-600 shrink-0 mt-0.5" />,
                primary: <Sparkles className="h-5 w-5 text-primary-600 shrink-0 mt-0.5" />,
                neutral: <HelpCircle className="h-5 w-5 text-slate-600 shrink-0 mt-0.5" />,
              }[item.severity || 'neutral'];

              const btnVariant = item.severity === 'danger' ? 'danger' : 'primary';

              return (
                <div
                  key={item.id}
                  className={cn(
                    'flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border shadow-xs transition-all hover:shadow-md',
                    severityStyles
                  )}
                >
                  <div className="flex items-start gap-3">
                    {iconStyles}
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold leading-tight">{item.title}</h3>
                      <p className="text-xs opacity-80 leading-relaxed max-w-xl">{item.message}</p>
                    </div>
                  </div>

                  {(item.actionLabel || item.actionKey) && (
                    <Button
                      size="sm"
                      variant={btnVariant}
                      onClick={() => handleAttentionAction(item)}
                      className="shrink-0 text-xs font-bold font-mono self-start sm:self-center"
                    >
                      {item.actionLabel || 'Take Action'}
                      <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. WORKSPACE CORE METRICS (4 CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Metric 1: Proposals */}
        <Card className="p-5 bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow rounded-2xl flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">
                Project Proposals
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                <Lightbulb className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-black text-slate-900 tracking-tight">
                {dashboardData?.totalIdeas ?? (loading ? '—' : 0)}
              </span>
              <span className="text-xs font-bold text-slate-500">
                {dashboardData?.totalVotes || 0} Votes
              </span>
            </div>
          </div>
          <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between">
            <Link
              to={`/workspaces/${orgId}/ideas`}
              className="text-xs font-mono font-bold text-primary-600 hover:text-primary-700 inline-flex items-center gap-1"
            >
              <span>Explore Ideas</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
            {selectedMvp && (
              <Badge variant="success" className="text-[10px] font-mono">
                MVP Selected
              </Badge>
            )}
          </div>
        </Card>

        {/* Metric 2: Blueprint & Sprint Status */}
        <Card className="p-5 bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow rounded-2xl flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">
                AI Blueprint Status
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-50 text-primary-700 border border-primary-100">
                <Sparkles className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-black text-slate-900 tracking-tight capitalize">
                {bp?.status === 'completed'
                  ? `v${bp.version}`
                  : bp?.status === 'generating'
                  ? 'Generating...'
                  : bp?.status === 'failed'
                  ? 'Failed'
                  : 'Not Started'}
              </span>
              <Badge
                variant={
                  bp?.status === 'completed'
                    ? 'success'
                    : bp?.status === 'generating'
                    ? 'info'
                    : bp?.status === 'failed'
                    ? 'danger'
                    : 'default'
                }
                className="text-[10px] font-mono uppercase"
              >
                {bp?.approvalStatus === 'approved' ? 'Approved' : bp?.status || 'Pending'}
              </Badge>
            </div>
          </div>
          <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">
              {bp ? `${bp.taskCount || 0} Tasks • ${bp.wavesCount || 0} Waves` : 'Ready for MVP'}
            </span>
            {selectedMvp ? (
              <Link
                to={`/workspaces/${orgId}/ideas/${selectedMvp.ideaId}/blueprint`}
                className="text-xs font-mono font-bold text-primary-600 hover:text-primary-700 inline-flex items-center gap-1"
              >
                <span>View</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <Link
                to={`/workspaces/${orgId}/ideas`}
                className="text-xs font-mono font-bold text-primary-600 hover:text-primary-700 inline-flex items-center gap-1"
              >
                <span>Board</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </Card>

        {/* Metric 3: Collaboration Discussions */}
        <Card className="p-5 bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow rounded-2xl flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">
                Discussions & Feedback
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                <HelpCircle className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-black text-slate-900 tracking-tight">
                {(dashboardData?.openQuestions || 0) + (dashboardData?.totalSuggestions || 0)}
              </span>
              <span className="text-xs font-bold text-slate-500">
                {dashboardData?.acceptedSuggestions || 0} Suggestions Accepted
              </span>
            </div>
          </div>
          <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">
              {dashboardData?.openQuestions || 0} Questions • {dashboardData?.totalSuggestions || 0} Suggestions
            </span>
            <Link
              to={`/workspaces/${orgId}/ideas`}
              className="text-xs font-mono font-bold text-primary-600 hover:text-primary-700 inline-flex items-center gap-1"
            >
              <span>Review</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Card>

        {/* Metric 4: Team Members */}
        <Card className="p-5 bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow rounded-2xl flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">
                Team Roster
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-black text-slate-900 tracking-tight">
                {dashboardData?.totalMembers || members?.length || 1}
              </span>
              <span className="text-xs font-bold text-emerald-600 font-mono">
                Active Collaborators
              </span>
            </div>
          </div>
          <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium truncate max-w-[130px]">
              {isLeader ? 'You are Lead' : 'Workspace Member'}
            </span>
            <Link
              to={`/workspaces/${orgId}/members`}
              className="text-xs font-mono font-bold text-primary-600 hover:text-primary-700 inline-flex items-center gap-1"
            >
              <span>Manage</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Card>
      </div>

      {/* 4. BLUEPRINT / SPRINT STATE HIGHLIGHT CARD */}
      <Card className="p-6 bg-gradient-to-br from-white via-slate-50 to-primary-50/20 border border-slate-200 rounded-3xl shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/70 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-md shadow-primary-500/25">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  AI Build Specification & Sprint Delivery
                </h2>
                <Badge
                  variant={
                    bp?.status === 'completed'
                      ? 'success'
                      : bp?.status === 'generating'
                      ? 'info'
                      : bp?.status === 'failed'
                      ? 'danger'
                      : 'default'
                  }
                  className="font-mono text-[10px] uppercase"
                >
                  {bp?.status === 'completed'
                    ? bp.approvalStatus === 'approved'
                      ? 'Approved'
                      : 'Ready for Review'
                    : bp?.status || 'Ideation Stage'}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {selectedMvp
                  ? `Active MVP Target: "${selectedMvp.title}"`
                  : 'Vote on proposals and select a winning MVP to unlock synthesis'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {selectedMvp ? (
              <Link to={`/workspaces/${orgId}/ideas/${selectedMvp.ideaId}/blueprint`}>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Sparkles className="h-4 w-4" />}
                  className="text-xs font-bold bg-primary-600 hover:bg-primary-700 text-white shadow-sm shadow-primary-500/20"
                >
                  {bp?.status === 'completed' ? 'Open Blueprint Specification' : 'Synthesize Blueprint'}
                </Button>
              </Link>
            ) : (
              <Link to={`/workspaces/${orgId}/ideas`}>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Trophy className="h-4 w-4 text-amber-500" />}
                  className="text-xs font-bold border-slate-300"
                >
                  Select MVP Candidate
                </Button>
              </Link>
            )}

            <Link to={`/workspaces/${orgId}/tasks`}>
              <Button
                variant="secondary"
                size="sm"
                icon={<CheckSquare className="h-4 w-4 text-primary-600" />}
                className="text-xs font-bold border-slate-300"
              >
                Sprint Tasks
              </Button>
            </Link>
          </div>
        </div>

        {/* Blueprint State Content */}
        {bp?.status === 'completed' ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-white border border-slate-200/80">
            <div className="space-y-1">
              <span className="text-[10px] font-mono font-bold uppercase text-slate-400">
                Specification Version
              </span>
              <p className="text-base font-black text-slate-900 font-mono">v{bp.version}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-mono font-bold uppercase text-slate-400">
                Actionable Tasks
              </span>
              <p className="text-base font-black text-primary-600 font-mono">{bp.taskCount} Total</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-mono font-bold uppercase text-slate-400">
                Execution Waves
              </span>
              <p className="text-base font-black text-emerald-600 font-mono">{bp.wavesCount} Waves</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-mono font-bold uppercase text-slate-400">
                Critical Path
              </span>
              <p className="text-base font-black text-primary-600 font-mono">
                {bp.criticalPathLength} Tasks
              </p>
            </div>
          </div>
        ) : bp?.status === 'generating' ? (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-primary-50/80 border border-primary-200 text-primary-900">
            <Loader2 className="h-5 w-5 animate-spin text-primary-600 shrink-0" />
            <div className="space-y-0.5">
              <p className="text-xs font-bold">
                AI Synthesis in progress ({bp.generationStage || 'Synthesizing'})
              </p>
              <p className="text-[11px] opacity-80">
                Gemini is generating the canonical architecture, dependencies, execution waves, and sprint tasks.
              </p>
            </div>
          </div>
        ) : bp?.status === 'failed' ? (
          <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900">
            <div className="flex items-center gap-3">
              <XCircle className="h-5 w-5 text-rose-600 shrink-0" />
              <div>
                <p className="text-xs font-bold">Blueprint Generation Interrupted</p>
                <p className="text-[11px] opacity-80">{bp.lastError || 'An error occurred during synthesis.'}</p>
              </div>
            </div>
            {selectedMvp && (
              <Link to={`/workspaces/${orgId}/ideas/${selectedMvp.ideaId}/blueprint`}>
                <Button size="sm" variant="danger" className="text-xs font-bold font-mono">
                  Inspect & Retry
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-slate-100/70 border border-slate-200 text-slate-600 text-xs font-medium flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Info className="h-4 w-4 text-slate-500 shrink-0" />
              <span>
                Select a proposal as the workspace MVP to generate an AI blueprint with automated task breakdowns.
              </span>
            </div>
            <Link
              to={`/workspaces/${orgId}/ideas`}
              className="text-xs font-mono font-bold text-primary-600 hover:text-primary-800 shrink-0 inline-flex items-center gap-1"
            >
              <span>View Idea Board</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </Card>

      {/* 5. MAIN CONTENT SPLIT: PROPOSALS & DISCUSSIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT 2 COLS: RECENT PROPOSALS (IDEAS) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              <h2 className="text-base font-bold text-slate-900">Recent Proposals & MVPs</h2>
            </div>
            <Link
              to={`/workspaces/${orgId}/ideas`}
              className="text-xs font-mono font-bold text-primary-600 hover:text-primary-700 inline-flex items-center gap-1"
            >
              <span>View all ({dashboardData?.totalIdeas || 0})</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-40 rounded-2xl bg-white border border-slate-200 animate-pulse p-4 space-y-3"
                >
                  <div className="h-4 w-3/4 bg-slate-200 rounded" />
                  <div className="h-3 w-full bg-slate-200 rounded" />
                  <div className="h-3 w-5/6 bg-slate-200 rounded" />
                  <div className="h-4 w-1/3 bg-slate-200 rounded pt-4" />
                </div>
              ))}
            </div>
          ) : dashboardData?.recentIdeas && dashboardData.recentIdeas.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {dashboardData.recentIdeas.map((idea) => {
                const ideaId = idea.ideaId || idea.id;
                const isMvp = idea.isSelected === true;

                return (
                  <Card
                    key={ideaId}
                    className={cn(
                      'p-5 rounded-2xl border transition-all hover:shadow-md flex flex-col justify-between group',
                      isMvp
                        ? 'border-amber-300 bg-amber-50/20 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    )}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        {isMvp ? (
                          <Badge variant="warning" className="text-[10px] font-mono font-bold gap-1">
                            <Trophy className="h-3 w-3 text-amber-600" />
                            Winning MVP
                          </Badge>
                        ) : (
                          <Badge variant="default" className="text-[10px] font-mono capitalize">
                            {idea.category || 'Proposal'}
                          </Badge>
                        )}

                        <span className="text-[10px] font-mono text-slate-400">
                          {formatTimestamp(idea.createdAt)}
                        </span>
                      </div>

                      <Link to={`/workspaces/${orgId}/ideas/${ideaId}`}>
                        <h3 className="text-sm font-bold text-slate-900 group-hover:text-primary-600 transition-colors line-clamp-1">
                          {idea.title}
                        </h3>
                      </Link>

                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {idea.description || idea.summary || 'No description provided.'}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1 font-mono font-semibold text-slate-700">
                          <ThumbsUp className="h-3.5 w-3.5 text-primary-500" />
                          {idea.voteCount || 0}
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono text-slate-500">
                          <MessageSquare className="h-3.5 w-3.5 text-slate-400" />
                          {idea.discussionCount || idea.commentCount || 0}
                        </span>
                      </div>

                      <Link
                        to={`/workspaces/${orgId}/ideas/${ideaId}`}
                        className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-primary-600 hover:text-primary-700"
                      >
                        <span>Details</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-slate-200 bg-white text-center space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Lightbulb className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">No Proposals Yet</h3>
                <p className="text-xs text-slate-500 max-w-sm">
                  Kick off this workspace by submitting your team’s first project proposal.
                </p>
              </div>
              {!isFrozen && (
                <Button
                  size="sm"
                  variant="primary"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={handleOpenCreateModal}
                  className="text-xs font-bold"
                >
                  Submit First Idea
                </Button>
              )}
            </div>
          )}
        </div>

        {/* RIGHT 1 COL: COLLABORATION FEEDBACK (QUESTIONS & SUGGESTIONS) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary-600" />
              <h2 className="text-base font-bold text-slate-900">Collaboration Feed</h2>
            </div>
            <div className="flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveFeedbackTab('questions')}
                className={cn(
                  'px-2.5 py-1 text-[10px] font-mono font-bold rounded-md transition-all',
                  activeFeedbackTab === 'questions'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                Questions ({dashboardData?.recentQuestions?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setActiveFeedbackTab('suggestions')}
                className={cn(
                  'px-2.5 py-1 text-[10px] font-mono font-bold rounded-md transition-all',
                  activeFeedbackTab === 'suggestions'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                Suggestions ({dashboardData?.recentSuggestions?.length || 0})
              </button>
            </div>
          </div>

          <Card className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
            {activeFeedbackTab === 'questions' ? (
              dashboardData?.recentQuestions && dashboardData.recentQuestions.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {dashboardData.recentQuestions.map((q) => (
                    <div key={q.discussionId} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-800 truncate max-w-[150px]">
                          {q.authorName || 'Team Member'}
                        </span>
                        <span className="text-slate-400 font-mono text-[10px]">
                          {formatTimestamp(q.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        &ldquo;{q.message}&rdquo;
                      </p>
                      <div className="pt-0.5 flex items-center justify-between text-[10px] font-mono">
                        <Link
                          to={`/workspaces/${orgId}/ideas/${q.ideaId}`}
                          className="text-primary-600 hover:text-primary-800 truncate max-w-[180px] font-semibold"
                        >
                          on {q.ideaTitle}
                        </Link>
                        <span className="text-slate-400">
                          {q.replies?.length ? `${q.replies.length} replies` : 'Open'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-xs text-slate-400 font-medium">
                  No questions asked yet. Discussions will appear here in real time.
                </div>
              )
            ) : dashboardData?.recentSuggestions && dashboardData.recentSuggestions.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {dashboardData.recentSuggestions.map((s) => (
                  <div key={s.discussionId} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-800 truncate max-w-[150px]">
                        {s.authorName || 'Team Member'}
                      </span>
                      {s.isAccepted ? (
                        <Badge variant="success" className="text-[9px] font-mono">
                          Accepted
                        </Badge>
                      ) : (
                        <span className="text-slate-400 font-mono text-[10px]">
                          {formatTimestamp(s.createdAt)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      &ldquo;{s.message}&rdquo;
                    </p>
                    <div className="pt-0.5 flex items-center justify-between text-[10px] font-mono">
                      <Link
                        to={`/workspaces/${orgId}/ideas/${s.ideaId}`}
                        className="text-primary-600 hover:text-primary-800 truncate max-w-[180px] font-semibold"
                      >
                        on {s.ideaTitle}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-slate-400 font-medium">
                No suggestions submitted yet. Community feedback will appear here.
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* 6. QUICK COLLABORATION HUB / JUMP TARGETS */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Layers className="h-4 w-4 text-primary-600" />
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-600">
            Workspace Hub & Navigation
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Hub 1: Idea Board */}
          <Link
            to={`/workspaces/${orgId}/ideas`}
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:shadow-md hover:border-primary-200 transition-all text-center group"
          >
            <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Lightbulb className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-slate-900 group-hover:text-primary-600">
              Idea Board
            </span>
            <span className="text-[10px] text-slate-400 font-mono mt-0.5">Brainstorming</span>
          </Link>

          {/* Hub 2: Team Chat */}
          <Link
            to={`/workspaces/${orgId}/chat`}
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:shadow-md hover:border-primary-200 transition-all text-center group"
          >
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <MessageSquare className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-slate-900 group-hover:text-primary-600">
              Team Chat
            </span>
            <span className="text-[10px] text-slate-400 font-mono mt-0.5">Channels & DMs</span>
          </Link>

          {/* Hub 3: AI Blueprint */}
          <Link
            to={
              selectedMvp
                ? `/workspaces/${orgId}/ideas/${selectedMvp.ideaId}/blueprint`
                : `/workspaces/${orgId}/ideas`
            }
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:shadow-md hover:border-primary-200 transition-all text-center group"
          >
            <div className="h-10 w-10 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-slate-900 group-hover:text-primary-600">
              Blueprint
            </span>
            <span className="text-[10px] text-slate-400 font-mono mt-0.5">AI Architecture</span>
          </Link>

          {/* Hub 4: Sprint Tasks */}
          <Link
            to={`/workspaces/${orgId}/tasks`}
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:shadow-md hover:border-primary-200 transition-all text-center group"
          >
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <CheckSquare className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-slate-900 group-hover:text-primary-600">
              Sprint Tasks
            </span>
            <span className="text-[10px] text-slate-400 font-mono mt-0.5">Execution Board</span>
          </Link>

          {/* Hub 5: Team Members */}
          <Link
            to={`/workspaces/${orgId}/members`}
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:shadow-md hover:border-primary-200 transition-all text-center group"
          >
            <div className="h-10 w-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Users className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-slate-900 group-hover:text-primary-600">
              Members
            </span>
            <span className="text-[10px] text-slate-400 font-mono mt-0.5">Roster & Roles</span>
          </Link>

          {/* Hub 6: Audit Activity */}
          <Link
            to={`/workspaces/${orgId}/activity`}
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:shadow-md hover:border-primary-200 transition-all text-center group"
          >
            <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Clock className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-slate-900 group-hover:text-primary-600">
              Audit Trail
            </span>
            <span className="text-[10px] text-slate-400 font-mono mt-0.5">Event History</span>
          </Link>
        </div>
      </div>

      {/* 7. RECENT WORKSPACE ACTIVITY STREAM */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary-600" />
            <h2 className="text-base font-bold text-slate-900">Recent Workspace Activity</h2>
          </div>
          <Link
            to={`/workspaces/${orgId}/activity`}
            className="text-xs font-mono font-bold text-primary-600 hover:text-primary-700 inline-flex items-center gap-1"
          >
            <span>Full Audit Trail</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <Card className="p-5 bg-white border border-slate-200 rounded-3xl shadow-xs">
          <WorkspaceActivityFeed
            workspaceId={orgId}
            compact={true}
            maxItems={6}
            showFilters={false}
          />
        </Card>
      </div>

      {/* CREATE IDEA MODAL */}
      <CreateIdeaModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={(msg) => NotificationService.success(msg)}
      />

      {/* UNIFIED WORKSPACE SEARCH MODAL */}
      <WorkspaceSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        workspaceId={orgId}
      />
    </div>
  );
}

export default function OrgDashboardPage() {
  return (
    <ErrorBoundary>
      <IdeaProvider>
        <WorkspaceDashboardContent />
      </IdeaProvider>
    </ErrorBoundary>
  );
}
