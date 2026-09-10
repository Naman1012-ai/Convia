import React, { useState, useEffect } from 'react';
import { Outlet, useParams, useLocation, Link, useNavigate } from 'react-router-dom';
import { OrgProvider, OrgContext } from '../contexts/OrgContext';
import { useAuth } from '../hooks/useAuth';
import { Navbar } from '../components/layout/Navbar';
import { Sidebar } from '../components/layout/Sidebar';
import { Spinner } from '../components/feedback/Spinner';
import { ErrorMessage } from '../components/feedback/ErrorMessage';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ideaService } from '../services/ideaService';
import { ChevronRight, Lock, Search, Command } from 'lucide-react';
import { WorkspaceSearchModal } from '../components/search/WorkspaceSearchModal';

function OrgLayoutContent() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const context = React.useContext(OrgContext);
  const { org, members, isLeader, loading, error } = context;
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { orgId, ideaId } = useParams();
  const [activeIdea, setActiveIdea] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Global Ctrl+K / Cmd+K Search Command Palette Shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!orgId || !ideaId) {
      setActiveIdea(null);
      return;
    }
    let active = true;
    ideaService.getIdea(orgId, ideaId).then((data) => {
      if (active) {
        setActiveIdea(data);
      }
    });
    return () => {
      active = false;
    };
  }, [orgId, ideaId]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50 p-6">
        <ErrorMessage
          title="Organization Not Found"
          message={error || 'The requested organization does not exist or you do not have access.'}
        />
      </div>
    );
  }

  const isMember = members.some((m) => m.uid === user?.uid);
  const isAuthorized = isLeader || isMember;

  if (!isAuthorized) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-900 text-white p-6">
        <Card className="max-w-md w-full bg-slate-800/80 border border-slate-700 p-8 text-center space-y-6 backdrop-blur-md shadow-2xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <Lock className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-black tracking-tight text-white">Membership Required</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              You are not a member of <strong className="text-white">{org.name}</strong>. Access to the Idea Board, Blueprint, and Tasks is restricted to team members only.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Button
              variant="primary"
              onClick={() => navigate('/workspaces')}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
            >
              Back to Workspaces
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Parse path to determine sub-page mapping
  const currentPath = location.pathname;
  let segmentLabel = 'Workspace Dashboard';
  let segmentSubtitle = 'Unified activity overview, collaboration insights & project status';
  let isSubpage = false;

  if (currentPath.includes('/ideas') && !ideaId) {
    segmentLabel = 'Idea Board';
    segmentSubtitle = 'Propose, evaluate, and vote on hackathon project ideas';
    isSubpage = true;
  } else if (currentPath.includes('/blueprint')) {
    segmentLabel = 'Project Blueprint';
    segmentSubtitle = 'Authoritative build specification compiled from selected MVP';
    isSubpage = true;
  } else if (currentPath.includes('/tasks')) {
    segmentLabel = 'Sprint Task Board';
    segmentSubtitle = 'Decompose your Project Blueprint into actionable developer tasks & track execution';
    isSubpage = true;
  } else if (currentPath.includes('/members')) {
    segmentLabel = 'Team Members';
    segmentSubtitle = `Manage hackathon collaborators for ${org.name}`;
    isSubpage = true;
  } else if (currentPath.includes('/dashboard')) {
    segmentLabel = 'Progress Dashboard';
    segmentSubtitle = 'Real-time velocity & sprint metrics analytics';
    isSubpage = true;
  } else if (currentPath.includes('/chat')) {
    segmentLabel = 'Workspace Team Chat';
    segmentSubtitle = `Real-time channel messaging & collaboration for ${org.name}`;
    isSubpage = true;
  } else if (currentPath.includes('/activity')) {
    segmentLabel = 'Workspace Activity';
    segmentSubtitle = `Real-time audit log of all collaboration events for ${org.name}`;
    isSubpage = true;
  } else if (currentPath.includes('/settings')) {
    segmentLabel = 'Workspace Settings';
    segmentSubtitle = 'Configure workspace parameters, roles, and preferences';
    isSubpage = true;
  } else if (ideaId) {
    segmentLabel = activeIdea ? activeIdea.title : 'Proposal Details';
    segmentSubtitle = 'Detailed proposal breakdown, team discussion, and status management';
    isSubpage = true;
  }

  const workspaceRootPath = `/workspaces/${org.orgId}`;
  const isIdeaActive = Boolean(ideaId);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar onMobileMenuToggle={() => setIsMobileOpen((prev) => !prev)} />
      <div className="flex flex-1">
        <Sidebar
          status={org.status}
          isMobileOpen={isMobileOpen}
          onCloseMobile={() => setIsMobileOpen(false)}
        />
        <main className="flex-1 px-4 py-8 sm:px-8 max-w-5xl mx-auto w-full space-y-6">
          {/* Centralized Workspace Top Navigation Header */}
          <div className="border-b border-slate-200 pb-5 space-y-3">
            {/* Single Breadcrumb System */}
            <nav className="flex items-center gap-1.5 text-xs text-slate-500 font-medium flex-wrap">
              <Link to="/workspaces" className="hover:text-indigo-600 transition-colors">
                Workspaces
              </Link>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <Link to={workspaceRootPath} className="hover:text-indigo-600 transition-colors font-semibold">
                {org.name}
              </Link>
              {isIdeaActive && (
                <>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <Link to={`${workspaceRootPath}/ideas/${ideaId}`} className="hover:text-indigo-600 transition-colors truncate max-w-[160px]">
                    {activeIdea ? activeIdea.title : 'Selected Idea'}
                  </Link>
                </>
              )}
              {isSubpage && (
                <>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="text-slate-900 font-bold">{segmentLabel}</span>
                </>
              )}
            </nav>

            {/* Single Main Title Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                  {segmentLabel}
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    org.status === 'project'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    {org.status === 'project' ? '⚡ Sprint Phase' : '📝 Ideation Phase'}
                  </span>
                </h1>
                <p className="text-xs text-slate-500 mt-1 font-medium">{segmentSubtitle}</p>
              </div>

              {/* Workspace Search Trigger Button */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(true)}
                  className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:text-indigo-600 shadow-sm hover:shadow transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-label="Search workspace resources"
                >
                  <Search className="h-4 w-4 text-slate-400" />
                  <span className="hidden sm:inline">Search workspace...</span>
                  <span className="sm:hidden">Search</span>
                  <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600">
                    ⌘K
                  </kbd>
                </button>
              </div>
            </div>
          </div>

          <div>
            <Outlet />
          </div>
        </main>
      </div>

      <WorkspaceSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        workspaceId={org.orgId}
      />
    </div>
  );
}

export function OrgLayout() {
  const { orgId } = useParams();

  return (
    <OrgProvider key={orgId} orgId={orgId}>
      <OrgLayoutContent />
    </OrgProvider>
  );
}
