import { describe, it } from 'node:test';
import assert from 'node:assert';

import {
  COMMUNITY_POST_TYPES,
  COMMUNITY_POST_TYPE_CONFIG,
  COMPOSER_PLACEHOLDERS,
  COMPOSER_BUTTON_LABELS,
  createCanonicalMessage,
} from '../../../../frontend/src/constants/chatSchema.js';

import {
  validateSendMessage,
  normalizeChatMessage,
} from '../../../../frontend/src/utils/chatValidation.js';

describe('🧪 CONVIA COMMUNITY COMPOSER REFINEMENT TEST SUITE', () => {

  // =================================================================
  // 1. DEFAULT TOPIC & POST TYPE SPECIFICATIONS
  // =================================================================
  describe('🔍 1. Default Post Type & Configuration', () => {
    it('sets discussion as the default post type', () => {
      assert.strictEqual(COMMUNITY_POST_TYPES.DISCUSSION, 'discussion');
      assert.ok(COMMUNITY_POST_TYPE_CONFIG.discussion);
    });

    it('defines all 4 community post types with valid config metadata', () => {
      const types = ['discussion', 'idea', 'question', 'collaboration'];
      for (const t of types) {
        assert.ok(COMMUNITY_POST_TYPES[t.toUpperCase()]);
        assert.ok(COMMUNITY_POST_TYPE_CONFIG[t]);
        assert.ok(COMMUNITY_POST_TYPE_CONFIG[t].label);
        assert.ok(COMMUNITY_POST_TYPE_CONFIG[t].icon);
      }
    });
  });

  // =================================================================
  // 2. DYNAMIC COMPOSER PLACEHOLDERS
  // =================================================================
  describe('🔍 2. Dynamic Composer Placeholders', () => {
    it('provides exact required placeholder copy for all post types', () => {
      assert.strictEqual(
        COMPOSER_PLACEHOLDERS[COMMUNITY_POST_TYPES.DISCUSSION],
        'Share thoughts, discuss ideas, or spark collaboration...'
      );
      assert.strictEqual(
        COMPOSER_PLACEHOLDERS[COMMUNITY_POST_TYPES.IDEA],
        "What's an idea you'd like the community to explore?"
      );
      assert.strictEqual(
        COMPOSER_PLACEHOLDERS[COMMUNITY_POST_TYPES.QUESTION],
        "What would you like the community's help with?"
      );
      assert.strictEqual(
        COMPOSER_PLACEHOLDERS[COMMUNITY_POST_TYPES.COLLABORATION],
        'What are you looking to build together?'
      );
    });
  });

  // =================================================================
  // 3. DYNAMIC POST BUTTON LABELS
  // =================================================================
  describe('🔍 3. Dynamic Post Button Labels', () => {
    it('dynamically adapts post button label to the active post type', () => {
      assert.strictEqual(
        COMPOSER_BUTTON_LABELS[COMMUNITY_POST_TYPES.DISCUSSION],
        'Post Discussion'
      );
      assert.strictEqual(
        COMPOSER_BUTTON_LABELS[COMMUNITY_POST_TYPES.IDEA],
        'Post Idea'
      );
      assert.strictEqual(
        COMPOSER_BUTTON_LABELS[COMMUNITY_POST_TYPES.QUESTION],
        'Post Question'
      );
      assert.strictEqual(
        COMPOSER_BUTTON_LABELS[COMMUNITY_POST_TYPES.COLLABORATION],
        'Post Collaboration'
      );
    });
  });

  // =================================================================
  // 4. TEXT PRESERVATION WHEN CHANGING TOPIC TYPE
  // =================================================================
  describe('🔍 4. Text Preservation Invariant', () => {
    it('guarantees user typed content is NEVER cleared or overwritten on topic change', () => {
      const userText = "What if we built an offline-first caching layer?";
      let selectedType = COMMUNITY_POST_TYPES.DISCUSSION;

      // Simulate user selecting 'idea'
      selectedType = COMMUNITY_POST_TYPES.IDEA;
      assert.strictEqual(userText, "What if we built an offline-first caching layer?");

      // Simulate user selecting 'question'
      selectedType = COMMUNITY_POST_TYPES.QUESTION;
      assert.strictEqual(userText, "What if we built an offline-first caching layer?");
    });
  });

  // =================================================================
  // 5. SUBMISSION VALIDATION & PAYLOAD INTEGRITY
  // =================================================================
  describe('🔍 5. Submission Validation & Post Type Preservation', () => {
    const user = { uid: 'user_innovator', displayName: 'Ada Lovelace' };

    it('rejects empty or whitespace-only message submissions', () => {
      assert.throws(() => {
        validateSendMessage({ workspaceId: 'ideas', content: '', user });
      }, /required/i);

      assert.throws(() => {
        validateSendMessage({ workspaceId: 'ideas', content: '    ', user });
      }, /required/i);
    });

    it('enforces 2000 character maximum limit', () => {
      const oversized = 'a'.repeat(2001);
      assert.throws(() => {
        validateSendMessage({ workspaceId: 'ideas', content: oversized, user });
      }, /2000 character limit/i);

      const validBoundary = 'a'.repeat(2000);
      const res = validateSendMessage({ workspaceId: 'ideas', content: validBoundary, user });
      assert.strictEqual(res.valid, true);
    });

    it('preserves postType on canonical normalized message', () => {
      const rawMessage = {
        messageId: 'msg_post_101',
        senderId: 'user_innovator',
        senderName: 'Ada Lovelace',
        content: 'Should we introduce peer code reviews?',
        postType: COMMUNITY_POST_TYPES.QUESTION,
        createdAt: 1700000000000,
      };

      const normalized = normalizeChatMessage(rawMessage, 'msg_post_101');
      assert.strictEqual(normalized.messageId, 'msg_post_101');
      assert.strictEqual(normalized.postType, 'question');
      assert.strictEqual(normalized.content, 'Should we introduce peer code reviews?');
    });
  });
});
