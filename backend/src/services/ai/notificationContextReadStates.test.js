import assert from 'node:assert/strict';
import { notificationService } from '../notificationService.js';
import { rtdbService } from '../rtdbService.js';
import {
  NOTIFICATION_TYPES,
  createCanonicalNotification,
} from '../../constants/notificationConstants.js';

console.log('🧪 Running [notificationContextReadStates.test.js] — Convia Context-Aware Notification Read States Test Suite...');

async function runContextReadTests() {
  const testUserId = `test_user_ctx_${Date.now()}`;
  const workspaceA = `ws_alpha_${Date.now()}`;
  const workspaceB = `ws_beta_${Date.now()}`;

  // Helper to populate notifications directly for testUserId in RTDB
  async function seedTestNotifications() {
    const timestamp = Date.now();
    const notifications = [
      // 1. Workspace A - #general message 1
      createCanonicalNotification({
        notificationId: `notif_wsA_gen_1_${timestamp}`,
        recipientId: testUserId,
        workspaceId: workspaceA,
        channelId: 'general',
        type: NOTIFICATION_TYPES.CHAT_MESSAGE,
        title: 'New message in #general',
        body: 'User 1: Hello general!',
        metadata: { workspaceId: workspaceA, channelId: 'general', messageId: 'msg_wsA_gen_1' },
      }),
      // 2. Workspace A - #general message 2
      createCanonicalNotification({
        notificationId: `notif_wsA_gen_2_${timestamp}`,
        recipientId: testUserId,
        workspaceId: workspaceA,
        channelId: 'general',
        type: NOTIFICATION_TYPES.CHAT_MESSAGE,
        title: 'New message in #general',
        body: 'User 2: Another in general',
        metadata: { workspaceId: workspaceA, channelId: 'general', messageId: 'msg_wsA_gen_2' },
      }),
      // 3. Workspace A - #dev message 1
      createCanonicalNotification({
        notificationId: `notif_wsA_dev_1_${timestamp}`,
        recipientId: testUserId,
        workspaceId: workspaceA,
        channelId: 'dev',
        type: NOTIFICATION_TYPES.CHAT_MESSAGE,
        title: 'New message in #dev',
        body: 'Dev lead: Deployment started',
        metadata: { workspaceId: workspaceA, channelId: 'dev', messageId: 'msg_wsA_dev_1' },
      }),
      // 4. Workspace B - #general message
      createCanonicalNotification({
        notificationId: `notif_wsB_gen_1_${timestamp}`,
        recipientId: testUserId,
        workspaceId: workspaceB,
        channelId: 'general',
        type: NOTIFICATION_TYPES.CHAT_MESSAGE,
        title: 'New message in #general (Workspace B)',
        body: 'Team B: Welcome to Workspace B',
        metadata: { workspaceId: workspaceB, channelId: 'general', messageId: 'msg_wsB_gen_1' },
      }),
      // 5. Community Channel - General post
      createCanonicalNotification({
        notificationId: `notif_comm_post_1_${timestamp}`,
        recipientId: testUserId,
        workspaceId: 'community',
        type: NOTIFICATION_TYPES.COMMUNITY_REPLY,
        title: 'New community reply',
        body: 'Member: Great insight on React 19',
        secondaryEntityId: 'thread_react19',
        metadata: { parentMessageId: 'thread_react19', replyId: 'reply_1' },
      }),
      // 6. Community Channel - Another thread post
      createCanonicalNotification({
        notificationId: `notif_comm_post_2_${timestamp}`,
        recipientId: testUserId,
        workspaceId: 'community',
        type: NOTIFICATION_TYPES.COMMUNITY_REPLY,
        title: 'New community reply on AI architecture',
        body: 'Member: Check this design pattern',
        secondaryEntityId: 'thread_ai_arch',
        metadata: { parentMessageId: 'thread_ai_arch', replyId: 'reply_2' },
      }),
      // 7. Non-chat event: Blueprint Completed in Workspace A
      createCanonicalNotification({
        notificationId: `notif_bp_comp_${timestamp}`,
        recipientId: testUserId,
        workspaceId: workspaceA,
        type: NOTIFICATION_TYPES.BLUEPRINT_COMPLETED,
        title: 'Blueprint Ready',
        body: 'Architecture blueprint ready for review',
        metadata: { workspaceId: workspaceA, ideaId: 'idea_mvp' },
      }),
      // 8. Non-chat event: Task Assigned in Workspace A
      createCanonicalNotification({
        notificationId: `notif_task_assign_${timestamp}`,
        recipientId: testUserId,
        workspaceId: workspaceA,
        type: NOTIFICATION_TYPES.TASK_ASSIGNED,
        title: 'Task Assigned',
        body: 'Implement auth module',
        metadata: { workspaceId: workspaceA, taskId: 'task_001' },
      }),
    ];

    const updates = {};
    for (const n of notifications) {
      updates[`user_notifications/${testUserId}/${n.notificationId}`] = n;
    }
    await rtdbService.updateData('/', updates);
    return notifications;
  }

  // ==========================================================================
  // SCENARIO 1: Workspace A #general marks only its notifications read
  // ==========================================================================
  console.log('\n▶ [SCENARIO 1] Workspace A #general marks only its notifications read');
  {
    const notifications = await seedTestNotifications();
    const initialUnread = await notificationService.fetchUnreadCount(testUserId);
    assert.strictEqual(initialUnread, 8, 'Initial unread count must be 8');

    // Mark notifications for Workspace A #general
    const updated = await notificationService.markNotificationsAsReadByContext(testUserId, {
      workspaceId: workspaceA,
      channelId: 'general',
    });

    assert.strictEqual(updated.length, 2, 'Must update exactly 2 notifications from Workspace A #general');

    const remainingUnread = await notificationService.fetchUnreadCount(testUserId);
    assert.strictEqual(remainingUnread, 6, 'Remaining unread count must decrease by exactly 2 (8 -> 6)');

    // Verify individual items in RTDB
    const allNotifs = await notificationService.fetchNotifications(testUserId, { limit: 20 });
    const notifMap = new Map(allNotifs.map((n) => [n.notificationId, n]));

    assert.strictEqual(notifMap.get(notifications[0].notificationId).read, true, 'Workspace A #general 1 must be read');
    assert.strictEqual(notifMap.get(notifications[1].notificationId).read, true, 'Workspace A #general 2 must be read');
    assert.strictEqual(notifMap.get(notifications[2].notificationId).read, false, 'Workspace A #dev must remain unread');
    assert.strictEqual(notifMap.get(notifications[3].notificationId).read, false, 'Workspace B #general must remain unread');
    assert.strictEqual(notifMap.get(notifications[4].notificationId).read, false, 'Community thread 1 must remain unread');
    assert.strictEqual(notifMap.get(notifications[5].notificationId).read, false, 'Community thread 2 must remain unread');
    assert.strictEqual(notifMap.get(notifications[6].notificationId).read, false, 'Blueprint notification must remain unread');
    assert.strictEqual(notifMap.get(notifications[7].notificationId).read, false, 'Task assignment must remain unread');

    console.log('  ✔ Only Workspace A #general notifications were marked read');
  }

  // ==========================================================================
  // SCENARIO 2: Idempotency - Viewing the same conversation again
  // ==========================================================================
  console.log('\n▶ [SCENARIO 2] Idempotency when viewing the same conversation again');
  {
    const secondCall = await notificationService.markNotificationsAsReadByContext(testUserId, {
      workspaceId: workspaceA,
      channelId: 'general',
    });
    assert.strictEqual(secondCall.length, 0, 'No notifications should be updated if already read');

    const unreadAfter = await notificationService.fetchUnreadCount(testUserId);
    assert.strictEqual(unreadAfter, 6, 'Unread count must stay unchanged at 6');
    console.log('  ✔ Idempotent execution does not re-write or change unread count');
  }

  // ==========================================================================
  // SCENARIO 3: Workspace A #dev view marks only #dev
  // ==========================================================================
  console.log('\n▶ [SCENARIO 3] Workspace A #dev marks only #dev');
  {
    const updated = await notificationService.markNotificationsAsReadByContext(testUserId, {
      workspaceId: workspaceA,
      channelId: 'dev',
    });
    assert.strictEqual(updated.length, 1, 'Must mark exactly 1 notification from Workspace A #dev');

    const unread = await notificationService.fetchUnreadCount(testUserId);
    assert.strictEqual(unread, 5, 'Unread count must be 5');
    console.log('  ✔ Workspace A #dev marked read without touching other channels');
  }

  // ==========================================================================
  // SCENARIO 4: Community Channel Thread-Specific Context
  // ==========================================================================
  console.log('\n▶ [SCENARIO 4] Community Channel Thread-Specific Marking');
  {
    const updated = await notificationService.markNotificationsAsReadByContext(testUserId, {
      workspaceId: 'community',
      threadId: 'thread_react19',
      isCommunity: true,
    });
    assert.strictEqual(updated.length, 1, 'Must mark exactly 1 notification for thread_react19');

    const allNotifs = await notificationService.fetchNotifications(testUserId, { limit: 20 });
    const notifMap = new Map(allNotifs.map((n) => [n.notificationId, n]));

    const react19Notif = allNotifs.find((n) => n.secondaryEntityId === 'thread_react19');
    const aiArchNotif = allNotifs.find((n) => n.secondaryEntityId === 'thread_ai_arch');

    assert.strictEqual(react19Notif.read, true, 'thread_react19 notification must be read');
    assert.strictEqual(aiArchNotif.read, false, 'thread_ai_arch notification must remain unread');

    const unread = await notificationService.fetchUnreadCount(testUserId);
    assert.strictEqual(unread, 4, 'Unread count must be 4');
    console.log('  ✔ Community thread-specific read marking verified');
  }

  // ==========================================================================
  // SCENARIO 5: Workspace B View does NOT clear Workspace A or Community
  // ==========================================================================
  console.log('\n▶ [SCENARIO 5] Workspace B isolation from Workspace A and Community');
  {
    const updated = await notificationService.markNotificationsAsReadByContext(testUserId, {
      workspaceId: workspaceB,
      channelId: 'general',
    });
    assert.strictEqual(updated.length, 1, 'Must mark Workspace B #general read');

    const allNotifs = await notificationService.fetchNotifications(testUserId, { limit: 20 });
    const aiArchNotif = allNotifs.find((n) => n.secondaryEntityId === 'thread_ai_arch');
    const bpNotif = allNotifs.find((n) => n.type === NOTIFICATION_TYPES.BLUEPRINT_COMPLETED);

    assert.strictEqual(aiArchNotif.read, false, 'Community notification remains unread');
    assert.strictEqual(bpNotif.read, false, 'Workspace A blueprint notification remains unread');

    const unread = await notificationService.fetchUnreadCount(testUserId);
    assert.strictEqual(unread, 3, 'Unread count must be 3 (Community ai_arch, Blueprint, Task)');
    console.log('  ✔ Workspace B isolation confirmed');
  }

  // ==========================================================================
  // SCENARIO 6: Mark All Notifications Read globally
  // ==========================================================================
  console.log('\n▶ [SCENARIO 6] Mark All Read global behavior preserved');
  {
    const markedCount = await notificationService.markAllNotificationsAsRead(testUserId);
    assert.strictEqual(markedCount, 3, 'Must mark remaining 3 notifications read');

    const finalUnread = await notificationService.fetchUnreadCount(testUserId);
    assert.strictEqual(finalUnread, 0, 'Final unread count must be 0');
    console.log('  ✔ Mark All Read functions globally without regression');
  }

  // Clean up test user notifications
  await rtdbService.setData(`user_notifications/${testUserId}`, null);
  console.log('\n🧹 Cleaned up test data.');
  console.log('🎉 ALL CONTEXT-AWARE NOTIFICATION READ TESTS PASSED!');
  process.exit(0);
}

runContextReadTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
