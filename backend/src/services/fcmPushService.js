import crypto from 'crypto';
import { getFirebaseAdminApp, rtdbService } from './rtdbService.js';
import { getMessaging } from 'firebase-admin/messaging';

/**
 * Convia FCM Phase 2: Server-Side Push Notification & Token Management Service.
 *
 * Responsibilities:
 * - Secure registration and unregistration of browser FCM tokens in RTDB (`fcm_tokens/{uid}/{tokenKey}`).
 * - Multi-device support per user.
 * - Server-side push delivery via Firebase Admin SDK Messaging (`sendEachForMulticast`).
 * - Automatic pruning of invalid/expired FCM tokens.
 * - Idempotent delivery using an RTDB delivery ledger (`fcm_delivery_ledger/{notificationId}`).
 * - Defensive validation and zero leak of secrets or Admin credentials.
 */

/**
 * Derives a safe, sanitized key for RTDB paths from an FCM token string.
 * Firebase RTDB prohibited characters: '.', '$', '#', '[', ']', '/'
 * Using SHA-256 hex digest provides a collision-resistant, 64-char alphanumeric key.
 */
export function deriveTokenKey(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('FCM token must be a non-empty string.');
  }
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

export const fcmPushService = {
  /**
   * Registers or refreshes an FCM device token for an authenticated user.
   *
   * @param {string} uid - Authenticated user UID (from verified Firebase ID token)
   * @param {Object} payload - { token, deviceId, userAgent, platform }
   * @returns {Promise<{ success: boolean, tokenKey: string }>}
   */
  registerToken: async (uid, { token, deviceId, userAgent, platform } = {}) => {
    if (!uid || typeof uid !== 'string') {
      throw new Error('User UID is required for token registration.');
    }
    if (!token || typeof token !== 'string' || token.trim().length < 10) {
      throw new Error('A valid FCM registration token string is required.');
    }

    const cleanToken = token.trim();
    const tokenKey = deriveTokenKey(cleanToken);
    const now = Date.now();

    const tokenPath = `fcm_tokens/${uid}/${tokenKey}`;
    const existing = await rtdbService.getData(tokenPath);

    const record = {
      token: cleanToken,
      tokenKey,
      deviceId: deviceId || existing?.deviceId || 'web-browser',
      userAgent: userAgent || existing?.userAgent || 'unknown',
      platform: platform || existing?.platform || 'web',
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      lastSeenAt: now,
    };

    await rtdbService.setData(tokenPath, record);
    console.log(`✅ [fcmPushService] Registered token for user ${uid} (key: ${tokenKey.slice(0, 12)}...)`);

    return { success: true, tokenKey };
  },

  /**
   * Unregisters a specific FCM device token for an authenticated user.
   *
   * @param {string} uid - Authenticated user UID
   * @param {string} token - The FCM token to unregister
   * @returns {Promise<{ success: boolean }>}
   */
  unregisterToken: async (uid, token) => {
    if (!uid || !token) {
      throw new Error('Both UID and token are required to unregister.');
    }

    const tokenKey = deriveTokenKey(token);
    const tokenPath = `fcm_tokens/${uid}/${tokenKey}`;

    await rtdbService.removeData(tokenPath);
    console.log(`✅ [fcmPushService] Unregistered token for user ${uid} (key: ${tokenKey.slice(0, 12)}...)`);

    return { success: true };
  },

  /**
   * Retrieves all active FCM registration tokens for a given user.
   *
   * @param {string} uid - User UID
   * @returns {Promise<Array<{ token: string, tokenKey: string }>>}
   */
  getUserTokens: async (uid) => {
    if (!uid) return [];
    try {
      const tokensMap = await rtdbService.getData(`fcm_tokens/${uid}`);
      if (!tokensMap || typeof tokensMap !== 'object') return [];

      return Object.entries(tokensMap)
        .filter(([_, item]) => item && typeof item.token === 'string')
        .map(([tokenKey, item]) => ({
          token: item.token,
          tokenKey: item.tokenKey || tokenKey,
        }));
    } catch (err) {
      console.warn(`[fcmPushService] Error retrieving tokens for user ${uid}:`, err.message);
      return [];
    }
  },

  /**
   * Prunes invalid or unregistered tokens for a user.
   *
   * @param {string} uid - User UID
   * @param {string} tokenKey - Key of the invalid token to remove
   */
  pruneToken: async (uid, tokenKey) => {
    try {
      if (uid && tokenKey) {
        await rtdbService.removeData(`fcm_tokens/${uid}/${tokenKey}`);
        console.log(`🧹 [fcmPushService] Pruned dead FCM token for user ${uid}: ${tokenKey.slice(0, 12)}...`);
      }
    } catch (err) {
      console.warn('[fcmPushService] Token prune error:', err.message);
    }
  },

  /**
   * Dispatches push notifications to one or more recipient users using Firebase Admin SDK.
   *
   * @param {Array<string>} recipientUids - Array of recipient user UIDs
   * @param {Object} notification - Canonical notification object
   * @returns {Promise<{ success: boolean, delivered: number, skipped?: boolean, reason?: string }>}
   */
  sendPushToRecipients: async (recipientUids = [], notification = {}) => {
    const validUids = Array.from(new Set((recipientUids || []).filter(Boolean)));
    const notifId = notification.notificationId || notification.id;
    const notifType = notification.type || 'UNKNOWN';

    console.log(`📨 [fcmPushService] Push request received: type=${notifType}, notifId=${notifId || 'NONE'}, recipientCount=${validUids.length}`);

    if (validUids.length === 0) {
      console.log(`📨 [fcmPushService] No recipients for ${notifId}. Skipping.`);
      return { success: true, delivered: 0, reason: 'NO_RECIPIENTS' };
    }

    if (!notifId) {
      console.warn('[fcmPushService] Notification missing ID. Skipping push.');
      return { success: false, delivered: 0, reason: 'MISSING_NOTIFICATION_ID' };
    }

    // 1. Idempotency Check: Prevent duplicate push deliveries
    const ledgerPath = `fcm_delivery_ledger/${notifId}`;
    const existingLedger = await rtdbService.getData(ledgerPath);
    if (existingLedger && existingLedger.deliveredAt) {
      console.log(`[fcmPushService] Push for ${notifId} already processed. Skipping duplicate.`);
      return { success: true, delivered: 0, skipped: true, reason: 'ALREADY_DELIVERED' };
    }

    // 2. Resolve active tokens for all recipients
    const tokenEntries = []; // Array of { token, tokenKey, uid }
    const actorId = notification.actorId || notification.senderId;
    for (const uid of validUids) {
      // Exclude self-notifications if actorId matches recipient
      if (actorId && actorId === uid && !notification.allowSelfNotification) {
        console.log(`📨 [fcmPushService] Excluding self-notification for actor ${uid.slice(0, 8)}...`);
        continue;
      }

      const userTokens = await fcmPushService.getUserTokens(uid);
      console.log(`📨 [fcmPushService] Recipient ${uid.slice(0, 8)}... has ${userTokens.length} registered device(s)`);
      userTokens.forEach((t) => tokenEntries.push({ ...t, uid }));
    }

    if (tokenEntries.length === 0) {
      console.log(`📨 [fcmPushService] No active tokens found for ${validUids.length} recipient(s). Push skipped.`);
      // Record ledger entry even if no tokens found so we don't re-query on retries
      await rtdbService.setData(ledgerPath, {
        deliveredAt: Date.now(),
        notificationId: notifId,
        tokenCount: 0,
        successCount: 0,
        reason: 'NO_ACTIVE_TOKENS',
      });
      return { success: true, delivered: 0, reason: 'NO_ACTIVE_TOKENS' };
    }

    // Deduplicate tokens
    const uniqueTokenMap = new Map();
    tokenEntries.forEach((entry) => {
      if (!uniqueTokenMap.has(entry.token)) {
        uniqueTokenMap.set(entry.token, entry);
      }
    });

    const uniqueTokens = Array.from(uniqueTokenMap.keys());

    // 3. Obtain Firebase Admin Messaging instance
    const adminApp = getFirebaseAdminApp();
    if (!adminApp) {
      console.warn('[fcmPushService] Firebase Admin App not initialized. Cannot send push.');
      return { success: false, delivered: 0, reason: 'ADMIN_APP_UNAVAILABLE' };
    }

    let messaging;
    try {
      messaging = getMessaging(adminApp);
    } catch (err) {
      console.warn('[fcmPushService] Failed to obtain Messaging instance:', err.message);
      return { success: false, delivered: 0, reason: 'MESSAGING_INIT_FAILED' };
    }

    // 4. Construct FCM Notification Payload
    const title = notification.title || 'Convia Notification';
    const body = notification.body || notification.message || notification.previewText || 'You have a new update in Convia.';
    // Canonical notification uses 'actionUrl', not 'link' or 'url'
    const targetUrl = notification.actionUrl || notification.link || notification.url || '/';

    const messagePayload = {
      tokens: uniqueTokens,
      data: {
        notificationId: String(notifId),
        type: String(notification.type || 'GENERAL'),
        title: String(title),
        body: String(body),
        url: String(targetUrl),
        icon: '/convia-logo.png',
        badge: '/favicon.png',
        timestamp: String(notification.createdAt || Date.now()),
      },
      webpush: {
        headers: {
          Urgency: 'high',
        },
        fcmOptions: {
          link: targetUrl,
        },
      },
    };

    // 5. Send multicast message
    try {
      const response = await messaging.sendEachForMulticast(messagePayload);
      console.log(`🚀 [fcmPushService] Multicast push dispatched: ${response.successCount} succeeded, ${response.failureCount} failed out of ${uniqueTokens.length} tokens.`);

      // 6. Handle invalid tokens pruning
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const errorCode = resp.error?.code || '';
            const isUnregistered =
              errorCode === 'messaging/invalid-registration-token' ||
              errorCode === 'messaging/registration-token-not-registered' ||
              errorCode === 'messaging/mismatched-credential';

            if (isUnregistered) {
              const failedToken = uniqueTokens[idx];
              const entry = uniqueTokenMap.get(failedToken);
              if (entry) {
                fcmPushService.pruneToken(entry.uid, entry.tokenKey).catch(() => {});
              }
            }
          }
        });
      }

      // 7. Update Delivery Ledger
      await rtdbService.setData(ledgerPath, {
        deliveredAt: Date.now(),
        notificationId: notifId,
        tokenCount: uniqueTokens.length,
        successCount: response.successCount,
        failureCount: response.failureCount,
      });

      return {
        success: true,
        delivered: response.successCount,
        failed: response.failureCount,
      };
    } catch (sendErr) {
      console.error('[fcmPushService] Multicast send error:', sendErr.message);
      return { success: false, delivered: 0, reason: sendErr.message };
    }
  },
};
