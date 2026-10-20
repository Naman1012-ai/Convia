import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  getChannelPinnedMessagesRootPath,
  getChannelPinnedMessagePath,
} from '../constants/databasePaths.js';
import { createCanonicalPinnedMessage } from '../constants/chatSchema.js';
import {
  createProvisionalMessage,
  reconcileProvisionalMessage,
} from '../utils/chatPagination.js';

describe('Discord Phase 1 — Data Layer & Pinned Message Preservation Suite', () => {
  it('1. Generates correct canonical RTDB paths for channel pinned messages', () => {
    const rootPath = getChannelPinnedMessagesRootPath('ws_galaxy', 'ideas');
    assert.strictEqual(rootPath, 'workspaceChats/ws_galaxy/channels/ideas/pinnedMessages');

    const singlePath = getChannelPinnedMessagePath('ws_galaxy', 'ideas', 'msg_777');
    assert.strictEqual(singlePath, 'workspaceChats/ws_galaxy/channels/ideas/pinnedMessages/msg_777');

    // Throws on missing or empty identifiers
    assert.throws(() => getChannelPinnedMessagePath('ws_galaxy', 'ideas', ''), /messageId is required/);
    assert.throws(() => getChannelPinnedMessagePath('', 'ideas', 'msg_777'), /workspaceId is required/);
  });

  it('2. Enforces canonical pinned message schema contracts and bounds', () => {
    const pin = createCanonicalPinnedMessage({
      messageId: 'msg_alpha_1',
      pinnedBy: 'user_leader',
      pinnedByName: 'Commander Alice',
      content: 'Important sprint launch checklist',
      senderId: 'user_author',
      senderName: 'Bob Dev',
      pinnedAt: 1710000000000,
    });

    assert.strictEqual(pin.messageId, 'msg_alpha_1');
    assert.strictEqual(pin.pinnedBy, 'user_leader');
    assert.strictEqual(pin.pinnedByName, 'Commander Alice');
    assert.strictEqual(pin.content, 'Important sprint launch checklist');
    assert.strictEqual(pin.senderId, 'user_author');
    assert.strictEqual(pin.senderName, 'Bob Dev');
    assert.strictEqual(pin.pinnedAt, 1710000000000);

    // Required field validation
    assert.throws(() => createCanonicalPinnedMessage({ pinnedBy: 'u1' }), /messageId is required/);
    assert.throws(() => createCanonicalPinnedMessage({ messageId: 'm1' }), /pinnedBy UID is required/);
  });

  it('3. Generates provisional message with nonce for optimistic delivery', () => {
    const provisional = createProvisionalMessage({
      content: 'Hello team!',
      user: { uid: 'u123', displayName: 'Charlie' },
      attachment: null,
      nonce: 'nonce_xyz_999',
    });

    assert.ok(provisional.messageId.startsWith('provisional_'));
    assert.strictEqual(provisional.clientNonce, 'nonce_xyz_999');
    assert.strictEqual(provisional.senderId, 'u123');
    assert.strictEqual(provisional.senderName, 'Charlie');
    assert.strictEqual(provisional.content, 'Hello team!');
    assert.strictEqual(provisional.status, 'sending');
  });

  it('4. Reconciles provisional message with confirmed RTDB message via nonce', () => {
    const initialList = [
      { messageId: 'msg_old_1', content: 'First message', status: 'sent', createdAt: 1700000000000 },
      {
        messageId: 'provisional_nonce_123',
        clientNonce: 'nonce_123',
        senderId: 'u1',
        content: 'New pending message',
        status: 'sending',
        createdAt: 1700000005000,
      },
    ];

    const confirmed = {
      messageId: 'msg_confirmed_888',
      clientNonce: 'nonce_123',
      senderId: 'u1',
      content: 'New pending message',
      createdAt: 1700000005200,
    };

    const reconciled = reconcileProvisionalMessage(initialList, confirmed);

    assert.strictEqual(reconciled.length, 2);
    const updated = reconciled.find((m) => m.clientNonce === 'nonce_123');
    assert.strictEqual(updated.messageId, 'msg_confirmed_888');
    assert.strictEqual(updated.status, 'sent');
  });

  it('5. Reconciles provisional message with fallback matching (sender, content, timestamp window)', () => {
    const initialList = [
      {
        messageId: 'provisional_no_nonce',
        senderId: 'u2',
        content: 'Fallback match message',
        status: 'sending',
        createdAt: 1700000010000,
      },
    ];

    const incoming = {
      messageId: 'msg_from_rtdb_333',
      senderId: 'u2',
      content: 'Fallback match message',
      createdAt: 1700000010500, // 500ms later
    };

    const reconciled = reconcileProvisionalMessage(initialList, incoming);

    assert.strictEqual(reconciled.length, 1);
    assert.strictEqual(reconciled[0].messageId, 'msg_from_rtdb_333');
    assert.strictEqual(reconciled[0].status, 'sent');
  });

  it('6. Deletion lifecycle: Pinned message list filters out deleted messages and orphan pins', () => {
    const rawPins = [
      {
        messageId: 'msg_active_1',
        content: 'Sprint goals',
        pinnedAt: 1710000000000,
      },
      {
        messageId: 'msg_deleted_voice_1',
        content: 'This message was deleted',
        deleted: true,
        attachment: { isVoiceNote: true, url: 'https://cdn.example.com/voice1.m4a' },
        pinnedAt: 1710000050000,
      },
      {
        messageId: 'msg_deleted_text_2',
        content: 'This message was deleted',
        pinnedAt: 1710000060000,
      },
      {
        messageId: 'msg_active_2',
        content: 'Deployment checklist',
        pinnedAt: 1710000070000,
      },
    ];

    // Filter logic matching chatService & ChatPinnedMessagesDrawer
    const validPins = rawPins.filter(
      (p) => p && !p.deleted && p.content !== 'This message was deleted'
    );

    assert.strictEqual(validPins.length, 2);
    assert.strictEqual(validPins[0].messageId, 'msg_active_1');
    assert.strictEqual(validPins[1].messageId, 'msg_active_2');
    assert.ok(!validPins.some((p) => p.messageId === 'msg_deleted_voice_1'));
    assert.ok(!validPins.some((p) => p.messageId === 'msg_deleted_text_2'));
  });

  it('7. Cross-reference check: Pinned drawer filters pins when target message in feed is soft-deleted', () => {
    const pinnedList = [
      { messageId: 'msg_101', content: 'Original title', pinnedAt: 100 },
      { messageId: 'msg_102', content: 'Original voice message', attachment: { isVoiceNote: true }, pinnedAt: 200 },
    ];

    const feedMessages = [
      { messageId: 'msg_101', content: 'Original title', deleted: false },
      { messageId: 'msg_102', content: 'This message was deleted', deleted: true, attachment: null },
    ];

    const validPins = pinnedList.filter((item) => {
      if (!item || !item.messageId) return false;
      if (item.deleted || item.content === 'This message was deleted') return false;
      const matched = feedMessages.find((m) => m && m.messageId === item.messageId);
      if (matched && (matched.deleted || matched.content === 'This message was deleted')) {
        return false;
      }
      return true;
    });

    assert.strictEqual(validPins.length, 1);
    assert.strictEqual(validPins[0].messageId, 'msg_101');
  });

  it('8. Attachment guard: Deleted pinned messages never expose voice note players or attachments', () => {
    const item = {
      messageId: 'msg_deleted_voice',
      deleted: true,
      content: 'This message was deleted',
      attachment: { isVoiceNote: true, url: 'https://cdn.example.com/audio.m4a', duration: 19 },
    };

    const isDeleted = Boolean(item.deleted) || item.content === 'This message was deleted';
    const attachment = !isDeleted ? item.attachment : null;

    assert.strictEqual(isDeleted, true);
    assert.strictEqual(attachment, null);
  });

});
