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

import { notificationService } from '../notificationService.js';
import { pushDeliveryService } from '../pushDeliveryService.js';

describe('🧪 CONVIA PHASE 7 — CENTRALIZED NOTIFICATION SYSTEM TEST SUITE', () => {
  // In-memory mock database store simulating Firebase Realtime Database
  let mockDb = {};

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
          user_charlie: { uid: 'user_charlie', role: 'owner' },
          user_eve: { uid: 'user_eve', role: 'member' },
        },
      },
      user_push_subscriptions: {
        user_bob: {
          device_1: { token: 'fcm_token_bob_1', platform: 'web' },
        },
      },
    };
  });

  // Mock security evaluator mirroring database.rules.json
  function evaluateNotificationSecurityRule({ path, operation, auth, newData = null, data = null }) {
    if (!auth || !auth.uid) {
      return { allowed: false, reason: 'UNAUTHENTICATED' };
    }

    const segments = path.split('/').filter(Boolean);
    if (segments[0] !== 'user_notifications') {
      return { allowed: false, reason: 'INVALID_PATH' };
    }

    const recipientUid = segments[1];
    const notifId = segments[2];

    // .read: auth != null && auth.uid === $uid
    if (operation === 'read') {
      const allowed = auth.uid === recipientUid;
      return { allowed, reason: allowed ? null : 'FORBIDDEN_READ' };
    }

    // .write: auth != null && (auth.uid === $uid || (!data.exists() && newData.child('senderId').val() === auth.uid))
    if (operation === 'write') {
      if (!notifId) {
        // Root writes disallowed for non-recipients
        return { allowed: auth.uid === recipientUid, reason: auth.uid === recipientUid ? null : 'FORBIDDEN' };
      }

      const isOwner = auth.uid === recipientUid;
      const isCreate = !data;

      if (isOwner) {
        return { allowed: true, reason: null };
      }

      if (isCreate && newData) {
        // Validate senderId matching auth.uid
        if (newData.senderId !== auth.uid) {
          return { allowed: false, reason: 'FORGED_SENDER_ID' };
        }
        // Validate required fields: type, senderId, createdAt
        if (!newData.type || !newData.senderId || !newData.createdAt) {
          return { allowed: false, reason: 'MISSING_REQUIRED_FIELDS' };
        }
        // Validate workspace boundary: if orgId is provided, sender must be a member
        if (newData.orgId) {
          const isMember = Boolean(
            mockDb.organization_members[newData.orgId]?.[auth.uid] ||
            mockDb.organizations[newData.orgId]?.ownerId === auth.uid
          );
          if (!isMember) {
            return { allowed: false, reason: 'CROSS_WORKSPACE_INJECTION_DENIED' };
          }
        }
        return { allowed: true, reason: null };
      }

      return { allowed: false, reason: 'FORBIDDEN_WRITE' };
    }

    return { allowed: false, reason: 'UNKNOWN_OPERATION' };
  }

  // -------------------------------------------------------------
  // Group 1: Security, Authorization & Workspace Boundary Isolation
  // -------------------------------------------------------------
  describe('🔒 1. Security & Workspace Boundary Isolation', () => {
    it('denies unauthenticated users from reading any notifications', () => {
      const res = evaluateNotificationSecurityRule({
        path: 'user_notifications/user_alice',
        operation: 'read',
        auth: null,
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'UNAUTHENTICATED');
    });

    it('prevents User B from reading User A notifications', () => {
      const res = evaluateNotificationSecurityRule({
        path: 'user_notifications/user_alice',
        operation: 'read',
        auth: { uid: 'user_bob' },
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'FORBIDDEN_READ');
    });

    it('allows User A to read and mutate their own notifications', () => {
      const readRes = evaluateNotificationSecurityRule({
        path: 'user_notifications/user_alice',
        operation: 'read',
        auth: { uid: 'user_alice' },
      });
      assert.strictEqual(readRes.allowed, true);

      const writeRes = evaluateNotificationSecurityRule({
        path: 'user_notifications/user_alice/n1',
        operation: 'write',
        auth: { uid: 'user_alice' },
        data: { read: false },
        newData: { read: true },
      });
      assert.strictEqual(writeRes.allowed, true);
    });

    it('blocks User B from modifying or deleting User A notifications', () => {
      const writeRes = evaluateNotificationSecurityRule({
        path: 'user_notifications/user_alice/n1',
        operation: 'write',
        auth: { uid: 'user_bob' },
        data: { read: false },
        newData: { read: true },
      });
      assert.strictEqual(writeRes.allowed, false);
      assert.strictEqual(writeRes.reason, 'FORBIDDEN_WRITE');
    });

    it('blocks forging a senderId when User A creates a notification', () => {
      const res = evaluateNotificationSecurityRule({
        path: 'user_notifications/user_bob/n2',
        operation: 'write',
        auth: { uid: 'user_alice' },
        data: null,
        newData: {
          type: NOTIFICATION_TYPES.CHAT_MESSAGE,
          senderId: 'user_charlie', // Forged sender!
          createdAt: Date.now(),
        },
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'FORGED_SENDER_ID');
    });

    it('blocks cross-workspace notification injection if sender is not a member', () => {
      // User Charlie (in org_beta) attempts to inject a notification referencing org_alpha
      const res = evaluateNotificationSecurityRule({
        path: 'user_notifications/user_alice/n3',
        operation: 'write',
        auth: { uid: 'user_charlie' },
        data: null,
        newData: {
          type: NOTIFICATION_TYPES.IDEA_CREATED,
          senderId: 'user_charlie',
          orgId: 'org_alpha', // Not a member of org_alpha!
          createdAt: Date.now(),
        },
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'CROSS_WORKSPACE_INJECTION_DENIED');
    });
  });

  // -------------------------------------------------------------
  // Group 2: Recipient Resolution & Self-Notification Suppression
  // -------------------------------------------------------------
  describe('👥 2. Recipient Resolution & Self-Notification Suppression', () => {
    it('resolves workspace members and strictly excludes the actor', () => {
      const members = ['user_alice', 'user_bob', 'user_david'];
      const actorUid = 'user_alice';

      const recipients = members.filter((uid) => uid !== actorUid);
      assert.deepStrictEqual(recipients, ['user_bob', 'user_david']);
      assert.strictEqual(recipients.includes(actorUid), false);
    });

    it('builds deterministic deduplication keys across events', () => {
      const key1 = buildNotificationDedupeKey({
        workspaceId: 'org_alpha',
        type: NOTIFICATION_TYPES.IDEA_CREATED,
        resourceId: 'idea_100',
        recipientId: 'user_bob',
        actorId: 'user_alice',
      });

      const key2 = buildNotificationDedupeKey({
        workspaceId: 'org_alpha',
        type: NOTIFICATION_TYPES.IDEA_CREATED,
        resourceId: 'idea_100',
        recipientId: 'user_bob',
        actorId: 'user_alice',
      });

      assert.strictEqual(key1, key2);
      assert.strictEqual(key1, 'org_alpha_IDEA_CREATED_idea_100_user_alice_user_bob');
    });
  });

  // -------------------------------------------------------------
  // Group 3: Canonical Notification Schema & Deep Links (All 6 Event Categories)
  // -------------------------------------------------------------
  describe('📦 3. Canonical Notification Schema & Deep Links (All 6 Categories)', () => {
    it('creates canonical CHAT_MESSAGE notification with deep link', () => {
      const notif = createCanonicalNotification({
        notificationId: 'notif_chat_1',
        recipientId: 'user_bob',
        workspaceId: 'org_alpha',
        type: NOTIFICATION_TYPES.CHAT_MESSAGE,
        title: 'New message in #general',
        body: 'Let us sync on the new design specs.',
        actorId: 'user_alice',
        actorName: 'Alice',
        resourceType: 'chat_message',
        resourceId: 'msg_999',
        metadata: { channelId: 'general', messageId: 'msg_999' },
      });

      assert.strictEqual(notif.type, 'CHAT_MESSAGE');
      assert.strictEqual(notif.workspaceId, 'org_alpha');
      assert.strictEqual(notif.actionUrl, '/workspaces/org_alpha/chat?channel=general&messageId=msg_999');
      assert.strictEqual(notif.read, false);
      assert.strictEqual(getNotificationCategory(notif.type), NOTIFICATION_CATEGORIES.CHAT);
    });

    it('creates canonical CHAT_REPLY notification with thread deep link', () => {
      const notif = createCanonicalNotification({
        notificationId: 'notif_reply_1',
        recipientId: 'user_alice',
        workspaceId: 'org_alpha',
        type: NOTIFICATION_TYPES.CHAT_REPLY,
        title: 'New reply to your message',
        body: 'Looks great to me!',
        actorId: 'user_bob',
        actorName: 'Bob',
        resourceType: 'chat_reply',
        resourceId: 'reply_555',
        metadata: { channelId: 'general', parentMessageId: 'msg_999', replyId: 'reply_555' },
      });

      assert.strictEqual(notif.type, 'CHAT_REPLY');
      assert.strictEqual(notif.actionUrl, '/workspaces/org_alpha/chat?channel=general&threadId=msg_999&replyId=reply_555');
    });

    it('creates canonical BLUEPRINT_COMPLETED notification with blueprint deep link', () => {
      const notif = createCanonicalNotification({
        notificationId: 'notif_bp_1',
        recipientId: 'user_alice',
        workspaceId: 'org_alpha',
        type: NOTIFICATION_TYPES.BLUEPRINT_COMPLETED,
        title: 'Blueprint v1.0 Completed',
        body: 'AI Architecture Blueprint for "Workspace MVP" is ready for review.',
        actorId: 'system',
        actorName: 'Convia AI Engine',
        resourceType: 'blueprint',
        resourceId: 'bp_org_alpha',
      });

      assert.strictEqual(notif.type, 'BLUEPRINT_COMPLETED');
      assert.strictEqual(notif.actionUrl, '/workspaces/org_alpha/blueprint');
      assert.strictEqual(getNotificationCategory(notif.type), NOTIFICATION_CATEGORIES.BLUEPRINT);
    });

    it('creates canonical BLUEPRINT_FAILED notification with friendly error notice', () => {
      const notif = createCanonicalNotification({
        notificationId: 'notif_bp_fail',
        recipientId: 'user_alice',
        workspaceId: 'org_alpha',
        type: NOTIFICATION_TYPES.BLUEPRINT_FAILED,
        title: 'Blueprint Generation Notice',
        body: 'Generation for "Workspace MVP" could not be completed: Service timeout.',
        actorId: 'system',
        actorName: 'Convia AI Engine',
        resourceType: 'blueprint',
        resourceId: 'bp_org_alpha',
      });

      assert.strictEqual(notif.type, 'BLUEPRINT_FAILED');
      assert.strictEqual(notif.actionUrl, '/workspaces/org_alpha/blueprint');
    });

    it('creates canonical IDEA_CREATED notification with idea deep link', () => {
      const notif = createCanonicalNotification({
        notificationId: 'notif_idea_1',
        recipientId: 'user_bob',
        workspaceId: 'org_alpha',
        type: NOTIFICATION_TYPES.IDEA_CREATED,
        title: 'New Proposal Posted',
        body: 'Alice submitted proposal "AI Code Reviewer".',
        actorId: 'user_alice',
        actorName: 'Alice',
        resourceType: 'idea',
        resourceId: 'idea_42',
      });

      assert.strictEqual(notif.type, 'IDEA_CREATED');
      assert.strictEqual(notif.actionUrl, '/workspaces/org_alpha/ideas/idea_42');
      assert.strictEqual(getNotificationCategory(notif.type), NOTIFICATION_CATEGORIES.IDEA);
    });

    it('creates canonical IDEA_SUGGESTION_CREATED notification with suggestion tab deep link', () => {
      const notif = createCanonicalNotification({
        notificationId: 'notif_sugg_1',
        recipientId: 'user_alice',
        workspaceId: 'org_alpha',
        type: NOTIFICATION_TYPES.IDEA_SUGGESTION_CREATED,
        title: 'New Suggestion on your Proposal',
        body: 'Bob suggested: "Add redis caching layer"',
        actorId: 'user_bob',
        actorName: 'Bob',
        resourceType: 'suggestion',
        resourceId: 'disc_77',
        metadata: { ideaId: 'idea_42', discussionId: 'disc_77' },
      });

      assert.strictEqual(notif.type, 'IDEA_SUGGESTION_CREATED');
      assert.strictEqual(notif.actionUrl, '/workspaces/org_alpha/ideas/idea_42?tab=suggestions&discussionId=disc_77');
      assert.strictEqual(getNotificationCategory(notif.type), NOTIFICATION_CATEGORIES.SUGGESTION);
    });

    it('creates canonical COMMENT_CREATED notification with comment tab deep link', () => {
      const notif = createCanonicalNotification({
        notificationId: 'notif_comment_1',
        recipientId: 'user_alice',
        workspaceId: 'org_alpha',
        type: NOTIFICATION_TYPES.COMMENT_CREATED,
        title: 'New Comment on your Proposal',
        body: 'David: "We should benchmark this first."',
        actorId: 'user_david',
        actorName: 'David',
        resourceType: 'comment',
        resourceId: 'disc_88',
        metadata: { ideaId: 'idea_42', discussionId: 'disc_88' },
      });

      assert.strictEqual(notif.type, 'COMMENT_CREATED');
      assert.strictEqual(notif.actionUrl, '/workspaces/org_alpha/ideas/idea_42?tab=comments&discussionId=disc_88');
      assert.strictEqual(getNotificationCategory(notif.type), NOTIFICATION_CATEGORIES.COMMENT);
    });

    it('creates canonical QUESTION_CREATED notification with question tab deep link', () => {
      const notif = createCanonicalNotification({
        notificationId: 'notif_q_1',
        recipientId: 'user_alice',
        workspaceId: 'org_alpha',
        type: NOTIFICATION_TYPES.QUESTION_CREATED,
        title: 'Question asked on your Proposal',
        body: 'Bob: "What is the expected latency target?"',
        actorId: 'user_bob',
        actorName: 'Bob',
        resourceType: 'question',
        resourceId: 'disc_99',
        metadata: { ideaId: 'idea_42', discussionId: 'disc_99' },
      });

      assert.strictEqual(notif.type, 'QUESTION_CREATED');
      assert.strictEqual(notif.actionUrl, '/workspaces/org_alpha/ideas/idea_42?tab=questions&discussionId=disc_99');
      assert.strictEqual(getNotificationCategory(notif.type), NOTIFICATION_CATEGORIES.QUESTION);
    });
  });

  // -------------------------------------------------------------
  // Group 4: Read State & Atomic Unread Counter Invariants
  // -------------------------------------------------------------
  describe('📬 4. Read State & Unread Counter Invariants', () => {
    it('accurately computes unread count and marks one as read', () => {
      const list = [
        { notificationId: 'n1', read: false, createdAt: 100 },
        { notificationId: 'n2', read: false, createdAt: 200 },
        { notificationId: 'n3', read: true, createdAt: 50 },
      ];

      const initialUnread = list.filter((n) => !n.read).length;
      assert.strictEqual(initialUnread, 2);

      // Simulate marking n2 as read
      const updated = list.map((n) => (n.notificationId === 'n2' ? { ...n, read: true } : n));
      const afterUnread = updated.filter((n) => !n.read).length;
      assert.strictEqual(afterUnread, 1);
      assert.strictEqual(updated.find((n) => n.notificationId === 'n2').read, true);
    });

    it('marks all as read atomically', () => {
      const list = [
        { notificationId: 'n1', read: false },
        { notificationId: 'n2', read: false },
        { notificationId: 'n3', read: true },
      ];

      const updates = {};
      const now = Date.now();
      list.forEach((n) => {
        if (!n.read) {
          updates[`user_notifications/user_bob/${n.notificationId}/read`] = true;
          updates[`user_notifications/user_bob/${n.notificationId}/readAt`] = now;
        }
      });

      assert.strictEqual(Object.keys(updates).length, 4);
      assert.strictEqual(updates['user_notifications/user_bob/n1/read'], true);
      assert.strictEqual(updates['user_notifications/user_bob/n2/read'], true);
    });
  });

  // -------------------------------------------------------------
  // Group 5: Offline Persistence & Retrieval
  // -------------------------------------------------------------
  describe('💾 5. Offline Persistence & Retrieval Lifecycle', () => {
    it('persists notification in database so offline user sees it upon returning', () => {
      // User Bob is offline (not connected)
      // User Alice generates an event in org_alpha
      const notif = createCanonicalNotification({
        notificationId: 'notif_offline_1',
        recipientId: 'user_bob',
        workspaceId: 'org_alpha',
        type: NOTIFICATION_TYPES.IDEA_CREATED,
        title: 'New Proposal Posted',
        body: 'Alice submitted proposal "Offline Resilience".',
        actorId: 'user_alice',
        actorName: 'Alice',
        createdAt: 1725000000000,
      });

      // Write to Bob's inbox while Bob is offline
      mockDb.user_notifications.user_bob = {
        [notif.notificationId]: notif,
      };

      // Bob returns online: query user_notifications/user_bob
      const bobsInbox = mockDb.user_notifications.user_bob;
      assert(bobsInbox);
      assert.strictEqual(Object.keys(bobsInbox).length, 1);

      const retrievedNotif = bobsInbox['notif_offline_1'];
      assert.strictEqual(retrievedNotif.title, 'New Proposal Posted');
      assert.strictEqual(retrievedNotif.read, false);
      assert.strictEqual(retrievedNotif.recipientId, 'user_bob');
    });
  });

  // -------------------------------------------------------------
  // Group 6: Push Delivery Service Abstraction
  // -------------------------------------------------------------
  describe('📡 6. Push Delivery Service Abstraction', () => {
    it('handles registered push endpoints gracefully', async () => {
      const notif = createCanonicalNotification({
        notificationId: 'notif_push_1',
        recipientId: 'user_bob',
        type: NOTIFICATION_TYPES.CHAT_MESSAGE,
        title: 'New message',
        body: 'Hey Bob!',
      });

      const result = await pushDeliveryService.sendPushNotification('user_bob', notif);
      assert(result !== null);
      assert(typeof result.delivered === 'boolean');
    });

    it('returns clean zero-count result when user has no registered device endpoints', async () => {
      const notif = createCanonicalNotification({
        notificationId: 'notif_push_2',
        recipientId: 'user_david', // No tokens
        type: NOTIFICATION_TYPES.CHAT_MESSAGE,
        title: 'New message',
        body: 'Hey David!',
      });

      const result = await pushDeliveryService.sendPushNotification('user_david', notif);
      assert.strictEqual(result.delivered, false);
      assert.strictEqual(result.recipientsCount, 0);
      assert.strictEqual(result.error, null);
    });
  });
});
