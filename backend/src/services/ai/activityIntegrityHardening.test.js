import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { activityController } from '../../controllers/activityController.js';
import { activityService } from '../activityService.js';
import { rtdbService } from '../rtdbService.js';
import {
  ACTIVITY_EVENT_TYPES,
  ACTIVITY_CATEGORIES,
  getActivityCategory,
  buildActivityDedupeKey,
  createCanonicalActivity,
} from '../../constants/activityConstants.js';
import { accountDeletionService } from '../accountDeletionService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load actual database.rules.json
const rulesJsonPath = path.resolve(__dirname, '../../../../database.rules.json');
const rawRules = JSON.parse(fs.readFileSync(rulesJsonPath, 'utf8'));

// ---------------------------------------------------------------------------
// Mock Helpers for Express Req / Res
// ---------------------------------------------------------------------------

function createMockReq({ user = null, params = {}, body = {}, query = {} } = {}) {
  return {
    user,
    params,
    body,
    query,
    headers: {},
  };
}

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(data) {
      res.body = data;
      return res;
    },
  };
  return res;
}

// ---------------------------------------------------------------------------
// Test Suite: CONVIA — P2-01 AUDIT / ACTIVITY INTEGRITY & SERVER AUTHORITY
// ---------------------------------------------------------------------------

describe('CONVIA — P2-01 AUDIT / ACTIVITY INTEGRITY & SERVER AUTHORITY HARDENING', () => {

  // =========================================================================
  // Section 1: Security Rules Boundary Enforcement (database.rules.json)
  // =========================================================================
  describe('🔒 1. Security Rules Boundary Enforcement (database.rules.json)', () => {
    const activityRules = rawRules.rules.workspace_activity;

    it('verifies workspace_activity root exists and indexes on createdAt, eventType, actorId', () => {
      assert.ok(activityRules, 'workspace_activity must exist in database.rules.json');
      const wsRules = activityRules['$workspaceId'];
      assert.ok(wsRules, 'workspace_activity.$workspaceId must exist');
      assert.deepStrictEqual(
        wsRules['.indexOn'],
        ['createdAt', 'eventType', 'actorId'],
        'Must index on createdAt, eventType, actorId for query performance'
      );
    });

    it('verifies workspace_activity .read strictly requires workspace membership or ownership', () => {
      const readRule = activityRules['$workspaceId']['.read'];
      assert.ok(readRule, 'workspace_activity must have explicit .read rule');
      assert.ok(readRule.includes('auth != null'), 'Must require authenticated user');
      assert.ok(
        readRule.includes('organization_members') && !readRule.includes('workspace_members'),
        'Must check canonical organization_members table and not legacy workspace_members'
      );
      assert.ok(readRule.includes('ownerId'), 'Must check ownerId');
    });

    it('verifies workspace_activity .write is strictly false (denies all direct client writes)', () => {
      const writeRule = activityRules['$workspaceId']['.write'];
      assert.strictEqual(
        writeRule,
        false,
        'workspace_activity .write MUST be false to completely deny direct client writes'
      );
    });

    it('proves client cannot directly write, modify, or delete activity records in RTDB', () => {
      // Evaluator simulating RTDB client rule evaluation
      function evaluateClientWrite({ auth, path: targetPath, data = null, newData = null }) {
        const segments = targetPath.split('/').filter(Boolean);
        if (segments[0] !== 'workspace_activity') return { allowed: true };
        const writeRule = activityRules['$workspaceId']['.write'];
        if (writeRule === false) {
          return { allowed: false, reason: 'CLIENT_WRITE_FORBIDDEN' };
        }
        return { allowed: true };
      }

      // 1. Direct create attempt
      const createRes = evaluateClientWrite({
        auth: { uid: 'user_bob' },
        path: 'workspace_activity/org_123/act_999',
        data: null,
        newData: { id: 'act_999', actorId: 'system' },
      });
      assert.strictEqual(createRes.allowed, false);
      assert.strictEqual(createRes.reason, 'CLIENT_WRITE_FORBIDDEN');

      // 2. Direct modify attempt
      const updateRes = evaluateClientWrite({
        auth: { uid: 'user_bob' },
        path: 'workspace_activity/org_123/act_999',
        data: { id: 'act_999', summary: 'Original' },
        newData: { id: 'act_999', summary: 'Tampered' },
      });
      assert.strictEqual(updateRes.allowed, false);

      // 3. Direct delete attempt
      const deleteRes = evaluateClientWrite({
        auth: { uid: 'user_bob' },
        path: 'workspace_activity/org_123/act_999',
        data: { id: 'act_999' },
        newData: null,
      });
      assert.strictEqual(deleteRes.allowed, false);
    });
  });

  // =========================================================================
  // Section 2: Authoritative Server Activity Endpoint Authorization
  // =========================================================================
  describe('🛡️ 2. Server Activity Endpoint Authorization & Access Control', () => {
    let originalGetData;
    let originalSetData;
    let mockDb;

    beforeEach(() => {
      mockDb = {
        organizations: {
          org_alpha: { orgId: 'org_alpha', name: 'Alpha Org', ownerId: 'user_owner' },
          org_beta: { orgId: 'org_beta', name: 'Beta Org', ownerId: 'user_charlie' },
        },
        organization_members: {
          org_alpha: {
            user_alice: { uid: 'user_alice', role: 'member' },
            user_owner: { uid: 'user_owner', role: 'owner' },
          },
          org_beta: {
            user_charlie: { uid: 'user_charlie', role: 'owner' },
          },
        },
        users: {
          user_alice: { uid: 'user_alice', displayName: 'Alice Wonder', email: 'alice@test.com' },
          user_bob: { uid: 'user_bob', displayName: 'Bob Builder', email: 'bob@test.com' },
        },
        workspace_activity: {},
      };

      originalGetData = rtdbService.getData;
      originalSetData = rtdbService.setData;

      rtdbService.getData = async (pathStr) => {
        const parts = pathStr.split('/').filter(Boolean);
        let curr = mockDb;
        for (const p of parts) {
          if (!curr || typeof curr !== 'object') return null;
          curr = curr[p];
        }
        return curr !== undefined ? curr : null;
      };

      rtdbService.setData = async (pathStr, val) => {
        const parts = pathStr.split('/').filter(Boolean);
        let curr = mockDb;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!curr[parts[i]]) curr[parts[i]] = {};
          curr = curr[parts[i]];
        }
        curr[parts[parts.length - 1]] = val;
        return true;
      };
    });

    afterEach(() => {
      rtdbService.getData = originalGetData;
      rtdbService.setData = originalSetData;
    });

    it('rejects unauthenticated requests with 401 UNAUTHORIZED', async () => {
      const req = createMockReq({ user: null, params: { workspaceId: 'org_alpha' } });
      const res = createMockRes();

      await activityController.recordActivityHandler(req, res);
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
    });

    it('rejects requests with missing or empty workspaceId with 400', async () => {
      const req = createMockReq({ user: { uid: 'user_alice' }, params: { workspaceId: '' } });
      const res = createMockRes();

      await activityController.recordActivityHandler(req, res);
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.error.code, 'INVALID_WORKSPACE_ID');
    });

    it('rejects non-member user attempting to record activity in another workspace with 403', async () => {
      // User Bob is not a member of org_alpha
      const req = createMockReq({
        user: { uid: 'user_bob' },
        params: { workspaceId: 'org_alpha' },
        body: {
          eventType: ACTIVITY_EVENT_TYPES.IDEA_CREATED,
          resourceType: 'idea',
          resourceId: 'idea_1',
        },
      });
      const res = createMockRes();

      await activityController.recordActivityHandler(req, res);
      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.error.code, 'FORBIDDEN_NOT_WORKSPACE_MEMBER');
    });

    it('allows authorized workspace member to record activity successfully with 201', async () => {
      const req = createMockReq({
        user: { uid: 'user_alice' },
        params: { workspaceId: 'org_alpha' },
        body: {
          eventType: ACTIVITY_EVENT_TYPES.IDEA_CREATED,
          resourceType: 'idea',
          resourceId: 'idea_100',
          resourceTitle: 'Autonomous Agent Framework',
        },
      });
      const res = createMockRes();

      await activityController.recordActivityHandler(req, res);
      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.id);
      assert.strictEqual(res.body.data.workspaceId, 'org_alpha');
      assert.strictEqual(res.body.data.actorId, 'user_alice');
      assert.strictEqual(res.body.data.actorName, 'Alice Wonder');
    });
  });

  // =========================================================================
  // Section 3: Actor Identity Integrity & Impersonation Defenses
  // =========================================================================
  describe('👤 3. Actor Identity Integrity & Forgery Defenses', () => {
    let originalGetData;
    let originalSetData;
    let mockDb;

    beforeEach(() => {
      mockDb = {
        organizations: {
          org_alpha: { orgId: 'org_alpha', name: 'Alpha Org', ownerId: 'user_owner' },
        },
        organization_members: {
          org_alpha: {
            user_alice: { uid: 'user_alice', role: 'member' },
          },
        },
        users: {
          user_alice: { uid: 'user_alice', displayName: 'Alice Real', photoURL: 'https://avatar.com/alice.png' },
        },
        workspace_activity: {},
      };

      originalGetData = rtdbService.getData;
      originalSetData = rtdbService.setData;

      rtdbService.getData = async (pathStr) => {
        const parts = pathStr.split('/').filter(Boolean);
        let curr = mockDb;
        for (const p of parts) {
          if (!curr || typeof curr !== 'object') return null;
          curr = curr[p];
        }
        return curr !== undefined ? curr : null;
      };

      rtdbService.setData = async (pathStr, val) => {
        const parts = pathStr.split('/').filter(Boolean);
        let curr = mockDb;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!curr[parts[i]]) curr[parts[i]] = {};
          curr = curr[parts[i]];
        }
        curr[parts[parts.length - 1]] = val;
        return true;
      };
    });

    afterEach(() => {
      rtdbService.getData = originalGetData;
      rtdbService.setData = originalSetData;
    });

    it('blocks client attempt to forge actorId (forces actorId to token UID)', async () => {
      const req = createMockReq({
        user: { uid: 'user_alice' },
        params: { workspaceId: 'org_alpha' },
        body: {
          eventType: ACTIVITY_EVENT_TYPES.IDEA_CREATED,
          actorId: 'user_victim_impersonated', // Malicious forged actor!
          resourceType: 'idea',
          resourceId: 'idea_200',
        },
      });
      const res = createMockRes();

      await activityController.recordActivityHandler(req, res);
      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(
        res.body.data.actorId,
        'user_alice',
        'actorId MUST be locked to verified token UID, client-supplied actorId MUST be discarded'
      );
    });

    it('rejects client attempt to claim system actor (actorType: "system")', async () => {
      const req = createMockReq({
        user: { uid: 'user_alice' },
        params: { workspaceId: 'org_alpha' },
        body: {
          eventType: ACTIVITY_EVENT_TYPES.IDEA_CREATED,
          actorType: 'system', // Malicious attempt to forge system event!
          resourceType: 'idea',
          resourceId: 'idea_201',
        },
      });
      const res = createMockRes();

      await activityController.recordActivityHandler(req, res);
      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.error.code, 'FORBIDDEN_SYSTEM_IMPERSONATION');
    });

    it('rejects client attempt to emit system-reserved event types', async () => {
      const req = createMockReq({
        user: { uid: 'user_alice' },
        params: { workspaceId: 'org_alpha' },
        body: {
          eventType: ACTIVITY_EVENT_TYPES.BLUEPRINT_GENERATION_STARTED, // System-reserved!
          resourceType: 'blueprint',
          resourceId: 'bp_1',
        },
      });
      const res = createMockRes();

      await activityController.recordActivityHandler(req, res);
      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.error.code, 'RESERVED_SYSTEM_EVENT');
    });

    it('derives actorName and photoURL authoritatively from user profile', async () => {
      const req = createMockReq({
        user: { uid: 'user_alice' },
        params: { workspaceId: 'org_alpha' },
        body: {
          eventType: ACTIVITY_EVENT_TYPES.IDEA_CREATED,
          actorName: 'Spoofed Fake Name', // Client attempt to spoof name
          resourceType: 'idea',
          resourceId: 'idea_202',
        },
      });
      const res = createMockRes();

      await activityController.recordActivityHandler(req, res);
      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.data.actorName, 'Alice Real');
      assert.strictEqual(res.body.data.actorPhotoURL, 'https://avatar.com/alice.png');
    });
  });

  // =========================================================================
  // Section 4: Workspace Scope & Timestamp Integrity
  // =========================================================================
  describe('🌐 4. Workspace Scope & Server Timestamp Integrity', () => {
    let originalGetData;
    let originalSetData;
    let mockDb;

    beforeEach(() => {
      mockDb = {
        organizations: {
          org_alpha: { orgId: 'org_alpha', name: 'Alpha Org', ownerId: 'user_owner' },
          org_beta: { orgId: 'org_beta', name: 'Beta Org', ownerId: 'user_owner' },
        },
        organization_members: {
          org_alpha: { user_alice: { uid: 'user_alice', role: 'member' } },
          // Alice is NOT in org_beta
        },
        users: {
          user_alice: { uid: 'user_alice', displayName: 'Alice Real' },
        },
        workspace_activity: {},
      };

      originalGetData = rtdbService.getData;
      originalSetData = rtdbService.setData;

      rtdbService.getData = async (pathStr) => {
        const parts = pathStr.split('/').filter(Boolean);
        let curr = mockDb;
        for (const p of parts) {
          if (!curr || typeof curr !== 'object') return null;
          curr = curr[p];
        }
        return curr !== undefined ? curr : null;
      };

      rtdbService.setData = async (pathStr, val) => {
        const parts = pathStr.split('/').filter(Boolean);
        let curr = mockDb;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!curr[parts[i]]) curr[parts[i]] = {};
          curr = curr[parts[i]];
        }
        curr[parts[parts.length - 1]] = val;
        return true;
      };
    });

    afterEach(() => {
      rtdbService.getData = originalGetData;
      rtdbService.setData = originalSetData;
    });

    it('enforces workspaceId from validated route URL, ignoring payload injections', async () => {
      const req = createMockReq({
        user: { uid: 'user_alice' },
        params: { workspaceId: 'org_alpha' },
        body: {
          workspaceId: 'org_beta_injected', // Malicious attempt to inject different workspace
          eventType: ACTIVITY_EVENT_TYPES.IDEA_CREATED,
          resourceType: 'idea',
          resourceId: 'idea_300',
        },
      });
      const res = createMockRes();

      await activityController.recordActivityHandler(req, res);
      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.data.workspaceId, 'org_alpha');
    });

    it('generates authoritative server timestamp and overrides client-supplied timestamps', async () => {
      const fakePastTime = 1000000000; // Fake past timestamp (year 2001)
      const nowBefore = Date.now();

      const req = createMockReq({
        user: { uid: 'user_alice' },
        params: { workspaceId: 'org_alpha' },
        body: {
          createdAt: fakePastTime, // Client trying to forge event date
          eventType: ACTIVITY_EVENT_TYPES.IDEA_CREATED,
          resourceType: 'idea',
          resourceId: 'idea_301',
        },
      });
      const res = createMockRes();

      await activityController.recordActivityHandler(req, res);
      const nowAfter = Date.now();

      assert.strictEqual(res.statusCode, 201);
      assert.notStrictEqual(res.body.data.createdAt, fakePastTime);
      assert.ok(res.body.data.createdAt >= nowBefore && res.body.data.createdAt <= nowAfter);
    });
  });

  // =========================================================================
  // Section 5: Idempotency & Deduplication Engine
  // =========================================================================
  describe('🔑 5. Deduplication & Idempotency Rules', () => {
    it('produces identical deterministic activity IDs for retried idea creation (strict idempotency)', () => {
      const key1 = buildActivityDedupeKey({
        workspaceId: 'org_alpha',
        eventType: ACTIVITY_EVENT_TYPES.IDEA_CREATED,
        resourceId: 'idea_456',
        actorId: 'user_alice',
        timestamp: 1700000000000,
      });

      const key2 = buildActivityDedupeKey({
        workspaceId: 'org_alpha',
        eventType: ACTIVITY_EVENT_TYPES.IDEA_CREATED,
        resourceId: 'idea_456',
        actorId: 'user_alice',
        timestamp: 1700000005000, // Different timestamp upon network retry
      });

      assert.strictEqual(key1, key2, 'Idea creation MUST have identical dedupe key on retry');
      assert.strictEqual(key1, 'act_org_alpha_idea_created_idea_456_user_alice');
    });

    it('produces distinct activity IDs for recurring events across different timestamps', () => {
      const key1 = buildActivityDedupeKey({
        workspaceId: 'org_alpha',
        eventType: ACTIVITY_EVENT_TYPES.IDEA_UPDATED,
        resourceId: 'idea_456',
        actorId: 'user_alice',
        timestamp: 1700000000000,
      });

      const key2 = buildActivityDedupeKey({
        workspaceId: 'org_alpha',
        eventType: ACTIVITY_EVENT_TYPES.IDEA_UPDATED,
        resourceId: 'idea_456',
        actorId: 'user_alice',
        timestamp: 1700000050000,
      });

      assert.notStrictEqual(key1, key2, 'Recurring idea edits must have unique timestamped IDs');
    });

    it('handles member join and leave as recurring events with unique timestamped keys', () => {
      const joinKey = buildActivityDedupeKey({
        workspaceId: 'org_alpha',
        eventType: ACTIVITY_EVENT_TYPES.WORKSPACE_MEMBER_JOINED,
        resourceId: 'org_alpha',
        actorId: 'user_bob',
        timestamp: 1700000000000,
      });

      const leaveKey = buildActivityDedupeKey({
        workspaceId: 'org_alpha',
        eventType: ACTIVITY_EVENT_TYPES.WORKSPACE_MEMBER_REMOVED,
        resourceId: 'org_alpha',
        actorId: 'user_bob',
        timestamp: 1700000010000,
      });

      assert.notStrictEqual(joinKey, leaveKey);
      assert.ok(joinKey.includes('1700000000000'));
      assert.ok(leaveKey.includes('1700000010000'));
    });
  });

  // =========================================================================
  // Section 6: Event Coverage & Taxonomy Verification
  // =========================================================================
  describe('📦 6. Event Coverage & Taxonomy', () => {
    it('verifies category resolution for all supported activity event types', () => {
      assert.strictEqual(getActivityCategory(ACTIVITY_EVENT_TYPES.WORKSPACE_MEMBER_JOINED), ACTIVITY_CATEGORIES.WORKSPACE);
      assert.strictEqual(getActivityCategory(ACTIVITY_EVENT_TYPES.WORKSPACE_MEMBER_REMOVED), ACTIVITY_CATEGORIES.WORKSPACE);
      assert.strictEqual(getActivityCategory(ACTIVITY_EVENT_TYPES.IDEA_CREATED), ACTIVITY_CATEGORIES.IDEA);
      assert.strictEqual(getActivityCategory(ACTIVITY_EVENT_TYPES.IDEA_UPDATED), ACTIVITY_CATEGORIES.IDEA);
      assert.strictEqual(getActivityCategory(ACTIVITY_EVENT_TYPES.IDEA_SELECTED_AS_MVP), ACTIVITY_CATEGORIES.IDEA);
      assert.strictEqual(getActivityCategory(ACTIVITY_EVENT_TYPES.SUGGESTION_CREATED), ACTIVITY_CATEGORIES.SUGGESTION);
      assert.strictEqual(getActivityCategory(ACTIVITY_EVENT_TYPES.SUGGESTION_ACCEPTED), ACTIVITY_CATEGORIES.SUGGESTION);
      assert.strictEqual(getActivityCategory(ACTIVITY_EVENT_TYPES.COMMENT_CREATED), ACTIVITY_CATEGORIES.COMMENT);
      assert.strictEqual(getActivityCategory(ACTIVITY_EVENT_TYPES.QUESTION_CREATED), ACTIVITY_CATEGORIES.QUESTION);
      assert.strictEqual(getActivityCategory(ACTIVITY_EVENT_TYPES.QUESTION_ANSWERED), ACTIVITY_CATEGORIES.QUESTION);
      assert.strictEqual(getActivityCategory(ACTIVITY_EVENT_TYPES.BLUEPRINT_GENERATION_STARTED), ACTIVITY_CATEGORIES.BLUEPRINT);
      assert.strictEqual(getActivityCategory(ACTIVITY_EVENT_TYPES.BLUEPRINT_GENERATION_COMPLETED), ACTIVITY_CATEGORIES.BLUEPRINT);
      assert.strictEqual(getActivityCategory(ACTIVITY_EVENT_TYPES.BLUEPRINT_GENERATION_FAILED), ACTIVITY_CATEGORIES.BLUEPRINT);
      assert.strictEqual(getActivityCategory(ACTIVITY_EVENT_TYPES.BLUEPRINT_VERSION_APPROVED), ACTIVITY_CATEGORIES.BLUEPRINT);
      assert.strictEqual(getActivityCategory(ACTIVITY_EVENT_TYPES.CHAT_MESSAGE), ACTIVITY_CATEGORIES.CHAT);
    });

    it('creates canonical activity for blueprint generation with system actor', () => {
      const act = createCanonicalActivity({
        workspaceId: 'org_alpha',
        eventType: ACTIVITY_EVENT_TYPES.BLUEPRINT_GENERATION_COMPLETED,
        actorId: 'system',
        actorType: 'system',
        actorName: 'Convia AI System',
        resourceType: 'blueprint',
        resourceId: 'bp_version_1',
        resourceTitle: 'AI Platform MVP',
        metadata: { version: '1.0' },
      });

      assert.strictEqual(act.actorType, 'system');
      assert.strictEqual(act.actorId, 'system');
      assert.strictEqual(act.eventType, ACTIVITY_EVENT_TYPES.BLUEPRINT_GENERATION_COMPLETED);
      assert.ok(act.summary.includes('AI Blueprint generation completed'));
    });

    it('creates canonical activity for blueprint version approval with user actor', () => {
      const act = createCanonicalActivity({
        workspaceId: 'org_alpha',
        eventType: ACTIVITY_EVENT_TYPES.BLUEPRINT_VERSION_APPROVED,
        actorId: 'user_leader',
        actorType: 'user',
        actorName: 'Team Leader',
        resourceType: 'blueprint',
        resourceId: 'bp_version_1',
        resourceTitle: 'AI Platform MVP',
        metadata: { version: '1.0' },
      });

      assert.strictEqual(act.actorType, 'user');
      assert.strictEqual(act.actorId, 'user_leader');
      assert.ok(act.summary.includes('Team Leader approved & activated Blueprint v1.0'));
    });
  });

  // =========================================================================
  // Section 7: Account Deletion Cascade & Solo Workspace Cleanup
  // =========================================================================
  describe('🗑️ 7. Account Deletion Cascade & Audit History Retention', () => {
    let originalGetData;
    let mockDb;

    beforeEach(() => {
      mockDb = {
        organizations: {
          org_solo: {
            orgId: 'org_solo',
            name: 'Solo Org',
            ownerId: 'user_solo',
            memberCount: 1,
          },
          org_shared: {
            orgId: 'org_shared',
            name: 'Shared Org',
            ownerId: 'user_other',
            memberCount: 2,
          },
        },
        organization_members: {
          org_solo: {
            user_solo: { uid: 'user_solo', role: 'owner' },
          },
          org_shared: {
            user_other: { uid: 'user_other', role: 'owner' },
            user_solo: { uid: 'user_solo', role: 'member' },
          },
        },
        workspace_activity: {
          org_solo: {
            act_1: { id: 'act_1', summary: 'Solo Event' },
          },
          org_shared: {
            act_2: { id: 'act_2', summary: 'Shared Team Event' },
          },
        },
      };

      originalGetData = rtdbService.getData;
      rtdbService.getData = async (pathStr) => {
        const parts = pathStr.split('/').filter(Boolean);
        let curr = mockDb;
        for (const p of parts) {
          if (!curr || typeof curr !== 'object') return null;
          curr = curr[p];
        }
        return curr !== undefined ? curr : null;
      };
    });

    afterEach(() => {
      rtdbService.getData = originalGetData;
    });

    it('purges workspace_activity subtree when solo workspace owner deletes account', async () => {
      const plan = await accountDeletionService.buildAccountDeletionPlan('user_solo');
      assert.strictEqual(plan.isBlocked, false);
      assert.strictEqual(
        plan.rtdbUpdates['workspace_activity/org_solo'],
        null,
        'workspace_activity for solo workspace must be purged upon deletion'
      );
    });

    it('preserves workspace_activity subtree when normal member leaves shared workspace', async () => {
      const plan = await accountDeletionService.buildAccountDeletionPlan('user_solo');
      assert.strictEqual(
        plan.rtdbUpdates['workspace_activity/org_shared'],
        undefined,
        'Shared workspace activity audit history MUST NOT be deleted when a normal member leaves'
      );
    });
  });

  // =========================================================================
  // Section 8: Frontend Service Integration & Routing
  // =========================================================================
  describe('🌐 8. Client Activity Service Integration', () => {
    it('verifies frontend activityService records activity via server endpoint rather than direct RTDB write', () => {
      const feServicePath = path.resolve(__dirname, '../../../../frontend/src/services/activityService.js');
      const content = fs.readFileSync(feServicePath, 'utf8');

      assert.ok(
        content.includes('apiClient.post'),
        'frontend activityService MUST call apiClient.post to record activity'
      );
      assert.ok(
        content.includes('/api/workspace/${workspaceId}/activity'),
        'frontend activityService MUST route to /api/workspace/:workspaceId/activity'
      );
      assert.ok(
        !content.includes('rtdbService.setData(path, canonicalEvent)'),
        'frontend activityService MUST NOT perform direct rtdbService.setData writes to workspace_activity'
      );
    });

    it('verifies server join endpoint calls activityService.recordWorkspaceActivity', () => {
      const memberControllerPath = path.resolve(__dirname, '../../../../backend/src/controllers/workspaceMembershipController.js');
      const content = fs.readFileSync(memberControllerPath, 'utf8');

      assert.ok(
        content.includes('activityService.recordWorkspaceActivity(orgId,'),
        'workspaceMembershipController MUST call activityService.recordWorkspaceActivity upon join'
      );
      assert.ok(
        content.includes('ACTIVITY_EVENT_TYPES.WORKSPACE_MEMBER_JOINED'),
        'workspaceMembershipController MUST record WORKSPACE_MEMBER_JOINED event'
      );
    });
  });
});
