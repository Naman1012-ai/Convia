import assert from 'node:assert/strict';
import { deriveTokenKey, fcmPushService } from '../fcmPushService.js';
import { rtdbService } from '../rtdbService.js';
import fs from 'node:fs';
import path from 'node:path';

console.log('🧪 Running [fcmPhase2EndToEnd.test.js] — Convia FCM Phase 2 Verification Suite...');

async function runFcmPhase2Tests() {
  const testUid = `test_user_${Date.now()}`;
  const testUidB = `test_user_other_${Date.now()}`;
  const rawTokenDevice1 = 'fcm_token_device_chrome_laptop_1234567890abcdef_test';
  const rawTokenDevice2 = 'fcm_token_device_mobile_android_0987654321fedcba_test';

  // --------------------------------------------------------------------------
  // TEST 1: deriveTokenKey Sanitization & Invariants
  // --------------------------------------------------------------------------
  console.log('▶ TEST 1: deriveTokenKey Sanitization & Invariants');
  {
    const key1 = deriveTokenKey(rawTokenDevice1);
    assert.strictEqual(typeof key1, 'string', 'Token key must be a string');
    assert.strictEqual(key1.length, 64, 'SHA-256 token key must be 64 hexadecimal characters');
    assert.match(key1, /^[0-9a-f]{64}$/, 'Token key must only contain hexadecimal characters');

    // Safe for RTDB path: does not contain ., $, #, [, ], or /
    assert.ok(!/[.$#\[\]\/]/.test(key1), 'Token key must not contain RTDB prohibited characters');

    // Throws on empty or non-string input
    assert.throws(() => deriveTokenKey(''), /FCM token must be a non-empty string/);
    assert.throws(() => deriveTokenKey(null), /FCM token must be a non-empty string/);
    console.log('  ✔ deriveTokenKey safely sanitizes tokens for RTDB paths');
  }

  // --------------------------------------------------------------------------
  // TEST 2: Authenticated Token Registration & Multi-Device Handling
  // --------------------------------------------------------------------------
  console.log('▶ TEST 2: Authenticated Token Registration & Multi-Device Handling');
  {
    // Register Device 1
    const reg1 = await fcmPushService.registerToken(testUid, {
      token: rawTokenDevice1,
      deviceId: 'chrome-desktop',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      platform: 'Windows',
    });
    assert.ok(reg1.success, 'Registration for device 1 must succeed');

    // Register Device 2 (same user)
    const reg2 = await fcmPushService.registerToken(testUid, {
      token: rawTokenDevice2,
      deviceId: 'pixel-android',
      userAgent: 'Mozilla/5.0 (Linux; Android 14)',
      platform: 'Android',
    });
    assert.ok(reg2.success, 'Registration for device 2 must succeed');

    // Verify both tokens exist under user's token node
    const tokens = await fcmPushService.getUserTokens(testUid);
    assert.strictEqual(tokens.length, 2, 'User must have exactly 2 active registered device tokens');
    const tokenStrings = tokens.map((t) => t.token);
    assert.ok(tokenStrings.includes(rawTokenDevice1), 'Tokens must include device 1');
    assert.ok(tokenStrings.includes(rawTokenDevice2), 'Tokens must include device 2');
    console.log('  ✔ Multi-device registration stores independent tokens for the same user');
  }

  // --------------------------------------------------------------------------
  // TEST 3: Specific Device Unregistration (Without Affecting Other Devices)
  // --------------------------------------------------------------------------
  console.log('▶ TEST 3: Specific Device Unregistration');
  {
    // Unregister Device 1
    const unregResult = await fcmPushService.unregisterToken(testUid, rawTokenDevice1);
    assert.ok(unregResult.success, 'Unregistering device 1 must succeed');

    // Verify only Device 2 remains
    const remainingTokens = await fcmPushService.getUserTokens(testUid);
    assert.strictEqual(remainingTokens.length, 1, 'Exactly 1 token must remain after unregistering device 1');
    assert.strictEqual(remainingTokens[0].token, rawTokenDevice2, 'Remaining token must be device 2');
    console.log('  ✔ Device unregistration preserves other concurrent device sessions');
  }

  // --------------------------------------------------------------------------
  // TEST 4: Token Isolation & User Boundaries (User A vs User B)
  // --------------------------------------------------------------------------
  console.log('▶ TEST 4: Token Isolation & User Boundaries');
  {
    // Register token for User B
    await fcmPushService.registerToken(testUidB, {
      token: 'token_user_b_private_device_1234567890',
      deviceId: 'user-b-device',
    });

    const userATokens = await fcmPushService.getUserTokens(testUid);
    const userBTokens = await fcmPushService.getUserTokens(testUidB);

    assert.strictEqual(userATokens.length, 1, 'User A has only their own tokens');
    assert.strictEqual(userBTokens.length, 1, 'User B has only their own tokens');
    assert.notStrictEqual(userATokens[0].token, userBTokens[0].token, 'User tokens are completely isolated');
    console.log('  ✔ Token storage enforces strict user isolation boundaries');
  }

  // --------------------------------------------------------------------------
  // TEST 5: Push Delivery Idempotency & Deduplication Ledger
  // --------------------------------------------------------------------------
  console.log('▶ TEST 5: Push Delivery Idempotency & Deduplication Ledger');
  {
    const notifId = `notif_test_${Date.now()}`;
    const notificationPayload = {
      notificationId: notifId,
      title: 'New Idea Proposal',
      message: 'Alex created a new proposal for review.',
      link: '/workspaces/org_123/ideas',
      actorId: 'user_actor_999',
      type: 'IDEA_CREATED',
    };

    // First delivery attempt
    const firstDelivery = await fcmPushService.sendPushToRecipients([testUid], notificationPayload);
    assert.ok(firstDelivery.success, 'First push delivery attempt must process without throwing');

    // Second duplicate delivery attempt with same notificationId
    const secondDelivery = await fcmPushService.sendPushToRecipients([testUid], notificationPayload);
    assert.ok(secondDelivery.success, 'Second push attempt must return success');
    assert.strictEqual(secondDelivery.skipped, true, 'Second push attempt must be skipped due to deduplication');
    assert.strictEqual(secondDelivery.reason, 'ALREADY_DELIVERED', 'Reason must be ALREADY_DELIVERED');
    console.log('  ✔ Deduplication ledger prevents duplicate push delivery for the same notificationId');
  }

  // --------------------------------------------------------------------------
  // TEST 6: Self-Notification Exclusion
  // --------------------------------------------------------------------------
  console.log('▶ TEST 6: Self-Notification Exclusion');
  {
    const notifId = `notif_self_${Date.now()}`;
    const selfNotificationPayload = {
      notificationId: notifId,
      title: 'Self Action',
      message: 'You updated your settings.',
      actorId: testUid, // Actor is the recipient!
      type: 'WORKSPACE_SETTINGS_UPDATED',
      allowSelfNotification: false,
    };

    const result = await fcmPushService.sendPushToRecipients([testUid], selfNotificationPayload);
    assert.ok(result.success, 'Self-notification dispatch should succeed without throwing');
    assert.strictEqual(result.delivered, 0, 'Zero pushes should be delivered when recipient matches actor');
    console.log('  ✔ Actor self-notifications are excluded from push dispatch by default');
  }

  // --------------------------------------------------------------------------
  // TEST 7: Invalid Token Pruning
  // --------------------------------------------------------------------------
  console.log('▶ TEST 7: Invalid Token Pruning');
  {
    const deadToken = 'fcm_dead_invalid_token_test_1234567890';
    const deadTokenKey = deriveTokenKey(deadToken);

    await fcmPushService.registerToken(testUid, { token: deadToken });
    let tokensBefore = await fcmPushService.getUserTokens(testUid);
    assert.ok(tokensBefore.some((t) => t.tokenKey === deadTokenKey), 'Dead token initially registered');

    // Prune invalid token
    await fcmPushService.pruneToken(testUid, deadTokenKey);
    let tokensAfter = await fcmPushService.getUserTokens(testUid);
    assert.ok(!tokensAfter.some((t) => t.tokenKey === deadTokenKey), 'Dead token successfully pruned');
    console.log('  ✔ Invalid tokens are pruned from user token record');
  }

  // --------------------------------------------------------------------------
  // TEST 8: Frontend Service & Route Contract Verification
  // --------------------------------------------------------------------------
  console.log('▶ TEST 8: Frontend Service & Route Contract Verification');
  {
    const rootDir = process.cwd();
    const fcmServicePath = path.resolve(rootDir, 'frontend/src/services/fcmService.js');
    const fcmRoutesPath = path.resolve(rootDir, 'backend/src/routes/fcmRoutes.js');
    const inAppNotifPath = path.resolve(rootDir, 'frontend/src/services/inAppNotificationService.js');
    const authContextPath = path.resolve(rootDir, 'frontend/src/contexts/AuthContext.jsx');

    const fcmServiceContent = fs.readFileSync(fcmServicePath, 'utf8');
    const fcmRoutesContent = fs.readFileSync(fcmRoutesPath, 'utf8');
    const inAppNotifContent = fs.readFileSync(inAppNotifPath, 'utf8');
    const authContextContent = fs.readFileSync(authContextPath, 'utf8');

    // Route checks
    assert.ok(fcmRoutesContent.includes("router.post('/register'") || fcmRoutesContent.includes("fcmRouter.post('/register'"), 'Route /register must exist');
    assert.ok(fcmRoutesContent.includes("router.post('/unregister'") || fcmRoutesContent.includes("fcmRouter.post('/unregister'"), 'Route /unregister must exist');
    assert.ok(fcmRoutesContent.includes("router.post('/send-push'") || fcmRoutesContent.includes("fcmRouter.post('/send-push'"), 'Route /send-push must exist');
    assert.ok(fcmRoutesContent.includes('requireAuth'), 'Routes must be guarded by requireAuth');

    // Frontend service checks
    assert.ok(fcmServiceContent.includes('export async function enableWebPushNotifications'), 'enableWebPushNotifications must be exported');
    assert.ok(fcmServiceContent.includes('export async function disableWebPushNotifications'), 'disableWebPushNotifications must be exported');
    assert.ok(fcmServiceContent.includes('export function setupForegroundMessageHandler'), 'setupForegroundMessageHandler must be exported');
    assert.ok(fcmServiceContent.includes('export async function cleanupFcmOnLogout'), 'cleanupFcmOnLogout must be exported');

    // inAppNotificationService push integration
    assert.ok(inAppNotifContent.includes('/api/notifications/fcm/send-push'), 'inAppNotificationService must dispatch push to backend');

    // AuthContext logout cleanup integration
    assert.ok(authContextContent.includes('cleanupFcmOnLogout'), 'AuthContext must clean up FCM on logout');

    console.log('  ✔ End-to-end route contracts and client integrations verified');
  }

  // --------------------------------------------------------------------------
  // Cleanup test artifacts in RTDB
  // --------------------------------------------------------------------------
  await rtdbService.removeData(`fcm_tokens/${testUid}`).catch(() => {});
  await rtdbService.removeData(`fcm_tokens/${testUidB}`).catch(() => {});

  console.log('\n🎉 ALL FCM PHASE 2 END-TO-END TESTS PASSED!\n');
}

runFcmPhase2Tests().catch((err) => {
  console.error('❌ FCM Phase 2 Test failed:', err);
  process.exit(1);
});
