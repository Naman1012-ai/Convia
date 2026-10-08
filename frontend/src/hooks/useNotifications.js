import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { inAppNotificationService } from '../services/inAppNotificationService';
import { setupForegroundMessageHandler, syncWebPushToken } from '../services/fcmService';

/**
 * Convia Phase 7A: Authoritative Persistent Notification Hook.
 *
 * Provides real-time synchronization with Firebase Realtime Database (RTDB),
 * automatic lifecycle cleanup on auth change, and optimistic read/unread operations.
 *
 * @returns {{
 *   notifications: Array<Object>,
 *   unreadCount: number,
 *   loading: boolean,
 *   error: Error|null,
 *   markAsRead: (notificationId: string) => Promise<void>,
 *   markAsUnread: (notificationId: string) => Promise<void>,
 *   markAllAsRead: () => Promise<void>,
 *   refresh: (options?: Object) => Promise<Array<Object>>,
 * }}
 */
export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Real-time synchronization
  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = inAppNotificationService.subscribeToUserNotifications(
      user.uid,
      ({ notifications: list, unreadCount: count }) => {
        if (!isMountedRef.current) return;
        setNotifications(list || []);
        setUnreadCount(count || 0);
        setLoading(false);
        setError(null);
      },
      (err) => {
        if (!isMountedRef.current) return;
        console.warn('[useNotifications] Subscription error:', err);
        setError(err);
        setLoading(false);
      }
    );

    // Silently synchronize FCM token if permission was previously granted
    syncWebPushToken(user.uid).catch((err) => {
      console.warn('[useNotifications] Token sync warning:', err?.message || err);
    });

    const unsubFcm = setupForegroundMessageHandler((_payload) => {
      // Foreground push handler: RTDB stream updates notification feed state.
      // Intentionally quiet — no duplicate foreground toasts generated.
    });

    return () => {
      unsubscribe();
      if (typeof unsubFcm === 'function') {
        unsubFcm();
      }
    };
  }, [user?.uid]);

  // Mark single notification as read
  const markAsRead = useCallback(async (notificationId) => {
    if (!user?.uid || !notificationId) return;

    // Optimistic local state update
    setNotifications((prev) =>
      prev.map((n) =>
        (n.notificationId === notificationId || n.id === notificationId)
          ? { ...n, read: true, readAt: Date.now() }
          : n
      )
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await inAppNotificationService.markNotificationAsRead(user.uid, notificationId);
    } catch (err) {
      console.warn('[useNotifications] markAsRead error:', err);
      if (isMountedRef.current) setError(err);
    }
  }, [user?.uid]);

  // Mark single notification as unread
  const markAsUnread = useCallback(async (notificationId) => {
    if (!user?.uid || !notificationId) return;

    // Optimistic local state update
    setNotifications((prev) =>
      prev.map((n) =>
        (n.notificationId === notificationId || n.id === notificationId)
          ? { ...n, read: false, readAt: null }
          : n
      )
    );
    setUnreadCount((prev) => prev + 1);

    try {
      await inAppNotificationService.markNotificationAsUnread(user.uid, notificationId);
    } catch (err) {
      console.warn('[useNotifications] markAsUnread error:', err);
      if (isMountedRef.current) setError(err);
    }
  }, [user?.uid]);

  // Mark all unread notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!user?.uid || notifications.length === 0) return;

    // Optimistic local update
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;

    const now = Date.now();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true, readAt: now })));
    setUnreadCount(0);

    try {
      await inAppNotificationService.markAllNotificationsAsRead(user.uid, notifications);
    } catch (err) {
      console.warn('[useNotifications] markAllAsRead error:', err);
      if (isMountedRef.current) setError(err);
    }
  }, [user?.uid, notifications]);

  // One-shot manual refresh
  const refresh = useCallback(async (options = {}) => {
    if (!user?.uid) return [];
    try {
      setLoading(true);
      const fetched = await inAppNotificationService.fetchNotifications(user.uid, options);
      if (isMountedRef.current) {
        setNotifications(fetched);
        setUnreadCount(fetched.filter((n) => !n.read).length);
        setLoading(false);
      }
      return fetched;
    } catch (err) {
      console.warn('[useNotifications] refresh error:', err);
      if (isMountedRef.current) {
        setError(err);
        setLoading(false);
      }
      return [];
    }
  }, [user?.uid]);

  // Context-aware mark as read (conversation-specific)
  const markByContext = useCallback(async (context) => {
    if (!user?.uid || !context) return [];
    try {
      const updatedIds = await inAppNotificationService.markNotificationsAsReadByContext(
        user.uid,
        context,
        notifications
      );

      if (Array.isArray(updatedIds) && updatedIds.length > 0) {
        const idSet = new Set(updatedIds);
        setNotifications((prev) =>
          prev.map((n) => {
            const notifKey = n.notificationId || n.id;
            return idSet.has(notifKey)
              ? { ...n, read: true, readAt: Date.now() }
              : n;
          })
        );
        setUnreadCount((prev) => Math.max(0, prev - updatedIds.length));
      }

      return updatedIds;
    } catch (err) {
      console.warn('[useNotifications] markByContext error:', err);
      if (isMountedRef.current) setError(err);
      return [];
    }
  }, [user?.uid, notifications]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    markByContext,
    refresh,
  };
}
