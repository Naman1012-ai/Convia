import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePlatformSettings } from '../../hooks/usePlatformSettings';
import { publicIdeaService } from '../../services/publicIdeaService';
import { orgService } from '../../services/orgService';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { EmptyState } from '../../components/feedback/EmptyState';
import { NotificationService } from '../../services/notificationService';
import { NOTIFICATION_MESSAGES } from '../../utils/notificationMessages';
import { CreatePublicIdeaModal } from '../../features/ideas/CreatePublicIdeaModal';
import { PublicIdeaDetailModal } from '../../features/ideas/PublicIdeaDetailModal';
import { ImportToWorkspaceModal } from '../../features/ideas/ImportToWorkspaceModal';
import { PublicIdeaChatDrawer } from '../../features/chat/PublicIdeaChatDrawer';
import { formatTimestamp, truncateText } from '../../utils/formatting';
import { useUserProfiles } from '../../hooks/useUserProfile';
import {
  Globe,
  Plus,
  Search,
  MessageCircle,
  ThumbsUp,
  Sparkles,
  UserCheck,
  ArrowRight,
  FolderPlus,
  Trash2,
} from 'lucide-react';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';

export default function ExploreIdeasPage() {
  const { user } = useAuth();
  const location = useLocation();
  const { canImportIdea, canCreateIdea } = usePlatformSettings();

  // Data States
  const [publicIdeas, setPublicIdeas] = useState([]);
  const [loadingPublic, setLoadingPublic] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const ideaAuthorIds = useMemo(() => {
    return Array.from(new Set(publicIdeas.map((i) => i.authorId).filter(Boolean)));
  }, [publicIdeas]);

  const { resolveName } = useUserProfiles(ideaAuthorIds);

  // Selected Public Idea for Detail Flashcard Modal & Import Modal
  const [selectedPublicIdea, setSelectedPublicIdea] = useState(null);
  const [importingIdea, setImportingIdea] = useState(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [userWorkspaces, setUserWorkspaces] = useState([]);

  // Deletion State
  const [deletingPublicIdea, setDeletingPublicIdea] = useState(null);
  const [isDeletingPublic, setIsDeletingPublic] = useState(false);

  // Newly Published Idea Highlight Tracker
  const [newlyCreatedIdeaId, setNewlyCreatedIdeaId] = useState(null);
  const newIdeaCardRef = useRef(null);

  // Modals & Feedback
  const [isCreatePublicIdeaOpen, setIsCreatePublicIdeaOpen] = useState(false);
  const [isCommunityChatOpen, setIsCommunityChatOpen] = useState(false);
  const [communityChatContext, setCommunityChatContext] = useState(null);

  // Dismiss all transient modals & drawers on route transition
  useEffect(() => {
    setSelectedPublicIdea(null);
    setImportingIdea(null);
    setIsImportModalOpen(false);
    setDeletingPublicIdea(null);
    setIsCreatePublicIdeaOpen(false);
    setIsCommunityChatOpen(false);
    setCommunityChatContext(null);
  }, [location.pathname]);

  const handleOpenCreateModal = () => {
    const check = canCreateIdea();
    if (!check.allowed) {
      NotificationService.warning(check.reason);
      return;
    }
    setIsCreatePublicIdeaOpen(true);
  };

  const handleOpenImportModal = (idea) => {
    const check = canImportIdea();
    if (!check.allowed) {
      NotificationService.warning(check.reason);
      return;
    }
    setImportingIdea(idea);
    setIsImportModalOpen(true);
  };

  // Subscribe to Public Ideas Feed
  useEffect(() => {
    setLoadingPublic(true);
    const unsubscribe = publicIdeaService.subscribeToPublicIdeas((ideas) => {
      setPublicIdeas(ideas);
      setLoadingPublic(false);
    });
    return () => unsubscribe();
  }, []);

  const handleConfirmDeletePublic = async () => {
    if (!deletingPublicIdea) return;
    setIsDeletingPublic(true);
    try {
      await publicIdeaService.deletePublicIdea(deletingPublicIdea.ideaId);
      NotificationService.success(NOTIFICATION_MESSAGES.IDEA.DELETED);
      setDeletingPublicIdea(null);
    } catch (err) {
      NotificationService.error(err);
    } finally {
      setIsDeletingPublic(false);
    }
  };

  // Fetch active workspaces for authenticated user
  useEffect(() => {
    if (!user) return;
    let active = true;

    orgService.getUserOrganizations(user.uid).then((orgs) => {
      if (active) {
        const activeMemberOrgs = (orgs || []).filter((o) => !o.isDeleted && o.isMember);
        setUserWorkspaces(activeMemberOrgs);
      }
    }).catch((err) => {
      console.warn('[ExploreIdeasPage] Error loading user workspaces:', err);
    });

    return () => {
      active = false;
    };
  }, [user]);

  const handlePublicIdeaPublished = (newIdea) => {
    if (!newIdea) return;
    setNewlyCreatedIdeaId(newIdea.ideaId);
    NotificationService.success(NOTIFICATION_MESSAGES.IDEA.CREATED);

    setTimeout(() => {
      if (newIdeaCardRef.current) {
        newIdeaCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);

    setTimeout(() => {
      setNewlyCreatedIdeaId(null);
    }, 4000);
  };

  const filteredPublicIdeas = useMemo(() => {
    if (!searchQuery.trim()) return publicIdeas;
    const q = searchQuery.toLowerCase();
    return publicIdeas.filter(
      (idea) =>
        idea.title?.toLowerCase().includes(q) ||
        idea.problemStatement?.toLowerCase().includes(q) ||
        idea.techStack?.toLowerCase().includes(q)
    );
  }, [publicIdeas, searchQuery]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 py-8">
      {/* Header Toolbar */}
      <PageHeader
        title="Explore Public Ideas"
        subtitle="Discover, vote, and suggest technical iterations on community proposal drafts"
        action={
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              icon={<Globe className="h-4 w-4 text-emerald-600" />}
              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 shadow-xs font-semibold"
              onClick={() => {
                setCommunityChatContext(null);
                setIsCommunityChatOpen(true);
              }}
            >
              Community Channel
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
              onClick={handleOpenCreateModal}
            >
              + Post Public Proposal
            </Button>
          </div>
        }
      />

      {/* Search Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-96">
          <Input
            placeholder="Search public ideas by title, problem, or tech stack..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        </div>

        <div className="text-xs font-semibold text-slate-400 flex items-center gap-1 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
          <Globe className="h-3.5 w-3.5 text-primary-500 animate-pulse" />
          <span>Global Live Feed</span>
        </div>
      </div>

      {/* Feed Grid */}
      {loadingPublic ? (
        <LoadingSkeleton variant="card" count={3} />
      ) : filteredPublicIdeas.length === 0 ? (
        <EmptyState
          icon={<Globe className="h-8 w-8 text-primary-500" />}
          title="No Public Proposals Found"
          description="Be the first innovator to share an open proposal with the global community!"
          action={
            <Button variant="primary" onClick={handleOpenCreateModal}>
              Post Public Idea
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPublicIdeas.map((idea) => {
            const isAuthor = user && user.uid === idea.authorId;
            const isNewlyCreated = idea.ideaId === newlyCreatedIdeaId;

            return (
              <div
                key={idea.ideaId}
                ref={isNewlyCreated ? newIdeaCardRef : null}
                onClick={() => setSelectedPublicIdea(idea)}
                className={`cursor-pointer transition-all duration-500 rounded-2xl ${
                  isNewlyCreated
                    ? 'ring-4 ring-primary-500 shadow-xl shadow-primary-100 scale-[1.02]'
                    : ''
                }`}
              >
                <Card hover className="flex flex-col justify-between h-full p-6 bg-white border border-slate-200">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="info">{idea.category || 'General'}</Badge>
                        {isNewlyCreated && (
                          <Badge
                            variant="success"
                            className="bg-emerald-500 text-white animate-pulse flex items-center gap-1"
                          >
                            <Sparkles className="h-3 w-3" /> NEW
                          </Badge>
                        )}
                      </div>

                      {/* Card Header Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {user && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenImportModal(idea);
                            }}
                            className="flex items-center gap-1 text-[11px] font-bold text-primary-700 bg-primary-50 hover:bg-primary-100 px-2.5 py-1 rounded-lg transition-colors border border-primary-200/60"
                            title="Import this idea into a workspace"
                          >
                            <FolderPlus className="h-3.5 w-3.5 text-primary-600" />
                            <span>Import</span>
                          </button>
                        )}

                        {isAuthor && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingPublicIdea(idea);
                            }}
                            className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                            title="Delete Public Proposal"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 mb-2 line-clamp-2 hover:text-primary-600 transition-colors">
                      {idea.title}
                    </h3>
                    <p className="text-sm text-slate-600 mb-4 line-clamp-3 leading-relaxed">
                      {truncateText(idea.problemStatement, 180)}
                    </p>

                    {idea.techStack && (
                      <div className="flex flex-wrap gap-1 mb-4">
                        {idea.techStack
                          .split(',')
                          .map((tech) => tech.trim())
                          .filter(Boolean)
                          .slice(0, 3)
                          .map((tech, i) => (
                            <span
                              key={i}
                              className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-mono text-slate-600"
                            >
                              {tech}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar name={isAuthor ? user?.displayName || user?.email : resolveName(idea.authorId, idea.authorName)} size="sm" />
                      {isAuthor ? (
                        <span className="text-xs font-bold text-primary-700 bg-primary-50 border border-primary-200/60 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <UserCheck className="h-3 w-3 text-primary-600" /> Created by You
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-slate-800 truncate max-w-[120px]">
                          {resolveName(idea.authorId, idea.authorName || 'Anonymous Innovator')}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs font-medium text-slate-500">
                      <span className="flex items-center gap-1 font-semibold text-primary-600">
                        <ThumbsUp className="h-3.5 w-3.5" /> {idea.voteCount || 0}
                      </span>
                      <span className="flex items-center gap-1 font-bold text-primary-600 hover:underline">
                        <MessageCircle className="h-3.5 w-3.5 text-primary-500" /> Suggest
                        <ArrowRight className="h-3 w-3 ml-0.5" />
                      </span>
                    </div>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {/* Public Idea Flashcard & Suggestion Modal */}
      <PublicIdeaDetailModal
        isOpen={Boolean(selectedPublicIdea)}
        idea={selectedPublicIdea}
        onClose={() => setSelectedPublicIdea(null)}
        onToast={(msg) => NotificationService.info(msg)}
        onOpenCommunityChat={(idea) => {
          setSelectedPublicIdea(null);
          setCommunityChatContext(idea);
          setIsCommunityChatOpen(true);
        }}
      />

      {/* Direct Card Import Modal */}
      <ImportToWorkspaceModal
        isOpen={isImportModalOpen}
        idea={importingIdea}
        workspaces={userWorkspaces}
        onClose={() => {
          setIsImportModalOpen(false);
          setImportingIdea(null);
        }}
        onToast={(msg) => NotificationService.info(msg)}
      />

      {/* Public Ideas Real-Time Community Channel Drawer */}
      <PublicIdeaChatDrawer
        isOpen={isCommunityChatOpen}
        onClose={() => {
          setIsCommunityChatOpen(false);
          setCommunityChatContext(null);
        }}
        initialIdeaContext={communityChatContext}
      />

      {/* Public Idea Deletion Confirmation Modal */}
      <ConfirmDialog
        isOpen={Boolean(deletingPublicIdea)}
        title="Delete Public Idea?"
        description={`Are you sure you want to remove "${deletingPublicIdea?.title}"? This action will permanently remove this public proposal and all its votes.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={isDeletingPublic}
        onConfirm={handleConfirmDeletePublic}
        onCancel={() => setDeletingPublicIdea(null)}
      />

      {/* Modals */}
      <CreatePublicIdeaModal
        isOpen={isCreatePublicIdeaOpen}
        onClose={() => setIsCreatePublicIdeaOpen(false)}
        onSuccess={handlePublicIdeaPublished}
      />
    </div>
  );
}
