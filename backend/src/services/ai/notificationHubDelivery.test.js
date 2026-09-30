/**
 * CONVIA — NOTIFICATION HUB: END-TO-END DELIVERY & DISPLAY TEST SUITE
 *
 * Verifies end-to-end delivery across the 5 core event categories:
 * 1. New team chat message
 * 2. Reply to a chat message
 * 3. Reaction on a chat message
 * 4. New idea/proposal inside a workspace
 * 5. Blueprint generation completed (by owner & by other member)
 *
 * Plus isolation, idempotency, deep links, and canonical storage verification.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  NOTIFICATION_TYPES,
  NOTIFICATION_CATEGORIES,
  getNotificationCategory,
  buildNotificationDedupeKey,
  buildNotificationActionUrl,
  createCanonicalNotification,
} from '../../constants/notificationConstants.js';

import { notificationService } from '../notificationService.js';
import { rtdbService } from '../rtdbService.js';

describe('🔔 CONVIA NOTIFICATION HUB — END-TO-END DELIVERY TEST SUITE', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = {
      organizations: {
        ws_acme: {
          id: 'ws_acme',
          name: 'Acme Workspace',
          ownerId: 'user_owner',
          members: {
            user_owner: { uid: 'user_owner', role: 'owner', name: 'Alice Owner' },
            user_member1: { uid: 'user_member1', role: 'member', name: 'Bob Builder' },
            user_member2: { uid: 'user_member2', role: 'member', name: 'Charlie Coder' },
          },
        },
      },
      organization_members: {
        ws_acme: {
          user_owner: { uid: 'user_owner', role: 'owner', status: 'active' },
          user_member1: { uid: 'user_member1', role: 'member', status: 'active' },
          user_member2: { uid: 'user_member2', role: 'member', status: 'active' },
          user_removed: { uid: 'user_removed', role: 'member', status: 'removed' },
        },
      },
      user_notifications: {},
      workspaceChats: {
        ws_acme: {
          general: {
            msg_100: {
              messageId: 'msg_100',
              senderId: 'user_member1',
              senderName: 'Bob Builder',
              content: 'Hey team, let us review the MVP scope.',
              createdAt: Date.now() - 50000,
            },
          },
        },
      },
    };

    // Isolated Mock RTDB Service
    rtdbService.getData = async (path) => {
      const parts = path.split('/').filter(Boolean);
      let curr = mockDb;
      for (const p of parts) {
        if (!curr || typeof curr !== 'object') return null;
        curr = curr[p];
      }
      return curr !== undefined ? JSON.parse(JSON.stringify(curr)) : null;
    };

    rtdbService.setData = async (path, val) => {
      const parts = path.split('/').filter(Boolean);
      let curr = mockDb;
      for (let i = 0; i < parts.length - 1; i++) {
        const p = parts[i];
        if (!curr[p] || typeof curr[p] !== 'object') {
          curr[p] = {};
        }
        curr = curr[p];
      }
      curr[parts[parts.length - 1]] = JSON.parse(JSON.stringify(val));
      return true;
    };

    rtdbService.updateData = async (path, updates) => {
      if (path === '/') {
        for (const [subPath, val] of Object.entries(updates)) {
          const parts = subPath.split('/').filter(Boolean);
          let curr = mockDb;
          for (let i = 0; i < parts.length - 1; i++) {
            const p = parts[i];
            if (!curr[p] || typeof curr[p] !== 'object') {
              curr[p] = {};
            }
            curr = curr[p];
          }
          curr[parts[parts.length - 1]] = JSON.parse(JSON.stringify(val));
        }
        return true;
      }
      const parts = path.split('/').filter(Boolean);
      let curr = mockDb;
      for (const p of parts) {
        if (!curr[p] || typeof curr[p] !== 'object') {
          curr[p] = {};
        }
        curr = curr[p];
      }
      Object.assign(curr, JSON.parse(JSON.stringify(updates)));
      return true;
    };
  });

  // ---------------------------------------------------------------------------
  // 1. CHAT MESSAGE NOTIFICATIONS
  // ---------------------------------------------------------------------------
  it('1. Team chat message produces CHAT_MESSAGE for other members, strictly suppressing the sender', async () => {
    const notifs = await notificationService.dispatchNotificationEvent(
      NOTIFICATION_TYPES.CHAT_MESSAGE,
      {
        workspaceId: 'ws_acme',
        channelId: 'general',
        messageId: 'msg_200',
        content: 'New deployment ready for test',
      },
      { uid: 'user_member1', displayName: 'Bob Builder' }
    );

    assert.ok(notifs.length >= 2, 'Should notify owner and member2');
    const recipientUids = notifs.map((n) => n.recipientId);

    assert.ok(recipientUids.includes('user_owner'), 'Owner should receive chat notification');
    assert.ok(recipientUids.includes('user_member2'), 'Member2 should receive chat notification');
    assert.ok(!recipientUids.includes('user_member1'), 'Sender must NOT receive notification');
    assert.ok(!recipientUids.includes('user_removed'), 'Removed member must NOT receive notification');

    // Verify canonical path and fields
    const ownerNotif = notifs.find((n) => n.recipientId === 'user_owner');
    assert.strictEqual(ownerNotif.type, NOTIFICATION_TYPES.CHAT_MESSAGE);
    assert.strictEqual(ownerNotif.actorId, 'user_member1');
    assert.ok(ownerNotif.actionUrl.includes('/workspaces/ws_acme/chat'));
    assert.strictEqual(ownerNotif.read, false);

    // Verify written to mockDb at user_notifications/{recipientUid}/{notifId}
    assert.ok(mockDb.user_notifications.user_owner[ownerNotif.notificationId]);
  });

  // ---------------------------------------------------------------------------
  // 2. CHAT REPLY NOTIFICATIONS
  // ---------------------------------------------------------------------------
  it('2. Reply to chat message delivers MESSAGE_REPLY to parent author, suppressing if replying to oneself', async () => {
    // Member2 replies to Bob's (user_member1) message
    const notifs = await notificationService.dispatchNotificationEvent(
      NOTIFICATION_TYPES.MESSAGE_REPLY,
      {
        workspaceId: 'ws_acme',
        channelId: 'general',
        parentMessageId: 'msg_100',
        replyId: 'rep_1',
        content: 'Sounds good Bob, reviewing now!',
        parentAuthorId: 'user_member1',
      },
      { uid: 'user_member2', displayName: 'Charlie Coder' }
    );

    assert.strictEqual(notifs.length, 1);
    const notif = notifs[0];
    assert.strictEqual(notif.recipientId, 'user_member1');
    assert.strictEqual(notif.type, NOTIFICATION_TYPES.MESSAGE_REPLY);
    assert.ok(notif.title.includes('replied'));
    assert.ok(notif.actionUrl.includes('threadId=msg_100'));

    // Self-reply suppression: Bob replies to his own message
    const selfReplyNotifs = await notificationService.dispatchNotificationEvent(
      NOTIFICATION_TYPES.MESSAGE_REPLY,
      {
        workspaceId: 'ws_acme',
        channelId: 'general',
        parentMessageId: 'msg_100',
        replyId: 'rep_2',
        content: 'Also forgot to mention, check the DB schema.',
        parentAuthorId: 'user_member1',
      },
      { uid: 'user_member1', displayName: 'Bob Builder' }
    );
    assert.strictEqual(selfReplyNotifs.length, 0, 'Self-replies must not generate notification');
  });

  // ---------------------------------------------------------------------------
  // 3. CHAT REACTION NOTIFICATIONS
  // ---------------------------------------------------------------------------
  it('3. Reaction on chat message delivers CHAT_REACTION to message author, suppressing self-reactions', async () => {
    // Charlie reacts with 👍 to Bob's message
    const notifs = await notificationService.dispatchNotificationEvent(
      NOTIFICATION_TYPES.CHAT_REACTION,
      {
        workspaceId: 'ws_acme',
        channelId: 'general',
        messageId: 'msg_100',
        emoji: '👍',
        recipientId: 'user_member1',
        content: 'Hey team, let us review the MVP scope.',
      },
      { uid: 'user_member2', displayName: 'Charlie Coder' }
    );

    assert.strictEqual(notifs.length, 1);
    const notif = notifs[0];
    assert.strictEqual(notif.recipientId, 'user_member1');
    assert.strictEqual(notif.type, NOTIFICATION_TYPES.CHAT_REACTION);
    assert.ok(notif.title.includes('reacted 👍'));
    assert.ok(notif.actionUrl.includes('/workspaces/ws_acme/chat'));

    // Self-reaction: Bob reacts to his own message -> should be suppressed
    const selfReactNotifs = await notificationService.dispatchNotificationEvent(
      NOTIFICATION_TYPES.CHAT_REACTION,
      {
        workspaceId: 'ws_acme',
        channelId: 'general',
        messageId: 'msg_100',
        emoji: '🔥',
        recipientId: 'user_member1',
        content: 'Hey team, let us review the MVP scope.',
      },
      { uid: 'user_member1', displayName: 'Bob Builder' }
    );
    assert.strictEqual(selfReactNotifs.length, 0, 'Self-reactions must not generate notification');
  });

  // ---------------------------------------------------------------------------
  // 4. IDEA / PROPOSAL CREATION NOTIFICATIONS
  // ---------------------------------------------------------------------------
  it('4. New idea/proposal posted inside workspace notifies all members, strictly excluding author', async () => {
    const notifs = await notificationService.dispatchNotificationEvent(
      NOTIFICATION_TYPES.IDEA_CREATED,
      {
        workspaceId: 'ws_acme',
        ideaId: 'idea_42',
        title: 'Real-Time Telemetry Pipeline',
      },
      { uid: 'user_owner', displayName: 'Alice Owner' }
    );

    assert.ok(notifs.length >= 2, 'Should notify Bob and Charlie');
    const recipientUids = notifs.map((n) => n.recipientId);
    assert.ok(recipientUids.includes('user_member1'));
    assert.ok(recipientUids.includes('user_member2'));
    assert.ok(!recipientUids.includes('user_owner'), 'Author must not be notified');

    const notif = notifs[0];
    assert.strictEqual(notif.type, NOTIFICATION_TYPES.IDEA_CREATED);
    assert.strictEqual(getNotificationCategory(notif.type), NOTIFICATION_CATEGORIES.IDEA);
    assert.ok(notif.actionUrl.includes('/workspaces/ws_acme/ideas/idea_42'));
    assert.strictEqual(notif.read, false);
  });

  // ---------------------------------------------------------------------------
  // 5. BLUEPRINT GENERATION COMPLETED (BY OWNER & BY MEMBER)
  // ---------------------------------------------------------------------------
  it('5a. Blueprint generation completed performed by workspace OWNER delivers to all members and owner', async () => {
    // Resolve members to simulate blueprintController passing allRecipients
    const members = await notificationService.resolveWorkspaceRecipients('ws_acme');
    const allRecipients = Array.from(new Set([...members, 'user_owner'].filter(Boolean)));

    const notifs = await notificationService.dispatchNotificationEvent(
      NOTIFICATION_TYPES.BLUEPRINT_COMPLETED,
      {
        workspaceId: 'ws_acme',
        mvpIdeaId: 'idea_42',
        resourceId: 'bp_ws_acme_idea_42',
        version: '1.0',
        ideaTitle: 'Real-Time Telemetry Pipeline',
        initiatorUid: 'user_owner',
        recipients: allRecipients,
      },
      { uid: 'user_owner', displayName: 'Alice Owner' }
    );

    assert.ok(notifs.length >= 3, 'All members and owner should receive notification');
    const recipientUids = notifs.map((n) => n.recipientId);
    assert.ok(recipientUids.includes('user_owner'), 'Owner (initiator) receives confirmation');
    assert.ok(recipientUids.includes('user_member1'), 'Member1 receives notification');
    assert.ok(recipientUids.includes('user_member2'), 'Member2 receives notification');

    const notif = notifs[0];
    assert.strictEqual(notif.type, NOTIFICATION_TYPES.BLUEPRINT_COMPLETED);
    assert.strictEqual(getNotificationCategory(notif.type), NOTIFICATION_CATEGORIES.BLUEPRINT);
    assert.ok(notif.actionUrl.includes('/workspaces/ws_acme/blueprint'));
  });

  it('5b. Blueprint generation completed performed by ANOTHER MEMBER delivers to initiator, owner, and other members', async () => {
    // Member Bob generates blueprint
    const members = await notificationService.resolveWorkspaceRecipients('ws_acme');
    const allRecipients = Array.from(new Set([...members, 'user_member1'].filter(Boolean)));

    const notifs = await notificationService.dispatchNotificationEvent(
      NOTIFICATION_TYPES.BLUEPRINT_COMPLETED,
      {
        workspaceId: 'ws_acme',
        mvpIdeaId: 'idea_42',
        resourceId: 'bp_ws_acme_idea_42',
        version: '2.0',
        ideaTitle: 'Real-Time Telemetry Pipeline',
        initiatorUid: 'user_member1',
        recipients: allRecipients,
      },
      { uid: 'user_member1', displayName: 'Bob Builder' }
    );

    assert.ok(notifs.length >= 3, 'Should deliver to Bob (initiator), Alice (owner), and Charlie (member)');
    const recipientUids = notifs.map((n) => n.recipientId);
    assert.ok(recipientUids.includes('user_member1'), 'Bob (initiator) receives confirmation');
    assert.ok(recipientUids.includes('user_owner'), 'Alice (owner) receives notification');
    assert.ok(recipientUids.includes('user_member2'), 'Charlie receives notification');
  });

  // ---------------------------------------------------------------------------
  // 6. ISOLATION & CANONICAL STORAGE INTEGRITY
  // ---------------------------------------------------------------------------
  it('6. Verifies strict user isolation: User A notifications are stored strictly under user_notifications/UserA', async () => {
    await notificationService.createNotification('user_member1', {
      type: NOTIFICATION_TYPES.CHAT_MESSAGE,
      title: 'Private Message Notification',
      body: 'Only for Bob',
      workspaceId: 'ws_acme',
    });

    assert.ok(mockDb.user_notifications.user_member1, 'user_member1 subtree must exist');
    assert.strictEqual(
      Object.keys(mockDb.user_notifications.user_owner || {}).length,
      0,
      'user_owner inbox must not contain user_member1 notifications'
    );
  });

  // ---------------------------------------------------------------------------
  // 7. DEDUPLICATION & IDEMPOTENCE
  // ---------------------------------------------------------------------------
  it('7. Deterministic dedupeKey produces identical notificationId and prevents duplication', async () => {
    const dedupeKey = buildNotificationDedupeKey({
      workspaceId: 'ws_acme',
      type: NOTIFICATION_TYPES.CHAT_REACTION,
      resourceId: 'msg_100',
      recipientId: 'user_member1',
      actorId: 'user_member2',
    });

    const notif1 = await notificationService.createNotification('user_member1', {
      type: NOTIFICATION_TYPES.CHAT_REACTION,
      title: 'Reacted 👍',
      body: 'Preview',
      workspaceId: 'ws_acme',
      dedupeKey,
    });

    const notif2 = await notificationService.createNotification('user_member1', {
      type: NOTIFICATION_TYPES.CHAT_REACTION,
      title: 'Reacted 👍',
      body: 'Preview',
      workspaceId: 'ws_acme',
      dedupeKey,
    });

    assert.strictEqual(notif1.notificationId, notif2.notificationId);
    assert.strictEqual(
      Object.keys(mockDb.user_notifications.user_member1).filter((k) => k === notif1.notificationId).length,
      1,
      'Should overwrite idempotently with same notificationId'
    );
  });
});
