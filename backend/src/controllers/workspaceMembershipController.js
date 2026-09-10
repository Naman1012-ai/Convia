import { rtdbService } from '../services/rtdbService.js';
import { securityAuditService, AUDIT_CATEGORIES } from '../services/securityAuditService.js';
import { notificationService } from '../services/notificationService.js';
import { NOTIFICATION_TYPES } from '../constants/notificationConstants.js';
import { activityService } from '../services/activityService.js';
import { ACTIVITY_EVENT_TYPES } from '../constants/activityConstants.js';

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

    if (!inviteCode || typeof inviteCode !== 'string' || !inviteCode.trim()) {
      const err = new Error('A valid 8-character invite code is required.');
      err.statusCode = 400;
      err.code = 'INVALID_INVITE_CODE';
      throw err;
    }

    const cleanCode = inviteCode.trim().toUpperCase();
    if (cleanCode.length !== 8 || !/^[A-Z0-9]{8}$/.test(cleanCode)) {
      const err = new Error('Please enter a valid 8-character invite code (alphanumeric).');
      err.statusCode = 400;
      err.code = 'INVALID_INVITE_CODE';
      throw err;
    }

    // 1. Authoritative Platform Settings Check
    const platformSettings = await rtdbService.getData('platform_settings');
    const wSettings = platformSettings?.workspaces || {};

    if (wSettings.allowWorkspaceJoining === false) {
      const err = new Error('Workspace joining has been disabled by the platform administrator.');
      err.statusCode = 403;
      err.code = 'WORKSPACE_JOINING_DISABLED';
      throw err;
    }

    // 2. Authoritative Server-Side Invite Code Lookup
    let codeRecord = await rtdbService.getData(`invite_codes/${cleanCode}`);
    if (!codeRecord || !codeRecord.orgId) {
      codeRecord = await rtdbService.getData(`inviteCodes/${cleanCode}`);
    }

    if (!codeRecord || !codeRecord.orgId) {
      const err = new Error('Invalid or expired invite code. Please check and try again.');
      err.statusCode = 404;
      err.code = 'INVALID_INVITE_CODE';
      throw err;
    }

    const orgId = codeRecord.orgId;

    // 3. Organization Existence & Status Validation
    const org = await rtdbService.getData(`organizations/${orgId}`);
    if (!org) {
      const err = new Error('The workspace associated with this invite code was not found.');
      err.statusCode = 404;
      err.code = 'WORKSPACE_NOT_FOUND';
      throw err;
    }

    if (org.isDeleted) {
      const err = new Error('This workspace has been archived or marked for deletion.');
      err.statusCode = 410;
      err.code = 'WORKSPACE_DELETED';
      throw err;
    }

    // 4. Existing Member Check (Idempotent Join)
    const existingMember = await rtdbService.getData(`organization_members/${orgId}/${verifiedUserUid}`);
    if (existingMember) {
      await rtdbService.updateData(`users/${verifiedUserUid}`, { organizationId: orgId });
      return {
        orgId,
        alreadyMember: true,
        role: existingMember.role || 'member',
        message: 'You are already a member of this workspace.',
      };
    }

    // 5. Team Capacity Limit Enforcement
    const currentMemberCount = Number(org.memberCount) || 0;
    const teamSizeLimit = Number(org.teamSizeLimit) || 5;
    const maxAllowedMembers = Math.min(teamSizeLimit, wSettings.maxMembersPerOrg ?? 20);

    if (currentMemberCount >= maxAllowedMembers) {
      const err = new Error(`Team is full! Maximum team size limit reached (${maxAllowedMembers} members).`);
      err.statusCode = 400;
      err.code = 'WORKSPACE_FULL';
      throw err;
    }

    // 6. Atomic Server-Side Membership Creation via Firebase Admin SDK
    const timestamp = Date.now();
    const newMemberCount = currentMemberCount + 1;

    const atomicUpdates = {
      [`organization_members/${orgId}/${verifiedUserUid}`]: {
        uid: verifiedUserUid,
        role: 'member',
        joinedAt: timestamp,
      },
      [`organizations/${orgId}/memberCount`]: newMemberCount,
      [`organizations/${orgId}/updatedAt`]: timestamp,
      [`users/${verifiedUserUid}/organizationId`]: orgId,
    };

    await rtdbService.updateData('', atomicUpdates);

    // 7. Security Audit Telemetry
    if (req) {
      securityAuditService.recordEvent({
        category: AUDIT_CATEGORIES.WORKSPACE,
        eventType: 'WORKSPACE_MEMBER_JOINED',
        severity: 'INFO',
        req,
        actorUid: verifiedUserUid,
        targetType: 'WORKSPACE',
        targetId: orgId,
        outcome: 'SUCCESS',
        metadata: {
          role: 'member',
          memberCount: newMemberCount,
        },
      }, { isCritical: false }).catch(() => {});
    }

    // 8. Dispatch Member Joined Notification to existing workspace members
    const memberName = req?.user?.displayName || req?.user?.name || req?.user?.email || 'A new member';
    notificationService.dispatchNotificationEvent(
      NOTIFICATION_TYPES.WORKSPACE_MEMBER_JOINED,
      {
        workspaceId: orgId,
        memberUid: verifiedUserUid,
        memberName,
      },
      { uid: verifiedUserUid, displayName: memberName }
    ).catch((notifErr) => console.warn('⚠️ [Member Joined Notification Warning]', notifErr.message));

    // 9. Authoritative Server-Side Activity Record Creation via Admin SDK
    activityService.recordWorkspaceActivity(orgId, {
      eventType: ACTIVITY_EVENT_TYPES.WORKSPACE_MEMBER_JOINED,
      actorId: verifiedUserUid,
      actorType: 'user',
      actorName: memberName,
      actorPhotoURL: req?.user?.photoURL || null,
      resourceType: 'workspace',
      resourceId: orgId,
      resourceTitle: org.name || 'Workspace',
      summary: `${memberName} joined the workspace`,
      createdAt: timestamp,
    }).catch((actErr) => console.warn('⚠️ [Member Joined Activity Warning]', actErr.message));

    return {
      orgId,
      alreadyMember: false,
      role: 'member',
      memberCount: newMemberCount,
      message: 'Joined workspace successfully.',
    };
  },
};
