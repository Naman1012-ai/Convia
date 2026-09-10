/**
 * Service Layer for Authoritative Account Deletion Cascade.
 * Implements deterministic Discovery -> Planning -> Execution phases.
 * Enforces workspace ownership safety (blocks deletion if user owns active shared workspaces).
 */

import { rtdbService, getAdminAuth } from './rtdbService.js';

export const accountDeletionService = {
  /**
   * Phase 1 & 2: Discover user-owned & shared data and assemble an authoritative deletion plan.
   * Never mutates the database.
   *
   * @param {string} uid - Verified Firebase UID
   * @returns {Promise<Object>} Deletion plan containing blocking status, updates map, and summary.
   */
  buildAccountDeletionPlan: async (uid) => {
    if (!uid || typeof uid !== 'string' || !uid.trim()) {
      throw new Error('[accountDeletionService] A valid authenticated UID is required.');
    }

    const cleanUid = uid.trim();
    const rtdbUpdates = {};
    const blockingWorkspaces = [];

    // 1. DISCOVERY: Workspaces and Memberships
    const allOrgs = (await rtdbService.getData('organizations')) || {};
    const allOrgMembers = (await rtdbService.getData('organization_members')) || {};

    for (const [orgId, org] of Object.entries(allOrgs)) {
      if (!org || org.isDeleted) continue;

      const membersMap = allOrgMembers[orgId] || org.members || {};
      const memberUids = Object.keys(membersMap);
      const isOwner = org.ownerId === cleanUid;
      const isMember = memberUids.includes(cleanUid);

      if (isOwner) {
        const otherMembers = memberUids.filter((mUid) => mUid !== cleanUid);
        if (otherMembers.length > 0) {
          // SAFETY RULE: Never destroy a workspace containing other team members!
          blockingWorkspaces.push({
            orgId,
            name: org.name || 'Unnamed Workspace',
            memberCount: memberUids.length,
          });
        } else {
          // Solo owner: Purge solo workspace and all associated subtrees
          rtdbUpdates[`organizations/${orgId}`] = null;
          rtdbUpdates[`organization_members/${orgId}`] = null;
          rtdbUpdates[`ideas/${orgId}`] = null;
          rtdbUpdates[`tasks/${orgId}`] = null;
          rtdbUpdates[`blueprints/${orgId}`] = null;
          rtdbUpdates[`workspaceChats/${orgId}`] = null;
          rtdbUpdates[`discussions/${orgId}`] = null;
          rtdbUpdates[`workspace_activity/${orgId}`] = null;
          if (org.inviteCode) {
            rtdbUpdates[`invite_codes/${org.inviteCode}`] = null;
          }
        }
      } else if (isMember) {
        // Normal member: Detach membership without deleting shared team workspace
        rtdbUpdates[`organization_members/${orgId}/${cleanUid}`] = null;
        const currentCount = typeof org.memberCount === 'number' ? org.memberCount : memberUids.length;
        rtdbUpdates[`organizations/${orgId}/memberCount`] = Math.max(1, currentCount - 1);
      }
    }

    // If blocked by workspace ownership, stop planning and return blocking result immediately
    if (blockingWorkspaces.length > 0) {
      return {
        isBlocked: true,
        blockingWorkspaces,
        rtdbUpdates: {},
        summary: {
          blockingCount: blockingWorkspaces.length,
          plannedMutationCount: 0,
        },
      };
    }

    // 2. DISCOVERY: Public Ideas authored by user
    const publicIdeas = (await rtdbService.getData('publicIdeas')) || {};
    for (const [ideaId, idea] of Object.entries(publicIdeas)) {
      if (idea && (idea.authorId === cleanUid || idea.createdBy === cleanUid)) {
        rtdbUpdates[`publicIdeas/${ideaId}`] = null;
        rtdbUpdates[`discussions/public/${ideaId}`] = null;
      }
    }

    // 3. DISCOVERY: Collaborative Workspace Ideas (Anonymize rather than destroy team backlog)
    const workspaceIdeas = (await rtdbService.getData('ideas')) || {};
    for (const [orgId, orgIdeas] of Object.entries(workspaceIdeas)) {
      if (!orgIdeas || typeof orgIdeas !== 'object') continue;
      // Skip if whole workspace is already scheduled for deletion
      if (rtdbUpdates[`organizations/${orgId}`] === null) continue;

      for (const [ideaId, idea] of Object.entries(orgIdeas)) {
        if (idea && (idea.authorId === cleanUid || idea.createdBy === cleanUid)) {
          rtdbUpdates[`ideas/${orgId}/${ideaId}/authorId`] = 'deleted_user';
          rtdbUpdates[`ideas/${orgId}/${ideaId}/authorName`] = 'Deleted User';
          rtdbUpdates[`ideas/${orgId}/${ideaId}/isAuthorDeleted`] = true;
          rtdbUpdates[`ideas/${orgId}/${ideaId}/updatedAt`] = Date.now();
        }
      }
    }

    // 4. DISCOVERY: Collaborative Workspace Tasks (Unassign user rather than delete team tasks)
    const workspaceTasks = (await rtdbService.getData('tasks')) || {};
    for (const [orgId, orgTasks] of Object.entries(workspaceTasks)) {
      if (!orgTasks || typeof orgTasks !== 'object') continue;
      if (rtdbUpdates[`organizations/${orgId}`] === null) continue;

      for (const [taskId, task] of Object.entries(orgTasks)) {
        if (task && (task.assigneeId === cleanUid || task.assignedTo === cleanUid)) {
          rtdbUpdates[`tasks/${orgId}/${taskId}/assigneeId`] = null;
          rtdbUpdates[`tasks/${orgId}/${taskId}/assigneeName`] = 'Unassigned';
          rtdbUpdates[`tasks/${orgId}/${taskId}/assignedTo`] = null;
          rtdbUpdates[`tasks/${orgId}/${taskId}/updatedAt`] = Date.now();
        }
      }
    }

    // 5. DISCOVERY: Votes by user
    const votes = (await rtdbService.getData('votes')) || {};
    for (const [voteKey, vote] of Object.entries(votes)) {
      if (
        voteKey.endsWith(`_${cleanUid}`) ||
        (vote && (vote.uid === cleanUid || vote.userId === cleanUid))
      ) {
        rtdbUpdates[`votes/${voteKey}`] = null;
      }
    }

    // 6. DISCOVERY: Collaborative Discussions / Comments authored by user
    const discussions = (await rtdbService.getData('discussions')) || {};
    for (const [orgId, ideaDiscs] of Object.entries(discussions)) {
      if (!ideaDiscs || typeof ideaDiscs !== 'object') continue;
      if (rtdbUpdates[`organizations/${orgId}`] === null) continue;

      for (const [ideaId, discList] of Object.entries(ideaDiscs)) {
        if (!discList || typeof discList !== 'object') continue;
        for (const [discId, disc] of Object.entries(discList)) {
          if (disc && (disc.authorId === cleanUid || disc.uid === cleanUid)) {
            rtdbUpdates[`discussions/${orgId}/${ideaId}/${discId}`] = null;
          }
        }
      }
    }

    // 7. DISCOVERY: Direct Personal User Subtrees
    rtdbUpdates[`users/${cleanUid}`] = null;
    rtdbUpdates[`user_notifications/${cleanUid}`] = null;
    rtdbUpdates[`notifications/${cleanUid}`] = null;
    rtdbUpdates[`user_activity/${cleanUid}`] = null;
    rtdbUpdates[`user_preferences/${cleanUid}`] = null;
    rtdbUpdates[`user_announcements/${cleanUid}`] = null;
    rtdbUpdates[`user_reports/${cleanUid}`] = null;
    rtdbUpdates[`user_admin_notes/${cleanUid}`] = null;
    rtdbUpdates[`user_admin_warnings/${cleanUid}`] = null;
    rtdbUpdates[`user_settings/${cleanUid}`] = null;

    return {
      isBlocked: false,
      blockingWorkspaces: [],
      rtdbUpdates,
      summary: {
        blockingCount: 0,
        plannedMutationCount: Object.keys(rtdbUpdates).length,
      },
    };
  },

  /**
   * Phase 3: Execute the authoritative deletion plan.
   * Performs RTDB atomic multi-location update first, followed by Firebase Auth deletion.
   *
   * @param {string} uid - Verified Firebase UID
   * @returns {Promise<Object>} Execution result
   */
  executeAccountDeletion: async (uid) => {
    const plan = await accountDeletionService.buildAccountDeletionPlan(uid);

    if (plan.isBlocked) {
      return {
        success: false,
        blocked: true,
        code: 'ACCOUNT_DELETION_BLOCKED_BY_WORKSPACE_OWNERSHIP',
        message: 'Account deletion is blocked because you are the owner of one or more workspaces with active team members. Please transfer ownership or remove other members before deleting your account.',
        blockingWorkspaces: plan.blockingWorkspaces,
      };
    }

    // 1. Execute Realtime Database atomic multi-location update
    if (Object.keys(plan.rtdbUpdates).length > 0) {
      await rtdbService.updateData('', plan.rtdbUpdates);
    }

    // 2. Delete Firebase Auth User record (Executed strictly AFTER database cleanup)
    const adminAuth = getAdminAuth();
    if (adminAuth) {
      try {
        await adminAuth.deleteUser(uid);
      } catch (authErr) {
        // If Auth record is already deleted or not found, proceed safely
        if (authErr.code !== 'auth/user-not-found') {
          console.error(`🚨 [accountDeletionService] Failed to delete Firebase Auth user '${uid}':`, authErr.message);
          throw authErr;
        }
      }
    }

    return {
      success: true,
      blocked: false,
      message: 'Account and associated data deleted successfully.',
      mutationsApplied: Object.keys(plan.rtdbUpdates).length,
    };
  },
};
