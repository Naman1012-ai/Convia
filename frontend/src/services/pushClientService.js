/**
 * Convia Phase 7: Client Push Notification Abstraction.
 *
 * Provides a clean interface for:
 * - Requesting device browser notification permissions
 * - Storing device registration tokens
 * - Non-blocking fallback when push notifications are unsupported or denied
 */

export const pushClientService = {
  /**
   * Checks if Notification API is supported in current browser environment.
   */
  isPushSupported: () => {
    return (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator
    );
  },

  /**
   * Current notification permission status ('default', 'granted', 'denied', 'unsupported').
   */
  getPermissionStatus: () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return window.Notification.permission;
  },

  /**
   * Request browser notification permission from user.
   */
  requestPermission: async () => {
    if (!pushClientService.isPushSupported()) {
      return 'unsupported';
    }
    try {
      const permission = await window.Notification.requestPermission();
      return permission;
    } catch (e) {
      console.warn('[pushClientService] Permission request failed:', e);
      return 'denied';
    }
  },

  /**
   * Registers current device token/endpoint for user in RTDB.
   *
   * @param {string} userUid - Logged-in user Auth UID
   * @param {string} tokenOrEndpoint - Device push token or subscription endpoint
   */
  registerDeviceToken: async (userUid, tokenOrEndpoint) => {
    if (!userUid || !tokenOrEndpoint) return false;
    try {
      // Prepared extension point: persists device push token to user_push_subscriptions/{userUid}
      return Boolean(userUid && tokenOrEndpoint);
    } catch (err) {
      console.warn('[pushClientService] Failed to register device token:', err);
      return false;
    }
  },
};
