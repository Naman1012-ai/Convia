/**
 * Authoritative Workspace Deletion and Cascade Purge Service.
 * Uses Firebase Admin SDK to cleanly purge all related nodes and subtrees
 * without encountering client-side security rule restrictions.
 */

import { rtdbService } from './rtdbService.js';

export const workspaceDeletionService = {
  /**
   * Performs an authoritative, complete cascading deletion of a workspace
   * and all of its associated child collections.
   *
   * @param {string} workspaceId - The unique ID of the workspace to purge.
   * @returns {Promise<{ success: boolean, workspaceId: string }>}
   */
  deleteWorkspaceCascade: async (workspaceId) => {
    if (!workspaceId || typeof workspaceId !== 'string' || !workspaceId.trim()) {
      throw new Error('[workspaceDeletionService] A valid workspace ID is required.');
    }

    const cleanWorkspaceId = workspaceId.trim();

    // 1. Fetch workspace and members to resolve user profile references and invite codes
    const [workspaceData, membersObj, ideasObj] = await Promise.all([
      rtdbService.getData(`organizations/${cleanWorkspaceId}`),
      rtdbService.getData(`organization_members/${cleanWorkspaceId}`),
      rtdbService.getData(`ideas/${cleanWorkspaceId}`),
    ]);

    const memberUids = membersObj && typeof membersObj === 'object' ? Object.keys(membersObj) : [];
    const ideaIds = ideasObj && typeof ideasObj === 'object' ? Object.keys(ideasObj) : [];

    // 2. Cascade delete core workspace paths in parallel
    const deletePromises = [
      rtdbService.removeData(`organizations/${cleanWorkspaceId}`),
      rtdbService.removeData(`workspaces/${cleanWorkspaceId}`),
      rtdbService.removeData(`organization_members/${cleanWorkspaceId}`),
      rtdbService.removeData(`blueprints/${cleanWorkspaceId}`),
      rtdbService.removeData(`tasks/${cleanWorkspaceId}`),
      rtdbService.removeData(`ideas/${cleanWorkspaceId}`),
      rtdbService.removeData(`discussions/${cleanWorkspaceId}`),
      rtdbService.removeData(`workspaceChats/${cleanWorkspaceId}`),
      rtdbService.removeData(`workspace_activity/${cleanWorkspaceId}`),
    ];

    // Remove invite codes associated with the workspace
    if (workspaceData?.inviteCode) {
      deletePromises.push(rtdbService.removeData(`invite_codes/${workspaceData.inviteCode}`));
    }

    await Promise.all(deletePromises);

    // 3. Clean up idea votes associated with deleted workspace ideas
    if (ideaIds.length > 0 && memberUids.length > 0) {
      const voteRemovals = [];
      for (const ideaId of ideaIds) {
        for (const uid of memberUids) {
          voteRemovals.push(rtdbService.removeData(`votes/${ideaId}_${uid}`));
        }
      }
      await Promise.allSettled(voteRemovals);
    }

    // 4. Safely reset user profile organizationId if pointing to this deleted workspace
    if (memberUids.length > 0) {
      const profileCleanups = memberUids.map(async (uid) => {
        try {
          const profile = await rtdbService.getData(`users/${uid}`);
          if (profile && profile.organizationId === cleanWorkspaceId) {
            await rtdbService.updateData(`users/${uid}`, { organizationId: null });
          }
        } catch (err) {
          console.warn(`[workspaceDeletionService] Failed to clean up user profile for ${uid}:`, err.message);
        }
      });
      await Promise.allSettled(profileCleanups);
    }

    console.log(`🗑️ [workspaceDeletionService] Cascade purged workspace: ${cleanWorkspaceId} (${workspaceData?.name || 'Unnamed'})`);
    return { success: true, workspaceId: cleanWorkspaceId };
  },

  /**
   * Scans all workspaces and purges any that have exceeded their 7-day scheduled deletion window.
   *
   * @returns {Promise<{ purgedCount: number, purgedWorkspaces: Array<string> }>}
   */
  purgeExpiredWorkspaces: async () => {
    try {
      const allOrgs = (await rtdbService.getData('organizations')) || {};
      if (!allOrgs || typeof allOrgs !== 'object') {
        return { purgedCount: 0, purgedWorkspaces: [] };
      }

      const now = Date.now();
      const expiredWorkspaces = [];

      for (const [orgId, org] of Object.entries(allOrgs)) {
        if (!org || !orgId) continue;
        if (org.isDeleted === true && typeof org.scheduledDeletionAt === 'number' && now >= org.scheduledDeletionAt) {
          expiredWorkspaces.push({ orgId, name: org.name || 'Unnamed' });
        }
      }

      if (expiredWorkspaces.length === 0) {
        return { purgedCount: 0, purgedWorkspaces: [] };
      }

      console.log(`⏰ [workspaceDeletionService] Found ${expiredWorkspaces.length} expired workspace(s) due for permanent deletion.`);

      const purgedWorkspaces = [];
      for (const item of expiredWorkspaces) {
        try {
          await workspaceDeletionService.deleteWorkspaceCascade(item.orgId);
          purgedWorkspaces.push(item.orgId);
        } catch (err) {
          console.error(`🚨 [workspaceDeletionService] Error purging expired workspace ${item.orgId}:`, err.message);
        }
      }

      return { purgedCount: purgedWorkspaces.length, purgedWorkspaces };
    } catch (err) {
      console.error('[workspaceDeletionService] purgeExpiredWorkspaces failed:', err.message);
      return { purgedCount: 0, purgedWorkspaces: [] };
    }
  },

  /**
   * Initializes a recurring background timer that sweeps and purges expired workspaces.
   *
   * @param {number} intervalMs - Sweep interval in milliseconds (defaults to 15 minutes).
   * @returns {NodeJS.Timeout} The interval timer reference.
   */
  startScheduledPurgeRunner: (intervalMs = 15 * 60 * 1000) => {
    // Run an initial sweep asynchronously on startup
    workspaceDeletionService.purgeExpiredWorkspaces().catch((err) => {
      console.warn('⚠️ [workspaceDeletionService] Initial startup purge sweep warning:', err.message);
    });

    const timer = setInterval(() => {
      workspaceDeletionService.purgeExpiredWorkspaces().catch((err) => {
        console.warn('⚠️ [workspaceDeletionService] Scheduled purge sweep warning:', err.message);
      });
    }, intervalMs);

    if (timer.unref) {
      timer.unref(); // Do not block process termination in tests or scripts
    }

    console.log(`⏱️ [workspaceDeletionService] Started scheduled workspace purge runner (every ${intervalMs / 1000 / 60}m)`);
    return timer;
  },
};
