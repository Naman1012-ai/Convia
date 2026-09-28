import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';

import {
  SEARCH_RESOURCE_TYPES,
  createSearchResult,
  extractMatchedExcerpt,
  computeRelevanceScore,
  buildSearchActionUrl,
} from '../../constants/searchConstants.js';

import { searchController } from '../../controllers/searchController.js';
import { rtdbService } from '../rtdbService.js';

describe('🧪 CONVIA PHASE 9 — UNIFIED WORKSPACE SEARCH, DISCOVERY & RESOURCE NAVIGATION', () => {
  let mockDb = {};

  beforeEach(() => {
    mockDb = {
      organizations: {
        org_alpha: {
          id: 'org_alpha',
          orgId: 'org_alpha',
          name: 'Alpha Labs',
          ownerId: 'user_alice',
          activeProjectId: 'idea_101',
        },
        org_beta: {
          id: 'org_beta',
          orgId: 'org_beta',
          name: 'Beta Team',
          ownerId: 'user_charlie',
        },
      },
      organization_members: {
        org_alpha: {
          user_alice: { uid: 'user_alice', role: 'owner' },
          user_bob: { uid: 'user_bob', role: 'member' },
        },
        org_beta: {
          user_charlie: { uid: 'user_charlie', role: 'owner' },
        },
      },
      ideas: {
        org_alpha: {
          idea_101: {
            ideaId: 'idea_101',
            orgId: 'org_alpha',
            title: 'Automated Resume Screening AI',
            problemStatement: 'Recruiters spend too much time filtering applicant resumes manually.',
            proposedSolution: 'Build an intelligent parsing pipeline using LLMs.',
            techStack: 'Python, React, Fastify',
            authorName: 'Alice Developer',
            createdAt: Date.now() - 5000,
            isDeleted: false,
          },
          idea_102: {
            ideaId: 'idea_102',
            orgId: 'org_alpha',
            title: 'Deleted Legacy Tool',
            problemStatement: 'This was an old proposal that was deleted.',
            isDeleted: true, // Deleted proposal
          },
        },
      },
      blueprints: {
        org_alpha: {
          idea_101: {
            blueprintId: 'bp_alpha_101',
            version: '1.0',
            content: {
              projectOverview: {
                title: 'Automated Resume Screening AI Engine',
                summary: 'Comprehensive specification for applicant resume ingestion.',
              },
              requirements: [
                { id: 'REQ-01', title: 'PDF Resume Parsing', description: 'Extract plain text from uploaded PDF files.' },
                { id: 'REQ-02', title: 'Candidate Scoring Matrix', description: 'Compute relevance rank against job descriptions.' },
              ],
              execution: {
                tasks: [
                  { id: 'TASK-01', title: 'Implement PDF Ingestion Worker', description: 'Build worker queue for file processing.' },
                  { id: 'TASK-02', title: 'Setup Elasticsearch Index', description: 'Index resume embeddings for vector retrieval.' },
                ],
              },
            },
            updatedAt: Date.now() - 2000,
          },
        },
      },
      discussions: {
        org_alpha: {
          idea_101: {
            disc_1: {
              discussionId: 'disc_1',
              type: 'question',
              message: 'Does this support Docx format in addition to PDF?',
              authorName: 'Bob Contributor',
              parentId: null,
              createdAt: Date.now() - 4000,
              isDeleted: false,
            },
            disc_2: {
              discussionId: 'disc_2',
              type: 'suggestion',
              message: 'We should include OCR fallback for scanned resume images.',
              authorName: 'Bob Contributor',
              parentId: null,
              createdAt: Date.now() - 3000,
              isDeleted: false,
            },
            disc_3: {
              discussionId: 'disc_3',
              type: 'comment',
              message: 'Deleted comment test',
              isDeleted: true,
            },
          },
        },
      },
      workspaceChats: {
        org_alpha: {
          channels: {
            general: {
              messages: {
                msg_1: {
                  messageId: 'msg_1',
                  content: 'Has anyone tested the latest PDF parser endpoint?',
                  senderName: 'Alice Developer',
                  createdAt: Date.now() - 1000,
                  deleted: false,
                  isSystem: false,
                },
                msg_2: {
                  messageId: 'msg_2',
                  content: 'Deleted chat message',
                  deleted: true,
                },
              },
            },
          },
        },
      },
      workspace_activity: {
        org_alpha: {
          act_1: {
            id: 'act_1',
            eventType: 'idea.created',
            summary: 'Alice Developer created proposal "Automated Resume Screening AI"',
            resourceTitle: 'Automated Resume Screening AI',
            actorName: 'Alice Developer',
            createdAt: Date.now() - 5000,
            actionUrl: '/workspaces/org_alpha/ideas/idea_101',
          },
        },
      },
    };

    // Override rtdbService.getData for deterministic test execution
    rtdbService.getData = async (path) => {
      const parts = path.split('/').filter(Boolean);
      let curr = mockDb;
      for (const p of parts) {
        if (!curr || typeof curr !== 'object') return null;
        curr = curr[p];
      }
      return curr !== undefined ? curr : null;
    };
  });

  // -------------------------------------------------------------
  // Group 1: Strict Authorization & Cross-Workspace Boundary Defense
  // -------------------------------------------------------------
  describe('🔒 1. Workspace Authorization & Isolation', () => {
    it('rejects search when user is not authenticated', async () => {
      await assert.rejects(
        async () => {
          await searchController.searchWorkspaceHandler('org_alpha', null, { query: 'Resume' });
        },
        { message: 'Workspace ID and User UID are required for search.' }
      );
    });

    it('blocks User Charlie (Org Beta) from searching Org Alpha data', async () => {
      await assert.rejects(
        async () => {
          await searchController.searchWorkspaceHandler('org_alpha', 'user_charlie', { query: 'Resume' });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 403);
          assert.match(err.message, /authorized member/i);
          return true;
        }
      );
    });

    it('allows authorized member (User Bob) to search Org Alpha', async () => {
      const res = await searchController.searchWorkspaceHandler('org_alpha', 'user_bob', { query: 'Resume' });
      assert.strictEqual(res.success, true);
      assert(Array.isArray(res.results));
      assert(res.results.length > 0);
    });

    it('denies search for non-existent workspace', async () => {
      await assert.rejects(
        async () => {
          await searchController.searchWorkspaceHandler('non_existent_org', 'user_bob', { query: 'Resume' });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 404);
          return true;
        }
      );
    });
  });

  // -------------------------------------------------------------
  // Group 2: Comprehensive Resource Discovery
  // -------------------------------------------------------------
  describe('📦 2. Multi-Resource Discovery', () => {
    it('discovers Proposals matching title and problem statement', async () => {
      const res = await searchController.searchWorkspaceHandler('org_alpha', 'user_alice', {
        query: 'Screening',
        filter: SEARCH_RESOURCE_TYPES.IDEA,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.results.length, 1);
      assert.strictEqual(res.results[0].resourceType, 'idea');
      assert.strictEqual(res.results[0].title, 'Automated Resume Screening AI');
      assert.strictEqual(res.results[0].actionUrl, '/workspaces/org_alpha/ideas/idea_101');
    });

    it('discovers Blueprint requirements and tasks by ID or keyword', async () => {
      const reqRes = await searchController.searchWorkspaceHandler('org_alpha', 'user_alice', {
        query: 'REQ-01',
        filter: SEARCH_RESOURCE_TYPES.BLUEPRINT,
      });
      assert.strictEqual(reqRes.success, true);
      assert.strictEqual(reqRes.results.length, 1);
      assert.match(reqRes.results[0].title, /REQ-01/);

      const taskRes = await searchController.searchWorkspaceHandler('org_alpha', 'user_alice', {
        query: 'Elasticsearch',
        filter: SEARCH_RESOURCE_TYPES.BLUEPRINT,
      });
      assert.strictEqual(taskRes.success, true);
      assert.strictEqual(taskRes.results.length, 1);
      assert.match(taskRes.results[0].title, /TASK-02/);
    });

    it('discovers Questions asked on proposals', async () => {
      const res = await searchController.searchWorkspaceHandler('org_alpha', 'user_alice', {
        query: 'Docx format',
        filter: SEARCH_RESOURCE_TYPES.QUESTION,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.results.length, 1);
      assert.strictEqual(res.results[0].resourceType, 'question');
      assert.strictEqual(res.results[0].badgeLabel, 'Question');
      assert.strictEqual(res.results[0].parentResourceId, 'idea_101');
    });

    it('discovers Suggestions on proposals', async () => {
      const res = await searchController.searchWorkspaceHandler('org_alpha', 'user_alice', {
        query: 'OCR fallback',
        filter: SEARCH_RESOURCE_TYPES.SUGGESTION,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.results.length, 1);
      assert.strictEqual(res.results[0].resourceType, 'suggestion');
      assert.strictEqual(res.results[0].badgeLabel, 'Suggestion');
    });

    it('discovers Chat channel messages', async () => {
      const res = await searchController.searchWorkspaceHandler('org_alpha', 'user_alice', {
        query: 'latest PDF parser',
        filter: SEARCH_RESOURCE_TYPES.CHAT,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.results.length, 1);
      assert.strictEqual(res.results[0].resourceType, 'chat');
      assert.strictEqual(res.results[0].badgeLabel, 'Chat');
      assert.strictEqual(res.results[0].metadata.channelId, 'general');
    });

    it('discovers Workspace Activity events', async () => {
      const res = await searchController.searchWorkspaceHandler('org_alpha', 'user_alice', {
        query: 'created proposal',
        filter: SEARCH_RESOURCE_TYPES.ACTIVITY,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.results.length, 1);
      assert.strictEqual(res.results[0].resourceType, 'activity');
      assert.strictEqual(res.results[0].badgeLabel, 'Activity');
    });
  });

  // -------------------------------------------------------------
  // Group 3: Respect for Deletions & Exclusions
  // -------------------------------------------------------------
  describe('🛡️ 3. Deletions & Soft-Delete Invariant', () => {
    it('never returns deleted proposals', async () => {
      const res = await searchController.searchWorkspaceHandler('org_alpha', 'user_alice', {
        query: 'Deleted Legacy Tool',
      });
      const hasDeleted = res.results.some((r) => r.title.includes('Deleted Legacy Tool'));
      assert.strictEqual(hasDeleted, false, 'Deleted ideas must never appear in search');
    });

    it('never returns deleted discussions or deleted chat messages', async () => {
      const res = await searchController.searchWorkspaceHandler('org_alpha', 'user_alice', {
        query: 'Deleted',
      });
      assert.strictEqual(res.results.length, 0);
    });
  });

  // -------------------------------------------------------------
  // Group 4: Edge Cases & Query Sanitization
  // -------------------------------------------------------------
  describe('⚡ 4. Input Sanitization & Edge Cases', () => {
    it('returns empty result set for empty or 1-character query', async () => {
      const resEmpty = await searchController.searchWorkspaceHandler('org_alpha', 'user_alice', { query: '' });
      assert.strictEqual(resEmpty.results.length, 0);

      const resOneChar = await searchController.searchWorkspaceHandler('org_alpha', 'user_alice', { query: 'a' });
      assert.strictEqual(resOneChar.results.length, 0);

      const resSpaces = await searchController.searchWorkspaceHandler('org_alpha', 'user_alice', { query: '     ' });
      assert.strictEqual(resSpaces.results.length, 0);
    });

    it('handles special regex metacharacters safely without crashing', async () => {
      const specialQuery = '.*+?^${}()|[]\\';
      const res = await searchController.searchWorkspaceHandler('org_alpha', 'user_alice', {
        query: specialQuery,
      });
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.results.length, 0);
    });
  });

  // -------------------------------------------------------------
  // Group 5: Relevance Ranking & Snippet Excerpts
  // -------------------------------------------------------------
  describe('📊 5. Relevance Scoring & Snippet Extraction', () => {
    it('scores exact title matches higher than body matches', () => {
      const scoreExact = computeRelevanceScore('Resume Parser', 'Some body text', 'Resume Parser');
      const scoreBodyOnly = computeRelevanceScore('Unrelated Title', 'Contains Resume Parser in body', 'Resume Parser');
      assert(scoreExact > scoreBodyOnly, `Exact title score (${scoreExact}) must exceed body score (${scoreBodyOnly})`);
    });

    it('extracts concise snippet surrounding matched query', () => {
      const text = 'The platform enables intelligent applicant ranking using advanced machine learning models and vector embeddings.';
      const excerpt = extractMatchedExcerpt(text, 'machine learning', 60);
      assert(excerpt.toLowerCase().includes('machine learning'));
      assert(excerpt.length <= 80);
    });

    it('constructs correct deep-link action URLs for all resource types', () => {
      const ideaUrl = buildSearchActionUrl({
        workspaceId: 'org_alpha',
        resourceType: SEARCH_RESOURCE_TYPES.IDEA,
        resourceId: 'idea_101',
      });
      assert.strictEqual(ideaUrl, '/workspaces/org_alpha/ideas/idea_101');

      const discUrl = buildSearchActionUrl({
        workspaceId: 'org_alpha',
        resourceType: SEARCH_RESOURCE_TYPES.QUESTION,
        resourceId: 'disc_1',
        parentResourceId: 'idea_101',
      });
      assert.strictEqual(discUrl, '/workspaces/org_alpha/ideas/idea_101?tab=questions&discussionId=disc_1');

      const chatUrl = buildSearchActionUrl({
        workspaceId: 'org_alpha',
        resourceType: SEARCH_RESOURCE_TYPES.CHAT,
        resourceId: 'msg_1',
        metadata: { channelId: 'general', messageId: 'msg_1' },
      });
      assert.strictEqual(chatUrl, '/workspaces/org_alpha/chat?channel=general&messageId=msg_1');
    });
  });
});
