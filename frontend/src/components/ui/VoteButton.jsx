import React from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../../hooks/useAuth';
import { useProposalVote } from '../../hooks/useProposalVote';
import { ThumbsUp } from 'lucide-react';

export function VoteButton({ ideaId, isPublic = false, orgId = null, initialCount = 0, size = 'md' }) {
  const { user } = useAuth();

  const {
    hasVoted,
    voteCount,
    isVoting,
    toggleVote: handleVoteToggle,
  } = useProposalVote(ideaId, {
    orgId,
    isPublic,
    externalVoteCount: initialCount,
  });

  const isSmall = size === 'sm';

  return (
    <button
      onClick={handleVoteToggle}
      disabled={isVoting || !user}
      className={`flex items-center gap-1.5 rounded-full font-bold transition-all ${
        isSmall ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm'
      } ${
        hasVoted
          ? 'bg-primary-600 text-white shadow-md shadow-primary-200/50 scale-105'
          : 'bg-primary-50 text-primary-800 hover:bg-primary-100 border border-primary-200/60'
      }`}
    >
      <ThumbsUp className={`${isSmall ? 'h-3.5 w-3.5' : 'h-4 w-4'} ${hasVoted ? 'fill-current' : ''}`} />
      <span>{hasVoted ? `Voted (${voteCount})` : `${voteCount} Votes`}</span>
    </button>
  );
}

VoteButton.propTypes = {
  ideaId: PropTypes.string.isRequired,
  isPublic: PropTypes.bool,
  orgId: PropTypes.string,
  initialCount: PropTypes.number,
  size: PropTypes.oneOf(['sm', 'md']),
};
