import crypto from 'crypto';
import { rtdbService } from '../services/rtdbService.js';
import { requireWorkspaceRole, countUniqueActiveMembers } from '../utils/workspaceAuthHelper.js';
import {
  generateInvitationCode,
  normalizeInvitationCode,
  isValidInvitationCodeFormat,
  normalizeEmail,
  hashInvitationCode,
  INVITATION_EXPIRATION_MS,
} from '../utils/invitationCodeHelper.js';
import { activityService } from '../services/activityService.js';
import { ACTIVITY_EVENT_TYPES } from '../constants/activityConstants.js';
import { notificationService } from '../services/notificationService.js';
import { NOTIFICATION_TYPES } from '../constants/notificationConstants.js';

export const workspaceInvitationController = {
  /**
   * Generates a new email-bound invitation code for a workspace teammate.
   * Only Workspace Owner and Authorized Admins can create invitations.
   */
  createInvitationHandler: async (workspaceId, userUid, { email, role = 'member' }, req = null) => {
    if (!workspaceId || !userUid) {
      const err = new Error('Workspace ID and User UID are required.');
      err.statusCode = 400;
      err.code = 'INVALID_PARAMETERS';
      throw err;
    }

    // 1. Authorize: Only Owner and Admin
    const { org } = await requireWorkspaceRole(
      workspaceId,
      userUid,
      ['owner', 'admin'],
      "You don't have permission to invite members to this workspace."
    );

    // 2. Validate and normalize email
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      const err = new Error('Please enter a valid email address.');
      err.statusCode = 400;
      err.code = 'INVALID_EMAIL';
      throw err;
    }

    // 3. Validate role (Owner cannot be assigned via invitation)
    const validRoles = ['member', 'admin'];
    const assignedRole = validRoles.includes(String(role).toLowerCase())
      ? String(role).toLowerCase()
      : 'member';

    // 4. Verify Authoritative Workspace Member Capacity (Section 8)
    const membersObj = (await rtdbService.getData(`organization_members/${workspaceId}`)) || {};
    const activeMemberCount = countUniqueActiveMembers(membersObj);
    const maxMembersLimit = Number(org.maxMembers) || Number(org.teamSizeLimit) || 5;

    if (activeMemberCount >= maxMembersLimit) {
      const err = new Error('This workspace has reached its member limit.');
      err.statusCode = 400;
      err.code = 'WORKSPACE_FULL';
      throw err;
    }

    // 5. Check if user with this email is already a member
    const memberUids = Object.keys(membersObj);
    for (const mUid of memberUids) {
      const memberEntry = membersObj[mUid];
      if (memberEntry && memberEntry.email && normalizeEmail(memberEntry.email) === cleanEmail) {
        const err = new Error('This user is already a member of this workspace.');
        err.statusCode = 400;
        err.code = 'ALREADY_MEMBER';
        throw err;
      }
      const memberProfile = await rtdbService.getData(`users/${mUid}`);
      if (memberProfile && normalizeEmail(memberProfile.email) === cleanEmail) {
        const err = new Error('This user is already a member of this workspace.');
        err.statusCode = 400;
        err.code = 'ALREADY_MEMBER';
        throw err;
      }
    }

    if (org.ownerId) {
      const ownerProfile = await rtdbService.getData(`users/${org.ownerId}`);
      if (ownerProfile && normalizeEmail(ownerProfile.email) === cleanEmail) {
        const err = new Error('This user is already a member of this workspace.');
        err.statusCode = 400;
        err.code = 'ALREADY_MEMBER';
        throw err;
      }
    }

    // 6. Check target email eligibility / Registration check (Section 1 & 5B)
    const platformSettings = await rtdbService.getData('platform_settings');
    const requireRegistration = Boolean(
      platformSettings?.workspaces?.requireRegisteredUsersForInvites ||
      req?.requireRegistered ||
      (typeof role === 'object' && role?.requireRegistered)
    );

    if (requireRegistration) {
      const allUsersObj = (await rtdbService.getData('users')) || {};
      const isRegistered = Object.values(allUsersObj).some(
        (u) => u && normalizeEmail(u.email) === cleanEmail
      );
      if (!isRegistered) {
        const err = new Error('This email is not registered with Convia.');
        err.statusCode = 400;
        err.code = 'NOT_REGISTERED';
        throw err;
      }
    }

    // 7. Check for existing pending invitation (Section 10 & 14)
    const existingInvitesObj = (await rtdbService.getData(`workspace_invitations/${workspaceId}`)) || {};
    const existingInvites = Object.values(existingInvitesObj);
    const existingPending = existingInvites.find(
      (inv) =>
        inv &&
        inv.invitedEmail === cleanEmail &&
        inv.status === 'pending' &&
        inv.expiresAt &&
        Date.now() < inv.expiresAt
    );

    if (existingPending) {
      return {
        success: true,
        existing: true,
        invitation: existingPending,
        message: 'An active invitation already exists for this email.',
      };
    }

    // 6. Generate cryptographically secure invitation code
    const rawCode = generateInvitationCode();
    const codeHash = hashInvitationCode(rawCode);
    const timestamp = Date.now();
    const expiresAt = timestamp + INVITATION_EXPIRATION_MS; // Exactly 5 minutes
    const invitationId = `inv_${timestamp}_${crypto.randomBytes(4).toString('hex')}`;

    const invitationRecord = {
      invitationId,
      workspaceId,
      invitedEmail: cleanEmail,
      role: assignedRole,
      invitedBy: userUid,
      status: 'pending',
      codeHash,
      codeDisplay: rawCode,
      createdAt: timestamp,
      expiresAt,
      acceptedAt: null,
      acceptedBy: null,
      revokedAt: null,
    };

    const codeLookupRecord = {
      codeHash,
      invitationId,
      workspaceId,
      invitedEmail: cleanEmail,
      role: assignedRole,
      status: 'pending',
      expiresAt,
      createdAt: timestamp,
    };

    // Atomic persistence of invitation record and lookup mapping
    const atomicUpdates = {
      [`workspace_invitations/${workspaceId}/${invitationId}`]: invitationRecord,
      [`invitation_codes/${codeHash}`]: codeLookupRecord,
    };

    await rtdbService.updateData('', atomicUpdates);

    // 7. Telemetry & Activity Tracking
    const inviterName = req?.user?.displayName || req?.user?.name || 'Workspace Administrator';
    activityService.recordWorkspaceActivity(workspaceId, {
      eventType: ACTIVITY_EVENT_TYPES.WORKSPACE_INVITATION_CREATED || 'workspace.invitation_created',
      actorId: userUid,
      actorType: 'user',
      actorName: inviterName,
      resourceType: 'invitation',
      resourceId: invitationId,
      resourceTitle: cleanEmail,
      summary: `${inviterName} generated an invitation code for ${cleanEmail} (${assignedRole})`,
      createdAt: timestamp,
    }).catch(() => {});

    // 8. In-App Notification (if user already exists on Convia platform)
    (async () => {
      try {
        const usersObj = (await rtdbService.getData('users')) || {};
        const registeredUser = Object.values(usersObj).find(
          (u) => u && normalizeEmail(u.email) === cleanEmail
        );
        if (registeredUser && registeredUser.uid) {
          notificationService.dispatchNotificationEvent(
            NOTIFICATION_TYPES.WORKSPACE_MEMBER_INVITED || 'WORKSPACE_MEMBER_INVITED',
            {
              workspaceId,
              orgName: org.name || 'Workspace',
              role: assignedRole,
            },
            { uid: userUid, displayName: inviterName },
            [registeredUser.uid]
          ).catch(() => {});
        }
      } catch (e) {
        // Notification is non-blocking
      }
    })();

    return {
      success: true,
      existing: false,
      invitation: invitationRecord,
      message: 'Invitation code generated successfully.',
    };
  },

  /**
   * Retrieves all invitations for a workspace.
   * Only Workspace Owner and Authorized Admins may view this list.
   */
  listInvitationsHandler: async (workspaceId, userUid) => {
    if (!workspaceId || !userUid) {
      const err = new Error('Workspace ID and User UID are required.');
      err.statusCode = 400;
      err.code = 'INVALID_PARAMETERS';
      throw err;
    }

    await requireWorkspaceRole(
      workspaceId,
      userUid,
      ['owner', 'admin'],
      'Unauthorized. Only workspace owners and admins can view team invitations.'
    );

    const invitesObj = (await rtdbService.getData(`workspace_invitations/${workspaceId}`)) || {};
    const now = Date.now();
    const invitations = Object.values(invitesObj).map((inv) => {
      const isExpired =
        inv.status === 'pending' &&
        (!inv.expiresAt || isNaN(inv.expiresAt) || now >= inv.expiresAt);
      if (isExpired) {
        return { ...inv, status: 'expired' };
      }
      return inv;
    });

    invitations.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    return { success: true, invitations };
  },

  /**
   * Regenerates an existing pending invitation code.
   * Invalidates the previous code and issues a new unique code with refreshed expiration.
   */
  regenerateInvitationHandler: async (workspaceId, invitationId, userUid, req = null) => {
    if (!workspaceId || !invitationId || !userUid) {
      const err = new Error('Workspace ID, Invitation ID, and User UID are required.');
      err.statusCode = 400;
      err.code = 'INVALID_PARAMETERS';
      throw err;
    }

    await requireWorkspaceRole(
      workspaceId,
      userUid,
      ['owner', 'admin'],
      'Unauthorized. Only workspace owners and admins can regenerate invitations.'
    );

    const existingInvite = await rtdbService.getData(`workspace_invitations/${workspaceId}/${invitationId}`);
    if (!existingInvite) {
      const err = new Error('Invitation record not found.');
      err.statusCode = 404;
      err.code = 'INVITATION_NOT_FOUND';
      throw err;
    }

    if (existingInvite.status !== 'pending' && existingInvite.status !== 'expired') {
      const err = new Error(`Cannot regenerate an invitation that is already ${existingInvite.status}.`);
      err.statusCode = 400;
      err.code = 'INVALID_INVITATION_STATUS';
      throw err;
    }

    const oldCodeHash = existingInvite.codeHash;
    const newRawCode = generateInvitationCode();
    const newCodeHash = hashInvitationCode(newRawCode);
    const timestamp = Date.now();
    const newExpiresAt = timestamp + INVITATION_EXPIRATION_MS; // Exactly 5 minutes

    const updatedInvitation = {
      ...existingInvite,
      status: 'pending',
      codeHash: newCodeHash,
      codeDisplay: newRawCode,
      expiresAt: newExpiresAt,
      updatedAt: timestamp,
    };

    // Invalidate old code hash mapping and save new code hash mapping atomically
    const atomicUpdates = {
      [`workspace_invitations/${workspaceId}/${invitationId}`]: updatedInvitation,
      [`invitation_codes/${oldCodeHash}`]: null, // Fully invalidate previous code
      [`invitation_codes/${newCodeHash}`]: {
        codeHash: newCodeHash,
        invitationId,
        workspaceId,
        invitedEmail: existingInvite.invitedEmail,
        role: existingInvite.role,
        status: 'pending',
        expiresAt: newExpiresAt,
        createdAt: timestamp,
      },
    };

    await rtdbService.updateData('', atomicUpdates);

    // Record activity
    const adminName = req?.user?.displayName || req?.user?.name || 'Workspace Administrator';
    activityService.recordWorkspaceActivity(workspaceId, {
      eventType: ACTIVITY_EVENT_TYPES.WORKSPACE_INVITATION_REGENERATED || 'workspace.invitation_regenerated',
      actorId: userUid,
      actorType: 'user',
      actorName: adminName,
      resourceType: 'invitation',
      resourceId: invitationId,
      resourceTitle: existingInvite.invitedEmail,
      summary: `${adminName} regenerated the invitation code for ${existingInvite.invitedEmail}`,
      createdAt: timestamp,
    }).catch(() => {});

    return {
      success: true,
      invitation: updatedInvitation,
      message: 'Invitation code regenerated successfully.',
    };
  },

  /**
   * Revokes an existing pending invitation.
   */
  revokeInvitationHandler: async (workspaceId, invitationId, userUid, req = null) => {
    if (!workspaceId || !invitationId || !userUid) {
      const err = new Error('Workspace ID, Invitation ID, and User UID are required.');
      err.statusCode = 400;
      err.code = 'INVALID_PARAMETERS';
      throw err;
    }

    await requireWorkspaceRole(
      workspaceId,
      userUid,
      ['owner', 'admin'],
      'Unauthorized. Only workspace owners and admins can revoke invitations.'
    );

    const existingInvite = await rtdbService.getData(`workspace_invitations/${workspaceId}/${invitationId}`);
    if (!existingInvite) {
      const err = new Error('Invitation record not found.');
      err.statusCode = 404;
      err.code = 'INVITATION_NOT_FOUND';
      throw err;
    }

    if (existingInvite.status !== 'pending') {
      const err = new Error(`Cannot revoke an invitation that is already ${existingInvite.status}.`);
      err.statusCode = 400;
      err.code = 'INVALID_INVITATION_STATUS';
      throw err;
    }

    const timestamp = Date.now();
    const updatedInvitation = {
      ...existingInvite,
      status: 'revoked',
      revokedAt: timestamp,
      updatedAt: timestamp,
    };

    const atomicUpdates = {
      [`workspace_invitations/${workspaceId}/${invitationId}`]: updatedInvitation,
      [`invitation_codes/${existingInvite.codeHash}/status`]: 'revoked',
    };

    await rtdbService.updateData('', atomicUpdates);

    // Record activity
    const adminName = req?.user?.displayName || req?.user?.name || 'Workspace Administrator';
    activityService.recordWorkspaceActivity(workspaceId, {
      eventType: ACTIVITY_EVENT_TYPES.WORKSPACE_INVITATION_REVOKED || 'workspace.invitation_revoked',
      actorId: userUid,
      actorType: 'user',
      actorName: adminName,
      resourceType: 'invitation',
      resourceId: invitationId,
      resourceTitle: existingInvite.invitedEmail,
      summary: `${adminName} revoked the invitation for ${existingInvite.invitedEmail}`,
      createdAt: timestamp,
    }).catch(() => {});

    return {
      success: true,
      invitation: updatedInvitation,
      message: 'Invitation revoked successfully.',
    };
  },

  /**
   * Public/Authenticated Code Lookup & Preview.
   * Resolves invitation details for the Join page without sensitive data exposure.
   */
  lookupInvitationByCodeHandler: async (rawCode) => {
    if (!rawCode || typeof rawCode !== 'string' || !rawCode.trim()) {
      const err = new Error('Enter a valid invitation code in the format CNV-XXXX-XXXX.');
      err.statusCode = 400;
      err.code = 'INVALID_CODE';
      throw err;
    }

    const cleanCode = normalizeInvitationCode(rawCode);
    if (!isValidInvitationCodeFormat(cleanCode)) {
      const err = new Error('Enter a valid invitation code in the format CNV-XXXX-XXXX.');
      err.statusCode = 400;
      err.code = 'INVALID_CODE';
      throw err;
    }

    const codeHash = hashInvitationCode(cleanCode);

    const codeRecord = await rtdbService.getData(`invitation_codes/${codeHash}`);
    if (!codeRecord || !codeRecord.workspaceId || !codeRecord.invitationId) {
      const err = new Error('Invitation code not found.');
      err.statusCode = 404;
      err.code = 'INVITATION_NOT_FOUND';
      throw err;
    }

    const invitation = await rtdbService.getData(
      `workspace_invitations/${codeRecord.workspaceId}/${codeRecord.invitationId}`
    );

    if (!invitation) {
      const err = new Error('Invitation code not found.');
      err.statusCode = 404;
      err.code = 'INVITATION_NOT_FOUND';
      throw err;
    }

    if (invitation.status === 'revoked') {
      const err = new Error('This invitation is no longer valid.');
      err.statusCode = 410;
      err.code = 'INVITATION_REVOKED';
      throw err;
    }

    if (invitation.status === 'accepted') {
      const err = new Error('This invitation code has already been used.');
      err.statusCode = 400;
      err.code = 'INVITATION_ALREADY_ACCEPTED';
      throw err;
    }

    if (invitation.status === 'declined') {
      const err = new Error('This invitation was declined.');
      err.statusCode = 400;
      err.code = 'INVITATION_DECLINED';
      throw err;
    }

    const now = Date.now();
    const isExpired =
      !invitation.expiresAt ||
      isNaN(invitation.expiresAt) ||
      now >= invitation.expiresAt ||
      invitation.status === 'expired';
    if (isExpired) {
      if (invitation.status === 'pending') {
        rtdbService
          .updateData('', {
            [`workspace_invitations/${codeRecord.workspaceId}/${codeRecord.invitationId}/status`]: 'expired',
            [`invitation_codes/${codeHash}/status`]: 'expired',
          })
          .catch(() => {});
      }
      const err = new Error('This invitation code has expired.');
      err.statusCode = 400;
      err.code = 'INVITATION_EXPIRED';
      throw err;
    }

    // Resolve workspace details
    const org = await rtdbService.getData(`organizations/${codeRecord.workspaceId}`);
    if (!org || org.isDeleted) {
      const err = new Error('The workspace associated with this invitation is no longer active.');
      err.statusCode = 410;
      err.code = 'WORKSPACE_DELETED';
      throw err;
    }

    return {
      valid: true,
      workspaceId: codeRecord.workspaceId,
      workspaceName: org.name || 'Workspace',
      projectType: org.projectType || 'software',
      description: org.description || '',
      invitedEmail: invitation.invitedEmail,
      role: invitation.role || 'member',
      expiresAt: invitation.expiresAt,
    };
  },

  /**
   * Accepts an invitation code, verifies email binding, verifies capacity, and creates membership.
   * POSSESSION OF THE CODE DOES NOT EQUAL AUTHORIZATION.
   * The authenticated user's email MUST match invitation.invitedEmail.
   */
  acceptInvitationHandler: async (userUid, userEmail, rawCode, req = null) => {
    if (!userUid || !userEmail) {
      const err = new Error('Authentication required. A verified user UID and email are required.');
      err.statusCode = 401;
      err.code = 'UNAUTHORIZED';
      throw err;
    }

    if (!rawCode || typeof rawCode !== 'string' || !rawCode.trim()) {
      const err = new Error('Enter a valid invitation code in the format CNV-XXXX-XXXX.');
      err.statusCode = 400;
      err.code = 'INVALID_CODE';
      throw err;
    }

    const cleanCode = normalizeInvitationCode(rawCode);
    if (!isValidInvitationCodeFormat(cleanCode)) {
      const err = new Error('Enter a valid invitation code in the format CNV-XXXX-XXXX.');
      err.statusCode = 400;
      err.code = 'INVALID_CODE';
      throw err;
    }

    const codeHash = hashInvitationCode(cleanCode);
    const normalizedUserEmail = normalizeEmail(userEmail);

    // 1. Resolve Code Record
    const codeRecord = await rtdbService.getData(`invitation_codes/${codeHash}`);
    if (!codeRecord || !codeRecord.workspaceId || !codeRecord.invitationId) {
      const err = new Error('Invitation code not found.');
      err.statusCode = 404;
      err.code = 'INVITATION_NOT_FOUND';
      throw err;
    }

    const workspaceId = codeRecord.workspaceId;
    const invitationId = codeRecord.invitationId;

    // 2. Fetch Invitation
    const invitation = await rtdbService.getData(`workspace_invitations/${workspaceId}/${invitationId}`);
    if (!invitation) {
      const err = new Error('Invitation code not found.');
      err.statusCode = 404;
      err.code = 'INVITATION_NOT_FOUND';
      throw err;
    }

    // 3. Status checks
    if (invitation.status === 'accepted') {
      const err = new Error('This invitation code has already been used.');
      err.statusCode = 400;
      err.code = 'INVITATION_ALREADY_ACCEPTED';
      throw err;
    }

    if (invitation.status === 'revoked') {
      const err = new Error('This invitation is no longer valid.');
      err.statusCode = 410;
      err.code = 'INVITATION_REVOKED';
      throw err;
    }

    if (invitation.status === 'declined') {
      const err = new Error('This invitation was declined.');
      err.statusCode = 400;
      err.code = 'INVITATION_DECLINED';
      throw err;
    }

    const now = Date.now();
    const isExpired =
      !invitation.expiresAt ||
      isNaN(invitation.expiresAt) ||
      now >= invitation.expiresAt ||
      invitation.status === 'expired';
    if (isExpired) {
      if (invitation.status === 'pending') {
        rtdbService
          .updateData('', {
            [`workspace_invitations/${workspaceId}/${invitationId}/status`]: 'expired',
            [`invitation_codes/${codeHash}/status`]: 'expired',
          })
          .catch(() => {});
      }
      const err = new Error('This invitation code has expired.');
      err.statusCode = 400;
      err.code = 'INVITATION_EXPIRED';
      throw err;
    }

    // 4. CRITICAL SECURITY CHECK: Authenticated Email MUST match Invited Email
    const normalizedInvitedEmail = normalizeEmail(invitation.invitedEmail);
    if (normalizedUserEmail !== normalizedInvitedEmail) {
      const err = new Error(
        'This invitation is assigned to a different Convia account. Please sign in with the invited Convia account.'
      );
      err.statusCode = 403;
      err.code = 'WRONG_ACCOUNT';
      throw err;
    }

    // 5. Workspace Existence & Capacity Validation
    const org = await rtdbService.getData(`organizations/${workspaceId}`);
    if (!org) {
      const err = new Error('The workspace associated with this invitation was not found.');
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

    // 6. Check Duplicate Membership (Idempotent Join)
    const existingMember = await rtdbService.getData(`organization_members/${workspaceId}/${userUid}`);
    if (existingMember) {
      await rtdbService.updateData(`users/${userUid}`, { organizationId: workspaceId });
      return {
        success: true,
        workspaceId,
        alreadyMember: true,
        role: existingMember.role || 'member',
        message: "You're already a member of this workspace.",
      };
    }

    // 7. Authoritative Member Limit Enforcement (Section 12, 13 & 24)
    const membersObj = (await rtdbService.getData(`organization_members/${workspaceId}`)) || {};
    const activeMemberCount = countUniqueActiveMembers(membersObj);
    const maxMembersLimit = Number(org.maxMembers) || Number(org.teamSizeLimit) || 5;

    if (activeMemberCount >= maxMembersLimit) {
      const err = new Error('This workspace has reached its member limit.');
      err.statusCode = 400;
      err.code = 'WORKSPACE_FULL';
      throw err;
    }

    // 8. Atomic Acceptance via Firebase Admin SDK
    const timestamp = Date.now();
    const newMemberCount = activeMemberCount + 1;
    // Default or invited role (Role escalation defense: cannot be owner)
    const assignedRole = invitation.role === 'admin' ? 'admin' : 'member';

    const atomicUpdates = {
      [`organization_members/${workspaceId}/${userUid}`]: {
        uid: userUid,
        role: assignedRole,
        joinedAt: timestamp,
      },
      [`organizations/${workspaceId}/memberCount`]: newMemberCount,
      [`organizations/${workspaceId}/updatedAt`]: timestamp,
      [`users/${userUid}/organizationId`]: workspaceId,
      [`workspace_invitations/${workspaceId}/${invitationId}/status`]: 'accepted',
      [`workspace_invitations/${workspaceId}/${invitationId}/acceptedAt`]: timestamp,
      [`workspace_invitations/${workspaceId}/${invitationId}/acceptedBy`]: userUid,
      [`invitation_codes/${codeHash}/status`]: 'accepted',
    };

    const wsAlias = await rtdbService.getData(`workspaces/${workspaceId}`);
    if (wsAlias) {
      atomicUpdates[`workspaces/${workspaceId}/memberCount`] = newMemberCount;
      atomicUpdates[`workspaces/${workspaceId}/updatedAt`] = timestamp;
    }

    await rtdbService.updateData('', atomicUpdates);

    // 9. Telemetry & Activity Record
    const memberName = req?.user?.displayName || req?.user?.name || userEmail.split('@')[0];
    activityService.recordWorkspaceActivity(workspaceId, {
      eventType: ACTIVITY_EVENT_TYPES.WORKSPACE_MEMBER_JOINED || 'workspace.member_joined',
      actorId: userUid,
      actorType: 'user',
      actorName: memberName,
      resourceType: 'workspace',
      resourceId: workspaceId,
      resourceTitle: org.name || 'Workspace',
      summary: `${memberName} accepted the team invitation and joined the workspace (${assignedRole})`,
      createdAt: timestamp,
    }).catch(() => {});

    // 10. Dispatch Member Joined Notification to Workspace Owner
    notificationService.dispatchNotificationEvent(
      NOTIFICATION_TYPES.WORKSPACE_MEMBER_JOINED || 'WORKSPACE_MEMBER_JOINED',
      {
        workspaceId,
        memberUid: userUid,
        memberName,
      },
      { uid: userUid, displayName: memberName }
    ).catch(() => {});

    return {
      success: true,
      workspaceId,
      role: assignedRole,
      alreadyMember: false,
      memberCount: newMemberCount,
      message: 'Joined workspace successfully.',
    };
  },

  /**
   * Declines an invitation code. Only the authenticated invited user can decline.
   */
  declineInvitationHandler: async (userUid, userEmail, rawCode) => {
    if (!userUid || !userEmail) {
      const err = new Error('Authentication required.');
      err.statusCode = 401;
      err.code = 'UNAUTHORIZED';
      throw err;
    }

    const cleanCode = normalizeInvitationCode(rawCode);
    const codeHash = hashInvitationCode(cleanCode);
    const normalizedUserEmail = normalizeEmail(userEmail);

    const codeRecord = await rtdbService.getData(`invitation_codes/${codeHash}`);
    if (!codeRecord || !codeRecord.workspaceId || !codeRecord.invitationId) {
      const err = new Error('Invalid invitation code.');
      err.statusCode = 404;
      err.code = 'INVITATION_NOT_FOUND';
      throw err;
    }

    const invitation = await rtdbService.getData(
      `workspace_invitations/${codeRecord.workspaceId}/${codeRecord.invitationId}`
    );
    if (!invitation) {
      const err = new Error('Invitation record not found.');
      err.statusCode = 404;
      err.code = 'INVITATION_NOT_FOUND';
      throw err;
    }

    if (normalizedUserEmail !== normalizeEmail(invitation.invitedEmail)) {
      const err = new Error('You cannot decline an invitation that was not addressed to you.');
      err.statusCode = 403;
      err.code = 'UNAUTHORIZED_DECLINE';
      throw err;
    }

    if (invitation.status !== 'pending') {
      const err = new Error(`Cannot decline an invitation that is already ${invitation.status}.`);
      err.statusCode = 400;
      err.code = 'INVALID_INVITATION_STATUS';
      throw err;
    }

    const timestamp = Date.now();
    const atomicUpdates = {
      [`workspace_invitations/${codeRecord.workspaceId}/${codeRecord.invitationId}/status`]: 'declined',
      [`workspace_invitations/${codeRecord.workspaceId}/${codeRecord.invitationId}/declinedAt`]: timestamp,
      [`workspace_invitations/${codeRecord.workspaceId}/${codeRecord.invitationId}/declinedBy`]: userUid,
      [`invitation_codes/${codeHash}/status`]: 'declined',
    };

    await rtdbService.updateData('', atomicUpdates);

    return {
      success: true,
      message: 'Invitation declined.',
    };
  },
};
