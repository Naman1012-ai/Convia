import { rtdbService } from './rtdbService';
import { ideaService } from './ideaService';
import { getErrorMessage } from '../utils/errorMessages';

/**
 * Service Layer for Global Public Ideas Feed (publicIdeas/{ideaId}).
 * Independent of organizations. Accessible to all registered users.
 */
export const publicIdeaService = {
  /**
   * Create a new public idea with verified database write.
   */
  createPublicIdea: async (author, ideaData) => {
    if (!author || !author.uid) {
      throw new Error('User authentication required to post a public idea.');
    }

    const ideaId = `pub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = Date.now();

    const newPublicIdea = {
      ideaId,
      authorId: author.uid,
      authorName: author.displayName || 'Anonymous Innovator',
      title: ideaData.title.trim(),
      problemStatement: ideaData.problemStatement.trim(),
      proposedSolution: (ideaData.proposedSolution || '').trim(),
      techStack: (ideaData.techStack || '').trim(),
      category: ideaData.category || 'General',
      organizationId: null,
      visibility: 'public',
      status: 'draft', // 'draft' | 'active'
      createdAt: timestamp,
      updatedAt: timestamp,
      voteCount: 0,
      commentCount: 0,
      isDeleted: false,
    };

    try {
      // Confirmed write to Cloud Firestore
      await rtdbService.setData(`publicIdeas/${ideaId}`, newPublicIdea);
      return newPublicIdea;
    } catch (error) {
      console.error('[publicIdeaService] createPublicIdea error:', error);
      throw new Error(getErrorMessage(error.code || 'default'));
    }
  },

  /**
   * Fetch all non-deleted public ideas once.
   */
  getPublicIdeas: async () => {
    try {
      const ideasObj = (await rtdbService.getData('publicIdeas')) || {};
      return Object.values(ideasObj).filter((idea) => idea && !idea.isDeleted);
    } catch (error) {
      console.error('[publicIdeaService] getPublicIdeas error:', error);
      return [];
    }
  },

  /**
   * Real-time subscription to global public ideas feed.
   */
  subscribeToPublicIdeas: (callback) => {
    return rtdbService.subscribe('publicIdeas', (ideasObj) => {
      if (!ideasObj) {
        callback([]);
        return;
      }
      const activeIdeas = Object.values(ideasObj).filter((idea) => idea && !idea.isDeleted);
      activeIdeas.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      callback(activeIdeas);
    });
  },

  /**
   * Update a public idea (Author only).
   */
  updatePublicIdea: async (ideaId, updates) => {
    try {
      const payload = {
        ...updates,
        updatedAt: Date.now(),
      };
      await rtdbService.updateData(`publicIdeas/${ideaId}`, payload);
    } catch (error) {
      console.error('[publicIdeaService] updatePublicIdea error:', error);
      throw new Error(getErrorMessage(error.code || 'default'));
    }
  },

  /**
   * Delete a public idea with cascade cleanup of votes & discussions AND transfer of deletionAuthority to workspaceOwner for imported copies.
   */
  deletePublicIdea: async (ideaId) => {
    try {
      await rtdbService.updateData(`publicIdeas/${ideaId}`, {
        isDeleted: true,
        updatedAt: Date.now(),
      });
      // Cascade cleanup associated votes & discussions
      await Promise.all([
        rtdbService.removeData(`votes/${ideaId}`).catch(() => {}),
        rtdbService.removeData(`discussions/public/${ideaId}`).catch(() => {}),
        ideaService.transferDeletionAuthorityForImportedIdeas(ideaId).catch(() => {}),
      ]);
    } catch (error) {
      console.error('[publicIdeaService] deletePublicIdea error:', error);
      const msg = error.code ? getErrorMessage(error.code) : (error.message || 'Unable to delete public proposal. Please try again.');
      throw new Error(msg);
    }
  },
};
