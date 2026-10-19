import { describe, it } from 'node:test';
import assert from 'node:assert';
import { normalizeChatMessage } from '../utils/chatValidation.js';
import { processMessageFeed } from '../utils/chatFeedHelpers.js';
import { renderDiscordMarkdown } from '../utils/discordMarkdown.js';

describe('Discord Phase 6 — End-to-End Legacy Compatibility & Contract Verification Suite', () => {
  it('1. Backward Compatibility: Normalizes legacy WhatsApp-era messages with zero missing fields', () => {
    // Old legacy message format from earlier versions
    const legacyRawMessage = {
      messageId: 'legacy_msg_001',
      senderId: 'user_alice',
      senderName: 'Alice Pioneer',
      senderAvatar: 'https://example.com/alice.png',
      content: 'Hello team, checking legacy compatibility!',
      createdAt: 1690000000000,
      // No clientNonce, no status, no pinned, no postType
    };

    const normalized = normalizeChatMessage(legacyRawMessage);

    assert.ok(normalized, 'Normalized message must exist');
    assert.strictEqual(normalized.messageId, 'legacy_msg_001');
    assert.strictEqual(normalized.senderId, 'user_alice');
    assert.strictEqual(normalized.senderName, 'Alice Pioneer');
    assert.strictEqual(normalized.content, 'Hello team, checking legacy compatibility!');
    assert.strictEqual(normalized.status, 'sent');
    assert.strictEqual(normalized.deleted, false);
    assert.strictEqual(normalized.isSystem, false);
  });

  it('2. Legacy Fallback: Normalizes legacy system events and soft-deleted messages', () => {
    const deletedRaw = {
      messageId: 'del_001',
      senderId: 'user_bob',
      deleted: true,
      deletedAt: 1690000050000,
      createdAt: 1690000000000,
    };

    const normDeleted = normalizeChatMessage(deletedRaw);
    assert.strictEqual(normDeleted.deleted, true);
    assert.strictEqual(normDeleted.status, 'deleted');
    assert.strictEqual(normDeleted.content, 'This message was deleted');

    const systemRaw = {
      messageId: 'sys_001',
      senderId: 'system',
      isSystem: true,
      content: 'Alice joined the workspace.',
      createdAt: 1690000010000,
    };

    const normSystem = normalizeChatMessage(systemRaw);
    assert.strictEqual(normSystem.isSystem, true);
    assert.strictEqual(normSystem.senderName, 'System');
  });

  it('3. Feed Pipeline: Seamlessly processes mixed legacy, contemporary, and pinned messages', () => {
    const mixedMessages = [
      {
        messageId: 'm1',
        senderId: 'user_alice',
        senderName: 'Alice',
        content: 'Sprint kickoff plan: #sprint-planning',
        createdAt: 1710000000000,
      },
      {
        messageId: 'm2',
        senderId: 'user_alice',
        senderName: 'Alice',
        content: 'Check this link: https://convia.app and ||confidential metric||',
        createdAt: 1710000060000, // 1 min later -> grouped
      },
      {
        messageId: 'm3',
        senderId: 'user_bob',
        senderName: 'Bob',
        content: '> Let us review tomorrow\nAgreed!',
        createdAt: 1710000120000,
      },
    ];

    const feed = processMessageFeed(mixedMessages, 'user_alice');

    // Should contain 1 date divider + 3 messages
    assert.strictEqual(feed.length, 4);
    assert.strictEqual(feed[0].type, 'date_divider');

    // Message 2 should be consecutive grouped with Message 1
    assert.strictEqual(feed[1].isGrouped, false); // Alice 1st message
    assert.strictEqual(feed[2].isGrouped, true); // Alice consecutive (<5 min)
    assert.strictEqual(feed[3].isGrouped, false); // Bob message
  });

  it('4. Markdown Rendering Stability: Renders empty, malicious, and complex markdown without crashing', () => {
    // Empty & null
    assert.strictEqual(renderDiscordMarkdown(''), null);
    assert.strictEqual(renderDiscordMarkdown(null), null);

    // XSS with quotes and code blocks
    const malicious = '<script>evil()</script>\n```js\n<svg onload="hack()">\n```';
    const rendered = renderDiscordMarkdown(malicious);
    assert.ok(rendered);

    // Deep markdown nesting
    const complex = '**Bold with _italic and `code` inside_** plus ~~strike~~ and ||spoiler||';
    const tree = renderDiscordMarkdown(complex);
    assert.ok(tree);
  });

  it('5. Deleted Messages Break Grouping: An active message following a deleted message is never grouped', () => {
    const messages = [
      {
        messageId: 'del_1',
        senderId: 'user_alice',
        senderName: 'Alice',
        content: 'This message was deleted',
        deleted: true,
        createdAt: 1710000000000,
      },
      {
        messageId: 'voice_1',
        senderId: 'user_alice',
        senderName: 'Alice',
        content: '',
        attachment: { isVoiceNote: true, duration: 10 },
        deleted: false,
        createdAt: 1710000060000,
      },
      {
        messageId: 'voice_2',
        senderId: 'user_alice',
        senderName: 'Alice',
        content: '',
        attachment: { isVoiceNote: true, duration: 6 },
        deleted: false,
        createdAt: 1710000120000,
      },
    ];

    const feed = processMessageFeed(messages, 'user_alice');
    assert.strictEqual(feed[1].isGrouped, false);
    assert.strictEqual(feed[2].isGrouped, false, 'First active message after deleted tombstone must not be grouped');
    assert.strictEqual(feed[3].isGrouped, true, 'Subsequent consecutive active messages group under voice_1');
  });
});
