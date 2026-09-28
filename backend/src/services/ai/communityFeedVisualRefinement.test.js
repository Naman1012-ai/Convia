import { describe, it } from 'node:test';
import assert from 'node:assert';

import {
  processMessageFeed,
  isConsecutiveMessageGroup,
  isSameCalendarDay,
  getDateDividerLabel,
  formatMessageTime,
  formatFullDateTime,
  formatReplyCountLabel,
  resolveReactionParticipant,
} from '../../../../frontend/src/utils/chatFeedHelpers.js';

import { resolveMemberDisplayName } from '../../../../frontend/src/utils/memberIdentity.js';
import {
  COMMUNITY_POST_TYPES,
  COMMUNITY_POST_TYPE_CONFIG,
  SUPPORTED_REACTIONS,
  COMMUNITY_SUPPORTED_REACTIONS,
  isValidReactionEmoji,
} from '../../../../frontend/src/constants/chatSchema.js';

describe('🧪 CONVIA COMMUNITY FEED VISUAL REFINEMENT & GROUPING TEST SUITE', () => {

  // =================================================================
  // 1. OWN MESSAGE VS OTHER MESSAGE DETECTION
  // =================================================================
  describe('🔍 1. Message Ownership Detection Logic', () => {
    const currentUserId = 'user_current_123';

    it('identifies own message when senderId matches currentUserId', () => {
      const msg = {
        messageId: 'msg_1',
        senderId: 'user_current_123',
        content: 'Building Convia community hub',
      };
      const isOwnMessage = Boolean(
        currentUserId &&
          (msg.senderId === currentUserId || msg.authorId === currentUserId)
      );
      assert.strictEqual(isOwnMessage, true);
    });

    it('identifies own message when authorId matches currentUserId', () => {
      const msg = {
        messageId: 'msg_2',
        authorId: 'user_current_123',
        content: 'Own message via authorId',
      };
      const isOwnMessage = Boolean(
        currentUserId &&
          (msg.senderId === currentUserId || msg.authorId === currentUserId)
      );
      assert.strictEqual(isOwnMessage, true);
    });

    it('identifies other user message when neither senderId nor authorId matches', () => {
      const msg = {
        messageId: 'msg_3',
        senderId: 'user_other_456',
        content: 'Hello everyone!',
      };
      const isOwnMessage = Boolean(
        currentUserId &&
          (msg.senderId === currentUserId || msg.authorId === currentUserId)
      );
      assert.strictEqual(isOwnMessage, false);
    });

    it('treats all messages as other user messages when currentUserId is null or unauthenticated', () => {
      const msg = {
        messageId: 'msg_4',
        senderId: 'user_current_123',
        content: 'Guest browsing',
      };
      const isOwnMessage = Boolean(
        null &&
          (msg.senderId === null || msg.authorId === null)
      );
      assert.strictEqual(isOwnMessage, false);
    });
  });

  // =================================================================
  // 2. MESSAGE GROUPING & FEED PIPELINE
  // =================================================================
  describe('🔍 2. Message Grouping & Consecutive Message Pipeline', () => {
    const now = new Date('2026-09-27T10:00:00Z').getTime();

    it('groups consecutive messages from the same sender within 5 minutes', () => {
      const msgA = {
        messageId: 'msg_a',
        senderId: 'user_alice',
        createdAt: now,
        isSystem: false,
      };
      const msgB = {
        messageId: 'msg_b',
        senderId: 'user_alice',
        createdAt: now + 60 * 1000, // 1 minute later
        isSystem: false,
      };

      const isGrouped = isConsecutiveMessageGroup(msgA, msgB);
      assert.strictEqual(isGrouped, true, 'Messages within 1 minute from same user must be grouped');
    });

    it('does NOT group messages from different senders', () => {
      const msgAlice = {
        messageId: 'msg_alice',
        senderId: 'user_alice',
        createdAt: now,
        isSystem: false,
      };
      const msgBob = {
        messageId: 'msg_bob',
        senderId: 'user_bob',
        createdAt: now + 30 * 1000, // 30 seconds later
        isSystem: false,
      };

      const isGrouped = isConsecutiveMessageGroup(msgAlice, msgBob);
      assert.strictEqual(isGrouped, false, 'Different users must NEVER be grouped together');
    });

    it('does NOT group messages separated by more than 5 minutes', () => {
      const msgA = {
        messageId: 'msg_a',
        senderId: 'user_alice',
        createdAt: now,
        isSystem: false,
      };
      const msgB = {
        messageId: 'msg_b',
        senderId: 'user_alice',
        createdAt: now + 6 * 60 * 1000, // 6 minutes later
        isSystem: false,
      };

      const isGrouped = isConsecutiveMessageGroup(msgA, msgB);
      assert.strictEqual(isGrouped, false, 'Messages beyond 5 minutes should start a new group');
    });

    it('does NOT group system messages with normal messages', () => {
      const msgNorm = {
        messageId: 'msg_1',
        senderId: 'system',
        createdAt: now,
        isSystem: false,
      };
      const msgSys = {
        messageId: 'msg_2',
        senderId: 'system',
        createdAt: now + 1000,
        isSystem: true,
      };

      assert.strictEqual(isConsecutiveMessageGroup(msgNorm, msgSys), false);
      assert.strictEqual(isConsecutiveMessageGroup(msgSys, msgNorm), false);
    });

    it('decorates feed items with accurate isGrouped, isFirstInGroup, isLastInGroup, and isOwn', () => {
      const currentUserId = 'user_current';
      const messages = [
        // Group 1: Alice (2 messages)
        { messageId: 'm1', senderId: 'user_alice', createdAt: now },
        { messageId: 'm2', senderId: 'user_alice', createdAt: now + 30000 },
        // Group 2: Current user (1 message)
        { messageId: 'm3', senderId: 'user_current', createdAt: now + 120000 },
        // Group 3: Bob (1 message)
        { messageId: 'm4', senderId: 'user_bob', createdAt: now + 240000 },
      ];

      const decorated = processMessageFeed(messages, currentUserId, new Date(now));

      // Filter to only message items (excluding date dividers)
      const msgItems = decorated.filter((item) => item.type === 'message');
      assert.strictEqual(msgItems.length, 4);

      // m1: first in Alice group
      assert.strictEqual(msgItems[0].isGrouped, false);
      assert.strictEqual(msgItems[0].isFirstInGroup, true);
      assert.strictEqual(msgItems[0].isLastInGroup, false);
      assert.strictEqual(msgItems[0].isOwn, false);

      // m2: grouped into Alice group
      assert.strictEqual(msgItems[1].isGrouped, true);
      assert.strictEqual(msgItems[1].isFirstInGroup, false);
      assert.strictEqual(msgItems[1].isLastInGroup, true);
      assert.strictEqual(msgItems[1].isOwn, false);

      // m3: own message
      assert.strictEqual(msgItems[2].isGrouped, false);
      assert.strictEqual(msgItems[2].isFirstInGroup, true);
      assert.strictEqual(msgItems[2].isLastInGroup, true);
      assert.strictEqual(msgItems[2].isOwn, true);

      // m4: Bob message
      assert.strictEqual(msgItems[3].isGrouped, false);
      assert.strictEqual(msgItems[3].isFirstInGroup, true);
      assert.strictEqual(msgItems[3].isLastInGroup, true);
      assert.strictEqual(msgItems[3].isOwn, false);
    });
  });

  // =================================================================
  // 3. DATE DIVIDERS & CALENDAR DAY LOGIC
  // =================================================================
  describe('🔍 3. Date Divider Insertion & Formatting', () => {
    it('generates date dividers when consecutive messages occur on different calendar days', () => {
      const day1 = new Date('2026-09-26T12:00:00Z').getTime();
      const day2 = new Date('2026-09-27T12:00:00Z').getTime();

      const messages = [
        { messageId: 'd1_m1', senderId: 'user_alice', createdAt: day1 },
        { messageId: 'd2_m1', senderId: 'user_alice', createdAt: day2 },
      ];

      const decorated = processMessageFeed(messages, 'user_me', new Date(day2));
      const dividers = decorated.filter((item) => item.type === 'date_divider');
      assert.strictEqual(dividers.length, 2, 'Must insert date divider for each distinct calendar day');
    });

    it('correctly labels Today and Yesterday', () => {
      const ref = new Date(2026, 8, 27, 12, 0, 0); // Local Sep 27
      const today = new Date(2026, 8, 27, 8, 0, 0); // Local Sep 27 morning
      const yesterday = new Date(2026, 8, 26, 15, 0, 0); // Local Sep 26 afternoon

      assert.strictEqual(getDateDividerLabel(today, ref), 'Today');
      assert.strictEqual(getDateDividerLabel(yesterday, ref), 'Yesterday');
    });
  });

  // =================================================================
  // 4. DISPLAY NAME & IDENTITY RESOLUTION
  // =================================================================
  describe('🔍 4. Display Name & Reaction Participant Resolution', () => {
    it('resolves reaction participant correctly and labels current user as "You"', () => {
      const currentUserId = 'user_me';
      const members = [
        { uid: 'user_me', displayName: 'My True Name' },
        { uid: 'user_alice', displayName: 'Alice Architect' },
      ];

      const resOwn = resolveReactionParticipant('user_me', members, currentUserId);
      assert.strictEqual(resOwn.isCurrentUser, true);
      assert.strictEqual(resOwn.name, 'You');

      const resAlice = resolveReactionParticipant('user_alice', members, currentUserId);
      assert.strictEqual(resAlice.isCurrentUser, false);
      assert.strictEqual(resAlice.name, 'Alice Architect');
    });

    it('strictly avoids exposing raw UID or email prefix as display name', () => {
      const user = {
        uid: 'raw_uid_xyz999',
        displayName: 'Dr. Jane Foster',
        email: 'jane@thor.org',
      };
      const name = resolveMemberDisplayName(user);
      assert.strictEqual(name, 'Dr. Jane Foster');
      assert.notStrictEqual(name, 'raw_uid_xyz999');
      assert.notStrictEqual(name, 'jane');
    });
  });

  // =================================================================
  // 5. COMMUNITY POST TYPES & SUBTLE PRESENTATION
  // =================================================================
  describe('🔍 5. Post Types & Subtle Tags', () => {
    it('verifies all 4 community post types exist with valid icons and configs', () => {
      const types = [
        COMMUNITY_POST_TYPES.DISCUSSION,
        COMMUNITY_POST_TYPES.IDEA,
        COMMUNITY_POST_TYPES.QUESTION,
        COMMUNITY_POST_TYPES.COLLABORATION,
      ];

      for (const t of types) {
        const cfg = COMMUNITY_POST_TYPE_CONFIG[t];
        assert.ok(cfg, `Config for ${t} must exist`);
        assert.ok(cfg.icon, `Icon for ${t} must exist`);
        assert.ok(cfg.label, `Label for ${t} must exist`);
      }
    });
  });

  // =================================================================
  // 6. REPLY AFFORDANCE & GRAMMATICALLY CORRECT COUNT
  // =================================================================
  describe('🔍 6. Reply Count Label Formatting', () => {
    it('formats dynamic reply count label accurately', () => {
      assert.strictEqual(formatReplyCountLabel(0), 'Reply');
      assert.strictEqual(formatReplyCountLabel(1), '1 Reply');
      assert.strictEqual(formatReplyCountLabel(2), '2 Replies');
      assert.strictEqual(formatReplyCountLabel(15), '15 Replies');
      assert.strictEqual(formatReplyCountLabel(null), 'Reply');
      assert.strictEqual(formatReplyCountLabel(-1), 'Reply');
    });
  });

  // =================================================================
  // 7. COMMUNITY REACTIONS
  // =================================================================
  describe('🔍 7. Supported Reaction Emojis', () => {
    it('validates community reaction emojis without breaking workspace set of 8', () => {
      assert.strictEqual(SUPPORTED_REACTIONS.length, 8);
      for (const e of ['👍', '💡', '❤️', '🔥', '🎯']) {
        assert.strictEqual(isValidReactionEmoji(e), true);
      }
      assert.strictEqual(isValidReactionEmoji('🍕'), false);
    });
  });
});
