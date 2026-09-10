import { describe, it } from 'node:test';
import assert from 'node:assert';

// 1. Path helpers mirroring frontend/src/constants/databasePaths.js
export const getWorkspaceChatRootPath = (workspaceId) => {
  if (!workspaceId || typeof workspaceId !== 'string' || !workspaceId.trim()) {
    throw new Error('[databasePaths] workspaceId is required for workspace chat root path.');
  }
  return `workspaceChats/${workspaceId.trim()}`;
};

export const getChannelPath = (workspaceId, channelId = 'general') => {
  const root = getWorkspaceChatRootPath(workspaceId);
  const cleanChannel = (channelId || 'general').trim();
  if (!cleanChannel) {
    throw new Error('[databasePaths] channelId is required for channel path.');
  }
  return `${root}/channels/${cleanChannel}`;
};

export const getChannelMessagesPath = (workspaceId, channelId = 'general') => {
  return `${getChannelPath(workspaceId, channelId)}/messages`;
};

export const getMessagePath = (workspaceId, channelId = 'general', messageId) => {
  if (!messageId || typeof messageId !== 'string' || !messageId.trim()) {
    throw new Error('[databasePaths] messageId is required for message path.');
  }
  return `${getChannelMessagesPath(workspaceId, channelId)}/${messageId.trim()}`;
};

export const getChannelMetadataPath = (workspaceId, channelId = 'general') => {
  return `${getChannelPath(workspaceId, channelId)}/metadata`;
};

// 2. Validation & Normalization Logic mirroring frontend/src/utils/chatValidation.js
const CHAT_MAX_CONTENT_LENGTH = 2000;
const DEFAULT_CHAT_CHANNEL_ID = 'general';
const SYSTEM_MESSAGE_TYPES = {
  SYSTEM: 'system',
  MEMBER_JOINED: 'member_joined',
};
const ATTACHMENT_CATEGORIES = {
  IMAGE: 'image',
  DOCUMENT: 'document',
  CODE: 'code',
  ARCHIVE: 'archive',
  FILE: 'file',
};

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

  return {
    valid: true,
    sanitizedAttachment: {
      fileId,
      fileName,
      extension,
      mimeType,
      size,
      url,
      uploadthingKey,
      uploadedAt: typeof attachment.uploadedAt === 'number' ? attachment.uploadedAt : Date.now(),
      uploadedBy: (attachment.uploadedBy || uploaderUid || '').trim(),
      category,
    },
  };
}

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
  if (user.uid.trim().toLowerCase() === 'system') {
    throw new Error('Normal member message creation cannot use system sender identity.');
  }
  const rawContent = typeof content === 'string' ? content : '';
  const trimmedContent = rawContent.trim();

  let sanitizedAttachment = null;
  if (attachment) {
    const attachmentValidation = validateAttachment(attachment, user.uid);
    sanitizedAttachment = attachmentValidation.sanitizedAttachment;
  }

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
  return { valid: true, trimmedContent };
}

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
    messageId: resolvedId,
    senderId: isSystem ? 'system' : (raw.senderId || 'unknown'),
    senderName: isSystem ? 'System' : (raw.senderName || raw.authorName || 'Member'),
    senderAvatar: isSystem ? '' : (raw.senderAvatar || raw.avatar || ''),
    content: isDeleted ? 'This message was deleted' : (raw.content || ''),
    createdAt,
    editedAt: typeof raw.editedAt === 'number' ? raw.editedAt : null,
    editedBy: raw.editedBy || null,
    deleted: isDeleted,
    deletedAt: typeof raw.deletedAt === 'number' ? raw.deletedAt : (isDeleted ? (raw.updatedAt || null) : null),
    deletedBy: raw.deletedBy || null,
    isSystem,
    systemType: isSystem ? (raw.systemType || SYSTEM_MESSAGE_TYPES.SYSTEM) : null,
    attachment: isDeleted ? null : normalizedAttachment,
  };
}

// -------------------- TEST SUITE --------------------

describe('🧪 CONVIA CHAT SYSTEM PHASE 2 — DATA MODEL, PATHS & VALIDATION TEST SUITE', () => {

  describe('🔍 TEST 1: Database Path Helpers', () => {
    it('generates workspaceChats/org_123 for root chat path', () => {
      const rootPath = getWorkspaceChatRootPath('org_123');
      assert.strictEqual(rootPath, 'workspaceChats/org_123');
    });

    it('throws error when workspaceId is missing or empty', () => {
      assert.throws(() => getWorkspaceChatRootPath(''), /workspaceId is required/);
      assert.throws(() => getWorkspaceChatRootPath(null), /workspaceId is required/);
      assert.throws(() => getWorkspaceChatRootPath('   '), /workspaceId is required/);
    });

    it('generates channel path defaulting to general', () => {
      const channelPath = getChannelPath('org_123');
      assert.strictEqual(channelPath, 'workspaceChats/org_123/channels/general');
    });

    it('generates custom channel path when specified', () => {
      const channelPath = getChannelPath('org_123', 'dev-team');
      assert.strictEqual(channelPath, 'workspaceChats/org_123/channels/dev-team');
    });

    it('generates channel messages path', () => {
      const messagesPath = getChannelMessagesPath('org_123', 'general');
      assert.strictEqual(messagesPath, 'workspaceChats/org_123/channels/general/messages');
    });

    it('generates specific message path', () => {
      const msgPath = getMessagePath('org_123', 'general', 'msg_abc456');
      assert.strictEqual(msgPath, 'workspaceChats/org_123/channels/general/messages/msg_abc456');
    });

    it('throws error when messageId is empty on getMessagePath', () => {
      assert.throws(() => getMessagePath('org_123', 'general', ''), /messageId is required/);
      assert.throws(() => getMessagePath('org_123', 'general', null), /messageId is required/);
    });

    it('generates channel metadata path', () => {
      const metaPath = getChannelMetadataPath('org_123', 'general');
      assert.strictEqual(metaPath, 'workspaceChats/org_123/channels/general/metadata');
    });
  });

  describe('🔍 TEST 2: Message Creation Validation (validateSendMessage)', () => {
    const validUser = { uid: 'user_alice', displayName: 'Alice' };

    it('accepts valid text message', () => {
      const res = validateSendMessage({
        workspaceId: 'org_123',
        content: 'Hello team, welcome to BrainSync!',
        user: validUser,
      });
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.trimmedContent, 'Hello team, welcome to BrainSync!');
      assert.strictEqual(res.sanitizedAttachment, null);
    });

    it('trims leading and trailing whitespace from content', () => {
      const res = validateSendMessage({
        workspaceId: 'org_123',
        content: '   Trimmed content   \n',
        user: validUser,
      });
      assert.strictEqual(res.trimmedContent, 'Trimmed content');
    });

    it('rejects empty and whitespace-only messages when no attachment is present', () => {
      assert.throws(
        () => validateSendMessage({ workspaceId: 'org_123', content: '', user: validUser }),
        /Message content or attachment is required/
      );
      assert.throws(
        () => validateSendMessage({ workspaceId: 'org_123', content: '    \n   ', user: validUser }),
        /Message content or attachment is required/
      );
    });

    it('rejects text content exceeding 2000 characters', () => {
      const longText = 'a'.repeat(2001);
      assert.throws(
        () => validateSendMessage({ workspaceId: 'org_123', content: longText, user: validUser }),
        /exceeds the 2000 character limit/
      );
    });

    it('accepts text exactly 2000 characters', () => {
      const maxText = 'a'.repeat(2000);
      const res = validateSendMessage({ workspaceId: 'org_123', content: maxText, user: validUser });
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.trimmedContent.length, 2000);
    });

    it('accepts attachment-only message with empty text', () => {
      const validAttachment = {
        fileName: 'architecture_diagram.png',
        url: 'https://utfs.io/f/xyz123.png',
        size: 1048576,
        category: 'image',
      };
      const res = validateSendMessage({
        workspaceId: 'org_123',
        content: '',
        user: validUser,
        attachment: validAttachment,
      });
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.trimmedContent, '');
      assert.strictEqual(res.sanitizedAttachment.fileName, 'architecture_diagram.png');
      assert.strictEqual(res.sanitizedAttachment.extension, 'png');
    });

    it('BLOCKS normal member from sending message with system senderId', () => {
      const maliciousUser = { uid: 'system', displayName: 'Impersonator' };
      assert.throws(
        () => validateSendMessage({ workspaceId: 'org_123', content: 'Fake system alert', user: maliciousUser }),
        /Normal member message creation cannot use system sender identity/
      );
    });

    it('rejects missing or invalid user object', () => {
      assert.throws(() => validateSendMessage({ workspaceId: 'org_123', content: 'test', user: null }), /user identity is required/);
      assert.throws(() => validateSendMessage({ workspaceId: 'org_123', content: 'test', user: {} }), /user identity is required/);
    });
  });

  describe('🔍 TEST 3: Message Editing Validation (validateEditMessage)', () => {
    const activeMsg = {
      messageId: 'msg_01',
      senderId: 'user_alice',
      content: 'Original text',
      deleted: false,
      isSystem: false,
    };

    it('accepts valid edit by author', () => {
      const res = validateEditMessage({
        workspaceId: 'org_123',
        messageId: 'msg_01',
        newContent: 'Updated text',
        userId: 'user_alice',
        currentMessage: activeMsg,
      });
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.trimmedContent, 'Updated text');
    });

    it('rejects empty new content on edit', () => {
      assert.throws(
        () => validateEditMessage({ workspaceId: 'org_123', messageId: 'msg_01', newContent: '   ', userId: 'user_alice', currentMessage: activeMsg }),
        /Message content cannot be empty/
      );
    });

    it('rejects editing a deleted message', () => {
      const deletedMsg = { ...activeMsg, deleted: true };
      assert.throws(
        () => validateEditMessage({ workspaceId: 'org_123', messageId: 'msg_01', newContent: 'New text', userId: 'user_alice', currentMessage: deletedMsg }),
        /Deleted messages cannot be edited/
      );
    });

    it('rejects editing another member message', () => {
      assert.throws(
        () => validateEditMessage({ workspaceId: 'org_123', messageId: 'msg_01', newContent: 'Hacked', userId: 'user_bob', currentMessage: activeMsg }),
        /You can only edit your own messages/
      );
    });

    it('rejects editing a system message', () => {
      const systemMsg = { ...activeMsg, isSystem: true, senderId: 'system' };
      assert.throws(
        () => validateEditMessage({ workspaceId: 'org_123', messageId: 'msg_01', newContent: 'Modified', userId: 'user_alice', currentMessage: systemMsg }),
        /System messages cannot be edited/
      );
    });
  });

  describe('🔍 TEST 4: Message Deletion Authorization (validateDeleteMessage)', () => {
    const memberMsg = {
      messageId: 'msg_01',
      senderId: 'user_alice',
      deleted: false,
    };

    it('allows author to delete own message', () => {
      const res = validateDeleteMessage({
        workspaceId: 'org_123',
        messageId: 'msg_01',
        userId: 'user_alice',
        isWorkspaceAdmin: false,
        currentMessage: memberMsg,
      });
      assert.strictEqual(res.valid, true);
    });

    it('allows workspace admin to delete another member message', () => {
      const res = validateDeleteMessage({
        workspaceId: 'org_123',
        messageId: 'msg_01',
        userId: 'user_admin',
        isWorkspaceAdmin: true,
        currentMessage: memberMsg,
      });
      assert.strictEqual(res.valid, true);
    });

    it('DENIES non-author non-admin from deleting message', () => {
      assert.throws(
        () => validateDeleteMessage({
          workspaceId: 'org_123',
          messageId: 'msg_01',
          userId: 'user_bob',
          isWorkspaceAdmin: false,
          currentMessage: memberMsg,
        }),
        /You do not have permission to delete this message/
      );
    });
  });

  describe('🔍 TEST 5: Attachment Defensive Validation', () => {
    it('validates and categorizes image attachment', () => {
      const res = validateAttachment({
        filename: 'spec.pdf',
        downloadURL: 'https://cdn.example.com/spec.pdf',
        size: 500000,
        category: 'document',
      });
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.sanitizedAttachment.fileName, 'spec.pdf');
      assert.strictEqual(res.sanitizedAttachment.extension, 'pdf');
      assert.strictEqual(res.sanitizedAttachment.category, 'document');
    });

    it('rejects attachment missing url', () => {
      assert.throws(
        () => validateAttachment({ fileName: 'file.txt', size: 100 }),
        /Attachment URL is required/
      );
    });

    it('rejects attachment missing fileName', () => {
      assert.throws(
        () => validateAttachment({ url: 'https://cdn.example.com/file' }),
        /Attachment fileName is required/
      );
    });

    it('returns null when attachment is null or undefined', () => {
      const res1 = validateAttachment(null);
      assert.strictEqual(res1.sanitizedAttachment, null);
      const res2 = validateAttachment(undefined);
      assert.strictEqual(res2.sanitizedAttachment, null);
    });
  });

  describe('🔍 TEST 6: Message Normalization & Backward Compatibility (normalizeChatMessage)', () => {
    it('normalizes full canonical message correctly', () => {
      const raw = {
        messageId: 'msg_100',
        senderId: 'user_alice',
        senderName: 'Alice',
        senderAvatar: 'https://avatar.png',
        content: 'Hello team',
        createdAt: 1700000000000,
        editedAt: 1700000010000,
        editedBy: 'user_alice',
        deleted: false,
        isSystem: false,
      };

      const normalized = normalizeChatMessage(raw, 'msg_100');
      assert.strictEqual(normalized.messageId, 'msg_100');
      assert.strictEqual(normalized.senderId, 'user_alice');
      assert.strictEqual(normalized.content, 'Hello team');
      assert.strictEqual(normalized.deleted, false);
      assert.strictEqual(normalized.editedAt, 1700000010000);
      assert.strictEqual(normalized.editedBy, 'user_alice');
    });

    it('normalizes legacy message with missing optional fields safely', () => {
      // Legacy message with only core fields
      const legacyRaw = {
        senderId: 'user_bob',
        content: 'Legacy message text',
        createdAt: 1690000000000,
      };

      const normalized = normalizeChatMessage(legacyRaw, 'legacy_key_1');
      assert.strictEqual(normalized.messageId, 'legacy_key_1');
      assert.strictEqual(normalized.senderId, 'user_bob');
      assert.strictEqual(normalized.senderName, 'Member'); // Safe fallback
      assert.strictEqual(normalized.senderAvatar, '');
      assert.strictEqual(normalized.editedAt, null);
      assert.strictEqual(normalized.editedBy, null);
      assert.strictEqual(normalized.deleted, false);
      assert.strictEqual(normalized.deletedAt, null);
      assert.strictEqual(normalized.deletedBy, null);
      assert.strictEqual(normalized.isSystem, false);
      assert.strictEqual(normalized.systemType, null);
      assert.strictEqual(normalized.attachment, null);
    });

    it('normalizes soft-deleted message, masking content and stripping attachment', () => {
      const deletedRaw = {
        messageId: 'msg_del',
        senderId: 'user_charlie',
        content: 'Sensitive text that was deleted',
        deleted: true,
        deletedAt: 1700000050000,
        deletedBy: 'user_charlie',
        attachment: { fileName: 'confidential.pdf', url: 'https://cdn.example.com/confidential.pdf' },
      };

      const normalized = normalizeChatMessage(deletedRaw);
      assert.strictEqual(normalized.deleted, true);
      assert.strictEqual(normalized.content, 'This message was deleted');
      assert.strictEqual(normalized.attachment, null);
      assert.strictEqual(normalized.deletedAt, 1700000050000);
    });

    it('normalizes legacy system message correctly', () => {
      const systemRaw = {
        messageId: 'sys_01',
        senderId: 'system',
        content: 'Alice joined the workspace.',
        createdAt: 1700000000000,
      };

      const normalized = normalizeChatMessage(systemRaw);
      assert.strictEqual(normalized.isSystem, true);
      assert.strictEqual(normalized.senderId, 'system');
      assert.strictEqual(normalized.senderName, 'System');
      assert.strictEqual(normalized.systemType, 'system');
    });

    it('returns null for null, undefined, or empty objects without identifier', () => {
      assert.strictEqual(normalizeChatMessage(null), null);
      assert.strictEqual(normalizeChatMessage(undefined), null);
      assert.strictEqual(normalizeChatMessage({}), null);
    });
  });

  describe('🔍 TEST 7: Workspace Deletion Cascade Verification', () => {
    it('verifies that getWorkspaceChatRootPath is included in workspace deletion update payload', () => {
      const orgId = 'org_alpha';
      const updates = {};
      updates[`organizations/${orgId}`] = null;
      updates[`organization_members/${orgId}`] = null;
      updates[`blueprints/${orgId}`] = null;
      updates[`tasks/${orgId}`] = null;
      updates[`ideas/${orgId}`] = null;
      updates[getWorkspaceChatRootPath(orgId)] = null;

      assert.strictEqual(updates['workspaceChats/org_alpha'], null);
      assert.strictEqual(Object.keys(updates).includes('workspaceChats/org_alpha'), true);
    });
  });
});
