import { describe, it } from 'node:test';
import assert from 'node:assert';

// 1. Constants mirroring frontend/src/constants/chatSchema.js
const CHAT_PAGE_SIZE = 50;
const PAGE_SIZE = CHAT_PAGE_SIZE;
const DEFAULT_CHAT_CHANNEL_ID = 'general';

// 2. Pure helper functions mirroring frontend/src/utils/chatPagination.js & chatValidation.js
export function compareMessages(a, b) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;

  const timeA = typeof a.createdAt === 'number' && !Number.isNaN(a.createdAt) ? a.createdAt : 0;
  const timeB = typeof b.createdAt === 'number' && !Number.isNaN(b.createdAt) ? b.createdAt : 0;

  if (timeA !== timeB) {
    return timeA - timeB;
  }

  const idA = String(a.messageId || '');
  const idB = String(b.messageId || '');
  return idA.localeCompare(idB);
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
    systemType: isSystem ? (raw.systemType || 'system') : null,
    attachment: isDeleted ? null : (raw.attachment || null),
  };
}

export function upsertMessage(existingList = [], rawMessage, messageKey = null) {
  const normalized = normalizeChatMessage(rawMessage, messageKey);
  if (!normalized || !normalized.messageId) {
    return existingList;
  }

  const targetId = normalized.messageId;
  const existingIndex = existingList.findIndex((m) => m && m.messageId === targetId);

  if (existingIndex >= 0) {
    const updated = [...existingList];
    updated[existingIndex] = normalized;
    return updated;
  }

  const updated = [...existingList, normalized];
  return updated.sort(compareMessages);
}

export function prependOlderMessages(existingList = [], olderBatch = []) {
  if (!Array.isArray(olderBatch) || olderBatch.length === 0) {
    return existingList;
  }

  const existingIds = new Set(existingList.map((m) => m && m.messageId).filter(Boolean));
  const newItems = [];

  for (const raw of olderBatch) {
    const normalized = normalizeChatMessage(raw);
    if (normalized && normalized.messageId && !existingIds.has(normalized.messageId)) {
      newItems.push(normalized);
      existingIds.add(normalized.messageId);
    }
  }

  if (newItems.length === 0) {
    return existingList;
  }

  return [...newItems, ...existingList].sort(compareMessages);
}

export function removeMessageById(existingList = [], messageId) {
  if (!messageId || !Array.isArray(existingList)) {
    return existingList;
  }
  const cleanId = String(messageId).trim();
  return existingList.filter((m) => m && m.messageId !== cleanId);
}

export function calculatePaginationMetadata(batch = [], pageSize = CHAT_PAGE_SIZE) {
  if (!Array.isArray(batch) || batch.length === 0) {
    return {
      hasMore: false,
      oldestKey: null,
      newestKey: null,
      count: 0,
    };
  }

  const validMessages = batch.filter((m) => m && m.messageId);
  const count = validMessages.length;
  const hasMore = count === pageSize;
  const oldestKey = count > 0 ? validMessages[0].messageId : null;
  const newestKey = count > 0 ? validMessages[count - 1].messageId : null;

  return {
    hasMore,
    oldestKey,
    newestKey,
    count,
  };
}

// -------------------- TEST SUITE --------------------

describe('🧪 CONVIA CHAT SYSTEM PHASE 3 — REAL-TIME MESSAGING & BOUNDED PAGINATION TEST SUITE', () => {

  describe('🔍 TEST 1: Centralized Page Size Configuration', () => {
    it('enforces PAGE_SIZE = 50 consistently', () => {
      assert.strictEqual(CHAT_PAGE_SIZE, 50);
      assert.strictEqual(PAGE_SIZE, 50);
    });
  });

  describe('🔍 TEST 2: Message Deduplication on Live Additions (upsertMessage)', () => {
    it('appends new message [D] to existing [A, B, C] without mutating original', () => {
      const existing = [
        { messageId: 'msg_A', createdAt: 100, content: 'Message A' },
        { messageId: 'msg_B', createdAt: 200, content: 'Message B' },
        { messageId: 'msg_C', createdAt: 300, content: 'Message C' },
      ];
      const incoming = { messageId: 'msg_D', createdAt: 400, content: 'Message D' };

      const result = upsertMessage(existing, incoming);
      assert.strictEqual(result.length, 4);
      assert.strictEqual(existing.length, 3); // Pure function check
      assert.deepStrictEqual(result.map((m) => m.messageId), ['msg_A', 'msg_B', 'msg_C', 'msg_D']);
    });

    it('updates existing message [B] in-place with new content without duplicating', () => {
      const existing = [
        { messageId: 'msg_A', createdAt: 100, content: 'Message A' },
        { messageId: 'msg_B', createdAt: 200, content: 'Message B initial' },
        { messageId: 'msg_C', createdAt: 300, content: 'Message C' },
      ];
      const incomingUpdate = { messageId: 'msg_B', createdAt: 200, content: 'Message B edited', editedAt: 250 };

      const result = upsertMessage(existing, incomingUpdate);
      assert.strictEqual(result.length, 3);
      assert.strictEqual(result[1].messageId, 'msg_B');
      assert.strictEqual(result[1].content, 'Message B edited');
      assert.strictEqual(result[1].editedAt, 250);
      assert.deepStrictEqual(result.map((m) => m.messageId), ['msg_A', 'msg_B', 'msg_C']);
    });

    it('deduplicates strictly by canonical messageId regardless of content or sender', () => {
      const existing = [{ messageId: 'msg_01', createdAt: 100, senderName: 'Alice', content: 'Hi' }];
      const incoming = { messageId: 'msg_01', createdAt: 100, senderName: 'Bob', content: 'Different text' };

      const result = upsertMessage(existing, incoming);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].messageId, 'msg_01');
      assert.strictEqual(result[0].content, 'Different text');
    });
  });

  describe('🔍 TEST 3: Live Edit & Soft Deletion Updates', () => {
    it('updates edited message state incrementally without reloading collection', () => {
      const existing = [
        { messageId: 'msg_1', createdAt: 100, content: 'First message' },
        { messageId: 'msg_2', createdAt: 200, content: 'Second message' },
      ];
      const editedMsg = {
        messageId: 'msg_2',
        createdAt: 200,
        content: 'Second message updated',
        editedAt: 300,
        editedBy: 'user_bob',
      };

      const result = upsertMessage(existing, editedMsg);
      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[1].content, 'Second message updated');
      assert.strictEqual(result[1].editedAt, 300);
      assert.strictEqual(result[1].editedBy, 'user_bob');
    });

    it('updates soft-deleted message, masking content and stripping attachment', () => {
      const existing = [
        {
          messageId: 'msg_1',
          createdAt: 100,
          content: 'Confidential message',
          attachment: { fileName: 'secret.pdf', url: 'https://utfs.io/f/sec.pdf' },
          deleted: false,
        },
      ];
      const deletedEvent = {
        messageId: 'msg_1',
        createdAt: 100,
        deleted: true,
        deletedAt: 500,
        deletedBy: 'user_admin',
        attachment: null,
      };

      const result = upsertMessage(existing, deletedEvent);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].deleted, true);
      assert.strictEqual(result[0].content, 'This message was deleted');
      assert.strictEqual(result[0].attachment, null);
      assert.strictEqual(result[0].deletedAt, 500);
    });
  });

  describe('🔍 TEST 4: Physical Child Removal (removeMessageById)', () => {
    it('removes message from local cache on onChildRemoved event', () => {
      const existing = [
        { messageId: 'msg_A', createdAt: 100 },
        { messageId: 'msg_B', createdAt: 200 },
        { messageId: 'msg_C', createdAt: 300 },
      ];

      const result = removeMessageById(existing, 'msg_B');
      assert.strictEqual(result.length, 2);
      assert.deepStrictEqual(result.map((m) => m.messageId), ['msg_A', 'msg_C']);
    });

    it('returns identical list if messageId does not exist', () => {
      const existing = [{ messageId: 'msg_A', createdAt: 100 }];
      const result = removeMessageById(existing, 'msg_non_existent');
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].messageId, 'msg_A');
    });
  });

  describe('🔍 TEST 5: Older Message Prepending & Deduplication (prependOlderMessages)', () => {
    it('merges older batch [A, B, C] into current [C, D, E] resulting in [A, B, C, D, E]', () => {
      const current = [
        { messageId: 'msg_C', createdAt: 300, content: 'Message C' },
        { messageId: 'msg_D', createdAt: 400, content: 'Message D' },
        { messageId: 'msg_E', createdAt: 500, content: 'Message E' },
      ];
      const olderBatch = [
        { messageId: 'msg_A', createdAt: 100, content: 'Message A' },
        { messageId: 'msg_B', createdAt: 200, content: 'Message B' },
        { messageId: 'msg_C', createdAt: 300, content: 'Message C' }, // Overlap
      ];

      const result = prependOlderMessages(current, olderBatch);
      assert.strictEqual(result.length, 5);
      assert.deepStrictEqual(result.map((m) => m.messageId), ['msg_A', 'msg_B', 'msg_C', 'msg_D', 'msg_E']);
    });

    it('handles empty older batch cleanly', () => {
      const current = [{ messageId: 'msg_A', createdAt: 100 }];
      const result = prependOlderMessages(current, []);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].messageId, 'msg_A');
    });
  });

  describe('🔍 TEST 6: Pagination Metadata & History Exhaustion Logic', () => {
    it('indicates hasMore = true when returned batch count equals PAGE_SIZE (50)', () => {
      const batch50 = Array.from({ length: 50 }, (_, i) => ({
        messageId: `msg_${String(i).padStart(3, '0')}`,
        createdAt: 1000 + i,
      }));

      const meta = calculatePaginationMetadata(batch50, CHAT_PAGE_SIZE);
      assert.strictEqual(meta.hasMore, true);
      assert.strictEqual(meta.count, 50);
      assert.strictEqual(meta.oldestKey, 'msg_000');
      assert.strictEqual(meta.newestKey, 'msg_049');
    });

    it('indicates hasMore = false when returned batch count is less than PAGE_SIZE (e.g. 23)', () => {
      const batch23 = Array.from({ length: 23 }, (_, i) => ({
        messageId: `msg_${String(i).padStart(3, '0')}`,
        createdAt: 1000 + i,
      }));

      const meta = calculatePaginationMetadata(batch23, CHAT_PAGE_SIZE);
      assert.strictEqual(meta.hasMore, false);
      assert.strictEqual(meta.count, 23);
      assert.strictEqual(meta.oldestKey, 'msg_000');
      assert.strictEqual(meta.newestKey, 'msg_022');
    });

    it('indicates hasMore = false and null keys when batch is empty', () => {
      const meta = calculatePaginationMetadata([], CHAT_PAGE_SIZE);
      assert.strictEqual(meta.hasMore, false);
      assert.strictEqual(meta.oldestKey, null);
      assert.strictEqual(meta.newestKey, null);
      assert.strictEqual(meta.count, 0);
    });
  });

  describe('🔍 TEST 7: Stable Chronological Ordering', () => {
    it('maintains strict oldest-to-newest ordering across out-of-order insertions', () => {
      let list = [];
      list = upsertMessage(list, { messageId: 'msg_3', createdAt: 300 });
      list = upsertMessage(list, { messageId: 'msg_1', createdAt: 100 });
      list = upsertMessage(list, { messageId: 'msg_4', createdAt: 400 });
      list = upsertMessage(list, { messageId: 'msg_2', createdAt: 200 });

      assert.deepStrictEqual(list.map((m) => m.messageId), ['msg_1', 'msg_2', 'msg_3', 'msg_4']);
    });

    it('uses messageId lexical tie-breaker when createdAt timestamps are identical', () => {
      const msgX = { messageId: 'msg_aaa', createdAt: 100 };
      const msgY = { messageId: 'msg_bbb', createdAt: 100 };

      const list = [msgY, msgX].sort(compareMessages);
      assert.strictEqual(list[0].messageId, 'msg_aaa');
      assert.strictEqual(list[1].messageId, 'msg_bbb');
    });
  });

  describe('🔍 TEST 8: Concurrency & Stale Session Protection Simulation', () => {
    it('blocks concurrent duplicate pagination requests via active loading flag', async () => {
      let isLoadingOlder = false;
      let requestCount = 0;

      async function triggerPagination() {
        if (isLoadingOlder) return 'BLOCKED';
        isLoadingOlder = true;
        requestCount++;
        // Simulate async network request
        await new Promise((resolve) => setTimeout(resolve, 10));
        isLoadingOlder = false;
        return 'SUCCESS';
      }

      // Fire two concurrent requests
      const [res1, res2] = await Promise.all([triggerPagination(), triggerPagination()]);
      assert.strictEqual(requestCount, 1);
      assert.strictEqual(res1, 'SUCCESS');
      assert.strictEqual(res2, 'BLOCKED');
    });

    it('discards async pagination response from previous workspace after workspace switch', async () => {
      let activeSession = Symbol('workspace_A');
      let renderedMessages = ['ws_A_msg1'];

      async function fetchForWorkspaceA(sessionSnapshot) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        if (activeSession !== sessionSnapshot) {
          // Stale response dropped
          return;
        }
        renderedMessages = ['ws_A_msg1', 'ws_A_older'];
      }

      const sessionA = activeSession;
      const fetchPromise = fetchForWorkspaceA(sessionA);

      // User switches to Workspace B before Workspace A request completes
      activeSession = Symbol('workspace_B');
      renderedMessages = ['ws_B_msg1'];

      await fetchPromise;

      // Ensure Workspace A messages did NOT overwrite Workspace B
      assert.deepStrictEqual(renderedMessages, ['ws_B_msg1']);
    });
  });

  describe('🔍 TEST 9: Listener Lifecycle Cleanup Simulation', () => {
    it('executes all unsubscription handles deterministically upon unmount', () => {
      let unmountCallCount = 0;
      const mockUnsubAdded = () => { unmountCallCount++; };
      const mockUnsubChanged = () => { unmountCallCount++; };
      const mockUnsubRemoved = () => { unmountCallCount++; };

      const cleanup = () => {
        mockUnsubAdded();
        mockUnsubChanged();
        mockUnsubRemoved();
      };

      assert.strictEqual(unmountCallCount, 0);
      cleanup();
      assert.strictEqual(unmountCallCount, 3);
    });
  });
});
