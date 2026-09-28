/**
 * Pure Feed Enhancement & Grouping Helpers for Convia Chat System.
 * Handles chronological date dividers, message grouping, and accessible formatting.
 */
import {
  resolveMemberDisplayName,
  isMessageAuthoredByUser,
  getMessageAuthorUid,
} from './memberIdentity.js';

/**
 * Formats a message timestamp into a clean, localized time string (e.g., "9:42 PM").
 * @param {number|Date} timestamp
 * @returns {string}
 */
export function formatMessageTime(timestamp) {
  if (!timestamp) return '';
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

/**
 * Formats a timestamp into a full descriptive date-time string for tooltips.
 * @param {number|Date} timestamp
 * @returns {string}
 */
export function formatFullDateTime(timestamp) {
  if (!timestamp) return '';
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Checks if two timestamps occur on the exact same calendar day (local time).
 * @param {number|Date} ts1
 * @param {number|Date} ts2
 * @returns {boolean}
 */
export function isSameCalendarDay(ts1, ts2) {
  if (!ts1 || !ts2) return false;
  const d1 = ts1 instanceof Date ? ts1 : new Date(ts1);
  const d2 = ts2 instanceof Date ? ts2 : new Date(ts2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

/**
 * Computes a human-readable date divider label (e.g., "Today", "Yesterday", "Monday, Aug 31").
 * @param {number|Date} timestamp
 * @param {Date} [referenceDate=new Date()]
 * @returns {string}
 */
export function getDateDividerLabel(timestamp, referenceDate = new Date()) {
  if (!timestamp) return '';
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (isNaN(date.getTime())) return '';

  const ref = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);

  // Check Today
  if (isSameCalendarDay(date, ref)) {
    return 'Today';
  }

  // Check Yesterday
  const yesterday = new Date(ref);
  yesterday.setDate(ref.getDate() - 1);
  if (isSameCalendarDay(date, yesterday)) {
    return 'Yesterday';
  }

  // Same year: "Monday, Aug 31"
  if (date.getFullYear() === ref.getFullYear()) {
    return date.toLocaleDateString([], {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  }

  // Older year: "Aug 31, 2025"
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Checks if two consecutive messages should be visually grouped.
 * Conditions:
 * 1. Both messages are valid and non-system.
 * 2. Same sender UID.
 * 3. Occur on the same calendar day.
 * 4. Time delta is within windowMs (default 5 minutes).
 *
 * @param {object} prevMsg
 * @param {object} currMsg
 * @param {number} [windowMs=300000] 5 minutes
 * @returns {boolean}
 */
export function isConsecutiveMessageGroup(prevMsg, currMsg, windowMs = 5 * 60 * 1000) {
  if (!prevMsg || !currMsg) return false;
  if (prevMsg.isSystem || currMsg.isSystem) return false;
  if (prevMsg.senderId !== currMsg.senderId) return false;
  if (!isSameCalendarDay(prevMsg.createdAt, currMsg.createdAt)) return false;

  const timeDelta = Math.abs(Number(currMsg.createdAt) - Number(prevMsg.createdAt));
  return timeDelta <= windowMs;
}

/**
 * Transforms an array of messages into a decorated feed containing date dividers
 * and consecutive message grouping metadata.
 *
 * @param {Array<object>} messages Sorted array of messages (oldest to newest)
 * @param {string} [currentUserId] Authenticated user UID
 * @param {Date} [referenceDate] Mockable reference date for tests
 * @returns {Array<object>} Decorated feed items
 */
export function processMessageFeed(messages = [], currentUserId = null, referenceDate = new Date()) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return [];
  }

  const feedItems = [];
  let lastDividerDateKey = null;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg || typeof msg !== 'object') continue;

    const prevMsg = i > 0 ? messages[i - 1] : null;
    const nextMsg = i < messages.length - 1 ? messages[i + 1] : null;

    const msgDate = new Date(msg.createdAt || Date.now());
    const dateKey = `${msgDate.getFullYear()}-${msgDate.getMonth()}-${msgDate.getDate()}`;

    // 1. Insert Date Divider when date changes
    if (dateKey !== lastDividerDateKey) {
      const label = getDateDividerLabel(msg.createdAt, referenceDate);
      feedItems.push({
        type: 'date_divider',
        isDivider: true,
        id: `divider_${dateKey}`,
        dateLabel: label,
        label,
        date: msg.createdAt,
        timestamp: msg.createdAt,
      });
      lastDividerDateKey = dateKey;
    }

    // 2. Compute Grouping Metadata
    const isGrouped = isConsecutiveMessageGroup(prevMsg, msg);
    const isLastInGroup = !isConsecutiveMessageGroup(msg, nextMsg);

    feedItems.push({
      type: 'message',
      id: msg.messageId || `msg_${i}`,
      message: msg,
      isGrouped,
      isFirstInGroup: !isGrouped,
      isLastInGroup,
      isOwn: Boolean(currentUserId && isMessageAuthoredByUser(msg, currentUserId)),
      timeLabel: formatMessageTime(msg.createdAt),
      fullDateLabel: formatFullDateTime(msg.createdAt),
    });
  }

  return feedItems;
}

/**
 * Returns dynamic, grammatically correct reply count label:
 * 0 -> "Reply"
 * 1 -> "1 Reply"
 * N -> "N Replies"
 *
 * @param {number} count
 * @returns {string}
 */
export function formatReplyCountLabel(count) {
  const numericCount = Number(count) || 0;
  if (numericCount <= 0) return 'Reply';
  if (numericCount === 1) return '1 Reply';
  return `${numericCount} Replies`;
}

export { resolveMemberDisplayName, isMessageAuthoredByUser, getMessageAuthorUid };

/**
 * Resolves a reaction participant UID to rich member profile metadata.
 * Section 27.2:
 * - Labels the currently authenticated user as "You".
 * - For all other members, resolves to their canonical Display Name.
 * - Handles unknown or historical member IDs gracefully with "Unknown member" fallback.
 *
 * @param {string} uid - Participant User ID
 * @param {Array<Object>} [members=[]] - Workspace members list
 * @param {string} [currentUserId=null] - Current user ID
 * @returns {Object} { uid, isCurrentUser, name, avatar, role }
 */
export function resolveReactionParticipant(uid, members = [], currentUserId = null) {
  if (!uid) {
    return {
      uid: 'unknown',
      isCurrentUser: false,
      name: 'Unknown member',
      avatar: '',
      role: 'member',
    };
  }

  const isCurrentUser = Boolean(currentUserId && uid === currentUserId);
  const member = Array.isArray(members)
    ? members.find((m) => m && (m.uid === uid || m.id === uid))
    : null;

  if (isCurrentUser) {
    return {
      uid,
      isCurrentUser: true,
      name: 'You',
      avatar: member?.avatar || member?.photoURL || '',
      role: member?.role || member?.workspaceRole || 'member',
    };
  }

  const canonicalName = member ? resolveMemberDisplayName(member) : 'Unknown member';

  return {
    uid,
    isCurrentUser: false,
    name: canonicalName,
    avatar: member?.avatar || member?.photoURL || '',
    role: member?.role || member?.workspaceRole || 'member',
  };
}

