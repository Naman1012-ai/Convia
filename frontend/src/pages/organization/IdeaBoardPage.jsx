import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useOrg } from '../../hooks/useOrg';
import { usePlatformSettings } from '../../hooks/usePlatformSettings';
import { IdeaProvider, IdeaContext } from '../../contexts/IdeaContext';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Avatar } from '../../components/ui/Avatar';
import { NotificationService } from '../../services/notificationService';
import { IdeaList } from '../../features/ideas/IdeaList';
import { CreateIdeaModal } from '../../features/ideas/CreateIdeaModal';
import { ErrorBoundary } from '../../components/feedback/ErrorBoundary';
import { formatTimestamp } from '../../utils/formatting';
import { safeText } from '../../utils/safeRender';
import { useUserProfile } from '../../hooks/useUserProfile';
import {
  Lightbulb,
  Plus,
  Search,
  Trophy,
  ThumbsUp,
  Users,
  FileText,
  CheckSquare,
  BarChart2,
  ArrowRight,
  Filter,
  Sparkles,
  Layers,
  ChevronRight,
  Globe,
  Clock,
  Flame,
} from 'lucide-react';

function IdeaBoardContent() {
  const { org, members, isFrozen } = useOrg();
  const { canCreateIdea } = usePlatformSettings();
  const { orgId } = useParams();

  const ideaContext = React.useContext(IdeaContext);
  const {
    ideas,
    filteredIdeas,
    loading,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    activeFilter,
    setActiveFilter,
    stats,
  } = ideaContext;

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const handleOpenCreateModal = () => {
    const check = canCreateIdea();
    if (!check.allowed) {
      NotificationService.warning(check.reason);
      return;
    }
    setIsCreateModalOpen(true);
  };

  const selectedMvp = stats?.selectedMvp;
  const { displayName: mvpAuthorName } = useUserProfile(selectedMvp?.authorId, {
    fallbackName: selectedMvp?.authorName || 'Team Member',
  });

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 overflow-x-hidden">
      {/* 1. WORKSPACE DASHBOARD KPI STATS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 w-full">
        {/* Card 1: Total Proposals */}
        <Card className="p-5 bg-white border border-slate-200 shadow-xs space-y-2 rounded-2xl w-full">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">
              Total Proposals
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
              <Lightbulb className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <h3 className="text-2xl font-black text-slate-900">{stats?.totalIdeas || 0}</h3>
            <span className="text-xs font-bold text-slate-500">Submitted</span>
          </div>
        </Card>

        {/* Card 2: Community Votes */}
        <Card className="p-5 bg-white border border-slate-200 shadow-xs space-y-2 rounded-2xl w-full">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">
              Community Votes
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-50 text-primary-600 border border-primary-100">
              <ThumbsUp className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <h3 className="text-2xl font-black text-primary-600">{stats?.totalVotes || 0}</h3>
            <span className="text-xs font-bold text-slate-500">Total Cast</span>
          </div>
        </Card>

        {/* Card 3: Selected MVP Status */}
        <Card className="p-5 bg-white border border-slate-200 shadow-xs space-y-2 rounded-2xl w-full">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">
              Winning MVP
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <Trophy className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-black text-slate-900 truncate max-w-[140px]">
              {selectedMvp ? safeText(selectedMvp.title, 'Winning MVP') : 'Pending Selection'}
            </h3>
            <Badge variant={selectedMvp ? 'success' : 'default'} className="text-[9px] uppercase font-bold">
              {selectedMvp ? 'Selected' : 'Voting'}
            </Badge>
          </div>
        </Card>

        {/* Card 4: Team Roster */}
        <Card className="p-5 bg-white border border-slate-200 shadow-xs space-y-2 rounded-2xl w-full">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">
              Team Roster
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-50 text-primary-600 border border-primary-100">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <h3 className="text-2xl font-black text-slate-900">{members?.length || 1}</h3>
            <span className="text-xs font-bold text-slate-500">Members</span>
          </div>
        </Card>
      </div>

      {/* 2. FEATURED SELECTED MVP HERO BANNER */}
      {selectedMvp && (
        <Card className="bg-gradient-to-r from-slate-900 via-primary-950 to-slate-900 text-white rounded-2xl border border-primary-800/80 shadow-xl relative overflow-hidden w-full">
          <div className="absolute top-0 right-0 h-40 w-40 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 p-6 sm:p-8 rounded-2xl w-full relative z-10">
            <div className="space-y-3 max-w-2xl w-full">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="success" className="bg-amber-500 text-white font-bold flex items-center gap-1 shadow-sm">
                  <Trophy className="h-3.5 w-3.5" /> Workspace Winning MVP
                </Badge>
                <Badge variant="info" className="bg-primary-500/30 text-primary-200 border border-primary-400/30">
                  {safeText(selectedMvp.difficultyLevel, 'Medium')} Build
                </Badge>
                <span className="text-xs font-mono text-primary-300 font-bold">
                  👍 {selectedMvp.voteCount || 0} Votes
                </span>
              </div>

              <h2 className="text-2xl font-black text-white tracking-tight">{safeText(selectedMvp.title)}</h2>
              <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed font-medium">
                {safeText(selectedMvp.problemStatement)}
              </p>

              <div className="flex items-center gap-2 text-xs text-slate-400 pt-1">
                <Avatar name={mvpAuthorName} size="xs" />
                <span>Proposed by <strong className="text-white">{mvpAuthorName}</strong></span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col gap-3 w-full lg:w-auto shrink-0">
              <Link to={`/workspaces/${orgId}/ideas/${selectedMvp.ideaId}/blueprint`} className="w-full sm:w-auto">
                <Button
                  variant="primary"
                  size="sm"
                  icon={<FileText className="h-4 w-4 text-primary-200" />}
                  className="bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-md w-full justify-center"
                >
                  View Blueprint
                </Button>
              </Link>
              <Link to={`/workspaces/${orgId}/ideas/${selectedMvp.ideaId}/tasks`} className="w-full sm:w-auto">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<CheckSquare className="h-4 w-4 text-primary-300" />}
                  className="bg-primary-950/80 hover:bg-primary-900 text-primary-200 border-primary-800 font-bold text-xs w-full justify-center"
                >
                  Sprint Task Board
                </Button>
              </Link>
              <Link to={`/workspaces/${orgId}/ideas/${selectedMvp.ideaId}/dashboard`} className="w-full sm:w-auto">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<BarChart2 className="h-4 w-4 text-slate-300" />}
                  className="bg-slate-800/80 hover:bg-slate-800 text-slate-200 border-slate-700 font-bold text-xs w-full justify-center"
                >
                  Progress Metrics
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* 3. FILTER TABS & SEARCH / SORT CONTROLS BAR */}
      <div className="space-y-4 w-full">
        {/* Filter Category Tabs */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-2 w-full">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none w-full">
            {[
              { id: 'all', label: `All Proposals (${ideas.length})`, icon: Lightbulb },
              { id: 'selected', label: selectedMvp ? '🏆 Winning MVP' : '🏆 Winning MVP (0)', icon: Trophy },
              { id: 'top', label: `🔥 Top Voted (${stats?.topVotedCount || 0})`, icon: Flame },
              { id: 'mine', label: `👤 My Proposals (${stats?.myIdeasCount || 0})`, icon: Users },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" /> {tab.label}
                </button>
              );
            })}
          </div>

          <Link to="/explore" className="shrink-0">
            <Button
              variant="secondary"
              size="sm"
              icon={<Globe className="h-3.5 w-3.5 text-primary-600" />}
              className="bg-primary-50 hover:bg-primary-100 text-primary-700 border-primary-200 font-bold text-xs whitespace-nowrap"
            >
              Explore Public Feed
            </Button>
          </Link>
        </div>

        {/* Search, Sort & Create Action Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 mt-6 w-full bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="relative w-full sm:w-80">
            <Input
              placeholder="Search by title, problem, or tech stack..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs w-full"
            />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end flex-wrap sm:flex-nowrap">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0 font-mono">
              Sort By:
            </span>
            <Select
              options={[
                { value: 'most_voted', label: 'Most Voted' },
                { value: 'newest', label: 'Newest First' },
              ]}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full sm:w-40 py-1 text-xs"
            />

            {!isFrozen && (
              <Button
                variant="primary"
                size="sm"
                icon={<Plus className="h-4 w-4" />}
                onClick={handleOpenCreateModal}
                className="shrink-0 bg-primary-600 hover:bg-primary-700 text-white font-bold w-full sm:w-auto justify-center"
              >
                Propose Idea
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 4. REAL-TIME IDEA CARDS GRID */}
      <IdeaList
        onToast={(msg) => NotificationService.info(msg)}
        onCreateClick={!isFrozen ? () => setIsCreateModalOpen(true) : null}
      />

      {/* CREATE IDEA MODAL */}
      <CreateIdeaModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={(msg) => NotificationService.success(msg)}
      />
    </div>
  );
}

export default function IdeaBoardPage() {
  return (
    <ErrorBoundary>
      <IdeaProvider>
        <IdeaBoardContent />
      </IdeaProvider>
    </ErrorBoundary>
  );
}
