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

  /**
   * Authoritative handler for assigning, transferring, or removing Second Owner designation.
   * Only Original Owner or current Second Owner can manage ownership responsibilities.
   */
  updateSecondOwnerHandler: async (verifiedUserUid, rawWorkspaceId, rawTargetUid, action = 'assign', req = null) => {
    // Deprecated legacy alias — maps directly to updateTeamCaptainHandler
    return workspaceMembershipController.updateTeamCaptainHandler(verifiedUserUid, rawWorkspaceId, rawTargetUid, action, req);
  },

  /**
   * Authoritative handler for assigning, transferring, or removing Team Captain designation.
   * Authorized for Original Owner or Team Captain.
   */
  updateTeamCaptainHandler: async (verifiedUserUid, rawWorkspaceId, rawTargetUid, action = 'assign', req = null) => {
    if (!verifiedUserUid || !rawWorkspaceId || !rawTargetUid) {
      const err = new Error('Workspace ID and target Member UID are required.');
      err.statusCode = 400;
      err.code = 'INVALID_PARAMETERS';
      throw err;
    }

    const workspaceId = validatePathSegment(rawWorkspaceId.trim(), 'workspaceId');
    const targetUid = rawTargetUid.trim();
    const callerUid = verifiedUserUid.trim();

    // 1. Authorize: Original Owner or Team Captain
    const membership = await requireWorkspaceRole(
      workspaceId,
      callerUid,
      ['owner', 'admin', 'team_captain'],
      'Unauthorized. Only workspace owners or team captains can manage Team Captain designation.'
    );

    const org = membership.org;

    // 2. Original Owner already holds ultimate authority and does not take Team Captain role
    if (targetUid === org.ownerId || targetUid === org.createdBy || targetUid === org.ownerUid) {
      const err = new Error('The Original Owner already owns the workspace.');
      err.statusCode = 400;
      err.code = 'CANNOT_ASSIGN_ORIGINAL_OWNER';
      throw err;
    }

    // 3. Ensure target is an active workspace member
    const targetMember = await rtdbService.getData(`organization_members/${workspaceId}/${targetUid}`);
    if (!targetMember || targetMember.status === 'removed' || targetMember.status === 'inactive') {
      const err = new Error('Target user is not an active member of this workspace.');
      err.statusCode = 404;
      err.code = 'MEMBER_NOT_FOUND';
      throw err;
    }

    const timestamp = Date.now();
    const atomicUpdates = {};
    const normalizedAction = String(action).toLowerCase();

    if (normalizedAction === 'remove') {
      atomicUpdates[`organization_members/${workspaceId}/${targetUid}/isTeamCaptain`] = false;
      atomicUpdates[`organization_members/${workspaceId}/${targetUid}/role`] = 'member';
      atomicUpdates[`organization_members/${workspaceId}/${targetUid}/updatedAt`] = timestamp;
    } else {
      // Assign Team Captain: Enforce at most 2 Team Captains per workspace
      const allMembersObj = (await rtdbService.getData(`organization_members/${workspaceId}`)) || {};
      const activeCaptains = Object.entries(allMembersObj).filter(([mUid, mVal]) => {
        if (mUid === targetUid || !mVal || mVal.status === 'removed' || mVal.status === 'inactive' || mVal.isDeleted) return false;
        return mVal.isTeamCaptain || mVal.role === 'team_captain' || mVal.isSecondOwner || mVal.role === 'second_owner';
      });

      if (activeCaptains.length >= 2) {
        const err = new Error('A workspace can have at most 2 Team Captains. Please demote an existing Team Captain before assigning a new one.');
        err.statusCode = 409;
        err.code = 'TEAM_CAPTAIN_LIMIT_EXCEEDED';
        throw err;
      }

      atomicUpdates[`organization_members/${workspaceId}/${targetUid}/isTeamCaptain`] = true;
      atomicUpdates[`organization_members/${workspaceId}/${targetUid}/isSecondOwner`] = false;
      atomicUpdates[`organization_members/${workspaceId}/${targetUid}/role`] = 'team_captain';
      atomicUpdates[`organization_members/${workspaceId}/${targetUid}/updatedAt`] = timestamp;
    }

    await rtdbService.updateData('', atomicUpdates);

    // Activity tracking
    const callerName = req?.user?.displayName || req?.user?.name || 'Workspace Manager';
    const targetProfile = await rtdbService.getData(`users/${targetUid}`);
    const targetName = targetProfile?.displayName || targetProfile?.name || targetMember.email || 'Team Member';

    const eventType = normalizedAction === 'remove'
      ? 'workspace.team_captain_removed'
      : 'workspace.team_captain_assigned';

    const summaryText = normalizedAction === 'remove'
      ? `${callerName} removed Team Captain role from ${targetName}`
      : `${callerName} assigned ${targetName} as Team Captain`;

    activityService.recordWorkspaceActivity(workspaceId, {
      eventType,
      actorId: callerUid,
      actorType: 'user',
      actorName: callerName,
      resourceType: 'workspace',
      resourceId: workspaceId,
      resourceTitle: org.name || 'Workspace',
      summary: summaryText,
      createdAt: timestamp,
    }).catch(() => {});

    return {
      success: true,
      workspaceId,
      targetUid,
      action: normalizedAction,
      isTeamCaptain: normalizedAction !== 'remove',
      message: normalizedAction === 'remove' ? 'Team Captain role removed.' : 'Team Captain role assigned successfully.',
    };
  },

  /**
   * Authoritative handler for secure workspace ownership transfer.
   * Only the current canonical Owner can transfer ownership.
   */
  transferOwnershipHandler: async (verifiedUserUid, rawWorkspaceId, rawNewOwnerUid, rawFormerOwnerRole = 'team_captain', req = null) => {
    if (!verifiedUserUid || !rawWorkspaceId || !rawNewOwnerUid) {
      const err = new Error('Workspace ID, new Owner UID, and former Owner role are required.');
      err.statusCode = 400;
      err.code = 'INVALID_PARAMETERS';
      throw err;
    }

    const workspaceId = validatePathSegment(rawWorkspaceId.trim(), 'workspaceId');
    const newOwnerUid = rawNewOwnerUid.trim();
    const callerUid = verifiedUserUid.trim();
    const formerOwnerRole = String(rawFormerOwnerRole || 'team_captain').toLowerCase() === 'team_captain' ? 'team_captain' : 'member';

    // 1. Authorize: Requester MUST be the current canonical Owner
    const membership = await resolveWorkspaceMembership(workspaceId, callerUid);
    if (!membership.exists) {
      const err = new Error('Workspace not found.');
      err.statusCode = 404;
      err.code = 'WORKSPACE_NOT_FOUND';
      throw err;
    }

    if (!membership.isOwner) {
      const err = new Error('Unauthorized. Only the current workspace Owner can transfer ownership.');
      err.statusCode = 403;
      err.code = 'ONLY_OWNER_CAN_TRANSFER';
      throw err;
    }

    if (newOwnerUid === callerUid) {
      const err = new Error('You are already the workspace Owner.');
      err.statusCode = 400;
      err.code = 'ALREADY_OWNER';
      throw err;
    }

    // 2. Target user must be an active workspace member
    const allMembersObj = (await rtdbService.getData(`organization_members/${workspaceId}`)) || {};
    const newOwnerMember = allMembersObj[newOwnerUid];
    if (!newOwnerMember || newOwnerMember.status === 'removed' || newOwnerMember.status === 'inactive') {
      const err = new Error('Target user is not an active member of this workspace.');
      err.statusCode = 404;
      err.code = 'MEMBER_NOT_FOUND';
      throw err;
    }

    // 3. Calculate resulting Team Captain count & enforce 2-Captain capacity constraint
    const activeCaptains = new Set();
    for (const [mUid, mVal] of Object.entries(allMembersObj)) {
      if (!mVal || mVal.status === 'removed' || mVal.status === 'inactive' || mVal.isDeleted) continue;
      if (mVal.isTeamCaptain || mVal.role === 'team_captain' || mVal.isSecondOwner || mVal.role === 'second_owner') {
        activeCaptains.add(mUid);
      }
    }

    // New owner no longer counts as a Team Captain
    activeCaptains.delete(newOwnerUid);

    // If former owner is becoming Team Captain, add former owner
    if (formerOwnerRole === 'team_captain') {
      activeCaptains.add(callerUid);
    } else {
      activeCaptains.delete(callerUid);
    }

    if (activeCaptains.size > 2) {
      const err = new Error('Cannot assign former Owner as Team Captain because the workspace would exceed the limit of 2 Team Captains.');
      err.statusCode = 409;
      err.code = 'TEAM_CAPTAIN_LIMIT_EXCEEDED';
      throw err;
    }

    const timestamp = Date.now();
    const newOwnerProfile = (await rtdbService.getData(`users/${newOwnerUid}`)) || {};
    const newOwnerName = newOwnerProfile.displayName || newOwnerProfile.name || newOwnerMember.email || 'Team Member';
    const callerProfile = (await rtdbService.getData(`users/${callerUid}`)) || {};
    const callerName = req?.user?.displayName || req?.user?.name || callerProfile.displayName || callerProfile.name || 'Former Owner';

    // 4. Atomic Multi-Location RTDB Updates
    const atomicUpdates = {
      [`organizations/${workspaceId}/ownerId`]: newOwnerUid,
      [`organizations/${workspaceId}/ownerUid`]: newOwnerUid,
      [`organizations/${workspaceId}/ownerName`]: newOwnerName,
      [`organizations/${workspaceId}/updatedAt`]: timestamp,
      [`organization_members/${workspaceId}/${newOwnerUid}`]: {
        uid: newOwnerUid,
        email: newOwnerMember.email || newOwnerProfile.email || '',
        role: 'owner',
        isTeamCaptain: false,
        isSecondOwner: false,
        joinedAt: newOwnerMember.joinedAt || timestamp,
        updatedAt: timestamp,
      },
      [`organization_members/${workspaceId}/${callerUid}`]: {
        uid: callerUid,
        email: req?.user?.email || callerProfile.email || '',
        role: formerOwnerRole,
        isTeamCaptain: formerOwnerRole === 'team_captain',
        isSecondOwner: false,
        joinedAt: allMembersObj[callerUid]?.joinedAt || timestamp,
        updatedAt: timestamp,
      },
    };

    const wsAlias = await rtdbService.getData(`workspaces/${workspaceId}`);
    if (wsAlias) {
      atomicUpdates[`workspaces/${workspaceId}/ownerId`] = newOwnerUid;
      atomicUpdates[`workspaces/${workspaceId}/ownerUid`] = newOwnerUid;
      atomicUpdates[`workspaces/${workspaceId}/ownerName`] = newOwnerName;
      atomicUpdates[`workspaces/${workspaceId}/updatedAt`] = timestamp;
    }

    await rtdbService.updateData('', atomicUpdates);

    // 5. Activity Audit Trail
    activityService.recordWorkspaceActivity(workspaceId, {
      eventType: 'workspace.ownership_transferred',
      actorId: callerUid,
      actorType: 'user',
      actorName: callerName,
      resourceType: 'workspace',
      resourceId: workspaceId,
      resourceTitle: membership.org?.name || 'Workspace',
      summary: `${callerName} transferred workspace ownership to ${newOwnerName} (Former owner role: ${formerOwnerRole})`,
      createdAt: timestamp,
    }).catch(() => {});

    return {
      success: true,
      workspaceId,
      newOwnerUid,
      formerOwnerUid: callerUid,
      formerOwnerRole,
      message: `Workspace ownership successfully transferred to ${newOwnerName}.`,
    };
  },
};
