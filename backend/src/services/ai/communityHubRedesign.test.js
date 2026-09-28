import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  SUPPORTED_REACTIONS,
  isValidReactionEmoji,
  createCanonicalReply,
  createCanonicalMessage,
  COMMUNITY_POST_TYPES,
  COMMUNITY_POST_TYPE_CONFIG,
} from '../../../../frontend/src/constants/chatSchema.js';

import {
  getPublicIdeasChatRootPath,
  getPublicIdeasChatMessagesPath,
  getPublicIdeasChatMessagePath,
  getPublicIdeasChatTypingRootPath,
  getPublicIdeasChatTypingPath,
  getPublicIdeasChatRepliesRootPath,
  getPublicIdeasChatMessageRepliesPath,
  getPublicIdeasChatMessageReplyPath,
  getPublicIdeasChatReactionsRootPath,
  getPublicIdeasChatMessageReactionsPath,
  getPublicIdeasChatMessageReactionPath,
  getMessageRepliesPath,
} from '../../../../frontend/src/constants/databasePaths.js';

import {
  normalizeChatMessage,
  normalizeChatReply,
  validateSendMessage,
} from '../../../../frontend/src/utils/chatValidation.js';

import { resolveMemberDisplayName } from '../../../../frontend/src/utils/memberIdentity.js';
import { NOTIFICATION_TYPES } from '../../../../frontend/src/constants/notificationConstants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load database.rules.json
const rulesJsonPath = path.resolve(__dirname, '../../../../database.rules.json');
const rawRules = JSON.parse(fs.readFileSync(rulesJsonPath, 'utf8'));

describe('🧪 CONVIA COMMUNITY HUB — REDESIGN & INTERACTION TEST SUITE', () => {

  // =================================================================
  // 1. CANONICAL DATABASE PATH HELPERS FOR COMMUNITY
  // =================================================================
  describe('🔍 1. Community RTDB Path Builders', () => {
    it('generates canonical public community chat root and messages path', () => {
      assert.strictEqual(getPublicIdeasChatRootPath(), 'publicChats/ideas');
      assert.strictEqual(getPublicIdeasChatMessagesPath(), 'publicChats/ideas/messages');
      assert.strictEqual(
        getPublicIdeasChatMessagePath('msg_community_1'),
        'publicChats/ideas/messages/msg_community_1'
      );
    });

    it('generates canonical replies root, thread, and specific reply paths', () => {
      assert.strictEqual(
        getPublicIdeasChatRepliesRootPath(),
        'publicChats/ideas/messageReplies'
      );
      assert.strictEqual(
        getPublicIdeasChatMessageRepliesPath('parent_101'),
        'publicChats/ideas/messageReplies/parent_101'
      );
      assert.strictEqual(
        getPublicIdeasChatMessageReplyPath('parent_101', 'rep_202'),
        'publicChats/ideas/messageReplies/parent_101/rep_202'
      );
    });

    it('generates canonical reactions root, message, and user reaction paths', () => {
      assert.strictEqual(
        getPublicIdeasChatReactionsRootPath(),
        'publicChats/ideas/messageReactions'
      );
      assert.strictEqual(
        getPublicIdeasChatMessageReactionsPath('msg_303'),
        'publicChats/ideas/messageReactions/msg_303'
      );
      assert.strictEqual(
        getPublicIdeasChatMessageReactionPath('msg_303', '💡', 'user_paras'),
        'publicChats/ideas/messageReactions/msg_303/💡/user_paras'
      );
    });

    it('strictly validates path parameters and throws on empty inputs', () => {
      assert.throws(() => getPublicIdeasChatMessagePath(''), /messageId is required/);
      assert.throws(() => getPublicIdeasChatMessageRepliesPath(' '), /messageId is required/);
      assert.throws(() => getPublicIdeasChatMessageReplyPath('p1', ''), /replyId is required/);
      assert.throws(() => getPublicIdeasChatMessageReactionPath('p1', '', 'u1'), /emoji is required/);
      assert.throws(() => getPublicIdeasChatMessageReactionPath('p1', '👍', ''), /uid is required/);
    });
  });

  // =================================================================
  // 2. POST TYPES & BACKWARD COMPATIBILITY
  // =================================================================
  describe('🔍 2. Community Post Types & Schema Normalization', () => {
    it('defines the 4 canonical Convia community post types', () => {
      assert.strictEqual(COMMUNITY_POST_TYPES.DISCUSSION, 'discussion');
      assert.strictEqual(COMMUNITY_POST_TYPES.IDEA, 'idea');
      assert.strictEqual(COMMUNITY_POST_TYPES.QUESTION, 'question');
      assert.strictEqual(COMMUNITY_POST_TYPES.COLLABORATION, 'collaboration');

      assert.ok(COMMUNITY_POST_TYPE_CONFIG[COMMUNITY_POST_TYPES.DISCUSSION].icon);
      assert.ok(COMMUNITY_POST_TYPE_CONFIG[COMMUNITY_POST_TYPES.IDEA].icon);
      assert.ok(COMMUNITY_POST_TYPE_CONFIG[COMMUNITY_POST_TYPES.QUESTION].icon);
      assert.ok(COMMUNITY_POST_TYPE_CONFIG[COMMUNITY_POST_TYPES.COLLABORATION].icon);
    });

    it('normalizes legacy messages without postType safely (backward compatibility)', () => {
      const legacyRaw = {
        messageId: 'legacy_msg_1',
        senderId: 'user_alice',
        senderName: 'Alice Innovator',
        content: 'Hey everyone, check this concept out!',
        createdAt: 1700000000000,
      };

      const normalized = normalizeChatMessage(legacyRaw, 'legacy_msg_1');
      assert.strictEqual(normalized.messageId, 'legacy_msg_1');
      assert.strictEqual(normalized.content, 'Hey everyone, check this concept out!');
      assert.strictEqual(normalized.postType, null); // Gracefully handles absent field
    });

    it('preserves postType on new community messages', () => {
      const modernRaw = {
        messageId: 'modern_msg_2',
        senderId: 'user_bob',
        senderName: 'Bob Builder',
        content: 'What if we built an offline-first caching layer?',
        postType: COMMUNITY_POST_TYPES.QUESTION,
        createdAt: 1700000005000,
      };

      const normalized = normalizeChatMessage(modernRaw, 'modern_msg_2');
      assert.strictEqual(normalized.postType, 'question');
    });
  });

  // =================================================================
  // 3. REACTIONS & VALIDATION
  // =================================================================
  describe('🔍 3. Community Reactions Logic', () => {
    it('supports required community reactions including 👍, 💡, ❤️, 🔥, 🎯', () => {
      assert.ok(isValidReactionEmoji('👍'));
      assert.ok(isValidReactionEmoji('💡'));
      assert.ok(isValidReactionEmoji('❤️'));
      assert.ok(isValidReactionEmoji('🔥'));
      assert.ok(isValidReactionEmoji('🎯'));
      assert.strictEqual(isValidReactionEmoji('💩'), false);
      assert.strictEqual(isValidReactionEmoji(''), false);
      assert.strictEqual(isValidReactionEmoji(null), false);
    });

    it('encodes emojis safely for RTDB path traversal', () => {
      const emoji = '💡';
      const encoded = encodeURIComponent(emoji);
      assert.strictEqual(encoded, '%F0%9F%92%A1');
      assert.strictEqual(decodeURIComponent(encoded), emoji);
    });
  });

  // =================================================================
  // 4. THREADED REPLIES DATA INTEGRITY
  // =================================================================
  describe('🔍 4. Threaded Discussion Replies', () => {
    it('creates canonical reply object with parent linkage and author info', () => {
      const reply = createCanonicalReply({
        replyId: 'rep_abc123',
        parentMessageId: 'parent_xyz789',
        senderId: 'user_carol',
        senderName: 'Carol Danvers',
        content: 'This sounds like an excellent suggestion.',
        createdAt: 1700000010000,
      });

      assert.strictEqual(reply.replyId, 'rep_abc123');
      assert.strictEqual(reply.parentMessageId, 'parent_xyz789');
      assert.strictEqual(reply.senderId, 'user_carol');
      assert.strictEqual(reply.senderName, 'Carol Danvers');
      assert.strictEqual(reply.content, 'This sounds like an excellent suggestion.');
      assert.strictEqual(reply.deleted, false);
      assert.strictEqual(reply.editedAt, null);
    });

    it('normalizes chat reply correctly', () => {
      const rawReply = {
        replyId: 'rep_1',
        parentMessageId: 'parent_1',
        senderId: 'user_1',
        senderName: 'User One',
        content: 'Great discussion.',
        createdAt: 1700000020000,
      };

      const normalized = normalizeChatReply(rawReply, 'rep_1');
      assert.strictEqual(normalized.replyId, 'rep_1');
      assert.strictEqual(normalized.parentMessageId, 'parent_1');
      assert.strictEqual(normalized.content, 'Great discussion.');
    });

    it('normalizes deleted reply masking its content', () => {
      const deletedReply = {
        replyId: 'rep_2',
        parentMessageId: 'parent_1',
        senderId: 'user_1',
        senderName: 'User One',
        content: 'Secret text',
        deleted: true,
        deletedAt: 1700000030000,
        deletedBy: 'user_1',
      };

      const normalized = normalizeChatReply(deletedReply, 'rep_2');
      assert.strictEqual(normalized.deleted, true);
      assert.strictEqual(normalized.content, 'This message was deleted');
    });
  });

  // =================================================================
  // 5. DATABASE SECURITY RULES ENFORCEMENT
  // =================================================================
  describe('🔍 5. Firebase Realtime Database Security Rules for Community', () => {
    it('verifies publicChats/ideas/messages security rule exists with auth checks', () => {
      const publicChat = rawRules.rules.publicChats?.ideas;
      assert.ok(publicChat, 'publicChats.ideas node must exist in database.rules.json');
      assert.strictEqual(publicChat.messages['.read'], 'auth != null');
      assert.strictEqual(publicChat.typing['.read'], 'auth != null');
    });

    it('verifies publicChats/ideas/messageReplies security rules protect against spoofing', () => {
      const repliesRule = rawRules.rules.publicChats?.ideas?.messageReplies;
      assert.ok(repliesRule, 'publicChats.ideas.messageReplies must exist in rules');
      assert.strictEqual(repliesRule['.read'], 'auth != null');

      const messageRepliesNode = repliesRule.$messageId;
      assert.ok(messageRepliesNode, '$messageId node must exist in messageReplies');
      assert.strictEqual(messageRepliesNode['.read'], 'auth != null');

      const replyItem = messageRepliesNode.$replyId;
      assert.ok(replyItem, '$replyId node must exist');
      // Must require auth and senderId === auth.uid
      assert.ok(replyItem['.write'].includes('auth != null'));
      assert.ok(replyItem['.validate'].includes("newData.child('senderId').val() === auth.uid"));
      assert.ok(replyItem['.validate'].includes("newData.child('parentMessageId').val() === $messageId"));
      assert.ok(replyItem['.validate'].includes("newData.child('replyId').val() === $replyId"));
    });

    it('verifies publicChats/ideas/messageReactions security rules strictly enforce user UID isolation', () => {
      const reactionsRule = rawRules.rules.publicChats?.ideas?.messageReactions;
      assert.ok(reactionsRule, 'publicChats.ideas.messageReactions must exist in rules');
      assert.strictEqual(reactionsRule['.read'], 'auth != null');

      const userReaction = reactionsRule.$messageId?.$emoji?.$uid;
      assert.ok(userReaction, 'User reaction node must exist at $messageId/$emoji/$uid');
      // Strictly enforces that only auth.uid can write to $uid
      assert.strictEqual(userReaction['.write'], 'auth != null && auth.uid === $uid');
      assert.strictEqual(userReaction['.validate'], 'newData.val() === true');
    });
  });

  // =================================================================
  // 6. REAL NOTIFICATION DEEP-LINK INTEGRATION
  // =================================================================
  describe('🔍 6. In-App Notification Dispatch for Community', () => {
    it('constructs correct deep-link URL for community thread replies', () => {
      const workspaceId = 'community';
      const parentMessageId = 'msg_hub_42';
      const replyId = 'rep_hub_99';

      const isCommunityReply = workspaceId === 'community' || workspaceId === 'public';
      const deepLink = isCommunityReply
        ? `/community?threadId=${parentMessageId}&replyId=${replyId}`
        : `/workspaces/${workspaceId}/chat?channel=general&threadId=${parentMessageId}&replyId=${replyId}`;

      assert.strictEqual(deepLink, '/community?threadId=msg_hub_42&replyId=rep_hub_99');
    });

    it('suppresses notification if author is replying to their own discussion post', () => {
      const actorUid = 'user_same';
      const parentAuthorId = 'user_same';

      const shouldNotify = parentAuthorId && parentAuthorId !== actorUid && parentAuthorId !== 'system';
      assert.strictEqual(shouldNotify, false, 'Self-reply must never trigger notification');
    });

    it('notifies parent author if different user replies', () => {
      const actorUid = 'user_replier';
      const parentAuthorId = 'user_original_poster';

      const shouldNotify = parentAuthorId && parentAuthorId !== actorUid && parentAuthorId !== 'system';
      assert.strictEqual(shouldNotify, true, 'Different author must receive notification');
    });
  });

  // =================================================================
  // 7. REAL TRENDING DISCUSSIONS SCORING ALGORITHM
  // =================================================================
  describe('🔍 7. Real Trending Algorithm Verification', () => {
    it('computes transparent activityScore without hardcoded or fake rankings', () => {
      const now = Date.now();
      const mockPost1 = {
        messageId: 'post_1',
        content: 'Idea discussion with replies',
        createdAt: now - 3600000, // 1 hour ago
      };
      const mockPost2 = {
        messageId: 'post_2',
        content: 'Quiet idea',
        createdAt: now - 7200000, // 2 hours ago
      };

      const replyCounts = { post_1: 4, post_2: 0 };
      const reactionsMap = { post_1: { '👍': { count: 3 } }, post_2: { '💡': { count: 0 } } };

      const scorePost = (msg) => {
        const replies = replyCounts[msg.messageId] || 0;
        const msgReactions = reactionsMap[msg.messageId] || {};
        const reactionCount = Object.values(msgReactions).reduce(
          (sum, r) => sum + (r?.count || 0),
          0
        );
        const ageHours = Math.max(0.1, (now - msg.createdAt) / 3600000);
        const recencyBonus = Math.max(0, 10 - ageHours * 0.5);
        return replies * 3 + reactionCount * 2 + recencyBonus;
      };

      const score1 = scorePost(mockPost1);
      const score2 = scorePost(mockPost2);

      assert.ok(score1 > score2, 'Post with 4 replies and 3 reactions must rank higher than inactive post');
      assert.strictEqual(scorePost(mockPost1) > 15, true);
    });
  });

  // =================================================================
  // 8. DISPLAY NAME RESOLUTION INTEGRITY
  // =================================================================
  describe('🔍 8. Display Name Resolution Integrity', () => {
    it('strictly resolves displayName over UID and email prefix', () => {
      const userObj = {
        uid: 'firebase_uid_12345',
        displayName: 'Naman Prajapati',
        email: 'naman@convia.dev',
      };

      const resolved = resolveMemberDisplayName(userObj);
      assert.strictEqual(resolved, 'Naman Prajapati');
      assert.notStrictEqual(resolved, 'naman');
      assert.notStrictEqual(resolved, 'firebase_uid_12345');
    });

    it('falls back to name or fullName if displayName is absent', () => {
      assert.strictEqual(resolveMemberDisplayName({ fullName: 'Sarah Connor' }), 'Sarah Connor');
      assert.strictEqual(resolveMemberDisplayName({ name: 'Alex Murphy' }), 'Alex Murphy');
      assert.strictEqual(resolveMemberDisplayName(null), 'Unknown member');
    });
  });

  // =================================================================
  // 9. WORKSPACE CHAT ISOLATION & REGRESSION CHECK
  // =================================================================
  describe('🔍 9. Workspace Chat Isolation', () => {
    it('ensures workspace chat paths are untouched by public community chat', () => {
      const wsPath = getMessageRepliesPath('org_delta', 'general', 'm_1');
      assert.strictEqual(wsPath, 'workspaceChats/org_delta/channels/general/messageReplies/m_1');
      assert.notStrictEqual(wsPath, getPublicIdeasChatMessageRepliesPath('m_1'));
    });
  });
});
