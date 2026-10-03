import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  MessageSquare,
  AtSign,
  CornerDownRight,
  Sparkles,
  AlertTriangle,
  Lightbulb,
  Compass,
  MessageCircle,
  HelpCircle,
  Info,
  Smile,
  X,
  CheckSquare,
  UserPlus,
  UserMinus,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';
import { NOTIFICATION_TYPES } from '../../constants/notificationConstants';
import { useUserProfiles } from '../../hooks/useUserProfile';
import {
  isFcmSupported,
  getNotificationPermission,
  enableWebPushNotifications,
  isPushNotificationsEnabledLocally,
} from '../../services/fcmService';

/**
 * Convia Phase 7: Real-Time In-App Notification Center Dropdown.
 * Renders in Navbar with live unread badge, multi-category icon badges,
 * deep-link click navigation, and mobile-safe responsiveness.
 */
export function NotificationDropdown() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    refresh,
  } = useNotifications();

  const senderIds = useMemo(() => {
    return Array.from(
      new Set(
        notifications
          .map((n) => n.actorId || n.senderId)
          .filter((id) => id && id !== 'system')
      )
    );
  }, [notifications]);

  const { resolveName, resolveAvatar } = useUserProfiles(senderIds);
  const dropdownRef = useRef(null);

  // Web Push Notification Banner State
  const [isPushSupported, setIsPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [dismissedPushBanner, setDismissedPushBanner] = useState(false);

  useEffect(() => {
    isFcmSupported().then((supported) => {
      setIsPushSupported(supported);
      if (supported) {
        setPushEnabled(isPushNotificationsEnabledLocally(user?.uid));
      }
    });
  }, [user?.uid]);

  const handleEnablePushFromDropdown = async () => {
    if (pushLoading) return;
    setPushLoading(true);
    try {
      const res = await enableWebPushNotifications({ currentUid: user?.uid });
      if (res.success) {
        setPushEnabled(true);
      }
    } catch (err) {
      console.warn('[NotificationDropdown] Push enable error:', err);
    } finally {
      setPushLoading(false);
    }
  };

  // Automatically close notification dropdown on route transition
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  // Click outside and Escape key listeners
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleNotificationClick = async (notif) => {
    if (!notif) return;
    setIsOpen(false);

    const notifId = notif.notificationId || notif.id;

    if (notif.actionUrl) {
      try {
        navigate(notif.actionUrl);
        // Only mark notification as read after navigation has safely succeeded
        if (!notif.read && notifId) {
          await markAsRead(notifId);
        }
      } catch (err) {
        console.warn('[NotificationDropdown] Navigation error, retaining unread state:', err);
      }
    } else {
      if (!notif.read && notifId) {
        await markAsRead(notifId);
      }
    }
  };

  const handleMarkAllAsRead = async (e) => {
    e.stopPropagation();
    await markAllAsRead();
  };

  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return '';
    const diffSeconds = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSeconds < 60) return 'just now';
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const renderBadgeIcon = (type) => {
    switch (type) {
      case NOTIFICATION_TYPES.CHAT_MENTION:
      case NOTIFICATION_TYPES.MENTION:
        return {
          icon: <AtSign className="h-2.5 w-2.5" />,
          color: 'bg-amber-500',
        };
      case NOTIFICATION_TYPES.CHAT_REPLY:
      case NOTIFICATION_TYPES.MESSAGE_REPLY:
        return {
          icon: <CornerDownRight className="h-2.5 w-2.5" />,
          color: 'bg-primary-600',
        };
      case NOTIFICATION_TYPES.CHAT_MESSAGE:
      case NOTIFICATION_TYPES.COMMUNITY_POST:
        return {
          icon: <MessageSquare className="h-2.5 w-2.5" />,
          color: 'bg-blue-500',
        };
      case NOTIFICATION_TYPES.COMMUNITY_REPLY:
        return {
          icon: <CornerDownRight className="h-2.5 w-2.5" />,
          color: 'bg-indigo-500',
        };
      case NOTIFICATION_TYPES.CHAT_REACTION:
      case NOTIFICATION_TYPES.MESSAGE_REACTION:
        return {
          icon: <Smile className="h-2.5 w-2.5" />,
          color: 'bg-pink-500',
        };
      case NOTIFICATION_TYPES.BLUEPRINT_COMPLETED:
      case NOTIFICATION_TYPES.BLUEPRINT_VERSION_APPROVED:
        return {
          icon: <Sparkles className="h-2.5 w-2.5" />,
          color: 'bg-emerald-500',
        };
      case NOTIFICATION_TYPES.BLUEPRINT_FAILED:
        return {
          icon: <AlertTriangle className="h-2.5 w-2.5" />,
          color: 'bg-rose-500',
        };
      case NOTIFICATION_TYPES.IDEA_POSTED:
      case NOTIFICATION_TYPES.IDEA_CREATED:
      case NOTIFICATION_TYPES.IDEA_ACTIVITY:
        return {
          icon: <Lightbulb className="h-2.5 w-2.5" />,
          color: 'bg-amber-500',
        };
      case NOTIFICATION_TYPES.IDEA_SUGGESTION:
      case NOTIFICATION_TYPES.IDEA_SUGGESTION_CREATED:
      case NOTIFICATION_TYPES.IDEA_SUGGESTION_ACCEPTED:
        return {
          icon: <Compass className="h-2.5 w-2.5" />,
          color: 'bg-purple-600',
        };
      case NOTIFICATION_TYPES.IDEA_COMMENT:
      case NOTIFICATION_TYPES.COMMENT_CREATED:
        return {
          icon: <MessageCircle className="h-2.5 w-2.5" />,
          color: 'bg-sky-500',
        };
      case NOTIFICATION_TYPES.IDEA_QUESTION:
      case NOTIFICATION_TYPES.QUESTION_CREATED:
      case NOTIFICATION_TYPES.QUESTION_ANSWERED:
        return {
          icon: <HelpCircle className="h-2.5 w-2.5" />,
          color: 'bg-violet-600',
        };
      case NOTIFICATION_TYPES.TASK_ASSIGNED:
      case NOTIFICATION_TYPES.TASK_COMPLETED:
      case NOTIFICATION_TYPES.TASK_STATUS_CHANGED:
        return {
          icon: <CheckSquare className="h-2.5 w-2.5" />,
          color: 'bg-teal-600',
        };
      case NOTIFICATION_TYPES.WORKSPACE_MEMBER_JOINED:
      case NOTIFICATION_TYPES.WORKSPACE_MEMBER_INVITED:
        return {
          icon: <UserPlus className="h-2.5 w-2.5" />,
          color: 'bg-emerald-600',
        };
      case NOTIFICATION_TYPES.WORKSPACE_MEMBER_LEFT:
      case NOTIFICATION_TYPES.INVITATION_DECLINED:
        return {
          icon: <UserMinus className="h-2.5 w-2.5" />,
          color: 'bg-slate-600',
        };
      case NOTIFICATION_TYPES.ADMIN_BROADCAST:
      default:
        return {
          icon: <Info className="h-2.5 w-2.5" />,
          color: 'bg-indigo-600',
        };
    }
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
        aria-label={`Notifications, ${unreadCount} unread`}
        title="Notifications"
      >
        <Bell className="h-5 w-5" />
        {!loading && unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-extrabold text-white shadow-xs animate-in zoom-in-50">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown Panel (Responsive: clamped width for mobile screens) */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-sm rounded-2xl bg-white border border-slate-200 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          role="menu"
          aria-orientation="vertical"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                Notifications
              </h3>
              {!loading && unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 text-[10px] font-bold">
                  {unreadCount} new
                </span>
              )}
            </div>

            {!loading && unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-600 hover:text-primary-800 transition-colors cursor-pointer"
                title="Mark all as read"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* Web Push Prompt Banner (Subtle & Non-Intrusive) */}
          {isPushSupported && !pushEnabled && !dismissedPushBanner && (
            <div className="bg-primary-50/70 border-b border-primary-100/60 px-3 py-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Bell className="h-3.5 w-3.5 text-primary-600 shrink-0" />
                <span className="text-[11px] text-primary-950 font-medium truncate">
                  Enable browser push for mentions & replies
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleEnablePushFromDropdown}
                  disabled={pushLoading}
                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary-600 text-white hover:bg-primary-700 transition-colors cursor-pointer"
                >
                  {pushLoading ? '...' : 'Enable'}
                </button>
                <button
                  type="button"
                  onClick={() => setDismissedPushBanner(true)}
                  className="p-0.5 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                  title="Dismiss"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}

          {/* Notification List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-50 p-1">
            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400 space-y-3">
                <div className="h-6 w-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="font-medium text-slate-500">Loading notifications...</p>
              </div>
            ) : error ? (
              <div className="py-10 text-center text-xs text-slate-500 space-y-2 px-4">
                <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
                <p className="font-semibold text-slate-700">Unable to load notifications</p>
                <p className="text-[11px] text-slate-400">Please check your connection and try again.</p>
                {typeof refresh === 'function' && (
                  <button
                    type="button"
                    onClick={() => refresh()}
                    className="mt-2 inline-flex items-center px-3 py-1.5 rounded-lg bg-primary-50 text-primary-600 text-xs font-semibold hover:bg-primary-100 transition-colors cursor-pointer"
                  >
                    Retry
                  </button>
                )}
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                <Bell className="h-8 w-8 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-600">No notifications yet</p>
                <p className="text-[11px] text-slate-400">
                  You'll be notified when there is workspace activity, proposals, comments, or chat replies.
                </p>
              </div>
            ) : (
              notifications.map((item) => {
                const effectiveActorId = item.actorId || item.senderId;
                const isSystem = effectiveActorId === 'system';
                const senderName = isSystem
                  ? item.actorName || 'Convia System'
                  : resolveName(effectiveActorId, item.actorName || item.senderName || 'Member');
                const senderAvatar = isSystem
                  ? ''
                  : resolveAvatar(effectiveActorId, item.actorAvatar || item.senderAvatar || '');

                const badge = renderBadgeIcon(item.type);

                const itemTitle = item.title || (
                  item.type === 'CHAT_MENTION'
                    ? `${senderName} mentioned you`
                    : item.type === 'CHAT_REPLY' || item.type === 'MESSAGE_REPLY'
                    ? `${senderName} replied to your message`
                    : item.type === 'CHAT_REACTION' || item.type === 'MESSAGE_REACTION'
                    ? `${senderName} reacted to your message`
                    : senderName
                );

                const itemBody = item.body || item.previewText || '';

                return (
                  <button
                    key={item.notificationId}
                    type="button"
                    onClick={() => handleNotificationClick(item)}
                    className={`w-full text-left p-3 rounded-xl transition-all flex items-start gap-3 cursor-pointer ${
                      item.read
                        ? 'hover:bg-slate-50/80 opacity-80'
                        : 'bg-indigo-50/30 hover:bg-indigo-50/60 font-semibold'
                    }`}
                  >
                    {/* Author Avatar / Category Icon */}
                    <div className="relative shrink-0 pt-0.5">
                      {senderAvatar ? (
                        <img
                          src={senderAvatar}
                          alt={senderName}
                          className="h-8 w-8 rounded-full object-cover border border-slate-200"
                        />
                      ) : (
                        <div
                          className={`h-8 w-8 rounded-full text-white font-bold text-xs flex items-center justify-center ${
                            isSystem ? 'bg-slate-800' : 'bg-indigo-600'
                          }`}
                        >
                          {isSystem ? '⚡' : (senderName || 'M').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div
                        className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full flex items-center justify-center text-white text-[9px] shadow-xs ${badge.color}`}
                      >
                        {badge.icon}
                      </div>
                    </div>

                    {/* Text Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {itemTitle}
                        </p>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </div>

                      {itemBody && (
                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                          {itemBody}
                        </p>
                      )}
                    </div>

                    {/* Unread dot */}
                    {!item.read && (
                      <span
                        className="h-2 w-2 rounded-full bg-indigo-600 shrink-0 self-center"
                        title="Unread"
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
