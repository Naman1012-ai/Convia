import { formatWorkspaceJoinDate, formatWorkspaceCreatedDate } from './formatting.js';

/**
 * Authoritative Workspace Member History Lifecycle States:
 * - State A (CREATOR_OWNER): Creator is current Owner -> "👑 Owner" + "Workspace created <date>"
 * - State B (CREATOR_CAPTAIN): Creator was demoted/transferred to Team Captain -> "⚡ Team Captain" + "Original Creator" + "Workspace created <date>"
 * - State C (CREATOR_MEMBER): Creator was demoted/transferred to Member -> "Member" + "Original Creator" + "Workspace created <date>"
 * - State D (NEW_OWNER): Non-creator who became Owner -> "👑 Owner" + "Joined <date>"
 * - State E (CAPTAIN): Non-creator who is Team Captain -> "⚡ Team Captain" + "Joined <date>"
 * - State F (MEMBER): Non-creator who is Regular Member -> "Member" + "Joined <date>"
 */
export const WORKSPACE_MEMBER_STATES = {
  CREATOR_OWNER: 'CREATOR_OWNER',
  CREATOR_CAPTAIN: 'CREATOR_CAPTAIN',
  CREATOR_MEMBER: 'CREATOR_MEMBER',
  NEW_OWNER: 'NEW_OWNER',
  CAPTAIN: 'CAPTAIN',
  MEMBER: 'MEMBER',
};

/**
 * Resolves authoritative workspace membership history for a given member within a workspace.
 *
 * Rules:
 * 1. PLATFORM ACCOUNT TIMESTAMP (users/${uid}.joinedAt / firstSignedInAt) is NEVER used here.
 * 2. Original Workspace Creator (org.createdBy) ALWAYS derives their history timestamp from
 *    org.createdAt (or canonical member record fallback). Their date label is ALWAYS "Workspace created <date>".
 * 3. Invited/Joined members derive their history timestamp strictly from their workspace membership record
 *    (member.joinedAt / member.workspaceJoinedAt / member.membershipCreatedAt).
 * 4. Ownership transfer modifies org.ownerId / org.ownerUid and member roles, but org.createdBy
 *    and org.createdAt remain 100% IMMUTABLE.
 * 5. Authorization strictly derives from current role/ownerUid, NEVER from org.createdBy.
 *
 * @param {Object} member - The member object from workspace roster
 * @param {Object} org - The workspace / organization metadata object
 * @returns {Object} Canonical history details:
 *   - memberUid: string
 *   - isOriginalCreator: boolean
 *   - isOwner: boolean
 *   - isCaptain: boolean
 *   - isRegularMember: boolean
 *   - state: string (from WORKSPACE_MEMBER_STATES)
 *   - timestamp: number | Date | null
 *   - dateText: string (e.g. "Workspace created Sep 17, 2026" or "Joined Sep 28, 2026")
 *   - dateLabelType: 'created' | 'joined' | 'unavailable'
 *   - roleName: string
 *   - badges: Array<{ label: string, variant: string }>
 */
export function getWorkspaceMemberHistory(member, org) {
  if (!member) {
    return {
      memberUid: null,
      isOriginalCreator: false,
      isOwner: false,
      isCaptain: false,
      isRegularMember: false,
      state: WORKSPACE_MEMBER_STATES.MEMBER,
      timestamp: null,
      dateText: 'Join date unavailable',
      dateLabelType: 'unavailable',
      roleName: 'Member',
      badges: [],
    };
  }

  const memberUid = member.uid || member.id;
  const creatorUid = org?.createdBy || null;
  const currentOwnerUid = org?.ownerUid || org?.ownerId || null;

  // Determine if member is the immutable original creator
  // If org.createdBy is defined, it is the authoritative source of truth.
  // If org.createdBy is missing, fall back to ownerId if this workspace has never had createdBy explicitly defined.
  const isOriginalCreator = Boolean(
    creatorUid ? memberUid === creatorUid : (currentOwnerUid && memberUid === currentOwnerUid)
  );

  // Determine current active ownership & roles (authorization is strictly based on current role/ownerUid, NEVER createdBy)
  const isOwner = Boolean(
    (currentOwnerUid && memberUid === currentOwnerUid) || member.role === 'owner'
  );

  const isCaptain = !isOwner && Boolean(
    member.role === 'team_captain' ||
    member.isTeamCaptain ||
    member.role === 'second_owner' ||
    member.isSecondOwner
  );

  const isRegularMember = !isOwner && !isCaptain;

  // State derivation across the 6 canonical states
  let state = WORKSPACE_MEMBER_STATES.MEMBER;
  if (isOriginalCreator) {
    if (isOwner) {
      state = WORKSPACE_MEMBER_STATES.CREATOR_OWNER;
    } else if (isCaptain) {
      state = WORKSPACE_MEMBER_STATES.CREATOR_CAPTAIN;
    } else {
      state = WORKSPACE_MEMBER_STATES.CREATOR_MEMBER;
    }
  } else {
    if (isOwner) {
      state = WORKSPACE_MEMBER_STATES.NEW_OWNER;
    } else if (isCaptain) {
      state = WORKSPACE_MEMBER_STATES.CAPTAIN;
    } else {
      state = WORKSPACE_MEMBER_STATES.MEMBER;
    }
  }

  // Authoritative timestamp derivation:
  // - For original creator: org.createdAt is authoritative
  // - For non-creators: member.workspaceJoinedAt or member.joinedAt is authoritative
  // NEVER use user.createdAt, user.joinedAt, or firstSignedInAt.
  let authoritativeTimestamp = null;
  let dateText = '';
  let dateLabelType = 'unavailable';

  if (isOriginalCreator) {
    authoritativeTimestamp = org?.createdAt ?? member.workspaceJoinedAt ?? member.joinedAt ?? member.membershipCreatedAt ?? null;
    dateText = formatWorkspaceCreatedDate(authoritativeTimestamp);
    dateLabelType = authoritativeTimestamp ? 'created' : 'unavailable';
  } else {
    authoritativeTimestamp = member.workspaceJoinedAt ?? member.joinedAt ?? member.membershipCreatedAt ?? null;
    dateText = formatWorkspaceJoinDate(authoritativeTimestamp);
    dateLabelType = authoritativeTimestamp ? 'joined' : 'unavailable';
  }

  // Determine UI badge sequence
  const badges = [];
  if (isOwner) {
    badges.push({ label: '👑 Owner', variant: 'warning' });
  } else if (isCaptain) {
    badges.push({ label: '⚡ Team Captain', variant: 'primary' });
  } else {
    badges.push({ label: 'Member', variant: 'default' });
  }

  // If the member is the original creator but no longer holds the Owner role (States B & C), add the "Original Creator" badge
  if (isOriginalCreator && !isOwner) {
    badges.push({ label: 'Original Creator', variant: 'default' });
  }

  return {
    memberUid,
    isOriginalCreator,
    isOwner,
    isCaptain,
    isRegularMember,
    state,
    timestamp: authoritativeTimestamp,
    dateText,
    dateLabelType,
    roleName: isOwner ? 'Owner' : isCaptain ? 'Team Captain' : 'Member',
    badges,
  };
}
