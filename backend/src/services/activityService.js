import { rtdbService } from './rtdbService.js';
import {
  ACTIVITY_EVENT_TYPES,
  createCanonicalActivity,
  buildActivityDedupeKey,
} from '../constants/activityConstants.js';

/**
 * Server-Side Centralized Workspace Activity Audit Service.
 * Implements trusted, non-blocking workspace event recording and querying.
 */
export const activityService = {
  /**
   * Records a workspace activity event in Firebase Realtime Database.
   * Fails safely without breaking primary caller transactions.
   *
   * @param {string} workspaceId - Target organization/workspace ID
   * @param {Object} eventData - Canonical event parameters
   * @returns {Promise<Object|null>} The saved canonical activity event or null on non-fatal failure
   */
  recordWorkspaceActivity: async (workspaceId, eventData = {}) => {
    if (!workspaceId) {
      console.warn('[activityService.recordWorkspaceActivity] Ignored: missing workspaceId');
      return null;
    }

    try {
      const canonicalEvent = createCanonicalActivity({
        workspaceId,
        ...eventData,
      });

      const path = `workspace_activity/${workspaceId}/${canonicalEvent.id}`;

      // Non-blocking write using backend admin SDK
      await rtdbService.setData(path, canonicalEvent);
      console.log(`📜 [Activity Recorded] [${canonicalEvent.eventType}] in workspace ${workspaceId}: ${canonicalEvent.summary}`);

      return canonicalEvent;
    } catch (err) {
      // Activity recording is strictly a secondary side effect; never throw to caller
      console.warn(`⚠️ [activityService] Failed to record activity for workspace ${workspaceId}:`, err.message);
      return null;
    }
  },

  /**
   * Retrieves chronological workspace activity events with limit and pagination support.
   *
   * @param {string} workspaceId - Target organization/workspace ID
   * @param {Object} options - Query options { limit = 50, beforeTimestamp = null }
   * @returns {Promise<Array<Object>>} List of activity events ordered descending by createdAt
   */
  getWorkspaceActivities: async (workspaceId, { limit = 50, beforeTimestamp = null } = {}) => {
    if (!workspaceId) return [];

    try {
      const path = `workspace_activity/${workspaceId}`;
      const rawData = await rtdbService.getData(path);

      if (!rawData || typeof rawData !== 'object') {
        return [];
      }

      let events = Object.values(rawData).filter(
        (e) => e && typeof e === 'object' && e.id && e.eventType && e.createdAt
      );

      if (beforeTimestamp) {
        events = events.filter((e) => Number(e.createdAt) < Number(beforeTimestamp));
      }

      // Sort newest first
      events.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));

      const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 100));
      return events.slice(0, safeLimit);
    } catch (err) {
      console.error(`🚨 [activityService] Failed to fetch activities for workspace ${workspaceId}:`, err.message);
      return [];
    }
  },
};
