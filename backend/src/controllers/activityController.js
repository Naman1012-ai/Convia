import { rtdbService } from '../services/rtdbService.js';
import { requireWorkspaceMember } from '../utils/workspaceAuthHelper.js';
import { activityService } from '../services/activityService.js';
import {
  ACTIVITY_EVENT_TYPES,
  ACTIVITY_CATEGORIES,
  getActivityCategory,
} from '../constants/activityConstants.js';
import { validatePathSegment } from '../utils/blueprintPathBuilder.js';

// Event types strictly reserved for trusted internal backend processes
const SYSTEM_RESERVED_EVENT_TYPES = new Set([
  ACTIVITY_EVENT_TYPES.BLUEPRINT_GENERATION_STARTED,
  ACTIVITY_EVENT_TYPES.BLUEPRINT_GENERATION_COMPLETED,
  ACTIVITY_EVENT_TYPES.BLUEPRINT_GENERATION_FAILED,
]);

/**
 * Controller for Authoritative Workspace Activity & Audit Records.
 * Enforces token authentication, active workspace membership, actor identity derivation,
 * trusted server timestamps, and Firebase Admin SDK persistence.
 */
export const activityController = {
  /**
   * Records a client-originated business activity event with server-side validation.
   *
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  recordActivityHandler: async (req, res) => {
    try {
      const verifiedUserUid = req.user?.uid;
      if (!verifiedUserUid || typeof verifiedUserUid !== 'string' || !verifiedUserUid.trim()) {
        return res.status(401).json({
          success: false,
          error: { message: 'Authentication required to record activity.', code: 'UNAUTHORIZED' },
        });
      }

      const rawWorkspaceId = req.params?.workspaceId;
      if (!rawWorkspaceId || typeof rawWorkspaceId !== 'string' || !rawWorkspaceId.trim()) {
        return res.status(400).json({
          success: false,
          error: { message: 'A valid Workspace ID is required.', code: 'INVALID_WORKSPACE_ID' },
        });
      }

      const workspaceId = validatePathSegment(rawWorkspaceId.trim(), 'workspaceId');

      // 1. Authoritative Membership Verification
      await requireWorkspaceMember(
        workspaceId,
        verifiedUserUid,
        'Access denied. You must be an active member of this workspace to record activity.'
      );

      // 2. Validate Event Parameters
      const {
        eventType,
        resourceType,
        resourceId,
        resourceTitle,
        parentResourceId,
        summary,
        actionUrl,
        metadata = {},
      } = req.body || {};

      if (!eventType || typeof eventType !== 'string' || !eventType.trim()) {
        return res.status(400).json({
          success: false,
          error: { message: 'A valid eventType is required.', code: 'MISSING_EVENT_TYPE' },
        });
      }

      const cleanEventType = eventType.trim();

      // Forgery Defense: Reject client requests attempting to emit system-reserved events
      if (SYSTEM_RESERVED_EVENT_TYPES.has(cleanEventType)) {
        return res.status(403).json({
          success: false,
          error: {
            message: 'Forbidden. The requested event type is reserved for system-generated operations.',
            code: 'RESERVED_SYSTEM_EVENT',
          },
        });
      }

      // Forgery Defense: Reject client requests attempting to claim system actorType
      if (req.body?.actorType === 'system' || req.body?.actorId === 'system') {
        return res.status(403).json({
          success: false,
          error: {
            message: 'Forbidden. Clients cannot impersonate the system actor.',
            code: 'FORBIDDEN_SYSTEM_IMPERSONATION',
          },
        });
      }

      if (!resourceType || typeof resourceType !== 'string' || !resourceType.trim()) {
        return res.status(400).json({
          success: false,
          error: { message: 'A valid resourceType is required.', code: 'MISSING_RESOURCE_TYPE' },
        });
      }

      if (!resourceId || typeof resourceId !== 'string' || !resourceId.trim()) {
        return res.status(400).json({
          success: false,
          error: { message: 'A valid resourceId is required.', code: 'MISSING_RESOURCE_ID' },
        });
      }

      // 3. Authoritative Actor Profile Derivation
      const userProfile = (await rtdbService.getData(`users/${verifiedUserUid}`)) || {};
      const resolvedActorName =
        userProfile.displayName ||
        userProfile.name ||
        req.user?.displayName ||
        req.user?.name ||
        'Team Member';
      const resolvedActorPhoto = userProfile.photoURL || userProfile.avatar || req.user?.photoURL || null;

      // 4. Record Canonical Activity via Admin SDK with Authoritative Timestamp
      const canonicalEvent = await activityService.recordWorkspaceActivity(workspaceId, {
        eventType: cleanEventType,
        actorId: verifiedUserUid, // STRICT: Locked to verified token UID (cannot impersonate)
        actorType: 'user', // STRICT: Locked to user (cannot claim system)
        actorName: resolvedActorName,
        actorPhotoURL: resolvedActorPhoto,
        resourceType: resourceType.trim(),
        resourceId: resourceId.trim(),
        resourceTitle: resourceTitle ? String(resourceTitle).trim() : null,
        parentResourceId: parentResourceId ? String(parentResourceId).trim() : null,
        summary: summary ? String(summary).trim() : null,
        actionUrl: actionUrl ? String(actionUrl).trim() : null,
        metadata: metadata && typeof metadata === 'object' ? metadata : {},
        createdAt: Date.now(), // STRICT: Server clock timestamp
      });

      if (!canonicalEvent) {
        return res.status(500).json({
          success: false,
          error: { message: 'Failed to record workspace activity.', code: 'ACTIVITY_PERSISTENCE_FAILED' },
        });
      }

      return res.status(201).json({
        success: true,
        data: canonicalEvent,
      });
    } catch (err) {
      console.error('🚨 [activityController.recordActivityHandler Error]:', err.message);
      const statusCode = err.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        error: { message: err.message || 'Internal server error.', code: err.code || 'ACTIVITY_ERROR' },
      });
    }
  },

  /**
   * Retrieves workspace activities with limit and beforeTimestamp pagination.
   *
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  getWorkspaceActivitiesHandler: async (req, res) => {
    try {
      const verifiedUserUid = req.user?.uid;
      if (!verifiedUserUid || typeof verifiedUserUid !== 'string' || !verifiedUserUid.trim()) {
        return res.status(401).json({
          success: false,
          error: { message: 'Authentication required.', code: 'UNAUTHORIZED' },
        });
      }

      const rawWorkspaceId = req.params?.workspaceId;
      if (!rawWorkspaceId || typeof rawWorkspaceId !== 'string' || !rawWorkspaceId.trim()) {
        return res.status(400).json({
          success: false,
          error: { message: 'A valid Workspace ID is required.', code: 'INVALID_WORKSPACE_ID' },
        });
      }

      const workspaceId = validatePathSegment(rawWorkspaceId.trim(), 'workspaceId');

      // Membership Check
      await requireWorkspaceMember(
        workspaceId,
        verifiedUserUid,
        'Access denied. You must be an active member of this workspace.'
      );

      const limit = Number(req.query?.limit) || 50;
      const beforeTimestamp = req.query?.beforeTimestamp ? Number(req.query.beforeTimestamp) : null;

      const activities = await activityService.getWorkspaceActivities(workspaceId, {
        limit,
        beforeTimestamp,
      });

      return res.json({
        success: true,
        data: activities,
      });
    } catch (err) {
      console.error('🚨 [activityController.getWorkspaceActivitiesHandler Error]:', err.message);
      const statusCode = err.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        error: { message: err.message || 'Internal server error.', code: err.code || 'ACTIVITY_FETCH_ERROR' },
      });
    }
  },
};
