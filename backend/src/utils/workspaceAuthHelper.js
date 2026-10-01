import { rtdbService } from '../services/rtdbService.js';
import { validatePathSegment } from './blueprintPathBuilder.js';

/**
 * Convia Canonical Workspace Authorization Utility
 *
 * Provides authoritative, centralized workspace membership resolution,
 * ownership verification, and role hierarchy checks across all backend controllers.
 *
 * Adheres strictly to P0-01 and P1-05 security models:
 * - Checks both canonical 'organizations' and aliased 'workspaces' metadata.
 * - Checks canonical 'organization_members' collection.
 * - Enforces role hierarchy: owner > admin > member.
 */

/**
 * Authoritatively resolves workspace existence, ownership, and user membership.
 *
 * @param {string} rawWorkspaceId - Target workspace/org ID
 * @param {string} rawUserUid - Verified user Auth UID (req.user.uid)
 * @returns {Promise<{
 *   exists: boolean,
 *   workspaceId: string,
 *   org: object|null,
 *   memberRecord: object|null,
 *   isMember: boolean,
 *   isOwner: boolean,
 *   role: string|null,
 * }>}
 */
export async function resolveWorkspaceMembership(rawWorkspaceId, rawUserUid) {
  if (!rawWorkspaceId || typeof rawWorkspaceId !== 'string' || !rawWorkspaceId.trim()) {
    const err = new Error('Workspace ID is required.');
    err.statusCode = 400;
    err.code = 'INVALID_WORKSPACE_ID';
    throw err;
  }

  if (!rawUserUid || typeof rawUserUid !== 'string' || !rawUserUid.trim()) {
    const err = new Error('User UID is required.');
    err.statusCode = 401;
    err.code = 'UNAUTHORIZED';
    throw err;
  }

  const workspaceId = validatePathSegment(rawWorkspaceId.trim(), 'workspaceId');
  const userUid = rawUserUid.trim();

  // Fetch workspace record and membership record in parallel across primary and alias paths
  const [orgRecord, orgMember] = await Promise.all([
    rtdbService.getData(`organizations/${workspaceId}`).then(
      (res) => res || rtdbService.getData(`workspaces/${workspaceId}`)
    ),
    rtdbService.getData(`organization_members/${workspaceId}/${userUid}`),
  ]);

  if (!orgRecord) {
    return {
      exists: false,
      workspaceId,
      org: null,
      memberRecord: null,
      isMember: false,
      isOwner: false,
      isOriginalOwner: false,
      isSecondOwner: false,
      isTeamCaptain: false,
      canManageWorkspace: false,
      role: null,
    };
  }

  const memberRecord = orgMember || null;

  // Primary owner check: check canonical ownerId/ownerUid, memberRecord role, or fallback to createdBy if ownerId is unset
  const isOwner = Boolean(
    (orgRecord.ownerId && orgRecord.ownerId === userUid) ||
    (orgRecord.ownerUid && orgRecord.ownerUid === userUid) ||
    (memberRecord && memberRecord.role === 'owner') ||
    (!orgRecord.ownerId && !orgRecord.ownerUid && orgRecord.createdBy === userUid)
  );

  const isOriginalOwner = Boolean(
    orgRecord.createdBy === userUid ||
    (!orgRecord.createdBy && orgRecord.ownerId === userUid)
  );

  const isTeamCaptain = !isOwner && Boolean(
    memberRecord?.isTeamCaptain ||
    memberRecord?.role === 'team_captain' ||
    memberRecord?.isSecondOwner ||
    memberRecord?.role === 'second_owner'
  );

  const isSecondOwner = !isOwner && Boolean(
    memberRecord?.isSecondOwner ||
    memberRecord?.role === 'second_owner'
  );

  // Both Owner and Team Captain hold ordinary owner-level workspace management privileges
  const canManageWorkspace = Boolean(isOwner || isTeamCaptain);

  // Role string representation for display and canonical 3-role model
  let role = 'member';
  if (isOwner) {
    role = 'owner';
  } else if (isTeamCaptain || isSecondOwner) {
    role = 'team_captain';
  } else if (memberRecord && memberRecord.role) {
    role = String(memberRecord.role).toLowerCase() === 'second_owner' ? 'team_captain' : String(memberRecord.role).toLowerCase();
  } else if (orgRecord.members && orgRecord.members[userUid]) {
    const rawRole = typeof orgRecord.members[userUid] === 'string'
      ? orgRecord.members[userUid].toLowerCase()
      : (orgRecord.members[userUid].role || 'member').toLowerCase();
    role = rawRole === 'second_owner' ? 'team_captain' : rawRole;
  }

  const isMember = Boolean(isOwner || isOriginalOwner || memberRecord || (orgRecord.members && orgRecord.members[userUid]));
  const joinedAt = memberRecord?.joinedAt || (isOwner ? (orgRecord.createdAt || null) : null);

  return {
    exists: true,
    workspaceId,
    org: orgRecord,
    memberRecord,
    joinedAt,
    isMember,
    isOwner,
    isOriginalOwner,
    isSecondOwner,
    isTeamCaptain,
    canManageWorkspace,
    canManageInvitations: canManageWorkspace,
    canManageMembers: canManageWorkspace,
    canEditWorkspaceSettings: canManageWorkspace,
    canManageRoles: canManageWorkspace,
    canTransferOriginalOwnership: isOwner,
    canTransferOwnership: isOwner,
    canPerformProtectedWorkspaceDeletion: isOriginalOwner || isOwner,
    role,
  };
}

/**
 * Ensures the target workspace exists and the user is an active member or owner.
 * Throws structured 404/403 errors if unauthorized.
 *
 * @param {string} workspaceId - Target workspace/org ID
 * @param {string} userUid - Verified user Auth UID
 * @param {string} [customUnauthorizedMsg] - Optional custom error message
 * @returns {Promise<{
 *   workspaceId: string,
 *   org: object,
 *   memberRecord: object|null,
 *   isOwner: boolean,
 *   isOriginalOwner: boolean,
 *   isSecondOwner: boolean,
 *   isTeamCaptain: boolean,
 *   canManageWorkspace: boolean,
 *   role: string,
 * }>}
 */
export async function requireWorkspaceMember(
  workspaceId,
  userUid,
  customUnauthorizedMsg = 'Unauthorized. You must be a member of this workspace to perform this action.'
) {
  const resolved = await resolveWorkspaceMembership(workspaceId, userUid);

  if (!resolved.exists) {
    const err = new Error('Workspace does not exist.');
    err.statusCode = 404;
    err.code = 'WORKSPACE_NOT_FOUND';
    throw err;
  }

  if (!resolved.isMember) {
    const err = new Error(customUnauthorizedMsg);
    err.statusCode = 403;
    err.code = 'FORBIDDEN_NOT_WORKSPACE_MEMBER';
    throw err;
  }

  return {
    workspaceId: resolved.workspaceId,
    org: resolved.org,
    memberRecord: resolved.memberRecord,
    joinedAt: resolved.joinedAt,
    isOwner: resolved.isOwner,
    isOriginalOwner: resolved.isOriginalOwner,
    isSecondOwner: resolved.isSecondOwner,
    isTeamCaptain: resolved.isTeamCaptain,
    canManageWorkspace: resolved.canManageWorkspace,
    canManageInvitations: resolved.canManageInvitations,
    canManageMembers: resolved.canManageMembers,
    canEditWorkspaceSettings: resolved.canEditWorkspaceSettings,
    canManageRoles: resolved.canManageRoles,
    role: resolved.role || 'member',
  };
}

/**
 * Ensures the user holds one of the required roles or permissions in the target workspace.
 * Original Owner and Second Owner implicitly pass owner/admin level management requirements.
 *
 * @param {string} workspaceId - Target workspace/org ID
 * @param {string} userUid - Verified user Auth UID
 * @param {Array<string>} allowedRoles - Allowed roles (e.g. ['owner', 'admin', 'second_owner'])
 * @param {string} [customUnauthorizedMsg] - Optional custom error message
 * @returns {Promise<Object>} Membership object
 */
export async function requireWorkspaceRole(
  workspaceId,
  userUid,
  allowedRoles = ['owner', 'admin', 'team_captain'],
  customUnauthorizedMsg = 'Unauthorized. You do not possess the required workspace role for this operation.'
) {
  const membership = await requireWorkspaceMember(workspaceId, userUid, customUnauthorizedMsg);

  const normalizedAllowed = allowedRoles.map((r) => String(r).toLowerCase());
  const requiresExclusiveOriginalOwner = normalizedAllowed.includes('original_owner') || normalizedAllowed.includes('creator');

  if (requiresExclusiveOriginalOwner) {
    if (membership.isOriginalOwner) return membership;
    const err = new Error(customUnauthorizedMsg || 'Unauthorized. Only the original workspace creator can perform this protected operation.');
    err.statusCode = 403;
    err.code = 'ORIGINAL_OWNER_REQUIRED';
    throw err;
  }

  // Original Owner and Team Captain carry owner-level ordinary management privileges
  if (membership.canManageWorkspace || membership.isOriginalOwner || membership.isTeamCaptain || membership.isSecondOwner) {
    return membership;
  }

  if (normalizedAllowed.includes(membership.role)) {
    return membership;
  }

  const err = new Error(customUnauthorizedMsg);
  err.statusCode = 403;
  err.code = 'INSUFFICIENT_ROLE';
  throw err;
}

/**
 * Counts unique active member UIDs from an authoritative membership records object.
 * Strictly guarantees unique user counting (Set of UIDs) and excludes inactive/removed members.
 *
 * @param {Object|null} membersObj - Dictionary of member records keyed by UID
 * @returns {number} Count of unique active members
 */
export function countUniqueActiveMembers(membersObj) {
  if (!membersObj || typeof membersObj !== 'object') {
    return 0;
  }

  const activeUids = new Set();
  for (const [key, val] of Object.entries(membersObj)) {
    if (!val || typeof val !== 'object') continue;
    // Exclude explicitly soft-deleted, removed, or inactive member records
    if (val.status === 'inactive' || val.status === 'removed' || val.isDeleted) {
      continue;
    }
    const uid = val.uid || key;
    if (uid && typeof uid === 'string' && uid.trim()) {
      activeUids.add(uid.trim());
    }
  }

  return activeUids.size;
}

/**
 * Authoritatively retrieves the active workspace member count from canonical RTDB data.
 * Reads directly from organization_members/{workspaceId}.
 *
 * @param {string} rawWorkspaceId - Target workspace/org ID
 * @returns {Promise<number>} Canonical active member count
 */
export async function getActiveWorkspaceMemberCount(rawWorkspaceId) {
  if (!rawWorkspaceId || typeof rawWorkspaceId !== 'string' || !rawWorkspaceId.trim()) {
    return 0;
  }

  const workspaceId = validatePathSegment(rawWorkspaceId.trim(), 'workspaceId');
  const membersObj = await rtdbService.getData(`organization_members/${workspaceId}`);
  return countUniqueActiveMembers(membersObj);
}

/**
 * Reconciles the denormalized memberCount on organizations/{workspaceId}
 * with the authoritative active records in organization_members/{workspaceId}.
 *
 * @param {string} rawWorkspaceId - Target workspace/org ID
 * @returns {Promise<{ workspaceId: string, previousCount: number, canonicalCount: number, updated: boolean }>}
 */
export async function reconcileWorkspaceMemberCount(rawWorkspaceId) {
  if (!rawWorkspaceId || typeof rawWorkspaceId !== 'string' || !rawWorkspaceId.trim()) {
    const err = new Error('Workspace ID is required.');
    err.statusCode = 400;
    err.code = 'INVALID_WORKSPACE_ID';
    throw err;
  }

  const workspaceId = validatePathSegment(rawWorkspaceId.trim(), 'workspaceId');
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

  const canonicalCount = countUniqueActiveMembers(membersObj);
  const previousCount = typeof org.memberCount === 'number' ? org.memberCount : null;
  const timestamp = Date.now();

  const updates = {
    [`organizations/${workspaceId}/memberCount`]: canonicalCount,
    [`organizations/${workspaceId}/updatedAt`]: timestamp,
  };

  const wsAlias = await rtdbService.getData(`workspaces/${workspaceId}`);
  if (wsAlias) {
    updates[`workspaces/${workspaceId}/memberCount`] = canonicalCount;
    updates[`workspaces/${workspaceId}/updatedAt`] = timestamp;
  }

  await rtdbService.updateData('', updates);

  return {
    workspaceId,
    previousCount,
    canonicalCount,
    updated: previousCount !== canonicalCount,
  };
}
