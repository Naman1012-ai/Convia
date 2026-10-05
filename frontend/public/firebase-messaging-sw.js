/**
 * Firebase Cloud Messaging Service Worker for Convia
 *
 * Location: /firebase-messaging-sw.js
 * Scope: /
 * Compatible with Firebase JavaScript SDK v10.14.1
 */

/* eslint-disable no-restricted-globals */
/* global importScripts, firebase, clients */

// 1. Import Firebase v10.14.1 Compat scripts for Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

// 2. Resolve Firebase Web Configuration
// Allows dynamic URL query parameters passed during registration with fallback to authoritative project credentials.
const params = new URL(self.location).searchParams;

const firebaseConfig = {
  apiKey: params.get('apiKey') || 'AIzaSyC15Z6LGp_viZf-kMm4ezfdXukd4UiQubs',
  authDomain: params.get('authDomain') || 'brainsync-07.firebaseapp.com',
  projectId: params.get('projectId') || 'brainsync-07',
  databaseURL:
    params.get('databaseURL') ||
    'https://brainsync-07-default-rtdb.asia-southeast1.firebasedatabase.app',
  storageBucket: params.get('storageBucket') || 'brainsync-07.appspot.com',
  messagingSenderId: params.get('messagingSenderId') || '470734580927',
  appId: params.get('appId') || '1:470734580927:web:8b259b8ed89a158c972a0a',
};

// 3. Initialize Firebase App (guarded singleton)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// 4. Initialize Firebase Cloud Messaging
const messaging = firebase.messaging();

// 5. Service Worker Lifecycle Management
self.addEventListener('install', () => {
  // Activate immediately without waiting for existing workers to terminate
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Claim all connected clients immediately so the service worker controls them
  event.waitUntil(self.clients.claim());
});

// 6. Handle Background Push Messages (data-only payloads)
messaging.onBackgroundMessage((payload) => {
  const data = (payload && payload.data) || {};
  const notifPayload = (payload && payload.notification) || {};

  // Use data fields (primary) with notification fields as fallback
  const notificationTitle = data.title || notifPayload.title || 'Convia Notification';
  const notificationBody = data.body || notifPayload.body || '';
  const targetUrl = data.url || data.link || data.click_action || '/';
  const notifId = data.notificationId || data.id || '';

  // Deduplication: use notificationId as tag to prevent duplicate notifications
  const tag = notifId ? `convia-${notifId}` : `convia-${Date.now()}`;

  const notificationOptions = {
    body: notificationBody,
    icon: data.icon || notifPayload.icon || '/convia-logo.png',
    badge: data.badge || notifPayload.badge || '/favicon.png',
    tag: tag,
    data: {
      url: targetUrl,
      id: notifId,
      type: data.type || null,
      timestamp: Date.now(),
    },
    requireInteraction: false,
    renotify: true,
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// 7. Handle Notification Click and Safe Navigation
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const notificationData = event.notification.data || {};
  const rawTargetUrl =
    notificationData.url ||
    notificationData.link ||
    notificationData.click_action ||
    '/';

  // Sanitize target URL to protect against open redirects
  let targetPath = '/';
  try {
    const parsed = new URL(rawTargetUrl, self.location.origin);
    // Security check: only navigate within the same origin
    if (parsed.origin === self.location.origin) {
      targetPath = parsed.pathname + parsed.search + parsed.hash;
    } else {
      console.warn('[firebase-messaging-sw.js] Blocked non-origin destination:', rawTargetUrl);
      targetPath = '/';
    }
  } catch (e) {
    targetPath = '/';
  }

  // Focus existing open Convia window or open a new window
  const urlToOpen = new URL(targetPath, self.location.origin).href;

  const navigatePromise = clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((windowClients) => {
      // Check if there is already a window/tab open on this origin
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          if ('navigate' in client && targetPath !== '/') {
            client.navigate(urlToOpen);
          }
          return client.focus();
        }
      }
      // If no window is currently open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    });

  event.waitUntil(navigatePromise);
});
