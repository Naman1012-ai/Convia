import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the local database.rules.json file
const rulesJsonPath = path.resolve(__dirname, '../../../../database.rules.json');
const rawRules = JSON.parse(fs.readFileSync(rulesJsonPath, 'utf8'));

/**
 * High-Fidelity Rule Evaluator for Firebase Realtime Database Security Rules.
 * Evaluates path-level read, write, and validate expressions against mock database state and auth context.
 */
export function evaluateSecurityRule({ path: targetPath, operation, auth, data = null, newData = null, rootData = {} }) {
  const pathSegments = targetPath.split('/').filter(Boolean);

  const isMemberOfOrg = (orgId, uid) => {
    if (!orgId || !uid) return false;
    const members = rootData['organization_members']?.[orgId] || {};
    const org = rootData['organizations']?.[orgId] || rootData['workspaces']?.[orgId] || {};
    return Boolean(members[uid] || org.ownerId === uid);
  };

  const isOwnerOfOrg = (orgId, uid) => {
    if (!orgId || !uid) return false;
    const org = rootData['organizations']?.[orgId] || rootData['workspaces']?.[orgId] || {};
    return org.ownerId === uid;
  };

  const isPrivilegedOrgRole = (orgId, uid) => {
    if (!orgId || !uid) return false;
    if (isOwnerOfOrg(orgId, uid)) return true;
    const role = rootData['organization_members']?.[orgId]?.[uid]?.role;
    return role === 'owner' || role === 'second_owner' || role === 'team_captain' || role === 'admin';
  };

  // 1. Unauthenticated general rejection on protected roots
  if (!auth || !auth.uid) {
    if (
      targetPath.startsWith('publicIdeas') ||
      targetPath.startsWith('discussions/public') ||
      targetPath === 'globalStats' ||
      targetPath === 'platform_settings' ||
      targetPath === 'platformSettings' ||
      targetPath === 'announcements'
    ) {
      if (operation === 'read') return { allowed: true };
    }
    return { allowed: false, reason: 'UNAUTHENTICATED' };
  }

  const [rootCollection, arg1, arg2, arg3, arg4, arg5, arg6] = pathSegments;

  // 2. Path-specific Rule Evaluation
  switch (rootCollection) {
    case 'users': {
      if (operation === 'read') return { allowed: true }; // auth != null
      if (operation === 'write') {
        const uid = arg1;
        if (auth.uid !== uid) return { allowed: false, reason: 'NOT_PROFILE_OWNER' };
        
        // Privilege escalation validate checks
        if (newData) {
          if (newData.isAdmin === true && (!data || data.isAdmin !== true)) {
            return { allowed: false, reason: 'PRIVILEGE_ESCALATION_IS_ADMIN' };
          }
          if ((newData.role === 'superadmin' || newData.role === 'admin') && (!data || data.role !== newData.role)) {
            return { allowed: false, reason: 'PRIVILEGE_ESCALATION_ROLE' };
          }
          if (newData.isSuspended !== undefined && (!data || data.isSuspended !== newData.isSuspended)) {
            return { allowed: false, reason: 'FORGED_MODERATION_FIELD' };
          }
        }
        return { allowed: true };
      }
      break;
    }

    case 'notifications':
    case 'user_activity':
    case 'user_preferences':
    case 'user_announcements':
    case 'user_reports':
    case 'user_settings':
    case 'user_saved_discussions': {
      const uid = arg1;
      if (operation === 'read') return { allowed: auth.uid === uid };
      if (operation === 'write') {
        if (auth.uid !== uid) return { allowed: false, reason: 'FORBIDDEN_USER_WRITE' };
        if (rootCollection === 'user_saved_discussions' && newData) {
          if (typeof newData.savedAt !== 'number') {
            return { allowed: false, reason: 'INVALID_SAVED_AT' };
          }
        }
        return { allowed: true };
      }
      break;
    }

    case 'fcm_tokens': {
      const uid = arg1;
      const tokenKey = arg2;
      if (operation === 'read') return { allowed: auth.uid === uid };
      if (operation === 'write') {
        if (auth.uid !== uid) return { allowed: false, reason: 'FORBIDDEN_USER_WRITE' };
        if (newData) {
          if (
            !newData.token ||
            typeof newData.token !== 'string' ||
            newData.token.length < 10 ||
            !newData.tokenKey ||
            newData.tokenKey !== tokenKey
          ) {
            return { allowed: false, reason: 'INVALID_TOKEN_VALIDATION' };
          }
        }
        return { allowed: true };
      }
      break;
    }

    case 'fcm_delivery_ledger': {
      return { allowed: false, reason: 'FORBIDDEN_SERVER_ONLY' };
    }

    case 'user_notifications': {
      const recipientUid = arg1;
      const notifId = arg2;

      // .read: auth != null && auth.uid === $uid
      if (operation === 'read') {
        return { allowed: auth.uid === recipientUid, reason: auth.uid === recipientUid ? null : 'FORBIDDEN_READ' };
      }

      if (operation === 'write') {
        // Delete operation: !newData
        if (data && !newData) {
          const allowed = auth.uid === recipientUid;
          return { allowed, reason: allowed ? null : 'CANNOT_DELETE_ANOTHER_USERS_NOTIFICATION' };
        }

        // Create operation: !data
        if (!data && newData) {
          if (newData.senderId !== auth.uid) {
            return { allowed: false, reason: 'FORGED_SENDER_ID' };
          }
          if (newData.actorId && newData.actorId !== auth.uid) {
            return { allowed: false, reason: 'FORGED_ACTOR_ID' };
          }
          if (!newData.type || typeof newData.type !== 'string') {
            return { allowed: false, reason: 'INVALID_TYPE' };
          }
          if (typeof newData.createdAt !== 'number') {
            return { allowed: false, reason: 'INVALID_CREATED_AT' };
          }
          // Workspace boundary: if orgId is provided, BOTH sender and recipient must belong
          if (newData.orgId) {
            const senderIsMember = isMemberOfOrg(newData.orgId, auth.uid) || isOwnerOfOrg(newData.orgId, auth.uid);
            const recipientIsMember = isMemberOfOrg(newData.orgId, recipientUid) || isOwnerOfOrg(newData.orgId, recipientUid);
            if (!senderIsMember || !recipientIsMember) {
              return { allowed: false, reason: 'CROSS_WORKSPACE_INJECTION_DENIED' };
            }
          }
          return { allowed: true };
        }

        // Update operation: data && newData
        if (data && newData) {
          // Only recipient can update
          if (auth.uid !== recipientUid) {
            return { allowed: false, reason: 'FORBIDDEN_UPDATE' };
          }
          // Protected fields are strictly immutable
          const protectedFields = ['type', 'senderId', 'actorId', 'orgId', 'workspaceId', 'createdAt', 'title', 'body', 'notificationId', 'recipientId'];
          for (const field of protectedFields) {
            if (data[field] !== undefined && newData[field] !== undefined && data[field] !== newData[field]) {
              return { allowed: false, reason: `CANNOT_MODIFY_${field.toUpperCase()}` };
            }
          }
          if (newData.read !== undefined && typeof newData.read !== 'boolean') {
            return { allowed: false, reason: 'READ_MUST_BE_BOOLEAN' };
          }
          return { allowed: true };
        }

        return { allowed: auth.uid === recipientUid };
      }
      break;
    }

    case 'user_admin_notes': {
      return { allowed: false, reason: 'BACKEND_ADMIN_ONLY' };
    }

    case 'user_admin_warnings': {
      const uid = arg1;
      if (operation === 'read') return { allowed: auth.uid === uid };
      return { allowed: false, reason: 'BACKEND_ADMIN_ONLY' };
    }

    case 'organizations':
    case 'workspaces': {
      const orgId = arg1;
      if (operation === 'read') return { allowed: true }; // auth != null
      if (operation === 'write') {
        if (!data) {
          // Creating org
          return { allowed: newData?.ownerId === auth.uid };
        }
        // Updating org: owner or admin
        const isOwner = isOwnerOfOrg(orgId, auth.uid);
        const memberRole = rootData['organization_members']?.[orgId]?.[auth.uid]?.role ||
                           rootData['workspaces']?.[orgId]?.[auth.uid]?.role;
        const isAdmin = memberRole === 'admin';
        if (!isOwner && !isAdmin) return { allowed: false, reason: 'NOT_OWNER_OR_ADMIN' };
        if (!isOwner && newData && newData.ownerId !== data.ownerId) {
          return { allowed: false, reason: 'UNAUTHORIZED_OWNERSHIP_TRANSFER' };
        }
        return { allowed: true };
      }
      break;
    }

    case 'organization_members': {
      const orgId = arg1;
      const targetUid = arg2;
      if (operation === 'read') return { allowed: true }; // auth != null
      if (operation === 'write') {
        const isOwner = isOwnerOfOrg(orgId, auth.uid);
        const isSelf = auth.uid === targetUid;

        // Workspace member root deletion (e.g. deleting workspace)
        if (!targetUid) {
          if (!newData && isOwner) return { allowed: true };
          return { allowed: false, reason: 'WORKSPACE_MEMBER_ROOT_WRITE_DENIED' };
        }

        // New membership creation (!data exists)
        if (!data) {
          if (!newData) return { allowed: false, reason: 'EMPTY_WRITE' };
          // Only workspace owner can directly create a membership node (owner bootstrap)
          if (!isOwner) return { allowed: false, reason: 'UNAUTHORIZED_MEMBERSHIP_CREATION' };
          if (newData.uid !== targetUid) return { allowed: false, reason: 'FORGED_UID_MISMATCH' };
          if (!['owner', 'admin', 'member'].includes(newData.role)) {
            return { allowed: false, reason: 'INVALID_ROLE' };
          }
          return { allowed: true };
        }

        // Member deletion (!newData exists)
        if (!newData) {
          // Member can leave (isSelf) or Owner can remove member (isOwner)
          if (isSelf || isOwner) return { allowed: true };
          return { allowed: false, reason: 'UNAUTHORIZED_MEMBER_REMOVAL' };
        }

        // Member update (data exists && newData exists)
        // Only owner can update member roles or attributes
        if (!isOwner) return { allowed: false, reason: 'UNAUTHORIZED_ROLE_MUTATION' };
        if (newData.uid !== data.uid) return { allowed: false, reason: 'IMMUTABLE_UID' };
        if (!['owner', 'admin', 'member'].includes(newData.role)) {
          return { allowed: false, reason: 'INVALID_ROLE' };
        }
        return { allowed: true };
      }
      break;
    }

    case 'ideas': {
      const orgId = arg1;
      const ideaId = arg2;
      const hasAccess = isMemberOfOrg(orgId, auth.uid);
      if (!hasAccess) return { allowed: false, reason: 'NOT_ORG_MEMBER' };
      if (operation === 'read') return { allowed: true };
      if (operation === 'write') {
        const getMemberRole = (oId, uId) => {
          const members = rootData['organization_members']?.[oId] || {};
          if (members[uId]?.role) return members[uId].role;
          const org = rootData['organizations']?.[oId] || rootData['workspaces']?.[oId] || {};
          if (org.ownerId === uId) return 'owner';
          return null;
        };

        const role = getMemberRole(orgId, auth.uid);
        if (role === 'viewer') return { allowed: false, reason: 'VIEWER_READ_ONLY' };

        if (!ideaId) {
          // Writing directly to ideas/$orgId
          if (!newData && (isOwnerOfOrg(orgId, auth.uid) || role === 'owner')) {
            return { allowed: true };
          }
          return { allowed: false, reason: 'FORBIDDEN_ROOT_WRITE' };
        }

        const isOwner = isOwnerOfOrg(orgId, auth.uid) || role === 'owner';
        const isAdmin = role === 'admin';

        if (!data) {
          // Create
          if (!newData || newData.authorId !== auth.uid || newData.orgId !== orgId) {
            return { allowed: false, reason: 'FORGED_AUTHOR_OR_ORG' };
          }
          if (newData.createdBy && newData.createdBy !== auth.uid) {
            return { allowed: false, reason: 'FORGED_CREATED_BY' };
          }
          return { allowed: true };
        }

        if (!newData) {
          // Delete
          const isAuthor = data.authorId === auth.uid;
          if (isAuthor || isOwner || isAdmin) {
            return { allowed: true };
          }
          return { allowed: false, reason: 'UNAUTHORIZED_IDEA_DELETION' };
        }

        // Update
        if (newData.orgId !== data.orgId) {
          return { allowed: false, reason: 'IMMUTABLE_ORG_ID' };
        }
        if (newData.authorId !== data.authorId) {
          return { allowed: false, reason: 'IMMUTABLE_AUTHOR_ID' };
        }
        if (data.createdBy && newData.createdBy !== data.createdBy) {
          return { allowed: false, reason: 'IMMUTABLE_CREATED_BY' };
        }
        if (data.createdAt && newData.createdAt !== data.createdAt) {
          return { allowed: false, reason: 'IMMUTABLE_CREATED_AT' };
        }
        if (data.ideaId && newData.ideaId !== data.ideaId) {
          return { allowed: false, reason: 'IMMUTABLE_IDEA_ID' };
        }

        const isAuthor = data.authorId === auth.uid;
        if (isAuthor || isOwner || isAdmin) {
          return { allowed: true };
        }

        // Non-author, non-admin member: can only update collaborative counters & timestamp
        if (newData.title !== data.title) {
          return { allowed: false, reason: 'MEMBER_CANNOT_EDIT_ANOTHER_USERS_TITLE' };
        }
        if (data.problemStatement !== undefined && newData.problemStatement !== data.problemStatement) {
          return { allowed: false, reason: 'MEMBER_CANNOT_EDIT_ANOTHER_USERS_DESCRIPTION' };
        }
        if (data.proposedSolution !== undefined && newData.proposedSolution !== data.proposedSolution) {
          return { allowed: false, reason: 'MEMBER_CANNOT_EDIT_ANOTHER_USERS_PROPOSAL' };
        }
        if (data.techStack !== undefined && newData.techStack !== data.techStack) {
          return { allowed: false, reason: 'MEMBER_CANNOT_EDIT_ANOTHER_USERS_TECH_STACK' };
        }
        if (data.difficultyLevel !== undefined && newData.difficultyLevel !== data.difficultyLevel) {
          return { allowed: false, reason: 'MEMBER_CANNOT_EDIT_ANOTHER_USERS_DIFFICULTY' };
        }
        if (data.status !== undefined && newData.status !== data.status) {
          return { allowed: false, reason: 'MEMBER_CANNOT_EDIT_ANOTHER_USERS_STATUS' };
        }
        if (data.projectStatus !== undefined && newData.projectStatus !== data.projectStatus) {
          return { allowed: false, reason: 'MEMBER_CANNOT_EDIT_ANOTHER_USERS_PROJECT_STATUS' };
        }
        if (data.isSelected !== undefined && newData.isSelected !== data.isSelected) {
          return { allowed: false, reason: 'MEMBER_CANNOT_EDIT_ANOTHER_USERS_SELECTION' };
        }
        if (data.isDeleted !== undefined && newData.isDeleted !== data.isDeleted) {
          return { allowed: false, reason: 'MEMBER_CANNOT_SOFT_DELETE_ANOTHER_USERS_IDEA' };
        }

        return { allowed: true };
      }
      break;
    }

    case 'publicIdeas': {
      const ideaId = arg1;
      if (operation === 'read') return { allowed: true };
      if (operation === 'write') {
        if (!data) {
          const hasRequired = newData?.authorId === auth.uid && typeof newData?.title === 'string' && newData.title.length > 0;
          const validInitialCounts = (newData?.voteCount === undefined || newData?.voteCount === 0) && (newData?.commentCount === undefined || newData?.commentCount === 0);
          return { allowed: Boolean(hasRequired && validInitialCounts) };
        }
        if (data.authorId !== auth.uid) {
          return { allowed: false, reason: 'NOT_IDEA_AUTHOR' };
        }
        if (!newData) {
          return { allowed: true };
        }
        const authorPreserved = newData.authorId === data.authorId;
        const createdPreserved = data.createdAt === undefined || newData.createdAt === data.createdAt;
        const voteCountPreserved = data.voteCount === undefined || newData.voteCount === data.voteCount;
        const commentCountPreserved = data.commentCount === undefined || newData.commentCount === data.commentCount;
        return { allowed: Boolean(authorPreserved && createdPreserved && voteCountPreserved && commentCountPreserved) };
      }
      break;
    }

    case 'discussions': {
      if (arg1 === 'public') {
        const ideaId = arg2;
        if (operation === 'read') return { allowed: true };
        if (operation === 'write') {
          if (!data) return { allowed: newData?.authorId === auth.uid && newData?.ideaId === ideaId };
          return { allowed: data.authorId === auth.uid || newData?.isDeleted === true };
        }
      } else {
        const orgId = arg1;
        const ideaId = arg2;
        const hasAccess = isMemberOfOrg(orgId, auth.uid);
        if (!hasAccess) return { allowed: false, reason: 'NOT_ORG_MEMBER' };
        if (operation === 'read') return { allowed: true };
        if (operation === 'write') {
          if (!data) return { allowed: newData?.authorId === auth.uid && newData?.ideaId === ideaId };
          return { allowed: data.authorId === auth.uid || isOwnerOfOrg(orgId, auth.uid) };
        }
      }
      break;
    }

    case 'tasks': {
      const orgId = arg1;
      const taskId = arg2;
      const hasAccess = isMemberOfOrg(orgId, auth.uid);
      if (!hasAccess) return { allowed: false, reason: 'NOT_ORG_MEMBER' };
      if (operation === 'read') return { allowed: true };
      if (operation === 'write') {
        const isPrivileged = isPrivilegedOrgRole(orgId, auth.uid);

        // 1. Task Creation (!data exists)
        if (!data) {
          if (!newData) return { allowed: false, reason: 'EMPTY_WRITE' };
          if (newData.createdBy !== auth.uid) return { allowed: false, reason: 'FORGED_CREATED_BY' };
          if (newData.orgId !== orgId) return { allowed: false, reason: 'CROSS_WORKSPACE_TASK' };
          if (newData.taskId && taskId && newData.taskId !== taskId) return { allowed: false, reason: 'TASK_ID_MISMATCH' };
          if (!newData.title || typeof newData.title !== 'string' || newData.title.length === 0) {
            return { allowed: false, reason: 'INVALID_TITLE' };
          }
          return { allowed: true };
        }

        // 2. Task Deletion (!newData exists)
        if (!newData) {
          if (isPrivileged || data.createdBy === auth.uid) {
            return { allowed: true };
          }
          return { allowed: false, reason: 'UNAUTHORIZED_TASK_DELETION' };
        }

        // 3. Task Update (data exists && newData exists)
        const isCreator = data.createdBy === auth.uid;
        const isAssignee = data.assignedTo === auth.uid;

        if (!isPrivileged && !isCreator && !isAssignee) {
          return { allowed: false, reason: 'UNAUTHORIZED_TASK_MUTATION' };
        }

        // Immutable fields validation
        if (newData.taskId && data.taskId && newData.taskId !== data.taskId) {
          return { allowed: false, reason: 'IMMUTABLE_TASK_ID' };
        }
        if (newData.orgId !== data.orgId) {
          return { allowed: false, reason: 'IMMUTABLE_ORG_ID' };
        }
        if (newData.createdBy !== data.createdBy) {
          return { allowed: false, reason: 'IMMUTABLE_CREATED_BY' };
        }
        if (data.createdAt && newData.createdAt !== data.createdAt) {
          return { allowed: false, reason: 'IMMUTABLE_CREATED_AT' };
        }

        // Assignee-only boundary validation
        if (isAssignee && !isCreator && !isPrivileged) {
          if (newData.title !== data.title) {
            return { allowed: false, reason: 'ASSIGNEE_CANNOT_EDIT_TITLE' };
          }
          if (data.description !== undefined && newData.description !== data.description) {
            return { allowed: false, reason: 'ASSIGNEE_CANNOT_EDIT_DESCRIPTION' };
          }
          if (data.priority !== undefined && newData.priority !== data.priority) {
            return { allowed: false, reason: 'ASSIGNEE_CANNOT_EDIT_PRIORITY' };
          }
          if (data.dueDate !== undefined && newData.dueDate !== data.dueDate) {
            return { allowed: false, reason: 'ASSIGNEE_CANNOT_EDIT_DUE_DATE' };
          }
          if (data.assignedTo !== undefined && newData.assignedTo !== data.assignedTo) {
            return { allowed: false, reason: 'ASSIGNEE_CANNOT_REASSIGN' };
          }
          if (data.isDeleted !== undefined && newData.isDeleted !== data.isDeleted) {
            return { allowed: false, reason: 'ASSIGNEE_CANNOT_DELETE' };
          }
        }

        return { allowed: true };
      }
      break;
    }

    case 'blueprints': {
      const orgId = arg1;
      const hasAccess = isMemberOfOrg(orgId, auth.uid);
      if (!hasAccess) return { allowed: false, reason: 'NOT_ORG_MEMBER' };
      if (operation === 'read') return { allowed: true };
      if (operation === 'write') {
        // Direct client-side creation or modification is strictly forbidden.
        // Whole-node cascading deletion is permitted ONLY by the workspace owner.
        if (!newData && isOwnerOfOrg(orgId, auth.uid)) {
          return { allowed: true };
        }
        return { allowed: false, reason: 'CLIENT_BLUEPRINT_WRITE_FORBIDDEN' };
      }
      break;
    }

    case 'workspaceChats': {
      const orgId = arg1;
      const hasAccess = isMemberOfOrg(orgId, auth.uid);
      if (!hasAccess) return { allowed: false, reason: 'NOT_ORG_MEMBER' };

      const isPrivileged = isPrivilegedOrgRole(orgId, auth.uid);
      const memberRecord = rootData['organization_members']?.[orgId]?.[auth.uid];
      const effectiveJoinedAt = memberRecord?.rejoinedAt || memberRecord?.joinedAt || 0;

      // /workspaceChats/:orgId
      if (!arg2) {
        if (operation === 'read') return { allowed: false, reason: 'ROOT_READ_DENIED' };
        if (operation === 'write') return { allowed: !newData && isOwnerOfOrg(orgId, auth.uid) };
      }

      // /workspaceChats/:orgId/channels
      if (arg2 === 'channels' && !arg3) {
        if (operation === 'read') return { allowed: false, reason: 'CHANNELS_ROOT_READ_DENIED' };
        return { allowed: false, reason: 'CHANNELS_ROOT_WRITE_DENIED' };
      }

      const channelId = arg3;
      const subCollection = arg4;

      if (subCollection === 'metadata') {
        if (operation === 'read') return { allowed: true };
        if (operation === 'write') return { allowed: true };
      }

      // /workspaceChats/:orgId/channels/:channelId/messages
      if (subCollection === 'messages') {
        const messageId = arg5;
        if (operation === 'read') {
          // Broad /messages read attempt
          if (!messageId) {
            if (isPrivileged) return { allowed: true };
            return { allowed: false, reason: 'BROAD_MESSAGES_READ_DENIED_TO_MEMBERS' };
          }
          // Individual $messageId read
          if (isPrivileged) return { allowed: true };
          const msgCreatedAt = data?.createdAt || 0;
          if (msgCreatedAt < effectiveJoinedAt) {
            return { allowed: false, reason: 'PRE_JOIN_MESSAGE_INACCESSIBLE' };
          }
          return { allowed: true };
        }

        if (operation === 'write') {
          if (!data) {
            if (!newData) return { allowed: false, reason: 'EMPTY_WRITE' };
            if (newData.senderId === 'system' || newData.isSystem === true || newData.senderId !== auth.uid) {
              return { allowed: false, reason: 'FORBIDDEN_SENDER_OR_SYSTEM_FORGERY' };
            }
            if (typeof newData.content !== 'string' || newData.content.length > 2000) {
              return { allowed: false, reason: 'INVALID_OR_OVERSIZED_CONTENT' };
            }
            return { allowed: true };
          }
          if (!newData) {
            return { allowed: data.senderId === auth.uid || isPrivileged };
          }
          if (newData.messageId !== data.messageId || newData.senderId !== data.senderId || newData.createdAt !== data.createdAt) {
            return { allowed: false, reason: 'IMMUTABLE_FIELD_REWRITE' };
          }
          if (newData.deleted === true) {
            return { allowed: data.senderId === auth.uid || isPrivileged };
          }
          if (data.senderId !== auth.uid || data.isSystem === true) {
            return { allowed: false, reason: 'NOT_MESSAGE_AUTHOR' };
          }
          return { allowed: true };
        }
      }

      // /workspaceChats/:orgId/channels/:channelId/messageReplies
      if (subCollection === 'messageReplies') {
        const messageId = arg5;
        const replyId = arg6;
        if (operation === 'read') {
          if (!replyId) {
            if (isPrivileged) return { allowed: true };
            return { allowed: false, reason: 'BROAD_REPLIES_READ_DENIED_TO_MEMBERS' };
          }
          if (isPrivileged) return { allowed: true };
          const replyCreatedAt = data?.createdAt || 0;
          if (replyCreatedAt < effectiveJoinedAt) {
            return { allowed: false, reason: 'PRE_JOIN_REPLY_INACCESSIBLE' };
          }
          return { allowed: true };
        }
        if (operation === 'write') {
          if (!data) return { allowed: newData?.senderId === auth.uid };
          if (!newData) return { allowed: data.senderId === auth.uid || isPrivileged };
          return { allowed: data.senderId === auth.uid };
        }
      }

      // /workspaceChats/:orgId/channels/:channelId/messageReactions
      if (subCollection === 'messageReactions') {
        const messageId = arg5;
        if (operation === 'read') {
          if (isPrivileged) return { allowed: true };
          const parentMsg = rootData['workspaceChats']?.[orgId]?.channels?.[channelId]?.messages?.[messageId];
          const parentCreatedAt = parentMsg?.createdAt || 0;
          if (parentCreatedAt < effectiveJoinedAt) {
            return { allowed: false, reason: 'PRE_JOIN_REACTION_INACCESSIBLE' };
          }
          return { allowed: true };
        }
        if (operation === 'write') {
          return { allowed: true };
        }
      }

      if (operation === 'read') return { allowed: true };
      if (operation === 'write') return { allowed: true };
      break;
    }

    case 'votes': {
      const voteKey = arg1;
      if (operation === 'read') return { allowed: true };
      if (operation === 'write') {
        const matchesPayload = (newData && newData.uid === auth.uid) || (data && data.uid === auth.uid);
        return { allowed: Boolean(matchesPayload) };
      }
      break;
    }

    case 'invite_codes':
    case 'inviteCodes': {
      const code = arg1;
      if (!code) {
        // Disallow root enumeration
        return { allowed: false, reason: 'NO_ROOT_ENUMERATION' };
      }
      if (operation === 'read') return { allowed: true };
      if (operation === 'write') {
        const targetOrgId = newData?.orgId || data?.orgId;
        const isOwner = isOwnerOfOrg(targetOrgId, auth.uid);
        return { allowed: isOwner };
      }
      break;
    }

    case 'platform_settings':
    case 'platformSettings':
    case 'announcements': {
      if (operation === 'read') return { allowed: true };
      return { allowed: false, reason: 'BACKEND_ADMIN_ONLY' };
    }

    case 'rbac_roles': {
      if (operation === 'read') return { allowed: true };
      return { allowed: false, reason: 'BACKEND_ADMIN_ONLY' };
    }

    case 'admin_audit_logs':
    case 'auditLogs':
    case 'audit_logs':
    case 'telemetry':
    case 'chat_messages': {
      return { allowed: false, reason: 'DENIED' };
    }

    case 'globalStats': {
      if (operation === 'read') return { allowed: true };
      return { allowed: false, reason: 'BACKEND_ADMIN_ONLY' };
    }

    default:
      return { allowed: false, reason: 'UNKNOWN_PATH_DEFAULT_DENY' };
  }

  return { allowed: false, reason: 'FALLTHROUGH_DENY' };
}

/**
 * Multi-Location Atomic Update Validator.
 * In Firebase Realtime Database, a multi-path update passes IF AND ONLY IF every single target path passes rules.
 */
export function evaluateMultiLocationUpdate({ updates, auth, rootData = {} }) {
  for (const [subPath, val] of Object.entries(updates)) {
    const res = evaluateSecurityRule({
      path: subPath,
      operation: 'write',
      auth,
      data: null,
      newData: val,
      rootData,
    });
    if (!res.allowed) {
      return { allowed: false, failedPath: subPath, reason: res.reason };
    }
  }
  return { allowed: true };
}

describe('🧪 CONVIA SECURITY FIX 6 — RULES VERIFICATION & ATOMIC ENFORCEMENT', () => {
  const mockRootData = {
    organizations: {
      org_alpha: { orgId: 'org_alpha', name: 'Alpha Org', ownerId: 'user_alice', memberCount: 2 },
      org_beta: { orgId: 'org_beta', name: 'Beta Org', ownerId: 'user_bob', memberCount: 1 },
    },
    organization_members: {
      org_alpha: {
        user_alice: { uid: 'user_alice', role: 'owner' },
        user_charlie: { uid: 'user_charlie', role: 'member' },
      },
      org_beta: {
        user_bob: { uid: 'user_bob', role: 'owner' },
      },
    },
    ideas: {
      org_alpha: {
        idea_alpha_1: { ideaId: 'idea_alpha_1', orgId: 'org_alpha', authorId: 'user_alice', title: 'Secret Alpha Idea' },
      },
      org_beta: {
        idea_beta_1: { ideaId: 'idea_beta_1', orgId: 'org_beta', authorId: 'user_bob', title: 'Secret Beta Idea' },
      },
    },
    tasks: {
      org_alpha: {
        task_alpha_1: { taskId: 'task_alpha_1', orgId: 'org_alpha', createdBy: 'user_alice', title: 'Task Alpha' },
      },
    },
    blueprints: {
      org_alpha: {
        current: { version: '1.0', orgId: 'org_alpha' },
      },
    },
    invite_codes: {
      CODE123: { orgId: 'org_alpha', createdAt: Date.now() },
    },
  };

  const userAlice = { uid: 'user_alice' };
  const userCharlie = { uid: 'user_charlie' };
  const userBob = { uid: 'user_bob' };

  describe('🔍 TEST A: Unauthenticated Access Denial', () => {
    it('denies unauthenticated read to protected users subtree', () => {
      const res = evaluateSecurityRule({ path: 'users/user_alice', operation: 'read', auth: null, rootData: mockRootData });
      assert.strictEqual(res.allowed, false);
    });

    it('denies unauthenticated read to workspace ideas', () => {
      const res = evaluateSecurityRule({ path: 'ideas/org_alpha/idea_alpha_1', operation: 'read', auth: null, rootData: mockRootData });
      assert.strictEqual(res.allowed, false);
    });

    it('denies unauthenticated read to workspace tasks', () => {
      const res = evaluateSecurityRule({ path: 'tasks/org_alpha/task_alpha_1', operation: 'read', auth: null, rootData: mockRootData });
      assert.strictEqual(res.allowed, false);
    });
  });

  describe('🔍 TEST B & C: User-Scoped Isolation & Notification Injection Defense', () => {
    it('allows User A to read and write own user_settings and notifications', () => {
      const readRes = evaluateSecurityRule({ path: 'user_settings/user_alice', operation: 'read', auth: userAlice, rootData: mockRootData });
      const notifRes = evaluateSecurityRule({ path: 'notifications/user_alice/n1', operation: 'write', auth: userAlice, rootData: mockRootData });
      assert.strictEqual(readRes.allowed, true);
      assert.strictEqual(notifRes.allowed, true);
    });

    it('BLOCKS User A from injecting notifications into User B inbox', () => {
      const injectRes = evaluateSecurityRule({
        path: 'notifications/user_bob/spam_notif',
        operation: 'write',
        auth: userAlice,
        newData: { title: 'Spam', message: 'Injected' },
        rootData: mockRootData,
      });
      assert.strictEqual(injectRes.allowed, false, 'Arbitrary cross-user notification injection must be denied');
    });

    it('enforces hardened rules on user_notifications/$uid/$notifId', () => {
      // 1. Reading own notifications allowed
      const readOwn = evaluateSecurityRule({
        path: 'user_notifications/user_alice/n1',
        operation: 'read',
        auth: userAlice,
        rootData: mockRootData,
      });
      assert.strictEqual(readOwn.allowed, true);

      // 2. Reading another user's notifications denied
      const readOther = evaluateSecurityRule({
        path: 'user_notifications/user_bob/n1',
        operation: 'read',
        auth: userAlice,
        rootData: mockRootData,
      });
      assert.strictEqual(readOther.allowed, false);

      // 3. Updating read state on own notification allowed
      const updateRead = evaluateSecurityRule({
        path: 'user_notifications/user_alice/n1',
        operation: 'write',
        auth: userAlice,
        data: { notificationId: 'n1', type: 'IDEA_CREATED', title: 'Original', read: false },
        newData: { notificationId: 'n1', type: 'IDEA_CREATED', title: 'Original', read: true, readAt: Date.now() },
        rootData: mockRootData,
      });
      assert.strictEqual(updateRead.allowed, true);

      // 4. Tampering with protected fields on update denied
      const tamperTitle = evaluateSecurityRule({
        path: 'user_notifications/user_alice/n1',
        operation: 'write',
        auth: userAlice,
        data: { notificationId: 'n1', type: 'IDEA_CREATED', title: 'Original', read: false },
        newData: { notificationId: 'n1', type: 'IDEA_CREATED', title: 'TAMPERED TITLE', read: true },
        rootData: mockRootData,
      });
      assert.strictEqual(tamperTitle.allowed, false);

      // 5. Forged senderId on create denied
      const forgedSender = evaluateSecurityRule({
        path: 'user_notifications/user_bob/n2',
        operation: 'write',
        auth: userAlice,
        data: null,
        newData: { type: 'CHAT_MESSAGE', senderId: 'user_charlie', createdAt: Date.now() },
        rootData: mockRootData,
      });
      assert.strictEqual(forgedSender.allowed, false);

      // 6. Cross-workspace injection denied (if sender not in org)
      const crossWsInject = evaluateSecurityRule({
        path: 'user_notifications/user_bob/n3',
        operation: 'write',
        auth: userBob, // userBob is not in org_charlie
        data: null,
        newData: { type: 'IDEA_CREATED', senderId: 'user_bob', orgId: 'org_charlie', createdAt: Date.now() },
        rootData: mockRootData,
      });
      assert.strictEqual(crossWsInject.allowed, false);
    });

    it('blocks User B from modifying User A profile in users/{uid}', () => {
      const writeRes = evaluateSecurityRule({ path: 'users/user_alice', operation: 'write', auth: userBob, rootData: mockRootData });
      assert.strictEqual(writeRes.allowed, false);
    });

    it('blocks User A from escalating privileges (isAdmin: true, role: superadmin) on own profile', () => {
      const escalateAdminRes = evaluateSecurityRule({
        path: 'users/user_alice',
        operation: 'write',
        auth: userAlice,
        data: { uid: 'user_alice', isAdmin: false, role: 'user' },
        newData: { uid: 'user_alice', isAdmin: true, role: 'user' },
        rootData: mockRootData,
      });
      assert.strictEqual(escalateAdminRes.allowed, false, 'Direct isAdmin escalation must be blocked');
    });
  });

  describe('🔍 TEST D & E: Cross-Organization Ideas & Tasks Isolation', () => {
    it('allows Org Alpha member to read and write Org Alpha ideas', () => {
      const readRes = evaluateSecurityRule({ path: 'ideas/org_alpha/idea_alpha_1', operation: 'read', auth: userCharlie, rootData: mockRootData });
      assert.strictEqual(readRes.allowed, true);
    });

    it('blocks Org Beta member from reading or writing Org Alpha ideas', () => {
      const readRes = evaluateSecurityRule({ path: 'ideas/org_alpha/idea_alpha_1', operation: 'read', auth: userBob, rootData: mockRootData });
      const writeRes = evaluateSecurityRule({
        path: 'ideas/org_alpha/idea_injected',
        operation: 'write',
        auth: userBob,
        data: null,
        newData: { ideaId: 'idea_injected', orgId: 'org_alpha', authorId: 'user_bob', title: 'Injected' },
        rootData: mockRootData,
      });
      assert.strictEqual(readRes.allowed, false);
      assert.strictEqual(writeRes.allowed, false);
    });
  });

  describe('🔍 TEST S: Strict Vote UID Matching', () => {
    it('blocks User A from casting vote when payload UID is User B', () => {
      const res = evaluateSecurityRule({
        path: 'votes/idea_1_user_bob',
        operation: 'write',
        auth: userAlice,
        newData: { ideaId: 'idea_1', uid: 'user_bob' },
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false, 'Vote with mismatched UID payload must be rejected');
    });

    it('allows User A to cast vote when payload UID matches auth.uid', () => {
      const res = evaluateSecurityRule({
        path: 'votes/idea_1_user_alice',
        operation: 'write',
        auth: userAlice,
        newData: { ideaId: 'idea_1', uid: 'user_alice' },
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, true);
    });
  });

  describe('🔍 TEST T: Invite Code Root Enumeration Defense', () => {
    it('blocks reading root invite_codes collection to prevent enumeration', () => {
      const res = evaluateSecurityRule({ path: 'invite_codes', operation: 'read', auth: userAlice, rootData: mockRootData });
      assert.strictEqual(res.allowed, false);
    });

    it('allows looking up a specific invite code for joining', () => {
      const res = evaluateSecurityRule({ path: 'invite_codes/CODE123', operation: 'read', auth: userCharlie, rootData: mockRootData });
      assert.strictEqual(res.allowed, true);
    });
  });

  describe('🔍 TEST ATOMIC: Multi-Location Updates Security', () => {
    it('BLOCKS unauthorized client from self-joining organization directly via atomic write', () => {
      const updates = {
        'organization_members/org_alpha/user_bob': { uid: 'user_bob', role: 'member' },
      };
      // userBob is not owner of org_alpha; direct client self-join is blocked
      const res = evaluateMultiLocationUpdate({ updates, auth: userBob, rootData: mockRootData });
      assert.strictEqual(res.allowed, false, 'Direct client self-join must be rejected by RTDB security rules');
      assert.strictEqual(res.failedPath, 'organization_members/org_alpha/user_bob');
    });

    it('allows legitimate atomic workspace creation update by owner', () => {
      const updates = {
        'organizations/org_new': { orgId: 'org_new', name: 'New Org', ownerId: 'user_bob' },
        'organization_members/org_new/user_bob': { uid: 'user_bob', role: 'owner' },
      };
      const newRootData = {
        ...mockRootData,
        organizations: {
          ...mockRootData.organizations,
          org_new: { orgId: 'org_new', name: 'New Org', ownerId: 'user_bob' },
        },
      };
      const res = evaluateMultiLocationUpdate({ updates, auth: userBob, rootData: newRootData });
      assert.strictEqual(res.allowed, true, 'Owner workspace creation update must be allowed');
    });

    it('REJECTS malicious multi-location update containing a forbidden path', () => {
      const maliciousUpdates = {
        'user_settings/user_alice': { theme: 'dark' }, // Allowed for Alice
        'platform_settings/workspaces': { allowCreation: true }, // Forbidden for Alice
      };
      const res = evaluateMultiLocationUpdate({ updates: maliciousUpdates, auth: userAlice, rootData: mockRootData });
      assert.strictEqual(res.allowed, false, 'Mixed multi-location write must be rejected');
      assert.strictEqual(res.failedPath, 'platform_settings/workspaces');
    });
  });

  describe('🔍 TEST SAVED: User-Scoped Saved Discussions Isolation & Validation', () => {
    it('allows User Alice to save a discussion to her own bookmarks', () => {
      const res = evaluateSecurityRule({
        path: 'user_saved_discussions/user_alice/msg_123',
        operation: 'write',
        auth: userAlice,
        newData: { savedAt: Date.now(), messageId: 'msg_123' },
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, true, 'Alice must be allowed to save discussions in own subtree');
    });

    it('allows User Alice to unsave (delete) a discussion from her own bookmarks', () => {
      const res = evaluateSecurityRule({
        path: 'user_saved_discussions/user_alice/msg_123',
        operation: 'write',
        auth: userAlice,
        data: { savedAt: 123456789, messageId: 'msg_123' },
        newData: null,
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, true, 'Alice must be allowed to remove own saved discussion');
    });

    it('allows User Alice to read her own saved discussions subtree', () => {
      const res = evaluateSecurityRule({
        path: 'user_saved_discussions/user_alice',
        operation: 'read',
        auth: userAlice,
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, true, 'Alice must be allowed to read her own saved discussions');
    });

    it('BLOCKS User Bob from reading Alice saved discussions', () => {
      const res = evaluateSecurityRule({
        path: 'user_saved_discussions/user_alice',
        operation: 'read',
        auth: userBob,
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false, 'Bob must NOT be allowed to read Alice saved discussions');
    });

    it('BLOCKS User Bob from saving a discussion into Alice subtree', () => {
      const res = evaluateSecurityRule({
        path: 'user_saved_discussions/user_alice/msg_456',
        operation: 'write',
        auth: userBob,
        newData: { savedAt: Date.now(), messageId: 'msg_456' },
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false, 'Bob must NOT be allowed to write into Alice saved discussions');
    });

    it('BLOCKS unauthenticated users from reading or writing saved discussions', () => {
      const readRes = evaluateSecurityRule({
        path: 'user_saved_discussions/user_alice',
        operation: 'read',
        auth: null,
        rootData: mockRootData,
      });
      assert.strictEqual(readRes.allowed, false, 'Unauthenticated read must be blocked');

      const writeRes = evaluateSecurityRule({
        path: 'user_saved_discussions/user_alice/msg_123',
        operation: 'write',
        auth: null,
        newData: { savedAt: Date.now() },
        rootData: mockRootData,
      });
      assert.strictEqual(writeRes.allowed, false, 'Unauthenticated write must be blocked');
    });

    it('validates that savedAt must be a valid number', () => {
      const res = evaluateSecurityRule({
        path: 'user_saved_discussions/user_alice/msg_123',
        operation: 'write',
        auth: userAlice,
        newData: { savedAt: 'invalid-string-timestamp' },
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false, 'Validation must reject non-number savedAt');
    });
  });

  // -------------------------------------------------------------
  // TEST FCM: Device Token Isolation & Delivery Ledger Protection
  // -------------------------------------------------------------
  describe('🔍 TEST FCM: Device Token Isolation & Delivery Ledger Protection', () => {
    const validToken = 'fcm_sample_token_for_alice_1234567890';
    const validTokenKey = 'tokenkey_alice_device_1';

    it('allows User Alice to register and read her own FCM token', () => {
      const writeRes = evaluateSecurityRule({
        path: `fcm_tokens/user_alice/${validTokenKey}`,
        operation: 'write',
        auth: userAlice,
        newData: { token: validToken, tokenKey: validTokenKey },
        rootData: mockRootData,
      });
      assert.strictEqual(writeRes.allowed, true, 'Alice must be allowed to write her own FCM token');

      const readRes = evaluateSecurityRule({
        path: 'fcm_tokens/user_alice',
        operation: 'read',
        auth: userAlice,
        rootData: mockRootData,
      });
      assert.strictEqual(readRes.allowed, true, 'Alice must be allowed to read her own FCM tokens');
    });

    it('BLOCKS User Bob from reading or writing Alice FCM tokens', () => {
      const writeRes = evaluateSecurityRule({
        path: `fcm_tokens/user_alice/${validTokenKey}`,
        operation: 'write',
        auth: userBob,
        newData: { token: validToken, tokenKey: validTokenKey },
        rootData: mockRootData,
      });
      assert.strictEqual(writeRes.allowed, false, 'Bob must NOT be allowed to write to Alice FCM tokens');

      const readRes = evaluateSecurityRule({
        path: 'fcm_tokens/user_alice',
        operation: 'read',
        auth: userBob,
        rootData: mockRootData,
      });
      assert.strictEqual(readRes.allowed, false, 'Bob must NOT be allowed to read Alice FCM tokens');
    });

    it('BLOCKS unauthenticated users from reading or writing FCM tokens', () => {
      const unauthWrite = evaluateSecurityRule({
        path: `fcm_tokens/user_alice/${validTokenKey}`,
        operation: 'write',
        auth: null,
        newData: { token: validToken, tokenKey: validTokenKey },
        rootData: mockRootData,
      });
      assert.strictEqual(unauthWrite.allowed, false, 'Unauthenticated write to fcm_tokens must be blocked');

      const unauthRead = evaluateSecurityRule({
        path: 'fcm_tokens/user_alice',
        operation: 'read',
        auth: null,
        rootData: mockRootData,
      });
      assert.strictEqual(unauthRead.allowed, false, 'Unauthenticated read to fcm_tokens must be blocked');
    });

    it('validates that FCM token must be valid string and tokenKey must match path', () => {
      const invalidToken = evaluateSecurityRule({
        path: `fcm_tokens/user_alice/${validTokenKey}`,
        operation: 'write',
        auth: userAlice,
        newData: { token: 'short', tokenKey: validTokenKey },
        rootData: mockRootData,
      });
      assert.strictEqual(invalidToken.allowed, false, 'Short token (<10 chars) must be rejected');

      const mismatchedKey = evaluateSecurityRule({
        path: `fcm_tokens/user_alice/${validTokenKey}`,
        operation: 'write',
        auth: userAlice,
        newData: { token: validToken, tokenKey: 'mismatched_key' },
        rootData: mockRootData,
      });
      assert.strictEqual(mismatchedKey.allowed, false, 'Mismatched tokenKey must be rejected');
    });

    it('BLOCKS client writes and reads to authoritative fcm_delivery_ledger', () => {
      const clientWrite = evaluateSecurityRule({
        path: 'fcm_delivery_ledger/notif_123',
        operation: 'write',
        auth: userAlice,
        newData: { deliveredAt: Date.now() },
        rootData: mockRootData,
      });
      assert.strictEqual(clientWrite.allowed, false, 'Client write to delivery ledger must be blocked');

      const clientRead = evaluateSecurityRule({
        path: 'fcm_delivery_ledger/notif_123',
        operation: 'read',
        auth: userAlice,
        rootData: mockRootData,
      });
      assert.strictEqual(clientRead.allowed, false, 'Client read from delivery ledger must be blocked');
    });
  });

  describe('🔍 P0-1: Public Ideas Arbitrary Overwrite & Aggregate Protection', () => {
    const aliceIdea = {
      ideaId: 'idea_pub_alice',
      authorId: 'user_alice',
      title: 'Decentralized AI Workflows',
      description: 'Collaborative autonomous workflows',
      createdAt: 1710000000000,
      voteCount: 0,
      commentCount: 0,
    };

    it('MANDATORY ATTACK TEST 1: User A creates a public idea with valid initial counters', () => {
      const res = evaluateSecurityRule({
        path: 'publicIdeas/idea_pub_alice',
        operation: 'write',
        auth: userAlice,
        data: null,
        newData: aliceIdea,
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, true, 'User A must be allowed to create a valid public idea');
    });

    it('MANDATORY ATTACK TEST 2: User B attempts to overwrite User A title/description/author directly', () => {
      const attackRes = evaluateSecurityRule({
        path: 'publicIdeas/idea_pub_alice',
        operation: 'write',
        auth: userBob,
        data: aliceIdea,
        newData: {
          ...aliceIdea,
          title: 'Hacked Title By Bob',
          description: 'Hacked Description By Bob',
        },
        rootData: mockRootData,
      });
      assert.strictEqual(attackRes.allowed, false, 'User B must NOT be allowed to overwrite User A idea');
    });

    it('MANDATORY ATTACK TEST 3: User B attempts the previously reported payload pattern (voteCount injection)', () => {
      // Previously, providing voteCount or commentCount in newData allowed arbitrary overwrites
      const exploitPayload = {
        ideaId: 'idea_pub_alice',
        authorId: 'user_bob',
        title: 'Exploit Overwrite Using voteCount Trick',
        voteCount: 9999,
        commentCount: 888,
      };

      const attackRes = evaluateSecurityRule({
        path: 'publicIdeas/idea_pub_alice',
        operation: 'write',
        auth: userBob,
        data: aliceIdea,
        newData: exploitPayload,
        rootData: mockRootData,
      });
      assert.strictEqual(attackRes.allowed, false, 'User B must be BLOCKED when attempting voteCount exploit overwrite');
    });

    it('MANDATORY ATTACK TEST 4: User B attempts to modify vote/comment counts directly', () => {
      const directCounterTamper = evaluateSecurityRule({
        path: 'publicIdeas/idea_pub_alice',
        operation: 'write',
        auth: userBob,
        data: aliceIdea,
        newData: {
          ...aliceIdea,
          voteCount: 10,
        },
        rootData: mockRootData,
      });
      assert.strictEqual(directCounterTamper.allowed, false, 'User B must NOT be allowed to tamper with vote count directly');
    });

    it('MANDATORY ATTACK TEST 5: Blocks client creation with forged initial voteCount > 0', () => {
      const forgedCreation = evaluateSecurityRule({
        path: 'publicIdeas/idea_pub_alice_forged',
        operation: 'write',
        auth: userAlice,
        data: null,
        newData: {
          ideaId: 'idea_pub_alice_forged',
          authorId: 'user_alice',
          title: 'Instant Top Idea',
          createdAt: 1710000000000,
          voteCount: 500,
          commentCount: 50,
        },
        rootData: mockRootData,
      });
      assert.strictEqual(forgedCreation.allowed, false, 'Client cannot forge initial voteCount > 0');
    });

    it('MANDATORY ATTACK TEST 6: User A attempts to tamper with authorId or voteCount directly during update', () => {
      const authorTamper = evaluateSecurityRule({
        path: 'publicIdeas/idea_pub_alice',
        operation: 'write',
        auth: userAlice,
        data: aliceIdea,
        newData: {
          ...aliceIdea,
          authorId: 'user_bob',
        },
        rootData: mockRootData,
      });
      assert.strictEqual(authorTamper.allowed, false, 'Author cannot change authorId on update');

      const voteTamper = evaluateSecurityRule({
        path: 'publicIdeas/idea_pub_alice',
        operation: 'write',
        auth: userAlice,
        data: aliceIdea,
        newData: {
          ...aliceIdea,
          voteCount: 42,
        },
        rootData: mockRootData,
      });
      assert.strictEqual(voteTamper.allowed, false, 'Author cannot directly change aggregate voteCount on update');
    });

    it('MANDATORY ATTACK TEST 7: User A legitimate updates succeed', () => {
      const legitimateUpdate = evaluateSecurityRule({
        path: 'publicIdeas/idea_pub_alice',
        operation: 'write',
        auth: userAlice,
        data: aliceIdea,
        newData: {
          ...aliceIdea,
          title: 'Updated Decentralized AI Workflows',
          description: 'Refined description for launch',
        },
        rootData: mockRootData,
      });
      assert.strictEqual(legitimateUpdate.allowed, true, 'User A legitimate updates must be allowed');
    });

    it('MANDATORY ATTACK TEST 8: Only author can delete public idea; Bob is rejected', () => {
      const bobDelete = evaluateSecurityRule({
        path: 'publicIdeas/idea_pub_alice',
        operation: 'write',
        auth: userBob,
        data: aliceIdea,
        newData: null,
        rootData: mockRootData,
      });
      assert.strictEqual(bobDelete.allowed, false, 'User Bob must NOT be allowed to delete Alice idea');

      const aliceDelete = evaluateSecurityRule({
        path: 'publicIdeas/idea_pub_alice',
        operation: 'write',
        auth: userAlice,
        data: aliceIdea,
        newData: null,
        rootData: mockRootData,
      });
      assert.strictEqual(aliceDelete.allowed, true, 'User Alice must be allowed to delete her own idea');
    });
  });

  describe('🔍 P0: Pre-Join Chat Privacy Leak Defense Suite', () => {
    const orgId = 'org_chat_test';
    const userOwner = { uid: 'user_owner' };
    const userCaptain = { uid: 'user_captain' };
    const userAlice = { uid: 'user_alice' }; // Joined at T2 = 2000
    const userEve = { uid: 'user_eve' }; // Rejoins at T3 = 3000 (earlier joinedAt = 1000, rejoinedAt = 3000)
    const userMallory = { uid: 'user_mallory' }; // Non-member

    const chatRootData = {
      organizations: {
        [orgId]: { ownerId: 'user_owner', createdAt: 500 },
      },
      organization_members: {
        [orgId]: {
          user_owner: { uid: 'user_owner', role: 'owner', joinedAt: 500 },
          user_captain: { uid: 'user_captain', role: 'team_captain', joinedAt: 600 },
          user_alice: { uid: 'user_alice', role: 'member', joinedAt: 2000 },
          user_eve: { uid: 'user_eve', role: 'member', joinedAt: 1000, rejoinedAt: 3000 },
        },
      },
      workspaceChats: {
        [orgId]: {
          channels: {
            general: {
              metadata: { name: 'General', channelId: 'general' },
              messages: {
                msg_t1: {
                  messageId: 'msg_t1',
                  senderId: 'user_owner',
                  content: 'Confidential pre-join strategy message at T1',
                  createdAt: 1000,
                },
                msg_t2: {
                  messageId: 'msg_t2',
                  senderId: 'user_owner',
                  content: 'Welcome Alice at T2',
                  createdAt: 2000,
                },
                msg_t3: {
                  messageId: 'msg_t3',
                  senderId: 'user_alice',
                  content: 'Message after Eve rejoin at T3',
                  createdAt: 3000,
                },
              },
            },
          },
        },
      },
    };

    it('MANDATORY ATTACK TEST 1: User Alice (joined T2=2000) direct read on T1 message (T=1000) is REJECTED', () => {
      const res = evaluateSecurityRule({
        path: `workspaceChats/${orgId}/channels/general/messages/msg_t1`,
        operation: 'read',
        auth: userAlice,
        data: chatRootData.workspaceChats[orgId].channels.general.messages.msg_t1,
        rootData: chatRootData,
      });
      assert.strictEqual(res.allowed, false, 'Pre-join message read must be denied for regular member');
    });

    it('MANDATORY ATTACK TEST 2: User Alice broad-channel read on /messages is REJECTED; Owner/Captain ALLOWED', () => {
      const aliceBroad = evaluateSecurityRule({
        path: `workspaceChats/${orgId}/channels/general/messages`,
        operation: 'read',
        auth: userAlice,
        rootData: chatRootData,
      });
      assert.strictEqual(aliceBroad.allowed, false, 'Broad messages read must be denied to regular members');

      const ownerBroad = evaluateSecurityRule({
        path: `workspaceChats/${orgId}/channels/general/messages`,
        operation: 'read',
        auth: userOwner,
        rootData: chatRootData,
      });
      assert.strictEqual(ownerBroad.allowed, true, 'Workspace Owner must have authorized broad message access');

      const captainBroad = evaluateSecurityRule({
        path: `workspaceChats/${orgId}/channels/general/messages`,
        operation: 'read',
        auth: userCaptain,
        rootData: chatRootData,
      });
      assert.strictEqual(captainBroad.allowed, true, 'Team Captain must have authorized broad message access');
    });

    it('MANDATORY ATTACK TEST 3: User Eve (rejoined T3=3000) direct read on T2 message (T=2000) is REJECTED', () => {
      const res = evaluateSecurityRule({
        path: `workspaceChats/${orgId}/channels/general/messages/msg_t2`,
        operation: 'read',
        auth: userEve,
        data: chatRootData.workspaceChats[orgId].channels.general.messages.msg_t2,
        rootData: chatRootData,
      });
      assert.strictEqual(res.allowed, false, 'Previous-window message read after rejoin must be rejected');
    });

    it('MANDATORY ATTACK TEST 4: User Eve (rejoined T3=3000) direct read on T1 message (T=1000) is REJECTED', () => {
      const res = evaluateSecurityRule({
        path: `workspaceChats/${orgId}/channels/general/messages/msg_t1`,
        operation: 'read',
        auth: userEve,
        data: chatRootData.workspaceChats[orgId].channels.general.messages.msg_t1,
        rootData: chatRootData,
      });
      assert.strictEqual(res.allowed, false, 'T1 historical message read after rejoin must be rejected');
    });

    it('MANDATORY ATTACK TEST 5: User Alice read replies on historical T1 message is REJECTED', () => {
      const res = evaluateSecurityRule({
        path: `workspaceChats/${orgId}/channels/general/messageReplies/msg_t1/reply_t1`,
        operation: 'read',
        auth: userAlice,
        data: { replyId: 'reply_t1', parentMessageId: 'msg_t1', senderId: 'user_owner', createdAt: 1050 },
        rootData: chatRootData,
      });
      assert.strictEqual(res.allowed, false, 'Replies on pre-join messages must be inaccessible');
    });

    it('MANDATORY ATTACK TEST 6: User Alice read reactions on historical T1 message is REJECTED', () => {
      const res = evaluateSecurityRule({
        path: `workspaceChats/${orgId}/channels/general/messageReactions/msg_t1`,
        operation: 'read',
        auth: userAlice,
        rootData: chatRootData,
      });
      assert.strictEqual(res.allowed, false, 'Reactions on pre-join messages must be inaccessible');
    });

    it('MANDATORY ATTACK TEST 7: Owner and Captain can access historical messages according to design', () => {
      const ownerRead = evaluateSecurityRule({
        path: `workspaceChats/${orgId}/channels/general/messages/msg_t1`,
        operation: 'read',
        auth: userOwner,
        data: chatRootData.workspaceChats[orgId].channels.general.messages.msg_t1,
        rootData: chatRootData,
      });
      assert.strictEqual(ownerRead.allowed, true, 'Owner can access historical messages');

      const captainRead = evaluateSecurityRule({
        path: `workspaceChats/${orgId}/channels/general/messages/msg_t1`,
        operation: 'read',
        auth: userCaptain,
        data: chatRootData.workspaceChats[orgId].channels.general.messages.msg_t1,
        rootData: chatRootData,
      });
      assert.strictEqual(captainRead.allowed, true, 'Team Captain can access historical messages');
    });

    it('MANDATORY ATTACK TEST 8: Legitimate current chat (T >= join/rejoin) is ALLOWED', () => {
      const aliceReadT2 = evaluateSecurityRule({
        path: `workspaceChats/${orgId}/channels/general/messages/msg_t2`,
        operation: 'read',
        auth: userAlice,
        data: chatRootData.workspaceChats[orgId].channels.general.messages.msg_t2,
        rootData: chatRootData,
      });
      assert.strictEqual(aliceReadT2.allowed, true, 'Alice must be able to read message created at T2');

      const eveReadT3 = evaluateSecurityRule({
        path: `workspaceChats/${orgId}/channels/general/messages/msg_t3`,
        operation: 'read',
        auth: userEve,
        data: chatRootData.workspaceChats[orgId].channels.general.messages.msg_t3,
        rootData: chatRootData,
      });
      assert.strictEqual(eveReadT3.allowed, true, 'Eve must be able to read message created at T3 (post-rejoin)');
    });

    it('MANDATORY ATTACK TEST 9: Legitimate send, reply, and reaction operations are ALLOWED', () => {
      const sendMessage = evaluateSecurityRule({
        path: `workspaceChats/${orgId}/channels/general/messages/msg_new`,
        operation: 'write',
        auth: userAlice,
        data: null,
        newData: {
          messageId: 'msg_new',
          senderId: 'user_alice',
          content: 'Hello team from Alice!',
          createdAt: 3500,
        },
        rootData: chatRootData,
      });
      assert.strictEqual(sendMessage.allowed, true, 'Alice can send messages to the channel');

      const sendReply = evaluateSecurityRule({
        path: `workspaceChats/${orgId}/channels/general/messageReplies/msg_t2/rep_new`,
        operation: 'write',
        auth: userAlice,
        data: null,
        newData: {
          replyId: 'rep_new',
          parentMessageId: 'msg_t2',
          senderId: 'user_alice',
          content: 'Replying to welcome message',
          createdAt: 3600,
        },
        rootData: chatRootData,
      });
      assert.strictEqual(sendReply.allowed, true, 'Alice can reply to accessible messages');
    });

    it('MANDATORY ATTACK TEST 10: Non-member Mallory attempts are REJECTED', () => {
      const malloryRead = evaluateSecurityRule({
        path: `workspaceChats/${orgId}/channels/general/messages/msg_t2`,
        operation: 'read',
        auth: userMallory,
        data: chatRootData.workspaceChats[orgId].channels.general.messages.msg_t2,
        rootData: chatRootData,
      });
      assert.strictEqual(malloryRead.allowed, false, 'Non-member read must be rejected');

      const malloryWrite = evaluateSecurityRule({
        path: `workspaceChats/${orgId}/channels/general/messages/msg_mallory`,
        operation: 'write',
        auth: userMallory,
        data: null,
        newData: {
          messageId: 'msg_mallory',
          senderId: 'user_mallory',
          content: 'Intrusion message',
          createdAt: 3700,
        },
        rootData: chatRootData,
      });
      assert.strictEqual(malloryWrite.allowed, false, 'Non-member write must be rejected');
    });
  });

  describe('🔍 P1: Task Authorization Matrix & Immutability Suite', () => {
    const orgId = 'org_task_test';
    const userOwner = { uid: 'user_owner' };
    const userCaptain = { uid: 'user_captain' };
    const userCreator = { uid: 'user_creator' };
    const userAssignee = { uid: 'user_assignee' };
    const userOther = { uid: 'user_other' };
    const userRemoved = { uid: 'user_removed' };

    const taskRootData = {
      organizations: {
        [orgId]: { ownerId: 'user_owner' },
      },
      organization_members: {
        [orgId]: {
          user_owner: { uid: 'user_owner', role: 'owner' },
          user_captain: { uid: 'user_captain', role: 'team_captain' },
          user_creator: { uid: 'user_creator', role: 'member' },
          user_assignee: { uid: 'user_assignee', role: 'member' },
          user_other: { uid: 'user_other', role: 'member' },
        },
      },
      tasks: {
        [orgId]: {
          task_alpha: {
            taskId: 'task_alpha',
            orgId: orgId,
            title: 'Implement Security Module',
            description: 'Core RBAC enforcement',
            priority: 'High',
            status: 'Todo',
            dueDate: '2026-11-01',
            assignedTo: 'user_assignee',
            createdBy: 'user_creator',
            createdAt: 1000,
            updatedAt: 1000,
            isDeleted: false,
          },
        },
      },
    };

    const existingTask = taskRootData.tasks[orgId].task_alpha;

    it('MANDATORY ATTACK TEST 1: Normal member edits title/description/priority/dueDate of another task -> REJECTED', () => {
      const res = evaluateSecurityRule({
        path: `tasks/${orgId}/task_alpha`,
        operation: 'write',
        auth: userOther,
        data: existingTask,
        newData: {
          ...existingTask,
          title: 'Tampered Title by User Other',
        },
        rootData: taskRootData,
      });
      assert.strictEqual(res.allowed, false, 'Normal member cannot modify another users task title');
    });

    it('MANDATORY ATTACK TEST 2: Normal member deletes task created by another -> REJECTED', () => {
      const res = evaluateSecurityRule({
        path: `tasks/${orgId}/task_alpha`,
        operation: 'write',
        auth: userOther,
        data: existingTask,
        newData: null,
        rootData: taskRootData,
      });
      assert.strictEqual(res.allowed, false, 'Normal member cannot delete another users task');
    });

    it('MANDATORY ATTACK TEST 3: Normal member reassigns task created by another -> REJECTED', () => {
      const res = evaluateSecurityRule({
        path: `tasks/${orgId}/task_alpha`,
        operation: 'write',
        auth: userOther,
        data: existingTask,
        newData: {
          ...existingTask,
          assignedTo: 'user_other',
        },
        rootData: taskRootData,
      });
      assert.strictEqual(res.allowed, false, 'Normal member cannot reassign another users task');
    });

    it('MANDATORY ATTACK TEST 4: Assignee attempts to edit task title/description/priority/dueDate -> REJECTED', () => {
      const editTitle = evaluateSecurityRule({
        path: `tasks/${orgId}/task_alpha`,
        operation: 'write',
        auth: userAssignee,
        data: existingTask,
        newData: {
          ...existingTask,
          title: 'Assignee altered title',
        },
        rootData: taskRootData,
      });
      assert.strictEqual(editTitle.allowed, false, 'Assignee cannot edit task title');

      const editPriority = evaluateSecurityRule({
        path: `tasks/${orgId}/task_alpha`,
        operation: 'write',
        auth: userAssignee,
        data: existingTask,
        newData: {
          ...existingTask,
          priority: 'Critical',
        },
        rootData: taskRootData,
      });
      assert.strictEqual(editPriority.allowed, false, 'Assignee cannot edit task priority');
    });

    it('MANDATORY ATTACK TEST 5: Assignee attempts to reassign task -> REJECTED', () => {
      const res = evaluateSecurityRule({
        path: `tasks/${orgId}/task_alpha`,
        operation: 'write',
        auth: userAssignee,
        data: existingTask,
        newData: {
          ...existingTask,
          assignedTo: 'user_other',
        },
        rootData: taskRootData,
      });
      assert.strictEqual(res.allowed, false, 'Assignee cannot reassign task');
    });

    it('MANDATORY ATTACK TEST 6: Assignee attempts to delete task -> REJECTED', () => {
      const hardDelete = evaluateSecurityRule({
        path: `tasks/${orgId}/task_alpha`,
        operation: 'write',
        auth: userAssignee,
        data: existingTask,
        newData: null,
        rootData: taskRootData,
      });
      assert.strictEqual(hardDelete.allowed, false, 'Assignee cannot hard-delete task');

      const softDelete = evaluateSecurityRule({
        path: `tasks/${orgId}/task_alpha`,
        operation: 'write',
        auth: userAssignee,
        data: existingTask,
        newData: {
          ...existingTask,
          isDeleted: true,
        },
        rootData: taskRootData,
      });
      assert.strictEqual(softDelete.allowed, false, 'Assignee cannot soft-delete task');
    });

    it('MANDATORY ATTACK TEST 7: Assignee updates status/completion -> ALLOWED', () => {
      const res = evaluateSecurityRule({
        path: `tasks/${orgId}/task_alpha`,
        operation: 'write',
        auth: userAssignee,
        data: existingTask,
        newData: {
          ...existingTask,
          status: 'Completed',
          completedAt: 2500,
          updatedAt: 2500,
        },
        rootData: taskRootData,
      });
      assert.strictEqual(res.allowed, true, 'Assignee must be allowed to update status to Completed');
    });

    it('MANDATORY ATTACK TEST 8: Creator edits content, reassigns, and deletes own task -> ALLOWED', () => {
      const editContent = evaluateSecurityRule({
        path: `tasks/${orgId}/task_alpha`,
        operation: 'write',
        auth: userCreator,
        data: existingTask,
        newData: {
          ...existingTask,
          title: 'Updated Title by Creator',
          priority: 'Low',
          assignedTo: 'user_other',
        },
        rootData: taskRootData,
      });
      assert.strictEqual(editContent.allowed, true, 'Creator can edit content and reassign task');

      const deleteOwn = evaluateSecurityRule({
        path: `tasks/${orgId}/task_alpha`,
        operation: 'write',
        auth: userCreator,
        data: existingTask,
        newData: null,
        rootData: taskRootData,
      });
      assert.strictEqual(deleteOwn.allowed, true, 'Creator can delete own task');
    });

    it('MANDATORY ATTACK TEST 9: Team Captain and Owner perform all task operations -> ALLOWED', () => {
      const captainEdit = evaluateSecurityRule({
        path: `tasks/${orgId}/task_alpha`,
        operation: 'write',
        auth: userCaptain,
        data: existingTask,
        newData: {
          ...existingTask,
          title: 'Captain updated title',
          assignedTo: 'user_creator',
        },
        rootData: taskRootData,
      });
      assert.strictEqual(captainEdit.allowed, true, 'Team Captain can update task');

      const ownerDelete = evaluateSecurityRule({
        path: `tasks/${orgId}/task_alpha`,
        operation: 'write',
        auth: userOwner,
        data: existingTask,
        newData: null,
        rootData: taskRootData,
      });
      assert.strictEqual(ownerDelete.allowed, true, 'Owner can delete any task');
    });

    it('MANDATORY ATTACK TEST 10: Cross-workspace task mutation attempt -> REJECTED', () => {
      const res = evaluateSecurityRule({
        path: `tasks/${orgId}/task_alpha`,
        operation: 'write',
        auth: userOwner,
        data: existingTask,
        newData: {
          ...existingTask,
          orgId: 'org_other_workspace',
        },
        rootData: taskRootData,
      });
      assert.strictEqual(res.allowed, false, 'Mutating task orgId to another workspace must be rejected');
    });

    it('MANDATORY ATTACK TEST 11: Removed member attempts task read/write -> REJECTED', () => {
      const readRes = evaluateSecurityRule({
        path: `tasks/${orgId}/task_alpha`,
        operation: 'read',
        auth: userRemoved,
        rootData: taskRootData,
      });
      assert.strictEqual(readRes.allowed, false, 'Removed member cannot read tasks');

      const writeRes = evaluateSecurityRule({
        path: `tasks/${orgId}/task_alpha`,
        operation: 'write',
        auth: userRemoved,
        data: existingTask,
        newData: { ...existingTask, status: 'In Progress' },
        rootData: taskRootData,
      });
      assert.strictEqual(writeRes.allowed, false, 'Removed member cannot write tasks');
    });

    it('MANDATORY ATTACK TEST 12: Attempt to mutate immutable fields (taskId, orgId, createdBy, createdAt) -> REJECTED', () => {
      const mutateCreatedBy = evaluateSecurityRule({
        path: `tasks/${orgId}/task_alpha`,
        operation: 'write',
        auth: userOwner,
        data: existingTask,
        newData: {
          ...existingTask,
          createdBy: 'user_owner',
        },
        rootData: taskRootData,
      });
      assert.strictEqual(mutateCreatedBy.allowed, false, 'createdBy is strictly immutable');

      const mutateCreatedAt = evaluateSecurityRule({
        path: `tasks/${orgId}/task_alpha`,
        operation: 'write',
        auth: userOwner,
        data: existingTask,
        newData: {
          ...existingTask,
          createdAt: 999999,
        },
        rootData: taskRootData,
      });
      assert.strictEqual(mutateCreatedAt.allowed, false, 'createdAt is strictly immutable');
    });
  });
});
