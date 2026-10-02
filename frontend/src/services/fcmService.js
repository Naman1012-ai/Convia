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
 * @returns {Promise<{ success: boolean, token?: string, permission: string, error?: string }>}
 */
export async function enableWebPushNotifications({ vapidKey } = {}) {
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

  // Resolve VAPID Public Key
  const effectiveVapidKey =
    vapidKey ||
    import.meta.env.VITE_FIREBASE_VAPID_KEY ||
    import.meta.env.VITE_VAPID_KEY;

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

    // Persist token in local storage
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(LOCAL_STORAGE_FCM_KEY, token);
    }

    // Register token on Express backend with verified user session
    await apiClient.post('/api/notifications/fcm/register', {
      token,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      platform: typeof navigator !== 'undefined' ? navigator.platform : 'web',
    });

    console.log('✅ [fcmService] Push notifications enabled and token registered successfully.');

    return {
      success: true,
      token,
      permission: 'granted',
    };
  } catch (err) {
    console.error('🚨 [fcmService] Failed to acquire or register FCM token:', err);
    return {
      success: false,
      permission: 'granted',
      error: err.message || 'Error occurred while generating push token.',
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

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(LOCAL_STORAGE_FCM_KEY);
    }
  }

  return { success: true };
}

/**
 * Checks whether push notifications are currently registered and enabled locally.
 * @returns {boolean}
 */
export function isPushNotificationsEnabledLocally() {
  if (typeof window === 'undefined') return false;
  const permission = getNotificationPermission();
  const token = window.localStorage ? window.localStorage.getItem(LOCAL_STORAGE_FCM_KEY) : null;
  return permission === 'granted' && Boolean(token);
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
        console.log('[fcmService] Foreground message received:', payload);
        if (typeof onMessageReceived === 'function') {
          onMessageReceived(payload);
        }
      });
    } catch (err) {
      console.warn('[fcmService] Failed to attach onMessage listener:', err);
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
