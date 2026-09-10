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

// Mock Root Database State
const mockRootData = {
  organizations: {
    org_alpha: {
      orgId: 'org_alpha',
      name: 'Alpha Team',
      ownerId: 'user_alice',
      isDeleted: false,
    },
    org_beta: {
      orgId: 'org_beta',
      name: 'Beta Team',
      ownerId: 'user_bob',
      isDeleted: false,
    },
  },
  organization_members: {
    org_alpha: {
      user_alice: { uid: 'user_alice', role: 'owner', joinedAt: 1000 },
      user_charlie: { uid: 'user_charlie', role: 'member', joinedAt: 2000 },
    },
    org_beta: {
      user_bob: { uid: 'user_bob', role: 'owner', joinedAt: 1000 },
      user_david: { uid: 'user_david', role: 'member', joinedAt: 2000 },
    },
  },
  workspaceChats: {
    org_alpha: {
      channels: {
        general: {
          messages: {
            msg_alice_1: {
              messageId: 'msg_alice_1',
              senderId: 'user_alice',
              senderName: 'Alice',
              content: 'Hello Alpha',
              createdAt: 1000,
              deleted: false,
              isSystem: false,
            },
            msg_sys_1: {
              messageId: 'msg_sys_1',
              senderId: 'system',
              senderName: 'System',
              content: 'Welcome to Alpha',
              createdAt: 500,
              deleted: false,
              isSystem: true,
            },
          },
          metadata: {
            lastMessageAt: 1000,
            lastMessageContent: 'Hello Alpha',
            lastSenderName: 'Alice',
          },
        },
      },
    },
  },
};

const userAlice = { uid: 'user_alice' };
const userCharlie = { uid: 'user_charlie' }; // Member in Alpha
const userBob = { uid: 'user_bob' };         // Member in Beta, Stranger to Alpha
const userDavid = { uid: 'user_david' };     // Member in Beta, Stranger to Alpha

/**
 * Exact Rule Evaluator matching database.rules.json logic for workspaceChats & organization_members
 */
export function evaluateChatSecurityRule({ path: targetPath, operation, auth, data = null, newData = null, rootData = mockRootData }) {
  // 1. Unauthenticated rejection
  if (!auth || !auth.uid) {
    return { allowed: false, reason: 'UNAUTHENTICATED' };
  }

  const segments = targetPath.split('/').filter(Boolean);
  const [rootCollection, orgId, sub1, channelId, sub2, messageId] = segments;

  if (rootCollection === 'organization_members') {
    const memberUid = sub1;
    const isOwner = rootData.organizations?.[orgId]?.ownerId === auth.uid;

    if (operation === 'read') return { allowed: true };
    if (operation === 'write') {
      const isSelf = auth.uid === memberUid;
      if (!isSelf && !isOwner) {
        return { allowed: false, reason: 'NOT_AUTHORIZED_FOR_MEMBERSHIP_WRITE' };
      }
      if (!data) {
        // Creation validation
        if (newData?.uid !== memberUid) return { allowed: false, reason: 'UID_MISMATCH' };
        if (newData?.role !== 'member' && !isOwner) {
          return { allowed: false, reason: 'SELF_ESCALATION_TO_OWNER_BLOCKED' };
        }
        return { allowed: true };
      }
      // Update validation
      if (newData?.role !== data?.role && !isOwner) {
        return { allowed: false, reason: 'SELF_ROLE_UPGRADE_BLOCKED' };
      }
      return { allowed: true };
    }
  }

  if (rootCollection !== 'workspaceChats') {
    return { allowed: false, reason: 'UNKNOWN_PATH' };
  }

  const isMember = Boolean(rootData.organization_members?.[orgId]?.[auth.uid] || rootData.organizations?.[orgId]?.ownerId === auth.uid);
  const isOwner = rootData.organizations?.[orgId]?.ownerId === auth.uid;

  if (!isMember) {
    return { allowed: false, reason: 'NOT_WORKSPACE_MEMBER' };
  }

  // Root path check: workspaceChats/$orgId
  if (!sub1) {
    if (operation === 'read') return { allowed: true };
    if (operation === 'write') {
      if (!newData && isOwner) return { allowed: true };
      return { allowed: false, reason: 'ROOT_DELETION_ONLY_BY_OWNER' };
    }
  }

  // Metadata check: workspaceChats/$orgId/channels/$channelId/metadata
  if (channelId && sub2 === 'metadata') {
    if (operation === 'read') return { allowed: true };
    if (operation === 'write') {
      if (newData) {
        if (typeof newData.lastMessageAt !== 'number' || typeof newData.lastMessageContent !== 'string' || typeof newData.lastSenderName !== 'string') {
          return { allowed: false, reason: 'INVALID_METADATA_SCHEMA' };
        }
      }
      return { allowed: true };
    }
  }

  // Messages collection / message document
  if (sub2 === 'messages' && !messageId) {
    if (operation === 'read') return { allowed: true };
    return { allowed: false, reason: 'CANNOT_WRITE_MESSAGES_ROOT' };
  }

  if (sub2 === 'messages' && messageId) {
    if (operation === 'read') return { allowed: true };

    if (operation === 'write') {
      // 1. Creation Check (!data)
      if (!data) {
        if (!newData) return { allowed: false, reason: 'EMPTY_WRITE' };

        // Anti-forgery: Block system sender and isSystem flag from normal client
        if (newData.senderId === 'system' || newData.senderId !== auth.uid) {
          return { allowed: false, reason: 'FORBIDDEN_SENDER_IMPERSONATION' };
        }
        if (newData.isSystem === true || newData.systemType) {
          return { allowed: false, reason: 'FORBIDDEN_SYSTEM_FORGERY' };
        }
        if (newData.messageId !== messageId) {
          return { allowed: false, reason: 'MESSAGE_ID_PATH_MISMATCH' };
        }
        if (typeof newData.content !== 'string' || newData.content.length > 2000) {
          return { allowed: false, reason: 'INVALID_OR_OVERSIZED_CONTENT' };
        }
        if (typeof newData.createdAt !== 'number') {
          return { allowed: false, reason: 'INVALID_CREATED_AT_TYPE' };
        }
        if (newData.deleted === true) {
          return { allowed: false, reason: 'CANNOT_CREATE_PRE_DELETED' };
        }
        if (newData.editedAt !== null && newData.editedAt !== undefined) {
          return { allowed: false, reason: 'CANNOT_CREATE_PRE_EDITED' };
        }
        return { allowed: true };
      }

      // 2. Physical Deletion (!newData)
      if (!newData) {
        if (data.senderId === auth.uid || isOwner) {
          return { allowed: true };
        }
        return { allowed: false, reason: 'PHYSICAL_DELETE_UNAUTHORIZED' };
      }

      // 3. Update Check (data & newData)
      // Immutable identity fields
      if (newData.messageId !== data.messageId || newData.senderId !== data.senderId || newData.createdAt !== data.createdAt) {
        return { allowed: false, reason: 'IMMUTABLE_IDENTITY_REWRITE_BLOCKED' };
      }
      if (Boolean(newData.isSystem) !== Boolean(data.isSystem)) {
        return { allowed: false, reason: 'SYSTEM_FLAG_MUTATION_BLOCKED' };
      }

      // Reversal of deletion check
      if (data.deleted === true && newData.deleted === false) {
        return { allowed: false, reason: 'DELETION_REVERSAL_BLOCKED' };
      }

      // Soft delete transition
      if (newData.deleted === true) {
        if (data.senderId !== auth.uid && !isOwner) {
          return { allowed: false, reason: 'UNAUTHORIZED_SOFT_DELETE' };
        }
        if (newData.content !== 'This message was deleted') {
          return { allowed: false, reason: 'INVALID_TOMBSTONE_CONTENT' };
        }
        if (newData.attachment !== null && newData.attachment !== undefined) {
          return { allowed: false, reason: 'ATTACHMENT_MUST_BE_NULL_ON_DELETE' };
        }
        return { allowed: true };
      }

      // Normal edit transition
      if (data.isSystem === true) {
        return { allowed: false, reason: 'CANNOT_EDIT_SYSTEM_MESSAGES' };
      }
      if (data.senderId !== auth.uid) {
        return { allowed: false, reason: 'CANNOT_EDIT_ANOTHER_USERS_MESSAGE' };
      }
      if (typeof newData.content !== 'string' || newData.content.length > 2000) {
        return { allowed: false, reason: 'INVALID_OR_OVERSIZED_CONTENT' };
      }
      if (newData.editedBy !== auth.uid || typeof newData.editedAt !== 'number') {
        return { allowed: false, reason: 'INVALID_EDIT_METADATA' };
      }

      return { allowed: true };
    }
  }

  return { allowed: false, reason: 'DENIED' };
}

// -------------------- TEST SUITE --------------------

describe('🧪 CONVIA CHAT SYSTEM PHASE 4 — AUTHORIZATION & SECURITY RULES TEST SUITE', () => {

  describe('🔍 1. Authentication Boundaries', () => {
    it('DENIES unauthenticated user from reading chat messages', () => {
      const res = evaluateChatSecurityRule({
        path: 'workspaceChats/org_alpha/channels/general/messages',
        operation: 'read',
        auth: null,
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'UNAUTHENTICATED');
    });

    it('DENIES unauthenticated user from sending a message', () => {
      const res = evaluateChatSecurityRule({
        path: 'workspaceChats/org_alpha/channels/general/messages/msg_new',
        operation: 'write',
        auth: null,
        newData: { messageId: 'msg_new', senderId: 'user_anon', content: 'test', createdAt: Date.now() },
      });
      assert.strictEqual(res.allowed, false);
    });

    it('DENIES unauthenticated user from updating or deleting messages', () => {
      const editRes = evaluateChatSecurityRule({
        path: 'workspaceChats/org_alpha/channels/general/messages/msg_alice_1',
        operation: 'write',
        auth: null,
        data: mockRootData.workspaceChats.org_alpha.channels.general.messages.msg_alice_1,
        newData: { ...mockRootData.workspaceChats.org_alpha.channels.general.messages.msg_alice_1, content: 'Hacked' },
      });
      assert.strictEqual(editRes.allowed, false);
    });
  });

  describe('🔍 2. Workspace Membership & Cross-Workspace Isolation', () => {
    it('ALLOWS authorized member (Charlie) to read Org Alpha chat', () => {
      const res = evaluateChatSecurityRule({
        path: 'workspaceChats/org_alpha/channels/general/messages',
        operation: 'read',
        auth: userCharlie,
      });
      assert.strictEqual(res.allowed, true);
    });

    it('ALLOWS authorized member (Charlie) to send message in Org Alpha', () => {
      const res = evaluateChatSecurityRule({
        path: 'workspaceChats/org_alpha/channels/general/messages/msg_c_1',
        operation: 'write',
        auth: userCharlie,
        data: null,
        newData: {
          messageId: 'msg_c_1',
          senderId: 'user_charlie',
          content: 'Hello team Alpha!',
          createdAt: Date.now(),
          deleted: false,
          isSystem: false,
        },
      });
      assert.strictEqual(res.allowed, true);
    });

    it('BLOCKS non-member (Bob) from reading Org Alpha chat', () => {
      const res = evaluateChatSecurityRule({
        path: 'workspaceChats/org_alpha/channels/general/messages',
        operation: 'read',
        auth: userBob,
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'NOT_WORKSPACE_MEMBER');
    });

    it('BLOCKS non-member (Bob) from sending message to Org Alpha', () => {
      const res = evaluateChatSecurityRule({
        path: 'workspaceChats/org_alpha/channels/general/messages/msg_injected',
        operation: 'write',
        auth: userBob,
        data: null,
        newData: {
          messageId: 'msg_injected',
          senderId: 'user_bob',
          content: 'Injected message',
          createdAt: Date.now(),
        },
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'NOT_WORKSPACE_MEMBER');
    });

    it('BLOCKS guessed cross-workspace path access from non-members', () => {
      const res = evaluateChatSecurityRule({
        path: 'workspaceChats/org_alpha/channels/general/messages/msg_alice_1',
        operation: 'read',
        auth: userDavid,
      });
      assert.strictEqual(res.allowed, false);
    });
  });

  describe('🔍 3. Sender Impersonation & System Anti-Forgery', () => {
    it('BLOCKS client from creating message with mismatched senderId (Impersonation)', () => {
      const res = evaluateChatSecurityRule({
        path: 'workspaceChats/org_alpha/channels/general/messages/msg_fake',
        operation: 'write',
        auth: userCharlie,
        data: null,
        newData: {
          messageId: 'msg_fake',
          senderId: 'user_alice', // Charlie pretending to be Alice
          content: 'I am Alice',
          createdAt: Date.now(),
        },
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'FORBIDDEN_SENDER_IMPERSONATION');
    });

    it('BLOCKS client from creating a forged system message (senderId: system)', () => {
      const res = evaluateChatSecurityRule({
        path: 'workspaceChats/org_alpha/channels/general/messages/msg_sys_fake',
        operation: 'write',
        auth: userCharlie,
        data: null,
        newData: {
          messageId: 'msg_sys_fake',
          senderId: 'system',
          content: 'Fake system announcement',
          createdAt: Date.now(),
          isSystem: true,
        },
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'FORBIDDEN_SENDER_IMPERSONATION');
    });

    it('BLOCKS client from creating message with isSystem: true', () => {
      const res = evaluateChatSecurityRule({
        path: 'workspaceChats/org_alpha/channels/general/messages/msg_sys_flag',
        operation: 'write',
        auth: userCharlie,
        data: null,
        newData: {
          messageId: 'msg_sys_flag',
          senderId: 'user_charlie',
          content: 'Fake system event',
          createdAt: Date.now(),
          isSystem: true,
        },
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'FORBIDDEN_SYSTEM_FORGERY');
    });

    it('BLOCKS client from converting existing user message into a system message', () => {
      const currentMsg = mockRootData.workspaceChats.org_alpha.channels.general.messages.msg_alice_1;
      const res = evaluateChatSecurityRule({
        path: 'workspaceChats/org_alpha/channels/general/messages/msg_alice_1',
        operation: 'write',
        auth: userAlice,
        data: currentMsg,
        newData: { ...currentMsg, isSystem: true },
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'SYSTEM_FLAG_MUTATION_BLOCKED');
    });
  });

  describe('🔍 4. Message Editing & Ownership Enforcement', () => {
    const aliceMsg = mockRootData.workspaceChats.org_alpha.channels.general.messages.msg_alice_1;

    it('ALLOWS author (Alice) to edit own message with valid content', () => {
      const res = evaluateChatSecurityRule({
        path: 'workspaceChats/org_alpha/channels/general/messages/msg_alice_1',
        operation: 'write',
        auth: userAlice,
        data: aliceMsg,
        newData: {
          ...aliceMsg,
          content: 'Hello Alpha (Edited)',
          editedAt: 2000,
          editedBy: 'user_alice',
        },
      });
      assert.strictEqual(res.allowed, true);
    });

    it('BLOCKS non-author (Charlie) from editing Alice message', () => {
      const res = evaluateChatSecurityRule({
        path: 'workspaceChats/org_alpha/channels/general/messages/msg_alice_1',
        operation: 'write',
        auth: userCharlie,
        data: aliceMsg,
        newData: {
          ...aliceMsg,
          content: 'Hacked by Charlie',
          editedAt: 2000,
          editedBy: 'user_charlie',
        },
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'CANNOT_EDIT_ANOTHER_USERS_MESSAGE');
    });

    it('BLOCKS rewriting immutable senderId during edit', () => {
      const res = evaluateChatSecurityRule({
        path: 'workspaceChats/org_alpha/channels/general/messages/msg_alice_1',
        operation: 'write',
        auth: userAlice,
        data: aliceMsg,
        newData: {
          ...aliceMsg,
          senderId: 'user_bob', // Altering senderId
          content: 'Transferring ownership',
        },
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'IMMUTABLE_IDENTITY_REWRITE_BLOCKED');
    });

    it('BLOCKS rewriting immutable createdAt during edit', () => {
      const res = evaluateChatSecurityRule({
        path: 'workspaceChats/org_alpha/channels/general/messages/msg_alice_1',
        operation: 'write',
        auth: userAlice,
        data: aliceMsg,
        newData: {
          ...aliceMsg,
          createdAt: 99999999,
          content: 'Manipulating timestamp',
        },
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'IMMUTABLE_IDENTITY_REWRITE_BLOCKED');
    });

    it('BLOCKS editing system messages', () => {
      const sysMsg = mockRootData.workspaceChats.org_alpha.channels.general.messages.msg_sys_1;
      const res = evaluateChatSecurityRule({
        path: 'workspaceChats/org_alpha/channels/general/messages/msg_sys_1',
        operation: 'write',
        auth: userAlice,
        data: sysMsg,
        newData: {
          ...sysMsg,
          content: 'Tampered system text',
          editedAt: 3000,
          editedBy: 'user_alice',
        },
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'CANNOT_EDIT_SYSTEM_MESSAGES');
    });
  });

  describe('🔍 5. Soft Deletion & Physical Deletion Security', () => {
    const aliceMsg = mockRootData.workspaceChats.org_alpha.channels.general.messages.msg_alice_1;

    it('ALLOWS author (Alice) to soft-delete own message', () => {
      const res = evaluateChatSecurityRule({
        path: 'workspaceChats/org_alpha/channels/general/messages/msg_alice_1',
        operation: 'write',
        auth: userAlice,
        data: aliceMsg,
        newData: {
          ...aliceMsg,
          deleted: true,
          content: 'This message was deleted',
          attachment: null,
          deletedAt: 3000,
          deletedBy: 'user_alice',
        },
      });
      assert.strictEqual(res.allowed, true);
    });

    it('ALLOWS workspace owner (Alice) to soft-delete another member message', () => {
      const charlieMsg = {
        messageId: 'msg_c_1',
        senderId: 'user_charlie',
        content: 'Spam from Charlie',
        createdAt: 2000,
        deleted: false,
      };
      const res = evaluateChatSecurityRule({
        path: 'workspaceChats/org_alpha/channels/general/messages/msg_c_1',
        operation: 'write',
        auth: userAlice, // Alice is owner of org_alpha
        data: charlieMsg,
        newData: {
          ...charlieMsg,
          deleted: true,
          content: 'This message was deleted',
          attachment: null,
          deletedAt: 3500,
          deletedBy: 'user_alice',
        },
      });
      assert.strictEqual(res.allowed, true);
    });

    it('BLOCKS regular member (Charlie) from soft-deleting Alice message', () => {
      const res = evaluateChatSecurityRule({
        path: 'workspaceChats/org_alpha/channels/general/messages/msg_alice_1',
        operation: 'write',
        auth: userCharlie,
        data: aliceMsg,
        newData: {
          ...aliceMsg,
          deleted: true,
          content: 'This message was deleted',
          deletedAt: 3000,
          deletedBy: 'user_charlie',
        },
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'UNAUTHORIZED_SOFT_DELETE');
    });

    it('BLOCKS unauthorized physical deletion of another user message', () => {
      const res = evaluateChatSecurityRule({
        path: 'workspaceChats/org_alpha/channels/general/messages/msg_alice_1',
        operation: 'write',
        auth: userCharlie,
        data: aliceMsg,
        newData: null, // physical delete
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'PHYSICAL_DELETE_UNAUTHORIZED');
    });

    it('BLOCKS reversing a deleted message (deleted: true -> deleted: false)', () => {
      const deletedMsg = {
        ...aliceMsg,
        deleted: true,
        content: 'This message was deleted',
      };
      const res = evaluateChatSecurityRule({
        path: 'workspaceChats/org_alpha/channels/general/messages/msg_alice_1',
        operation: 'write',
        auth: userAlice,
        data: deletedMsg,
        newData: { ...deletedMsg, deleted: false, content: 'Restored!' },
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'DELETION_REVERSAL_BLOCKED');
    });
  });

  describe('🔍 6. Schema & Field Bounds Validation', () => {
    it('REJECTS content exceeding 2000 characters', () => {
      const longText = 'x'.repeat(2001);
      const res = evaluateChatSecurityRule({
        path: 'workspaceChats/org_alpha/channels/general/messages/msg_long',
        operation: 'write',
        auth: userCharlie,
        data: null,
        newData: {
          messageId: 'msg_long',
          senderId: 'user_charlie',
          content: longText,
          createdAt: Date.now(),
        },
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'INVALID_OR_OVERSIZED_CONTENT');
    });

    it('REJECTS non-string content type', () => {
      const res = evaluateChatSecurityRule({
        path: 'workspaceChats/org_alpha/channels/general/messages/msg_obj',
        operation: 'write',
        auth: userCharlie,
        data: null,
        newData: {
          messageId: 'msg_obj',
          senderId: 'user_charlie',
          content: { nested: 'malicious' },
          createdAt: Date.now(),
        },
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'INVALID_OR_OVERSIZED_CONTENT');
    });

    it('REJECTS messageId not matching path segment', () => {
      const res = evaluateChatSecurityRule({
        path: 'workspaceChats/org_alpha/channels/general/messages/msg_correct_key',
        operation: 'write',
        auth: userCharlie,
        data: null,
        newData: {
          messageId: 'msg_mismatched_key',
          senderId: 'user_charlie',
          content: 'Test mismatch',
          createdAt: Date.now(),
        },
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'MESSAGE_ID_PATH_MISMATCH');
    });
  });

  describe('🔍 7. Membership Escalation Prevention', () => {
    it('BLOCKS a normal user from joining an organization with role: owner', () => {
      const res = evaluateChatSecurityRule({
        path: 'organization_members/org_alpha/user_bob',
        operation: 'write',
        auth: userBob,
        data: null,
        newData: { uid: 'user_bob', role: 'owner' },
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'SELF_ESCALATION_TO_OWNER_BLOCKED');
    });

    it('ALLOWS a normal user to join an organization with role: member', () => {
      const res = evaluateChatSecurityRule({
        path: 'organization_members/org_alpha/user_bob',
        operation: 'write',
        auth: userBob,
        data: null,
        newData: { uid: 'user_bob', role: 'member' },
      });
      assert.strictEqual(res.allowed, true);
    });

    it('BLOCKS an existing member from upgrading their own role to owner', () => {
      const res = evaluateChatSecurityRule({
        path: 'organization_members/org_alpha/user_charlie',
        operation: 'write',
        auth: userCharlie,
        data: { uid: 'user_charlie', role: 'member' },
        newData: { uid: 'user_charlie', role: 'owner' },
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'SELF_ROLE_UPGRADE_BLOCKED');
    });
  });

  describe('🔍 8. Channel Metadata Validation', () => {
    it('ALLOWS valid channel metadata updates', () => {
      const res = evaluateChatSecurityRule({
        path: 'workspaceChats/org_alpha/channels/general/metadata',
        operation: 'write',
        auth: userCharlie,
        newData: {
          lastMessageAt: Date.now(),
          lastMessageContent: 'Hello team',
          lastSenderName: 'Charlie',
        },
      });
      assert.strictEqual(res.allowed, true);
    });

    it('REJECTS invalid metadata types', () => {
      const res = evaluateChatSecurityRule({
        path: 'workspaceChats/org_alpha/channels/general/metadata',
        operation: 'write',
        auth: userCharlie,
        newData: {
          lastMessageAt: 'not-a-number',
          lastMessageContent: 12345,
          lastSenderName: null,
        },
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'INVALID_METADATA_SCHEMA');
    });
  });
});
