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
 * - Checks both 'organization_members' and 'workspace_members' collections.
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
  const [orgRecord, orgMember, wsMember] = await Promise.all([
    rtdbService.getData(`organizations/${workspaceId}`).then(
      (res) => res || rtdbService.getData(`workspaces/${workspaceId}`)
    ),
    rtdbService.getData(`organization_members/${workspaceId}/${userUid}`),
    rtdbService.getData(`workspace_members/${workspaceId}/${userUid}`),
  ]);

  if (!orgRecord) {
    return {
      exists: false,
      workspaceId,
      org: null,
      memberRecord: null,
      isMember: false,
      isOwner: false,
      role: null,
    };
  }

  const memberRecord = orgMember || wsMember || null;
  const isOwner = Boolean(
    orgRecord.ownerId === userUid ||
    orgRecord.createdBy === userUid ||
    orgRecord.ownerUid === userUid
  );

  // Role hierarchy
  let role = null;
  if (isOwner) {
    role = 'owner';
  } else if (memberRecord && memberRecord.role) {
    role = String(memberRecord.role).toLowerCase();
  } else if (memberRecord) {
    role = 'member';
  } else if (orgRecord.members && orgRecord.members[userUid]) {
    role = typeof orgRecord.members[userUid] === 'string'
      ? orgRecord.members[userUid].toLowerCase()
      : (orgRecord.members[userUid].role || 'member').toLowerCase();
  }

  const isMember = Boolean(isOwner || memberRecord || (orgRecord.members && orgRecord.members[userUid]));

  return {
    exists: true,
    workspaceId,
    org: orgRecord,
    memberRecord,
    isMember,
    isOwner,
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
    isOwner: resolved.isOwner,
    role: resolved.role || 'member',
  };
}

/**
 * Ensures the user holds one of the required roles in the target workspace.
 * Owner implicitly passes all role requirements.
 *
 * @param {string} workspaceId - Target workspace/org ID
 * @param {string} userUid - Verified user Auth UID
 * @param {Array<string>} allowedRoles - Allowed roles (e.g. ['owner', 'admin'])
 * @param {string} [customUnauthorizedMsg] - Optional custom error message
 * @returns {Promise<{
 *   workspaceId: string,
 *   org: object,
 *   memberRecord: object|null,
 *   isOwner: boolean,
 *   role: string,
 * }>}
 */
export async function requireWorkspaceRole(
  workspaceId,
  userUid,
  allowedRoles = ['owner', 'admin'],
  customUnauthorizedMsg = 'Unauthorized. You do not possess the required workspace role for this operation.'
) {
  const membership = await requireWorkspaceMember(workspaceId, userUid, customUnauthorizedMsg);

  if (membership.isOwner) {
    return membership;
  }

  const normalizedAllowed = allowedRoles.map((r) => String(r).toLowerCase());
  if (!normalizedAllowed.includes(membership.role)) {
    const err = new Error(customUnauthorizedMsg);
    err.statusCode = 403;
    err.code = 'INSUFFICIENT_ROLE';
    throw err;
  }

  return membership;
}
