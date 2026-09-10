import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  formatMessageTime,
  formatFullDateTime,
  isSameCalendarDay,
  getDateDividerLabel,
  isConsecutiveMessageGroup,
  processMessageFeed,
} from '../../../../frontend/src/utils/chatFeedHelpers.js';
import {
  validateSendMessage,
  validateEditMessage,
  validateDeleteMessage,
} from '../../../../frontend/src/utils/chatValidation.js';

describe('🧪 CONVIA CHAT SYSTEM PHASE 5 — UI/UX, FEED ENHANCEMENTS & MICRO-INTERACTIONS TEST SUITE', () => {

  describe('🔍 1. Timestamp Formatting & Accessibility Helpers', () => {
    it('formats valid timestamp to localized time string', () => {
      // 2026-08-31 14:30:00 UTC (or local)
      const ts = new Date(2026, 7, 31, 14, 30).getTime();
      const formatted = formatMessageTime(ts);
      assert.ok(typeof formatted === 'string' && formatted.length > 0);
      assert.ok(formatted.includes('2:30') || formatted.includes('14:30'));
    });

    it('handles null, undefined, or invalid timestamps safely without throwing', () => {
      assert.strictEqual(formatMessageTime(null), '');
      assert.strictEqual(formatMessageTime(undefined), '');
      assert.strictEqual(formatMessageTime('invalid-date'), '');
      assert.strictEqual(formatFullDateTime(null), '');
      assert.strictEqual(formatFullDateTime('invalid-date'), '');
    });

    it('generates rich descriptive tooltip date string', () => {
      const ts = new Date(2026, 7, 31, 14, 30).getTime();
      const fullDate = formatFullDateTime(ts);
      assert.ok(fullDate.includes('2026') || fullDate.includes('Aug') || fullDate.includes('August'));
    });
  });

  describe('🔍 2. Date Separators & Calendar Day Computation', () => {
    const mockRefDate = new Date(2026, 7, 31, 12, 0, 0); // Aug 31, 2026

    it('returns "Today" for timestamps on the same reference calendar day', () => {
      const todayTs = new Date(2026, 7, 31, 9, 15, 0).getTime();
      assert.strictEqual(getDateDividerLabel(todayTs, mockRefDate), 'Today');
    });

    it('returns "Yesterday" for timestamps 1 calendar day before reference day', () => {
      const yesterdayTs = new Date(2026, 7, 30, 23, 45, 0).getTime();
      assert.strictEqual(getDateDividerLabel(yesterdayTs, mockRefDate), 'Yesterday');
    });

    it('returns formatted weekday and month for older dates within the same year', () => {
      const olderDateTs = new Date(2026, 7, 15, 10, 0, 0).getTime();
      const label = getDateDividerLabel(olderDateTs, mockRefDate);
      assert.ok(label.includes('Aug') || label.includes('August'));
      assert.ok(label.includes('15'));
    });

    it('returns month, day, and year for dates in previous years', () => {
      const lastYearTs = new Date(2025, 11, 25, 10, 0, 0).getTime();
      const label = getDateDividerLabel(lastYearTs, mockRefDate);
      assert.ok(label.includes('2025'));
      assert.ok(label.includes('Dec') || label.includes('December'));
    });

    it('correctly identifies same vs different calendar days', () => {
      const morning = new Date(2026, 7, 31, 8, 0, 0).getTime();
      const evening = new Date(2026, 7, 31, 22, 0, 0).getTime();
      const nextDay = new Date(2026, 8, 1, 1, 0, 0).getTime();

      assert.strictEqual(isSameCalendarDay(morning, evening), true);
      assert.strictEqual(isSameCalendarDay(evening, nextDay), false);
    });
  });

  describe('🔍 3. Consecutive Message Grouping Logic', () => {
    it('groups consecutive messages from the same sender within 5 minutes', () => {
      const msg1 = { messageId: 'm1', senderId: 'u1', createdAt: 100000, isSystem: false };
      const msg2 = { messageId: 'm2', senderId: 'u1', createdAt: 100000 + 2 * 60 * 1000, isSystem: false }; // 2 min delta

      assert.strictEqual(isConsecutiveMessageGroup(msg1, msg2), true);
    });

    it('BLOCKS grouping when senders differ', () => {
      const msg1 = { messageId: 'm1', senderId: 'u1', createdAt: 100000, isSystem: false };
      const msg2 = { messageId: 'm2', senderId: 'u2', createdAt: 100000 + 60 * 1000, isSystem: false };

      assert.strictEqual(isConsecutiveMessageGroup(msg1, msg2), false);
    });

    it('BLOCKS grouping when time delta exceeds 5 minutes', () => {
      const msg1 = { messageId: 'm1', senderId: 'u1', createdAt: 100000, isSystem: false };
      const msg2 = { messageId: 'm2', senderId: 'u1', createdAt: 100000 + 6 * 60 * 1000, isSystem: false }; // 6 min delta

      assert.strictEqual(isConsecutiveMessageGroup(msg1, msg2), false);
    });

    it('BLOCKS grouping if either message is a system message', () => {
      const msg1 = { messageId: 'm1', senderId: 'u1', createdAt: 100000, isSystem: true };
      const msg2 = { messageId: 'm2', senderId: 'u1', createdAt: 100000 + 30 * 1000, isSystem: false };

      assert.strictEqual(isConsecutiveMessageGroup(msg1, msg2), false);
    });
  });

  describe('🔍 4. Message Feed Decoration Pipeline (processMessageFeed)', () => {
    const mockRefDate = new Date(2026, 7, 31, 12, 0, 0);

    it('handles empty message array cleanly', () => {
      const feed = processMessageFeed([], 'user_alice', mockRefDate);
      assert.deepStrictEqual(feed, []);
    });

    it('inserts single date divider for messages on the same calendar day', () => {
      const messages = [
        { messageId: 'm1', senderId: 'user_alice', content: 'Msg 1', createdAt: new Date(2026, 7, 31, 10, 0).getTime() },
        { messageId: 'm2', senderId: 'user_alice', content: 'Msg 2', createdAt: new Date(2026, 7, 31, 10, 2).getTime() },
        { messageId: 'm3', senderId: 'user_bob', content: 'Msg 3', createdAt: new Date(2026, 7, 31, 10, 10).getTime() },
      ];

      const feed = processMessageFeed(messages, 'user_alice', mockRefDate);
      const dividers = feed.filter((item) => item.type === 'date_divider');

      assert.strictEqual(dividers.length, 1);
      assert.strictEqual(dividers[0].dateLabel, 'Today');
      assert.strictEqual(feed.length, 4); // 1 divider + 3 messages
    });

    it('inserts multiple date dividers when messages span multiple calendar days', () => {
      const messages = [
        { messageId: 'm1', senderId: 'user_alice', content: 'Yesterday Msg', createdAt: new Date(2026, 7, 30, 15, 0).getTime() },
        { messageId: 'm2', senderId: 'user_alice', content: 'Today Msg', createdAt: new Date(2026, 7, 31, 10, 0).getTime() },
      ];

      const feed = processMessageFeed(messages, 'user_alice', mockRefDate);
      const dividers = feed.filter((item) => item.type === 'date_divider');

      assert.strictEqual(dividers.length, 2);
      assert.strictEqual(dividers[0].dateLabel, 'Yesterday');
      assert.strictEqual(dividers[1].dateLabel, 'Today');
    });

    it('correctly marks isOwn, isGrouped, isFirstInGroup, and isLastInGroup', () => {
      const messages = [
        { messageId: 'm1', senderId: 'user_alice', content: 'Alice 1', createdAt: new Date(2026, 7, 31, 10, 0).getTime() },
        { messageId: 'm2', senderId: 'user_alice', content: 'Alice 2', createdAt: new Date(2026, 7, 31, 10, 2).getTime() },
        { messageId: 'm3', senderId: 'user_bob', content: 'Bob 1', createdAt: new Date(2026, 7, 31, 10, 3).getTime() },
      ];

      const feed = processMessageFeed(messages, 'user_alice', mockRefDate);
      const msgItems = feed.filter((item) => item.type === 'message');

      // Message 1: Alice (Own), First in group
      assert.strictEqual(msgItems[0].isOwn, true);
      assert.strictEqual(msgItems[0].isGrouped, false);
      assert.strictEqual(msgItems[0].isFirstInGroup, true);
      assert.strictEqual(msgItems[0].isLastInGroup, false);

      // Message 2: Alice (Own), Grouped with m1
      assert.strictEqual(msgItems[1].isOwn, true);
      assert.strictEqual(msgItems[1].isGrouped, true);
      assert.strictEqual(msgItems[1].isFirstInGroup, false);
      assert.strictEqual(msgItems[1].isLastInGroup, true);

      // Message 3: Bob (Not Own), Starts new group
      assert.strictEqual(msgItems[2].isOwn, false);
      assert.strictEqual(msgItems[2].isGrouped, false);
      assert.strictEqual(msgItems[2].isFirstInGroup, true);
      assert.strictEqual(msgItems[2].isLastInGroup, true);
    });
  });

  describe('🔍 5. UI Action Permissions & Canonical Rules Alignment', () => {
    const userAlice = { uid: 'user_alice', name: 'Alice' };
    const userBob = { uid: 'user_bob', name: 'Bob' };
    const msgAlice = { messageId: 'm1', senderId: 'user_alice', content: 'Valid', deleted: false, isSystem: false };

    it('allows author to edit own non-deleted non-system message', () => {
      const res = validateEditMessage({
        workspaceId: 'org_alpha',
        messageId: 'm1',
        userId: userAlice.uid,
        newContent: 'New text',
        currentMessage: msgAlice,
      });
      assert.strictEqual(res.valid, true);
    });

    it('DENIES editing another user message', () => {
      assert.throws(() => {
        validateEditMessage({
          workspaceId: 'org_alpha',
          messageId: 'm1',
          userId: userBob.uid,
          newContent: 'New text',
          currentMessage: msgAlice,
        });
      }, /edit your own/i);
    });

    it('DENIES editing a system message', () => {
      const sysMsg = { messageId: 'm1', senderId: 'system', content: 'System event', isSystem: true };
      assert.throws(() => {
        validateEditMessage({
          workspaceId: 'org_alpha',
          messageId: 'm1',
          userId: userAlice.uid,
          newContent: 'Tampered',
          currentMessage: sysMsg,
        });
      }, /system/i);
    });

    it('DENIES editing a deleted message', () => {
      const deletedMsg = { messageId: 'm1', senderId: 'user_alice', content: 'This message was deleted', deleted: true };
      assert.throws(() => {
        validateEditMessage({
          workspaceId: 'org_alpha',
          messageId: 'm1',
          userId: userAlice.uid,
          newContent: 'Reactivated',
          currentMessage: deletedMsg,
        });
      }, /deleted/i);
    });

    it('allows author or workspace admin to delete message', () => {
      const resAuthor = validateDeleteMessage({
        workspaceId: 'org_alpha',
        messageId: 'm1',
        userId: userAlice.uid,
        isWorkspaceAdmin: false,
        currentMessage: msgAlice,
      });
      assert.strictEqual(resAuthor.valid, true);

      const resAdmin = validateDeleteMessage({
        workspaceId: 'org_alpha',
        messageId: 'm1',
        userId: 'user_admin',
        isWorkspaceAdmin: true,
        currentMessage: msgAlice,
      });
      assert.strictEqual(resAdmin.valid, true);

      assert.throws(() => {
        validateDeleteMessage({
          workspaceId: 'org_alpha',
          messageId: 'm1',
          userId: 'user_stranger',
          isWorkspaceAdmin: false,
          currentMessage: msgAlice,
        });
      }, /permission/i);
    });
  });

  describe('🔍 6. Composer Input Validation & Error Resilience', () => {
    const user = { uid: 'user_alice', name: 'Alice' };

    it('rejects whitespace-only message when no attachment is attached', () => {
      assert.throws(() => {
        validateSendMessage({ workspaceId: 'org_alpha', content: '   \n  \t  ', user, attachment: null });
      }, /required/i);
    });

    it('accepts valid message with text under 2000 characters', () => {
      const res = validateSendMessage({ workspaceId: 'org_alpha', content: 'Hello Convia team!', user, attachment: null });
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.trimmedContent, 'Hello Convia team!');
    });

    it('rejects message exceeding 2000 characters', () => {
      const longText = 'a'.repeat(2001);
      assert.throws(() => {
        validateSendMessage({ workspaceId: 'org_alpha', content: longText, user, attachment: null });
      }, /2000/i);
    });

    it('accepts empty text message if a valid attachment is present', () => {
      const attachment = {
        url: 'https://utfs.io/f/test.pdf',
        fileName: 'blueprint.pdf',
        size: 1024,
        category: 'document',
      };
      const res = validateSendMessage({ workspaceId: 'org_alpha', content: '', user, attachment });
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.trimmedContent, '');
      assert.ok(res.sanitizedAttachment);
    });
  });
});
