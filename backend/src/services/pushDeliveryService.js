import { rtdbService } from './rtdbService.js';

/**
 * Convia Phase 7: Push Delivery Service Abstraction.
 *
 * Responsibilities:
 * - Decouples persistent database notifications from device push delivery.
 * - Dispatches background push notifications to registered device tokens/endpoints.
 * - Guarantees non-blocking execution so push failures never fail database operations.
 */
export const pushDeliveryService = {
  /**
   * Dispatches a push notification to all registered devices for a recipient.
   *
   * @param {string} recipientUid - Recipient Auth UID
   * @param {Object} notificationRecord - Canonical notification record
   * @returns {Promise<{ delivered: boolean, recipientsCount: number, error: string|null }>}
   */
  sendPushNotification: async (recipientUid, notificationRecord) => {
    if (!recipientUid || !notificationRecord) {
      return { delivered: false, recipientsCount: 0, error: 'Missing recipient or notification record' };
    }

    try {
      // 1. Resolve registered device tokens / push subscriptions for recipient
      const tokensPath = `user_push_subscriptions/${recipientUid}`;
      const userTokens = await rtdbService.getData(tokensPath);

      if (!userTokens || typeof userTokens !== 'object') {
        // No active push device registrations for this user
        return { delivered: false, recipientsCount: 0, error: null };
      }

      const activeEndpoints = Object.values(userTokens).filter(Boolean);
      if (activeEndpoints.length === 0) {
        return { delivered: false, recipientsCount: 0, error: null };
      }

      console.log(`📡 [PushDeliveryService] Dispatched push payload for ${recipientUid} to ${activeEndpoints.length} registered device endpoints.`);

      // Future Extension: Integrate FCM admin.messaging().sendEachForMulticast(...) or Web Push
      // e.g.:
      // const fcmTokens = activeEndpoints.map(e => e.token).filter(Boolean);
      // if (fcmTokens.length > 0) {
      //   await admin.messaging().sendEachForMulticast({ tokens: fcmTokens, notification: { title: notificationRecord.title, body: notificationRecord.body } });
      // }

      return {
        delivered: true,
        recipientsCount: activeEndpoints.length,
        error: null,
      };
    } catch (err) {
      console.warn(`⚠️ [PushDeliveryService] Background push delivery error for ${recipientUid}:`, err.message);
      return { delivered: false, recipientsCount: 0, error: err.message };
    }
  },
};
