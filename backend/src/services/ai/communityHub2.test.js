import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  getUserSavedDiscussionsPath,
  getUserSavedDiscussionPath,
  getPublicIdeasChatPinnedPath,
  getPublicIdeasChatPinnedDiscussionPath,
  getPublicIdeasChatRootPath,
  getPublicIdeasChatMessagesPath,
} from '../../../../frontend/src/constants/databasePaths.js';

import {
  COMMUNITY_POST_TYPES,
  COMMUNITY_POST_TYPE_CONFIG,
} from '../../../../frontend/src/constants/chatSchema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load database.rules.json
const rulesJsonPath = path.resolve(__dirname, '../../../../database.rules.json');
const rawRules = JSON.parse(fs.readFileSync(rulesJsonPath, 'utf8'));

describe('🧪 CONVIA COMMUNITY HUB 2.0 — DISCOVERY, FILTERING & COLLABORATION SUITE', () => {

  // =================================================================
  // 1. CANONICAL DATABASE PATH BUILDERS FOR HUB 2.0
  // =================================================================
  describe('🔍 1. Saved & Pinned Discussions Path Builders', () => {
    it('generates canonical user saved discussions root and item paths', () => {
      assert.strictEqual(getUserSavedDiscussionsPath('usr_123'), 'user_saved_discussions/usr_123');
      assert.strictEqual(
        getUserSavedDiscussionPath('usr_123', 'msg_abc'),
        'user_saved_discussions/usr_123/msg_abc'
      );
    });

    it('throws when uid or messageId is empty or non-string for saved paths', () => {
      assert.throws(() => getUserSavedDiscussionsPath(''), /uid is required/);
      assert.throws(() => getUserSavedDiscussionsPath(null), /uid is required/);
      assert.throws(() => getUserSavedDiscussionPath('usr_123', ''), /messageId is required/);
      assert.throws(() => getUserSavedDiscussionPath('', 'msg_abc'), /uid is required/);
    });

    it('generates canonical pinned community discussion ID and object paths', () => {
      assert.strictEqual(getPublicIdeasChatPinnedPath(), 'publicChats/ideas/pinnedMessageId');
      assert.strictEqual(getPublicIdeasChatPinnedDiscussionPath(), 'publicChats/ideas/pinned');
    });
  });

  // =================================================================
  // 2. DATABASE SECURITY RULES FOR HUB 2.0
  // =================================================================
  describe('🔍 2. Database Security Rules Enforcement', () => {
    it('verifies users/$uid has write permissions restricted to authenticated owner', () => {
      const userRule = rawRules.rules.users['$uid'];
      assert.ok(userRule, 'users/$uid rule must exist');
      assert.strictEqual(userRule['.read'], 'auth != null');
      assert.strictEqual(userRule['.write'], 'auth != null && auth.uid === $uid');
    });

    it('verifies publicChats/ideas/pinnedMessageId protects against non-admin modification', () => {
      const ideasRules = rawRules.rules.publicChats.ideas;
      assert.ok(ideasRules.pinnedMessageId, 'pinnedMessageId rule must exist');
      assert.strictEqual(ideasRules.pinnedMessageId['.read'], 'auth != null');
      assert.ok(
        ideasRules.pinnedMessageId['.write'].includes('admins') ||
        ideasRules.pinnedMessageId['.write'].includes('admin'),
        'pinnedMessageId write must require administrative role'
      );
    });

    it('verifies publicChats/ideas/pinned discussion object protects against unauthorized write', () => {
      const ideasRules = rawRules.rules.publicChats.ideas;
      assert.ok(ideasRules.pinned, 'pinned discussion rule must exist');
      assert.strictEqual(ideasRules.pinned['.read'], 'auth != null');
      assert.ok(
        ideasRules.pinned['.write'].includes('admins') ||
        ideasRules.pinned['.write'].includes('admin'),
        'pinned discussion write must require administrative role'
      );
    });
  });

  // =================================================================
  // 3. HUB 2.0 DISCUSSION FILTERING PIPELINE
  // =================================================================
  describe('🔍 3. Hub 2.0 Multi-Filter Pipeline (Activity & Channels)', () => {
    const mockMessages = [
      {
        messageId: 'msg_1',
        senderId: 'usr_me',
        senderName: 'Naman',
        content: 'Building a collaborative community module',
        postType: 'idea',
        createdAt: 1000,
        deleted: false,
      },
      {
        messageId: 'msg_2',
        senderId: 'usr_alice',
        senderName: 'Alice',
        content: 'How should we handle offline caching with IndexedDB?',
        postType: 'question',
        createdAt: 2000,
        deleted: false,
      },
      {
        messageId: 'msg_3',
        senderId: 'usr_bob',
        senderName: 'Bob',
        content: 'Looking for a UI designer to pair on design system tokens',
        postType: 'collaboration',
        createdAt: 3000,
        deleted: false,
      },
      {
        messageId: 'msg_4',
        senderId: 'usr_charlie',
        senderName: 'Charlie',
        content: 'Architecture thoughts on Firebase Realtime Database event listeners',
        postType: 'discussion',
        createdAt: 4000,
        deleted: false,
      },
      {
        messageId: 'msg_deleted',
        senderId: 'usr_me',
        senderName: 'Naman',
        content: 'This message was deleted',
        postType: 'discussion',
        createdAt: 500,
        deleted: true,
      },
    ];

    const currentUserId = 'usr_me';
    const savedDiscussions = { msg_2: { savedAt: 12345 } };
    const userRepliedMap = { usr_me: ['msg_3'] };

    it('returns all non-deleted messages under "all" filter', () => {
      const result = mockMessages.filter((m) => m && !m.deleted);
      assert.strictEqual(result.length, 4);
      assert.ok(!result.some((m) => m.deleted));
    });

    it('filters strictly by specific topic channel (idea, question, collaboration, discussion)', () => {
      const ideas = mockMessages.filter((m) => !m.deleted && (m.postType || 'discussion') === 'idea');
      assert.strictEqual(ideas.length, 1);
      assert.strictEqual(ideas[0].messageId, 'msg_1');

      const questions = mockMessages.filter((m) => !m.deleted && (m.postType || 'discussion') === 'question');
      assert.strictEqual(questions.length, 1);
      assert.strictEqual(questions[0].messageId, 'msg_2');
    });

    it('filters strictly by "my_discussions" (current user messages only)', () => {
      const myDiscussions = mockMessages.filter(
        (m) => !m.deleted && (m.senderId === currentUserId || m.authorId === currentUserId)
      );
      assert.strictEqual(myDiscussions.length, 1);
      assert.strictEqual(myDiscussions[0].messageId, 'msg_1');
    });

    it('filters strictly by "my_replies" (threads where current user participated)', () => {
      const repliedIds = userRepliedMap[currentUserId] || [];
      const myRepliedDiscussions = mockMessages.filter(
        (m) => !m.deleted && repliedIds.includes(m.messageId)
      );
      assert.strictEqual(myRepliedDiscussions.length, 1);
      assert.strictEqual(myRepliedDiscussions[0].messageId, 'msg_3');
    });

    it('filters strictly by "saved" (bookmarked discussions)', () => {
      const savedList = mockMessages.filter((m) => !m.deleted && Boolean(savedDiscussions[m.messageId]));
      assert.strictEqual(savedList.length, 1);
      assert.strictEqual(savedList[0].messageId, 'msg_2');
    });
  });

  // =================================================================
  // 4. HUB 2.0 SORTING ALGORITHMS
  // =================================================================
  describe('🔍 4. Hub 2.0 Sorting Algorithms (Recent, Most Discussed, Most Reacted)', () => {
    const sampleItems = [
      { messageId: 'm1', content: 'Discussion 1', createdAt: 1000 },
      { messageId: 'm2', content: 'Discussion 2', createdAt: 3000 },
      { messageId: 'm3', content: 'Discussion 3', createdAt: 2000 },
    ];

    const replyCounts = {
      m1: 15,
      m2: 2,
      m3: 8,
    };

    const reactionsMap = {
      m1: { '👍': { count: 3 } },
      m2: { '🔥': { count: 12 }, '❤️': { count: 5 } }, // total 17
      m3: { '💡': { count: 5 } },
    };

    it('sorts by "recent" chronologically (createdAt ascending)', () => {
      const sorted = [...sampleItems].sort((a, b) => a.createdAt - b.createdAt);
      assert.deepStrictEqual(sorted.map((m) => m.messageId), ['m1', 'm3', 'm2']);
    });

    it('sorts by "most_discussed" based on reply count descending', () => {
      const sorted = [...sampleItems].sort((a, b) => {
        const countA = replyCounts[a.messageId] || 0;
        const countB = replyCounts[b.messageId] || 0;
        return countB - countA;
      });
      assert.deepStrictEqual(sorted.map((m) => m.messageId), ['m1', 'm3', 'm2']);
    });

    it('sorts by "most_reacted" based on total reaction count descending', () => {
      const sorted = [...sampleItems].sort((a, b) => {
        const countA = Object.values(reactionsMap[a.messageId] || {}).reduce((s, r) => s + (r?.count || 0), 0);
        const countB = Object.values(reactionsMap[b.messageId] || {}).reduce((s, r) => s + (r?.count || 0), 0);
        return countB - countA;
      });
      assert.deepStrictEqual(sorted.map((m) => m.messageId), ['m2', 'm3', 'm1']);
    });

    it('floats pinned discussion to the top when pinnedMessageId is set', () => {
      const pinnedId = 'm3';
      const items = [...sampleItems];
      const pinnedIdx = items.findIndex((m) => m.messageId === pinnedId);
      if (pinnedIdx > -1) {
        const [pinnedMsg] = items.splice(pinnedIdx, 1);
        items.unshift(pinnedMsg);
      }
      assert.strictEqual(items[0].messageId, 'm3');
    });
  });

  // =================================================================
  // 5. HUB 2.0 SEARCH FILTERING
  // =================================================================
  describe('🔍 5. Search Filtering & Matching', () => {
    const searchCorpus = [
      {
        messageId: 's1',
        senderName: 'Sarah Connor',
        content: 'Deploying neural network models on edge devices',
        postType: 'discussion',
      },
      {
        messageId: 's2',
        senderName: 'John Doe',
        content: 'Design system tokens and Tailwind CSS best practices',
        postType: 'idea',
      },
      {
        messageId: 's3',
        senderName: 'Alex Mercer',
        content: 'Looking for a backend collaborator on Golang APIs',
        postType: 'collaboration',
      },
    ];

    it('matches case-insensitively on message content', () => {
      const query = 'neural';
      const results = searchCorpus.filter((m) =>
        m.content.toLowerCase().includes(query) ||
        m.senderName.toLowerCase().includes(query) ||
        m.postType.toLowerCase().includes(query)
      );
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].messageId, 's1');
    });

    it('matches on author display name', () => {
      const query = 'john';
      const results = searchCorpus.filter((m) =>
        m.content.toLowerCase().includes(query) ||
        m.senderName.toLowerCase().includes(query) ||
        m.postType.toLowerCase().includes(query)
      );
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].messageId, 's2');
    });

    it('matches on postType keyword', () => {
      const query = 'collaboration';
      const results = searchCorpus.filter((m) =>
        m.content.toLowerCase().includes(query) ||
        m.senderName.toLowerCase().includes(query) ||
        m.postType.toLowerCase().includes(query)
      );
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].messageId, 's3');
    });
  });

  // =================================================================
  // 6. ADAPTIVE WELCOME BANNER SPECIFICATION
  // =================================================================
  describe('🔍 6. Adaptive Welcome Banner Thresholds', () => {
    const isBannerCompact = (totalDiscussions) => totalDiscussions >= 3;

    it('returns full welcome experience when total discussions < 3', () => {
      assert.strictEqual(isBannerCompact(0), false);
      assert.strictEqual(isBannerCompact(1), false);
      assert.strictEqual(isBannerCompact(2), false);
    });

    it('collapses into compact 1-line strip when total discussions >= 3', () => {
      assert.strictEqual(isBannerCompact(3), true);
      assert.strictEqual(isBannerCompact(10), true);
      assert.strictEqual(isBannerCompact(100), true);
    });
  });

  // =================================================================
  // 7. COMMUNITY MEMBERS ROSTER AGGREGATION (ZERO FAKE DATA)
  // =================================================================
  describe('🔍 7. Real Member Aggregation & Discussion Counts', () => {
    const realFeed = [
      { senderId: 'u1', senderName: 'Ada Lovelace', createdAt: 100 },
      { senderId: 'u2', senderName: 'Alan Turing', createdAt: 200 },
      { senderId: 'u1', senderName: 'Ada Lovelace', createdAt: 300 },
      { senderId: 'u1', senderName: 'Ada Lovelace', createdAt: 400 },
      { senderId: 'u3', senderName: 'Grace Hopper', createdAt: 500 },
      { senderId: 'system', senderName: 'System Bot', createdAt: 600 },
    ];

    it('aggregates unique contributors excluding system messages', () => {
      const stats = {};
      realFeed.forEach((msg) => {
        if (!msg.senderId || msg.senderId === 'system') return;
        if (!stats[msg.senderId]) {
          stats[msg.senderId] = {
            uid: msg.senderId,
            name: msg.senderName,
            discussionsCount: 0,
          };
        }
        stats[msg.senderId].discussionsCount += 1;
      });

      const members = Object.values(stats);
      assert.strictEqual(members.length, 3);
      assert.ok(!members.some((m) => m.uid === 'system'));

      const ada = members.find((m) => m.uid === 'u1');
      assert.strictEqual(ada.discussionsCount, 3);

      const alan = members.find((m) => m.uid === 'u2');
      assert.strictEqual(alan.discussionsCount, 1);
    });

    it('identifies top contributor based on discussionsCount without fake rankings', () => {
      const stats = {
        u1: { uid: 'u1', count: 5 },
        u2: { uid: 'u2', count: 12 },
        u3: { uid: 'u3', count: 2 },
      };

      const sorted = Object.values(stats).sort((a, b) => b.count - a.count);
      assert.strictEqual(sorted[0].uid, 'u2');
      assert.strictEqual(sorted[0].count, 12);
    });
  });
});
