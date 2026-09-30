import { ref, push, set, query, orderByKey, limitToLast } from 'firebase/database';
import { rtdb } from '../config/firebase';
import { rtdbService } from './rtdbService';
import {
  getUserNotificationsRootPath,
  getUserNotificationsPath,
} from '../constants/databasePaths';
import {
  NOTIFICATION_TYPES,
  createCanonicalNotification,
} from '../constants/notificationConstants';

/**
 * Convia Phase 7: Authoritative Client-Side Notification Service.
 *
 * Responsibilities:
 * - Real-time listener for current user's in-app notification feed.
 * - Read state management (mark one as read, mark all as read).
 * - Client-side event dispatching for workspace notifications.
 * - Idempotent deduplication to prevent duplicate notifications from listener or network retries.
 */
export const inAppNotificationService = {
  /**
   * Subscribes to real-time notification feed for a user.
   *
   * @param {string} userId - Current user Auth UID
   * @param {Function} callback - Callback receiving { notifications, unreadCount }
   * @returns {Function} Unsubscribe cleaner
   */
  subscribeToUserNotifications: (userId, callback, errorCallback) => {
    if (!userId) {
      if (typeof callback === 'function') callback({ notifications: [], unreadCount: 0 });
      return () => {};
    }

    const notifRoot = getUserNotificationsRootPath(userId);

    return rtdbService.subscribeRtdbOnly(notifRoot, (rawVal, error) => {
      if (error) {
        console.warn(`[inAppNotificationService] RTDB subscription error for ${userId}:`, error?.message || error);
        if (typeof errorCallback === 'function') errorCallback(error);
        return;
      }

      if (!rawVal || typeof rawVal !== 'object') {
        if (typeof callback === 'function') callback({ notifications: [], unreadCount: 0 });
        return;
      }

      // Transform and sort by createdAt descending
      const list = Object.entries(rawVal)
        .map(([key, item]) => {
          if (!item || typeof item !== 'object') return null;
          return {
            ...item,
            id: item.id || item.notificationId || key,
            notificationId: item.notificationId || key,
          };
        })
        .filter(Boolean)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      const unreadCount = list.filter((n) => !n.read).length;
      if (typeof callback === 'function') {
        callback({ notifications: list, unreadCount });
      }
    });
  },

  /**
   * Marks a single notification as read.
   *
   * @param {string} userId - Current user Auth UID
   * @param {string} notificationId - Notification ID
   */
  markNotificationAsRead: async (userId, notificationId) => {
    if (!userId || !notificationId) return;
    try {
      const notifPath = getUserNotificationsPath(userId, notificationId);
      await rtdbService.updateRtdbOnly(notifPath, {
        read: true,
        readAt: Date.now(),
      });
    } catch (e) {
      console.warn('[inAppNotificationService] markNotificationAsRead error:', e.message);
    }
  },

  /**
   * Marks all unread notifications as read atomically.
   *
   * @param {string} userId - Current user Auth UID
   * @param {Array<Object>} notifications - Current notifications list
   */
  markAllNotificationsAsRead: async (userId, notifications = []) => {
    if (!userId || !Array.isArray(notifications) || notifications.length === 0) return;
    try {
      const updates = {};
      const now = Date.now();

      notifications.forEach((n) => {
        if (n && !n.read && n.notificationId) {
          updates[`${n.notificationId}/read`] = true;
          updates[`${n.notificationId}/readAt`] = now;
        }
      });

      if (Object.keys(updates).length > 0) {
        const notifRoot = getUserNotificationsRootPath(userId);
        await rtdbService.updateRtdbOnly(notifRoot, updates);
      }
    } catch (e) {
      console.warn('[inAppNotificationService] markAllNotificationsAsRead error:', e.message);
    }
  },

  /**
   * Marks a single notification as unread.
   *
   * @param {string} userId - Current user Auth UID
   * @param {string} notificationId - Notification ID
   */
  markNotificationAsUnread: async (userId, notificationId) => {
    if (!userId || !notificationId) return;
    try {
      const notifPath = getUserNotificationsPath(userId, notificationId);
      await rtdbService.updateRtdbOnly(notifPath, {
        read: false,
        readAt: null,
      });
    } catch (e) {
      console.warn('[inAppNotificationService] markNotificationAsUnread error:', e.message);
    }
  },

  /**
   * One-shot fetch for user notifications with pagination support.
   *
   * @param {string} userId - Current user Auth UID
   * @param {Object} [options]
   * @param {number} [options.limit=50] - Maximum items to retrieve
   * @param {number|null} [options.beforeTimestamp=null] - Pagination cursor
   * @param {boolean} [options.unreadOnly=false] - Filter unread items only
   * @returns {Promise<Array<Object>>}
   */
  fetchNotifications: async (userId, options = {}) => {
    if (!userId) return [];
    try {
      const limit = Math.max(1, Math.min(100, Number(options.limit) || 50));
      const beforeTimestamp = options.beforeTimestamp ? Number(options.beforeTimestamp) : null;
      const unreadOnly = Boolean(options.unreadOnly);

      const notifRoot = getUserNotificationsRootPath(userId);
      const rawVal = await rtdbService.getRtdbOnly(notifRoot);
      if (!rawVal || typeof rawVal !== 'object') return [];

      let list = Object.entries(rawVal)
        .map(([key, item]) => {
          if (!item || typeof item !== 'object') return null;
          return {
            ...item,
            id: item.id || item.notificationId || key,
            notificationId: item.notificationId || key,
          };
        })
        .filter(Boolean);

      if (unreadOnly) {
        list = list.filter((n) => !n.read);
      }

      if (beforeTimestamp) {
        list = list.filter((n) => (n.createdAt || 0) < beforeTimestamp);
      }

      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      return list.slice(0, limit);
    } catch (e) {
      console.warn('[inAppNotificationService] fetchNotifications error:', e.message);
      return [];
    }
  },

  /**
   * Fetches unread notification count for a user without downloading unbounded records.
   *
   * @param {string} userId - Current user Auth UID
   * @returns {Promise<number>}
   */
  fetchUnreadCount: async (userId) => {
    if (!userId) return 0;
    try {
      const notifRoot = getUserNotificationsRootPath(userId);
      const rawVal = await rtdbService.getRtdbOnly(notifRoot);
      if (!rawVal || typeof rawVal !== 'object') return 0;

      let count = 0;
      for (const item of Object.values(rawVal)) {
        if (item && typeof item === 'object' && !item.read) {
          count++;
        }
      }
      return count;
    } catch (e) {
      console.warn('[inAppNotificationService] fetchUnreadCount error:', e.message);
      return 0;
    }
  },

  /**
   * Dispatches a single persistent notification to a recipient's inbox.
   */
  createNotification: async (recipientUid, payload) => {
    if (!recipientUid || !payload) return null;

    // Suppress self-notification by default if actor matches recipient
    const actorUid = payload.actorId || payload.senderId;
    if (actorUid && actorUid !== 'system' && actorUid === recipientUid && !payload.allowSelfNotification) {
      return null;
    }

    try {
      const notifRoot = getUserNotificationsRootPath(recipientUid);
      const notifId = payload.notificationId || (payload.dedupeKey
        ? `notif_${String(payload.dedupeKey).replace(/[^a-zA-Z0-9_-]/g, '_')}`
        : push(ref(rtdb, notifRoot)).key);

      const effectiveSenderId = payload.senderId || payload.actorId;
      const canonical = createCanonicalNotification({
        ...payload,
        notificationId: notifId,
        recipientId: recipientUid,
        senderId: effectiveSenderId,
        actorId: effectiveSenderId,
      });

      const notifRef = ref(rtdb, getUserNotificationsPath(recipientUid, notifId));
      await set(notifRef, canonical);
      return canonical;
    } catch (err) {
      console.warn(`[inAppNotificationService] createNotification to ${recipientUid} failed:`, err.message);
      return null;
    }
  },

  /**
   * Bulk creates notifications across multiple recipients using per-recipient writes.
   */
  createNotificationsForRecipients: async (recipientUids = [], payload = {}) => {
    const validUids = Array.from(new Set((recipientUids || []).filter(Boolean)));
    if (validUids.length === 0) return [];

    try {
      const timestamp = Date.now();
      const createdList = [];
      const baseDedupe = payload.notificationId || (payload.dedupeKey
        ? `notif_${String(payload.dedupeKey).replace(/[^a-zA-Z0-9_-]/g, '_')}`
        : null);

      const effectiveSenderId = payload.senderId || payload.actorId;

      const setPromises = validUids.map(async (uid) => {
        const notifRoot = getUserNotificationsRootPath(uid);
        const notifId = baseDedupe
          ? `${baseDedupe}_${uid.replace(/[^a-zA-Z0-9_-]/g, '_')}`
          : push(ref(rtdb, notifRoot)).key;

        const canonical = createCanonicalNotification({
          ...payload,
          senderId: effectiveSenderId,
          actorId: effectiveSenderId,
          notificationId: notifId,
          recipientId: uid,
          createdAt: timestamp,
        });

        const notifRef = ref(rtdb, getUserNotificationsPath(uid, notifId));
        await set(notifRef, canonical);
        return canonical;
      });

      const settled = await Promise.allSettled(setPromises);
      for (const res of settled) {
        if (res.status === 'fulfilled' && res.value) {
          createdList.push(res.value);
        } else if (res.status === 'rejected') {
          console.warn('[inAppNotificationService] Single recipient write error:', res.reason?.message);
        }
      }

      return createdList;
    } catch (err) {
      console.warn('[inAppNotificationService] Bulk notification error:', err.message);
      return [];
    }
  },

  /**
   * Resolves members of a workspace, strictly excluding the actor.
   */
  resolveWorkspaceRecipients: async (workspaceId, actorUid = null, existingMembers = null) => {
    if (!workspaceId) return [];

    try {
      const memberUids = new Set();

      if (Array.isArray(existingMembers) && existingMembers.length > 0) {
        existingMembers.forEach((m) => {
          if (m?.uid && m.status !== 'removed' && m.status !== 'inactive' && !m.isDeleted) {
            memberUids.add(m.uid);
          }
        });
      }

      if (memberUids.size <= 1) {
        const [orgMembers, orgDoc, wsDoc] = await Promise.all([
          rtdbService.getRtdbOnly(`organization_members/${workspaceId}`).catch(() => null),
          rtdbService.getRtdbOnly(`organizations/${workspaceId}`).catch(() => null),
          rtdbService.getRtdbOnly(`workspaces/${workspaceId}`).catch(() => null),
        ]);

        if (orgMembers && typeof orgMembers === 'object') {
          Object.entries(orgMembers).forEach(([uid, val]) => {
            if (!val || typeof val !== 'object') {
              memberUids.add(uid);
            } else if (val.status !== 'removed' && val.status !== 'inactive' && !val.isDeleted) {
              memberUids.add(val.uid || uid);
            }
          });
        }
        if (orgDoc && typeof orgDoc === 'object') {
          if (orgDoc.ownerId) memberUids.add(orgDoc.ownerId);
          if (orgDoc.createdBy) memberUids.add(orgDoc.createdBy);
          if (orgDoc.members && typeof orgDoc.members === 'object') {
            Object.keys(orgDoc.members).forEach((uid) => memberUids.add(uid));
          }
        }
        if (wsDoc && typeof wsDoc === 'object') {
          if (wsDoc.ownerId) memberUids.add(wsDoc.ownerId);
          if (wsDoc.createdBy) memberUids.add(wsDoc.createdBy);
          if (wsDoc.members && typeof wsDoc.members === 'object') {
            Object.keys(wsDoc.members).forEach((uid) => memberUids.add(uid));
          }
        }
      }

      if (actorUid) {
        memberUids.delete(String(actorUid).trim());
      }

      return Array.from(memberUids);
    } catch (e) {
      console.warn(`[inAppNotificationService] resolveWorkspaceRecipients error for ${workspaceId}:`, e.message);
      return [];
    }
  },

  /**
   * Dispatches high-level workspace notifications from frontend actions.
   */
  dispatchNotificationEvent: async (eventType, eventData, actorUser = null) => {
    if (!eventType || !eventData) return [];

    const actorUid = actorUser?.uid || eventData.actorId || eventData.senderId;
    const actorName = actorUser?.displayName || actorUser?.name || eventData.actorName || 'Member';
    const actorAvatar = actorUser?.photoURL || actorUser?.avatar || eventData.actorAvatar || '';

    try {
      switch (eventType) {
        case NOTIFICATION_TYPES.BLUEPRINT_COMPLETED: {
          const { workspaceId, version, ideaTitle, mvpIdeaId, recipients: customRecipients } = eventData;
          let allRecipients = customRecipients;
          if (!Array.isArray(allRecipients) || allRecipients.length === 0) {
            const recipients = await inAppNotificationService.resolveWorkspaceRecipients(workspaceId, actorUid);
            allRecipients = Array.from(new Set([...recipients, actorUid].filter(Boolean)));
          }

          const resolvedResourceId = eventData.resourceId || (mvpIdeaId ? `bp_${workspaceId}_${mvpIdeaId}` : `bp_${workspaceId}`);

          return await inAppNotificationService.createNotificationsForRecipients(allRecipients, {
            type: NOTIFICATION_TYPES.BLUEPRINT_COMPLETED,
            workspaceId,
            orgId: workspaceId,
            title: `Blueprint v${version || '1.0'} Completed`,
            body: `AI Architecture Blueprint for "${ideaTitle || 'Workspace MVP'}" is ready for review.`,
            actorId: actorUid,
            senderId: actorUid,
            actorName: 'Convia AI Engine',
            resourceType: 'blueprint',
            resourceId: resolvedResourceId,
            actionUrl: `/workspaces/${workspaceId}/blueprint`,
            allowSelfNotification: true,
            metadata: { version, workspaceId, mvpIdeaId: mvpIdeaId || null },
          });
        }

        case NOTIFICATION_TYPES.BLUEPRINT_FAILED: {
          const { workspaceId, ideaTitle, errorReason } = eventData;
          const targetUid = actorUid || eventData.recipientId;
          if (!targetUid || targetUid === 'system') return [];

          const notif = await inAppNotificationService.createNotification(targetUid, {
            type: NOTIFICATION_TYPES.BLUEPRINT_FAILED,
            workspaceId,
            orgId: workspaceId,
            title: 'Blueprint Generation Notice',
            body: `Generation for "${ideaTitle || 'Workspace MVP'}" could not be completed: ${errorReason || 'Please try again.'}`,
            actorId: actorUid || 'system',
            actorName: 'Convia AI Engine',
            resourceType: 'blueprint',
            resourceId: `bp_${workspaceId}`,
            actionUrl: `/workspaces/${workspaceId}/blueprint`,
            metadata: { workspaceId, errorReason },
          });
          return notif ? [notif] : [];
        }

        case NOTIFICATION_TYPES.BLUEPRINT_VERSION_APPROVED: {
          const { workspaceId, version, ideaTitle } = eventData;
          const recipients = await inAppNotificationService.resolveWorkspaceRecipients(workspaceId, actorUid);

          return await inAppNotificationService.createNotificationsForRecipients(recipients, {
            type: NOTIFICATION_TYPES.BLUEPRINT_VERSION_APPROVED,
            workspaceId,
            orgId: workspaceId,
            title: `Blueprint v${version || '1.0'} Approved`,
            body: `${actorName} approved Blueprint v${version || '1.0'}${ideaTitle ? ` for "${ideaTitle}"` : ''}.`,
            actorId: actorUid,
            actorName,
            actorAvatar,
            resourceType: 'blueprint',
            resourceId: `bp_${workspaceId}`,
            actionUrl: `/workspaces/${workspaceId}/blueprint`,
            metadata: { version, workspaceId },
          });
        }

        case NOTIFICATION_TYPES.WORKSPACE_MEMBER_JOINED: {
          const { workspaceId, orgName, members } = eventData;
          const recipients = await inAppNotificationService.resolveWorkspaceRecipients(workspaceId, actorUid, members);

          return await inAppNotificationService.createNotificationsForRecipients(recipients, {
            type: NOTIFICATION_TYPES.WORKSPACE_MEMBER_JOINED,
            workspaceId,
            orgId: workspaceId,
            title: 'New Member Joined',
            body: `${actorName} joined ${orgName || 'the workspace team'}.`,
            actorId: actorUid,
            actorName,
            actorAvatar,
            resourceType: 'workspace',
            resourceId: workspaceId,
            actionUrl: `/workspaces/${workspaceId}/members`,
            metadata: { workspaceId },
          });
        }

        case NOTIFICATION_TYPES.WORKSPACE_MEMBER_LEFT: {
          const { workspaceId, orgName, members } = eventData;
          const recipients = await inAppNotificationService.resolveWorkspaceRecipients(workspaceId, actorUid, members);

          return await inAppNotificationService.createNotificationsForRecipients(recipients, {
            type: NOTIFICATION_TYPES.WORKSPACE_MEMBER_LEFT,
            workspaceId,
            orgId: workspaceId,
            title: 'Member Left Workspace',
            body: `${actorName} has left ${orgName || 'the workspace'}.`,
            actorId: actorUid,
            actorName,
            actorAvatar,
            resourceType: 'workspace',
            resourceId: workspaceId,
            actionUrl: `/workspaces/${workspaceId}/members`,
            metadata: { workspaceId },
          });
        }

        case NOTIFICATION_TYPES.IDEA_CREATED: {
          const { workspaceId, ideaId, title, members } = eventData;
          const recipients = await inAppNotificationService.resolveWorkspaceRecipients(workspaceId, actorUid, members);

          return await inAppNotificationService.createNotificationsForRecipients(recipients, {
            type: NOTIFICATION_TYPES.IDEA_CREATED,
            workspaceId,
            orgId: workspaceId,
            title: 'New Proposal Posted',
            body: `${actorName} submitted proposal "${title || 'Untitled'}".`,
            actorId: actorUid,
            actorName,
            actorAvatar,
            resourceType: 'idea',
            resourceId: ideaId,
            actionUrl: `/workspaces/${workspaceId}/ideas/${ideaId}`,
            metadata: { ideaId, workspaceId },
          });
        }

        case NOTIFICATION_TYPES.IDEA_SUGGESTION_CREATED: {
          const { workspaceId, ideaId, ideaAuthorId, suggestionSnippet, discussionId } = eventData;
          if (!ideaAuthorId || ideaAuthorId === actorUid) return [];

          const notif = await inAppNotificationService.createNotification(ideaAuthorId, {
            type: NOTIFICATION_TYPES.IDEA_SUGGESTION_CREATED,
            workspaceId,
            orgId: workspaceId,
            title: 'New Suggestion on your Proposal',
            body: `${actorName} suggested: "${(suggestionSnippet || '').substring(0, 100)}"`,
            actorId: actorUid,
            actorName,
            actorAvatar,
            resourceType: 'suggestion',
            resourceId: discussionId || ideaId,
            actionUrl: workspaceId
              ? `/workspaces/${workspaceId}/ideas/${ideaId}?tab=suggestions&discussionId=${discussionId}`
              : `/explore?ideaId=${ideaId}&tab=suggestions`,
            metadata: { ideaId, discussionId, workspaceId },
          });
          return notif ? [notif] : [];
        }

        case NOTIFICATION_TYPES.COMMENT_CREATED: {
          const { workspaceId, ideaId, targetAuthorId, commentSnippet, discussionId, isReply } = eventData;
          if (!targetAuthorId || targetAuthorId === actorUid) return [];

          const notif = await inAppNotificationService.createNotification(targetAuthorId, {
            type: NOTIFICATION_TYPES.COMMENT_CREATED,
            workspaceId,
            orgId: workspaceId,
            title: isReply ? 'New Reply to your Discussion' : 'New Comment on your Proposal',
            body: `${actorName}: "${(commentSnippet || '').substring(0, 100)}"`,
            actorId: actorUid,
            actorName,
            actorAvatar,
            resourceType: 'comment',
            resourceId: discussionId || ideaId,
            actionUrl: workspaceId
              ? `/workspaces/${workspaceId}/ideas/${ideaId}?tab=comments&discussionId=${discussionId}`
              : `/explore?ideaId=${ideaId}&tab=comments`,
            metadata: { ideaId, discussionId, workspaceId, isReply },
          });
          return notif ? [notif] : [];
        }

        case NOTIFICATION_TYPES.QUESTION_CREATED: {
          const { workspaceId, ideaId, targetAuthorId, questionSnippet, discussionId, isAnswer } = eventData;
          if (!targetAuthorId || targetAuthorId === actorUid) return [];

          const notif = await inAppNotificationService.createNotification(targetAuthorId, {
            type: NOTIFICATION_TYPES.QUESTION_CREATED,
            workspaceId,
            orgId: workspaceId,
            title: isAnswer ? 'Answer to your Question' : 'Question asked on your Proposal',
            body: `${actorName}: "${(questionSnippet || '').substring(0, 100)}"`,
            actorId: actorUid,
            actorName,
            actorAvatar,
            resourceType: 'question',
            resourceId: discussionId || ideaId,
            actionUrl: workspaceId
              ? `/workspaces/${workspaceId}/ideas/${ideaId}?tab=questions&discussionId=${discussionId}`
              : `/explore?ideaId=${ideaId}&tab=questions`,
            metadata: { ideaId, discussionId, workspaceId, isAnswer },
          });
          return notif ? [notif] : [];
        }

        case NOTIFICATION_TYPES.CHAT_MESSAGE: {
          const { workspaceId, channelId = 'general', messageId, content, recipients = [], members = null, excludedUids = [] } = eventData;
          if (!workspaceId || !messageId) return [];

          let targetRecipients = recipients;
          if (!Array.isArray(targetRecipients) || targetRecipients.length === 0) {
            targetRecipients = await inAppNotificationService.resolveWorkspaceRecipients(workspaceId, actorUid, members);
          }

          // Strictly exclude actor and any users who received a mention notification
          const excludeSet = new Set([actorUid, ...(excludedUids || [])].filter(Boolean));
          const finalRecipients = targetRecipients.filter((uid) => !excludeSet.has(uid));
          if (finalRecipients.length === 0) return [];

          const activeChannel = (channelId || 'general').trim();
          const preview = (content || '').substring(0, 100);

          return await inAppNotificationService.createNotificationsForRecipients(finalRecipients, {
            type: NOTIFICATION_TYPES.CHAT_MESSAGE,
            workspaceId,
            orgId: workspaceId,
            channelId: activeChannel,
            title: `New message in #${activeChannel}`,
            body: `${actorName}: ${preview}`,
            previewText: content,
            actorId: actorUid,
            senderId: actorUid,
            actorName,
            senderName: actorName,
            actorAvatar,
            senderAvatar: actorAvatar,
            resourceType: 'chat_message',
            resourceId: messageId,
            actionUrl: `/workspaces/${workspaceId}/chat?channel=${activeChannel}&messageId=${messageId}`,
            metadata: { channelId: activeChannel, messageId, workspaceId },
            dedupeKey: `chat_msg_${workspaceId}_${activeChannel}_${messageId}_${actorUid}`,
          });
        }

        case NOTIFICATION_TYPES.CHAT_MENTION:
        case NOTIFICATION_TYPES.MENTION: {
          const { workspaceId, channelId = 'general', messageId, content, mentionedUids = [], parentMessageId = null } = eventData;
          if (!workspaceId || !messageId) return [];

          const validMentioned = Array.from(new Set(
            (mentionedUids || [])
              .filter((uid) => uid && uid !== actorUid)
              .map((uid) => String(uid).trim())
          ));
          if (validMentioned.length === 0) return [];

          const activeChannel = (channelId || 'general').trim();
          const preview = (content || '').substring(0, 100);
          const isCommunity = workspaceId === 'community' || workspaceId === 'public';
          const deepLink = isCommunity
            ? (parentMessageId
                ? `/community?threadId=${parentMessageId}&replyId=${messageId}`
                : `/community?messageId=${messageId}`)
            : (parentMessageId
                ? `/workspaces/${workspaceId}/chat?channel=${activeChannel}&threadId=${parentMessageId}&replyId=${messageId}`
                : `/workspaces/${workspaceId}/chat?channel=${activeChannel}&messageId=${messageId}`);

          return await inAppNotificationService.createNotificationsForRecipients(validMentioned, {
            type: NOTIFICATION_TYPES.CHAT_MENTION,
            workspaceId,
            orgId: workspaceId,
            channelId: activeChannel,
            title: isCommunity
              ? `${actorName} mentioned you in the Community Hub`
              : `${actorName} mentioned you in #${activeChannel}`,
            body: `${actorName}: ${preview}`,
            previewText: content,
            actorId: actorUid,
            senderId: actorUid,
            actorName,
            senderName: actorName,
            actorAvatar,
            senderAvatar: actorAvatar,
            resourceType: 'chat_mention',
            resourceId: messageId,
            secondaryEntityId: parentMessageId || null,
            actionUrl: deepLink,
            metadata: { channelId: activeChannel, messageId, parentMessageId, workspaceId },
            dedupeKey: `chat_mention_${workspaceId}_${activeChannel}_${messageId}_${actorUid}`,
          });
        }

        case NOTIFICATION_TYPES.MESSAGE_REPLY:
        case NOTIFICATION_TYPES.CHAT_REPLY: {
          const { workspaceId, channelId = 'general', parentMessageId, replyId, content, parentAuthorId, recipients = [] } = eventData;
          if (!workspaceId || !parentMessageId || !replyId) return [];

          let targetRecipients = recipients;
          if (!Array.isArray(targetRecipients) || targetRecipients.length === 0) {
            targetRecipients = parentAuthorId ? [parentAuthorId] : [];
          }

          const validRecipients = Array.from(new Set(
            targetRecipients
              .filter((uid) => uid && uid !== actorUid)
              .map((uid) => String(uid).trim())
          ));
          if (validRecipients.length === 0) return [];

          const activeChannel = (channelId || 'general').trim();
          const preview = (content || '').substring(0, 100);
          const isCommunityReply = workspaceId === 'community' || workspaceId === 'public';
          const deepLink = isCommunityReply
            ? `/community?threadId=${parentMessageId}&replyId=${replyId}`
            : `/workspaces/${workspaceId}/chat?channel=${activeChannel}&threadId=${parentMessageId}&replyId=${replyId}`;

          return await inAppNotificationService.createNotificationsForRecipients(validRecipients, {
            type: NOTIFICATION_TYPES.MESSAGE_REPLY,
            workspaceId,
            orgId: workspaceId,
            channelId: activeChannel,
            title: isCommunityReply
              ? `${actorName} replied to your community discussion`
              : `${actorName} replied to your message`,
            body: `${actorName}: ${preview}`,
            previewText: content,
            actorId: actorUid,
            senderId: actorUid,
            actorName,
            senderName: actorName,
            actorAvatar,
            senderAvatar: actorAvatar,
            resourceType: 'chat_reply',
            resourceId: replyId,
            secondaryEntityId: parentMessageId,
            actionUrl: deepLink,
            metadata: { channelId: activeChannel, parentMessageId, replyId, workspaceId },
            dedupeKey: `chat_reply_${workspaceId}_${activeChannel}_${parentMessageId}_${replyId}_${actorUid}`,
          });
        }

        case NOTIFICATION_TYPES.CHAT_REACTION:
        case NOTIFICATION_TYPES.MESSAGE_REACTION: {
          const { workspaceId, channelId = 'general', messageId, emoji, recipientId, content } = eventData;
          if (!workspaceId || !messageId || !recipientId || recipientId === actorUid) return [];

          const activeChannel = (channelId || 'general').trim();
          const preview = (content || '').substring(0, 100);
          const deepLink = `/workspaces/${workspaceId}/chat?channel=${activeChannel}&messageId=${messageId}`;

          const notif = await inAppNotificationService.createNotification(recipientId, {
            type: NOTIFICATION_TYPES.CHAT_REACTION,
            workspaceId,
            orgId: workspaceId,
            channelId: activeChannel,
            title: `${actorName} reacted ${emoji || '👍'} to your message`,
            body: preview ? `"${preview}"` : `${actorName} reacted to your message in #${activeChannel}.`,
            previewText: preview,
            actorId: actorUid,
            senderId: actorUid,
            actorName,
            senderName: actorName,
            actorAvatar,
            senderAvatar: actorAvatar,
            resourceType: 'chat_message',
            resourceId: messageId,
            actionUrl: deepLink,
            metadata: { channelId: activeChannel, messageId, emoji, workspaceId },
            dedupeKey: `chat_react_${workspaceId}_${activeChannel}_${messageId}_${actorUid}_${emoji}`,
          });

          return notif ? [notif] : [];
        }

        default:
          return [];
      }
    } catch (e) {
      console.warn('[inAppNotificationService] dispatchNotificationEvent warning:', e.message);
      return [];
    }
  },
};
