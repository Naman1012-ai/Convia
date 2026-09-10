import { describe, it } from 'node:test';
import assert from 'node:assert';

// Import Path Helpers
import {
  getChannelTypingRootPath,
  getChannelTypingPath,
  getThreadTypingRootPath,
  getThreadTypingPath,
} from '../../../../frontend/src/constants/databasePaths.js';

// Import Schema Contracts & Helpers
import {
  createCanonicalTypingState,
  formatTypingIndicatorText,
} from '../../../../frontend/src/constants/chatSchema.js';

import { resolveMemberDisplayName } from '../../../../frontend/src/utils/memberIdentity.js';

describe('🧪 CONVIA CHAT SYSTEM PHASE 8 — PRESENCE, TYPING INDICATORS & CONNECTION RESILIENCE', () => {
  const mockMembers = [
    { uid: 'user_paras', displayName: 'Paras', username: 'paras_dev', onlineStatus: 'online' },
    { uid: 'user_rahul', displayName: 'Rahul Kumar', username: 'rahulk', onlineStatus: 'offline' },
    { uid: 'user_alex', displayName: 'Alex Johnson', username: 'alexj', onlineStatus: 'online' },
    { uid: 'user_priya', name: 'Priya Patel', username: 'priyap', onlineStatus: 'offline' },
  ];

  // -------------------------------------------------------------
  // Group 1: RTDB Path Helpers
  // -------------------------------------------------------------
  describe('🔍 1. Centralized Phase 8 RTDB Path Helpers', () => {
    it('generates canonical channel typing root and user path', () => {
      const rootPath = getChannelTypingRootPath('org_123', 'general');
      assert.strictEqual(rootPath, 'workspaceChats/org_123/channels/general/typing');

      const userPath = getChannelTypingPath('org_123', 'general', 'user_paras');
      assert.strictEqual(userPath, 'workspaceChats/org_123/channels/general/typing/user_paras');
    });

    it('generates canonical thread typing root and user path', () => {
      const rootPath = getThreadTypingRootPath('org_123', 'general', 'msg_999');
      assert.strictEqual(rootPath, 'workspaceChats/org_123/channels/general/typingThreads/msg_999');

      const userPath = getThreadTypingPath('org_123', 'general', 'msg_999', 'user_rahul');
      assert.strictEqual(userPath, 'workspaceChats/org_123/channels/general/typingThreads/msg_999/user_rahul');
    });

    it('strictly validates path arguments and throws on empty or invalid inputs', () => {
      assert.throws(() => getChannelTypingPath('', 'general', 'user_paras'));
      assert.throws(() => getChannelTypingPath('org_123', 'general', ''));
      assert.throws(() => getThreadTypingRootPath('org_123', 'general', ''));
      assert.throws(() => getThreadTypingPath('org_123', 'general', 'msg_999', ''));
    });
  });

  // -------------------------------------------------------------
  // Group 2: Canonical Typing State Factory
  // -------------------------------------------------------------
  describe('🔍 2. Canonical Typing State Factory', () => {
    it('creates a clean canonical typing state object', () => {
      const now = 1725000000000;
      const state = createCanonicalTypingState({
        uid: 'user_paras',
        displayName: 'Paras',
        startedAt: now,
      });

      assert.strictEqual(state.uid, 'user_paras');
      assert.strictEqual(state.displayName, 'Paras');
      assert.strictEqual(state.startedAt, now);
    });

    it('supplies defaults when optional fields are omitted', () => {
      const state = createCanonicalTypingState({
        uid: 'user_unknown',
      });

      assert.strictEqual(state.uid, 'user_unknown');
      assert.strictEqual(state.displayName, 'Member');
      assert.strictEqual(typeof state.startedAt, 'number');
    });
  });

  // -------------------------------------------------------------
  // Group 3: Typing Indicator Grammar & Formatting
  // -------------------------------------------------------------
  describe('🔍 3. Typing Indicator Grammar & Formatting', () => {
    const now = Date.now();

    it('formats single user typing in channel', () => {
      const typers = [{ uid: 'user_paras', displayName: 'Paras', startedAt: now }];
      const text = formatTypingIndicatorText(typers, 'user_other', false);
      assert.strictEqual(text, 'Paras is typing...');
    });

    it('formats single user typing a reply in thread', () => {
      const typers = [{ uid: 'user_paras', displayName: 'Paras', startedAt: now }];
      const text = formatTypingIndicatorText(typers, 'user_other', true);
      assert.strictEqual(text, 'Paras is typing a reply...');
    });

    it('formats two users typing concurrently', () => {
      const typers = [
        { uid: 'user_paras', displayName: 'Paras', startedAt: now },
        { uid: 'user_rahul', displayName: 'Rahul', startedAt: now },
      ];
      const text = formatTypingIndicatorText(typers, 'user_other', false);
      assert.strictEqual(text, 'Paras and Rahul are typing...');
    });

    it('formats three users typing concurrently', () => {
      const typers = [
        { uid: 'user_paras', displayName: 'Paras', startedAt: now },
        { uid: 'user_rahul', displayName: 'Rahul', startedAt: now },
        { uid: 'user_alex', displayName: 'Alex', startedAt: now },
      ];
      const text = formatTypingIndicatorText(typers, 'user_other', false);
      assert.strictEqual(text, 'Paras, Rahul, and Alex are typing...');
    });

    it('formats four or more users typing with count summary', () => {
      const typers = [
        { uid: 'user_paras', displayName: 'Paras', startedAt: now },
        { uid: 'user_rahul', displayName: 'Rahul', startedAt: now },
        { uid: 'user_alex', displayName: 'Alex', startedAt: now },
        { uid: 'user_priya', displayName: 'Priya', startedAt: now },
      ];
      const text = formatTypingIndicatorText(typers, 'user_other', false);
      assert.strictEqual(text, 'Paras, Rahul, and 2 others are typing...');
    });

    it('excludes current user from own typing indicator display', () => {
      const typers = [{ uid: 'user_paras', displayName: 'Paras', startedAt: now }];
      const text = formatTypingIndicatorText(typers, 'user_paras', false);
      assert.strictEqual(text, null);
    });

    it('filters out stale typing indicators older than 6 seconds', () => {
      const staleTime = now - 10000;
      const typers = [{ uid: 'user_paras', displayName: 'Paras', startedAt: staleTime }];
      const text = formatTypingIndicatorText(typers, 'user_other', false);
      assert.strictEqual(text, null);
    });
  });

  // -------------------------------------------------------------
  // Group 4: Member Presence Partitioning
  // -------------------------------------------------------------
  describe('🔍 4. Member Presence Partitioning', () => {
    it('partitions members into Online and Offline groups', () => {
      const currentUserId = 'user_rahul'; // Current user should always be counted as online
      const online = [];
      const offline = [];

      mockMembers.forEach((m) => {
        const isOnline = m.uid === currentUserId || m.onlineStatus === 'online';
        if (isOnline) {
          online.push(m);
        } else {
          offline.push(m);
        }
      });

      // user_paras (online), user_alex (online), user_rahul (current user -> online)
      assert.strictEqual(online.length, 3);
      // user_priya (offline)
      assert.strictEqual(offline.length, 1);
      assert.strictEqual(offline[0].uid, 'user_priya');
    });
  });

  // -------------------------------------------------------------
  // Group 5: Zero N+1 & Performance Invariants
  // -------------------------------------------------------------
  describe('🔍 5. Zero N+1 & Performance Invariants', () => {
    it('formats 100 typing evaluations in < 15ms in memory', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        const typers = [
          { uid: `user_${i}`, displayName: `Member ${i}`, startedAt: Date.now() },
          { uid: 'user_other', displayName: 'Other', startedAt: Date.now() },
        ];
        const text = formatTypingIndicatorText(typers, 'user_current', false);
        assert.ok(text.includes('are typing...'));
      }
      const duration = performance.now() - start;
      assert.ok(duration < 15, `Typing formatting must execute in < 15ms (took ${duration.toFixed(2)}ms)`);
    });
  });
});
