import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import express from 'express';

import {
  SEARCH_RESOURCE_TYPES,
  createSearchResult,
  extractMatchedExcerpt,
  computeRelevanceScore,
  buildSearchActionUrl,
} from '../../constants/searchConstants.js';

import { searchController } from '../../controllers/searchController.js';
import { searchRouter } from '../../routes/searchRoutes.js';
import { rtdbService } from '../rtdbService.js';

describe('🔒 CONVIA P1-03 — SEARCH CORRECTNESS & ARCHITECTURE HARDENING (28 SCENARIOS)', () => {
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
          name: 'Beta Innovations',
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
            isDeleted: true,
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
      // Canonical RTDB chat path: workspaceChats
      workspaceChats: {
        org_alpha: {
          channels: {
            general: {
              metadata: { name: 'general', channelId: 'general' },
              messages: {
                msg_gen_1: {
                  messageId: 'msg_gen_1',
                  content: 'Welcome everyone to the Alpha Labs general channel!',
                  senderName: 'Alice Developer',
                  createdAt: Date.now() - 2000,
                  deleted: false,
                  isSystem: false,
                },
                msg_gen_deleted: {
                  messageId: 'msg_gen_deleted',
                  content: 'Secret leaked token general channel',
                  senderName: 'Alice Developer',
                  deleted: true,
                },
                msg_gen_system: {
                  messageId: 'msg_gen_system',
                  content: 'Alice added Bob to the channel',
                  senderName: 'System',
                  isSystem: true,
                },
              },
            },
            engineering: {
              metadata: { name: 'engineering', channelId: 'engineering' },
              messages: {
                msg_eng_1: {
                  messageId: 'msg_eng_1',
                  content: 'The Python parsing pipeline throughput reached 100 docs/sec.',
                  senderName: 'Bob Contributor',
                  createdAt: Date.now() - 1000,
                  deleted: false,
                  isSystem: false,
                },
              },
            },
            design: {
              metadata: { name: 'ui-ux-design', channelId: 'design' },
              messages: {
                msg_des_1: {
                  messageId: 'msg_des_1',
                  content: 'Dark mode contrast audit passes WCAG AAA specifications.',
                  senderName: 'Alice Developer',
                  createdAt: Date.now() - 500,
                  deleted: false,
                  isSystem: false,
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
  // Group 1: Canonical RTDB Chat Path & Multi-Channel Discovery
  // -------------------------------------------------------------
  describe('💬 1. Canonical Chat Path & Multi-Channel Traversal', () => {
    it('TEST 1: Discovers messages from canonical workspaceChats path', async () => {
      const res = await searchController.searchWorkspaceHandler('org_alpha', 'user_alice', {
        query: 'general channel',
        filter: SEARCH_RESOURCE_TYPES.CHAT,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.results.length, 1);
      assert.strictEqual(res.results[0].resourceId, 'msg_gen_1');
      assert.strictEqual(res.results[0].resourceType, 'chat');
      assert.strictEqual(res.results[0].metadata.channelId, 'general');
    });

    it('TEST 2: Discovers messages across custom channels (#engineering)', async () => {
      const res = await searchController.searchWorkspaceHandler('org_alpha', 'user_alice', {
        query: 'Python parsing pipeline',
        filter: SEARCH_RESOURCE_TYPES.CHAT,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.results.length, 1);
      assert.strictEqual(res.results[0].resourceId, 'msg_eng_1');
      assert.strictEqual(res.results[0].metadata.channelId, 'engineering');
      assert.strictEqual(res.results[0].title.includes('#engineering'), true);
      assert.strictEqual(
        res.results[0].actionUrl,
        '/workspaces/org_alpha/chat?channel=engineering&messageId=msg_eng_1'
      );
    });

    it('TEST 3: Discovers messages in #design channel using metadata display name', async () => {
      const res = await searchController.searchWorkspaceHandler('org_alpha', 'user_alice', {
        query: 'contrast audit',
        filter: SEARCH_RESOURCE_TYPES.CHAT,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.results.length, 1);
      assert.strictEqual(res.results[0].resourceId, 'msg_des_1');
      assert.strictEqual(res.results[0].title.includes('#ui-ux-design'), true);
    });

    it('TEST 4: Never returns soft-deleted chat messages', async () => {
      const res = await searchController.searchWorkspaceHandler('org_alpha', 'user_alice', {
        query: 'Secret leaked token',
        filter: SEARCH_RESOURCE_TYPES.CHAT,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.results.length, 0);
    });

    it('TEST 5: Never returns system chat messages', async () => {
      const res = await searchController.searchWorkspaceHandler('org_alpha', 'user_alice', {
        query: 'added Bob to the channel',
        filter: SEARCH_RESOURCE_TYPES.CHAT,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.results.length, 0);
    });

    it('TEST 6: Returns empty chat results when canonical workspaceChats contains no matching messages and never queries deprecated workspace_chats', async () => {
      // Spy on paths requested through rtdbService.getData
      const requestedPaths = [];
      const originalGetData = rtdbService.getData;
      rtdbService.getData = async (path) => {
        requestedPaths.push(path);
        return originalGetData(path);
      };

      try {
        // Remove canonical chat data
        delete mockDb.workspaceChats;
        // Even if legacy data existed in mockDb, it must never be read
        mockDb.workspace_chats = {
          org_alpha: {
            channels: {
              engineering: {
                messages: {
                  msg_legacy: {
                    messageId: 'msg_legacy',
                    content: 'Legacy message that must never be returned',
                    senderName: 'Legacy User',
                    deleted: false,
                    isSystem: false,
                  },
                },
              },
            },
          },
        };

        const res = await searchController.searchWorkspaceHandler('org_alpha', 'user_alice', {
          query: 'Legacy message',
          filter: SEARCH_RESOURCE_TYPES.CHAT,
        });

        assert.strictEqual(res.success, true);
        assert.strictEqual(Array.isArray(res.results), true);
        assert.strictEqual(res.results.length, 0);

        // Explicitly assert that workspace_chats was NEVER requested
        const queriedLegacy = requestedPaths.some((p) => p.includes('workspace_chats'));
        assert.strictEqual(
          queriedLegacy,
          false,
          'searchController must NEVER query deprecated workspace_chats path'
        );
      } finally {
        rtdbService.getData = originalGetData;
      }
    });
  });

  // -------------------------------------------------------------
  // Group 2: Multi-Entity Coverage & Deletion Invariants
  // -------------------------------------------------------------
  describe('📦 2. Multi-Entity Search Coverage & Soft-Delete Invariant', () => {
    it('TEST 7: Discovers Proposals matching title, problem, or tech stack', async () => {
      const res = await searchController.searchWorkspaceHandler('org_alpha', 'user_alice', {
        query: 'Fastify',
        filter: SEARCH_RESOURCE_TYPES.IDEA,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.results.length, 1);
      assert.strictEqual(res.results[0].resourceType, 'idea');
      assert.strictEqual(res.results[0].resourceId, 'idea_101');
    });

    it('TEST 8: Never returns deleted proposals', async () => {
      const res = await searchController.searchWorkspaceHandler('org_alpha', 'user_alice', {
        query: 'Deleted Legacy Tool',
        filter: SEARCH_RESOURCE_TYPES.IDEA,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.results.length, 0);
    });

    it('TEST 9: Discovers Blueprint requirements by ID (REQ-01)', async () => {
      const res = await searchController.searchWorkspaceHandler('org_alpha', 'user_alice', {
        query: 'REQ-01',
        filter: SEARCH_RESOURCE_TYPES.BLUEPRINT,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.results.length, 1);
      assert.strictEqual(res.results[0].badgeLabel, 'Requirement');
      assert.strictEqual(res.results[0].metadata.tab, 'requirements');
    });

    it('TEST 10: Discovers Blueprint execution tasks by ID (TASK-02)', async () => {
      const res = await searchController.searchWorkspaceHandler('org_alpha', 'user_alice', {
        query: 'TASK-02',
        filter: SEARCH_RESOURCE_TYPES.BLUEPRINT,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.results.length, 1);
      assert.strictEqual(res.results[0].badgeLabel, 'Task');
      assert.strictEqual(res.results[0].metadata.tab, 'execution');
    });

    it('TEST 11: Discovers Questions on proposals and generates deep links', async () => {
      const res = await searchController.searchWorkspaceHandler('org_alpha', 'user_alice', {
        query: 'Docx format',
        filter: SEARCH_RESOURCE_TYPES.QUESTION,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.results.length, 1);
      assert.strictEqual(res.results[0].resourceType, 'question');
      assert.strictEqual(res.results[0].badgeLabel, 'Question');
      assert.strictEqual(
        res.results[0].actionUrl,
        '/workspaces/org_alpha/ideas/idea_101?tab=questions&discussionId=disc_1'
      );
    });

    it('TEST 12: Discovers Suggestions on proposals', async () => {
      const res = await searchController.searchWorkspaceHandler('org_alpha', 'user_alice', {
        query: 'OCR fallback',
        filter: SEARCH_RESOURCE_TYPES.SUGGESTION,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.results.length, 1);
      assert.strictEqual(res.results[0].badgeLabel, 'Suggestion');
    });

    it('TEST 13: Never returns deleted discussions', async () => {
      const res = await searchController.searchWorkspaceHandler('org_alpha', 'user_alice', {
        query: 'Deleted comment test',
        filter: SEARCH_RESOURCE_TYPES.ALL,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.results.length, 0);
    });

    it('TEST 14: Discovers Workspace Activity events', async () => {
      const res = await searchController.searchWorkspaceHandler('org_alpha', 'user_alice', {
        query: 'created proposal',
        filter: SEARCH_RESOURCE_TYPES.ACTIVITY,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.results.length, 1);
      assert.strictEqual(res.results[0].badgeLabel, 'Activity');
    });
  });

  // -------------------------------------------------------------
  // Group 3: Strict Workspace Authorization & Boundary Isolation
  // -------------------------------------------------------------
  describe('🔒 3. Workspace Authorization & Isolation', () => {
    it('TEST 15: Rejects search when workspaceId or userUid is missing with status 400', async () => {
      await assert.rejects(
        async () => searchController.searchWorkspaceHandler(null, 'user_alice', { query: 'Resume' }),
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.message, 'Workspace ID and User UID are required for search.');
          return true;
        }
      );

      await assert.rejects(
        async () => searchController.searchWorkspaceHandler('org_alpha', null, { query: 'Resume' }),
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          return true;
        }
      );
    });

    it('TEST 16: Blocks User Charlie (Org Beta member) from searching Org Alpha data with 403', async () => {
      await assert.rejects(
        async () => searchController.searchWorkspaceHandler('org_alpha', 'user_charlie', { query: 'Resume' }),
        (err) => {
          assert.strictEqual(err.statusCode, 403);
          assert.match(err.message, /Unauthorized: You must be an authorized member/);
          return true;
        }
      );
    });

    it('TEST 17: Allows authorized workspace member (User Bob) to search Org Alpha', async () => {
      const res = await searchController.searchWorkspaceHandler('org_alpha', 'user_bob', { query: 'Resume' });
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.results.length > 0, true);
    });

    it('TEST 18: Returns 404 for non-existent workspace', async () => {
      await assert.rejects(
        async () => searchController.searchWorkspaceHandler('org_nonexistent', 'user_bob', { query: 'Resume' }),
        (err) => {
          assert.strictEqual(err.statusCode, 404);
          assert.strictEqual(err.message, 'Workspace does not exist.');
          return true;
        }
      );
    });
  });

  // -------------------------------------------------------------
  // Group 4: Bounds, Query Sanitization & Relevance Ranking
  // -------------------------------------------------------------
  describe('⚡ 4. Bounds, Query Sanitization & Relevance Ranking', () => {
    it('TEST 19: Short queries (< 2 characters) return empty array cleanly', async () => {
      const resEmpty = await searchController.searchWorkspaceHandler('org_alpha', 'user_alice', { query: '' });
      assert.strictEqual(resEmpty.results.length, 0);

      const resOneChar = await searchController.searchWorkspaceHandler('org_alpha', 'user_alice', { query: 'x' });
      assert.strictEqual(resOneChar.results.length, 0);
    });

    it('TEST 20: Clamps result limit to maximum 60 items', async () => {
      const res = await searchController.searchWorkspaceHandler('org_alpha', 'user_alice', {
        query: 'Resume',
        limit: 1000,
      });
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.results.length <= 60, true);
    });

    it('TEST 21: Supports payload.q alias identically to payload.query', async () => {
      const res = await searchController.searchWorkspaceHandler('org_alpha', 'user_alice', {
        q: 'Resume',
      });
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.results.length > 0, true);
    });

    it('TEST 22: Ranks exact title matches higher than excerpt-only matches', () => {
      const exactScore = computeRelevanceScore('Automated Resume Screening AI', '', 'Automated Resume Screening AI');
      const partialScore = computeRelevanceScore('Other title', 'Automated Resume Screening AI in body', 'Automated Resume Screening AI');
      assert.strictEqual(exactScore > partialScore, true);
    });

    it('TEST 23: Extracts concise excerpt around matched query without crashing', () => {
      const snippet = extractMatchedExcerpt('The quick brown fox jumps over the lazy dog', 'fox', 20);
      assert.strictEqual(snippet.toLowerCase().includes('fox'), true);
      assert.strictEqual(snippet.length <= 30, true);
    });
  });

  // -------------------------------------------------------------
  // Group 5: Express Router Endpoints (POST and GET) Integration
  // -------------------------------------------------------------
  describe('🌐 5. Express Router Endpoints Integration', () => {
    function createMockReqRes({ user = null, body = {}, params = {}, query = {} } = {}) {
      const req = {
        user,
        body,
        params,
        query,
        headers: {},
      };

      let statusCode = 200;
      let jsonResponse = null;

      const res = {
        status(code) {
          statusCode = code;
          return res;
        },
        json(payload) {
          jsonResponse = payload;
          return res;
        },
        getStatusCode: () => statusCode,
        getJsonResponse: () => jsonResponse,
      };

      return { req, res };
    }

    it('TEST 24: POST /api/search/workspace returns 200 with matching results for authorized member', async () => {
      const { req, res } = createMockReqRes({
        user: { uid: 'user_alice', authenticated: true },
        body: {
          workspaceId: 'org_alpha',
          query: 'Resume',
          limit: 10,
        },
      });

      const postLayer = searchRouter.stack.find((l) => l.route?.path === '/workspace' && l.route?.methods?.post);
      assert.ok(postLayer, 'POST /workspace route must be defined');
      await postLayer.route.stack[0].handle(req, res);

      assert.strictEqual(res.getStatusCode(), 200);
      const json = res.getJsonResponse();
      assert.strictEqual(json.success, true);
      assert.strictEqual(Array.isArray(json.data.results), true);
      assert.strictEqual(json.data.results.length > 0, true);
    });

    it('TEST 25: POST /api/search/workspace returns 400 when workspaceId is missing', async () => {
      const { req, res } = createMockReqRes({
        user: { uid: 'user_alice', authenticated: true },
        body: {
          query: 'Resume',
        },
      });

      const postLayer = searchRouter.stack.find((l) => l.route?.path === '/workspace' && l.route?.methods?.post);
      await postLayer.route.stack[0].handle(req, res);

      assert.strictEqual(res.getStatusCode(), 400);
      const json = res.getJsonResponse();
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.error.code, 'INVALID_PARAMETERS');
    });

    it('TEST 26: GET /api/search/:workspaceId returns 200 with matching results for authorized member', async () => {
      const { req, res } = createMockReqRes({
        user: { uid: 'user_alice', authenticated: true },
        params: { workspaceId: 'org_alpha' },
        query: { q: 'Resume' },
      });

      const getLayer = searchRouter.stack.find((l) => l.route?.path === '/:workspaceId' && l.route?.methods?.get);
      assert.ok(getLayer, 'GET /:workspaceId route must be defined');
      await getLayer.route.stack[0].handle(req, res);

      assert.strictEqual(res.getStatusCode(), 200);
      const json = res.getJsonResponse();
      assert.strictEqual(json.success, true);
      assert.strictEqual(Array.isArray(json.data.results), true);
      assert.strictEqual(json.data.results.length > 0, true);
    });

    it('TEST 27: GET /api/search/:workspaceId supports ?query=... alias', async () => {
      const { req, res } = createMockReqRes({
        user: { uid: 'user_alice', authenticated: true },
        params: { workspaceId: 'org_alpha' },
        query: { query: 'Resume' },
      });

      const getLayer = searchRouter.stack.find((l) => l.route?.path === '/:workspaceId' && l.route?.methods?.get);
      await getLayer.route.stack[0].handle(req, res);

      assert.strictEqual(res.getStatusCode(), 200);
      const json = res.getJsonResponse();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.results.length > 0, true);
    });

    it('TEST 28: GET /api/search/:workspaceId blocks unauthorized member with 403', async () => {
      const { req, res } = createMockReqRes({
        user: { uid: 'user_charlie', authenticated: true },
        params: { workspaceId: 'org_alpha' },
        query: { q: 'Resume' },
      });

      const getLayer = searchRouter.stack.find((l) => l.route?.path === '/:workspaceId' && l.route?.methods?.get);
      await getLayer.route.stack[0].handle(req, res);

      assert.strictEqual(res.getStatusCode(), 403);
      const json = res.getJsonResponse();
      assert.strictEqual(json.success, false);
      assert.match(json.error.message, /Unauthorized: You must be an authorized member/);
    });
  });
});
