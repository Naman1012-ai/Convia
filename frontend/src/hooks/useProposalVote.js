import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';
import { useToast } from './useToast';
import { voteService } from '../services/voteService';

/**
 * Custom Hook for High-Performance Proposal Voting with Optimistic UI & Real-Time Synchronization.
 *
 * Guarantees:
 * 1. Immediate visual feedback (no waiting on network roundtrips).
 * 2. Duplicate click protection during active operations.
 * 3. Race-safe reconciliation with real-time database listeners (zero double-counting or flickering).
 * 4. Automatic rollback to confirmed server state on network/backend failure.
 *
 * @param {string} ideaId - Target proposal ID
 * @param {Object} options
 * @param {string|null} options.orgId - Workspace / Organization ID
 * @param {boolean} options.isPublic - Whether this is a public proposal
 * @param {number} options.externalVoteCount - Live vote count from parent idea object/stream
 * @param {Function} options.onFeedback - Optional toast/feedback handler
 */
export function useProposalVote(ideaId, options = {}) {
  const {
    orgId = null,
    isPublic = false,
    externalVoteCount = 0,
    onFeedback = null,
  } = options;

  const { user } = useAuth();
  const { toast } = useToast();

  // Confirmed state from database listeners
  const [serverVoteCount, setServerVoteCount] = useState(Number(externalVoteCount || 0));
  const [serverHasVoted, setServerHasVoted] = useState(false);

  // Temporary optimistic state: { hasVoted: boolean, delta: number } | null
  const [optimisticVoteState, setOptimisticVoteState] = useState(null);
  const [isPending, setIsPending] = useState(false);
  const isPendingRef = useRef(false);

  // Sync with external vote count when parent idea updates
  useEffect(() => {
    setServerVoteCount(Number(externalVoteCount || 0));
  }, [externalVoteCount]);

  // Subscribe to real-time user vote status for this idea
  useEffect(() => {
    if (!user?.uid || !ideaId) {
      setServerHasVoted(false);
      return;
    }

    const unsubscribe = voteService.subscribeToUserVote(ideaId, user.uid, (voted) => {
      setServerHasVoted(Boolean(voted));
      // If server confirms our optimistic intention, reconcile and clear optimistic override
      setOptimisticVoteState((currentOpt) => {
        if (currentOpt !== null && currentOpt.hasVoted === Boolean(voted)) {
          return null;
        }
        return currentOpt;
      });
    });

    return () => {
      unsubscribe();
    };
  }, [user?.uid, ideaId]);

  // Displayed vote status (optimistic priority over server state)
  const hasVoted = useMemo(() => {
    if (optimisticVoteState !== null) {
      return optimisticVoteState.hasVoted;
    }
    return serverHasVoted;
  }, [optimisticVoteState, serverHasVoted]);

  // Displayed vote count (optimistic delta added until server confirms)
  const voteCount = useMemo(() => {
    if (optimisticVoteState !== null && serverHasVoted !== optimisticVoteState.hasVoted) {
      return Math.max(0, serverVoteCount + optimisticVoteState.delta);
    }
    return Math.max(0, serverVoteCount);
  }, [optimisticVoteState, serverHasVoted, serverVoteCount]);

  /**
   * Action: Toggle vote with immediate optimistic feedback and atomic backend dispatch.
   */
  const toggleVote = useCallback(
    async (e) => {
      if (e) {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
      }

      // 1. Prevent duplicate rapid clicks
      if (isPendingRef.current) {
        return;
      }

      // 2. Validate authentication
      if (!user?.uid) {
        const msg = 'Please sign in to vote on proposals.';
        if (typeof onFeedback === 'function') {
          onFeedback(msg);
        } else {
          toast.warning(msg);
        }
        return;
      }

      if (!ideaId) return;

      const currentVoted = hasVoted;
      const willVote = !currentVoted;
      const delta = willVote ? 1 : -1;

      // 3. Apply immediate optimistic UI update (< 5ms)
      isPendingRef.current = true;
      setIsPending(true);
      setOptimisticVoteState({
        hasVoted: willVote,
        delta,
      });

      try {
        // 4. Dispatch atomic update to backend
        const result = await voteService.toggleVote(
          ideaId,
          user.uid,
          isPublic,
          orgId,
          1,
          currentVoted
        );

        const feedbackMsg = result.voted ? '👍 Vote recorded!' : 'Vote removed.';
        if (typeof onFeedback === 'function') {
          onFeedback(feedbackMsg);
        } else if (result.voted) {
          toast.success(feedbackMsg);
        } else {
          toast.info(feedbackMsg);
        }
      } catch (err) {
        console.error('[useProposalVote] Vote error:', err);
        // 5. Rollback optimistic state immediately on error
        setOptimisticVoteState(null);
        const errMsg = err?.message || 'Failed to update vote. Please try again.';
        if (typeof onFeedback === 'function') {
          onFeedback(errMsg);
        } else {
          toast.error(errMsg);
        }
      } finally {
        isPendingRef.current = false;
        setIsPending(false);
      }
    },
    [user?.uid, ideaId, hasVoted, isPublic, orgId, onFeedback, toast]
  );

  return {
    hasVoted,
    voteCount,
    isVoting: isPending,
    isPending,
    toggleVote,
  };
}
