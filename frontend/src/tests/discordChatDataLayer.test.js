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

});
