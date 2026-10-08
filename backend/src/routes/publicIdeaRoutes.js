import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { rtdbService } from '../services/rtdbService.js';

export const publicIdeaRouter = Router();

/**
 * POST /api/public-ideas/:ideaId/vote
 * Toggles a user's vote on a public idea and authoritatively updates aggregate voteCount.
 */
publicIdeaRouter.post('/:ideaId/vote', requireAuth, async (req, res) => {
  try {
    const { ideaId } = req.params;
    const uid = req.user.uid;

    if (!ideaId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_IDEA_ID', message: 'Idea ID is required.' },
      });
    }

    const publicIdea = await rtdbService.getData(`publicIdeas/${ideaId}`);
    if (!publicIdea || publicIdea.isDeleted) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Public idea not found.' },
      });
    }

    const voteKey = `${ideaId}_${uid}`;
    const existingVote = await rtdbService.getData(`votes/${voteKey}`);
    const willVote = !existingVote;
    const timestamp = Date.now();

    if (willVote) {
      await rtdbService.setData(`votes/${voteKey}`, {
        voteId: voteKey,
        ideaId,
        uid,
        orgId: null,
        voteValue: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    } else {
      await rtdbService.removeData(`votes/${voteKey}`);
    }

    // Authoritative calculation of aggregate voteCount
    const allVotes = (await rtdbService.getData('votes')) || {};
    let tally = 0;
    for (const [, v] of Object.entries(allVotes)) {
      if (v && v.ideaId === ideaId) {
        tally += (v.voteValue || 1);
      }
    }
    const finalVoteCount = Math.max(0, tally);

    await rtdbService.updateData(`publicIdeas/${ideaId}`, {
      voteCount: finalVoteCount,
      updatedAt: timestamp,
    });

    return res.json({
      success: true,
      data: {
        voted: willVote,
        voteCount: finalVoteCount,
      },
      message: willVote ? 'Vote cast successfully.' : 'Vote removed successfully.',
    });
  } catch (error) {
    console.error('🚨 [publicIdeaRoutes] POST vote error:', error.message);
    return res.status(500).json({
      success: false,
      error: { code: 'VOTE_ERROR', message: 'Failed to record vote on public idea.' },
    });
  }
});

/**
 * POST /api/public-ideas/:ideaId/sync-counters
 * Authoritatively recalculates and syncs aggregate voteCount and commentCount.
 */
publicIdeaRouter.post('/:ideaId/sync-counters', requireAuth, async (req, res) => {
  try {
    const { ideaId } = req.params;

    if (!ideaId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_IDEA_ID', message: 'Idea ID is required.' },
      });
    }

    const publicIdea = await rtdbService.getData(`publicIdeas/${ideaId}`);
    if (!publicIdea || publicIdea.isDeleted) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Public idea not found.' },
      });
    }

    // 1. Tally votes
    const allVotes = (await rtdbService.getData('votes')) || {};
    let voteTally = 0;
    for (const [, v] of Object.entries(allVotes)) {
      if (v && v.ideaId === ideaId) {
        voteTally += (v.voteValue || 1);
      }
    }
    const finalVoteCount = Math.max(0, voteTally);

    // 2. Tally discussions
    const discussions = (await rtdbService.getData(`discussions/public/${ideaId}`)) || {};
    let commentCount = 0;
    let suggestionCount = 0;
    let questionCount = 0;
    let acceptedSuggestionCount = 0;

    for (const [, item] of Object.entries(discussions)) {
      if (item && !item.isDeleted) {
        if (item.type === 'suggestion') {
          suggestionCount++;
          if (item.isAccepted) acceptedSuggestionCount++;
        } else if (item.type === 'question') {
          questionCount++;
        } else {
          commentCount++;
        }
      }
    }

    const timestamp = Date.now();
    await rtdbService.updateData(`publicIdeas/${ideaId}`, {
      voteCount: finalVoteCount,
      commentCount,
      suggestionCount,
      questionCount,
      acceptedSuggestionCount,
      updatedAt: timestamp,
    });

    return res.json({
      success: true,
      data: {
        voteCount: finalVoteCount,
        commentCount,
        suggestionCount,
        questionCount,
      },
    });
  } catch (error) {
    console.error('🚨 [publicIdeaRoutes] sync-counters error:', error.message);
    return res.status(500).json({
      success: false,
      error: { code: 'SYNC_COUNTERS_ERROR', message: 'Failed to synchronize public idea counters.' },
    });
  }
});
