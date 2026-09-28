import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

// Import canonical identity helpers
import {
  resolveMemberDisplayName,
  isMessageAuthoredByUser,
  getMessageAuthorUid,
} from '../../../../frontend/src/utils/memberIdentity.js';

// Import normalization and feed helpers
import { normalizeChatMessage } from '../../../../frontend/src/utils/chatValidation.js';
import {
  processMessageFeed,
  formatReplyCountLabel,
} from '../../../../frontend/src/utils/chatFeedHelpers.js';

// Import database path builders
import {
  getUserSavedDiscussionsPath,
  getUserSavedDiscussionPath,
  getPublicIdeasChatMessagesPath,
  getPublicIdeasChatMessagePath,
} from '../../../../frontend/src/constants/databasePaths.js';

describe('🧪 CONVIA COMMUNITY PERSONALIZATION & DISCUSSION ACTIONS SUITE', () => {

  describe('🔍 1. Canonical User Identity & Author UID Extraction', () => {
    it('extracts canonical authorUid when present (modern schema)', () => {
      const msg = { authorUid: 'usr_abc_123', content: 'Discussion post' };
      assert.strictEqual(getMessageAuthorUid(msg), 'usr_abc_123');
    });

    it('extracts senderId when authorUid is absent (chat schema)', () => {
      const msg = { senderId: 'usr_sender_456', content: 'Chat post' };
      assert.strictEqual(getMessageAuthorUid(msg), 'usr_sender_456');
    });

    it('extracts authorId when authorUid and senderId are absent (ideas schema)', () => {
      const msg = { authorId: 'usr_idea_789', content: 'Idea post' };
      assert.strictEqual(getMessageAuthorUid(msg), 'usr_idea_789');
    });

    it('extracts userId or uid when other fields are absent', () => {
      assert.strictEqual(getMessageAuthorUid({ userId: 'usr_user_1' }), 'usr_user_1');
      assert.strictEqual(getMessageAuthorUid({ uid: 'usr_uid_2' }), 'usr_uid_2');
      assert.strictEqual(getMessageAuthorUid({ createdBy: 'usr_actor_3' }), 'usr_actor_3');
    });

    it('returns null for system or unknown messages', () => {
      assert.strictEqual(getMessageAuthorUid({ senderId: 'system' }), null);
      assert.strictEqual(getMessageAuthorUid({ senderId: 'unknown' }), null);
      assert.strictEqual(getMessageAuthorUid(null), null);
      assert.strictEqual(getMessageAuthorUid({}), null);
    });
  });

  describe('🔍 2. Authoritative Ownership Comparison (isMessageAuthoredByUser)', () => {
    it('returns true when authorUid matches current user authenticated UID', () => {
      const msg = { authorUid: 'USER_123', text: 'Hlo' };
      assert.strictEqual(isMessageAuthoredByUser(msg, 'USER_123'), true);
    });

    it('returns true when senderId matches current user authenticated UID', () => {
      const msg = { senderId: 'USER_123', content: 'Feed item' };
      assert.strictEqual(isMessageAuthoredByUser(msg, 'USER_123'), true);
    });

    it('returns false when message was created by a different user', () => {
      const msg = { authorUid: 'USER_OTHER', senderId: 'USER_OTHER', text: 'Someone else' };
      assert.strictEqual(isMessageAuthoredByUser(msg, 'USER_123'), false);
    });

    it('does NOT rely on display name or visible "You" label', () => {
      // User changed display name to "Paras" or "You", but UID is USER_123
      const msg = {
        authorUid: 'USER_123',
        senderName: 'Different Name',
        displayName: 'Different Name',
      };
      // Ownership matches strictly by UID regardless of display name
      assert.strictEqual(isMessageAuthoredByUser(msg, 'USER_123'), true);

      // An imposter using display name "You" or the user's name is NOT recognized as owner
      const imposterMsg = {
        authorUid: 'USER_IMPOSTER',
        senderName: 'You',
        displayName: 'You',
      };
      assert.strictEqual(isMessageAuthoredByUser(imposterMsg, 'USER_123'), false);
    });

    it('safely handles empty or missing inputs without throwing', () => {
      assert.strictEqual(isMessageAuthoredByUser(null, 'USER_123'), false);
      assert.strictEqual(isMessageAuthoredByUser({}, 'USER_123'), false);
      assert.strictEqual(isMessageAuthoredByUser({ authorUid: 'USER_123' }, null), false);
      assert.strictEqual(isMessageAuthoredByUser({ authorUid: 'USER_123' }, ''), false);
    });
  });

  describe('🔍 3. Normalization of Historical & Contemporary Community Messages', () => {
    it('normalizes legacy message with { authorUid, text } preserving author identity', () => {
      const legacyRaw = {
        authorUid: 'USER_123',
        text: 'Hlo community',
        createdAt: 1710000000000,
      };

      const normalized = normalizeChatMessage(legacyRaw, 'msg_leg_1');
      assert.ok(normalized);
      assert.strictEqual(normalized.messageId, 'msg_leg_1');
      assert.strictEqual(normalized.senderId, 'USER_123');
      assert.strictEqual(normalized.authorUid, 'USER_123');
      assert.strictEqual(normalized.authorId, 'USER_123');
      assert.strictEqual(normalized.content, 'Hlo community');
    });

    it('normalizes contemporary message with { senderId, content, postType }', () => {
      const modernRaw = {
        senderId: 'USER_123',
        content: 'New modular architecture discussion',
        postType: 'idea',
        createdAt: 1710000050000,
      };

      const normalized = normalizeChatMessage(modernRaw, 'msg_mod_1');
      assert.ok(normalized);
      assert.strictEqual(normalized.senderId, 'USER_123');
      assert.strictEqual(normalized.authorUid, 'USER_123');
      assert.strictEqual(normalized.content, 'New modular architecture discussion');
      assert.strictEqual(normalized.postType, 'idea');
    });
  });

  describe('🔍 4. "My Discussions" Filtering Verification', () => {
    const mockFeed = [
      { messageId: 'm1', authorUid: 'USER_ME', content: 'My first discussion', createdAt: 100 },
      { messageId: 'm2', senderId: 'USER_OTHER', content: 'Other discussion', createdAt: 200 },
      { messageId: 'm3', authorId: 'USER_ME', content: 'My second discussion', createdAt: 300 },
      { messageId: 'm4', senderId: 'USER_ME', content: 'My deleted discussion', deleted: true, createdAt: 400 },
    ];

    it('includes all active discussions created by the user across authorUid/senderId/authorId', () => {
      const myDiscussions = mockFeed
        .filter((m) => m && !m.deleted)
        .filter((m) => isMessageAuthoredByUser(m, 'USER_ME'));

      assert.strictEqual(myDiscussions.length, 2);
      assert.strictEqual(myDiscussions[0].messageId, 'm1');
      assert.strictEqual(myDiscussions[1].messageId, 'm3');
    });

    it('excludes discussions created by other users', () => {
      const myDiscussions = mockFeed
        .filter((m) => m && !m.deleted)
        .filter((m) => isMessageAuthoredByUser(m, 'USER_ME'));

      const hasOther = myDiscussions.some((m) => m.messageId === 'm2');
      assert.strictEqual(hasOther, false);
    });

    it('excludes soft-deleted discussions from My Discussions', () => {
      const myDiscussions = mockFeed
        .filter((m) => m && !m.deleted)
        .filter((m) => isMessageAuthoredByUser(m, 'USER_ME'));

      const hasDeleted = myDiscussions.some((m) => m.messageId === 'm4');
      assert.strictEqual(hasDeleted, false);
    });
  });

  describe('🔍 5. "My Replies" vs "My Discussions" Separation', () => {
    // Discussion A created by ME
    // Discussion B created by OTHER, but replied to by ME
    // Discussion C created by OTHER, no reply from ME
    const discussions = [
      { messageId: 'disc_A', senderId: 'USER_ME', content: 'Discussion A' },
      { messageId: 'disc_B', senderId: 'USER_OTHER', content: 'Discussion B' },
      { messageId: 'disc_C', senderId: 'USER_OTHER', content: 'Discussion C' },
    ];

    const userRepliesMap = {
      USER_ME: ['disc_B'], // User replied to Discussion B
    };

    it('My Discussions contains only posts created by user', () => {
      const myDiscussions = discussions.filter((m) => isMessageAuthoredByUser(m, 'USER_ME'));
      assert.strictEqual(myDiscussions.length, 1);
      assert.strictEqual(myDiscussions[0].messageId, 'disc_A');
    });

    it('My Replies contains discussions where user replied, excluding unreplied discussions', () => {
      const repliedIds = userRepliesMap['USER_ME'] || [];
      const myReplies = discussions.filter((m) => repliedIds.includes(m.messageId));

      assert.strictEqual(myReplies.length, 1);
      assert.strictEqual(myReplies[0].messageId, 'disc_B');
    });

    it('allows a discussion to appear in both if user created it AND replied to it', () => {
      const repliesMapWithOwnReply = {
        USER_ME: ['disc_A', 'disc_B'],
      };
      const repliedIds = repliesMapWithOwnReply['USER_ME'];
      const myReplies = discussions.filter((m) => repliedIds.includes(m.messageId));

      assert.strictEqual(myReplies.some((m) => m.messageId === 'disc_A'), true);
      assert.strictEqual(myReplies.some((m) => m.messageId === 'disc_B'), true);
    });
  });

  describe('🔍 6. Saved Discussions Architecture & Security Rules', () => {
    it('generates canonical user_saved_discussions paths', () => {
      const rootPath = getUserSavedDiscussionsPath('usr_789');
      assert.strictEqual(rootPath, 'user_saved_discussions/usr_789');

      const itemPath = getUserSavedDiscussionPath('usr_789', 'msg_999');
      assert.strictEqual(itemPath, 'user_saved_discussions/usr_789/msg_999');
    });

    it('validates user_saved_discussions security rules in database.rules.json', () => {
      const rulesContent = fs.readFileSync(path.resolve('database.rules.json'), 'utf8');
      const rules = JSON.parse(rulesContent);

      const savedRules = rules.rules.user_saved_discussions;
      assert.ok(savedRules, 'user_saved_discussions node must exist in database rules');
      assert.strictEqual(savedRules.$uid['.read'], 'auth != null && auth.uid === $uid');
      assert.strictEqual(savedRules.$uid['.write'], 'auth != null && auth.uid === $uid');
    });

    it('handles deleted saved discussions gracefully with tombstone placeholder', () => {
      const savedMap = {
        msg_live: { savedAt: 1000, messageId: 'msg_live' },
        msg_deleted: { savedAt: 2000, messageId: 'msg_deleted' },
      };

      const messages = [
        { messageId: 'msg_live', content: 'I am alive', deleted: false },
        // msg_deleted is missing from messages or marked deleted
      ];

      const messageMap = new Map(messages.map((m) => [m.messageId, m]));
      const savedFeed = Object.keys(savedMap).map((savedId) => {
        const existing = messageMap.get(savedId);
        if (existing) return existing;
        return {
          messageId: savedId,
          deleted: true,
          content: 'This discussion was deleted or is no longer available',
          createdAt: savedMap[savedId].savedAt,
        };
      });

      assert.strictEqual(savedFeed.length, 2);
      assert.strictEqual(savedFeed[0].deleted, false);
      assert.strictEqual(savedFeed[1].deleted, true);
      assert.strictEqual(savedFeed[1].content, 'This discussion was deleted or is no longer available');
    });
  });

  describe('🔍 7. Deep-Link URL Format & Copy Link Behavior', () => {
    it('generates canonical deep-link URL containing messageId parameter', () => {
      const origin = 'https://convia.app';
      const messageId = '-O_discussion_456';
      const canonicalDeepLink = `${origin}/community?messageId=${encodeURIComponent(messageId)}`;

      assert.strictEqual(
        canonicalDeepLink,
        'https://convia.app/community?messageId=-O_discussion_456'
      );
      assert.ok(canonicalDeepLink.includes('?messageId='));
    });

    it('extracts discussion content cleanly for Copy Text without metadata', () => {
      const msg = {
        messageId: 'm1',
        content: 'This is the exact message text.',
        senderName: 'Paras',
        createdAt: 1700000000000,
        authorUid: 'USER_123',
      };

      const textToCopy = (msg.content || '').trim();
      assert.strictEqual(textToCopy, 'This is the exact message text.');
      assert.ok(!textToCopy.includes('Paras'));
      assert.ok(!textToCopy.includes('1700000000000'));
    });
  });

  describe('🔍 8. Public Chat Security Rules for Edit and Deletion Authorization', () => {
    it('verifies publicChats/ideas/messages security rule allows authorUid and senderId', () => {
      const rulesContent = fs.readFileSync(path.resolve('database.rules.json'), 'utf8');
      const rules = JSON.parse(rulesContent);

      const msgWriteRule = rules.rules.publicChats.ideas.messages.$messageId['.write'];
      assert.ok(msgWriteRule.includes("data.child('senderId').val() === auth.uid"));
      assert.ok(msgWriteRule.includes("data.child('authorUid').val() === auth.uid"));
      assert.ok(msgWriteRule.includes("root.child('admins').child(auth.uid).val() === true"));
    });
  });

  describe('🔍 9. Feed Decoration and "You" Display Name Consistency', () => {
    it('marks isOwn as true strictly when UID matches, independent of display name', () => {
      const messages = [
        { messageId: 'm1', senderId: 'USER_ME', senderName: 'Paras', createdAt: Date.now() },
        { messageId: 'm2', senderId: 'USER_OTHER', senderName: 'You', createdAt: Date.now() + 1000 },
      ];

      const decorated = processMessageFeed(messages, 'USER_ME');
      const msgItems = decorated.filter((d) => d.type === 'message');

      // First message: senderId matches currentUserId -> isOwn true
      assert.strictEqual(msgItems[0].isOwn, true);

      // Second message: senderName is 'You', but senderId is USER_OTHER -> isOwn MUST BE false
      assert.strictEqual(msgItems[1].isOwn, false);
    });
  });

});
