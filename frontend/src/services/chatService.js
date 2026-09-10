import {
  ref,
  push,
  set,
  get,
  remove,
  onDisconnect,
  query,
  orderByKey,
  limitToLast,
  endBefore,
  onChildAdded,
  onChildChanged,
  onChildRemoved,
  onValue,
  serverTimestamp,
} from 'firebase/database';
import { rtdb } from '../config/firebase';
import { rtdbService } from './rtdbService';
import { inAppNotificationService } from './inAppNotificationService';
import { uploadthingService } from './uploadthingService';
import {
  getChannelPath,
  getChannelMessagesPath,
  getMessagePath,
  getChannelMetadataPath,
  getMessageRepliesPath,
  getMessageRepliesRootPath,
  getMessageReplyPath,
  getMessageReactionsPath,
  getMessageReactionsRootPath,
  getMessageReactionPath,
  getChannelReadStatePath,
  getChannelReadStateRootPath,
  getUserNotificationsPath,
  getUserNotificationsRootPath,
  getChannelTypingPath,
  getChannelTypingRootPath,
  getThreadTypingPath,
  getThreadTypingRootPath,
  getWorkspaceChannelsRootPath,
  getPublicIdeasChatRootPath,
  getPublicIdeasChatMessagesPath,
  getPublicIdeasChatMessagePath,
  getPublicIdeasChatTypingRootPath,
  getPublicIdeasChatTypingPath,
} from '../constants/databasePaths.js';
import {
  DEFAULT_CHAT_CHANNEL_ID,
  CHAT_PAGE_SIZE,
  createCanonicalMessage,
  createCanonicalSystemMessage,
  createCanonicalReply,
  createCanonicalReadState,
  createCanonicalChatNotification,
  createCanonicalTypingState,
  createCanonicalChannelMetadata,
  CHANNEL_TYPES,
  normalizeChannelSlug,
  validateChannelSlug,
  CHAT_NOTIFICATION_TYPES,
  SUPPORTED_REACTIONS,
  isValidReactionEmoji,
} from '../constants/chatSchema.js';
import {
  validateSendMessage,
  validateEditMessage,
  validateDeleteMessage,
  validateSystemEvent,
  normalizeChatMessage,
  validateSendReply,
  validateEditReply,
  validateDeleteReply,
  validateReactionToggle,
  normalizeChatReply,
} from '../utils/chatValidation.js';
import {
  compareMessages,
  upsertMessage,
  prependOlderMessages,
  removeMessageById,
  calculatePaginationMetadata,
} from '../utils/chatPagination.js';
import { resolveMemberDisplayName } from '../utils/memberIdentity.js';
import { extractMentions } from '../utils/chatMentions.js';
import { NotificationService } from './notificationService.js';
import { NOTIFICATION_TYPES } from '../constants/notificationConstants.js';

/**
 * Workspace Chat Service (Phase 3 Incremental Real-Time & Pagination Engine)
 * Authoritative Firebase Realtime Database Service Layer for Workspace Messaging.
 * Schema: /workspaceChats/{workspaceId}/channels/{channelId}/messages/{messageId}
 */
export const chatService = {
  /**
   * Send a member message to a workspace channel (Default: 'general').
   * Supports optional UploadThing attachment object.
   */
  sendMessage: async (workspaceId, channelId = DEFAULT_CHAT_CHANNEL_ID, content, user, attachment = null, members = []) => {
    // 1. Centralized Contract Validation
    const validation = validateSendMessage({
      workspaceId,
      channelId,
      content,
      user,
      attachment,
    });

    const activeChannelId = (channelId || DEFAULT_CHAT_CHANNEL_ID).trim();
    const messagesPath = getChannelMessagesPath(workspaceId, activeChannelId);
    const messagesRef = ref(rtdb, messagesPath);
    const newMsgRef = push(messagesRef);
    const messageId = newMsgRef.key;

    const senderName = resolveMemberDisplayName(user);
    const senderAvatar = user.photoURL || user.avatar || user.userProfile?.avatar || '';

    // 2. Construct Canonical Message Object
    const messageData = createCanonicalMessage({
      messageId,
      senderId: user.uid,
      senderName,
      senderAvatar,
      content: validation.trimmedContent,
      createdAt: Date.now(),
      attachment: validation.sanitizedAttachment,
    });

    // 3. Authoritative RTDB Message Persistence (Direct RTDB write)
    await set(newMsgRef, messageData);

    // 4. Update Derived Channel Metadata (RTDB-only, non-blocking)
    const metaPath = getChannelMetadataPath(workspaceId, activeChannelId);
    const previewText = validation.sanitizedAttachment
      ? `📎 ${validation.sanitizedAttachment.fileName}`
      : validation.trimmedContent.substring(0, 100);

    await rtdbService.updateRtdbOnly(metaPath, {
      lastMessageAt: messageData.createdAt,
      lastMessageContent: previewText,
      lastSenderName: senderName,
    }).catch((err) => console.warn('[chatService] Metadata update warning:', err));

    // 5. Phase 7B-1: Dispatch Persistent Notifications (Mentions & Channel Message)
    try {
      const mentions = Array.isArray(members) && members.length > 0
        ? extractMentions(validation.trimmedContent, members)
        : [];
      const mentionedUids = mentions
        .map((m) => m.uid)
        .filter((uid) => uid && uid !== user.uid);

      if (mentionedUids.length > 0) {
        inAppNotificationService.dispatchNotificationEvent(
          NOTIFICATION_TYPES.CHAT_MENTION,
          {
            workspaceId,
            channelId: activeChannelId,
            messageId,
            content: validation.trimmedContent,
            mentionedUids,
          },
          user
        ).catch((e) => console.warn('[chatService] Mention notification warning:', e));
      }

      inAppNotificationService.dispatchNotificationEvent(
        NOTIFICATION_TYPES.CHAT_MESSAGE,
        {
          workspaceId,
          channelId: activeChannelId,
          messageId,
          content: validation.trimmedContent,
          members,
          excludedUids: mentionedUids,
        },
        user
      ).catch((e) => console.warn('[chatService] Message notification warning:', e));
    } catch (notifErr) {
      console.warn('[chatService] Notification dispatch error:', notifErr.message);
    }

    return messageData;
  },

  /**
   * Send an automated system event message.
   */
  sendSystemEvent: async (workspaceId, channelId = DEFAULT_CHAT_CHANNEL_ID, text, systemType = 'system') => {
    try {
      const validation = validateSystemEvent({
        workspaceId,
        channelId,
        text,
        systemType,
      });

      const activeChannelId = (channelId || DEFAULT_CHAT_CHANNEL_ID).trim();
      const messagesPath = getChannelMessagesPath(workspaceId, activeChannelId);
      const messagesRef = ref(rtdb, messagesPath);
      const newMsgRef = push(messagesRef);
      const messageId = newMsgRef.key;

      const systemData = createCanonicalSystemMessage({
        messageId,
        content: validation.trimmedText,
        systemType: validation.sanitizedType,
        createdAt: Date.now(),
      });

      await set(newMsgRef, systemData);

      // Update derived metadata (RTDB-only)
      const metaPath = getChannelMetadataPath(workspaceId, activeChannelId);
      await rtdbService.updateRtdbOnly(metaPath, {
        lastMessageAt: systemData.createdAt,
        lastMessageContent: validation.trimmedText.substring(0, 100),
        lastSenderName: 'System',
      }).catch(() => {});

      return systemData;
    } catch (err) {
      console.warn('[chatService] Failed to send system event:', err.message);
    }
  },

  /**
   * One-shot lookup of a single message by ID.
   *
   * @param {string} workspaceId - Workspace ID
   * @param {string} [channelId='general'] - Channel ID
   * @param {string} messageId - Message ID
   * @returns {Promise<Object|null>} Normalized message or null
   */
  getMessage: async (workspaceId, channelId = DEFAULT_CHAT_CHANNEL_ID, messageId) => {
    if (!workspaceId || !messageId) return null;
    try {
      const activeChannelId = (channelId || DEFAULT_CHAT_CHANNEL_ID).trim();
      const msgPath = getMessagePath(workspaceId, activeChannelId, messageId);
      const snap = await rtdbService.getRtdbOnly(msgPath).catch(() => null);
      if (!snap || typeof snap !== 'object') return null;
      return normalizeChatMessage(snap, messageId);
    } catch (e) {
      console.warn('[chatService] getMessage error:', e.message);
      return null;
    }
  },

  /**
   * Load the initial bounded window of recent messages.
   *
   * @param {string} workspaceId - Workspace ID
   * @param {string} [channelId='general'] - Channel ID
   * @param {number} [pageSize=CHAT_PAGE_SIZE] - Number of messages to retrieve (Default: 50)
   * @returns {Promise<{ messages: Array<Object>, hasMore: boolean, oldestKey: string|null, newestKey: string|null, count: number }>}
   */
  loadRecentMessages: async (workspaceId, channelId = DEFAULT_CHAT_CHANNEL_ID, pageSize = CHAT_PAGE_SIZE) => {
    if (!workspaceId || typeof workspaceId !== 'string' || !workspaceId.trim()) {
      return { messages: [], hasMore: false, oldestKey: null, newestKey: null, count: 0 };
    }

    const activeChannelId = (channelId || DEFAULT_CHAT_CHANNEL_ID).trim();
    const messagesPath = getChannelMessagesPath(workspaceId, activeChannelId);
    const messagesRef = ref(rtdb, messagesPath);
    const recentQuery = query(messagesRef, orderByKey(), limitToLast(pageSize));

    const snapshot = await get(recentQuery);
    if (!snapshot.exists()) {
      return { messages: [], hasMore: false, oldestKey: null, newestKey: null, count: 0 };
    }

    const rawVal = snapshot.val();
    if (!rawVal || typeof rawVal !== 'object') {
      return { messages: [], hasMore: false, oldestKey: null, newestKey: null, count: 0 };
    }

    const messages = Object.entries(rawVal)
      .map(([key, raw]) => normalizeChatMessage(raw, key))
      .filter((msg) => msg && msg.messageId)
      .sort(compareMessages);

    const meta = calculatePaginationMetadata(messages, pageSize);
    return {
      messages,
      hasMore: meta.hasMore,
      oldestKey: meta.oldestKey,
      newestKey: meta.newestKey,
      count: meta.count,
    };
  },

  /**
   * Load older messages strictly before a target message key (Pagination).
   *
   * @param {string} workspaceId - Workspace ID
   * @param {string} [channelId='general'] - Channel ID
   * @param {string} beforeMessageId - Canonical RTDB push key cursor
   * @param {number} [pageSize=CHAT_PAGE_SIZE] - Number of older messages to retrieve (Default: 50)
   * @returns {Promise<{ messages: Array<Object>, hasMore: boolean, oldestKey: string|null, newestKey: string|null, count: number }>}
   */
  loadOlderMessages: async (workspaceId, channelId = DEFAULT_CHAT_CHANNEL_ID, beforeMessageId, pageSize = CHAT_PAGE_SIZE) => {
    if (
      !workspaceId ||
      typeof workspaceId !== 'string' ||
      !workspaceId.trim() ||
      !beforeMessageId ||
      typeof beforeMessageId !== 'string' ||
      !beforeMessageId.trim()
    ) {
      return { messages: [], hasMore: false, oldestKey: null, newestKey: null, count: 0 };
    }

    const activeChannelId = (channelId || DEFAULT_CHAT_CHANNEL_ID).trim();
    const cleanBeforeId = beforeMessageId.trim();
    const messagesPath = getChannelMessagesPath(workspaceId, activeChannelId);
    const messagesRef = ref(rtdb, messagesPath);
    const olderQuery = query(messagesRef, orderByKey(), endBefore(cleanBeforeId), limitToLast(pageSize));

    const snapshot = await get(olderQuery);
    if (!snapshot.exists()) {
      return { messages: [], hasMore: false, oldestKey: null, newestKey: null, count: 0 };
    }

    const rawVal = snapshot.val();
    if (!rawVal || typeof rawVal !== 'object') {
      return { messages: [], hasMore: false, oldestKey: null, newestKey: null, count: 0 };
    }

    const messages = Object.entries(rawVal)
      .map(([key, raw]) => normalizeChatMessage(raw, key))
      .filter((msg) => msg && msg.messageId)
      .sort(compareMessages);

    const meta = calculatePaginationMetadata(messages, pageSize);
    return {
      messages,
      hasMore: meta.hasMore,
      oldestKey: meta.oldestKey,
      newestKey: meta.newestKey,
      count: meta.count,
    };
  },

  /**
   * Subscribe to incremental real-time message additions, edits, and deletions.
   *
   * @param {string} workspaceId - Workspace ID
   * @param {string} [channelId='general'] - Channel ID
   * @param {Object} callbacks
   * @param {Function} [callbacks.onMessageAdded] - Fired on new message child addition
   * @param {Function} [callbacks.onMessageChanged] - Fired on message child modification (edit/soft-delete)
   * @param {Function} [callbacks.onMessageRemoved] - Fired on message child physical removal
   * @param {Function} [callbacks.onError] - Error callback
   * @returns {Function} Deterministic unsubscribe function
   */
  subscribeToLiveMessages: (workspaceId, channelId = DEFAULT_CHAT_CHANNEL_ID, callbacks = {}) => {
    if (!workspaceId || typeof workspaceId !== 'string' || !workspaceId.trim()) {
      return () => {};
    }

    const {
      onMessageAdded = () => {},
      onMessageChanged = () => {},
      onMessageRemoved = () => {},
      onError = () => {},
    } = callbacks;

    const activeChannelId = (channelId || DEFAULT_CHAT_CHANNEL_ID).trim();
    const messagesPath = getChannelMessagesPath(workspaceId, activeChannelId);
    const messagesRef = ref(rtdb, messagesPath);

    // Listen for child additions bounded to recent page window
    const addedQuery = query(messagesRef, orderByKey(), limitToLast(CHAT_PAGE_SIZE));

    const unsubAdded = onChildAdded(
      addedQuery,
      (snapshot) => {
        if (!snapshot.exists()) return;
        const normalized = normalizeChatMessage(snapshot.val(), snapshot.key);
        if (normalized) {
          onMessageAdded(normalized);
        }
      },
      (err) => {
        console.warn('[chatService] onChildAdded error:', err);
        onError(err);
      }
    );

    // Listen for incremental edits & soft deletions on channel messages
    const unsubChanged = onChildChanged(
      messagesRef,
      (snapshot) => {
        if (!snapshot.exists()) return;
        const normalized = normalizeChatMessage(snapshot.val(), snapshot.key);
        if (normalized) {
          onMessageChanged(normalized);
        }
      },
      (err) => {
        console.warn('[chatService] onChildChanged error:', err);
        onError(err);
      }
    );

    // Listen for physical child removals
    const unsubRemoved = onChildRemoved(
      messagesRef,
      (snapshot) => {
        if (!snapshot.key) return;
        onMessageRemoved(snapshot.key);
      },
      (err) => {
        console.warn('[chatService] onChildRemoved error:', err);
        onError(err);
      }
    );

    // Cleanup function that detaches all 3 listeners deterministically
    return () => {
      try {
        if (typeof unsubAdded === 'function') unsubAdded();
        if (typeof unsubChanged === 'function') unsubChanged();
        if (typeof unsubRemoved === 'function') unsubRemoved();
      } catch (e) {
        console.warn('[chatService] Listener detachment warning:', e);
      }
    };
  },

  /**
   * Backward-compatible integrated subscription.
   * Loads bounded recent messages and manages real-time incremental updates with deduplication.
   *
   * @param {string} workspaceId - Workspace ID
   * @param {string} [channelId='general'] - Channel ID
   * @param {Function} callback - Callback receiving (messagesArray, error)
   * @returns {Function} Unsubscribe function
   */
  subscribeToMessages: (workspaceId, channelId = DEFAULT_CHAT_CHANNEL_ID, callback) => {
    if (!workspaceId) {
      callback([], null);
      return () => {};
    }

    let localCache = [];
    let isMounted = true;

    const unsubLive = chatService.subscribeToLiveMessages(workspaceId, channelId, {
      onMessageAdded: (newMsg) => {
        if (!isMounted) return;
        localCache = upsertMessage(localCache, newMsg);
        callback([...localCache], null);
      },
      onMessageChanged: (changedMsg) => {
        if (!isMounted) return;
        localCache = upsertMessage(localCache, changedMsg);
        callback([...localCache], null);
      },
      onMessageRemoved: (removedId) => {
        if (!isMounted) return;
        localCache = removeMessageById(localCache, removedId);
        callback([...localCache], null);
      },
      onError: (err) => {
        if (!isMounted) return;
        callback(localCache, err);
      },
    });

    chatService
      .loadRecentMessages(workspaceId, channelId, CHAT_PAGE_SIZE)
      .then(({ messages }) => {
        if (!isMounted) return;
        localCache = prependOlderMessages(localCache, messages);
        callback([...localCache], null);
      })
      .catch((err) => {
        if (!isMounted) return;
        callback(localCache, err);
      });

    return () => {
      isMounted = false;
      unsubLive();
    };
  },

  /**
   * Edit a user's own message content.
   */
  editMessage: async (workspaceId, channelId = DEFAULT_CHAT_CHANNEL_ID, messageId, newContent, userId) => {
    const activeChannelId = (channelId || DEFAULT_CHAT_CHANNEL_ID).trim();
    const msgPath = getMessagePath(workspaceId, activeChannelId, messageId);

    // Fetch existing message to verify author and state (RTDB-only)
    const currentMsg = await rtdbService.getRtdbOnly(msgPath);
    if (!currentMsg) {
      throw new Error('Message not found.');
    }

    // Validate edit permissions and bounds
    const validation = validateEditMessage({
      workspaceId,
      channelId: activeChannelId,
      messageId,
      newContent,
      userId,
      currentMessage: currentMsg,
    });

    const updates = {
      content: validation.trimmedContent,
      editedAt: Date.now(),
      editedBy: userId,
    };

    await rtdbService.updateRtdbOnly(msgPath, updates);
    return updates;
  },

  /**
   * Delete a message & purge UploadThing storage file if present.
   */
  deleteMessage: async (workspaceId, channelId = DEFAULT_CHAT_CHANNEL_ID, messageId, userId, isWorkspaceAdmin = false) => {
    const activeChannelId = (channelId || DEFAULT_CHAT_CHANNEL_ID).trim();
    const msgPath = getMessagePath(workspaceId, activeChannelId, messageId);

    const currentMsg = await rtdbService.getRtdbOnly(msgPath);
    if (!currentMsg) {
      throw new Error('Message not found.');
    }

    validateDeleteMessage({
      workspaceId,
      channelId: activeChannelId,
      messageId,
      userId,
      isWorkspaceAdmin,
      currentMessage: currentMsg,
    });

    // Clean up UploadThing file object if an attachment was associated
    if (currentMsg.attachment && (currentMsg.attachment.uploadthingKey || currentMsg.attachment.storagePath)) {
      const keyToDelete = currentMsg.attachment.uploadthingKey || currentMsg.attachment.storagePath;
      uploadthingService.deleteFile(keyToDelete).catch((e) =>
        console.warn('[chatService] Error cleaning up UploadThing file:', e)
      );
    }

    const updates = {
      deleted: true,
      content: 'This message was deleted',
      attachment: null,
      deletedAt: Date.now(),
      deletedBy: userId,
    };

    await rtdbService.updateRtdbOnly(msgPath, updates);
    return updates;
  },

  /**
   * Subscribe to channel metadata (last message time, count).
   */
  subscribeToChannelMetadata: (workspaceId, channelId = DEFAULT_CHAT_CHANNEL_ID, callback) => {
    if (!workspaceId) {
      callback(null, null);
      return () => {};
    }
    const activeChannelId = (channelId || DEFAULT_CHAT_CHANNEL_ID).trim();
    const metaPath = getChannelMetadataPath(workspaceId, activeChannelId);
    return rtdbService.subscribeRtdbOnly(metaPath, callback);
  },

  // -------------------------------------------------------------
  // PHASE 6: THREADED REPLIES & EMOJI REACTIONS
  // -------------------------------------------------------------

  /**
   * Send a reply to a parent message (Phase 6).
   */
  sendReply: async (workspaceId, channelId = DEFAULT_CHAT_CHANNEL_ID, parentMessageId, content, user, attachment = null, parentMessage = null, members = []) => {
    const activeChannelId = (channelId || DEFAULT_CHAT_CHANNEL_ID).trim();
    const validation = validateSendReply({
      workspaceId,
      channelId: activeChannelId,
      parentMessageId,
      content,
      user,
      attachment,
    });

    const repliesRef = ref(rtdb, getMessageRepliesPath(workspaceId, activeChannelId, parentMessageId));
    const newReplyRef = push(repliesRef);
    const replyId = newReplyRef.key;

    const canonicalReply = createCanonicalReply({
      replyId,
      parentMessageId,
      senderId: user.uid,
      senderName: resolveMemberDisplayName(user),
      senderAvatar: user.photoURL || user.avatar || '',
      content: validation.trimmedContent,
      createdAt: Date.now(),
      attachment: validation.sanitizedAttachment,
    });

    await set(newReplyRef, canonicalReply);

    // Phase 7B-1: Dispatch Thread Reply & Mention Notifications
    try {
      // A. Extract mentions in reply
      const mentions = Array.isArray(members) && members.length > 0
        ? extractMentions(validation.trimmedContent, members)
        : [];
      const mentionedUids = mentions
        .map((m) => m.uid)
        .filter((uid) => uid && uid !== user.uid);

      if (mentionedUids.length > 0) {
        inAppNotificationService.dispatchNotificationEvent(
          NOTIFICATION_TYPES.CHAT_MENTION,
          {
            workspaceId,
            channelId: activeChannelId,
            messageId: replyId,
            parentMessageId,
            content: validation.trimmedContent,
            mentionedUids,
          },
          user
        ).catch((e) => console.warn('[chatService] Reply mention dispatch error:', e));
      }

      // B. Resolve parent author
      let parentAuthorId = parentMessage?.senderId;
      if (!parentAuthorId && !parentMessage) {
        const parentSnap = await rtdbService.getRtdbOnly(getMessagePath(workspaceId, activeChannelId, parentMessageId)).catch(() => null);
        if (parentSnap) {
          parentAuthorId = parentSnap.senderId;
        }
      }

      // If parent author is valid, not actor, not a system message, and not already receiving mention notification
      if (
        parentAuthorId &&
        parentAuthorId !== user.uid &&
        !parentMessage?.isSystem &&
        !mentionedUids.includes(parentAuthorId)
      ) {
        inAppNotificationService.dispatchNotificationEvent(
          NOTIFICATION_TYPES.MESSAGE_REPLY,
          {
            workspaceId,
            channelId: activeChannelId,
            parentMessageId,
            replyId,
            content: validation.trimmedContent,
            parentAuthorId,
          },
          user
        ).catch((e) => console.warn('[chatService] Reply notification dispatch error:', e));
      }
    } catch (notifErr) {
      console.warn('[chatService] Reply notification dispatch warning:', notifErr.message);
    }

    return canonicalReply;
  },

  /**
   * Load the initial bounded batch of recent replies for a thread.
   */
  loadRecentReplies: async (workspaceId, channelId = DEFAULT_CHAT_CHANNEL_ID, parentMessageId, pageSize = CHAT_PAGE_SIZE) => {
    if (!workspaceId || !parentMessageId) return { replies: [], hasMore: false };
    const activeChannelId = (channelId || DEFAULT_CHAT_CHANNEL_ID).trim();
    const repliesPath = getMessageRepliesPath(workspaceId, activeChannelId, parentMessageId);
    const repliesRef = ref(rtdb, repliesPath);

    const boundedQuery = query(repliesRef, orderByKey(), limitToLast(pageSize));
    const snapshot = await get(boundedQuery);

    if (!snapshot.exists()) {
      return { replies: [], hasMore: false };
    }

    const repliesList = [];
    snapshot.forEach((childSnap) => {
      const normalized = normalizeChatReply(childSnap.val(), childSnap.key);
      if (normalized) repliesList.push(normalized);
    });

    repliesList.sort(compareMessages);
    return {
      replies: repliesList,
      hasMore: repliesList.length >= pageSize,
    };
  },

  /**
   * Load an older batch of replies for a thread using cursor-based pagination.
   */
  loadOlderReplies: async (workspaceId, channelId = DEFAULT_CHAT_CHANNEL_ID, parentMessageId, beforeReplyKey, pageSize = CHAT_PAGE_SIZE) => {
    if (!workspaceId || !parentMessageId || !beforeReplyKey) return { replies: [], hasMore: false };
    const activeChannelId = (channelId || DEFAULT_CHAT_CHANNEL_ID).trim();
    const repliesPath = getMessageRepliesPath(workspaceId, activeChannelId, parentMessageId);
    const repliesRef = ref(rtdb, repliesPath);

    const olderQuery = query(repliesRef, orderByKey(), endBefore(beforeReplyKey), limitToLast(pageSize));
    const snapshot = await get(olderQuery);

    if (!snapshot.exists()) {
      return { replies: [], hasMore: false };
    }

    const repliesList = [];
    snapshot.forEach((childSnap) => {
      const normalized = normalizeChatReply(childSnap.val(), childSnap.key);
      if (normalized) repliesList.push(normalized);
    });

    repliesList.sort(compareMessages);
    return {
      replies: repliesList,
      hasMore: repliesList.length >= pageSize,
    };
  },

  /**
   * Subscribe to real-time live reply updates for an open thread.
   */
  subscribeToThread: (workspaceId, channelId = DEFAULT_CHAT_CHANNEL_ID, parentMessageId, callbacks = {}) => {
    if (!workspaceId || !parentMessageId) return () => {};
    const activeChannelId = (channelId || DEFAULT_CHAT_CHANNEL_ID).trim();
    const repliesPath = getMessageRepliesPath(workspaceId, activeChannelId, parentMessageId);
    const repliesRef = ref(rtdb, repliesPath);

    const { onReplyAdded, onReplyChanged, onReplyRemoved, onError } = callbacks;

    const addedQuery = query(repliesRef, orderByKey(), limitToLast(CHAT_PAGE_SIZE));
    const unsubAdded = onChildAdded(
      addedQuery,
      (snapshot) => {
        const normalized = normalizeChatReply(snapshot.val(), snapshot.key);
        if (normalized && typeof onReplyAdded === 'function') onReplyAdded(normalized);
      },
      (err) => {
        if (typeof onError === 'function') onError(err);
      }
    );

    const unsubChanged = onChildChanged(
      repliesRef,
      (snapshot) => {
        const normalized = normalizeChatReply(snapshot.val(), snapshot.key);
        if (normalized && typeof onReplyChanged === 'function') onReplyChanged(normalized);
      },
      (err) => {
        if (typeof onError === 'function') onError(err);
      }
    );

    const unsubRemoved = onChildRemoved(
      repliesRef,
      (snapshot) => {
        if (typeof onReplyRemoved === 'function') onReplyRemoved(snapshot.key);
      },
      (err) => {
        if (typeof onError === 'function') onError(err);
      }
    );

    return () => {
      unsubAdded();
      unsubChanged();
      unsubRemoved();
    };
  },

  /**
   * Subscribe to real-time reply count for a message.
   */
  subscribeToMessageReplyCount: (workspaceId, channelId = DEFAULT_CHAT_CHANNEL_ID, parentMessageId, callback) => {
    if (!workspaceId || !parentMessageId) {
      if (typeof callback === 'function') callback(0);
      return () => {};
    }
    const activeChannelId = (channelId || DEFAULT_CHAT_CHANNEL_ID).trim();
    const repliesPath = getMessageRepliesPath(workspaceId, activeChannelId, parentMessageId);

    return rtdbService.subscribeRtdbOnly(repliesPath, (rawReplies) => {
      if (!rawReplies || typeof rawReplies !== 'object') {
        if (typeof callback === 'function') callback(0);
        return;
      }

      // Count active (non-deleted) replies
      const activeCount = Object.values(rawReplies).filter((r) => r && r.replyId && !r.deleted).length;
      if (typeof callback === 'function') callback(activeCount);
    });
  },

  /**
   * Phase 8 / P1-04: Subscribe to real-time reply counts for an entire channel.
   * Eliminates the N+1 listener explosion by aggregating reply counts under a single channel-level listener.
   *
   * @param {string} workspaceId - Workspace ID
   * @param {string} channelId - Channel ID
   * @param {Function} callback - Invoked with { [parentMessageId]: activeCount }
   * @returns {Function} Unsubscribe function
   */
  subscribeToChannelReplyCounts: (workspaceId, channelId = DEFAULT_CHAT_CHANNEL_ID, callback) => {
    if (!workspaceId) {
      if (typeof callback === 'function') callback({});
      return () => {};
    }

    const activeChannelId = (channelId || DEFAULT_CHAT_CHANNEL_ID).trim();
    const repliesRootPath = getMessageRepliesRootPath(workspaceId, activeChannelId);

    return rtdbService.subscribeRtdbOnly(repliesRootPath, (rawChannelReplies) => {
      if (!rawChannelReplies || typeof rawChannelReplies !== 'object') {
        if (typeof callback === 'function') callback({});
        return;
      }

      // rawChannelReplies structure: { [parentMessageId]: { [replyId]: replyObject } }
      const replyCountsByMessageId = {};

      Object.entries(rawChannelReplies).forEach(([parentMessageId, rawReplies]) => {
        if (!rawReplies || typeof rawReplies !== 'object') {
          replyCountsByMessageId[parentMessageId] = 0;
          return;
        }

        const activeCount = Object.values(rawReplies).filter(
          (r) => r && r.replyId && !r.deleted
        ).length;

        replyCountsByMessageId[parentMessageId] = activeCount;
      });

      if (typeof callback === 'function') {
        callback(replyCountsByMessageId);
      }
    });
  },

  /**
   * Edit a thread reply.
   */
  editReply: async (workspaceId, channelId = DEFAULT_CHAT_CHANNEL_ID, parentMessageId, replyId, newContent, userId) => {
    const activeChannelId = (channelId || DEFAULT_CHAT_CHANNEL_ID).trim();
    const replyPath = getMessageReplyPath(workspaceId, activeChannelId, parentMessageId, replyId);

    const currentReply = await rtdbService.getRtdbOnly(replyPath);
    if (!currentReply) throw new Error('Reply not found.');

    const validation = validateEditReply({
      workspaceId,
      channelId: activeChannelId,
      parentMessageId,
      replyId,
      newContent,
      userId,
      currentReply,
    });

    const updates = {
      content: validation.trimmedContent,
      editedAt: Date.now(),
      editedBy: userId,
    };

    await rtdbService.updateRtdbOnly(replyPath, updates);
    return updates;
  },

  /**
   * Soft-delete a thread reply.
   */
  deleteReply: async (workspaceId, channelId = DEFAULT_CHAT_CHANNEL_ID, parentMessageId, replyId, userId, isWorkspaceAdmin = false) => {
    const activeChannelId = (channelId || DEFAULT_CHAT_CHANNEL_ID).trim();
    const replyPath = getMessageReplyPath(workspaceId, activeChannelId, parentMessageId, replyId);

    const currentReply = await rtdbService.getRtdbOnly(replyPath);
    if (!currentReply) throw new Error('Reply not found.');

    validateDeleteReply({
      workspaceId,
      channelId: activeChannelId,
      parentMessageId,
      replyId,
      userId,
      isWorkspaceAdmin,
      currentReply,
    });

    if (currentReply.attachment && (currentReply.attachment.uploadthingKey || currentReply.attachment.storagePath)) {
      const keyToDelete = currentReply.attachment.uploadthingKey || currentReply.attachment.storagePath;
      uploadthingService.deleteFile(keyToDelete).catch((e) =>
        console.warn('[chatService] Error cleaning up reply attachment:', e)
      );
    }

    const updates = {
      deleted: true,
      content: 'This message was deleted',
      attachment: null,
      deletedAt: Date.now(),
      deletedBy: userId,
    };

    await rtdbService.updateRtdbOnly(replyPath, updates);
    return updates;
  },

  /**
   * Toggle an emoji reaction on a message (Add if not present, Remove if already active).
   */
  toggleReaction: async (workspaceId, channelId = DEFAULT_CHAT_CHANNEL_ID, messageId, emoji, user) => {
    const activeChannelId = (channelId || DEFAULT_CHAT_CHANNEL_ID).trim();
    const validation = validateReactionToggle({
      workspaceId,
      channelId: activeChannelId,
      messageId,
      emoji,
      user,
    });

    const reactionPath = getMessageReactionPath(workspaceId, activeChannelId, messageId, validation.cleanEmoji, validation.userId);
    const existing = await rtdbService.getRtdbOnly(reactionPath);

    if (existing === true) {
      await set(ref(rtdb, reactionPath), null);
      return { action: 'removed', emoji: validation.cleanEmoji };
    } else {
      await set(ref(rtdb, reactionPath), true);
      return { action: 'added', emoji: validation.cleanEmoji };
    }
  },

  /**
   * Subscribe to real-time emoji reactions for a message.
   */
  subscribeToMessageReactions: (workspaceId, channelId = DEFAULT_CHAT_CHANNEL_ID, messageId, callback) => {
    if (!workspaceId || !messageId) {
      callback({});
      return () => {};
    }

    const activeChannelId = (channelId || DEFAULT_CHAT_CHANNEL_ID).trim();
    const reactionsPath = getMessageReactionsPath(workspaceId, activeChannelId, messageId);
    return rtdbService.subscribeRtdbOnly(reactionsPath, (rawReactions) => {
      if (!rawReactions || typeof rawReactions !== 'object') {
        callback({});
        return;
      }

      const summary = {};
      Object.entries(rawReactions).forEach(([rawEmojiKey, uidsMap]) => {
        let emoji = rawEmojiKey;
        try {
          emoji = decodeURIComponent(rawEmojiKey);
        } catch {
          // fallback
        }

        if (uidsMap && typeof uidsMap === 'object') {
          const userIds = Object.keys(uidsMap).filter((uid) => uidsMap[uid] === true);
          if (userIds.length > 0) {
            summary[emoji] = {
              count: userIds.length,
              users: userIds,
            };
          }
        }
      });

      callback(summary);
    });
  },

  /**
   * Phase 8 / P1-04: Subscribe to real-time emoji reactions for an entire channel.
   * Eliminates the N+1 listener explosion by aggregating reactions under a single channel-level listener.
   *
   * @param {string} workspaceId - Workspace ID
   * @param {string} channelId - Channel ID
   * @param {Function} callback - Invoked with { [messageId]: summaryMap }
   * @returns {Function} Unsubscribe function
   */
  subscribeToChannelReactions: (workspaceId, channelId = DEFAULT_CHAT_CHANNEL_ID, callback) => {
    if (!workspaceId) {
      if (typeof callback === 'function') callback({});
      return () => {};
    }

    const activeChannelId = (channelId || DEFAULT_CHAT_CHANNEL_ID).trim();
    const reactionsRootPath = getMessageReactionsRootPath(workspaceId, activeChannelId);

    return rtdbService.subscribeRtdbOnly(reactionsRootPath, (rawChannelReactions) => {
      if (!rawChannelReactions || typeof rawChannelReactions !== 'object') {
        if (typeof callback === 'function') callback({});
        return;
      }

      // rawChannelReactions structure: { [messageId]: { [rawEmoji]: { [uid]: true } } }
      const reactionsByMessageId = {};

      Object.entries(rawChannelReactions).forEach(([messageId, rawReactions]) => {
        if (!rawReactions || typeof rawReactions !== 'object') return;

        const summary = {};
        Object.entries(rawReactions).forEach(([rawEmojiKey, uidsMap]) => {
          let emoji = rawEmojiKey;
          try {
            emoji = decodeURIComponent(rawEmojiKey);
          } catch {
            // fallback
          }

          if (uidsMap && typeof uidsMap === 'object') {
            const userIds = Object.keys(uidsMap).filter((uid) => uidsMap[uid] === true);
            if (userIds.length > 0) {
              summary[emoji] = {
                count: userIds.length,
                users: userIds,
              };
            }
          }
        });

        reactionsByMessageId[messageId] = summary;
      });

      if (typeof callback === 'function') {
        callback(reactionsByMessageId);
      }
    });
  },

  /**
   * Phase 7: Update a user's read state cursor for a channel.
   *
   * @param {string} workspaceId - Workspace ID
   * @param {string} [channelId='general'] - Channel ID
   * @param {string} userId - User UID
   * @param {string|null} [lastReadMessageId=null] - Last read message ID
   * @param {number} [lastReadAt=Date.now()] - Timestamp of newest read message
   */
  updateReadState: async (workspaceId, channelId = DEFAULT_CHAT_CHANNEL_ID, userId, lastReadMessageId = null, lastReadAt = Date.now()) => {
    if (!workspaceId || !userId) return;
    const activeChannelId = (channelId || DEFAULT_CHAT_CHANNEL_ID).trim();
    const readPath = getChannelReadStatePath(workspaceId, activeChannelId, userId);

    const payload = createCanonicalReadState({
      lastReadMessageId,
      lastReadAt: typeof lastReadAt === 'number' ? lastReadAt : Date.now(),
      updatedAt: Date.now(),
    });

    await rtdbService.setData(readPath, payload).catch((err) =>
      console.warn('[chatService] updateReadState warning:', err)
    );
  },

  /**
   * Phase 7: Subscribe to a user's read state cursor for a channel.
   */
  subscribeToReadState: (workspaceId, channelId = DEFAULT_CHAT_CHANNEL_ID, userId, callback) => {
    if (!workspaceId || !userId) {
      if (typeof callback === 'function') callback(null);
      return () => {};
    }
    const activeChannelId = (channelId || DEFAULT_CHAT_CHANNEL_ID).trim();
    const readPath = getChannelReadStatePath(workspaceId, activeChannelId, userId);

    return rtdbService.subscribeRtdbOnly(readPath, (data) => {
      if (typeof callback === 'function') callback(data || null);
    });
  },

  /**
   * Phase 7: Dispatch mention notifications for a new message or reply.
   */
  sendMentionNotifications: async (workspaceId, channelId = DEFAULT_CHAT_CHANNEL_ID, messageId, content, senderUser, members = []) => {
    if (!workspaceId || !messageId || !content || !senderUser) return;
    const activeChannelId = (channelId || DEFAULT_CHAT_CHANNEL_ID).trim();
    const mentions = extractMentions(content, members);
    const mentionedUids = mentions
      .map((m) => m.uid)
      .filter((uid) => uid && uid !== senderUser.uid);

    if (mentionedUids.length === 0) return;

    return inAppNotificationService.dispatchNotificationEvent(
      NOTIFICATION_TYPES.CHAT_MENTION,
      {
        workspaceId,
        channelId: activeChannelId,
        messageId,
        content,
        mentionedUids,
      },
      senderUser
    );
  },

  /**
   * Phase 7: Dispatch a thread reply notification to the parent message author.
   */
  sendReplyNotification: async (workspaceId, channelId = DEFAULT_CHAT_CHANNEL_ID, parentMessage, replyData, senderUser) => {
    if (!workspaceId || !parentMessage || !replyData || !senderUser) return;
    const targetUid = parentMessage.senderId;

    // Do not notify self
    if (!targetUid || targetUid === senderUser.uid || parentMessage.isSystem) return;

    const activeChannelId = (channelId || DEFAULT_CHAT_CHANNEL_ID).trim();
    return inAppNotificationService.dispatchNotificationEvent(
      NOTIFICATION_TYPES.MESSAGE_REPLY,
      {
        workspaceId,
        channelId: activeChannelId,
        parentMessageId: parentMessage.messageId,
        replyId: replyData.replyId,
        content: replyData.content,
        parentAuthorId: targetUid,
      },
      senderUser
    );
  },

  /**
   * Phase 7: Subscribe to a user's in-app notification center feed (delegates to centralized inAppNotificationService).
   */
  subscribeToUserNotifications: (userId, callback) => {
    return inAppNotificationService.subscribeToUserNotifications(userId, callback);
  },

  /**
   * Phase 7: Mark a single in-app notification as read (delegates to centralized inAppNotificationService).
   */
  markNotificationAsRead: async (userId, notificationId) => {
    return inAppNotificationService.markNotificationAsRead(userId, notificationId);
  },

  /**
   * Phase 7: Mark all in-app notifications as read for a user (delegates to centralized inAppNotificationService).
   */
  markAllNotificationsAsRead: async (userId, notifications = []) => {
    return inAppNotificationService.markAllNotificationsAsRead(userId, notifications);
  },

  /**
   * Phase 7: Search messages and replies in a workspace channel.
   */
  searchMessages: async (workspaceId, channelId = DEFAULT_CHAT_CHANNEL_ID, queryText = '', limit = 30) => {
    const cleanQuery = (queryText || '').toLowerCase().trim();
    if (!workspaceId || !cleanQuery) return [];

    const activeChannelId = (channelId || DEFAULT_CHAT_CHANNEL_ID).trim();
    const messagesPath = getChannelMessagesPath(workspaceId, activeChannelId);
    const messagesRef = ref(rtdb, messagesPath);

    // Fetch recent message batch to search in-memory
    const recentQuery = query(messagesRef, orderByKey(), limitToLast(100));
    const snapshot = await get(recentQuery);

    if (!snapshot.exists()) return [];

    const rawVal = snapshot.val() || {};
    const results = [];

    Object.entries(rawVal).forEach(([key, rawMsg]) => {
      const msg = normalizeChatMessage(rawMsg, key);
      if (!msg || msg.deleted || msg.isSystem) return;

      const contentMatch = (msg.content || '').toLowerCase().includes(cleanQuery);
      const senderMatch = (msg.senderName || '').toLowerCase().includes(cleanQuery);

      if (contentMatch || senderMatch) {
        results.push({
          type: 'message',
          messageId: msg.messageId,
          senderId: msg.senderId,
          senderName: msg.senderName,
          senderAvatar: msg.senderAvatar,
          content: msg.content,
          createdAt: msg.createdAt,
          attachment: msg.attachment,
        });
      }
    });

    return results.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  },

  /**
   * Phase 8: Publish or clear typing indicator for a channel.
   * Attaches onDisconnect hook to automatically remove typing indicator when browser closes.
   */
  setTypingState: async (workspaceId, channelId = DEFAULT_CHAT_CHANNEL_ID, user, isTyping = true) => {
    if (!workspaceId || !user?.uid) return;
    const activeChannelId = (channelId || DEFAULT_CHAT_CHANNEL_ID).trim();
    const typingPath = getChannelTypingPath(workspaceId, activeChannelId, user.uid);
    const typingRef = ref(rtdb, typingPath);

    if (isTyping) {
      const displayName = resolveMemberDisplayName(user);
      const typingData = createCanonicalTypingState({
        uid: user.uid,
        displayName,
        startedAt: Date.now(),
      });

      // Hook up onDisconnect to remove node on unexpected termination
      onDisconnect(typingRef).remove().catch(() => {});
      await set(typingRef, typingData).catch(() => {});
    } else {
      await remove(typingRef).catch(() => {});
    }
  },

  /**
   * Phase 8: Subscribe to real-time active typing indicators in a channel.
   */
  subscribeToTypingState: (workspaceId, channelId = DEFAULT_CHAT_CHANNEL_ID, callback) => {
    if (!workspaceId) {
      if (typeof callback === 'function') callback([]);
      return () => {};
    }

    const activeChannelId = (channelId || DEFAULT_CHAT_CHANNEL_ID).trim();
    const typingRootPath = getChannelTypingRootPath(workspaceId, activeChannelId);

    return rtdbService.subscribeRtdbOnly(typingRootPath, (rawVal) => {
      if (!rawVal || typeof rawVal !== 'object') {
        if (typeof callback === 'function') callback([]);
        return;
      }

      const now = Date.now();
      const typers = Object.entries(rawVal)
        .map(([key, item]) => ({
          ...item,
          uid: item.uid || key,
        }))
        .filter((item) => item.startedAt && now - item.startedAt < 6000);

      if (typeof callback === 'function') {
        callback(typers);
      }
    });
  },

  /**
   * Phase 8: Publish or clear typing indicator for a reply thread.
   */
  setThreadTypingState: async (workspaceId, channelId = DEFAULT_CHAT_CHANNEL_ID, parentMessageId, user, isTyping = true) => {
    if (!workspaceId || !parentMessageId || !user?.uid) return;
    const activeChannelId = (channelId || DEFAULT_CHAT_CHANNEL_ID).trim();
    const threadTypingPath = getThreadTypingPath(workspaceId, activeChannelId, parentMessageId, user.uid);
    const threadTypingRef = ref(rtdb, threadTypingPath);

    if (isTyping) {
      const displayName = resolveMemberDisplayName(user);
      const typingData = createCanonicalTypingState({
        uid: user.uid,
        displayName,
        startedAt: Date.now(),
      });

      onDisconnect(threadTypingRef).remove().catch(() => {});
      await set(threadTypingRef, typingData).catch(() => {});
    } else {
      await remove(threadTypingRef).catch(() => {});
    }
  },

  /**
   * Phase 8: Subscribe to real-time active typing indicators in a reply thread.
   */
  subscribeToThreadTypingState: (workspaceId, channelId = DEFAULT_CHAT_CHANNEL_ID, parentMessageId, callback) => {
    if (!workspaceId || !parentMessageId) {
      if (typeof callback === 'function') callback([]);
      return () => {};
    }

    const activeChannelId = (channelId || DEFAULT_CHAT_CHANNEL_ID).trim();
    const threadTypingRootPath = getThreadTypingRootPath(workspaceId, activeChannelId, parentMessageId);

    return rtdbService.subscribeRtdbOnly(threadTypingRootPath, (rawVal) => {
      if (!rawVal || typeof rawVal !== 'object') {
        if (typeof callback === 'function') callback([]);
        return;
      }

      const now = Date.now();
      const typers = Object.entries(rawVal)
        .map(([key, item]) => ({
          ...item,
          uid: item.uid || key,
        }))
        .filter((item) => item.startedAt && now - item.startedAt < 6000);

      if (typeof callback === 'function') {
        callback(typers);
      }
    });
  },

  /**
   * Phase 8: Subscribe to Firebase Realtime Database connection status (.info/connected).
   */
  subscribeToConnectionState: (callback) => {
    return rtdbService.subscribeRtdbOnly('.info/connected', (connected) => {
      if (typeof callback === 'function') {
        callback(connected === true);
      }
    });
  },

  /**
   * Phase 9: List all channels in a workspace.
   * Guarantees that the default #general channel is always included.
   */
  listWorkspaceChannels: async (workspaceId) => {
    if (!workspaceId) return [];
    const channelsPath = getWorkspaceChannelsRootPath(workspaceId);
    const channelsRef = ref(rtdb, channelsPath);
    const snapshot = await get(channelsRef);

    const channelsMap = snapshot.exists() ? snapshot.val() || {} : {};
    const channelList = [];

    // Ensure #general default channel is always synthesized if missing
    let hasGeneral = false;

    Object.entries(channelsMap).forEach(([id, data]) => {
      const meta = data?.metadata || {};
      const channelId = meta.channelId || id;
      if (channelId === DEFAULT_CHAT_CHANNEL_ID) hasGeneral = true;

      // Strictly omit any public channels from workspace channels
      if (meta.type === CHANNEL_TYPES.PUBLIC) {
        return;
      }

      channelList.push({
        channelId,
        name: meta.name || channelId,
        topic: meta.topic || '',
        type: CHANNEL_TYPES.WORKSPACE,
        isDefault: channelId === DEFAULT_CHAT_CHANNEL_ID || Boolean(meta.isDefault),
        archived: Boolean(meta.archived),
        createdBy: meta.createdBy || 'system',
        createdAt: meta.createdAt || 0,
        lastMessageAt: meta.lastMessageAt || null,
        lastMessageContent: meta.lastMessageContent || null,
        lastSenderName: meta.lastSenderName || null,
      });
    });

    if (!hasGeneral) {
      channelList.unshift({
        channelId: DEFAULT_CHAT_CHANNEL_ID,
        name: DEFAULT_CHAT_CHANNEL_ID,
        topic: 'Default team channel for general discussions',
        type: CHANNEL_TYPES.WORKSPACE,
        isDefault: true,
        archived: false,
        createdBy: 'system',
        createdAt: 0,
        lastMessageAt: null,
        lastMessageContent: null,
        lastSenderName: null,
      });
    }

    return channelList.sort((a, b) => {
      if (a.isDefault) return -1;
      if (b.isDefault) return 1;
      return a.name.localeCompare(b.name);
    });
  },

  /**
   * Phase 9: Real-time subscription to workspace channels list.
   */
  subscribeToWorkspaceChannels: (workspaceId, callback) => {
    if (!workspaceId) {
      if (typeof callback === 'function') callback([]);
      return () => {};
    }

    const channelsPath = getWorkspaceChannelsRootPath(workspaceId);

    return rtdbService.subscribeRtdbOnly(channelsPath, (rawVal) => {
      const channelsMap = rawVal && typeof rawVal === 'object' ? rawVal : {};
      const channelList = [];
      let hasGeneral = false;

      Object.entries(channelsMap).forEach(([id, data]) => {
        const meta = data?.metadata || {};
        const channelId = meta.channelId || id;
        if (channelId === DEFAULT_CHAT_CHANNEL_ID) hasGeneral = true;

        // Strictly omit any public channels from workspace channels
        if (meta.type === CHANNEL_TYPES.PUBLIC) {
          return;
        }

        channelList.push({
          channelId,
          name: meta.name || channelId,
          topic: meta.topic || '',
          type: CHANNEL_TYPES.WORKSPACE,
          isDefault: channelId === DEFAULT_CHAT_CHANNEL_ID || Boolean(meta.isDefault),
          archived: Boolean(meta.archived),
          createdBy: meta.createdBy || 'system',
          createdAt: meta.createdAt || 0,
          lastMessageAt: meta.lastMessageAt || null,
          lastMessageContent: meta.lastMessageContent || null,
          lastSenderName: meta.lastSenderName || null,
        });
      });

      if (!hasGeneral) {
        channelList.unshift({
          channelId: DEFAULT_CHAT_CHANNEL_ID,
          name: DEFAULT_CHAT_CHANNEL_ID,
          topic: 'Default team channel for general discussions',
          type: CHANNEL_TYPES.WORKSPACE,
          isDefault: true,
          archived: false,
          createdBy: 'system',
          createdAt: 0,
          lastMessageAt: null,
          lastMessageContent: null,
          lastSenderName: null,
        });
      }

      channelList.sort((a, b) => {
        if (a.isDefault) return -1;
        if (b.isDefault) return 1;
        return a.name.localeCompare(b.name);
      });

      if (typeof callback === 'function') {
        callback(channelList);
      }
    });
  },

  /**
   * Phase 9: Create a new workspace channel.
   * Authorization: Workspace Leaders / Owners only.
   */
  createChannel: async (workspaceId, { name, topic = '' }, user, isLeader = false) => {
    if (!workspaceId || !user?.uid) {
      throw new Error('User authentication and workspace context are required.');
    }
    if (!isLeader) {
      throw new Error('Only workspace owners or leaders have permission to create channels.');
    }

    const rawSlug = normalizeChannelSlug(name);
    const validation = validateChannelSlug(rawSlug);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    if (rawSlug === DEFAULT_CHAT_CHANNEL_ID) {
      throw new Error(`The '${DEFAULT_CHAT_CHANNEL_ID}' channel already exists by default.`);
    }

    // Check if channel already exists
    const metadataPath = getChannelMetadataPath(workspaceId, rawSlug);
    const existingSnap = await get(ref(rtdb, metadataPath));
    if (existingSnap.exists()) {
      throw new Error(`Channel '#${rawSlug}' already exists in this workspace.`);
    }

    const canonicalMeta = createCanonicalChannelMetadata({
      channelId: rawSlug,
      name: rawSlug,
      topic: topic.trim(),
      type: CHANNEL_TYPES.WORKSPACE, // Strictly workspace-only
      isDefault: false,
      createdBy: user.uid,
    });

    await set(ref(rtdb, metadataPath), canonicalMeta);
    return canonicalMeta;
  },

  /**
   * Phase 9: Update a channel's topic/purpose.
   * Authorization: Workspace Leaders / Owners only.
   */
  updateChannelTopic: async (workspaceId, channelId, topic, user, isLeader = false) => {
    if (!workspaceId || !channelId || !user?.uid) {
      throw new Error('Valid workspace, channel, and user are required.');
    }
    if (!isLeader) {
      throw new Error('Only workspace owners or leaders can edit channel details.');
    }

    const cleanTopic = (topic || '').trim().substring(0, 250);
    const metadataPath = getChannelMetadataPath(workspaceId, channelId);
    await rtdbService.updateData(metadataPath, { topic: cleanTopic, updatedAt: Date.now() });
  },

  /**
   * Phase 9: Archive or unarchive a channel.
   * Authorization: Workspace Leaders / Owners only. #general cannot be archived.
   */
  archiveChannel: async (workspaceId, channelId, archived = true, user, isLeader = false) => {
    if (!workspaceId || !channelId || !user?.uid) {
      throw new Error('Valid workspace, channel, and user are required.');
    }
    if (!isLeader) {
      throw new Error('Only workspace owners or leaders can archive channels.');
    }
    if (channelId === DEFAULT_CHAT_CHANNEL_ID) {
      throw new Error(`The default '#${DEFAULT_CHAT_CHANNEL_ID}' channel cannot be archived.`);
    }

    const metadataPath = getChannelMetadataPath(workspaceId, channelId);
    await rtdbService.updateData(metadataPath, { archived: Boolean(archived), updatedAt: Date.now() });
  },

  /**
   * Phase 9: Permanently delete a custom channel.
   * Authorization: Workspace Leaders / Owners only. #general cannot be deleted.
   */
  deleteChannel: async (workspaceId, channelId, user, isLeader = false) => {
    if (!workspaceId || !channelId || !user?.uid) {
      throw new Error('Valid workspace, channel, and user are required.');
    }
    if (!isLeader) {
      throw new Error('Only workspace owners or leaders can delete channels.');
    }
    if (channelId === DEFAULT_CHAT_CHANNEL_ID) {
      throw new Error(`The default '#${DEFAULT_CHAT_CHANNEL_ID}' channel cannot be deleted.`);
    }

    const channelNodePath = getChannelPath(workspaceId, channelId);
    await remove(ref(rtdb, channelNodePath));
  },

  // ==========================================
  // PUBLIC IDEAS COMMUNITY CHAT
  // ==========================================

  /**
   * Sends a message to the Public Ideas Community Chat.
   * Open to any authenticated Convia user.
   */
  sendPublicIdeaChatMessage: async (content, user, attachmentData = null) => {
    if (!user?.uid) {
      throw new Error('Authenticated user is required to participate in community chat.');
    }

    const { trimmedContent, sanitizedAttachment } = validateSendMessage({
      workspaceId: 'public_ideas',
      channelId: 'ideas',
      user,
      content,
      attachment: attachmentData,
    });

    const messagesPath = getPublicIdeasChatMessagesPath();
    const newMsgRef = push(ref(rtdb, messagesPath));
    const messageId = newMsgRef.key;

    const canonicalMsg = createCanonicalMessage({
      messageId,
      senderId: user.uid,
      senderName: user.displayName || user.name || 'Community Member',
      senderEmail: user.email || '',
      senderAvatar: user.photoURL || '',
      content: trimmedContent,
      attachment: sanitizedAttachment,
      createdAt: serverTimestamp(),
    });

    await set(newMsgRef, canonicalMsg);
    return messageId;
  },

  /**
   * Bounded real-time listener for Public Ideas Community Chat.
   */
  subscribeToPublicIdeaChatMessages: (callbacks) => {
    const messagesPath = getPublicIdeasChatMessagesPath();
    const messagesRef = query(ref(rtdb, messagesPath), limitToLast(CHAT_PAGE_SIZE));

    return onValue(
      messagesRef,
      (snapshot) => {
        const val = snapshot.val();
        if (!val) {
          if (callbacks?.onInitialLoaded) callbacks.onInitialLoaded([]);
          return;
        }

        const messages = Object.entries(val)
          .map(([id, data]) => normalizeChatMessage({ ...data, messageId: id }))
          .filter(Boolean)
          .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

        if (callbacks?.onInitialLoaded) callbacks.onInitialLoaded(messages);
      },
      (error) => {
        if (callbacks?.onError) callbacks.onError(error);
      }
    );
  },

  /**
   * Sets typing state for Public Ideas Community Chat.
   */
  setPublicIdeaChatTypingState: async (user, isTyping) => {
    if (!user?.uid) return;
    const typingUserPath = getPublicIdeasChatTypingPath(user.uid);
    const typingRef = ref(rtdb, typingUserPath);

    if (isTyping) {
      await set(typingRef, {
        uid: user.uid,
        displayName: user.displayName || user.name || 'Community Member',
        avatarUrl: user.photoURL || '',
        startedAt: Date.now(),
      });
      onDisconnect(typingRef).remove();
    } else {
      await remove(typingRef);
    }
  },

  /**
   * Subscribes to typing indicators for Public Ideas Community Chat.
   */
  subscribeToPublicIdeaChatTyping: (currentUserId, onTypersUpdate) => {
    const typingRootPath = getPublicIdeasChatTypingRootPath();
    const typingRef = ref(rtdb, typingRootPath);

    return onValue(typingRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        onTypersUpdate([]);
        return;
      }

      const now = Date.now();
      const typers = Object.values(data)
        .filter((t) => t && t.uid !== currentUserId && (now - t.startedAt < 6000))
        .map((t) => ({
          uid: t.uid,
          displayName: t.displayName || 'Someone',
        }));

      onTypersUpdate(typers);
    });
  },
};
