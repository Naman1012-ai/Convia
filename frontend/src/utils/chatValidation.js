/**
 * Convia Chat System — Centralized Chat Validation & Normalization Utilities (Phase 2)
 * Enforces data contracts, boundary constraints, and backward-compatible normalization.
 */

import {
  CHAT_MAX_CONTENT_LENGTH,
  DEFAULT_CHAT_CHANNEL_ID,
  SYSTEM_MESSAGE_TYPES,
  ATTACHMENT_CATEGORIES,
  SUPPORTED_REACTIONS,
  isValidReactionEmoji,
} from '../constants/chatSchema.js';

/**
 * Validates parameters for member message creation.
 *
 * @param {Object} params
 * @param {string} params.workspaceId - Target workspace/organization ID
 * @param {string} [params.channelId] - Target channel ID (defaults to 'general')
 * @param {string} [params.content] - Message text content
 * @param {Object} params.user - Authenticated user object with uid
 * @param {Object|null} [params.attachment] - Optional file attachment object
 * @returns {{ valid: boolean, trimmedContent: string, sanitizedAttachment: Object|null }}
 * @throws {Error} If any validation rule fails
 */
export function validateSendMessage({
  workspaceId,
  channelId = DEFAULT_CHAT_CHANNEL_ID,
  content = '',
  user,
  attachment = null,
}) {
  if (!workspaceId || typeof workspaceId !== 'string' || !workspaceId.trim()) {
    throw new Error('Workspace ID is required.');
  }

  if (!channelId || typeof channelId !== 'string' || !channelId.trim()) {
    throw new Error('Channel ID is required.');
  }

  if (!user || typeof user !== 'object' || !user.uid || typeof user.uid !== 'string' || !user.uid.trim()) {
    throw new Error('Authenticated user identity is required.');
  }

  // Security: Normal member send flow must not claim system sender identity
  if (user.uid.trim().toLowerCase() === 'system') {
    throw new Error('Normal member message creation cannot use system sender identity.');
  }

  const rawContent = typeof content === 'string' ? content : '';
  const trimmedContent = rawContent.trim();

  // Validate attachment structure if provided
  let sanitizedAttachment = null;
  if (attachment) {
    const attachmentValidation = validateAttachment(attachment);
    sanitizedAttachment = attachmentValidation.sanitizedAttachment;
  }

  // A message must have non-empty text content OR a valid attachment
  if (!trimmedContent && !sanitizedAttachment) {
    throw new Error('Message content or attachment is required.');
  }

  if (trimmedContent.length > CHAT_MAX_CONTENT_LENGTH) {
    throw new Error(`Message content exceeds the ${CHAT_MAX_CONTENT_LENGTH} character limit.`);
  }

  return {
    valid: true,
    trimmedContent,
    sanitizedAttachment,
  };
}

/**
 * Validates parameters for message editing.
 *
 * @param {Object} params
 * @param {string} params.workspaceId - Target workspace ID
 * @param {string} [params.channelId] - Channel ID
 * @param {string} params.messageId - Target message ID
 * @param {string} params.newContent - Updated message text
 * @param {string} params.userId - Authenticated user UID
 * @param {Object} [params.currentMessage] - Existing message snapshot from database
 * @returns {{ valid: boolean, trimmedContent: string }}
 * @throws {Error} If validation fails
 */
export function validateEditMessage({
  workspaceId,
  channelId = DEFAULT_CHAT_CHANNEL_ID,
  messageId,
  newContent,
  userId,
  currentMessage = null,
}) {
  if (!workspaceId || typeof workspaceId !== 'string' || !workspaceId.trim()) {
    throw new Error('Workspace ID is required.');
  }

  if (!channelId || typeof channelId !== 'string' || !channelId.trim()) {
    throw new Error('Channel ID is required.');
  }

  if (!messageId || typeof messageId !== 'string' || !messageId.trim()) {
    throw new Error('Message ID is required.');
  }

  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    throw new Error('User ID is required.');
  }

  if (typeof newContent !== 'string' || !newContent.trim()) {
    throw new Error('Message content cannot be empty.');
  }

  const trimmedContent = newContent.trim();
  if (trimmedContent.length > CHAT_MAX_CONTENT_LENGTH) {
    throw new Error(`Message content exceeds the ${CHAT_MAX_CONTENT_LENGTH} character limit.`);
  }

  if (currentMessage) {
    if (currentMessage.deleted) {
      throw new Error('Deleted messages cannot be edited.');
    }
    if (currentMessage.isSystem) {
      throw new Error('System messages cannot be edited.');
    }
    if (currentMessage.senderId !== userId) {
      throw new Error('You can only edit your own messages.');
    }
  }

  return {
    valid: true,
    trimmedContent,
  };
}

/**
 * Validates parameters for message deletion.
 *
 * @param {Object} params
 * @param {string} params.workspaceId - Target workspace ID
 * @param {string} [params.channelId] - Channel ID
 * @param {string} params.messageId - Target message ID
 * @param {string} params.userId - Authenticated user UID
 * @param {boolean} [params.isWorkspaceAdmin] - Whether caller is workspace owner/admin
 * @param {Object} [params.currentMessage] - Existing message snapshot from database
 * @returns {{ valid: boolean }}
 * @throws {Error} If validation fails
 */
export function validateDeleteMessage({
  workspaceId,
  channelId = DEFAULT_CHAT_CHANNEL_ID,
  messageId,
  userId,
  isWorkspaceAdmin = false,
  currentMessage = null,
}) {
  if (!workspaceId || typeof workspaceId !== 'string' || !workspaceId.trim()) {
    throw new Error('Workspace ID is required.');
  }

  if (!channelId || typeof channelId !== 'string' || !channelId.trim()) {
    throw new Error('Channel ID is required.');
  }

  if (!messageId || typeof messageId !== 'string' || !messageId.trim()) {
    throw new Error('Message ID is required.');
  }

  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    throw new Error('User ID is required.');
  }

  if (currentMessage) {
    const isOwner = currentMessage.senderId === userId;
    if (!isOwner && !isWorkspaceAdmin) {
      throw new Error('You do not have permission to delete this message.');
    }
  }

  return { valid: true };
}

/**
 * Defensively validates an attachment object.
 *
 * @param {Object|null} attachment
 * @param {string} [uploaderUid] - Expected uploader UID
 * @returns {{ valid: boolean, sanitizedAttachment: Object|null }}
 * @throws {Error} If attachment structure is invalid
 */
export function validateAttachment(attachment, uploaderUid = null) {
  if (!attachment) {
    return { valid: true, sanitizedAttachment: null };
  }

  if (typeof attachment !== 'object' || Array.isArray(attachment)) {
    throw new Error('Attachment must be an object.');
  }

  const fileName = (attachment.fileName || attachment.filename || '').trim();
  if (!fileName) {
    throw new Error('Attachment fileName is required.');
  }

  const url = (attachment.url || attachment.downloadURL || '').trim();
  if (!url) {
    throw new Error('Attachment URL is required.');
  }

  const size = typeof attachment.size === 'number' && attachment.size >= 0 ? attachment.size : 0;
  const mimeType = (attachment.mimeType || 'application/octet-stream').trim();
  const fileId = (attachment.fileId || attachment.uploadthingKey || `ut_${Date.now()}`).trim();
  const uploadthingKey = (attachment.uploadthingKey || attachment.storagePath || fileId).trim();
  const extension = (attachment.extension || fileName.split('.').pop() || 'file').toLowerCase().trim();

  let category = (attachment.category || 'file').toLowerCase().trim();
  if (!Object.values(ATTACHMENT_CATEGORIES).includes(category)) {
    category = 'file';
  }

  const uploadedBy = (attachment.uploadedBy || uploaderUid || '').trim();

  const sanitizedAttachment = {
    fileId,
    fileName,
    extension,
    mimeType,
    size,
    url,
    uploadthingKey,
    uploadedAt: typeof attachment.uploadedAt === 'number' ? attachment.uploadedAt : Date.now(),
    uploadedBy,
    category,
  };

  return {
    valid: true,
    sanitizedAttachment,
  };
}

/**
 * Validates system event dispatching parameters.
 *
 * @param {Object} params
 * @param {string} params.workspaceId - Target workspace ID
 * @param {string} [params.channelId] - Channel ID
 * @param {string} params.text - Event message text
 * @param {string} [params.systemType] - System event type
 * @returns {{ valid: boolean, trimmedText: string, sanitizedType: string }}
 * @throws {Error} If validation fails
 */
export function validateSystemEvent({
  workspaceId,
  channelId = DEFAULT_CHAT_CHANNEL_ID,
  text,
  systemType = SYSTEM_MESSAGE_TYPES.SYSTEM,
}) {
  if (!workspaceId || typeof workspaceId !== 'string' || !workspaceId.trim()) {
    throw new Error('Workspace ID is required.');
  }

  if (!channelId || typeof channelId !== 'string' || !channelId.trim()) {
    throw new Error('Channel ID is required.');
  }

  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('System event text cannot be empty.');
  }

  const trimmedText = text.trim();
  if (trimmedText.length > CHAT_MAX_CONTENT_LENGTH) {
    throw new Error(`System event text exceeds the ${CHAT_MAX_CONTENT_LENGTH} character limit.`);
  }

  const sanitizedType = (systemType || SYSTEM_MESSAGE_TYPES.SYSTEM).trim();

  return {
    valid: true,
    trimmedText,
    sanitizedType,
  };
}

/**
 * Defensively normalizes a raw message from the database into the canonical ChatMessage structure.
 * Handles missing legacy fields safely without mutating original objects or throwing.
 *
 * @param {Object} raw - Raw database record
 * @param {string} [messageKey] - RTDB push key (canonical identifier)
 * @returns {Object|null} Normalized canonical message or null if corrupt
 */
export function normalizeChatMessage(raw, messageKey = null) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const resolvedId = (messageKey || raw.messageId || raw.id || '').trim();
  if (!resolvedId) {
    return null;
  }

  const isSystem = Boolean(raw.isSystem || raw.senderId === 'system');
  const isDeleted = Boolean(raw.deleted);

  // Safe fallback timestamp
  const createdAt = typeof raw.createdAt === 'number' && !Number.isNaN(raw.createdAt)
    ? raw.createdAt
    : (typeof raw.timestamp === 'number' ? raw.timestamp : Date.now());

  // Normalize attachment if present
  let normalizedAttachment = null;
  if (raw.attachment && typeof raw.attachment === 'object' && !isDeleted) {
    const rawAtt = raw.attachment;
    const attName = rawAtt.fileName || rawAtt.filename || 'Attachment';
    const attUrl = rawAtt.url || rawAtt.downloadURL || '';
    if (attUrl) {
      normalizedAttachment = {
        fileId: rawAtt.fileId || rawAtt.uploadthingKey || `file_${resolvedId}`,
        fileName: attName,
        extension: (rawAtt.extension || attName.split('.').pop() || 'file').toLowerCase(),
        mimeType: rawAtt.mimeType || 'application/octet-stream',
        size: typeof rawAtt.size === 'number' ? rawAtt.size : 0,
        url: attUrl,
        uploadthingKey: rawAtt.uploadthingKey || rawAtt.storagePath || '',
        uploadedAt: typeof rawAtt.uploadedAt === 'number' ? rawAtt.uploadedAt : createdAt,
        uploadedBy: rawAtt.uploadedBy || raw.senderId || '',
        category: rawAtt.category || 'file',
      };
    }
  }

  // Canonical author UID resolution across all historical and contemporary schemas
  const resolvedAuthorUid = isSystem
    ? 'system'
    : (raw.authorUid || raw.senderId || raw.authorId || raw.userId || raw.uid || raw.createdBy || 'unknown');

  const resolvedContent = isDeleted
    ? 'This message was deleted'
    : (raw.content ?? raw.text ?? raw.message ?? raw.body ?? '');

  const resolvedSenderName = isSystem
    ? 'System'
    : (raw.senderName || raw.authorName || raw.displayName || raw.name || 'Member');

  const resolvedSenderAvatar = isSystem
    ? ''
    : (raw.senderAvatar || raw.authorAvatar || raw.avatar || raw.photoURL || '');

  return {
    messageId: resolvedId,
    senderId: resolvedAuthorUid,
    authorUid: resolvedAuthorUid,
    authorId: resolvedAuthorUid,
    senderName: resolvedSenderName,
    senderAvatar: resolvedSenderAvatar,
    content: resolvedContent,
    createdAt,
    editedAt: typeof raw.editedAt === 'number' ? raw.editedAt : null,
    editedBy: raw.editedBy || null,
    deleted: isDeleted,
    deletedAt: typeof raw.deletedAt === 'number' ? raw.deletedAt : (isDeleted ? (raw.updatedAt || null) : null),
    deletedBy: raw.deletedBy || null,
    isSystem,
    systemType: isSystem ? (raw.systemType || SYSTEM_MESSAGE_TYPES.SYSTEM) : null,
    attachment: isDeleted ? null : normalizedAttachment,
    postType: raw.postType || raw.type || null,
  };
}

/**
 * Validates parameters for member reply creation (Phase 6).
 */
export function validateSendReply({
  workspaceId,
  channelId = DEFAULT_CHAT_CHANNEL_ID,
  parentMessageId,
  content,
  user,
  attachment = null,
}) {
  if (!workspaceId || typeof workspaceId !== 'string' || !workspaceId.trim()) {
    throw new Error('Workspace ID is required.');
  }

  if (!channelId || typeof channelId !== 'string' || !channelId.trim()) {
    throw new Error('Channel ID is required.');
  }

  if (!parentMessageId || typeof parentMessageId !== 'string' || !parentMessageId.trim()) {
    throw new Error('Parent Message ID is required.');
  }

  if (!user || !user.uid || typeof user.uid !== 'string') {
    throw new Error('Authenticated user with valid UID is required to reply.');
  }

  if (user.uid === 'system') {
    throw new Error('Client cannot send replies as system.');
  }

  const rawContent = typeof content === 'string' ? content : '';
  const trimmedContent = rawContent.trim();

  let sanitizedAttachment = null;
  if (attachment) {
    sanitizedAttachment = validateAttachment(attachment);
  }

  if (!trimmedContent && !sanitizedAttachment) {
    throw new Error('Reply content or attachment is required.');
  }

  if (trimmedContent.length > CHAT_MAX_CONTENT_LENGTH) {
    throw new Error(`Reply content exceeds the ${CHAT_MAX_CONTENT_LENGTH} character limit.`);
  }

  return {
    valid: true,
    trimmedContent,
    sanitizedAttachment,
  };
}

/**
 * Validates parameters for reply editing (Phase 6).
 */
export function validateEditReply({
  workspaceId,
  channelId = DEFAULT_CHAT_CHANNEL_ID,
  parentMessageId,
  replyId,
  newContent,
  userId,
  currentReply = null,
}) {
  if (!workspaceId || typeof workspaceId !== 'string' || !workspaceId.trim()) {
    throw new Error('Workspace ID is required.');
  }

  if (!channelId || typeof channelId !== 'string' || !channelId.trim()) {
    throw new Error('Channel ID is required.');
  }

  if (!parentMessageId || typeof parentMessageId !== 'string' || !parentMessageId.trim()) {
    throw new Error('Parent Message ID is required.');
  }

  if (!replyId || typeof replyId !== 'string' || !replyId.trim()) {
    throw new Error('Reply ID is required.');
  }

  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    throw new Error('User ID is required.');
  }

  if (typeof newContent !== 'string' || !newContent.trim()) {
    throw new Error('Reply content cannot be empty.');
  }

  const trimmedContent = newContent.trim();
  if (trimmedContent.length > CHAT_MAX_CONTENT_LENGTH) {
    throw new Error(`Reply content exceeds the ${CHAT_MAX_CONTENT_LENGTH} character limit.`);
  }

  if (currentReply) {
    if (currentReply.deleted) {
      throw new Error('Deleted replies cannot be edited.');
    }
    if (currentReply.senderId !== userId) {
      throw new Error('You can only edit your own replies.');
    }
  }

  return {
    valid: true,
    trimmedContent,
  };
}

/**
 * Validates parameters for reply deletion (Phase 6).
 */
export function validateDeleteReply({
  workspaceId,
  channelId = DEFAULT_CHAT_CHANNEL_ID,
  parentMessageId,
  replyId,
  userId,
  isWorkspaceAdmin = false,
  currentReply = null,
}) {
  if (!workspaceId || typeof workspaceId !== 'string' || !workspaceId.trim()) {
    throw new Error('Workspace ID is required.');
  }

  if (!channelId || typeof channelId !== 'string' || !channelId.trim()) {
    throw new Error('Channel ID is required.');
  }

  if (!parentMessageId || typeof parentMessageId !== 'string' || !parentMessageId.trim()) {
    throw new Error('Parent Message ID is required.');
  }

  if (!replyId || typeof replyId !== 'string' || !replyId.trim()) {
    throw new Error('Reply ID is required.');
  }

  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    throw new Error('User ID is required.');
  }

  if (currentReply) {
    const isOwner = currentReply.senderId === userId;
    if (!isOwner && !isWorkspaceAdmin) {
      throw new Error('You do not have permission to delete this reply.');
    }
  }

  return { valid: true };
}

/**
 * Validates emoji reaction toggle parameters (Phase 6).
 */
export function validateReactionToggle({
  workspaceId,
  channelId = DEFAULT_CHAT_CHANNEL_ID,
  messageId,
  emoji,
  user,
}) {
  if (!workspaceId || typeof workspaceId !== 'string' || !workspaceId.trim()) {
    throw new Error('Workspace ID is required.');
  }

  if (!channelId || typeof channelId !== 'string' || !channelId.trim()) {
    throw new Error('Channel ID is required.');
  }

  if (!messageId || typeof messageId !== 'string' || !messageId.trim()) {
    throw new Error('Message ID is required.');
  }

  if (!user || !user.uid || typeof user.uid !== 'string') {
    throw new Error('Authenticated user with valid UID is required to react.');
  }

  if (!emoji || typeof emoji !== 'string' || !isValidReactionEmoji(emoji.trim())) {
    throw new Error(`Unsupported emoji reaction: "${emoji}". Supported reactions: ${SUPPORTED_REACTIONS.join(' ')}`);
  }

  return {
    valid: true,
    cleanEmoji: emoji.trim(),
    userId: user.uid.trim(),
  };
}

/**
 * Normalizes a raw reply snapshot into a clean CanonicalChatReply object (Phase 6).
 */
export function normalizeChatReply(raw, replyKey = null) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const resolvedId = (replyKey || raw.replyId || raw.id || '').trim();
  if (!resolvedId) {
    return null;
  }

  const isDeleted = Boolean(raw.deleted);
  const createdAt = typeof raw.createdAt === 'number' && !Number.isNaN(raw.createdAt)
    ? raw.createdAt
    : (typeof raw.timestamp === 'number' ? raw.timestamp : Date.now());

  let normalizedAttachment = null;
  if (raw.attachment && typeof raw.attachment === 'object' && !isDeleted) {
    const rawAtt = raw.attachment;
    const attName = rawAtt.fileName || rawAtt.filename || 'Attachment';
    const attUrl = rawAtt.url || rawAtt.downloadURL || '';
    if (attUrl) {
      normalizedAttachment = {
        fileId: rawAtt.fileId || rawAtt.uploadthingKey || `file_${resolvedId}`,
        fileName: attName,
        extension: (rawAtt.extension || attName.split('.').pop() || 'file').toLowerCase(),
        mimeType: rawAtt.mimeType || 'application/octet-stream',
        size: typeof rawAtt.size === 'number' ? rawAtt.size : 0,
        url: attUrl,
        uploadthingKey: rawAtt.uploadthingKey || rawAtt.storagePath || '',
        uploadedAt: typeof rawAtt.uploadedAt === 'number' ? rawAtt.uploadedAt : createdAt,
        uploadedBy: rawAtt.uploadedBy || raw.senderId || '',
        category: rawAtt.category || 'file',
      };
    }
  }

  return {
    replyId: resolvedId,
    parentMessageId: (raw.parentMessageId || '').trim(),
    senderId: raw.senderId || 'unknown',
    senderName: raw.senderName || raw.authorName || 'Member',
    senderAvatar: raw.senderAvatar || raw.avatar || '',
    content: isDeleted ? 'This message was deleted' : (raw.content || ''),
    createdAt,
    editedAt: typeof raw.editedAt === 'number' ? raw.editedAt : null,
    editedBy: raw.editedBy || null,
    deleted: isDeleted,
    deletedAt: typeof raw.deletedAt === 'number' ? raw.deletedAt : (isDeleted ? (raw.updatedAt || null) : null),
    deletedBy: raw.deletedBy || null,
    attachment: isDeleted ? null : normalizedAttachment,
  };
}
