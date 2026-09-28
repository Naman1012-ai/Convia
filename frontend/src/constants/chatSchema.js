/**
 * Convia Chat System — Phase 2 Canonical Chat Contract & Schema
 * Single Authoritative Schema Specification for Workspace Channel Messaging.
 *
 * CANONICAL SOURCE OF TRUTH:
 *   workspaceChats/{workspaceId}/channels/{channelId}/messages/{messageId}
 *
 * ARCHITECTURAL RULES:
 * 1. The RTDB key (`messageId`) is the canonical message identifier.
 *    The `messageId` field inside the message object is retained for backward compatibility
 *    and MUST match the RTDB push key. It is not an independently trusted identifier.
 * 2. `workspaceId` and `channelId` are inherent to the RTDB path and are not duplicated
 *    in the message payload to prevent denormalization inconsistencies.
 * 3. Firebase Realtime Database is the SOLE authoritative message store.
 *    Firestore must NOT be used as a shadow persistence layer for chat data.
 * 4. Future extensions (replies, reactions, context linking, presence, typing)
 *    are documented here for schema foresight, but remain optional / inactive in Phase 2.
 */

/** Maximum allowed character length for message content */
export const CHAT_MAX_CONTENT_LENGTH = 2000;

/** Centralized pagination page size for initial window and older message batches */
export const CHAT_PAGE_SIZE = 50;
export const PAGE_SIZE = CHAT_PAGE_SIZE;

/** Default channel identifier for workspace chat */
export const DEFAULT_CHAT_CHANNEL_ID = 'general';

/** Permitted system event types */
export const SYSTEM_MESSAGE_TYPES = {
  SYSTEM: 'system',
  MEMBER_JOINED: 'member_joined',
  MEMBER_LEFT: 'member_left',
  MVP_SELECTED: 'mvp_selected',
  BLUEPRINT_APPROVED: 'blueprint_approved',
  SPRINT_STARTED: 'sprint_started',
};

/** Permitted attachment categories */
export const ATTACHMENT_CATEGORIES = {
  IMAGE: 'image',
  DOCUMENT: 'document',
  CODE: 'code',
  ARCHIVE: 'archive',
  FILE: 'file',
};

/**
 * @typedef {Object} ChatAttachment
 * @property {string} fileId - Unique file identifier from UploadThing / storage key
 * @property {string} fileName - Original uploaded file name
 * @property {string} extension - Lowercase file extension without dot (e.g. 'pdf', 'png')
 * @property {string} mimeType - Standard MIME type string
 * @property {number} size - File size in bytes
 * @property {string} url - Public HTTPS download URL from UploadThing CDN
 * @property {string} uploadthingKey - UploadThing deletion / management key
 * @property {number} uploadedAt - Epoch timestamp of upload completion
 * @property {string} uploadedBy - Firebase Auth UID of the uploader
 * @property {string} category - Category: 'image' | 'document' | 'code' | 'archive' | 'file'
 */

/**
 * @typedef {Object} CanonicalChatMessage
 * @property {string} messageId - RTDB Push Key (matches path key)
 * @property {string} senderId - Firebase Auth UID of the author, or 'system'
 * @property {string} senderName - Display name of author at time of sending
 * @property {string} senderAvatar - Photo URL of author or empty string
 * @property {string} content - Message body text (max 2000 chars)
 * @property {number} createdAt - Creation timestamp (epoch milliseconds)
 * @property {number|null} editedAt - Last edit timestamp or null
 * @property {string|null} editedBy - Firebase Auth UID of editor or null
 * @property {boolean} deleted - Soft deletion tombstone flag
 * @property {number|null} deletedAt - Deletion timestamp or null
 * @property {string|null} deletedBy - Firebase Auth UID of deleter or null
 * @property {boolean} isSystem - True for automated system events, false for member messages
 * @property {string|null} systemType - System event category or null
 * @property {ChatAttachment|null} attachment - Attachment metadata object or null
 */

/**
 * @typedef {Object} ChannelMetadata
 * @property {number} lastMessageAt - Timestamp of most recent message in channel
 * @property {string} lastMessageContent - Preview snippet of most recent message
 * @property {string} lastSenderName - Display name of most recent sender
 */

/**
 * Factory to create a clean, canonical ChatMessage object for new member messages.
 *
 * @param {Object} params
 * @param {string} params.messageId - Generated RTDB push key
 * @param {string} params.senderId - Verified Firebase Auth UID
 * @param {string} params.senderName - Author display name
 * @param {string} [params.senderAvatar] - Author photo URL
 * @param {string} params.content - Trimmed message text
 * @param {number} [params.createdAt] - Creation timestamp (defaults to Date.now())
 * @param {ChatAttachment|null} [params.attachment] - Validated attachment object
 * @returns {CanonicalChatMessage}
 */
export function createCanonicalMessage({
  messageId,
  senderId,
  senderName,
  senderAvatar = '',
  content = '',
  createdAt = Date.now(),
  attachment = null,
}) {
  return {
    messageId,
    senderId,
    senderName: senderName || 'Member',
    senderAvatar: senderAvatar || '',
    content: (content || '').trim(),
    createdAt,
    editedAt: null,
    editedBy: null,
    deleted: false,
    deletedAt: null,
    deletedBy: null,
    isSystem: false,
    systemType: null,
    attachment: attachment || null,
  };
}

/**
 * Permitted / Supported reaction emojis for workspace chat (canonical set of 8).
 */
export const SUPPORTED_REACTIONS = ['👍', '❤️', '🔥', '🎉', '💡', '🚀', '👀', '🙌'];

/**
 * Permitted / Supported reaction emojis for community discussions.
 */
export const COMMUNITY_SUPPORTED_REACTIONS = ['👍', '💡', '❤️', '🔥', '🎯'];

/**
 * Checks whether an emoji is in the supported reaction set.
 * @param {string} emoji
 * @returns {boolean}
 */
export function isValidReactionEmoji(emoji) {
  return (
    typeof emoji === 'string' &&
    (SUPPORTED_REACTIONS.includes(emoji) || COMMUNITY_SUPPORTED_REACTIONS.includes(emoji))
  );
}

/**
 * Community Discussion Post Types.
 * Allows categorizing public community posts into lightweight types:
 * Discussion, Idea, Question, Collaboration.
 */
export const COMMUNITY_POST_TYPES = Object.freeze({
  DISCUSSION: 'discussion',
  IDEA: 'idea',
  QUESTION: 'question',
  COLLABORATION: 'collaboration',
});

export const COMMUNITY_POST_TYPE_CONFIG = Object.freeze({
  [COMMUNITY_POST_TYPES.DISCUSSION]: {
    id: 'discussion',
    label: 'Discussion',
    icon: '💬',
    badgeVariant: 'neutral',
    color: 'text-slate-700 bg-slate-100 border-slate-200',
    description: 'Open conversation, thoughts, and architectural musings',
  },
  [COMMUNITY_POST_TYPES.IDEA]: {
    id: 'idea',
    label: 'Idea',
    icon: '💡',
    badgeVariant: 'warning',
    color: 'text-amber-800 bg-amber-50 border-amber-200',
    description: 'Propose a concept or new product direction',
  },
  [COMMUNITY_POST_TYPES.QUESTION]: {
    id: 'question',
    label: 'Question',
    icon: '❓',
    badgeVariant: 'info',
    color: 'text-sky-800 bg-sky-50 border-sky-200',
    description: 'Ask for technical guidance or community feedback',
  },
  [COMMUNITY_POST_TYPES.COLLABORATION]: {
    id: 'collaboration',
    label: 'Collaboration',
    icon: '🤝',
    badgeVariant: 'success',
    color: 'text-emerald-800 bg-emerald-50 border-emerald-200',
    description: 'Seek co-creators, engineers, or design partners',
  },
});

/**
 * Dynamic placeholder copy adapting cleanly to the active post type.
 */
export const COMPOSER_PLACEHOLDERS = Object.freeze({
  [COMMUNITY_POST_TYPES.DISCUSSION]: 'Share thoughts, discuss ideas, or spark collaboration...',
  [COMMUNITY_POST_TYPES.IDEA]: "What's an idea you'd like the community to explore?",
  [COMMUNITY_POST_TYPES.QUESTION]: "What would you like the community's help with?",
  [COMMUNITY_POST_TYPES.COLLABORATION]: 'What are you looking to build together?',
});

/**
 * Dynamic post button labels adapting to the active post type.
 */
export const COMPOSER_BUTTON_LABELS = Object.freeze({
  [COMMUNITY_POST_TYPES.DISCUSSION]: 'Post Discussion',
  [COMMUNITY_POST_TYPES.IDEA]: 'Post Idea',
  [COMMUNITY_POST_TYPES.QUESTION]: 'Post Question',
  [COMMUNITY_POST_TYPES.COLLABORATION]: 'Post Collaboration',
});


/**
 * @typedef {Object} CanonicalChatReply
 * @property {string} replyId - Generated RTDB push key
 * @property {string} parentMessageId - Target parent message ID
 * @property {string} senderId - Firebase Auth UID of author
 * @property {string} senderName - Author display name
 * @property {string} senderAvatar - Author photo URL or empty string
 * @property {string} content - Trimmed reply text (max 2000 chars)
 * @property {number} createdAt - Creation timestamp (epoch milliseconds)
 * @property {number|null} editedAt - Last edit timestamp or null
 * @property {string|null} editedBy - Firebase Auth UID of editor or null
 * @property {boolean} deleted - Soft deletion tombstone flag
 * @property {number|null} deletedAt - Deletion timestamp or null
 * @property {string|null} deletedBy - Firebase Auth UID of deleter or null
 * @property {ChatAttachment|null} attachment - Validated attachment object or null
 */

/**
 * Factory to create a clean, canonical ChatReply object.
 *
 * @param {Object} params
 * @param {string} params.replyId - Generated RTDB push key
 * @param {string} params.parentMessageId - Target parent message ID
 * @param {string} params.senderId - Verified Firebase Auth UID
 * @param {string} params.senderName - Author display name
 * @param {string} [params.senderAvatar] - Author photo URL
 * @param {string} params.content - Trimmed reply text
 * @param {number} [params.createdAt] - Creation timestamp (defaults to Date.now())
 * @param {ChatAttachment|null} [params.attachment] - Validated attachment object
 * @returns {CanonicalChatReply}
 */
export function createCanonicalReply({
  replyId,
  parentMessageId,
  senderId,
  senderName,
  senderAvatar = '',
  content = '',
  createdAt = Date.now(),
  attachment = null,
}) {
  return {
    replyId,
    parentMessageId,
    senderId,
    senderName: senderName || 'Member',
    senderAvatar: senderAvatar || '',
    content: (content || '').trim(),
    createdAt,
    editedAt: null,
    editedBy: null,
    deleted: false,
    deletedAt: null,
    deletedBy: null,
    attachment: attachment || null,
  };
}

/**
 * Factory to create a clean, canonical SystemMessage object.
 *
 * @param {Object} params
 * @param {string} params.messageId - Generated RTDB push key
 * @param {string} params.content - System event text
 * @param {string} [params.systemType] - System event type
 * @param {number} [params.createdAt] - Creation timestamp (defaults to Date.now())
 * @returns {CanonicalChatMessage}
 */
export function createCanonicalSystemMessage({
  messageId,
  content,
  systemType = SYSTEM_MESSAGE_TYPES.SYSTEM,
  createdAt = Date.now(),
}) {
  return {
    messageId,
    senderId: 'system',
    senderName: 'System',
    senderAvatar: '',
    content: (content || '').trim(),
    createdAt,
    editedAt: null,
    editedBy: null,
    deleted: false,
    deletedAt: null,
    deletedBy: null,
    isSystem: true,
    systemType: systemType || SYSTEM_MESSAGE_TYPES.SYSTEM,
    attachment: null,
  };
}

/**
 * Phase 7: Chat In-App Notification Types
 */
export const CHAT_NOTIFICATION_TYPES = {
  MENTION: 'CHAT_MENTION',
  REPLY: 'CHAT_REPLY',
};

/**
 * Factory to create a clean canonical ChatReadState cursor object.
 *
 * @param {Object} params
 * @param {string|null} [params.lastReadMessageId=null] - Most recent read message key
 * @param {number} [params.lastReadAt=Date.now()] - Timestamp of newest read message
 * @param {number} [params.updatedAt=Date.now()] - Timestamp of checkpoint update
 * @returns {Object}
 */
export function createCanonicalReadState({
  lastReadMessageId = null,
  lastReadAt = Date.now(),
  updatedAt = Date.now(),
}) {
  return {
    lastReadMessageId: lastReadMessageId || null,
    lastReadAt: typeof lastReadAt === 'number' ? lastReadAt : Date.now(),
    updatedAt: typeof updatedAt === 'number' ? updatedAt : Date.now(),
  };
}

/**
 * Factory to create a clean canonical Chat In-App Notification object.
 *
 * @param {Object} params
 * @param {string} params.notificationId - Unique notification key
 * @param {string} params.type - CHAT_NOTIFICATION_TYPES.MENTION | CHAT_NOTIFICATION_TYPES.REPLY
 * @param {string} params.orgId - Workspace / Organization ID
 * @param {string} [params.channelId='general'] - Channel ID
 * @param {string} params.messageId - Target Message ID
 * @param {string|null} [params.parentMessageId=null] - Parent Message ID if reply
 * @param {string} params.senderId - Sender UID
 * @param {string} params.senderName - Canonical Display Name of sender
 * @param {string} [params.senderAvatar=''] - Sender photo URL
 * @param {string} params.previewText - Message / Reply text snippet
 * @param {number} [params.createdAt=Date.now()] - Notification creation timestamp
 * @param {string} [params.actionUrl=''] - Target navigation URL
 * @returns {Object}
 */
export function createCanonicalChatNotification({
  notificationId,
  type,
  orgId,
  channelId = DEFAULT_CHAT_CHANNEL_ID,
  messageId,
  parentMessageId = null,
  senderId,
  senderName,
  senderAvatar = '',
  previewText = '',
  createdAt = Date.now(),
  actionUrl = '',
}) {
  const cleanOrg = orgId ? String(orgId).trim() : '';
  const cleanChannel = (channelId || DEFAULT_CHAT_CHANNEL_ID).trim();
  const defaultActionUrl = parentMessageId
    ? `/workspaces/${cleanOrg}/chat?channel=${cleanChannel}&threadId=${parentMessageId}&replyId=${messageId}`
    : `/workspaces/${cleanOrg}/chat?channel=${cleanChannel}&messageId=${messageId}`;

  return {
    notificationId,
    type: type || CHAT_NOTIFICATION_TYPES.MENTION,
    orgId: cleanOrg,
    channelId: cleanChannel,
    messageId,
    parentMessageId: parentMessageId || null,
    senderId,
    senderName: senderName || 'Member',
    senderAvatar: senderAvatar || '',
    previewText: (previewText || '').substring(0, 150),
    createdAt: typeof createdAt === 'number' ? createdAt : Date.now(),
    read: false,
    actionUrl: actionUrl || defaultActionUrl,
  };
}

/**
 * Phase 8: Factory to create a canonical Typing state object.
 *
 * @param {Object} params
 * @param {string} params.uid - Typing user Auth UID
 * @param {string} params.displayName - Canonical display name
 * @param {number} [params.startedAt=Date.now()] - Timestamp
 * @returns {Object}
 */
export function createCanonicalTypingState({
  uid,
  displayName = 'Member',
  startedAt = Date.now(),
}) {
  return {
    uid,
    displayName: displayName || 'Member',
    startedAt: typeof startedAt === 'number' ? startedAt : Date.now(),
  };
}

/**
 * Formats active typing users into human-readable text with proper English grammar.
 * Excludes the current user from their own display.
 *
 * @param {Array<Object>} typingUsers - Array of { uid, displayName, startedAt }
 * @param {string|null} [currentUserId=null] - Currently logged-in UID
 * @param {boolean} [isThread=false] - Whether indicator is for a reply thread
 * @returns {string|null}
 */
export function formatTypingIndicatorText(typingUsers = [], currentUserId = null, isThread = false) {
  if (!Array.isArray(typingUsers) || typingUsers.length === 0) return null;

  // Filter out current user and stale entries older than 6 seconds
  const now = Date.now();
  const activeTypers = typingUsers.filter((u) => {
    if (!u || !u.uid || u.uid === currentUserId) return false;
    if (u.startedAt && now - u.startedAt > 6000) return false;
    return true;
  });

  if (activeTypers.length === 0) return null;

  const names = activeTypers.map((u) => u.displayName || 'Someone');
  const verb = isThread ? 'typing a reply' : 'typing';

  if (names.length === 1) {
    return `${names[0]} is ${verb}...`;
  }
  if (names.length === 2) {
    return `${names[0]} and ${names[1]} are ${verb}...`;
  }
  if (names.length === 3) {
    return `${names[0]}, ${names[1]}, and ${names[2]} are ${verb}...`;
  }
  return `${names[0]}, ${names[1]}, and ${names.length - 2} others are ${verb}...`;
}

/**
 * Phase 9: Permitted channel access scopes.
 * - WORKSPACE: Only members of the workspace can view and participate.
 * - PUBLIC: Any authenticated Convia user can view and participate (community channel).
 */
export const CHANNEL_TYPES = Object.freeze({
  WORKSPACE: 'workspace',
  PUBLIC: 'public',
});

/**
 * Normalizes a raw string into a clean lowercase channel slug.
 * Example: "Frontend Dev" -> "frontend-dev"
 *
 * @param {string} rawName
 * @returns {string}
 */
export function normalizeChannelSlug(rawName) {
  if (!rawName || typeof rawName !== 'string') return '';
  return rawName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .substring(0, 30);
}

/**
 * Validates a channel slug according to Convia channel rules:
 * - 2 to 30 characters
 * - Only lowercase alphanumeric, hyphens, and underscores
 *
 * @param {string} slug
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateChannelSlug(slug) {
  if (!slug || typeof slug !== 'string') {
    return { valid: false, error: 'Channel name is required.' };
  }
  const clean = slug.trim().toLowerCase();
  if (clean.length < 2) {
    return { valid: false, error: 'Channel name must be at least 2 characters.' };
  }
  if (clean.length > 30) {
    return { valid: false, error: 'Channel name cannot exceed 30 characters.' };
  }
  const slugRegex = /^[a-z0-9-_]+$/;
  if (!slugRegex.test(clean)) {
    return {
      valid: false,
      error: 'Channel name can only contain lowercase letters, numbers, hyphens, and underscores.',
    };
  }
  return { valid: true };
}

/**
 * Phase 9: Factory to create a canonical Channel Metadata object.
 *
 * @param {Object} params
 * @param {string} params.channelId - Normalized channel slug
 * @param {string} params.name - Human-readable channel name
 * @param {string} [params.topic=''] - Purpose/description of the channel
 * @param {string} [params.type=CHANNEL_TYPES.WORKSPACE] - 'workspace' | 'public'
 * @param {boolean} [params.isDefault=false] - true for #general
 * @param {boolean} [params.archived=false] - true if archived
 * @param {string} params.createdBy - Leader UID
 * @param {number} [params.createdAt=Date.now()] - Creation timestamp
 * @returns {Object}
 */
export function createCanonicalChannelMetadata({
  channelId,
  name,
  topic = '',
  type = CHANNEL_TYPES.WORKSPACE,
  isDefault = false,
  archived = false,
  createdBy,
  createdAt = Date.now(),
}) {
  const cleanId = (channelId || '').trim().toLowerCase();
  const cleanName = (name || cleanId).trim();
  const cleanType = type === CHANNEL_TYPES.PUBLIC ? CHANNEL_TYPES.PUBLIC : CHANNEL_TYPES.WORKSPACE;

  return {
    channelId: cleanId,
    name: cleanName,
    topic: (topic || '').trim().substring(0, 250),
    type: cleanType,
    isDefault: Boolean(isDefault || cleanId === DEFAULT_CHAT_CHANNEL_ID),
    archived: Boolean(archived),
    createdBy: createdBy || 'system',
    createdAt: typeof createdAt === 'number' ? createdAt : Date.now(),
  };
}




