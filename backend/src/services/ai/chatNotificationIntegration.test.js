import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';

import {
  NOTIFICATION_TYPES,
  NOTIFICATION_CATEGORIES,
  getNotificationCategory,
  buildNotificationDedupeKey,
  buildNotificationActionUrl,
  createCanonicalNotification,
} from '../../constants/notificationConstants.js';

import { extractMentions } from '../../../../frontend/src/utils/chatMentions.js';
import { resolveMemberDisplayName } from '../../../../frontend/src/utils/memberIdentity.js';
import { validateSendMessage, validateSendReply } from '../../../../frontend/src/utils/chatValidation.js';
import {
  getUserNotificationsRootPath,
  getUserNotificationsPath,
  getChannelMessagesPath,
  getMessageRepliesPath,
} from '../../../../frontend/src/constants/databasePaths.js';

describe('🧪 CONVIA PHASE 7B-1 — CHAT NOTIFICATION INTEGRATION TEST SUITE', () => {
  let mockDb = {};

  const mockMembersOrgAlpha = [
    { uid: 'user_alice', displayName: 'Alice Architect', username: 'alice_arch', email: 'alice@alpha.dev', role: 'owner' },
    { uid: 'user_bob', displayName: 'Bob Builder', username: 'bob_b', email: 'bob@alpha.dev', role: 'member' },
    { uid: 'user_david', displayName: 'David Developer', username: 'david_d', email: 'david@alpha.dev', role: 'member' },
  ];

  const mockMembersOrgBeta = [
    { uid: 'user_eve', displayName: 'Eve External', username: 'eve_ext', email: 'eve@beta.dev', role: 'member' },
  ];

  beforeEach(() => {
    mockDb = {
      user_notifications: {},
      organizations: {
        org_alpha: {
          id: 'org_alpha',
          name: 'Alpha Labs',
          ownerId: 'user_alice',
        },
        org_beta: {
          id: 'org_beta',
          name: 'Beta Team',
          ownerId: 'user_charlie',
        },
      },
      organization_members: {
        org_alpha: {
          user_alice: { uid: 'user_alice', role: 'owner' },
          user_bob: { uid: 'user_bob', role: 'member' },
          user_david: { uid: 'user_david', role: 'member' },
        },
        org_beta: {
          user_eve: { uid: 'user_eve', role: 'member' },
        },
      },
      workspaceChats: {
        org_alpha: {
          channels: {
            general: {
              messages: {},
            },
          },
        },
      },
    };
  });

  // Simulated notification persistence adhering to database.rules.json
  function persistNotification(recipientUid, payload, authUser) {
    if (!authUser || !authUser.uid) {
      throw new Error('PERMISSION_DENIED: Unauthenticated');
    }

    // Suppress self-notification
    const actorUid = payload.actorId || payload.senderId;
    if (actorUid && actorUid === recipientUid && !payload.allowSelfNotification) {
      return null;
    }

    // Sender UID must match auth.uid
    if (payload.senderId && payload.senderId !== authUser.uid) {
      throw new Error('PERMISSION_DENIED: Forged senderId');
    }

    // Check workspace membership if orgId is specified
    if (payload.orgId) {
      const senderIsMember = Boolean(mockDb.organization_members[payload.orgId]?.[authUser.uid]);
      const recipientIsMember = Boolean(mockDb.organization_members[payload.orgId]?.[recipientUid]);

      if (!senderIsMember || !recipientIsMember) {
        throw new Error('PERMISSION_DENIED: Cross-workspace recipient or sender unauthorized');
      }
    }

    const notifId = payload.notificationId || (payload.dedupeKey
      ? `notif_${String(payload.dedupeKey).replace(/[^a-zA-Z0-9_-]/g, '_')}`
      : `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);

    const canonical = createCanonicalNotification({
      ...payload,
      notificationId: notifId,
      recipientId: recipientUid,
      actorId: authUser.uid,
      senderId: authUser.uid,
    });

    if (!mockDb.user_notifications[recipientUid]) {
      mockDb.user_notifications[recipientUid] = {};
    }

    mockDb.user_notifications[recipientUid][notifId] = canonical;
    return canonical;
  }

  // Simulated multi-recipient atomic notification delivery
  function persistNotificationsBulk(recipientUids, payload, authUser) {
    const created = [];
    const validRecipients = Array.from(new Set(recipientUids.filter((id) => id && id !== authUser.uid)));

    const baseDedupe = payload.notificationId || (payload.dedupeKey
      ? `notif_${String(payload.dedupeKey).replace(/[^a-zA-Z0-9_-]/g, '_')}`
      : null);

    for (const uid of validRecipients) {
      const notifId = baseDedupe
        ? `${baseDedupe}_${uid.replace(/[^a-zA-Z0-9_-]/g, '_')}`
        : `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const res = persistNotification(uid, { ...payload, notificationId: notifId }, authUser);
      if (res) created.push(res);
    }
    return created;
  }

  // =========================================================================
  // SCENARIO A: Normal message
  // =========================================================================
  describe('📌 Scenario A: Normal Message Notification Flow', () => {
    it('delivers CHAT_MESSAGE notifications to eligible workspace members with complete metadata', () => {
      const sender = mockMembersOrgAlpha[0]; // Alice
      const members = mockMembersOrgAlpha; // Alice, Bob, David
      const workspaceId = 'org_alpha';
      const channelId = 'general';
      const messageId = 'msg_101';
      const content = 'Hello Alpha team, sprint planning starts at 10 AM.';

      // Extract mentions (none)
      const mentions = extractMentions(content, members);
      const mentionedUids = mentions.map((m) => m.uid).filter((id) => id !== sender.uid);
      assert.strictEqual(mentionedUids.length, 0);

      // Resolve recipients: members of org_alpha excluding sender
      const allMembers = Object.keys(mockDb.organization_members[workspaceId]);
      const recipients = allMembers.filter((uid) => uid !== sender.uid && !mentionedUids.includes(uid));

      assert.deepStrictEqual(recipients.sort(), ['user_bob', 'user_david'].sort());

      const dedupeKey = `chat_msg_${workspaceId}_${channelId}_${messageId}_${sender.uid}`;
      const actionUrl = `/workspaces/${workspaceId}/chat?channel=${channelId}&messageId=${messageId}`;

      const created = persistNotificationsBulk(recipients, {
        type: NOTIFICATION_TYPES.CHAT_MESSAGE,
        workspaceId,
        orgId: workspaceId,
        channelId,
        title: `New message in #${channelId}`,
        body: `${sender.displayName}: ${content.substring(0, 100)}`,
        previewText: content,
        actorId: sender.uid,
        senderId: sender.uid,
        actorName: sender.displayName,
        resourceType: 'chat_message',
        resourceId: messageId,
        actionUrl,
        dedupeKey,
        metadata: { channelId, messageId, workspaceId },
      }, sender);

      assert.strictEqual(created.length, 2);

      // Verify Bob received notification
      const bobNotif = Object.values(mockDb.user_notifications.user_bob || {})[0];
      assert.ok(bobNotif);
      assert.strictEqual(bobNotif.type, NOTIFICATION_TYPES.CHAT_MESSAGE);
      assert.strictEqual(bobNotif.title, 'New message in #general');
      assert.strictEqual(bobNotif.actionUrl, actionUrl);
      assert.strictEqual(bobNotif.read, false);
      assert.strictEqual(bobNotif.recipientId, 'user_bob');

      // Verify David received notification
      const davidNotif = Object.values(mockDb.user_notifications.user_david || {})[0];
      assert.ok(davidNotif);
      assert.strictEqual(davidNotif.recipientId, 'user_david');
    });
  });

  // =========================================================================
  // SCENARIO B: Message by actor (self-suppression)
  // =========================================================================
  describe('📌 Scenario B: Actor Self-Notification Suppression', () => {
    it('strictly suppresses notifications to the sender actor', () => {
      const sender = mockMembersOrgAlpha[0]; // Alice
      const workspaceId = 'org_alpha';
      const channelId = 'general';
      const messageId = 'msg_102';
      const content = 'My own message';

      const result = persistNotification(sender.uid, {
        type: NOTIFICATION_TYPES.CHAT_MESSAGE,
        workspaceId,
        orgId: workspaceId,
        channelId,
        title: 'New message',
        body: content,
        actorId: sender.uid,
        senderId: sender.uid,
        resourceType: 'chat_message',
        resourceId: messageId,
      }, sender);

      assert.strictEqual(result, null);
      assert.strictEqual(Object.keys(mockDb.user_notifications.user_alice || {}).length, 0);
    });
  });

  // =========================================================================
  // SCENARIO C: Thread reply (MESSAGE_REPLY)
  // =========================================================================
  describe('📌 Scenario C: Thread Reply Notification Targeting', () => {
    it('notifies parent message author with MESSAGE_REPLY and thread deep link, excluding sender actor', () => {
      const parentAuthor = mockMembersOrgAlpha[0]; // Alice
      const replySender = mockMembersOrgAlpha[1]; // Bob
      const workspaceId = 'org_alpha';
      const channelId = 'general';
      const parentMessageId = 'msg_parent_200';
      const replyId = 'reply_201';
      const replyContent = 'I have reviewed your proposal and agree with the architecture.';

      // Bob replies to Alice's parent message
      const deepLink = `/workspaces/${workspaceId}/chat?channel=${channelId}&threadId=${parentMessageId}&replyId=${replyId}`;
      const dedupeKey = `chat_reply_${workspaceId}_${channelId}_${parentMessageId}_${replyId}_${replySender.uid}`;

      const notif = persistNotification(parentAuthor.uid, {
        type: NOTIFICATION_TYPES.MESSAGE_REPLY,
        workspaceId,
        orgId: workspaceId,
        channelId,
        title: `${replySender.displayName} replied to your message`,
        body: `${replySender.displayName}: ${replyContent.substring(0, 100)}`,
        previewText: replyContent,
        actorId: replySender.uid,
        senderId: replySender.uid,
        actorName: replySender.displayName,
        resourceType: 'chat_reply',
        resourceId: replyId,
        secondaryEntityId: parentMessageId,
        actionUrl: deepLink,
        metadata: { channelId, parentMessageId, replyId, workspaceId },
        dedupeKey,
      }, replySender);

      assert.ok(notif);
      assert.strictEqual(notif.type, NOTIFICATION_TYPES.MESSAGE_REPLY);
      assert.strictEqual(notif.recipientId, 'user_alice');
      assert.strictEqual(notif.secondaryEntityId, parentMessageId);
      assert.strictEqual(notif.actionUrl, deepLink);

      // Verify Bob received NO notification
      assert.strictEqual(Object.keys(mockDb.user_notifications.user_bob || {}).length, 0);

      // Verify David (unrelated workspace member) received NO notification (no spam)
      assert.strictEqual(Object.keys(mockDb.user_notifications.user_david || {}).length, 0);
    });

    it('suppresses MESSAGE_REPLY when replying to own parent message', () => {
      const alice = mockMembersOrgAlpha[0];
      const result = persistNotification(alice.uid, {
        type: NOTIFICATION_TYPES.MESSAGE_REPLY,
        workspaceId: 'org_alpha',
        orgId: 'org_alpha',
        channelId: 'general',
        title: 'Reply to message',
        body: 'Followup note',
        actorId: alice.uid,
        senderId: alice.uid,
        resourceType: 'chat_reply',
        resourceId: 'reply_202',
      }, alice);

      assert.strictEqual(result, null);
      assert.strictEqual(Object.keys(mockDb.user_notifications.user_alice || {}).length, 0);
    });
  });

  // =========================================================================
  // SCENARIO D: Mention (CHAT_MENTION)
  // =========================================================================
  describe('📌 Scenario D: Single Mention Notification', () => {
    it('notifies mentioned user with CHAT_MENTION and excludes mentioned user from CHAT_MESSAGE', () => {
      const sender = mockMembersOrgAlpha[0]; // Alice
      const members = mockMembersOrgAlpha; // Alice, Bob, David
      const content = 'Hey @bob_b can you check this endpoint?';
      const workspaceId = 'org_alpha';
      const channelId = 'general';
      const messageId = 'msg_301';

      const mentions = extractMentions(content, members);
      assert.strictEqual(mentions.length, 1);
      assert.strictEqual(mentions[0].uid, 'user_bob');

      const mentionedUids = mentions.map((m) => m.uid).filter((id) => id !== sender.uid);

      // 1. Dispatch CHAT_MENTION to Bob
      const mentionNotifs = persistNotificationsBulk(mentionedUids, {
        type: NOTIFICATION_TYPES.CHAT_MENTION,
        workspaceId,
        orgId: workspaceId,
        channelId,
        title: `${sender.displayName} mentioned you in #${channelId}`,
        body: `${sender.displayName}: ${content}`,
        previewText: content,
        actorId: sender.uid,
        senderId: sender.uid,
        actorName: sender.displayName,
        resourceType: 'chat_mention',
        resourceId: messageId,
        actionUrl: `/workspaces/${workspaceId}/chat?channel=${channelId}&messageId=${messageId}`,
        dedupeKey: `chat_mention_${workspaceId}_${channelId}_${messageId}_${sender.uid}`,
      }, sender);

      assert.strictEqual(mentionNotifs.length, 1);
      assert.strictEqual(mentionNotifs[0].type, NOTIFICATION_TYPES.CHAT_MENTION);
      assert.strictEqual(mentionNotifs[0].recipientId, 'user_bob');

      // 2. Dispatch CHAT_MESSAGE to remaining workspace members (David), excluding Alice and Bob
      const allMembers = Object.keys(mockDb.organization_members[workspaceId]);
      const channelRecipients = allMembers.filter((uid) => uid !== sender.uid && !mentionedUids.includes(uid));
      assert.deepStrictEqual(channelRecipients, ['user_david']);

      const channelNotifs = persistNotificationsBulk(channelRecipients, {
        type: NOTIFICATION_TYPES.CHAT_MESSAGE,
        workspaceId,
        orgId: workspaceId,
        channelId,
        title: `New message in #${channelId}`,
        body: `${sender.displayName}: ${content}`,
        previewText: content,
        actorId: sender.uid,
        senderId: sender.uid,
        actorName: sender.displayName,
        resourceType: 'chat_message',
        resourceId: messageId,
        actionUrl: `/workspaces/${workspaceId}/chat?channel=${channelId}&messageId=${messageId}`,
        dedupeKey: `chat_msg_${workspaceId}_${channelId}_${messageId}_${sender.uid}`,
      }, sender);

      assert.strictEqual(channelNotifs.length, 1);
      assert.strictEqual(channelNotifs[0].type, NOTIFICATION_TYPES.CHAT_MESSAGE);
      assert.strictEqual(channelNotifs[0].recipientId, 'user_david');

      // Ensure Bob has exactly 1 notification (CHAT_MENTION), not 2
      const bobNotifs = Object.values(mockDb.user_notifications.user_bob || {});
      assert.strictEqual(bobNotifs.length, 1);
      assert.strictEqual(bobNotifs[0].type, NOTIFICATION_TYPES.CHAT_MENTION);
    });
  });

  // =========================================================================
  // SCENARIO E: Multiple mentions
  // =========================================================================
  describe('📌 Scenario E: Multiple Mentions in One Message', () => {
    it('creates distinct CHAT_MENTION notifications for all valid mentioned users', () => {
      const sender = mockMembersOrgAlpha[0]; // Alice
      const members = mockMembersOrgAlpha;
      const content = '@bob_b and @david_d please join the standup.';
      const workspaceId = 'org_alpha';
      const channelId = 'general';
      const messageId = 'msg_302';

      const mentions = extractMentions(content, members);
      assert.strictEqual(mentions.length, 2);

      const mentionedUids = mentions.map((m) => m.uid).filter((id) => id !== sender.uid);
      assert.deepStrictEqual(mentionedUids.sort(), ['user_bob', 'user_david'].sort());

      const created = persistNotificationsBulk(mentionedUids, {
        type: NOTIFICATION_TYPES.CHAT_MENTION,
        workspaceId,
        orgId: workspaceId,
        channelId,
        title: `${sender.displayName} mentioned you in #${channelId}`,
        body: content,
        actorId: sender.uid,
        senderId: sender.uid,
        resourceType: 'chat_mention',
        resourceId: messageId,
      }, sender);

      assert.strictEqual(created.length, 2);
      assert.ok(Object.values(mockDb.user_notifications.user_bob || {})[0]);
      assert.ok(Object.values(mockDb.user_notifications.user_david || {})[0]);
    });
  });

  // =========================================================================
  // SCENARIO F: Self mention
  // =========================================================================
  describe('📌 Scenario F: Self Mention Exclusion', () => {
    it('excludes actor when mentioning themselves', () => {
      const sender = mockMembersOrgAlpha[0]; // Alice
      const content = 'Reminder to myself @alice_arch';

      const mentions = extractMentions(content, mockMembersOrgAlpha);
      assert.strictEqual(mentions.length, 1);
      assert.strictEqual(mentions[0].uid, sender.uid);

      const eligibleMentions = mentions.filter((m) => m.uid !== sender.uid);
      assert.strictEqual(eligibleMentions.length, 0);

      // Attempting to persist for self returns null
      const res = persistNotification(sender.uid, {
        type: NOTIFICATION_TYPES.CHAT_MENTION,
        workspaceId: 'org_alpha',
        orgId: 'org_alpha',
        actorId: sender.uid,
        senderId: sender.uid,
      }, sender);

      assert.strictEqual(res, null);
      assert.strictEqual(Object.keys(mockDb.user_notifications.user_alice || {}).length, 0);
    });
  });

  // =========================================================================
  // SCENARIO G: Unauthorized sender
  // =========================================================================
  describe('📌 Scenario G: Unauthorized Sender Defense', () => {
    it('rejects notification creation when sender is not a member of the workspace', () => {
      const unauthorizedEve = mockMembersOrgBeta[0]; // Eve from org_beta
      const workspaceId = 'org_alpha'; // Target org_alpha

      // 1. Validation test
      assert.throws(() => {
        validateSendMessage({
          workspaceId,
          channelId: 'general',
          content: 'Malicious external message',
          user: null, // Unauthenticated
        });
      });

      // 2. Rules test: Eve attempting to write a notification targeting Alice in org_alpha
      assert.throws(() => {
        persistNotification('user_alice', {
          type: NOTIFICATION_TYPES.CHAT_MESSAGE,
          workspaceId,
          orgId: workspaceId,
          channelId: 'general',
          actorId: unauthorizedEve.uid,
          senderId: unauthorizedEve.uid,
          resourceType: 'chat_message',
          resourceId: 'msg_hack_999',
        }, unauthorizedEve);
      }, /PERMISSION_DENIED/);

      // Verify Alice received zero notifications from unauthorized attempt
      assert.strictEqual(Object.keys(mockDb.user_notifications.user_alice || {}).length, 0);
    });
  });

  // =========================================================================
  // SCENARIO H: Offline recipient
  // =========================================================================
  describe('📌 Scenario H: Offline Recipient Persistence', () => {
    it('persists notification directly to user_notifications for offline user to retrieve on login', () => {
      const sender = mockMembersOrgAlpha[0]; // Alice
      const offlineBob = mockMembersOrgAlpha[1]; // Bob
      const workspaceId = 'org_alpha';
      const channelId = 'general';
      const messageId = 'msg_offline_1';

      // Bob has NO active socket or browser session, notification is written to RTDB
      const notif = persistNotification(offlineBob.uid, {
        type: NOTIFICATION_TYPES.CHAT_MESSAGE,
        workspaceId,
        orgId: workspaceId,
        channelId,
        title: 'Message while offline',
        body: 'Please review when you get back.',
        actorId: sender.uid,
        senderId: sender.uid,
        resourceType: 'chat_message',
        resourceId: messageId,
        createdAt: 1726000000000,
      }, sender);

      assert.ok(notif);

      // Simulate Bob logging in and reading user_notifications/{offlineBob.uid}
      const bobInbox = mockDb.user_notifications[offlineBob.uid];
      assert.ok(bobInbox);
      const items = Object.values(bobInbox);
      assert.strictEqual(items.length, 1);
      assert.strictEqual(items[0].read, false);
      assert.strictEqual(items[0].body, 'Please review when you get back.');
    });
  });

  // =========================================================================
  // SCENARIO I: Duplicate/retry event (Deduplication)
  // =========================================================================
  describe('📌 Scenario I: Duplicate / Retry Event Idempotence', () => {
    it('guarantees identical dedupeKey and notificationId on retry without creating duplicate entries', () => {
      const sender = mockMembersOrgAlpha[0];
      const recipient = mockMembersOrgAlpha[1];
      const workspaceId = 'org_alpha';
      const messageId = 'msg_retry_555';
      const type = NOTIFICATION_TYPES.CHAT_MESSAGE;

      const dedupeKey = buildNotificationDedupeKey({
        workspaceId,
        type,
        resourceId: messageId,
        recipientId: recipient.uid,
        actorId: sender.uid,
      });

      // First delivery attempt
      const notif1 = persistNotification(recipient.uid, {
        type,
        workspaceId,
        orgId: workspaceId,
        title: 'First Attempt',
        body: 'Initial content',
        actorId: sender.uid,
        senderId: sender.uid,
        resourceType: 'chat_message',
        resourceId: messageId,
        dedupeKey,
      }, sender);

      // Network retry: identical event processed again
      const notif2 = persistNotification(recipient.uid, {
        type,
        workspaceId,
        orgId: workspaceId,
        title: 'Retry Attempt',
        body: 'Initial content',
        actorId: sender.uid,
        senderId: sender.uid,
        resourceType: 'chat_message',
        resourceId: messageId,
        dedupeKey,
      }, sender);

      // Same notificationId produced
      assert.strictEqual(notif1.notificationId, notif2.notificationId);

      // Only ONE entry exists in recipient inbox
      const bobEntries = Object.keys(mockDb.user_notifications[recipient.uid]);
      assert.strictEqual(bobEntries.length, 1);
      assert.strictEqual(bobEntries[0], notif1.notificationId);
    });
  });

  // =========================================================================
  // SCENARIO J: Deleted parent message resilience
  // =========================================================================
  describe('📌 Scenario J: Deleted Parent Message Resilience', () => {
    it('notification remains fully readable with cached context even if parent message is deleted', () => {
      const notif = createCanonicalNotification({
        notificationId: 'notif_reply_orphan',
        recipientId: 'user_alice',
        workspaceId: 'org_alpha',
        type: NOTIFICATION_TYPES.MESSAGE_REPLY,
        title: 'Bob replied to your message',
        body: 'Bob: Yes, that sounds good.',
        previewText: 'Yes, that sounds good.',
        actorId: 'user_bob',
        actorName: 'Bob Builder',
        secondaryEntityId: 'deleted_parent_msg_999',
        resourceType: 'chat_reply',
        resourceId: 'reply_888',
        actionUrl: '/workspaces/org_alpha/chat?channel=general&threadId=deleted_parent_msg_999&replyId=reply_888',
        metadata: {
          channelId: 'general',
          parentMessageId: 'deleted_parent_msg_999',
          replyId: 'reply_888',
          workspaceId: 'org_alpha',
        },
      });

      // Notification fields remain intact
      assert.strictEqual(notif.type, NOTIFICATION_TYPES.MESSAGE_REPLY);
      assert.strictEqual(notif.title, 'Bob replied to your message');
      assert.strictEqual(notif.body, 'Bob: Yes, that sounds good.');
      assert.strictEqual(notif.secondaryEntityId, 'deleted_parent_msg_999');

      // Action URL provides safe fallback route
      assert.ok(notif.actionUrl.includes('/workspaces/org_alpha/chat'));
    });
  });

  // =========================================================================
  // SCENARIO K: Deleted conversation/workspace resilience
  // =========================================================================
  describe('📌 Scenario K: Deleted Conversation or Workspace Resilience', () => {
    it('notification actionUrl falls back safely if workspace is null or missing', () => {
      const actionUrlMissingWs = buildNotificationActionUrl({
        type: NOTIFICATION_TYPES.CHAT_MESSAGE,
        workspaceId: null,
        resourceId: 'msg_orphan',
        metadata: { channelId: 'general', messageId: 'msg_orphan' },
      });

      assert.strictEqual(actionUrlMissingWs, '/dashboard');

      const actionUrlValidWs = buildNotificationActionUrl({
        type: NOTIFICATION_TYPES.CHAT_MESSAGE,
        workspaceId: 'org_alpha',
        resourceId: 'msg_valid',
        metadata: { channelId: 'general', messageId: 'msg_valid' },
      });

      assert.strictEqual(actionUrlValidWs, '/workspaces/org_alpha/chat?channel=general&messageId=msg_valid');
    });
  });

  // =========================================================================
  // SCENARIO L: Multiple recipients (Atomic multi-path fan-out)
  // =========================================================================
  describe('📌 Scenario L: Multiple Recipients Isolation', () => {
    it('delivers atomic fan-out across multiple recipients without cross-contamination', () => {
      const sender = mockMembersOrgAlpha[0];
      const recipients = ['user_bob', 'user_david'];
      const workspaceId = 'org_alpha';
      const messageId = 'msg_multicast_1';

      persistNotificationsBulk(recipients, {
        type: NOTIFICATION_TYPES.CHAT_MESSAGE,
        workspaceId,
        orgId: workspaceId,
        channelId: 'general',
        title: 'Team announcement',
        body: 'Sprint review tomorrow.',
        actorId: sender.uid,
        senderId: sender.uid,
        resourceType: 'chat_message',
        resourceId: messageId,
      }, sender);

      // Verify each recipient has their isolated record
      assert.strictEqual(Object.keys(mockDb.user_notifications.user_bob || {}).length, 1);
      assert.strictEqual(Object.keys(mockDb.user_notifications.user_david || {}).length, 1);

      const bobNotif = Object.values(mockDb.user_notifications.user_bob)[0];
      const davidNotif = Object.values(mockDb.user_notifications.user_david)[0];

      assert.strictEqual(bobNotif.recipientId, 'user_bob');
      assert.strictEqual(davidNotif.recipientId, 'user_david');
      assert.notStrictEqual(bobNotif.notificationId, davidNotif.notificationId);
    });
  });

  // =========================================================================
  // SCENARIO M: User isolation & Security
  // =========================================================================
  describe('📌 Scenario M: Security & User Isolation', () => {
    it('denies User B from forging User A as senderId', () => {
      const bob = mockMembersOrgAlpha[1];
      assert.throws(() => {
        persistNotification('user_david', {
          type: NOTIFICATION_TYPES.CHAT_MESSAGE,
          workspaceId: 'org_alpha',
          orgId: 'org_alpha',
          senderId: 'user_alice', // Forged senderId
          actorId: 'user_alice',
        }, bob); // Authenticated as bob
      }, /Forged senderId/);
    });

    it('generates canonical paths adhering strictly to user_notifications/{uid}/{notifId}', () => {
      const rootPath = getUserNotificationsRootPath('user_bob');
      assert.strictEqual(rootPath, 'user_notifications/user_bob');

      const itemPath = getUserNotificationsPath('user_bob', 'notif_123');
      assert.strictEqual(itemPath, 'user_notifications/user_bob/notif_123');
    });
  });

  // =========================================================================
  // SCENARIO N: Notification deep-link metadata
  // =========================================================================
  describe('📌 Scenario N: Deep-Link Metadata Completeness', () => {
    it('verifies CHAT_MESSAGE deep link structure', () => {
      const notif = createCanonicalNotification({
        notificationId: 'n_msg',
        recipientId: 'user_bob',
        workspaceId: 'org_alpha',
        type: NOTIFICATION_TYPES.CHAT_MESSAGE,
        resourceType: 'chat_message',
        resourceId: 'msg_999',
        metadata: { channelId: 'engineering', messageId: 'msg_999', workspaceId: 'org_alpha' },
      });

      assert.strictEqual(notif.actionUrl, '/workspaces/org_alpha/chat?channel=engineering&messageId=msg_999');
      assert.strictEqual(notif.metadata.channelId, 'engineering');
      assert.strictEqual(notif.metadata.messageId, 'msg_999');
    });

    it('verifies CHAT_MENTION deep link structure', () => {
      const notif = createCanonicalNotification({
        notificationId: 'n_mention',
        recipientId: 'user_bob',
        workspaceId: 'org_alpha',
        type: NOTIFICATION_TYPES.CHAT_MENTION,
        resourceType: 'chat_mention',
        resourceId: 'msg_888',
        metadata: { channelId: 'design', messageId: 'msg_888', workspaceId: 'org_alpha' },
      });

      assert.strictEqual(notif.actionUrl, '/workspaces/org_alpha/chat?channel=design&messageId=msg_888');
      assert.strictEqual(notif.metadata.channelId, 'design');
    });

    it('verifies MESSAGE_REPLY deep link structure', () => {
      const notif = createCanonicalNotification({
        notificationId: 'n_reply',
        recipientId: 'user_alice',
        workspaceId: 'org_alpha',
        type: NOTIFICATION_TYPES.MESSAGE_REPLY,
        resourceType: 'chat_reply',
        resourceId: 'reply_777',
        secondaryEntityId: 'msg_parent_111',
        metadata: {
          channelId: 'product',
          parentMessageId: 'msg_parent_111',
          replyId: 'reply_777',
          workspaceId: 'org_alpha',
        },
      });

      assert.strictEqual(
        notif.actionUrl,
        '/workspaces/org_alpha/chat?channel=product&threadId=msg_parent_111&replyId=reply_777'
      );
      assert.strictEqual(notif.metadata.parentMessageId, 'msg_parent_111');
      assert.strictEqual(notif.metadata.replyId, 'reply_777');
      assert.strictEqual(notif.metadata.channelId, 'product');
    });
  });
});
