import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../../hooks/useAuth';
import { useProposalVote } from '../../hooks/useProposalVote';
import { orgService } from '../../services/orgService';
import { publicIdeaService } from '../../services/publicIdeaService';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { DiscussionPanel } from '../discussions/DiscussionPanel';
import { ImportToWorkspaceModal } from './ImportToWorkspaceModal';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { formatTimestamp } from '../../utils/formatting';
import { safeText } from '../../utils/safeRender';
import { Globe, ThumbsUp, UserCheck, FolderPlus, Trash2 } from 'lucide-react';
import { useUserProfile } from '../../hooks/useUserProfile';

export function PublicIdeaDetailModal({
  isOpen,
  idea,
  onClose,
  onToast = () => {},
  onOpenCommunityChat = null,
}) {
  const { user } = useAuth();

  const { displayName: authorDisplayName } = useUserProfile(idea?.authorId, {
    fallbackName: idea?.authorName || 'Anonymous Innovator',
  });

  // User Workspaces lookup for Import workflow
  const [userWorkspaces, setUserWorkspaces] = useState([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Deletion State
  const [isDeletingConfirmOpen, setIsDeletingConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // High-Performance Optimistic Voting with Real-Time Synchronization
  const {
    hasVoted,
    voteCount,
    isVoting,
    toggleVote: handleVoteToggle,
  } = useProposalVote(idea?.ideaId, {
    isPublic: true,
    orgId: null,
    externalVoteCount: idea?.voteCount || 0,
    onFeedback: onToast,
  });

  // Clean up nested modal states whenever parent modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsImportModalOpen(false);
      setIsDeletingConfirmOpen(false);
    }
  }, [isOpen]);

  // Fetch active workspaces where current user holds active membership
  useEffect(() => {
    if (!user) return;
    let active = true;

    orgService
      .getUserOrganizations(user.uid)
      .then((orgs) => {
        if (active) {
          const activeMemberOrgs = (orgs || []).filter((o) => !o.isDeleted && o.isMember);
          setUserWorkspaces(activeMemberOrgs);
        }
      })
      .catch((err) => {
        console.warn('[PublicIdeaDetailModal] Error loading user workspaces:', err);
      });

    return () => {
      active = false;
    };
  }, [user]);

  const isAuthor = user && user.uid === idea?.authorId;

  const handleConfirmDelete = async () => {
    if (!idea || isDeleting) return;
    setIsDeleting(true);
    try {
      await publicIdeaService.deletePublicIdea(idea.ideaId);
      onToast('✓ Idea deleted successfully.');
      setIsDeletingConfirmOpen(false);
      onClose();
    } catch (err) {
      onToast(err.message || 'Unable to delete idea. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen || !idea) return null;

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Public Proposal Flashcard" size="xl">
        <div className="space-y-6">
          {/* Header Metadata & Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-200">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Badge variant="info">{idea.category || 'General'}</Badge>
                <Badge variant="default" className="flex items-center gap-1">
                  <Globe className="h-3 w-3 text-indigo-500" /> Public Brainstorm
                </Badge>
              </div>

              <h1 className="text-2xl font-extrabold text-slate-900 mb-2">{idea.title}</h1>

              <div className="flex items-center gap-2.5">
                <Avatar name={isAuthor ? user.displayName || user.email : authorDisplayName} size="sm" />
                {isAuthor ? (
                  <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <UserCheck className="h-3 w-3 text-indigo-600" /> Created by You
                  </span>
                ) : (
                  <span className="text-sm font-semibold text-slate-800">{authorDisplayName}</span>
                )}
                <span className="text-xs text-slate-400">· {formatTimestamp(idea.createdAt)}</span>
              </div>
            </div>

            {/* Action Buttons (Import to Workspace, Vote, and Delete for Author) */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0 sm:self-start">
              <Button
                variant="secondary"
                size="md"
                icon={<FolderPlus className="h-4 w-4 text-indigo-600" />}
                onClick={() => setIsImportModalOpen(true)}
                disabled={userWorkspaces.length === 0}
                title={
                  userWorkspaces.length === 0
                    ? 'You must create or join a workspace before importing ideas.'
                    : 'Import this public idea into one of your workspaces'
                }
                className="border-slate-300 text-slate-700 bg-white hover:bg-slate-50 font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Import to Workspace
              </Button>

              <Button
                variant={hasVoted ? 'primary' : 'secondary'}
                size="md"
                icon={<ThumbsUp className={`h-4 w-4 ${hasVoted ? 'fill-current' : ''}`} />}
                isLoading={isVoting}
                onClick={handleVoteToggle}
                className="shrink-0 font-semibold"
              >
                {hasVoted ? `👍 Voted (${voteCount})` : `Vote Proposal (${voteCount})`}
              </Button>

              {isAuthor && (
                <Button
                  variant="danger"
                  size="md"
                  icon={<Trash2 className="h-4 w-4" />}
                  onClick={() => setIsDeletingConfirmOpen(true)}
                  className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold"
                  title="Delete Public Proposal"
                >
                  Delete
                </Button>
              )}
            </div>
          </div>

          {/* Idea Full Response Flashcard Specs */}
          <div className="space-y-6 bg-slate-50 p-6 rounded-2xl border border-slate-200">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                📌 Problem Statement
              </h2>
              <p className="text-base text-slate-800 leading-relaxed whitespace-pre-wrap font-medium">
                {safeText(idea.problemStatement)}
              </p>
            </div>

            {idea.proposedSolution && (
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  💡 Proposed Technical Solution
                </h2>
                <p className="text-base text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {safeText(idea.proposedSolution)}
                </p>
              </div>
            )}

            {idea.techStack && (
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  🛠️ Tech Stack & Technologies
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {(typeof idea.techStack === 'string'
                    ? idea.techStack.split(',').map((tech) => tech.trim()).filter(Boolean)
                    : Array.isArray(idea.techStack)
                    ? idea.techStack
                    : Object.values(idea.techStack).flat()
                  ).map((tech, i) => (
                    <span
                      key={i}
                      className="rounded-md bg-white border border-slate-200 px-3 py-1 text-xs font-mono font-bold text-slate-700 shadow-sm"
                    >
                      {safeText(tech)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Interactive Discussion & Suggestion Section */}
          <div className="pt-4 border-t border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                💡 Suggestions & Community Feedback
              </h2>
              {onOpenCommunityChat && (
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Globe className="h-4 w-4 text-emerald-600" />}
                  className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-xs font-semibold"
                  onClick={() => onOpenCommunityChat(idea)}
                >
                  Join Live Discussion Channel
                </Button>
              )}
            </div>
            <DiscussionPanel idea={idea} onToast={onToast} />
          </div>
        </div>
      </Modal>

      {/* Interactive Overlay: Import to Workspace Modal */}
      <ImportToWorkspaceModal
        isOpen={isImportModalOpen}
        idea={idea}
        workspaces={userWorkspaces}
        onClose={() => setIsImportModalOpen(false)}
        onToast={onToast}
      />

      {/* Confirmation Dialog for Deleting Public Proposal */}
      <ConfirmDialog
        isOpen={isDeletingConfirmOpen}
        title="Delete Public Idea?"
        description={`Are you sure you want to delete "${idea.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsDeletingConfirmOpen(false)}
      />
    </>
  );
}

PublicIdeaDetailModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  idea: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onToast: PropTypes.func,
  onOpenCommunityChat: PropTypes.func,
};
