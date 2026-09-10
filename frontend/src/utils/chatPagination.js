/**
 * Convia Chat System — Phase 3 Local Cache, Deduplication & Pagination Helpers
 * Provides pure, deterministic functions for message ordering, deduplication, and cache updates.
 */

import { CHAT_PAGE_SIZE } from '../constants/chatSchema.js';
import { normalizeChatMessage } from './chatValidation.js';

/**
 * Deterministic message comparator for oldest-to-newest rendering.
 * Uses `createdAt` timestamp as primary sort key and `messageId` (lexical) as tie-breaker.
 *
 * @param {Object} a - First message
 * @param {Object} b - Second message
 * @returns {number} Negative if a < b, positive if a > b, 0 if identical
 */
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

/**
 * Upserts a single incoming message (from onChildAdded or onChildChanged) into the existing message array.
 * Strictly deduplicates by canonical `messageId` and maintains chronological order.
 *
 * @param {Array<Object>} existingList - Current local message cache
 * @param {Object} rawMessage - Incoming message payload from database
 * @param {string} [messageKey] - RTDB push key
 * @returns {Array<Object>} New array with the message inserted or updated
 */
export function upsertMessage(existingList = [], rawMessage, messageKey = null) {
  const normalized = normalizeChatMessage(rawMessage, messageKey);
  if (!normalized || !normalized.messageId) {
    return existingList;
  }

  const targetId = normalized.messageId;
  const existingIndex = existingList.findIndex((m) => m && m.messageId === targetId);

  if (existingIndex >= 0) {
    // Replace existing message in-place
    const updated = [...existingList];
    updated[existingIndex] = normalized;
    return updated;
  }

  // Insert new message and maintain sorted order
  const updated = [...existingList, normalized];
  return updated.sort(compareMessages);
}

/**
 * Merges a batch of older messages into the current message list.
 * Deduplicates any overlapping messages and guarantees stable ordering without mutating inputs.
 *
 * @param {Array<Object>} existingList - Current local message list
 * @param {Array<Object>} olderBatch - Newly fetched older messages
 * @returns {Array<Object>} Combined, sorted, deduplicated message list
 */
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

/**
 * Removes a message by canonical ID from the local list (for physical onChildRemoved).
 *
 * @param {Array<Object>} existingList - Current local message list
 * @param {string} messageId - ID of message to remove
 * @returns {Array<Object>} Filtered array without the specified message
 */
export function removeMessageById(existingList = [], messageId) {
  if (!messageId || !Array.isArray(existingList)) {
    return existingList;
  }
  const cleanId = String(messageId).trim();
  return existingList.filter((m) => m && m.messageId !== cleanId);
}

/**
 * Determines pagination cursor and exhaustion metadata from a message batch.
 *
 * @param {Array<Object>} batch - Batch of fetched messages
 * @param {number} [pageSize=CHAT_PAGE_SIZE] - Configured page size
 * @returns {{ hasMore: boolean, oldestKey: string|null, newestKey: string|null, count: number }}
 */
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
