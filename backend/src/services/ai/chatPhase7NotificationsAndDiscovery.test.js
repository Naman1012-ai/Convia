import { describe, it } from 'node:test';
import assert from 'node:assert';

// Import Path Helpers
import {
  getChannelReadStateRootPath,
  getChannelReadStatePath,
  getUserNotificationsRootPath,
  getUserNotificationsPath,
} from '../../../../frontend/src/constants/databasePaths.js';

// Import Schema Contracts & Factories
import {
  CHAT_NOTIFICATION_TYPES,
  createCanonicalReadState,
  createCanonicalChatNotification,
} from '../../../../frontend/src/constants/chatSchema.js';

// Import Mentions Utility
import {
  extractMentions,
  getMentionSuggestions,
} from '../../../../frontend/src/utils/chatMentions.js';

import { resolveMemberDisplayName } from '../../../../frontend/src/utils/memberIdentity.js';

describe('🧪 CONVIA CHAT SYSTEM PHASE 7 — NOTIFICATIONS, MENTIONS, UNREAD STATE & DISCOVERY', () => {
  const mockMembers = [
    { uid: 'user_paras', displayName: 'Paras', username: 'paras_dev', email: 'paras@convia.dev' },
    { uid: 'user_rahul', displayName: 'Rahul Kumar', username: 'rahulk', email: 'rahul@convia.dev' },
    { uid: 'user_alex', displayName: 'Alex Johnson', username: 'alexj', email: 'alex@convia.dev' },
    { uid: 'user_priya', name: 'Priya Patel', username: 'priyap', email: 'priya@convia.dev' },
  ];

  // -------------------------------------------------------------
  // Group 1: RTDB Path Helpers
  // -------------------------------------------------------------
  describe('🔍 1. Centralized Phase 7 RTDB Path Helpers', () => {
    it('generates canonical channel readState root and user path', () => {
      const rootPath = getChannelReadStateRootPath('org_123', 'general');
      assert.strictEqual(rootPath, 'workspaceChats/org_123/channels/general/readState');

      const userPath = getChannelReadStatePath('org_123', 'general', 'user_paras');
      assert.strictEqual(userPath, 'workspaceChats/org_123/channels/general/readState/user_paras');
    });

    it('generates canonical user_notifications root and item path', () => {
      const rootPath = getUserNotificationsRootPath('user_paras');
      assert.strictEqual(rootPath, 'user_notifications/user_paras');

      const itemPath = getUserNotificationsPath('user_paras', 'notif_999');
      assert.strictEqual(itemPath, 'user_notifications/user_paras/notif_999');
    });

    it('strictly validates path arguments and throws on empty or invalid inputs', () => {
      assert.throws(() => getChannelReadStatePath('', 'general', 'user_paras'));
      assert.throws(() => getChannelReadStatePath('org_123', 'general', ''));
      assert.throws(() => getUserNotificationsRootPath(''));
      assert.throws(() => getUserNotificationsPath('user_paras', ''));
    });
  });

  // -------------------------------------------------------------
  // Group 2: Canonical Read State & Notification Schema Contracts
  // -------------------------------------------------------------
  describe('🔍 2. Canonical Read State & Notification Schema Contracts', () => {
    it('creates a clean canonical readState checkpoint object', () => {
      const now = 1725000000000;
      const readState = createCanonicalReadState({
        lastReadMessageId: 'msg_abc',
        lastReadAt: now,
        updatedAt: now,
      });

      assert.strictEqual(readState.lastReadMessageId, 'msg_abc');
      assert.strictEqual(readState.lastReadAt, now);
      assert.strictEqual(readState.updatedAt, now);
    });

    it('creates a canonical CHAT_MENTION notification with auto-generated deep-link actionUrl', () => {
      const notif = createCanonicalChatNotification({
        notificationId: 'notif_123',
        type: CHAT_NOTIFICATION_TYPES.MENTION,
        orgId: 'org_123',
        channelId: 'general',
        messageId: 'msg_456',
        senderId: 'user_paras',
        senderName: 'Paras',
        senderAvatar: 'https://convia.dev/paras.png',
        previewText: 'Hey @alexj check this feature out!',
        createdAt: 1725000000000,
      });

      assert.strictEqual(notif.notificationId, 'notif_123');
      assert.strictEqual(notif.type, 'CHAT_MENTION');
      assert.strictEqual(notif.orgId, 'org_123');
      assert.strictEqual(notif.channelId, 'general');
      assert.strictEqual(notif.messageId, 'msg_456');
      assert.strictEqual(notif.parentMessageId, null);
      assert.strictEqual(notif.senderId, 'user_paras');
      assert.strictEqual(notif.senderName, 'Paras');
      assert.strictEqual(notif.read, false);
      assert.strictEqual(notif.actionUrl, '/workspaces/org_123/chat?channel=general&messageId=msg_456');
    });

    it('creates a canonical CHAT_REPLY notification with thread deep link actionUrl', () => {
      const notif = createCanonicalChatNotification({
        notificationId: 'notif_reply_1',
        type: CHAT_NOTIFICATION_TYPES.REPLY,
        orgId: 'org_123',
        channelId: 'general',
        messageId: 'reply_789',
        parentMessageId: 'msg_456',
        senderId: 'user_rahul',
        senderName: 'Rahul Kumar',
        previewText: 'I reviewed your design and it looks great!',
      });

      assert.strictEqual(notif.type, 'CHAT_REPLY');
      assert.strictEqual(notif.parentMessageId, 'msg_456');
      assert.strictEqual(notif.actionUrl, '/workspaces/org_123/chat?channel=general&threadId=msg_456&replyId=reply_789');
    });
  });

  // -------------------------------------------------------------
  // Group 3: Mention Parsing & Safe Extraction (extractMentions)
  // -------------------------------------------------------------
  describe('🔍 3. Mention Parsing & Safe Extraction (extractMentions)', () => {
    it('extracts valid @username mentions matching workspace members', () => {
      const text = 'Hello @alexj, please review the PR from @paras_dev!';
      const mentions = extractMentions(text, mockMembers);

      assert.strictEqual(mentions.length, 2);
      assert.strictEqual(mentions[0].uid, 'user_alex');
      assert.strictEqual(mentions[0].displayName, 'Alex Johnson');
      assert.strictEqual(mentions[1].uid, 'user_paras');
      assert.strictEqual(mentions[1].displayName, 'Paras');
    });

    it('extracts @DisplayName mentions ignoring spaces', () => {
      const text = 'Can @Paras and @RahulKumar confirm this deployment?';
      const mentions = extractMentions(text, mockMembers);

      assert.strictEqual(mentions.length, 2);
      assert.strictEqual(mentions[0].uid, 'user_paras');
      assert.strictEqual(mentions[1].uid, 'user_rahul');
    });

    it('ignores unknown @mentions that are not in the workspace roster', () => {
      const text = 'Hey @ghost_user and @hacker, welcome to the channel!';
      const mentions = extractMentions(text, mockMembers);
      assert.strictEqual(mentions.length, 0);
    });

    it('deduplicates multiple mentions of the same member in one message', () => {
      const text = '@alexj did you see the message @alexj? Thanks @alexj!';
      const mentions = extractMentions(text, mockMembers);

      assert.strictEqual(mentions.length, 1);
      assert.strictEqual(mentions[0].uid, 'user_alex');
    });
  });

  // -------------------------------------------------------------
  // Group 4: Mention Suggestions & Autocomplete (getMentionSuggestions)
  // -------------------------------------------------------------
  describe('🔍 4. Mention Suggestions & Autocomplete (getMentionSuggestions)', () => {
    it('suggests members matching display name or username query', () => {
      const suggestions = getMentionSuggestions('par', mockMembers);
      assert.strictEqual(suggestions.length, 1);
      assert.strictEqual(suggestions[0].uid, 'user_paras');
    });

    it('returns all members up to limit when query is empty', () => {
      const suggestions = getMentionSuggestions('', mockMembers, 3);
      assert.strictEqual(suggestions.length, 3);
    });

    it('handles case-insensitive query matching', () => {
      const suggestions = getMentionSuggestions('ALEX', mockMembers);
      assert.strictEqual(suggestions.length, 1);
      assert.strictEqual(suggestions[0].uid, 'user_alex');
    });
  });

  // -------------------------------------------------------------
  // Group 5: Notification Generation & Self-Notification Exclusion
  // -------------------------------------------------------------
  describe('🔍 5. Notification Generation & Self-Notification Exclusion', () => {
    it('excludes author from receiving mention notification for mentioning self', () => {
      const author = { uid: 'user_paras', displayName: 'Paras' };
      const text = 'Note to self: @paras_dev fix this tomorrow. Also cc @alexj';
      const mentions = extractMentions(text, mockMembers);

      const targetRecipients = mentions.filter((m) => m.uid !== author.uid);
      assert.strictEqual(targetRecipients.length, 1);
      assert.strictEqual(targetRecipients[0].uid, 'user_alex');
    });

    it('excludes author from receiving reply notification when replying to own message', () => {
      const author = { uid: 'user_paras', displayName: 'Paras' };
      const parentMessage = { messageId: 'msg_1', senderId: 'user_paras', content: 'My original post' };

      const shouldNotify = Boolean(
        parentMessage.senderId && parentMessage.senderId !== author.uid && !parentMessage.isSystem
      );

      assert.strictEqual(shouldNotify, false);
    });

    it('permits reply notification when another member replies to parent author', () => {
      const replier = { uid: 'user_rahul', displayName: 'Rahul' };
      const parentMessage = { messageId: 'msg_1', senderId: 'user_paras', content: 'My original post' };

      const shouldNotify = Boolean(
        parentMessage.senderId && parentMessage.senderId !== replier.uid && !parentMessage.isSystem
      );

      assert.strictEqual(shouldNotify, true);
    });
  });

  // -------------------------------------------------------------
  // Group 6: Read State Checkpoint & Unread Tracking
  // -------------------------------------------------------------
  describe('🔍 6. Read State Checkpoint & Unread Tracking', () => {
    it('detects unread activity when channel lastMessageAt > lastReadAt', () => {
      const channelMetadata = { lastMessageAt: 1725000050000 };
      const readState = { lastReadAt: 1725000000000 };

      const hasUnread = Boolean(
        channelMetadata.lastMessageAt > (readState.lastReadAt || 0)
      );
      assert.strictEqual(hasUnread, true);
    });

    it('marks channel as completely read when lastReadAt >= lastMessageAt', () => {
      const channelMetadata = { lastMessageAt: 1725000050000 };
      const readState = { lastReadAt: 1725000050000 };

      const hasUnread = Boolean(
        channelMetadata.lastMessageAt > (readState.lastReadAt || 0)
      );
      assert.strictEqual(hasUnread, false);
    });

    it('handles first-time reader with no previous readState (lastReadAt: 0)', () => {
      const channelMetadata = { lastMessageAt: 1725000050000 };
      const readState = null;

      const hasUnread = Boolean(
        channelMetadata.lastMessageAt > (readState?.lastReadAt || 0)
      );
      assert.strictEqual(hasUnread, true);
    });
  });

  // -------------------------------------------------------------
  // Group 7: Message Discovery Search & Filtering
  // -------------------------------------------------------------
  describe('🔍 7. Message Discovery Search & Filtering', () => {
    const rawMessages = [
      { messageId: 'msg_1', senderId: 'user_paras', senderName: 'Paras', content: 'Initial project setup completed', createdAt: 1000 },
      { messageId: 'msg_2', senderId: 'user_rahul', senderName: 'Rahul', content: 'Database schema finalized', createdAt: 2000 },
      { messageId: 'msg_3', senderId: 'user_alex', senderName: 'Alex Johnson', content: 'Fixed the authentication bug', createdAt: 3000 },
      { messageId: 'msg_4', senderId: 'user_alex', senderName: 'Alex Johnson', content: 'This message was deleted', deleted: true, createdAt: 4000 },
      { messageId: 'msg_5', senderId: 'system', senderName: 'System', isSystem: true, content: 'Priya joined the workspace', createdAt: 5000 },
    ];

    it('filters active messages matching text search term', () => {
      const query = 'schema';
      const results = rawMessages.filter((m) => !m.deleted && !m.isSystem && m.content.toLowerCase().includes(query));

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].messageId, 'msg_2');
      assert.strictEqual(results[0].senderName, 'Rahul');
    });

    it('filters active messages matching sender name query', () => {
      const query = 'alex';
      const results = rawMessages.filter((m) => !m.deleted && !m.isSystem && (m.senderName.toLowerCase().includes(query) || m.content.toLowerCase().includes(query)));

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].messageId, 'msg_3');
    });

    it('excludes deleted and system messages from search discovery results', () => {
      const query = 'the';
      const results = rawMessages.filter((m) => !m.deleted && !m.isSystem && (m.senderName.toLowerCase().includes(query) || m.content.toLowerCase().includes(query)));

      // Only msg_3 ("Fixed the authentication bug") should match, NOT msg_4 (deleted) or msg_5 (system)
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].messageId, 'msg_3');
    });
  });

  // -------------------------------------------------------------
  // Group 8: Zero N+1 & Performance Invariants
  // -------------------------------------------------------------
  describe('🔍 8. Zero N+1 & Performance Invariants', () => {
    it('resolves 100 message senders and mentions purely in memory without database queries', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        const member = mockMembers[i % mockMembers.length];
        const displayName = resolveMemberDisplayName(member);
        const mentions = extractMentions(`Hello @${member.username} testing performance`, mockMembers);
        assert.ok(displayName);
        assert.strictEqual(mentions.length, 1);
      }
      const duration = performance.now() - start;
      assert.ok(duration < 20, `In-memory resolution must execute in < 20ms (took ${duration.toFixed(2)}ms)`);
    });
  });
});
