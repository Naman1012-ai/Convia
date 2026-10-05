/**
 * Firebase Cloud Messaging (FCM) Client Service for Convia
 *
 * Handles:
 * - Browser push notification compatibility detection (isFcmSupported)
 * - Explicit user opt-in / permission requests (Notification.requestPermission)
 * - Service worker registration (/firebase-messaging-sw.js with root scope)
 * - FCM token acquisition and local storage caching (getToken)
 * - Authenticated token registration and unregistration with Express backend
 * - Foreground push message handling (onMessage) without duplicate native notifications
 * - Lifecycle cleanup upon user logout
 */

import { isSupported, getMessaging, getToken, deleteToken, onMessage } from 'firebase/messaging';
import app from '../config/firebase';
import { apiClient } from './apiClient';

const SW_PATH = '/firebase-messaging-sw.js';
const SW_SCOPE = '/';
const LOCAL_STORAGE_FCM_KEY = 'convia_fcm_token';
const LOCAL_STORAGE_FCM_UID_KEY = 'convia_fcm_uid';
const AUTHORITATIVE_VAPID_KEY =
  'BJibX223kK8B5hnqYA56fbfGY2UiTEDXNuCzZyLi7sULo2SkqrsCAzBiQz948CMG1G0lmSNkfIY463sCVD1gSic';

let messagingInstance = null;
let registrationPromise = null;
let foregroundListenerUnsubscribe = null;

/**
 * Checks if Service Workers, PushManager, and Firebase Messaging are supported.
 * @returns {Promise<boolean>}
 */
export async function isFcmSupported() {
  if (typeof window === 'undefined') return false;
  if (!('serviceWorker' in navigator) || !('Notification' in window) || !('PushManager' in window)) {
    return false;
  }
  try {
    return await isSupported();
  } catch (err) {
    console.warn('[fcmService] isSupported check failed:', err);
    return false;
  }
}

/**
 * Returns current browser notification permission state.
 * @returns {'default' | 'granted' | 'denied' | 'unsupported'}
 */
export function getNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return window.Notification.permission;
}

/**
 * Registers the root-scoped service worker (/firebase-messaging-sw.js).
 * Idempotent.
 */
export async function registerMessagingServiceWorker(configOverride = null) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  if (registrationPromise) {
    return registrationPromise;
  }

  registrationPromise = (async () => {
    try {
      let swUrl = SW_PATH;
      if (configOverride && typeof configOverride === 'object') {
        const queryParams = new window.URLSearchParams();
        Object.entries(configOverride).forEach(([key, val]) => {
          if (val) queryParams.set(key, val);
        });
        const qs = queryParams.toString();
        if (qs) swUrl = `${SW_PATH}?${qs}`;
      }

      const existingRegistration = await navigator.serviceWorker.getRegistration(SW_SCOPE);
      if (existingRegistration && existingRegistration.active) {
        return existingRegistration;
      }

      const registration = await navigator.serviceWorker.register(swUrl, {
        scope: SW_SCOPE,
        updateViaCache: 'none',
      });
      // Wait for the service worker to be fully activated and ready to handle push events
      await navigator.serviceWorker.ready;
      return registration;
    } catch (error) {
      console.warn('[fcmService] Service worker registration failed:', error.message || error);
      registrationPromise = null;
      return null;
    }
  })();

  return registrationPromise;
}

/**
 * Retrieves the initialized Firebase Messaging singleton instance.
 */
export async function getMessagingInstance() {
  if (messagingInstance) return messagingInstance;
  const supported = await isFcmSupported();
  if (!supported) return null;

  try {
    messagingInstance = getMessaging(app);
    return messagingInstance;
  } catch (err) {
    console.warn('[fcmService] getMessaging failed:', err.message);
    return null;
  }
}

/**
 * Explicit user-initiated flow to enable browser push notifications.
 * Requests notification permission, retrieves FCM token, and registers it with the backend.
 *
 * @param {Object} [options]
 * @param {string} [options.vapidKey]
 * @param {string} [options.currentUid]
 * @returns {Promise<{ success: boolean, token?: string, permission: string, error?: string }>}
 */
export async function enableWebPushNotifications({ vapidKey, currentUid = null } = {}) {
  const supported = await isFcmSupported();
  if (!supported) {
    return {
      success: false,
      permission: 'unsupported',
      error: 'Push notifications are not supported in this browser.',
    };
  }

  const currentPermission = getNotificationPermission();
  if (currentPermission === 'denied') {
    return {
      success: false,
      permission: 'denied',
      error: 'Notifications are blocked in your browser site settings. Please unblock them to receive alerts.',
    };
  }

  // Request browser permission explicitly
  let grantedPermission = currentPermission;
  if (currentPermission !== 'granted') {
    try {
      grantedPermission = await window.Notification.requestPermission();
    } catch (err) {
      console.warn('[fcmService] Permission request failed:', err);
      return { success: false, permission: 'denied', error: err.message };
    }
  }

  if (grantedPermission !== 'granted') {
    return {
      success: false,
      permission: grantedPermission,
      error: 'Notification permission was not granted.',
    };
  }

  // Ensure service worker is registered
  const swReg = await registerMessagingServiceWorker();
  if (!swReg) {
    return {
      success: false,
      permission: 'granted',
      error: 'Failed to register background service worker.',
    };
  }

  const messaging = await getMessagingInstance();
  if (!messaging) {
    return {
      success: false,
      permission: 'granted',
      error: 'Failed to initialize Firebase Messaging instance.',
    };
  }

  // Resolve VAPID Public Key with authoritative project fallback
  const effectiveVapidKey =
    vapidKey ||
    import.meta.env.VITE_FIREBASE_VAPID_KEY ||
    import.meta.env.VITE_VAPID_KEY ||
    AUTHORITATIVE_VAPID_KEY;

  try {
    const token = await getToken(messaging, {
      serviceWorkerRegistration: swReg,
      vapidKey: effectiveVapidKey || undefined,
    });

    if (!token) {
      return {
        success: false,
        permission: 'granted',
        error: 'Failed to acquire an FCM registration token from Firebase.',
      };
    }

    // Persist token and UID in local storage
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(LOCAL_STORAGE_FCM_KEY, token);
      if (currentUid) {
        window.localStorage.setItem(LOCAL_STORAGE_FCM_UID_KEY, String(currentUid).trim());
      }
    }

    // Register token on Express backend with verified user session
    await apiClient.post('/api/notifications/fcm/register', {
      token,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      platform: typeof navigator !== 'undefined' ? navigator.platform : 'web',
    });

    return {
      success: true,
      token,
      permission: 'granted',
    };
  } catch (err) {
    console.error('[fcmService] Failed to acquire or register push token:', err?.message || err);
    return {
      success: false,
      permission: 'granted',
      error: err.message || 'Error occurred while generating push token.',
    };
  }
}

/**
 * Non-intrusive lifecycle token synchronization.
 * If permission is already granted for the browser/origin, silently registers or refreshes
 * the token with the backend for the currently authenticated user UID.
 * Never requests permission if permission is 'default' or 'denied' (respects browser requirement).
 *
 * @param {string} currentUid - Current authenticated Firebase Auth UID
 * @param {Object} [options]
 * @returns {Promise<{ success: boolean, token?: string, permission: string, skipped?: boolean, error?: string }>}
 */
export async function syncWebPushToken(currentUid, { vapidKey } = {}) {
  if (!currentUid || typeof currentUid !== 'string') {
    return { success: false, skipped: true, reason: 'NO_AUTHENTICATED_USER' };
  }

  const supported = await isFcmSupported();
  if (!supported) {
    return { success: false, skipped: true, reason: 'UNSUPPORTED' };
  }

  const permission = getNotificationPermission();
  if (permission !== 'granted') {
    // Silently skip if user has not already granted permission (never spam browser prompts on load)
    return { success: false, skipped: true, permission };
  }

  try {
    const swReg = await registerMessagingServiceWorker();
    if (!swReg) {
      return { success: false, permission, error: 'Failed to register service worker' };
    }

    const messaging = await getMessagingInstance();
    if (!messaging) {
      return { success: false, permission, error: 'Failed to get messaging instance' };
    }

    const effectiveVapidKey =
      vapidKey ||
      import.meta.env.VITE_FIREBASE_VAPID_KEY ||
      import.meta.env.VITE_VAPID_KEY ||
      AUTHORITATIVE_VAPID_KEY;

    const token = await getToken(messaging, {
      serviceWorkerRegistration: swReg,
      vapidKey: effectiveVapidKey || undefined,
    });

    if (!token) {
      return { success: false, permission, error: 'Failed to acquire FCM token' };
    }

    // Persist token and UID
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(LOCAL_STORAGE_FCM_KEY, token);
      window.localStorage.setItem(LOCAL_STORAGE_FCM_UID_KEY, String(currentUid).trim());
    }

    // Register or refresh token on backend
    await apiClient.post('/api/notifications/fcm/register', {
      token,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      platform: typeof navigator !== 'undefined' ? navigator.platform : 'web',
    });

    return {
      success: true,
      token,
      permission: 'granted',
    };
  } catch (err) {
    console.warn('[fcmService] Silent token sync warning:', err.message);
    return {
      success: false,
      permission,
      error: err.message,
    };
  }
}

/**
 * Explicit user-initiated flow to disable push notifications for the current device.
 * Unregisters token from Express backend and removes local storage reference.
 */
export async function disableWebPushNotifications() {
  let token = null;
  if (typeof window !== 'undefined' && window.localStorage) {
    token = window.localStorage.getItem(LOCAL_STORAGE_FCM_KEY);
  }

  if (token) {
    try {
      await apiClient.post('/api/notifications/fcm/unregister', { token });
    } catch (err) {
      console.warn('[fcmService] Backend unregister error (ignored):', err.message);
    }

    // Also attempt Firebase SDK deleteToken if instance exists
    try {
      const messaging = await getMessagingInstance();
      if (messaging) {
        await deleteToken(messaging);
      }
    } catch (delErr) {
      console.warn('[fcmService] Firebase deleteToken warning:', delErr.message);
    }
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem(LOCAL_STORAGE_FCM_KEY);
    window.localStorage.removeItem(LOCAL_STORAGE_FCM_UID_KEY);
  }

  return { success: true };
}

/**
 * Checks whether push notifications are currently registered and enabled locally.
 * Optionally verifies that the registered token belongs to the specified user UID.
 *
 * @param {string|null} [currentUid=null] - Optional user UID to match
 * @returns {boolean}
 */
export function isPushNotificationsEnabledLocally(currentUid = null) {
  if (typeof window === 'undefined') return false;
  const permission = getNotificationPermission();
  const token = window.localStorage ? window.localStorage.getItem(LOCAL_STORAGE_FCM_KEY) : null;
  const cachedUid = window.localStorage ? window.localStorage.getItem(LOCAL_STORAGE_FCM_UID_KEY) : null;

  if (permission !== 'granted' || !token) {
    return false;
  }

  if (currentUid && cachedUid && cachedUid !== String(currentUid).trim()) {
    return false; // Token was registered for another user
  }

  return true;
}

/**
 * Checks registration status against both local storage and Express backend.
 *
 * @param {string|null} [currentUid=null]
 * @returns {Promise<{ supported: boolean, permission: string, locallyEnabled: boolean, backendEnabled: boolean, tokenCount: number }>}
 */
export async function checkPushRegistrationStatus(currentUid = null) {
  const localEnabled = isPushNotificationsEnabledLocally(currentUid);
  const supported = await isFcmSupported();
  const permission = getNotificationPermission();

  try {
    const res = await apiClient.get('/api/notifications/fcm/status');
    return {
      supported,
      permission,
      locallyEnabled: localEnabled,
      backendEnabled: Boolean(res?.enabled),
      tokenCount: res?.tokenCount || 0,
    };
  } catch {
    return {
      supported,
      permission,
      locallyEnabled: localEnabled,
      backendEnabled: localEnabled,
      tokenCount: localEnabled ? 1 : 0,
    };
  }
}

/**
 * Listens for incoming push messages while the app is in the foreground.
 * Avoids duplicate native system alerts; can trigger an in-app toast or refresh notifications.
 *
 * @param {Function} onMessageReceived Callback receiving (payload)
 * @returns {Function} Unsubscribe cleanup function
 */
export function setupForegroundMessageHandler(onMessageReceived) {
  if (foregroundListenerUnsubscribe) {
    foregroundListenerUnsubscribe();
    foregroundListenerUnsubscribe = null;
  }

  let active = true;

  getMessagingInstance().then((messaging) => {
    if (!messaging || !active) return;
    try {
      foregroundListenerUnsubscribe = onMessage(messaging, (payload) => {
        if (typeof onMessageReceived === 'function') {
          onMessageReceived(payload);
        }
      });
    } catch (err) {
      console.warn('[fcmService] Failed to attach onMessage listener:', err?.message || err);
    }
  });

  return () => {
    active = false;
    if (foregroundListenerUnsubscribe) {
      foregroundListenerUnsubscribe();
      foregroundListenerUnsubscribe = null;
    }
  };
}

/**
 * Safely unregisters the local device token upon user logout.
 */
export async function cleanupFcmOnLogout() {
  try {
    await disableWebPushNotifications();
  } catch (err) {
    console.warn('[fcmService] cleanupFcmOnLogout error (safe ignore):', err);
  }
}
