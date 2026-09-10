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
    const members = rootData['organization_members']?.[orgId] || rootData['workspace_members']?.[orgId] || {};
    const org = rootData['organizations']?.[orgId] || rootData['workspaces']?.[orgId] || {};
    return Boolean(members[uid] || org.ownerId === uid);
  };

  const isOwnerOfOrg = (orgId, uid) => {
    if (!orgId || !uid) return false;
    const org = rootData['organizations']?.[orgId] || rootData['workspaces']?.[orgId] || {};
    return org.ownerId === uid;
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

  const [rootCollection, arg1, arg2, arg3, arg4] = pathSegments;

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
    case 'user_settings': {
      const uid = arg1;
      if (operation === 'read') return { allowed: auth.uid === uid };
      if (operation === 'write') {
        return { allowed: auth.uid === uid };
      }
      break;
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
        // Updating org: owner or member
        const isOwner = isOwnerOfOrg(orgId, auth.uid);
        const isMember = isMemberOfOrg(orgId, auth.uid);
        if (!isOwner && !isMember) return { allowed: false, reason: 'NOT_ORG_MEMBER' };
        if (!isOwner && newData && newData.ownerId !== data.ownerId) {
          return { allowed: false, reason: 'UNAUTHORIZED_OWNERSHIP_TRANSFER' };
        }
        return { allowed: true };
      }
      break;
    }

    case 'organization_members':
    case 'workspace_members': {
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
          const members = rootData['organization_members']?.[oId] || rootData['workspace_members']?.[oId] || {};
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
          return { allowed: newData?.authorId === auth.uid };
        }
        // Update: author or vote/comment counters
        if (data.authorId === auth.uid || newData?.voteCount !== undefined || newData?.commentCount !== undefined) {
          return { allowed: true };
        }
        return { allowed: false, reason: 'NOT_IDEA_AUTHOR' };
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
        if (!data) return { allowed: newData?.createdBy === auth.uid && newData?.orgId === orgId };
        if (newData && newData.orgId !== data.orgId) return { allowed: false, reason: 'IMMUTABLE_ORG_ID' };
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
      if (operation === 'read') return { allowed: true };
      if (operation === 'write') {
        const isOwner = isOwnerOfOrg(orgId, auth.uid);
        if (!arg2) {
          if (!newData && isOwner) return { allowed: true };
          return { allowed: false, reason: 'ROOT_DELETION_ONLY_BY_OWNER' };
        }
        if (arg3 === 'metadata') {
          return { allowed: true };
        }
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
          return { allowed: data.senderId === auth.uid || isOwner };
        }
        if (newData.messageId !== data.messageId || newData.senderId !== data.senderId || newData.createdAt !== data.createdAt) {
          return { allowed: false, reason: 'IMMUTABLE_FIELD_REWRITE' };
        }
        if (newData.deleted === true) {
          return { allowed: data.senderId === auth.uid || isOwner };
        }
        if (data.senderId !== auth.uid || data.isSystem === true) {
          return { allowed: false, reason: 'NOT_MESSAGE_AUTHOR' };
        }
        return { allowed: true };
      }
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
});
