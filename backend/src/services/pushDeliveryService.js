import { fcmPushService } from './fcmPushService.js';

/**
 * Convia Push Delivery Service Abstraction.
 *
 * Responsibilities:
 * - Bridges persistent database notifications to authoritative FCM push delivery.
 * - Reads real device tokens from canonical RTDB schema: fcm_tokens/{recipientUid}.
 * - Dispatches background push notifications via Firebase Admin SDK multicast.
 * - Enforces idempotency via delivery ledger: fcm_delivery_ledger/{notificationId}.
 * - Guarantees non-blocking execution so push failures never fail database operations.
 * - Accurately reports delivery status (never claims delivered: true without confirmed FCM acceptance).
 */
export const pushDeliveryService = {
  /**
   * Dispatches a push notification to all registered devices for a single recipient.
   *
   * @param {string} recipientUid - Recipient Auth UID
   * @param {Object} notificationRecord - Canonical notification record
   * @returns {Promise<{ delivered: boolean, recipientsCount: number, error: string|null, skipped?: boolean, failedCount?: number }>}
   */
  sendPushNotification: async (recipientUid, notificationRecord) => {
    if (!recipientUid || !notificationRecord) {
      return { delivered: false, recipientsCount: 0, error: 'Missing recipient or notification record' };
    }

    try {
      const cleanUid = String(recipientUid).trim();
      const result = await fcmPushService.sendPushToRecipients([cleanUid], notificationRecord);

      const deliveredCount = typeof result.delivered === 'number' ? result.delivered : 0;
      const isDelivered = deliveredCount > 0;

      return {
        delivered: isDelivered,
        recipientsCount: deliveredCount,
        failedCount: result.failed || 0,
        error: result.success ? null : (result.reason || 'Push delivery failed'),
        skipped: Boolean(result.skipped),
      };
    } catch (err) {
      console.warn(`⚠️ [pushDeliveryService] Push delivery error for ${recipientUid}:`, err.message);
      return { delivered: false, recipientsCount: 0, error: err.message };
    }
  },

  /**
   * Dispatches multicast push notifications to multiple recipients in a single batch.
   *
   * @param {Array<string>} recipientUids - Array of recipient Auth UIDs
   * @param {Object} notificationRecord - Canonical notification record template
   * @returns {Promise<{ delivered: boolean, recipientsCount: number, error: string|null, skipped?: boolean, failedCount?: number }>}
   */
  sendPushNotifications: async (recipientUids = [], notificationRecord = {}) => {
    if (!Array.isArray(recipientUids) || recipientUids.length === 0 || !notificationRecord) {
      return { delivered: false, recipientsCount: 0, error: 'Missing recipients or notification record' };
    }

    try {
      const result = await fcmPushService.sendPushToRecipients(recipientUids, notificationRecord);
      const deliveredCount = typeof result.delivered === 'number' ? result.delivered : 0;
      const isDelivered = deliveredCount > 0;

      return {
        delivered: isDelivered,
        recipientsCount: deliveredCount,
        failedCount: result.failed || 0,
        error: result.success ? null : (result.reason || 'Push delivery failed'),
        skipped: Boolean(result.skipped),
      };
    } catch (err) {
      console.warn('⚠️ [pushDeliveryService] Batch push delivery error:', err.message);
      return { delivered: false, recipientsCount: 0, error: err.message };
    }
  },
};

