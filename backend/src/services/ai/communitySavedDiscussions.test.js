import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load canonical database.rules.json
const rulesPath = path.resolve(__dirname, '../../../../database.rules.json');
const rawRules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));

describe('🔖 CONVIA COMMUNITY SAVED DISCUSSIONS — PERSISTENCE & SECURITY VALIDATION', () => {
  // 1. DATABASE RULES VERIFICATION
  describe('1. RTDB Security Rules Definition', () => {
    it('defines user_saved_discussions at the database root level', () => {
      assert.ok(rawRules.rules.user_saved_discussions, 'user_saved_discussions must be present at root of rules');
    });

    it('enforces auth != null && auth.uid === $uid for both read and write', () => {
      const userSavedRule = rawRules.rules.user_saved_discussions['$uid'];
      assert.ok(userSavedRule, '$uid wildcard node must exist');
      assert.strictEqual(
        userSavedRule['.read'],
        'auth != null && auth.uid === $uid',
        'Read must be strictly restricted to the authenticated owner'
      );
      assert.strictEqual(
        userSavedRule['.write'],
        'auth != null && auth.uid === $uid',
        'Write must be strictly restricted to the authenticated owner'
      );
    });

    it('enforces payload validation with safe deletion support on $messageId', () => {
      const messageRule = rawRules.rules.user_saved_discussions['$uid']['$messageId'];
      assert.ok(messageRule, '$messageId wildcard node must exist');
      assert.ok(
        messageRule['.validate'].includes('newData.hasChildren([\'savedAt\'])'),
        'Must validate savedAt presence'
      );
      assert.ok(
        messageRule['.validate'].includes('newData.child(\'savedAt\').isNumber()'),
        'Must validate savedAt is a numeric timestamp'
      );
      assert.ok(
        messageRule['.validate'].includes('!newData.exists()'),
        'Must permit clean deletion (!newData.exists()) on unsave'
      );
    });
  });

  // 2. PATH FORMATTING & CONVENTIONS
  describe('2. Canonical RTDB Path Conventions', () => {
    const getUserSavedDiscussionsPath = (uid) => {
      if (!uid || typeof uid !== 'string' || !uid.trim()) {
        throw new Error('uid is required');
      }
      return `user_saved_discussions/${uid.trim()}`;
    };

    const getUserSavedDiscussionPath = (uid, messageId) => {
      if (!messageId || typeof messageId !== 'string' || !messageId.trim()) {
        throw new Error('messageId is required');
      }
      return `${getUserSavedDiscussionsPath(uid)}/${messageId.trim()}`;
    };

    it('constructs user-scoped root path: user_saved_discussions/{uid}', () => {
      const p = getUserSavedDiscussionsPath('user_123');
      assert.strictEqual(p, 'user_saved_discussions/user_123');
    });

    it('constructs message item path: user_saved_discussions/{uid}/{messageId}', () => {
      const p = getUserSavedDiscussionPath('user_123', 'msg_abc');
      assert.strictEqual(p, 'user_saved_discussions/user_123/msg_abc');
    });

    it('trims whitespace and rejects blank identifiers', () => {
      const p = getUserSavedDiscussionPath('  user_123  ', '  msg_abc  ');
      assert.strictEqual(p, 'user_saved_discussions/user_123/msg_abc');

      assert.throws(() => getUserSavedDiscussionsPath(''), /uid is required/);
      assert.throws(() => getUserSavedDiscussionPath('user_123', ''), /messageId is required/);
    });
  });

  // 3. PERSISTENCE & DATA PAYLOAD ARCHITECTURE
  describe('3. Lightweight Reference Persistence Architecture', () => {
    it('persists lightweight metadata reference rather than duplicating the entire discussion object', () => {
      const testMessage = {
        messageId: 'msg_999',
        senderId: 'user_author',
        senderName: 'Author Name',
        senderAvatar: 'https://avatar.url',
        content: 'This is the long discussion body that should never be copied into bookmarks',
        createdAt: 1700000000000,
        replyCount: 15,
        reactions: { '❤️': { count: 8 } },
      };

      // Construct canonical saved payload
      const savedPayload = {
        savedAt: Date.now(),
        messageId: testMessage.messageId.trim(),
      };

      // Payload must contain ONLY lightweight metadata
      assert.strictEqual(typeof savedPayload.savedAt, 'number');
      assert.strictEqual(savedPayload.messageId, 'msg_999');
      assert.strictEqual(savedPayload.content, undefined, 'Must not duplicate discussion content');
      assert.strictEqual(savedPayload.reactions, undefined, 'Must not freeze reaction counts in bookmark');
      assert.strictEqual(savedPayload.replyCount, undefined, 'Must not freeze reply count in bookmark');
    });

    it('safely resolves discussion references and handles soft-deleted discussions gracefully', () => {
      const savedDiscussionsMap = {
        msg_live: { savedAt: 1700000010000, messageId: 'msg_live' },
        msg_deleted: { savedAt: 1700000020000, messageId: 'msg_deleted' },
      };

      const loadedFeedMessages = [
        { messageId: 'msg_live', content: 'Active discussion', senderName: 'Alice', createdAt: 1700000005000 },
      ];

      const savedIds = Object.keys(savedDiscussionsMap);
      const messageMap = new Map(loadedFeedMessages.map((m) => [m.messageId, m]));

      const resolvedSavedDiscussions = savedIds.map((savedId) => {
        const existing = messageMap.get(savedId);
        if (existing) return existing;
        const savedMeta = savedDiscussionsMap[savedId];
        return {
          messageId: savedId,
          deleted: true,
          content: 'This discussion was deleted or is no longer available',
          createdAt: savedMeta?.savedAt || Date.now(),
          senderId: 'unknown',
          senderName: 'Member',
          isSystem: false,
        };
      });

      assert.strictEqual(resolvedSavedDiscussions.length, 2);
      assert.strictEqual(resolvedSavedDiscussions[0].content, 'Active discussion');
      assert.strictEqual(resolvedSavedDiscussions[1].deleted, true);
      assert.strictEqual(
        resolvedSavedDiscussions[1].content,
        'This discussion was deleted or is no longer available'
      );
    });
  });

  // 4. MY DISCUSSIONS VS SAVED DISCUSSIONS INDEPENDENCE
  describe('4. Independence of My Discussions and Saved Discussions', () => {
    it('ensures My Discussions filters exclusively by authorUid and is not affected by saved state', () => {
      const currentAuthUid = 'user_current';
      const messages = [
        { messageId: 'm1', authorUid: 'user_current', content: 'My post 1' },
        { messageId: 'm2', authorUid: 'user_other', content: 'Other post 2' },
        { messageId: 'm3', authorUid: 'user_current', content: 'My post 3' },
      ];

      // Even if user_current saved post m2
      const savedDiscussionsMap = { m2: { savedAt: 12345, messageId: 'm2' } };

      const myDiscussions = messages.filter((m) => m.authorUid === currentAuthUid);
      assert.strictEqual(myDiscussions.length, 2);
      assert.deepStrictEqual(myDiscussions.map((m) => m.messageId), ['m1', 'm3']);
      assert.ok(!myDiscussions.some((m) => m.messageId === 'm2'));
    });

    it('ensures Saved filter returns all bookmarked items regardless of whether authored by self or others', () => {
      const savedDiscussionsMap = {
        m1: { savedAt: 1000, messageId: 'm1' },
        m2: { savedAt: 2000, messageId: 'm2' },
      };
      const messages = [
        { messageId: 'm1', authorUid: 'user_current', content: 'My post 1' },
        { messageId: 'm2', authorUid: 'user_other', content: 'Other post 2' },
        { messageId: 'm3', authorUid: 'user_other', content: 'Unsaved other post' },
      ];

      const savedList = Object.keys(savedDiscussionsMap).map((id) =>
        messages.find((m) => m.messageId === id)
      );

      assert.strictEqual(savedList.length, 2);
      assert.deepStrictEqual(savedList.map((m) => m.messageId), ['m1', 'm2']);
    });
  });

  // 5. OPTIMISTIC ROLLBACK STATE PRESERVATION
  describe('5. Optimistic UI Rollback Protection', () => {
    it('reverts to previous saved state if backend persistence fails', () => {
      let state = {
        msg_1: { savedAt: 1000, messageId: 'msg_1' },
      };

      const previousState = { ...state };
      const targetMsgId = 'msg_2';

      // 1. Optimistic update
      state = {
        ...state,
        [targetMsgId]: { savedAt: 2000, messageId: targetMsgId },
      };
      assert.ok(state.msg_2, 'Optimistic state includes msg_2');

      // 2. Simulated failure
      const writeFailed = true;
      if (writeFailed) {
        state = previousState;
      }

      // 3. State rolled back
      assert.strictEqual(state.msg_2, undefined, 'msg_2 must not remain saved after failure');
      assert.ok(state.msg_1, 'msg_1 remains saved');
    });
  });
});
