import { rtdbService } from '../services/rtdbService.js';
import { requireWorkspaceMember } from '../utils/workspaceAuthHelper.js';
import {
  SEARCH_RESOURCE_TYPES,
  createSearchResult,
  extractMatchedExcerpt,
  computeRelevanceScore,
} from '../constants/searchConstants.js';

/**
 * Convia Phase 9: Centralized Workspace Search Controller.
 * Enforces strict workspace membership authorization BEFORE performing any resource lookups.
 */
export const searchController = {
  /**
   * Search workspace resources.
   *
   * @param {string} workspaceId - Organization / Workspace ID
   * @param {string} userUid - Authenticated user Auth UID
   * @param {Object} payload - { query, filter, limit }
   * @returns {Promise<Object>} Search response containing matching results
   */
  searchWorkspaceHandler: async (workspaceId, userUid, payload = {}) => {
    if (!workspaceId || !userUid) {
      const err = new Error('Workspace ID and User UID are required for search.');
      err.statusCode = 400;
      throw err;
    }

    const rawQuery = String(payload.query || payload.q || '').trim().slice(0, 100);
    const filter = String(payload.filter || SEARCH_RESOURCE_TYPES.ALL).toLowerCase();
    const limit = Math.max(1, Math.min(Number(payload.limit) || 30, 60));

    // Handle empty or very short queries cleanly
    if (!rawQuery || rawQuery.length < 2) {
      return {
        success: true,
        query: rawQuery,
        filter,
        results: [],
        total: 0,
      };
    }

    const cleanQuery = rawQuery.toLowerCase();

    // -------------------------------------------------------------
    // 1. STRICT AUTHORIZATION VERIFICATION BEFORE SEARCH
    // -------------------------------------------------------------
    const { org: orgRecord } = await requireWorkspaceMember(
      workspaceId,
      userUid,
      'Unauthorized: You must be an authorized member of this workspace to search its resources.'
    );

    // -------------------------------------------------------------
    // 2. RESOURCE QUERIES (BOUNDED & SAFE)
    // -------------------------------------------------------------
    const results = [];

    // --- A. IDEAS / PROPOSALS ---
    if (filter === SEARCH_RESOURCE_TYPES.ALL || filter === SEARCH_RESOURCE_TYPES.IDEA) {
      try {
        const rawIdeas = await rtdbService.getData(`ideas/${workspaceId}`);
        if (rawIdeas && typeof rawIdeas === 'object') {
          Object.values(rawIdeas).forEach((idea) => {
            if (!idea || typeof idea !== 'object' || idea.isDeleted) return;

            const title = idea.title || '';
            const problem = idea.problemStatement || '';
            const solution = idea.proposedSolution || '';
            const tech = idea.techStack || '';
            const author = idea.authorName || '';

            const searchableContent = `${title} ${problem} ${solution} ${tech} ${author}`.toLowerCase();
            if (searchableContent.includes(cleanQuery)) {
              const excerpt = extractMatchedExcerpt(`${problem} ${solution}`, rawQuery);
              const score = computeRelevanceScore(title, `${problem} ${solution}`, rawQuery, idea.createdAt);

              results.push(
                createSearchResult({
                  resourceType: SEARCH_RESOURCE_TYPES.IDEA,
                  resourceId: idea.ideaId || idea.id,
                  workspaceId,
                  title,
                  excerpt: excerpt || problem || 'Proposal details',
                  authorName: author,
                  createdAt: idea.createdAt,
                  updatedAt: idea.updatedAt,
                  badgeLabel: 'Proposal',
                  score,
                })
              );
            }
          });
        }
      } catch (err) {
        console.warn(`[searchController] Idea search error in ${workspaceId}:`, err.message);
      }
    }

    // --- B. BLUEPRINT ENTITIES ---
    if (filter === SEARCH_RESOURCE_TYPES.ALL || filter === SEARCH_RESOURCE_TYPES.BLUEPRINT) {
      try {
        const activeMvpId = orgRecord?.activeProjectId || orgRecord?.selectedIdeaId;
        const bpDoc = (await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}`)) ||
                      (await rtdbService.getData(`blueprints/${workspaceId}/current`));

        if (bpDoc && (bpDoc.content || bpDoc.projectOverview)) {
          const content = bpDoc.content || (bpDoc.projectOverview ? bpDoc : {});
          const bpVer = String(bpDoc.version || '1.0');

          // Overview match
          const overviewTitle = content.projectOverview?.title || content.projectOverview?.projectName || 'System Blueprint';
          const overviewSummary = content.projectOverview?.summary || content.projectOverview?.problemStatement || '';
          if (`${overviewTitle} ${overviewSummary}`.toLowerCase().includes(cleanQuery)) {
            results.push(
              createSearchResult({
                resourceType: SEARCH_RESOURCE_TYPES.BLUEPRINT,
                resourceId: `bp_overview_${workspaceId}`,
                workspaceId,
                title: `Blueprint v${bpVer}: ${overviewTitle}`,
                excerpt: extractMatchedExcerpt(overviewSummary, rawQuery),
                createdAt: bpDoc.updatedAt || bpDoc.createdAt,
                badgeLabel: 'Blueprint',
                metadata: { tab: 'overview', version: bpVer },
                score: computeRelevanceScore(overviewTitle, overviewSummary, rawQuery, bpDoc.updatedAt),
              })
            );
          }

          // Requirements match
          if (Array.isArray(content.requirements)) {
            content.requirements.forEach((req) => {
              const reqTitle = req.title || req.id || 'Requirement';
              const reqDesc = req.description || req.context || '';
              const searchableReq = `${req.id || ''} ${reqTitle} ${reqDesc}`.toLowerCase();
              if (searchableReq.includes(cleanQuery)) {
                results.push(
                  createSearchResult({
                    resourceType: SEARCH_RESOURCE_TYPES.BLUEPRINT,
                    resourceId: req.id || `req_${Math.random()}`,
                    workspaceId,
                    title: `Requirement [${req.id || 'REQ'}]: ${reqTitle}`,
                    excerpt: extractMatchedExcerpt(reqDesc, rawQuery),
                    createdAt: bpDoc.updatedAt,
                    badgeLabel: 'Requirement',
                    metadata: { tab: 'requirements', targetId: req.id },
                    score: computeRelevanceScore(`${req.id || ''} ${reqTitle}`, reqDesc, rawQuery, bpDoc.updatedAt),
                  })
                );
              }
            });
          }

          // Tasks match
          if (Array.isArray(content.execution?.tasks)) {
            content.execution.tasks.forEach((task) => {
              const taskTitle = task.title || task.id || 'Task';
              const taskDesc = task.description || '';
              const searchableTask = `${task.id || ''} ${taskTitle} ${taskDesc}`.toLowerCase();
              if (searchableTask.includes(cleanQuery)) {
                results.push(
                  createSearchResult({
                    resourceType: SEARCH_RESOURCE_TYPES.BLUEPRINT,
                    resourceId: task.id || `task_${Math.random()}`,
                    workspaceId,
                    title: `Execution Task [${task.id || 'TASK'}]: ${taskTitle}`,
                    excerpt: extractMatchedExcerpt(taskDesc, rawQuery),
                    createdAt: bpDoc.updatedAt,
                    badgeLabel: 'Task',
                    metadata: { tab: 'execution', targetId: task.id },
                    score: computeRelevanceScore(`${task.id || ''} ${taskTitle}`, taskDesc, rawQuery, bpDoc.updatedAt),
                  })
                );
              }
            });
          }
        }
      } catch (err) {
        console.warn(`[searchController] Blueprint search error in ${workspaceId}:`, err.message);
      }
    }

    // --- C. DISCUSSIONS (QUESTIONS, SUGGESTIONS, COMMENTS) ---
    const searchQuestions = filter === SEARCH_RESOURCE_TYPES.ALL || filter === SEARCH_RESOURCE_TYPES.QUESTION;
    const searchSuggestions = filter === SEARCH_RESOURCE_TYPES.ALL || filter === SEARCH_RESOURCE_TYPES.SUGGESTION;
    const searchComments = filter === SEARCH_RESOURCE_TYPES.ALL || filter === SEARCH_RESOURCE_TYPES.COMMENT;

    if (searchQuestions || searchSuggestions || searchComments) {
      try {
        const rawDiscussions = await rtdbService.getData(`discussions/${workspaceId}`);
        if (rawDiscussions && typeof rawDiscussions === 'object') {
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

              if (`${msg} ${author}`.toLowerCase().includes(cleanQuery)) {
                const excerpt = extractMatchedExcerpt(msg, rawQuery);
                const score = computeRelevanceScore(msg.slice(0, 40), msg, rawQuery, disc.createdAt);

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
                    excerpt,
                    authorName: author,
                    createdAt: disc.createdAt,
                    badgeLabel: badge,
                    score,
                  })
                );
              }
            });
          });
        }
      } catch (err) {
        console.warn(`[searchController] Discussion search error in ${workspaceId}:`, err.message);
      }
    }

    // --- D. CHAT MESSAGES ---
    if (filter === SEARCH_RESOURCE_TYPES.ALL || filter === SEARCH_RESOURCE_TYPES.CHAT) {
      try {
        // Query canonical workspaceChats channels first, then fallback to legacy workspace_chats
        let rawChannels = await rtdbService.getData(`workspaceChats/${workspaceId}/channels`);
        if (!rawChannels || typeof rawChannels !== 'object') {
          rawChannels = await rtdbService.getData(`workspace_chats/${workspaceId}/channels`);
        }

        if (rawChannels && typeof rawChannels === 'object') {
          // Traverse all channels in workspace
          for (const [channelId, channelData] of Object.entries(rawChannels)) {
            if (!channelData || typeof channelData !== 'object') continue;

            const channelName =
              channelData.metadata?.name ||
              channelData.metadata?.channelId ||
              channelData.name ||
              channelId;

            const rawMessages = channelData.messages;
            if (rawMessages && typeof rawMessages === 'object') {
              Object.entries(rawMessages).forEach(([msgId, msg]) => {
                if (!msg || typeof msg !== 'object' || msg.deleted || msg.isSystem) return;

                const content = msg.content || '';
                const sender = msg.senderName || 'Member';

                if (`${content} ${sender}`.toLowerCase().includes(cleanQuery)) {
                  results.push(
                    createSearchResult({
                      resourceType: SEARCH_RESOURCE_TYPES.CHAT,
                      resourceId: msgId,
                      workspaceId,
                      title: `Chat in #${channelName}: "${content.slice(0, 50)}${content.length > 50 ? '...' : ''}"`,
                      excerpt: extractMatchedExcerpt(content, rawQuery),
                      authorName: sender,
                      createdAt: msg.createdAt,
                      badgeLabel: 'Chat',
                      metadata: { channelId, messageId: msgId, channelName },
                      score: computeRelevanceScore(content.slice(0, 30), content, rawQuery, msg.createdAt),
                    })
                  );
                }
              });
            }
          }
        }
      } catch (err) {
        console.warn(`[searchController] Chat search error in ${workspaceId}:`, err.message);
      }
    }

    // --- E. WORKSPACE ACTIVITY ---
    if (filter === SEARCH_RESOURCE_TYPES.ALL || filter === SEARCH_RESOURCE_TYPES.ACTIVITY) {
      try {
        const rawActivity = await rtdbService.getData(`workspace_activity/${workspaceId}`);
        if (rawActivity && typeof rawActivity === 'object') {
          Object.values(rawActivity).forEach((act) => {
            if (!act || typeof act !== 'object' || !act.summary) return;

            const summary = act.summary || '';
            const actor = act.actorName || '';
            const resTitle = act.resourceTitle || '';

            if (`${summary} ${actor} ${resTitle}`.toLowerCase().includes(cleanQuery)) {
              results.push(
                createSearchResult({
                  resourceType: SEARCH_RESOURCE_TYPES.ACTIVITY,
                  resourceId: act.id,
                  workspaceId,
                  title: `Activity: ${summary}`,
                  excerpt: extractMatchedExcerpt(`${summary} ${resTitle}`, rawQuery),
                  authorName: actor,
                  createdAt: act.createdAt,
                  badgeLabel: 'Activity',
                  actionUrl: act.actionUrl || `/workspaces/${workspaceId}/activity`,
                  score: computeRelevanceScore(summary, resTitle, rawQuery, act.createdAt),
                })
              );
            }
          });
        }
      } catch (err) {
        console.warn(`[searchController] Activity search error in ${workspaceId}:`, err.message);
      }
    }

    // -------------------------------------------------------------
    // 3. DETERMINISTIC RELEVANCE RANKING & SLICING
    // -------------------------------------------------------------
    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

    const paginated = results.slice(0, limit);

    return {
      success: true,
      query: rawQuery,
      filter,
      results: paginated,
      total: results.length,
    };
  },
};
