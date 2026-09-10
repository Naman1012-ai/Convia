/**
 * Convia Phase 9: Unified Workspace Search Constants & Canonical Factory (Backend).
 * Mirrors frontend definitions for canonical search contracts.
 */

export const SEARCH_RESOURCE_TYPES = Object.freeze({
  ALL: 'all',
  IDEA: 'idea',
  BLUEPRINT: 'blueprint',
  QUESTION: 'question',
  SUGGESTION: 'suggestion',
  COMMENT: 'comment',
  CHAT: 'chat',
  ACTIVITY: 'activity',
});

export const SEARCH_RESOURCE_LABELS = Object.freeze({
  [SEARCH_RESOURCE_TYPES.ALL]: 'All',
  [SEARCH_RESOURCE_TYPES.IDEA]: 'Proposals',
  [SEARCH_RESOURCE_TYPES.BLUEPRINT]: 'Blueprints',
  [SEARCH_RESOURCE_TYPES.QUESTION]: 'Questions',
  [SEARCH_RESOURCE_TYPES.SUGGESTION]: 'Suggestions',
  [SEARCH_RESOURCE_TYPES.COMMENT]: 'Comments',
  [SEARCH_RESOURCE_TYPES.CHAT]: 'Chat',
  [SEARCH_RESOURCE_TYPES.ACTIVITY]: 'Activity',
});

export function extractMatchedExcerpt(text = '', query = '', maxLength = 120) {
  if (!text || typeof text !== 'string') return '';
  const cleanText = text.replace(/\s+/g, ' ').trim();
  if (!query || typeof query !== 'string') {
    return cleanText.length > maxLength ? `${cleanText.slice(0, maxLength)}...` : cleanText;
  }

  const lowerText = cleanText.toLowerCase();
  const lowerQuery = query.toLowerCase().trim();
  const matchIdx = lowerText.indexOf(lowerQuery);

  if (matchIdx === -1) {
    return cleanText.length > maxLength ? `${cleanText.slice(0, maxLength)}...` : cleanText;
  }

  const start = Math.max(0, matchIdx - Math.floor(maxLength / 3));
  const end = Math.min(cleanText.length, start + maxLength);
  let snippet = cleanText.slice(start, end).trim();

  if (start > 0) snippet = `...${snippet}`;
  if (end < cleanText.length) snippet = `${snippet}...`;

  return snippet;
}

export function computeRelevanceScore(title = '', body = '', query = '', createdAt = 0) {
  const cleanQ = (query || '').toLowerCase().trim();
  if (!cleanQ) return 0;

  let score = 0;
  const cleanTitle = (title || '').toLowerCase().trim();
  const cleanBody = (body || '').toLowerCase().trim();

  // 1. Exact title match
  if (cleanTitle === cleanQ) {
    score += 100;
  } else if (cleanTitle.startsWith(cleanQ)) {
    score += 70;
  } else if (cleanTitle.includes(cleanQ)) {
    score += 40;
  }

  // 2. Exact word token in title
  const titleWords = cleanTitle.split(/\s+/);
  if (titleWords.includes(cleanQ)) {
    score += 30;
  }

  // 3. Body/Content match
  if (cleanBody.includes(cleanQ)) {
    score += 20;
    const occurrences = cleanBody.split(cleanQ).length - 1;
    score += Math.min(occurrences * 3, 15);
  }

  // 4. Recency boost (+1 to +10 for newer resources within last 30 days)
  if (createdAt) {
    const ageDays = (Date.now() - Number(createdAt)) / (1000 * 60 * 60 * 24);
    if (ageDays >= 0 && ageDays < 30) {
      score += Math.round(10 * (1 - ageDays / 30));
    }
  }

  return score;
}

export function buildSearchActionUrl({ workspaceId, resourceType, resourceId, parentResourceId = null, metadata = {} }) {
  if (!workspaceId) return '#';
  const base = `/workspaces/${workspaceId}`;

  switch (resourceType) {
    case SEARCH_RESOURCE_TYPES.IDEA:
      return `${base}/ideas/${resourceId}`;
    case SEARCH_RESOURCE_TYPES.BLUEPRINT:
      return metadata.tab
        ? `${base}/blueprint?tab=${metadata.tab}${metadata.targetId ? `&targetId=${metadata.targetId}` : ''}`
        : `${base}/blueprint`;
    case SEARCH_RESOURCE_TYPES.QUESTION:
      return `${base}/ideas/${parentResourceId || resourceId}?tab=questions&discussionId=${resourceId}`;
    case SEARCH_RESOURCE_TYPES.SUGGESTION:
      return `${base}/ideas/${parentResourceId || resourceId}?tab=suggestions&discussionId=${resourceId}`;
    case SEARCH_RESOURCE_TYPES.COMMENT:
      return `${base}/ideas/${parentResourceId || resourceId}?tab=comments&discussionId=${resourceId}`;
    case SEARCH_RESOURCE_TYPES.CHAT:
      return metadata.channelId
        ? `${base}/chat?channel=${metadata.channelId}${metadata.messageId ? `&messageId=${metadata.messageId}` : ''}`
        : `${base}/chat`;
    case SEARCH_RESOURCE_TYPES.ACTIVITY:
      return `${base}/activity`;
    default:
      return base;
  }
}

export function createSearchResult({
  resourceType,
  resourceId,
  workspaceId,
  title,
  excerpt = '',
  authorName = null,
  authorAvatar = null,
  createdAt = null,
  updatedAt = null,
  parentResourceId = null,
  actionUrl = null,
  badgeLabel = null,
  metadata = {},
  score = 0,
}) {
  if (!resourceType || !resourceId || !workspaceId || !title) {
    throw new Error('resourceType, resourceId, workspaceId, and title are required for canonical search result.');
  }

  const generatedActionUrl = actionUrl || buildSearchActionUrl({
    workspaceId,
    resourceType,
    resourceId,
    parentResourceId,
    metadata,
  });

  const generatedBadge = badgeLabel || SEARCH_RESOURCE_LABELS[resourceType] || 'Resource';

  return {
    id: `${resourceType}_${resourceId}`,
    resourceType,
    resourceId: String(resourceId),
    workspaceId: String(workspaceId),
    title: String(title),
    excerpt: String(excerpt || ''),
    authorName: authorName ? String(authorName) : null,
    authorAvatar: authorAvatar || null,
    createdAt: createdAt ? Number(createdAt) : null,
    updatedAt: updatedAt ? Number(updatedAt) : null,
    parentResourceId: parentResourceId ? String(parentResourceId) : null,
    actionUrl: String(generatedActionUrl),
    badgeLabel: String(generatedBadge),
    metadata: metadata && typeof metadata === 'object' ? metadata : {},
    score: Number(score) || 0,
  };
}
