import { rtdbService } from './rtdbService';
import { getErrorMessage } from '../utils/errorMessages';
import { inAppNotificationService } from './inAppNotificationService';
import { NOTIFICATION_TYPES } from '../constants/notificationConstants';
import { activityService } from './activityService';
import { ACTIVITY_EVENT_TYPES } from '../constants/activityConstants';

/**
 * Service Layer for Idea Board Management using Firebase Realtime Database.
 * Operates on RTDB node: ideas/{orgId}/{ideaId}
 */
export const ideaService = {
  /**
   * Create a new idea in ideas/{orgId}/{ideaId}.
   */
  createIdea: async (orgId, author, ideaData) => {
    if (!orgId || !author || !author.uid) {
      throw new Error('Organization ID and Author details are required.');
    }

    // Enforce Platform Settings Validation
    const platformSettings = await rtdbService.getData('platform_settings');
    const iSettings = platformSettings?.ideas || {};

    if (iSettings.enableIdeaCreation === false) {
      throw new Error('Idea proposal creation has been disabled by the platform administrator.');
    }

    const maxIdeas = iSettings.maxIdeasPerUser ?? 10;
    const allIdeasObj = (await rtdbService.getData('ideas')) || {};
    let userIdeasCount = 0;

    Object.values(allIdeasObj).forEach((orgIdeas) => {
      if (orgIdeas && typeof orgIdeas === 'object') {
        Object.values(orgIdeas).forEach((idea) => {
          if (idea && !idea.isDeleted && (idea.authorId === author.uid || idea.createdBy === author.uid)) {
            userIdeasCount++;
          }
        });
      }
    });

    if (userIdeasCount >= maxIdeas) {
      throw new Error(`You have reached the maximum number of ideas allowed by the platform (${maxIdeas} ideas).`);
    }

    const ideaId = `idea_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = Date.now();

    const newIdea = {
      ideaId,
      orgId,
      authorId: author.uid,
      authorName: author.displayName || 'Team Member',
      title: ideaData.title.trim(),
      problemStatement: ideaData.problemStatement.trim(),
      proposedSolution: (ideaData.proposedSolution || '').trim(),
      techStack: (ideaData.techStack || '').trim(),
      difficultyLevel: ideaData.difficultyLevel || 'Medium',
      status: 'active', // 'active' | 'selected' | 'archived'
      createdAt: timestamp,
      updatedAt: timestamp,
      voteCount: 0,
      suggestionCount: 0,
      commentCount: 0,
      isSelected: false,
      isDeleted: false,
    };

    try {
      await rtdbService.setData(`ideas/${orgId}/${ideaId}`, newIdea);

      // Phase 7: Asynchronously dispatch IDEA_CREATED notification to workspace members
      inAppNotificationService.dispatchNotificationEvent(
        NOTIFICATION_TYPES.IDEA_CREATED,
        {
          workspaceId: orgId,
          ideaId,
          title: newIdea.title,
        },
        author
      ).catch((notifErr) => {
        console.warn('⚠️ [Idea Created Notification Warning]', notifErr.message);
      });

      // Phase 8: Record idea.created workspace activity event
      activityService.recordWorkspaceActivity(orgId, {
        eventType: ACTIVITY_EVENT_TYPES.IDEA_CREATED,
        actorId: author.uid,
        actorType: 'user',
        actorName: author.displayName || 'Team Member',
        actorPhotoURL: author.photoURL || null,
        resourceType: 'idea',
        resourceId: ideaId,
        resourceTitle: newIdea.title,
        summary: `${author.displayName || 'Team Member'} created proposal "${newIdea.title}"`,
      }).catch((actErr) => console.warn('⚠️ [Idea Created Activity Warning]', actErr));

      return newIdea;
    } catch (error) {
      console.error('[ideaService] createIdea error:', error);
      throw new Error(getErrorMessage(error.code || 'default'));
    }
  },

  /**
   * Fetch single idea snapshot.
   */
  getIdea: async (orgId, ideaId) => {
    return await rtdbService.getData(`ideas/${orgId}/${ideaId}`);
  },

  /**
   * Fetch all non-deleted ideas snapshot for an organization.
   */
  getIdeas: async (orgId) => {
    if (!orgId) return [];
    try {
      const ideasObj = (await rtdbService.getData(`ideas/${orgId}`)) || {};
      return Object.values(ideasObj).filter((idea) => !idea.isDeleted);
    } catch (error) {
      console.error('[ideaService] getIdeas error:', error);
      return [];
    }
  },

  /**
   * Update an existing idea (Author only during ideation phase).
   */
  updateIdea: async (orgId, ideaId, updates) => {
    try {
      const payload = {
        ...updates,
        updatedAt: Date.now(),
      };
      await rtdbService.updateData(`ideas/${orgId}/${ideaId}`, payload);
    } catch (error) {
      console.error('[ideaService] updateIdea error:', error);
      throw new Error(getErrorMessage(error.code || 'default'));
    }
  },

  /**
   * Delete an idea with optional MVP cascade cleanup.
   */
  deleteIdea: async (orgId, ideaId, isMvp = false) => {
    // Enforce Platform Settings Validation
    const platformSettings = await rtdbService.getData('platform_settings');
    if (platformSettings?.ideas?.allowIdeaDeletion === false) {
      throw new Error('Idea proposal deletion has been disabled by the platform administrator.');
    }

    try {
      // 1. Soft-delete idea node
      await rtdbService.updateData(`ideas/${orgId}/${ideaId}`, {
        isDeleted: true,
        updatedAt: Date.now(),
      });

      // 2. Cascade cleanup votes & discussions
      await Promise.all([
        rtdbService.removeData(`votes/${ideaId}`).catch(() => {}),
        rtdbService.removeData(`discussions/${orgId}/${ideaId}`).catch(() => {}),
      ]);

      // 3. If idea is the selected MVP, clear workspace MVP references, blueprint, and tasks
      if (isMvp) {
        const timestamp = Date.now();
        await Promise.all([
          rtdbService.updateData(`organizations/${orgId}`, {
            activeProjectId: null,
            status: 'ideation',
            updatedAt: timestamp,
          }).catch(() => {}),
          rtdbService.updateData(`workspaces/${orgId}/metadata`, {
            selectedIdeaId: null,
            status: 'active',
            updatedAt: timestamp,
          }).catch(() => {}),
          rtdbService.removeData(`blueprints/${orgId}`).catch(() => {}),
          rtdbService.removeData(`tasks/${orgId}`).catch(() => {}),
        ]);
      }
    } catch (error) {
      console.error('[ideaService] deleteIdea error:', error);
      const msg = error.code ? getErrorMessage(error.code) : (error.message || 'Unable to delete idea. Please try again.');
      throw new Error(msg);
    }
  },

  /**
   * Real-time subscription to active ideas in an organization.
   * Excludes soft-deleted items.
   */
  subscribeToIdeas: (orgId, callback) => {
    if (!orgId) {
      callback([]);
      return () => {};
    }

    return rtdbService.subscribe(`ideas/${orgId}`, (ideasObj) => {
      if (!ideasObj) {
        callback([]);
        return;
      }

      const activeIdeas = Object.values(ideasObj).filter((idea) => idea && !idea.isDeleted);
      callback(activeIdeas);
    });
  },

  /**
   * Real-time subscription to a single idea node.
   */
  subscribeToIdea: (orgId, ideaId, callback) => {
    if (!orgId || !ideaId) {
      callback(null);
      return () => {};
    }

    return rtdbService.subscribe(`ideas/${orgId}/${ideaId}`, (ideaData) => {
      if (!ideaData || ideaData.isDeleted) {
        callback(null);
      } else {
        callback(ideaData);
      }
    });
  },

  /**
   * Update Project Status workflow for a workspace idea with strict Single-MVP Enforcement.
   * Supported statuses: 'Ideation' | 'Voting' | 'Selected MVP' | 'Project' | 'Completed' | 'Archived'
   */
  updateIdeaStatus: async (orgId, ideaId, newStatus) => {
    if (!orgId || !ideaId || !newStatus) {
      throw new Error('Workspace ID, Idea ID, and status are required.');
    }

    // 1. Fetch current workspace proposals to enforce Single-MVP Rule
    const allIdeasObj = (await rtdbService.getData(`ideas/${orgId}`)) || {};
    const workspaceIdeas = Object.values(allIdeasObj).filter(
      (i) => i && !i.isDeleted
    );

    const targetIdea = workspaceIdeas.find((i) => i.ideaId === ideaId);
    if (!targetIdea) {
      throw new Error('Target proposal not found.');
    }

    // 2. Single-MVP Rule Enforcement
    if (newStatus === 'Selected MVP') {
      const existingMvp = workspaceIdeas.find(
        (i) =>
          i.ideaId !== ideaId &&
          (i.isSelected || i.projectStatus === 'Selected MVP')
      );

      if (existingMvp) {
        const err = new Error(
          '⚠ One idea has already been selected as the Workspace MVP. Please remove or change the status of the current MVP before selecting another idea.'
        );
        err.code = 'MVP_ALREADY_EXISTS';
        throw err;
      }
    }

    const timestamp = Date.now();
    const updates = {
      projectStatus: newStatus,
      updatedAt: timestamp,
    };

    // Synchronize isSelected property
    if (newStatus === 'Selected MVP' || newStatus === 'Project') {
      updates.isSelected = true;
    } else {
      updates.isSelected = false;
    }

    // If transition back to Ideation, unlock ideation while preserving blueprint/tasks
    if (newStatus === 'Ideation') {
      updates.isUnlockedForBrainstorm = true;
    }

    // Atomic update write
    await rtdbService.updateData(`ideas/${orgId}/${ideaId}`, updates);

    // 3. Synchronize Workspace Metadata
    if (newStatus === 'Selected MVP' || newStatus === 'Project') {
      await Promise.all([
        rtdbService.updateData(`organizations/${orgId}`, {
          activeProjectId: ideaId,
          status: newStatus === 'Project' ? 'project' : 'ideation',
          updatedAt: timestamp,
        }).catch(() => {}),
        rtdbService.updateData(`workspaces/${orgId}/metadata`, {
          selectedIdeaId: ideaId,
          status: newStatus === 'Project' ? 'project' : 'ideation',
          updatedAt: timestamp,
        }).catch(() => {}),
      ]);

      // Phase 8: Record idea.selected_as_mvp workspace activity event
      activityService.recordWorkspaceActivity(orgId, {
        eventType: ACTIVITY_EVENT_TYPES.IDEA_SELECTED_AS_MVP,
        actorId: targetIdea.authorId || 'member',
        actorType: 'user',
        actorName: targetIdea.authorName || 'Team Member',
        resourceType: 'idea',
        resourceId: ideaId,
        resourceTitle: targetIdea.title,
        summary: `Proposal "${targetIdea.title}" was selected as the active Workspace MVP`,
      }).catch((actErr) => console.warn('⚠️ [Idea Selected MVP Activity Warning]', actErr));
    } else if (targetIdea.isSelected) {
      // Clear active project metadata if demoting the current MVP
      await Promise.all([
        rtdbService.updateData(`organizations/${orgId}`, {
          activeProjectId: null,
          status: 'ideation',
          updatedAt: timestamp,
        }).catch(() => {}),
        rtdbService.updateData(`workspaces/${orgId}/metadata`, {
          selectedIdeaId: null,
          status: 'ideation',
          updatedAt: timestamp,
        }).catch(() => {}),
      ]);
    }

    return updates;
  },

  /**
   * Automatically transfer deletion authority to 'workspaceOwner' for all workspace copies when public idea is deleted.
   */
  transferDeletionAuthorityForImportedIdeas: async (publicIdeaId) => {
    if (!publicIdeaId) return;

    try {
      const allIdeasObj = (await rtdbService.getData('ideas')) || {};
      const updates = {};

      for (const [orgId, orgIdeasObj] of Object.entries(allIdeasObj)) {
        if (!orgIdeasObj) continue;
        for (const [ideaId, idea] of Object.entries(orgIdeasObj)) {
          if (!idea) continue;
          if (idea.importedFromPublicId === publicIdeaId || idea.origin?.publicIdeaId === publicIdeaId) {
            updates[`ideas/${orgId}/${ideaId}/permissions/deletionAuthority`] = 'workspaceOwner';
            updates[`ideas/${orgId}/${ideaId}/updatedAt`] = Date.now();
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        await rtdbService.updateData('', updates);
      }
    } catch (error) {
      console.warn('[ideaService] transferDeletionAuthorityForImportedIdeas error:', error);
    }
  },

  /**
   * Import Public Idea into Workspace (Read-Copy Loop with Independent Origin & Deletion Authority).
   */
  importPublicIdeaToWorkspace: async (workspaceId, memberUser, publicIdeaId) => {
    if (!workspaceId || !memberUser || !publicIdeaId) {
      throw new Error('Workspace ID, User context, and Public Idea ID are required.');
    }

    // Enforce Platform Settings Validation
    const platformSettings = await rtdbService.getData('platform_settings');
    const iSettings = platformSettings?.ideas || {};
    const fFlags = platformSettings?.featureFlags || {};

    if (iSettings.enableIdeaImport === false || fFlags.ideaImport === false) {
      throw new Error('Idea Import has been disabled by the platform administrator.');
    }

    // 1. Fetch public idea node
    const publicIdea = await rtdbService.getData(`publicIdeas/${publicIdeaId}`);
    if (!publicIdea || publicIdea.isDeleted) {
      throw new Error('Target public idea does not exist or has been removed.');
    }

    const newIdeaId = `idea_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = Date.now();

    const importedWorkspaceIdea = {
      ideaId: newIdeaId,
      orgId: workspaceId,
      authorId: memberUser.uid,
      authorName: memberUser.displayName || publicIdea.authorName || 'Team Member',
      title: publicIdea.title.trim(),
      description: (publicIdea.description || publicIdea.problemStatement || '').trim(),
      problemStatement: (publicIdea.problemStatement || '').trim(),
      proposedSolution: (publicIdea.proposedSolution || '').trim(),
      techStack: (publicIdea.techStack || '').trim(),
      category: publicIdea.category || 'General',
      visibility: 'private',
      status: 'active',
      projectStatus: 'Ideation',
      createdBy: memberUser.uid,
      createdAt: timestamp,
      updatedAt: timestamp,
      voteCount: 0,
      discussionCount: 0,
      suggestionCount: 0,
      commentCount: 0,
      isSelected: false,
      isDeleted: false,
      
      // Structured Attribution & Independence Specs
      origin: {
        type: 'imported',
        publicIdeaId: publicIdeaId,
        originalAuthorId: publicIdea.authorId || publicIdea.createdBy || null,
        originalAuthorName: publicIdea.authorName || 'Original Innovator',
        originalCreatedAt: publicIdea.createdAt || timestamp,
        importedAt: timestamp,
        importedBy: memberUser.uid,
      },
      permissions: {
        deletionAuthority: 'originalOwner', // 'originalOwner' | 'workspaceOwner'
      },
      originalAuthorId: publicIdea.authorId || publicIdea.createdBy || null,
      originalAuthorName: publicIdea.authorName || 'Original Innovator',
      originalCreatedAt: publicIdea.createdAt || null,
      importedFromPublicId: publicIdeaId,
      importedAt: timestamp,
    };

    try {
      await rtdbService.setData(`ideas/${workspaceId}/${newIdeaId}`, importedWorkspaceIdea);
      return importedWorkspaceIdea;
    } catch (error) {
      console.error('[ideaService] importPublicIdeaToWorkspace error:', error);
      throw new Error(getErrorMessage(error.code || 'default'));
    }
  },
};
