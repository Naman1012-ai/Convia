import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';

import { workspaceDashboardController } from '../../controllers/workspaceDashboardController.js';
import { rtdbService } from '../rtdbService.js';

describe('🧪 CONVIA PHASE 10 — WORKSPACE DASHBOARD, UNIFIED ACTIVITY & COLLABORATION INSIGHTS', () => {
  let mockDb = {};

  beforeEach(() => {
    mockDb = {
      organizations: {
        workspace_alpha: {
          id: 'workspace_alpha',
          orgId: 'workspace_alpha',
          name: 'Alpha Quantum Labs',
          description: 'Core engineering and product development workspace.',
          ownerId: 'user_lead_alice',
          activeProjectId: 'idea_mvp_01',
          status: 'project',
        },
        workspace_beta: {
          id: 'workspace_beta',
          orgId: 'workspace_beta',
          name: 'Beta Ideation Studio',
          description: 'Early-stage ideation space.',
          ownerId: 'user_lead_bob',
          status: 'ideation',
        },
        workspace_empty: {
          id: 'workspace_empty',
          orgId: 'workspace_empty',
          name: 'Empty Workspace',
          ownerId: 'user_lead_alice',
          status: 'ideation',
        },
      },
      organization_members: {
        workspace_alpha: {
          user_lead_alice: { uid: 'user_lead_alice', role: 'owner' },
          user_dev_charlie: { uid: 'user_dev_charlie', role: 'member' },
        },
        workspace_beta: {
          user_lead_bob: { uid: 'user_lead_bob', role: 'owner' },
          user_dev_dana: { uid: 'user_dev_dana', role: 'member' },
        },
        workspace_empty: {
          user_lead_alice: { uid: 'user_lead_alice', role: 'owner' },
        },
      },
      ideas: {
        workspace_alpha: {
          idea_mvp_01: {
            ideaId: 'idea_mvp_01',
            orgId: 'workspace_alpha',
            title: 'Decentralized Vector Indexing',
            description: 'Scalable HNSW vector index distribution across worker nodes.',
            voteCount: 15,
            discussionCount: 3,
            isSelected: true,
            authorId: 'user_lead_alice',
            authorName: 'Alice Leader',
            createdAt: 1710000000000,
            isDeleted: false,
          },
          idea_sec_02: {
            ideaId: 'idea_sec_02',
            orgId: 'workspace_alpha',
            title: 'Automated Security Scanner',
            description: 'Static analysis for smart contracts.',
            voteCount: 7,
            discussionCount: 1,
            isSelected: false,
            authorId: 'user_dev_charlie',
            authorName: 'Charlie Dev',
            createdAt: 1710001000000,
            isDeleted: false,
          },
          idea_deleted: {
            ideaId: 'idea_deleted',
            orgId: 'workspace_alpha',
            title: 'Old Abandoned Proposal',
            voteCount: 99,
            isDeleted: true, // MUST be excluded
          },
        },
        workspace_beta: {
          idea_beta_01: {
            ideaId: 'idea_beta_01',
            orgId: 'workspace_beta',
            title: 'Community Knowledge Graph',
            description: 'Graph-based knowledge base for Convia contributors.',
            voteCount: 0,
            discussionCount: 0,
            isSelected: false,
            authorId: 'user_dev_dana',
            createdAt: 1710002000000,
            isDeleted: false,
          },
        },
        workspace_empty: {},
      },
      blueprints: {
        workspace_alpha: {
          idea_mvp_01: {
            blueprintId: 'bp_alpha_01',
            version: '2.0',
            schemaVersion: 2,
            lifecycleState: 'active',
            approvalStatus: 'approved',
            status: 'completed',
            mvpIdeaId: 'idea_mvp_01',
            ideaTitle: 'Decentralized Vector Indexing',
            content: {
              projectOverview: { title: 'Decentralized Vector Indexing' },
              execution: {
                tasks: [
                  { id: 'T-01', title: 'Setup Distributed Shard' },
                  { id: 'T-02', title: 'Implement Raft Consensus' },
                  { id: 'T-03', title: 'Deploy Benchmarks' },
                ],
                executionWaves: [{ waveIndex: 1 }, { waveIndex: 2 }],
                criticalPathTaskIds: ['T-01', 'T-02'],
              },
            },
            updatedAt: 1710003000000,
          },
        },
      },
      discussions: {
        workspace_alpha: {
          idea_mvp_01: {
            disc_q1: {
              discussionId: 'disc_q1',
              type: 'question',
              message: 'What is the maximum latency threshold for Raft heartbeats?',
              authorId: 'user_dev_charlie',
              authorName: 'Charlie Dev',
              parentId: null,
              createdAt: 1710002500000,
              isDeleted: false,
            },
            disc_s1: {
              discussionId: 'disc_s1',
              type: 'suggestion',
              message: 'We should consider gRPC streams over REST for shard replication.',
              authorId: 'user_dev_charlie',
              authorName: 'Charlie Dev',
              parentId: null,
              isAccepted: true,
              createdAt: 1710002600000,
              isDeleted: false,
            },
            disc_del: {
              discussionId: 'disc_del',
              type: 'question',
              message: 'Spam deleted question',
              parentId: null,
              isDeleted: true,
            },
          },
        },
      },
      workspace_activity: {
        workspace_alpha: {
          act_01: {
            id: 'act_01',
            eventType: 'idea.created',
            summary: 'Alice created proposal "Decentralized Vector Indexing"',
            actorId: 'user_lead_alice',
            createdAt: 1710000000000,
          },
          act_02: {
            id: 'act_02',
            eventType: 'blueprint.approved',
            summary: 'Alice approved Blueprint v2.0',
            actorId: 'user_lead_alice',
            createdAt: 1710003000000,
          },
        },
      },
    };

    // Mock rtdbService.getData
    rtdbService.getData = async (path) => {
      const parts = path.split('/').filter(Boolean);
      let current = mockDb;
      for (const part of parts) {
        if (current === undefined || current === null) return null;
        current = current[part];
      }
      return current !== undefined ? JSON.parse(JSON.stringify(current)) : null;
    };
  });

  // --------------------------------------------------------------------------
  // 1. DATA CONTRACT & AUTHORIZATION TESTS
  // --------------------------------------------------------------------------
  it('1.1: Aggregates workspace dashboard overview for authorized members with exact data contracts', async () => {
    const data = await workspaceDashboardController.getWorkspaceDashboardHandler(
      'workspace_alpha',
      'user_lead_alice'
    );

    assert.ok(data, 'Dashboard payload should be defined');
    assert.strictEqual(data.workspaceId, 'workspace_alpha');
    assert.strictEqual(data.org.name, 'Alpha Quantum Labs');
    assert.strictEqual(data.totalIdeas, 2, 'Must include only 2 active ideas, excluding deleted');
    assert.strictEqual(data.totalVotes, 22, 'Sum of 15 + 7 votes = 22');
    assert.strictEqual(data.totalMembers, 2, '2 members in workspace_alpha');
    assert.strictEqual(data.openQuestions, 1, '1 open question excluding deleted');
    assert.strictEqual(data.totalSuggestions, 1, '1 suggestion');
    assert.strictEqual(data.acceptedSuggestions, 1, '1 accepted suggestion');
    assert.ok(data.selectedMvp, 'Selected MVP must be present');
    assert.strictEqual(data.selectedMvp.ideaId, 'idea_mvp_01');
    assert.strictEqual(data.selectedMvp.isSelected, true);

    // Verify Blueprint Contract
    assert.ok(data.blueprint, 'Blueprint should be normalized');
    assert.strictEqual(data.blueprint.status, 'completed');
    assert.strictEqual(data.blueprint.version, '2.0');
    assert.strictEqual(data.blueprint.taskCount, 3);
    assert.strictEqual(data.blueprint.wavesCount, 2);
    assert.strictEqual(data.blueprint.criticalPathLength, 2);
    assert.strictEqual(data.blueprint.approvalStatus, 'approved');

    // Verify Recent Activity
    assert.strictEqual(data.recentActivity.length, 2);
    assert.strictEqual(data.recentActivity[0].id, 'act_02', 'Activity sorted newest first');
  });

  it('1.2: Enforces strict membership authorization — non-members are rejected with 403', async () => {
    await assert.rejects(
      async () => {
        // user_stranger is NOT in workspace_alpha
        await workspaceDashboardController.getWorkspaceDashboardHandler(
          'workspace_alpha',
          'user_stranger'
        );
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.match(err.message, /Unauthorized/i);
        return true;
      }
    );
  });

  it('1.3: Rejects requests for non-existent workspaces with 404', async () => {
    await assert.rejects(
      async () => {
        await workspaceDashboardController.getWorkspaceDashboardHandler(
          'workspace_non_existent',
          'user_lead_alice'
        );
      },
      (err) => {
        assert.strictEqual(err.statusCode, 404);
        assert.match(err.message, /Workspace does not exist/i);
        return true;
      }
    );
  });

  it('1.4: Rejects missing workspace ID or user UID with 400', async () => {
    await assert.rejects(
      async () => {
        await workspaceDashboardController.getWorkspaceDashboardHandler('', 'user_lead_alice');
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await workspaceDashboardController.getWorkspaceDashboardHandler('workspace_alpha', '');
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // 2. STRICT WORKSPACE ISOLATION & MULTI-TENANT SEPARATION
  // --------------------------------------------------------------------------
  it('2.1: Guarantees complete workspace isolation between Workspace A and Workspace B', async () => {
    const dataAlpha = await workspaceDashboardController.getWorkspaceDashboardHandler(
      'workspace_alpha',
      'user_lead_alice'
    );
    const dataBeta = await workspaceDashboardController.getWorkspaceDashboardHandler(
      'workspace_beta',
      'user_lead_bob'
    );

    // Alpha checks
    assert.strictEqual(dataAlpha.workspaceId, 'workspace_alpha');
    assert.strictEqual(dataAlpha.totalIdeas, 2);
    assert.strictEqual(dataAlpha.blueprint?.version, '2.0');
    assert.strictEqual(dataAlpha.recentIdeas[0].title, 'Decentralized Vector Indexing');

    // Beta checks
    assert.strictEqual(dataBeta.workspaceId, 'workspace_beta');
    assert.strictEqual(dataBeta.totalIdeas, 1);
    assert.strictEqual(dataBeta.blueprint, null, 'Beta has no blueprint');
    assert.strictEqual(dataBeta.recentIdeas[0].title, 'Community Knowledge Graph');
    assert.strictEqual(dataBeta.totalVotes, 0);

    // Cross-tenant bleed check: Alpha idea cannot appear in Beta
    const hasAlphaInBeta = dataBeta.recentIdeas.some((i) => i.ideaId === 'idea_mvp_01');
    assert.strictEqual(hasAlphaInBeta, false, 'No cross-workspace proposal bleed');
  });

  // --------------------------------------------------------------------------
  // 3. ATTENTION ITEMS DERIVATION RULES
  // --------------------------------------------------------------------------
  it('3.1: Attention derivation triggers empty workspace guide when 0 proposals exist', () => {
    const attention = workspaceDashboardController.deriveAttentionItems(
      { totalIdeas: 0, blueprint: null, totalVotes: 0 },
      false,
      'workspace_empty'
    );

    const emptyItem = attention.find((item) => item.id === 'no_ideas');
    assert.ok(emptyItem, 'Empty workspace attention item must be generated');
    assert.strictEqual(emptyItem.severity, 'primary');
    assert.strictEqual(emptyItem.actionKey, 'create_idea');
  });

  it('3.2: Attention derivation triggers voting prompt when ideas exist with zero votes', () => {
    const attention = workspaceDashboardController.deriveAttentionItems(
      { totalIdeas: 2, totalVotes: 0, selectedMvp: null, blueprint: null },
      false,
      'workspace_beta'
    );

    const voteItem = attention.find((item) => item.id === 'vote_ideas');
    assert.ok(voteItem, 'Voting prompt must be present');
    assert.strictEqual(voteItem.severity, 'info');
    assert.strictEqual(voteItem.actionUrl, '/workspaces/workspace_beta/ideas');
  });

  it('3.3: Attention derivation triggers leader MVP selection when ideas have votes and no MVP selected', () => {
    const attention = workspaceDashboardController.deriveAttentionItems(
      { totalIdeas: 2, totalVotes: 5, selectedMvp: null, blueprint: null },
      true, // isLeader
      'workspace_beta'
    );

    const mvpItem = attention.find((item) => item.id === 'select_mvp_leader');
    assert.ok(mvpItem, 'Leader MVP selection item must be present for lead');
    assert.strictEqual(mvpItem.severity, 'warning');
  });

  it('3.4: Attention derivation triggers critical danger alert on Blueprint failure', () => {
    const attention = workspaceDashboardController.deriveAttentionItems(
      {
        totalIdeas: 2,
        totalVotes: 10,
        selectedMvp: { ideaId: 'idea_01' },
        blueprint: { status: 'failed', lastError: 'API quota exceeded during synthesis.' },
      },
      true,
      'workspace_alpha'
    );

    const failItem = attention.find((item) => item.id === 'bp_failed');
    assert.ok(failItem, 'Failure alert must be present');
    assert.strictEqual(failItem.severity, 'danger');
    assert.match(failItem.message, /API quota exceeded/);
    assert.strictEqual(failItem.actionUrl, '/workspaces/workspace_alpha/ideas/idea_01/blueprint');
  });

  it('3.5: Attention derivation triggers generating progress alert while Blueprint synthesizes', () => {
    const attention = workspaceDashboardController.deriveAttentionItems(
      {
        totalIdeas: 2,
        selectedMvp: { ideaId: 'idea_01' },
        blueprint: { status: 'generating', generationStage: 'ai_synthesis' },
      },
      true,
      'workspace_alpha'
    );

    const genItem = attention.find((item) => item.id === 'bp_generating');
    assert.ok(genItem, 'Generating attention item must be present');
    assert.strictEqual(genItem.severity, 'info');
    assert.match(genItem.message, /Synthesizing specification with Gemini/);
  });

  it('3.6: Attention derivation triggers review prompt when completed Blueprint is pending approval', () => {
    const attention = workspaceDashboardController.deriveAttentionItems(
      {
        totalIdeas: 2,
        selectedMvp: { ideaId: 'idea_01' },
        blueprint: { status: 'completed', approvalStatus: 'pending_approval', version: '1.2' },
      },
      true,
      'workspace_alpha'
    );

    const apprItem = attention.find((item) => item.id === 'bp_approval');
    assert.ok(apprItem, 'Pending approval attention item must be present');
    assert.strictEqual(apprItem.severity, 'warning');
    assert.strictEqual(apprItem.title, 'Blueprint v1.2 Pending Review');
  });

  it('3.7: Attention derivation notes open questions requiring technical resolution', () => {
    const attention = workspaceDashboardController.deriveAttentionItems(
      {
        totalIdeas: 2,
        openQuestions: 4,
        blueprint: { status: 'completed', approvalStatus: 'approved' },
      },
      false,
      'workspace_alpha'
    );

    const qItem = attention.find((item) => item.id === 'open_questions');
    assert.ok(qItem, 'Open questions item must be present');
    assert.strictEqual(qItem.title, '4 Open Questions on Proposals');
  });

  // --------------------------------------------------------------------------
  // 4. METRIC ACCURACY & INTEGRITY VERIFICATION (ZERO FAKE DATA)
  // --------------------------------------------------------------------------
  it('4.1: Strictly reflects authentic underlying data with zero fabricated statistics', async () => {
    const data = await workspaceDashboardController.getWorkspaceDashboardHandler(
      'workspace_alpha',
      'user_lead_alice'
    );

    // Disallow fake productivity metrics or arbitrary vanity scores
    assert.strictEqual(data.productivityScore, undefined, 'No fake productivity score');
    assert.strictEqual(data.velocityRate, undefined, 'No fabricated velocity numbers');
    assert.strictEqual(data.burndownPercentage, undefined, 'No fake burndown statistics');

    // Ensure all returned counts match exact counts from mock database
    assert.strictEqual(data.totalIdeas, 2);
    assert.strictEqual(data.totalVotes, 22);
    assert.strictEqual(data.totalMembers, 2);
    assert.strictEqual(data.openQuestions, 1);
    assert.strictEqual(data.totalSuggestions, 1);
    assert.strictEqual(data.acceptedSuggestions, 1);
  });
});
