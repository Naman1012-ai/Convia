import { auth, rtdb } from '../config/firebase';
import { ref, get, query as rtdbQuery, orderByKey, limitToLast } from 'firebase/database';
import {
  SEARCH_RESOURCE_TYPES,
  createSearchResult,
  extractMatchedExcerpt,
  computeRelevanceScore,
} from '../constants/searchConstants';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Convia Phase 9: Unified Workspace Search Service.
 * Provides debounced, authorized searching across workspace resources.
 */
class SearchService {
  constructor() {
    this.latestSearchSequence = 0;
  }

  /**
   * Search workspace resources.
   *
   * @param {string} workspaceId - Current organization / workspace ID
   * @param {string} queryText - User's search term
   * @param {Object} options - { filter, limit }
   * @returns {Promise<{ results: Array, total: number, query: string }>}
   */
  async searchWorkspace(workspaceId, queryText = '', options = {}) {
    if (!workspaceId) {
      return { results: [], total: 0, query: queryText };
    }

    const cleanQuery = String(queryText || '').trim();
    if (!cleanQuery || cleanQuery.length < 2) {
      return { results: [], total: 0, query: cleanQuery };
    }

    const sequenceToken = ++this.latestSearchSequence;
    const filter = options.filter || SEARCH_RESOURCE_TYPES.ALL;
    const limit = options.limit || 30;

    try {
      // 1. Primary: Call Authenticated Backend Search Endpoint
      const currentUser = auth.currentUser;
      if (currentUser) {
        const idToken = await currentUser.getIdToken();
        const response = await fetch(`${API_BASE}/search/workspace`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            workspaceId,
            query: cleanQuery,
            filter,
            limit,
          }),
        });

        if (response.ok) {
          const json = await response.json();
          // Stale-request check: discard if newer search was dispatched
          if (sequenceToken !== this.latestSearchSequence) {
            return { results: [], total: 0, query: cleanQuery, isStale: true };
          }
          if (json.success && json.data) {
            return json.data;
          }
        } else if (response.status === 403 || response.status === 401) {
          const errJson = await response.json().catch(() => ({}));
          return {
            success: false,
            error: errJson.error?.message || 'Unauthorized: You do not have permission to search this workspace.',
            isUnauthorized: true,
            results: [],
            total: 0,
            query: cleanQuery,
          };
        }
      }
    } catch (err) {
      console.warn('[searchService] Backend search unavailable, utilizing secure client fallback:', err.message);
    }

    // 2. Client-Side Fallback (Enforces Firebase RTDB Security Rules)
    return this.executeClientSearch(workspaceId, cleanQuery, filter, limit, sequenceToken);
  }

  /**
   * Fallback client search adhering strictly to workspace security rules.
   */
  async executeClientSearch(workspaceId, cleanQuery, filter, limit, sequenceToken) {
    const q = cleanQuery.toLowerCase();
    const results = [];

    // Ideas
    if (filter === SEARCH_RESOURCE_TYPES.ALL || filter === SEARCH_RESOURCE_TYPES.IDEA) {
      try {
        const snap = await get(ref(rtdb, `ideas/${workspaceId}`));
        if (snap.exists()) {
          const rawIdeas = snap.val() || {};
          Object.values(rawIdeas).forEach((idea) => {
            if (!idea || idea.isDeleted) return;
            const title = idea.title || '';
            const problem = idea.problemStatement || '';
            const solution = idea.proposedSolution || '';
            const tech = idea.techStack || '';
            const author = idea.authorName || 'Team Member';

            if (`${title} ${problem} ${solution} ${tech} ${author}`.toLowerCase().includes(q)) {
              results.push(
                createSearchResult({
                  resourceType: SEARCH_RESOURCE_TYPES.IDEA,
                  resourceId: idea.ideaId || idea.id,
                  workspaceId,
                  title,
                  excerpt: extractMatchedExcerpt(`${problem} ${solution}`, cleanQuery) || problem,
                  authorName: author,
                  createdAt: idea.createdAt,
                  updatedAt: idea.updatedAt,
                  badgeLabel: 'Proposal',
                  score: computeRelevanceScore(title, `${problem} ${solution}`, cleanQuery, idea.createdAt),
                })
              );
            }
          });
        }
      } catch (e) {
        console.warn('[searchService] Client idea search error:', e.message);
      }
    }

    // Blueprint
    if (filter === SEARCH_RESOURCE_TYPES.ALL || filter === SEARCH_RESOURCE_TYPES.BLUEPRINT) {
      try {
        const bpSnap = await get(ref(rtdb, `blueprints/${workspaceId}/current`));
        if (bpSnap.exists()) {
          const bpDoc = bpSnap.val() || {};
          const content = bpDoc.content || (bpDoc.projectOverview ? bpDoc : {});
          const overviewTitle = content.projectOverview?.title || 'System Blueprint';
          const overviewSummary = content.projectOverview?.summary || '';

          if (`${overviewTitle} ${overviewSummary}`.toLowerCase().includes(q)) {
            results.push(
              createSearchResult({
                resourceType: SEARCH_RESOURCE_TYPES.BLUEPRINT,
                resourceId: `bp_${workspaceId}`,
                workspaceId,
                title: `Blueprint: ${overviewTitle}`,
                excerpt: extractMatchedExcerpt(overviewSummary, cleanQuery),
                createdAt: bpDoc.updatedAt || bpDoc.createdAt,
                badgeLabel: 'Blueprint',
                metadata: { tab: 'overview' },
                score: computeRelevanceScore(overviewTitle, overviewSummary, cleanQuery, bpDoc.updatedAt),
              })
            );
          }
        }
      } catch (e) {
        console.warn('[searchService] Client blueprint search error:', e.message);
      }
    }

    // Discussions (Questions, Suggestions, Comments)
    const searchQuestions = filter === SEARCH_RESOURCE_TYPES.ALL || filter === SEARCH_RESOURCE_TYPES.QUESTION;
    const searchSuggestions = filter === SEARCH_RESOURCE_TYPES.ALL || filter === SEARCH_RESOURCE_TYPES.SUGGESTION;
    const searchComments = filter === SEARCH_RESOURCE_TYPES.ALL || filter === SEARCH_RESOURCE_TYPES.COMMENT;

    if (searchQuestions || searchSuggestions || searchComments) {
      try {
        const discSnap = await get(ref(rtdb, `discussions/${workspaceId}`));
        if (discSnap.exists()) {
          const rawDiscussions = discSnap.val() || {};
          Object.entries(rawDiscussions).forEach(([ideaId, ideaDiscs]) => {
            if (!ideaDiscs || typeof ideaDiscs !== 'object') return;
            Object.values(ideaDiscs).forEach((disc) => {
              if (!disc || typeof disc !== 'object' || disc.isDeleted) return;
              const discType = (disc.type || 'comment').toLowerCase();
              if (discType === 'question' && !searchQuestions) return;
              if (discType === 'suggestion' && !searchSuggestions) return;
              if (discType === 'comment' && !searchComments) return;

              const msg = disc.message || '';
              const author = disc.authorName || 'Contributor';

              if (`${msg} ${author}`.toLowerCase().includes(q)) {
                let resType = SEARCH_RESOURCE_TYPES.COMMENT;
                let badge = 'Comment';
                if (discType === 'question') {
                  resType = SEARCH_RESOURCE_TYPES.QUESTION;
                  badge = disc.parentId ? 'Answer' : 'Question';
                } else if (discType === 'suggestion') {
                  resType = SEARCH_RESOURCE_TYPES.SUGGESTION;
                  badge = 'Suggestion';
                }

                results.push(
                  createSearchResult({
                    resourceType: resType,
                    resourceId: disc.discussionId || disc.id,
                    workspaceId,
                    parentResourceId: ideaId,
                    title: `${badge}: "${msg.slice(0, 60)}${msg.length > 60 ? '...' : ''}"`,
                    excerpt: extractMatchedExcerpt(msg, cleanQuery),
                    authorName: author,
                    createdAt: disc.createdAt,
                    badgeLabel: badge,
                    score: computeRelevanceScore(msg.slice(0, 40), msg, cleanQuery, disc.createdAt),
                  })
                );
              }
            });
          });
        }
      } catch (e) {
        console.warn('[searchService] Client discussion search error:', e.message);
      }
    }

    // Chat (Canonical workspaceChats with multi-channel discovery)
    if (filter === SEARCH_RESOURCE_TYPES.ALL || filter === SEARCH_RESOURCE_TYPES.CHAT) {
      try {
        const channelsSnap = await get(ref(rtdb, `workspaceChats/${workspaceId}/channels`));
        if (channelsSnap.exists()) {
          const rawChannels = channelsSnap.val() || {};
          Object.entries(rawChannels).forEach(([channelId, channelData]) => {
            if (!channelData || typeof channelData !== 'object') return;
            const channelName =
              channelData.metadata?.name ||
              channelData.metadata?.channelId ||
              channelData.name ||
              channelId;
            const rawMsgs = channelData.messages || {};
            Object.entries(rawMsgs).forEach(([msgId, msg]) => {
              if (!msg || msg.deleted || msg.isSystem) return;
              const content = msg.content || '';
              const sender = msg.senderName || 'Member';

              if (`${content} ${sender}`.toLowerCase().includes(q)) {
                results.push(
                  createSearchResult({
                    resourceType: SEARCH_RESOURCE_TYPES.CHAT,
                    resourceId: msgId,
                    workspaceId,
                    title: `Chat in #${channelName}: "${content.slice(0, 50)}${content.length > 50 ? '...' : ''}"`,
                    excerpt: extractMatchedExcerpt(content, cleanQuery),
                    authorName: sender,
                    createdAt: msg.createdAt,
                    badgeLabel: 'Chat',
                    metadata: { channelId, messageId: msgId, channelName },
                    score: computeRelevanceScore(content.slice(0, 30), content, cleanQuery, msg.createdAt),
                  })
                );
              }
            });
          });
        }
      } catch (e) {
        console.warn('[searchService] Client chat search error:', e.message);
      }
    }

    // Stale-request check before returning
    if (sequenceToken !== this.latestSearchSequence) {
      return { results: [], total: 0, query: cleanQuery, isStale: true };
    }

    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

    return {
      success: true,
      query: cleanQuery,
      filter,
      results: results.slice(0, limit),
      total: results.length,
    };
  }

  /**
   * Get initial suggested resources for zero-state search modal.
   */
  async getSearchSuggestions(workspaceId) {
    if (!workspaceId) return [];
    try {
      const snap = await get(rtdbQuery(ref(rtdb, `ideas/${workspaceId}`), orderByKey(), limitToLast(4)));
      if (!snap.exists()) return [];

      const rawIdeas = snap.val() || {};
      const suggestions = [];

      Object.values(rawIdeas).forEach((idea) => {
        if (!idea || idea.isDeleted) return;
        suggestions.push(
          createSearchResult({
            resourceType: SEARCH_RESOURCE_TYPES.IDEA,
            resourceId: idea.ideaId || idea.id,
            workspaceId,
            title: idea.title || 'Proposal',
            excerpt: idea.problemStatement || 'Recent proposal in workspace',
            authorName: idea.authorName,
            createdAt: idea.createdAt,
            badgeLabel: 'Proposal',
          })
        );
      });

      return suggestions.reverse();
    } catch (e) {
      return [];
    }
  }
}

export const searchService = new SearchService();
