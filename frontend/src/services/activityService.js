import { rtdbService } from './rtdbService';
import { apiClient } from './apiClient';
import {
  ACTIVITY_EVENT_TYPES,
  createCanonicalActivity,
  buildActivityDedupeKey,
} from '../constants/activityConstants';

/**
 * Client-Side Centralized Workspace Activity Audit Service.
 * Provides unified interface for recording, subscribing, and retrieving workspace activity events.
 */
export const activityService = {
  /**
   * Records a workspace activity event via the authoritative server activity endpoint.
   * Fails safely and asynchronously so primary user actions are never interrupted.
   *
   * @param {string} workspaceId - Organization/Workspace ID
   * @param {Object} eventData - Canonical event fields
   * @returns {Promise<Object|null>}
   */
  recordWorkspaceActivity: async (workspaceId, eventData = {}) => {
    if (!workspaceId) {
      console.warn('[activityService.recordWorkspaceActivity] Ignored: missing workspaceId');
      return null;
    }

    try {
      const response = await apiClient.post(`/api/workspace/${workspaceId}/activity`, eventData);
      return response?.data || response;
    } catch (err) {
      console.warn(`⚠️ [activityService] Failed to record activity for workspace ${workspaceId}:`, err.message || err);
      return null;
    }
  },

  /**
   * Real-time subscription to workspace activity timeline.
   *
   * @param {string} workspaceId - Organization/Workspace ID
   * @param {Function} callback - Invoked with updated array of activity records (ordered newest first)
   * @param {Object} options - { limit = 50 }
   * @returns {Function} Unsubscribe cleanup handler
   */
  subscribeToWorkspaceActivity: (workspaceId, callback, { limit = 50 } = {}) => {
    if (!workspaceId || typeof callback !== 'function') {
      if (typeof callback === 'function') callback([]);
      return () => {};
    }

    const path = `workspace_activity/${workspaceId}`;

    const unsubscribe = rtdbService.subscribe(path, (snapshot) => {
      if (!snapshot || typeof snapshot !== 'object') {
        callback([]);
        return;
      }

      const events = Object.values(snapshot)
        .filter((item) => item && typeof item === 'object' && item.id && item.eventType && item.createdAt)
        .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));

      const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 100));
      callback(events.slice(0, safeLimit));
    });

    return unsubscribe;
  },

  /**
   * Fetches chronological workspace activity once.
   *
   * @param {string} workspaceId - Organization/Workspace ID
   * @param {Object} options - { limit = 50, beforeTimestamp = null }
   * @returns {Promise<Array<Object>>}
   */
  getWorkspaceActivity: async (workspaceId, { limit = 50, beforeTimestamp = null } = {}) => {
    if (!workspaceId) return [];

    try {
      const path = `workspace_activity/${workspaceId}`;
      const snapshot = await rtdbService.getData(path);

      if (!snapshot || typeof snapshot !== 'object') {
        return [];
      }

      let events = Object.values(snapshot).filter(
        (item) => item && typeof item === 'object' && item.id && item.eventType && item.createdAt
      );

      if (beforeTimestamp) {
        events = events.filter((e) => Number(e.createdAt) < Number(beforeTimestamp));
      }

      events.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));

      const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 100));
      return events.slice(0, safeLimit);
    } catch (err) {
      console.warn(`[activityService] getWorkspaceActivity error:`, err);
      return [];
    }
  },
};
