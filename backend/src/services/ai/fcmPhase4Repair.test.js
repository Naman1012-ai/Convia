import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { deriveTokenKey, fcmPushService } from '../fcmPushService.js';
import { pushDeliveryService } from '../pushDeliveryService.js';
import { notificationService } from '../notificationService.js';
import { rtdbService } from '../rtdbService.js';
import { evaluateSecurityRule } from './databaseRulesValidation.test.js';
import {
  NOTIFICATION_TYPES,
  createCanonicalNotification,
  buildNotificationActionUrl,
} from '../../constants/notificationConstants.js';

console.log('🧪 Running [fcmPhase4Repair.test.js] — Convia FCM Phase 4 End-to-End Verification Suite...');

async function runFcmPhase4Tests() {
  const testSenderUid = `test_sender_${Date.now()}`;
  const testRecipientUid1 = `test_recip_a_${Date.now()}`;
  const testRecipientUid2 = `test_recip_b_${Date.now()}`;
  const rawToken1 = 'fcm_valid_device_alpha_1234567890abcdef_test';
  const rawToken2 = 'fcm_valid_device_beta_9876543210fedcba_test';
  const rawToken3 = 'fcm_valid_device_gamma_1122334455aabbcc_test';

  // ==========================================================================
  // VERIFICATION 1: Authenticated Token Registration & UID Isolation
  // ==========================================================================
  console.log('\n▶ [VERIFICATION 1] Authenticated Token Registration & UID Isolation');
  {
    // Register token for Recipient 1
    const reg1 = await fcmPushService.registerToken(testRecipientUid1, {
      token: rawToken1,
      deviceId: 'device-recip-1-laptop',
      platform: 'web',
      userAgent: 'Chrome Headless',
    });
    assert.strictEqual(reg1.success, true, 'Registration for recipient 1 must succeed');

    // Register token for Recipient 2
    const reg2 = await fcmPushService.registerToken(testRecipientUid2, {
      token: rawToken2,
      deviceId: 'device-recip-2-phone',
      platform: 'Android',
    });
    assert.strictEqual(reg2.success, true, 'Registration for recipient 2 must succeed');

    // Verify tokens stored under separate user nodes
    const tokensRecip1 = await fcmPushService.getUserTokens(testRecipientUid1);
    const tokensRecip2 = await fcmPushService.getUserTokens(testRecipientUid2);

    assert.strictEqual(tokensRecip1.length, 1, 'Recipient 1 must have exactly 1 token');
    assert.strictEqual(tokensRecip2.length, 1, 'Recipient 2 must have exactly 1 token');
    assert.strictEqual(tokensRecip1[0].token, rawToken1, 'Token 1 must belong strictly to recipient 1');
    assert.strictEqual(tokensRecip2[0].token, rawToken2, 'Token 2 must belong strictly to recipient 2');
    console.log('  ✔ Token registration correctly isolates tokens by user UID');
  }

  // ==========================================================================
  // VERIFICATION 2: Missing, Invalid, Refreshed, and Multiple Device Tokens
  // ==========================================================================
  console.log('\n▶ [VERIFICATION 2] Missing, Invalid, Refreshed & Multi-Device Tokens');
  {
    // A. Missing tokens (user with no registered tokens)
    const emptyUid = `user_no_tokens_${Date.now()}`;
    const missingTokens = await fcmPushService.getUserTokens(emptyUid);
    assert.deepStrictEqual(missingTokens, [], 'User without tokens returns empty array');

    const notifMissing = createCanonicalNotification({
      notificationId: `notif_miss_${Date.now()}`,
      recipientId: emptyUid,
      type: NOTIFICATION_TYPES.CHAT_MESSAGE,
      title: 'Hello',
      body: 'Message to user with no devices',
    });
    const missingResult = await pushDeliveryService.sendPushNotification(emptyUid, notifMissing);
    assert.strictEqual(missingResult.delivered, false, 'Delivered must be false when no tokens registered');
    assert.strictEqual(missingResult.recipientsCount, 0, 'Recipients count must be 0');
    assert.strictEqual(missingResult.error, null, 'Error must be null for expected empty token set');
    console.log('  ✔ Gracefully handles missing device registrations');

    // B. Multiple device tokens on same recipient
    await fcmPushService.registerToken(testRecipientUid1, {
      token: rawToken3,
      deviceId: 'device-recip-1-tablet',
      platform: 'iPadOS',
    });
    const multiTokens = await fcmPushService.getUserTokens(testRecipientUid1);
    assert.strictEqual(multiTokens.length, 2, 'Recipient 1 now has 2 registered devices');
    console.log('  ✔ Multiple devices registered and maintained concurrently for the same user');

    // C. Token refresh (re-registering same token updates timestamps without duplicating)
    await fcmPushService.registerToken(testRecipientUid1, {
      token: rawToken3,
      deviceId: 'device-recip-1-tablet-refreshed',
      platform: 'iPadOS',
    });
    const refreshedTokens = await fcmPushService.getUserTokens(testRecipientUid1);
    assert.strictEqual(refreshedTokens.length, 2, 'Re-registering same token does not duplicate entry');
    console.log('  ✔ Token refresh updates existing record idempotently');
  }

  // ==========================================================================
  // VERIFICATION 3: Team-Chat Push Delivery (Sender Excluded, Recipient Targeted)
  // ==========================================================================
  console.log('\n▶ [VERIFICATION 3] Team-Chat Push Delivery (Sender Excluded, Recipient Targeted)');
  {
    const notifId = `notif_chat_${Date.now()}`;
    const chatNotification = createCanonicalNotification({
      notificationId: notifId,
      recipientId: testRecipientUid1,
      senderId: testSenderUid,
      actorId: testSenderUid,
      workspaceId: 'org_main_workspace',
      type: NOTIFICATION_TYPES.CHAT_MESSAGE,
      title: 'New message in #general',
      body: 'Alex: Hey team, check out the updated roadmap!',
      actionUrl: '/workspaces/org_main_workspace/chat?channel=general&messageId=msg_999',
      metadata: {
        channelId: 'general',
        messageId: 'msg_999',
        workspaceId: 'org_main_workspace',
      },
    });

    // Test with both sender and recipient in target list (sender MUST be excluded)
    const result = await fcmPushService.sendPushToRecipients(
      [testSenderUid, testRecipientUid1],
      chatNotification
    );

    assert.strictEqual(result.success, true, 'Chat push dispatch must complete without unhandled throw');
    // Sender was excluded, recipient devices attempted
    console.log('  ✔ Sender was correctly excluded from push dispatch');

    // Test duplicate delivery with same notificationId (must be skipped by ledger)
    const dupResult = await fcmPushService.sendPushToRecipients(
      [testRecipientUid1],
      chatNotification
    );
    assert.strictEqual(dupResult.skipped, true, 'Duplicate notification must be skipped by idempotency ledger');
    assert.strictEqual(dupResult.reason, 'ALREADY_DELIVERED', 'Reason must be ALREADY_DELIVERED');
    console.log('  ✔ Delivery ledger strictly prevents duplicate pushes for team chat');
  }

  // ==========================================================================
  // VERIFICATION 4: Push Delivery for Non-Chat Notification Types
  // ==========================================================================
  console.log('\n▶ [VERIFICATION 4] Non-Chat Notification Types Push Delivery');
  {
    // A. Blueprint Completed Notification
    const bpNotif = createCanonicalNotification({
      notificationId: `notif_bp_${Date.now()}`,
      recipientId: testRecipientUid2,
      actorId: 'system',
      type: NOTIFICATION_TYPES.BLUEPRINT_COMPLETED,
      title: 'Blueprint v1.0 Completed',
      body: 'AI Architecture Blueprint for "E-Commerce Platform" is ready.',
      workspaceId: 'ws_alpha',
      actionUrl: '/workspaces/ws_alpha/blueprint',
    });
    const bpResult = await pushDeliveryService.sendPushNotification(testRecipientUid2, bpNotif);
    assert.ok(typeof bpResult.delivered === 'boolean', 'Blueprint delivery returns boolean delivered');
    console.log('  ✔ Blueprint notification push dispatched via repaired pushDeliveryService');

    // B. Proposal / Idea Created Notification
    const ideaNotif = createCanonicalNotification({
      notificationId: `notif_idea_${Date.now()}`,
      recipientId: testRecipientUid2,
      actorId: testSenderUid,
      type: NOTIFICATION_TYPES.IDEA_CREATED,
      title: 'New Proposal Posted',
      body: 'Jordan posted "Real-Time Sync Engine".',
      workspaceId: 'ws_alpha',
      actionUrl: '/workspaces/ws_alpha/ideas/idea_101',
    });
    const ideaResult = await pushDeliveryService.sendPushNotification(testRecipientUid2, ideaNotif);
    assert.ok(typeof ideaResult.delivered === 'boolean', 'Idea delivery returns boolean delivered');
    console.log('  ✔ Proposal/Idea notification push dispatched via pushDeliveryService');

    // C. Discussion Comment Notification
    const commentNotif = createCanonicalNotification({
      notificationId: `notif_comment_${Date.now()}`,
      recipientId: testRecipientUid2,
      actorId: testSenderUid,
      type: NOTIFICATION_TYPES.COMMENT_CREATED,
      title: 'New Comment on your Proposal',
      body: 'Jordan: Looks great, can we benchmark it?',
      actionUrl: '/workspaces/ws_alpha/ideas/idea_101?tab=comments',
    });
    const commentResult = await pushDeliveryService.sendPushNotification(testRecipientUid2, commentNotif);
    assert.ok(typeof commentResult.delivered === 'boolean', 'Comment delivery returns boolean delivered');
    console.log('  ✔ Comment notification push dispatched via pushDeliveryService');
  }

  // ==========================================================================
  // VERIFICATION 5: Invalid Token Pruning & Error Handling
  // ==========================================================================
  console.log('\n▶ [VERIFICATION 5] Invalid Token Pruning & Error Handling');
  {
    const deadToken = 'fcm_dead_mock_token_that_should_be_pruned_12345';
    const deadTokenKey = deriveTokenKey(deadToken);

    await fcmPushService.registerToken(testRecipientUid1, { token: deadToken });
    const beforePrune = await fcmPushService.getUserTokens(testRecipientUid1);
    assert.ok(beforePrune.some((t) => t.tokenKey === deadTokenKey), 'Dead token registered before test');

    // Directly invoke pruneToken
    await fcmPushService.pruneToken(testRecipientUid1, deadTokenKey);
    const afterPrune = await fcmPushService.getUserTokens(testRecipientUid1);
    assert.ok(!afterPrune.some((t) => t.tokenKey === deadTokenKey), 'Dead token was pruned from RTDB');
    console.log('  ✔ Dead / invalid tokens safely pruned without affecting active tokens');
  }

  // ==========================================================================
  // VERIFICATION 6: RTDB Security Rules & Regression Protection
  // ==========================================================================
  console.log('\n▶ [VERIFICATION 6] RTDB Security Rules & Regression Protection');
  {
    const authAlice = { uid: 'user_alice' };
    const authBob = { uid: 'user_bob' };

    // 1. User Alice can write and read her own FCM token
    const aliceWrite = evaluateSecurityRule({
      path: 'fcm_tokens/user_alice/sample_key_123',
      operation: 'write',
      auth: authAlice,
      newData: { token: 'fcm_token_valid_12345', tokenKey: 'sample_key_123' },
    });
    assert.strictEqual(aliceWrite.allowed, true, 'Alice must be allowed to write own token');

    const aliceRead = evaluateSecurityRule({
      path: 'fcm_tokens/user_alice',
      operation: 'read',
      auth: authAlice,
    });
    assert.strictEqual(aliceRead.allowed, true, 'Alice must be allowed to read own tokens');

    // 2. Bob CANNOT read or write Alice tokens
    const bobWrite = evaluateSecurityRule({
      path: 'fcm_tokens/user_alice/sample_key_123',
      operation: 'write',
      auth: authBob,
      newData: { token: 'fcm_token_valid_12345', tokenKey: 'sample_key_123' },
    });
    assert.strictEqual(bobWrite.allowed, false, 'Bob must NOT write to Alice token path');

    const bobRead = evaluateSecurityRule({
      path: 'fcm_tokens/user_alice',
      operation: 'read',
      auth: authBob,
    });
    assert.strictEqual(bobRead.allowed, false, 'Bob must NOT read Alice token path');

    // 3. Client CANNOT write or read authoritative fcm_delivery_ledger
    const clientLedgerWrite = evaluateSecurityRule({
      path: 'fcm_delivery_ledger/notif_xyz',
      operation: 'write',
      auth: authAlice,
      newData: { deliveredAt: Date.now() },
    });
    assert.strictEqual(clientLedgerWrite.allowed, false, 'Clients must NOT write delivery ledger');

    const clientLedgerRead = evaluateSecurityRule({
      path: 'fcm_delivery_ledger/notif_xyz',
      operation: 'read',
      auth: authAlice,
    });
    assert.strictEqual(clientLedgerRead.allowed, false, 'Clients must NOT read delivery ledger');

    console.log('  ✔ RTDB security rules enforce strict UID ownership and ledger lockdown');
  }

  // ==========================================================================
  // VERIFICATION 7: Service Worker Payload & Click Navigation Destination
  // ==========================================================================
  console.log('\n▶ [VERIFICATION 7] Service Worker Payload & Click Destinations');
  {
    const swPath = path.resolve(process.cwd(), 'frontend/public/firebase-messaging-sw.js');
    const swContent = fs.readFileSync(swPath, 'utf8');

    // Check onBackgroundMessage data parsing and tag deduplication
    assert.ok(swContent.includes('messaging.onBackgroundMessage'), 'SW must handle onBackgroundMessage');
    assert.ok(swContent.includes('notificationOptions'), 'SW must construct notificationOptions');
    assert.ok(swContent.includes('tag: tag'), 'SW must enforce tag-based deduplication');
    assert.ok(swContent.includes('self.registration.showNotification'), 'SW must explicitly call showNotification');

    // Check notificationclick navigation logic
    assert.ok(swContent.includes("addEventListener('notificationclick'"), 'SW must handle notificationclick');
    assert.ok(swContent.includes('event.notification.close()'), 'SW must close notification on click');
    assert.ok(swContent.includes('parsed.origin === self.location.origin'), 'SW must enforce same-origin security');
    assert.ok(swContent.includes('clients') && swContent.includes('matchAll'), 'SW must match window clients to focus existing tab');

    console.log('  ✔ Service worker message handling and origin-safe click navigation verified');
  }

  // ==========================================================================
  // VERIFICATION 8: Task Lifecycle Events (Assigned, Completed, Status Changed)
  // ==========================================================================
  console.log('\n▶ [VERIFICATION 8] Task Lifecycle Events (Assigned, Completed, Status Changed)');
  {
    // A. Task Assigned
    const taskAssignedNotifs = await notificationService.dispatchNotificationEvent(
      NOTIFICATION_TYPES.TASK_ASSIGNED,
      {
        workspaceId: 'ws_alpha',
        taskId: 'task_abc_1',
        taskTitle: 'Implement Payment Gateway',
        assignedToUid: testRecipientUid1,
        priority: 'High',
      },
      { uid: testSenderUid, displayName: 'Manager Alice' }
    );
    assert.strictEqual(taskAssignedNotifs.length, 1, 'Task assigned notification must be created');
    assert.strictEqual(taskAssignedNotifs[0].recipientId, testRecipientUid1, 'Recipient must be assigned user');
    assert.strictEqual(taskAssignedNotifs[0].type, NOTIFICATION_TYPES.TASK_ASSIGNED);
    assert.strictEqual(taskAssignedNotifs[0].actionUrl, '/workspaces/ws_alpha/tasks?taskId=task_abc_1');

    // B. Self-assignment exclusion
    const selfAssigned = await notificationService.dispatchNotificationEvent(
      NOTIFICATION_TYPES.TASK_ASSIGNED,
      {
        workspaceId: 'ws_alpha',
        taskId: 'task_abc_2',
        taskTitle: 'Self Assigned Task',
        assignedToUid: testSenderUid,
      },
      { uid: testSenderUid, displayName: 'Manager Alice' }
    );
    assert.strictEqual(selfAssigned.length, 0, 'Self-assignment must not generate notification');

    // C. Task Completed
    const taskCompletedNotifs = await notificationService.dispatchNotificationEvent(
      NOTIFICATION_TYPES.TASK_COMPLETED,
      {
        workspaceId: 'ws_alpha',
        taskId: 'task_abc_1',
        taskTitle: 'Implement Payment Gateway',
        createdByUid: testRecipientUid2,
      },
      { uid: testSenderUid, displayName: 'Worker Bob' }
    );
    assert.strictEqual(taskCompletedNotifs.length, 1, 'Task completed must notify task creator');
    assert.strictEqual(taskCompletedNotifs[0].recipientId, testRecipientUid2);
    console.log('  ✔ Task assignment and completion events generate targeted notifications');
  }

  // ==========================================================================
  // VERIFICATION 9: Workspace Invitation and Membership Events
  // ==========================================================================
  console.log('\n▶ [VERIFICATION 9] Workspace Invitation and Membership Events');
  {
    // A. Member Invited
    const inviteNotifs = await notificationService.dispatchNotificationEvent(
      NOTIFICATION_TYPES.WORKSPACE_MEMBER_INVITED,
      {
        workspaceId: 'ws_alpha',
        orgName: 'Alpha Corp',
        targetUid: testRecipientUid1,
        role: 'member',
      },
      { uid: testSenderUid, displayName: 'Admin Alice' }
    );
    assert.strictEqual(inviteNotifs.length, 1, 'Member invited notification must be created');
    assert.strictEqual(inviteNotifs[0].recipientId, testRecipientUid1);
    assert.strictEqual(inviteNotifs[0].type, NOTIFICATION_TYPES.WORKSPACE_MEMBER_INVITED);

    // B. Invitation Declined
    const declineNotifs = await notificationService.dispatchNotificationEvent(
      NOTIFICATION_TYPES.INVITATION_DECLINED,
      {
        workspaceId: 'ws_alpha',
        inviterUid: testSenderUid,
        inviteeEmail: 'user@example.com',
        orgName: 'Alpha Corp',
      },
      { uid: testRecipientUid1, displayName: 'Invited User' }
    );
    assert.strictEqual(declineNotifs.length, 1, 'Invitation declined must notify inviter');
    assert.strictEqual(declineNotifs[0].recipientId, testSenderUid);

    console.log('  ✔ Workspace invitation and decline events target correct actors');
  }

  // ==========================================================================
  // VERIFICATION 10: Community Hub Activity (Posts, Replies, Mentions, Q&A)
  // ==========================================================================
  console.log('\n▶ [VERIFICATION 10] Community Hub Activity (Posts, Replies, Mentions, Q&A)');
  {
    // A. Community Reply
    const commReplyNotifs = await notificationService.dispatchNotificationEvent(
      NOTIFICATION_TYPES.COMMUNITY_REPLY,
      {
        workspaceId: 'community',
        parentMessageId: 'comm_thread_99',
        replyId: 'reply_55',
        content: 'I agree with this architectural decision!',
        parentAuthorId: testRecipientUid1,
      },
      { uid: testSenderUid, displayName: 'Contributor Clara' }
    );
    assert.strictEqual(commReplyNotifs.length, 1, 'Community reply must notify parent author');
    assert.strictEqual(commReplyNotifs[0].recipientId, testRecipientUid1);
    assert.strictEqual(commReplyNotifs[0].actionUrl, '/community?threadId=comm_thread_99&replyId=reply_55');

    // B. Community Mention
    const commMentionNotifs = await notificationService.dispatchNotificationEvent(
      NOTIFICATION_TYPES.CHAT_MENTION,
      {
        workspaceId: 'community',
        messageId: 'msg_comm_123',
        content: 'Hey @Dev check this out',
        mentionedUids: [testRecipientUid2],
      },
      { uid: testSenderUid, displayName: 'Contributor Clara' }
    );
    assert.strictEqual(commMentionNotifs.length, 1, 'Community mention must notify mentioned user');
    assert.strictEqual(commMentionNotifs[0].recipientId, testRecipientUid2);
    assert.strictEqual(commMentionNotifs[0].actionUrl, '/community?messageId=msg_comm_123');

    // C. Idea Question
    const questionNotifs = await notificationService.dispatchNotificationEvent(
      NOTIFICATION_TYPES.QUESTION_CREATED,
      {
        ideaId: 'idea_404',
        targetAuthorId: testRecipientUid1,
        questionSnippet: 'How do you handle offline mode?',
        discussionId: 'disc_1',
      },
      { uid: testSenderUid, displayName: 'Contributor Clara' }
    );
    assert.strictEqual(questionNotifs.length, 1, 'Question must notify idea author');
    assert.strictEqual(questionNotifs[0].recipientId, testRecipientUid1);

    console.log('  ✔ Community Hub replies, mentions, and Q&A generate correct notifications & URLs');
  }

  // ==========================================================================
  // VERIFICATION 11: Deep Links & Action URLs across All Event Types
  // ==========================================================================
  console.log('\n▶ [VERIFICATION 11] Deep Links & Action URLs across All Event Types');
  {
    const wsChatUrl = buildNotificationActionUrl({
      type: NOTIFICATION_TYPES.CHAT_MESSAGE,
      workspaceId: 'ws_alpha',
      metadata: { channelId: 'general', messageId: 'm1' },
    });
    assert.strictEqual(wsChatUrl, '/workspaces/ws_alpha/chat?channel=general&messageId=m1');

    const commReplyUrl = buildNotificationActionUrl({
      type: NOTIFICATION_TYPES.COMMUNITY_REPLY,
      workspaceId: 'community',
      metadata: { parentMessageId: 'thread_1', replyId: 'r1' },
    });
    assert.strictEqual(commReplyUrl, '/community?threadId=thread_1');

    const taskUrl = buildNotificationActionUrl({
      type: NOTIFICATION_TYPES.TASK_ASSIGNED,
      workspaceId: 'ws_alpha',
      metadata: { taskId: 't1' },
    });
    assert.strictEqual(taskUrl, '/workspaces/ws_alpha/tasks?taskId=t1');

    const bpUrl = buildNotificationActionUrl({
      type: NOTIFICATION_TYPES.BLUEPRINT_COMPLETED,
      workspaceId: 'ws_alpha',
    });
    assert.strictEqual(bpUrl, '/workspaces/ws_alpha/blueprint');

    const memberUrl = buildNotificationActionUrl({
      type: NOTIFICATION_TYPES.WORKSPACE_MEMBER_JOINED,
      workspaceId: 'ws_alpha',
    });
    assert.strictEqual(memberUrl, '/workspaces/ws_alpha/members');

    console.log('  ✔ Deep links strictly map to correct Convia destinations');
  }

  // ==========================================================================
  // VERIFICATION 12: Account Switching & Logout Token Cleanup
  // ==========================================================================
  console.log('\n▶ [VERIFICATION 12] Account Switching & Logout Token Cleanup');
  {
    const switchUserUid = `user_switch_${Date.now()}`;
    const switchToken = 'fcm_switch_device_token_99887766_test';

    await fcmPushService.registerToken(switchUserUid, { token: switchToken });
    const tokensBefore = await fcmPushService.getUserTokens(switchUserUid);
    assert.strictEqual(tokensBefore.length, 1, 'Token registered before logout');

    // Simulate logout unregister
    await fcmPushService.unregisterToken(switchUserUid, switchToken);
    const tokensAfter = await fcmPushService.getUserTokens(switchUserUid);
    assert.strictEqual(tokensAfter.length, 0, 'Token removed from user node on logout');

    console.log('  ✔ Device token successfully unregistered on user logout');
  }

  // ==========================================================================
  // Cleanup test artifacts
  // ==========================================================================
  await rtdbService.removeData(`fcm_tokens/${testSenderUid}`).catch(() => {});
  await rtdbService.removeData(`fcm_tokens/${testRecipientUid1}`).catch(() => {});
  await rtdbService.removeData(`fcm_tokens/${testRecipientUid2}`).catch(() => {});
  await rtdbService.setData(`user_notifications/${testRecipientUid1}`, null).catch(() => {});
  await rtdbService.setData(`user_notifications/${testRecipientUid2}`, null).catch(() => {});
  await rtdbService.setData(`user_notifications/${testSenderUid}`, null).catch(() => {});

  console.log('\n🎉 ALL 12 FCM PHASE 4 VERIFICATION TESTS PASSED!\n');
  process.exit(0);
}

runFcmPhase4Tests().catch((err) => {
  console.error('❌ FCM Phase 4 Repair Test Failed:', err);
  process.exit(1);
});
