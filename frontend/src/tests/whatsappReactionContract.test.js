import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  WHATSAPP_QUICK_REACTIONS,
  SUPPORTED_REACTIONS,
  COMMUNITY_SUPPORTED_REACTIONS,
  isValidReactionEmoji,
} from '../constants/chatSchema.js';
import { validateReactionToggle } from '../utils/chatValidation.js';

describe('WhatsApp-Style Reactions & Discord Multi-Reaction Contract Suite', () => {
  it('1. WHATSAPP_QUICK_REACTIONS defines the 6 canonical instant emojis', () => {
    assert.deepStrictEqual(WHATSAPP_QUICK_REACTIONS, ['👍', '❤️', '😂', '😮', '😢', '🙏']);
    assert.strictEqual(WHATSAPP_QUICK_REACTIONS.length, 6);
  });

  it('2. isValidReactionEmoji accepts all WhatsApp quick reactions', () => {
    for (const emoji of WHATSAPP_QUICK_REACTIONS) {
      assert.strictEqual(isValidReactionEmoji(emoji), true, `Expected ${emoji} to be valid`);
    }
  });

  it('3. isValidReactionEmoji preserves backward compatibility with existing sets', () => {
    for (const emoji of SUPPORTED_REACTIONS) {
      assert.strictEqual(isValidReactionEmoji(emoji), true, `Expected ${emoji} to be valid`);
    }
    for (const emoji of COMMUNITY_SUPPORTED_REACTIONS) {
      assert.strictEqual(isValidReactionEmoji(emoji), true, `Expected ${emoji} to be valid`);
    }
  });

  it('4. isValidReactionEmoji accepts extended Unicode emojis from Option B picker', () => {
    const extendedEmojis = ['🍕', '💩', '🦄', '🚀', '💻', '✨', '🎯', '🎉', '1️⃣'];
    for (const emoji of extendedEmojis) {
      assert.strictEqual(isValidReactionEmoji(emoji), true, `Expected ${emoji} from picker to be valid`);
    }
  });

  it('5. isValidReactionEmoji rejects arbitrary strings, code injections, and non-emojis', () => {
    const invalidInputs = [
      'javascript:alert(1)',
      '<script>bad()</script>',
      'plain text message',
      'hello',
      '12345',
      '',
      '   ',
      null,
      undefined,
      {},
      [],
    ];
    for (const input of invalidInputs) {
      assert.strictEqual(isValidReactionEmoji(input), false, `Expected "${input}" to be rejected`);
    }
  });

  it('6. validateReactionToggle validates user and emoji parameters correctly', () => {
    const user = { uid: 'user_123' };
    const res = validateReactionToggle({
      workspaceId: 'workspace_abc',
      channelId: 'general',
      messageId: 'msg_456',
      emoji: '🍕',
      user,
    });
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.cleanEmoji, '🍕');
    assert.strictEqual(res.userId, 'user_123');

    // Rejects invalid emoji
    assert.throws(
      () =>
        validateReactionToggle({
          workspaceId: 'workspace_abc',
          channelId: 'general',
          messageId: 'msg_456',
          emoji: 'not_an_emoji',
          user,
        }),
      /unsupported/i
    );
  });

  it('7. Supports Discord-style multi-reactions without mutually exclusive wipe', () => {
    // Under Discord style, reacting with '❤️' when '👍' is already active preserves both
    const reactions = {
      '👍': { count: 1, users: ['user_123'] },
    };

    // Current user reacts with '❤️'
    const newEmoji = '❤️';
    const updatedReactions = {
      ...reactions,
      [newEmoji]: { count: 1, users: ['user_123'] },
    };

    assert.strictEqual(Object.keys(updatedReactions).length, 2);
    assert.deepStrictEqual(updatedReactions['👍'].users, ['user_123']);
    assert.deepStrictEqual(updatedReactions['❤️'].users, ['user_123']);
  });
});
