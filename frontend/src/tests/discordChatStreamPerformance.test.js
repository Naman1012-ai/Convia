import { describe, it } from 'node:test';
import assert from 'node:assert';
import { processMessageFeed, isConsecutiveMessageGroup } from '../utils/chatFeedHelpers.js';
import { createProvisionalMessage, reconcileProvisionalMessage, upsertMessage } from '../utils/chatPagination.js';

describe('Discord Phase 5 — Performance & Virtualized Stream Benchmark Suite', () => {
  // Generate 500 realistic messages
  const generateMessageFixture = (count = 500) => {
    const authors = ['u_alice', 'u_bob', 'u_carol', 'u_dave'];
    const baseTime = 1700000000000;
    const messages = [];

    for (let i = 0; i < count; i++) {
      const author = i > 0 && i % 3 !== 0 ? messages[i - 1].senderId : authors[i % authors.length];
      const timeDelta = i > 0 && author === messages[i - 1].senderId ? 60 * 1000 : 10 * 60 * 1000;
      const createdAt = i === 0 ? baseTime : messages[i - 1].createdAt + timeDelta;

      messages.push({
        messageId: `msg_${i}`,
        senderId: author,
        senderName: `Member ${author}`,
        content: `Message ${i} discussing **important** feature with \`code snippet\` and @alice`,
        createdAt,
        editedAt: null,
        deleted: false,
        isSystem: false,
      });
    }

    return messages;
  };

  it('1. processMessageFeed processes 500 messages efficiently', () => {
    const fixture = generateMessageFixture(500);

    // Warm-up
    processMessageFeed(fixture.slice(0, 10), 'u_alice');

    const start = performance.now();
    const feed = processMessageFeed(fixture, 'u_alice');
    const elapsed = performance.now() - start;

    assert.ok(feed.length >= 500, 'Feed should include messages and date dividers');
    assert.ok(elapsed < 120, `Feed processing should be ultra-fast (<120ms), took ${elapsed.toFixed(2)}ms`);

    // Verify consecutive grouping was accurately calculated
    const groupedCount = feed.filter((item) => item.isGrouped).length;
    assert.ok(groupedCount > 0, 'Should have properly grouped consecutive messages');
  });

  it('2. High-throughput optimistic nonce reconciliation on 500 messages', () => {
    let list = generateMessageFixture(500);
    const provisional = createProvisionalMessage({
      content: 'Sending new idea...',
      user: { uid: 'u_alice', displayName: 'Alice' },
    });
    list = upsertMessage(list, provisional);

    const confirmed = {
      messageId: '-O_server_key_7788',
      clientNonce: provisional.clientNonce,
      senderId: 'u_alice',
      senderName: 'Alice',
      content: 'Sending new idea...',
      createdAt: Date.now(),
    };

    const start = performance.now();
    const reconciled = reconcileProvisionalMessage(list, confirmed);
    const elapsed = performance.now() - start;

    assert.ok(elapsed < 15, `Reconciliation took ${elapsed.toFixed(2)}ms`);
    assert.strictEqual(reconciled.length, 501);
    const found = reconciled.find((m) => m.messageId === '-O_server_key_7788');
    assert.ok(found, 'Server confirmed message must exist in stream');
    assert.strictEqual(found.status, 'sent');
  });

  it('3. Consecutive grouping correctness across 5-minute boundaries', () => {
    const msg1 = { messageId: '1', senderId: 'u_alice', createdAt: 1000000, isSystem: false };
    const msg2 = { messageId: '2', senderId: 'u_alice', createdAt: 1000000 + 4 * 60 * 1000, isSystem: false }; // 4 mins (grouped)
    const msg3 = { messageId: '3', senderId: 'u_alice', createdAt: 1000000 + 6 * 60 * 1000, isSystem: false }; // 6 mins (not grouped)
    const msg4 = { messageId: '4', senderId: 'u_bob', createdAt: 1000000 + 1 * 60 * 1000, isSystem: false }; // different author

    assert.strictEqual(isConsecutiveMessageGroup(msg1, msg2), true);
    assert.strictEqual(isConsecutiveMessageGroup(msg1, msg3), false);
    assert.strictEqual(isConsecutiveMessageGroup(msg1, msg4), false);
  });
});
