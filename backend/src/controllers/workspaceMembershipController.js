import { rtdbService } from '../services/rtdbService.js';
import { securityAuditService, AUDIT_CATEGORIES } from '../services/securityAuditService.js';
import { notificationService } from '../services/notificationService.js';
import { NOTIFICATION_TYPES } from '../constants/notificationConstants.js';
import { activityService } from '../services/activityService.js';
import { ACTIVITY_EVENT_TYPES } from '../constants/activityConstants.js';
import { validatePathSegment } from '../utils/blueprintPathBuilder.js';
import {
  resolveWorkspaceMembership,
  requireWorkspaceRole,
  countUniqueActiveMembers,
  reconcileWorkspaceMemberCount,
} from '../utils/workspaceAuthHelper.js';

/**
 * Controller for Server-Authorized Workspace Membership Operations.
 * Enforces strict authentication, cryptographic invite code resolution,
 * platform policy validation, and atomic membership persistence via Firebase Admin SDK.
 */
export const workspaceMembershipController = {
  /**
   * Authoritative handler for joining an organization workspace via 8-character invite code.
   *
   * @param {string} verifiedUserUid - Authoritative UID derived from req.user.uid
   * @param {string} inviteCode - Client-supplied invite code string
   * @param {Object} req - Express request object for audit logging
   * @returns {Promise<Object>} Join result containing orgId
   */
  joinWorkspaceByCodeHandler: async (verifiedUserUid, inviteCode, req = null) => {
    if (!verifiedUserUid || typeof verifiedUserUid !== 'string' || !verifiedUserUid.trim()) {
      const err = new Error('Authentication required. A valid verified user UID is required.');
      err.statusCode = 401;
      err.code = 'UNAUTHORIZED';
      throw err;
    }

    // Phase 2B: Legacy 8-character common workspace join codes are permanently retired.
    // The sole authorized mechanism for workspace joining is email-bound invitations (format: CNV-XXXX-XXXX).
    const err = new Error(
      'Legacy 8-character workspace invite codes have been retired. Please use an email-bound invitation code (format: CNV-XXXX-XXXX).'
    );
    err.statusCode = 410;
    err.code = 'LEGACY_CODE_RETIRED';
    throw err;
  },

  /**
   * Authoritative handler for leaving a workspace.
   * Enforces owner leave restrictions, removes canonical membership,
   * cleans up active user profile pointers, and atomically reconciles memberCount via Admin SDK.
   *
   * @param {string} verifiedUserUid - Authoritative UID from auth token
   * @param {string} rawWorkspaceId - Target workspace ID
   * @param {Object} req - Express request object for activity attribution
   * @returns {Promise<Object>} Leave result with canonical member count
   */
  leaveWorkspaceHandler: async (verifiedUserUid, rawWorkspaceId, req = null) => {
    if (!verifiedUserUid || typeof verifiedUserUid !== 'string' || !verifiedUserUid.trim()) {
      const err = new Error('Authentication required.');
      err.statusCode = 401;
      err.code = 'UNAUTHORIZED';
      throw err;
    }

    if (!rawWorkspaceId || typeof rawWorkspaceId !== 'string' || !rawWorkspaceId.trim()) {
      const err = new Error('Workspace ID is required.');
      err.statusCode = 400;
      err.code = 'INVALID_PARAMETERS';
      throw err;
    }

    const workspaceId = validatePathSegment(rawWorkspaceId.trim(), 'workspaceId');
    const userUid = verifiedUserUid.trim();

    // 1. Fetch workspace and active members in parallel
    const [org, membersObj] = await Promise.all([
      rtdbService.getData(`organizations/${workspaceId}`),
      rtdbService.getData(`organization_members/${workspaceId}`),
    ]);

    if (!org) {
      const err = new Error('Workspace not found.');
      err.statusCode = 404;
      err.code = 'WORKSPACE_NOT_FOUND';
      throw err;
    }

    const memberRecord = membersObj ? membersObj[userUid] : null;
    const isOwner = Boolean(org.ownerId === userUid || org.createdBy === userUid);

    // 2. Owner Leave Restrictions (Section 4 & 16)
    if (isOwner) {
      const activeCount = countUniqueActiveMembers(membersObj);
      if (activeCount > 1) {
        const err = new Error('As the Owner, please remove members or transfer ownership before leaving.');
        err.statusCode = 400;
        err.code = 'OWNER_CANNOT_LEAVE_WITH_MEMBERS';
        throw err;
      } else {
        const err = new Error('Workspace owners cannot leave their workspace. You can transfer ownership or delete the workspace.');
        err.statusCode = 400;
        err.code = 'OWNER_CANNOT_LEAVE';
        throw err;
      }
    }

    // 3. Verify user is actually an active member
    if (!memberRecord) {
      const err = new Error('You are not an active member of this workspace.');
      err.statusCode = 400;
      err.code = 'NOT_A_MEMBER';
      throw err;
    }

    // 4. Calculate new canonical member count after removal
    const remainingMembers = { ...(membersObj || {}) };
    delete remainingMembers[userUid];
    const newCanonicalCount = countUniqueActiveMembers(remainingMembers);

    const timestamp = Date.now();
    const atomicUpdates = {
      [`organization_members/${workspaceId}/${userUid}`]: null,
      [`organizations/${workspaceId}/memberCount`]: newCanonicalCount,
      [`organizations/${workspaceId}/updatedAt`]: timestamp,
    };

    // If workspaces mirror alias exists, synchronize it
    const wsAlias = await rtdbService.getData(`workspaces/${workspaceId}`);
    if (wsAlias) {
      atomicUpdates[`workspaces/${workspaceId}/memberCount`] = newCanonicalCount;
      atomicUpdates[`workspaces/${workspaceId}/updatedAt`] = timestamp;
    }

    // Reset user organization pointer if currently pointing to this workspace
    const userProfile = await rtdbService.getData(`users/${userUid}`);
    if (userProfile && userProfile.organizationId === workspaceId) {
      atomicUpdates[`users/${userUid}/organizationId`] = null;
    }

    await rtdbService.updateData('', atomicUpdates);

    // 5. Activity Event
    const memberName = req?.user?.displayName || req?.user?.name || userProfile?.displayName || 'Team Member';
    activityService.recordWorkspaceActivity(workspaceId, {
      eventType: ACTIVITY_EVENT_TYPES.WORKSPACE_MEMBER_REMOVED || 'workspace.member_removed',
      actorId: userUid,
      actorType: 'user',
      actorName: memberName,
      resourceType: 'workspace',
      resourceId: workspaceId,
      resourceTitle: org.name || 'Workspace',
      summary: `${memberName} left the workspace`,
      createdAt: timestamp,
    }).catch(() => {});

    return {
      success: true,
      workspaceId,
      memberCount: newCanonicalCount,
      message: 'You have left the workspace successfully.',
    };
  },

  /**
   * Authoritative handler for removing a member from a workspace.
   * Requires caller to be workspace owner or admin.
   * Prevents removing the workspace owner.
   *
   * @param {string} verifiedUserUid - Caller's authenticated UID
   * @param {string} rawWorkspaceId - Target workspace ID
   * @param {string} rawTargetUid - Member UID to remove
   * @param {Object} req - Express request object for activity logging
   * @returns {Promise<Object>} Removal result with canonical member count
   */
  removeMemberHandler: async (verifiedUserUid, rawWorkspaceId, rawTargetUid, req = null) => {
    if (!verifiedUserUid || typeof verifiedUserUid !== 'string' || !verifiedUserUid.trim()) {
      const err = new Error('Authentication required.');
      err.statusCode = 401;
      err.code = 'UNAUTHORIZED';
      throw err;
    }

    if (!rawWorkspaceId || !rawTargetUid) {
      const err = new Error('Workspace ID and target Member UID are required.');
      err.statusCode = 400;
      err.code = 'INVALID_PARAMETERS';
      throw err;
    }

    const workspaceId = validatePathSegment(rawWorkspaceId.trim(), 'workspaceId');
    const targetUid = rawTargetUid.trim();
    const callerUid = verifiedUserUid.trim();

    // 1. Authorize caller role (owner or admin)
    const membership = await requireWorkspaceRole(
      workspaceId,
      callerUid,
      ['owner', 'admin'],
      'Unauthorized. Only workspace owners and admins can remove members.'
    );

    const org = membership.org;

    // 2. Prevent removing the workspace owner
    if (targetUid === org.ownerId || targetUid === org.createdBy) {
      const err = new Error('The workspace owner cannot be removed.');
      err.statusCode = 400;
      err.code = 'CANNOT_REMOVE_OWNER';
      throw err;
    }

    // 3. Admin cannot remove another admin or owner (role hierarchy)
    const targetMember = await rtdbService.getData(`organization_members/${workspaceId}/${targetUid}`);
    if (!targetMember) {
      const err = new Error('Target user is not an active member of this workspace.');
      err.statusCode = 404;
      err.code = 'MEMBER_NOT_FOUND';
      throw err;
    }

    if (!membership.isOwner && targetMember.role === 'admin') {
      const err = new Error('Only the workspace owner can remove an administrator.');
      err.statusCode = 403;
      err.code = 'CANNOT_REMOVE_ADMIN';
      throw err;
    }

    // 4. Fetch all members and calculate new canonical count
    const allMembers = (await rtdbService.getData(`organization_members/${workspaceId}`)) || {};
    delete allMembers[targetUid];
    const newCanonicalCount = countUniqueActiveMembers(allMembers);

    const timestamp = Date.now();
    const atomicUpdates = {
      [`organization_members/${workspaceId}/${targetUid}`]: null,
      [`organizations/${workspaceId}/memberCount`]: newCanonicalCount,
      [`organizations/${workspaceId}/updatedAt`]: timestamp,
    };

    const wsAlias = await rtdbService.getData(`workspaces/${workspaceId}`);
    if (wsAlias) {
      atomicUpdates[`workspaces/${workspaceId}/memberCount`] = newCanonicalCount;
      atomicUpdates[`workspaces/${workspaceId}/updatedAt`] = timestamp;
    }

    const targetProfile = await rtdbService.getData(`users/${targetUid}`);
    if (targetProfile && targetProfile.organizationId === workspaceId) {
      atomicUpdates[`users/${targetUid}/organizationId`] = null;
    }

    await rtdbService.updateData('', atomicUpdates);

    // 5. Activity event
    const callerName = req?.user?.displayName || req?.user?.name || 'Administrator';
    const targetName = targetProfile?.displayName || targetProfile?.name || 'Team Member';
    activityService.recordWorkspaceActivity(workspaceId, {
      eventType: ACTIVITY_EVENT_TYPES.WORKSPACE_MEMBER_REMOVED || 'workspace.member_removed',
      actorId: callerUid,
      actorType: 'user',
      actorName: callerName,
      resourceType: 'workspace',
      resourceId: workspaceId,
      resourceTitle: org.name || 'Workspace',
      summary: `${callerName} removed ${targetName} from the workspace`,
      createdAt: timestamp,
    }).catch(() => {});

    return {
      success: true,
      workspaceId,
      memberCount: newCanonicalCount,
      removedUid: targetUid,
      message: 'Member removed successfully.',
    };
  },

  /**
   * Reconciles workspace memberCount with authoritative canonical data.
   */
  reconcileWorkspaceMemberCountHandler: async (rawWorkspaceId) => {
    return await reconcileWorkspaceMemberCount(rawWorkspaceId);
  },
};
