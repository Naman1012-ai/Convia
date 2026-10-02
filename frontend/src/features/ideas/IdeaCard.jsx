import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useOrg } from '../../hooks/useOrg';
import { useUserProfile } from '../../hooks/useUserProfile';
import { useProposalVote } from '../../hooks/useProposalVote';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { formatTimestamp, truncateText } from '../../utils/formatting';
import { safeText } from '../../utils/safeRender';
import {
  MessageCircle,
  Lightbulb,
  ThumbsUp,
  Pencil,
  Trash2,
  HelpCircle,
  ArrowRight,
  Trophy,
  Globe,
} from 'lucide-react';

export function IdeaCard({ idea, onEdit = null, onDelete = null, onSelectMvp = null }) {
  const { orgId } = useParams();
  const { user } = useAuth();
  const { isLeader, isFrozen } = useOrg();

  const isAuthor = user && user.uid === idea.authorId;
  const canEdit = isAuthor && !isFrozen;

  // Real-time author profile resolution from canonical users/{uid}
  const { displayName: authorDisplayName } = useUserProfile(idea.authorId, {
    fallbackName: idea.authorName || 'Team Member',
  });
  const canDelete = (isAuthor || isLeader) && !isFrozen;
  const canSelectMvp = isLeader && !isFrozen && !idea.isSelected && Boolean(onSelectMvp);

  // High-Performance Optimistic Voting with Real-Time Synchronization
  const {
    hasVoted,
    voteCount,
    isVoting,
    toggleVote: handleVoteToggle,
  } = useProposalVote(idea.ideaId, {
    orgId: idea.orgId || orgId || null,
    isPublic: !idea.orgId,
    externalVoteCount: idea.voteCount || 0,
  });

  const difficultyVariants = {
    Easy: 'success',
    Medium: 'info',
    Hard: 'warning',
  };

  const targetDetailPath = idea.orgId || orgId
    ? `/workspaces/${idea.orgId || orgId}/ideas/${idea.ideaId}`
    : `/dashboard?tab=public`;

  return (
    <Card hover className="flex flex-col justify-between h-full p-6">
      <div>
        {/* Header Badges & Actions */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={difficultyVariants[idea.difficultyLevel] || 'default'}>
              {idea.difficultyLevel || 'Medium'}
            </Badge>
            {(idea.importedFromPublicId || idea.origin?.publicIdeaId) && (
              <Badge variant="info" className="bg-primary-50 text-primary-700 border border-primary-200/60 text-[10px] flex items-center gap-1 font-semibold">
                <Globe className="h-3 w-3 text-primary-500" /> Imported Public Idea
              </Badge>
            )}
            {idea.isSelected && (
              <Badge variant="success" className="bg-emerald-600 text-white font-bold">
                🏆 Winning MVP
              </Badge>
            )}
            {idea.status === 'archived' && (
              <Badge variant="default" className="bg-slate-200 text-slate-600">
                Archived
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1">
            {canSelectMvp && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  onSelectMvp(idea);
                }}
                className="rounded px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors shadow-sm flex items-center gap-1"
                title="Select as Winning MVP"
              >
                <Trophy className="h-3.5 w-3.5" /> Select MVP
              </button>
            )}

            {!isFrozen && (canEdit || canDelete) && (
              <>
                {canEdit && onEdit && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      onEdit(idea);
                    }}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                    title="Edit Idea"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
                {canDelete && onDelete && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      onDelete(idea);
                    }}
                    className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                    title="Delete Idea"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Title & Excerpt Link */}
        <Link to={targetDetailPath}>
          <h3 className="text-lg font-bold text-slate-900 mb-2 hover:text-primary-600 transition-colors line-clamp-2">
            {safeText(idea.title)}
          </h3>
          <p className="text-sm text-slate-600 mb-4 line-clamp-3 leading-relaxed">
            {truncateText(safeText(idea.problemStatement), 180)}
          </p>
        </Link>

        {/* Tech Stack Tags */}
        {idea.techStack && (
          <div className="flex flex-wrap gap-1 mb-4">
            {(typeof idea.techStack === 'string'
              ? idea.techStack.split(',').map((tech) => tech.trim()).filter(Boolean)
              : Array.isArray(idea.techStack)
              ? idea.techStack
              : Object.values(idea.techStack).flat()
            )
              .slice(0, 3)
              .map((tech, i) => (
                <span key={i} className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-mono text-slate-600">
                  {safeText(tech)}
                </span>
              ))}
          </div>
        )}
      </div>

      {/* Author & Interactive Metrics Footer */}
      <div className="pt-4 border-t border-slate-100 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar name={isAuthor ? 'You' : authorDisplayName} size="sm" />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-slate-800 leading-none">
                {isAuthor ? 'Created by You' : authorDisplayName}
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5">
                {formatTimestamp(idea.createdAt)}
              </span>
            </div>
          </div>

          {/* Interactive Vote Toggle Button */}
          <button
            onClick={handleVoteToggle}
            disabled={isVoting}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              hasVoted
                ? 'bg-primary-600 text-white shadow-md shadow-primary-200/50 scale-105'
                : 'bg-primary-50 text-primary-800 hover:bg-primary-100 border border-primary-200/60'
            }`}
          >
            <ThumbsUp className={`h-3.5 w-3.5 ${hasVoted ? 'fill-current' : ''}`} />
            <span>{voteCount} Votes</span>
          </button>
        </div>

        {/* Type Counters Bar */}
        <div className="flex items-center justify-between pt-2 text-xs font-medium text-slate-500 border-t border-slate-50">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1" title="Comments">
              <MessageCircle className="h-3.5 w-3.5 text-slate-400" /> {idea.commentCount || 0}
            </span>
            <span className="flex items-center gap-1" title="Suggestions">
              <Lightbulb className="h-3.5 w-3.5 text-amber-500" /> {idea.suggestionCount || 0}
            </span>
            <span className="flex items-center gap-1" title="Questions">
              <HelpCircle className="h-3.5 w-3.5 text-primary-500" /> {idea.questionCount || 0}
            </span>
          </div>

          <Link
            to={targetDetailPath}
            className="inline-flex items-center gap-1 text-xs font-bold text-primary-600 hover:text-primary-800 transition-colors"
          >
            <span>View Details</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </Card>
  );
}

IdeaCard.propTypes = {
  idea: PropTypes.shape({
    ideaId: PropTypes.string.isRequired,
    orgId: PropTypes.string,
    authorId: PropTypes.string.isRequired,
    authorName: PropTypes.string,
    title: PropTypes.string.isRequired,
    problemStatement: PropTypes.string.isRequired,
    proposedSolution: PropTypes.string,
    techStack: PropTypes.string,
    difficultyLevel: PropTypes.string,
    createdAt: PropTypes.number,
    voteCount: PropTypes.number,
    commentCount: PropTypes.number,
    suggestionCount: PropTypes.number,
    questionCount: PropTypes.number,
    isSelected: PropTypes.bool,
    status: PropTypes.string,
  }).isRequired,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  onSelectMvp: PropTypes.func,
};
