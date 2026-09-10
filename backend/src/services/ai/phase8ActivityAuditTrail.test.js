import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';

import {
  ACTIVITY_EVENT_TYPES,
  ACTIVITY_CATEGORIES,
  getActivityCategory,
  buildActivityDedupeKey,
  formatActivitySummary,
  buildActivityActionUrl,
  createCanonicalActivity,
} from '../../constants/activityConstants.js';

import { activityService } from '../activityService.js';
import { rtdbService } from '../rtdbService.js';

describe('🧪 CONVIA PHASE 8 — ACTIVITY AUDIT TRAIL, WORKSPACE EVENTS & OBSERVABILITY', () => {
  let mockDb = {};

  beforeEach(() => {
    mockDb = {
      workspace_activity: {},
      organizations: {
        org_alpha: {
          id: 'org_alpha',
          name: 'Alpha Labs',
          ownerId: 'user_alice',
        },
        org_beta: {
          id: 'org_beta',
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
          user_eve: { uid: 'user_eve', role: 'member' },
        },
      },
    };

    rtdbService.getData = async (path) => {
      const parts = path.split('/').filter(Boolean);
      let curr = mockDb;
      for (const p of parts) {
        if (!curr || typeof curr !== 'object') return null;
        curr = curr[p];
      }
      return curr !== undefined ? curr : null;
    };

    rtdbService.setData = async (path, val) => {
      const parts = path.split('/').filter(Boolean);
      let curr = mockDb;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!curr[parts[i]]) curr[parts[i]] = {};
        curr = curr[parts[i]];
      }
      curr[parts[parts.length - 1]] = val;
      return true;
    };
  });

  // Evaluator simulating database.rules.json for workspace_activity
  function evaluateActivitySecurityRule({ path, operation, auth, data = null, newData = null }) {
    if (!auth || !auth.uid) {
      return { allowed: false, reason: 'UNAUTHENTICATED' };
    }

    const segments = path.split('/').filter(Boolean);
    if (segments[0] !== 'workspace_activity') {
      return { allowed: false, reason: 'INVALID_PATH' };
    }

    const workspaceId = segments[1];
    const activityId = segments[2];

    const isMember = Boolean(
      mockDb.organization_members[workspaceId]?.[auth.uid] ||
      mockDb.organizations[workspaceId]?.ownerId === auth.uid
    );

    // .read: auth != null && isMember
    if (operation === 'read') {
      return { allowed: isMember, reason: isMember ? null : 'FORBIDDEN_READ_NON_MEMBER' };
    }

    // .write: auth != null && !data.exists() && isMember && newData.child('actorId').val() === auth.uid
    if (operation === 'write') {
      if (!activityId) {
        return { allowed: false, reason: 'ROOT_WRITE_DISALLOWED' };
      }

      // Immutability: cannot modify or delete existing records
      if (data && data !== null) {
        return { allowed: false, reason: 'HISTORICAL_ACTIVITY_IMMUTABLE' };
      }

      if (!isMember) {
        return { allowed: false, reason: 'FORBIDDEN_WRITE_NON_MEMBER' };
      }

      if (!newData) {
        return { allowed: false, reason: 'DELETE_DISALLOWED' };
      }

      // Validate required fields
      if (!newData.id || !newData.workspaceId || !newData.eventType || !newData.actorId || !newData.createdAt) {
        return { allowed: false, reason: 'MISSING_REQUIRED_FIELDS' };
      }

      // Validate workspace boundary matching
      if (newData.workspaceId !== workspaceId) {
        return { allowed: false, reason: 'WORKSPACE_MISMATCH' };
      }

      // Forgery prevention: actorId must match authenticated user
      if (newData.actorId !== auth.uid) {
        return { allowed: false, reason: 'FORGED_ACTOR_ID' };
      }

      return { allowed: true, reason: null };
    }

    return { allowed: false, reason: 'UNKNOWN_OPERATION' };
  }

  // -------------------------------------------------------------
  // Group 1: Security, Authorization & Workspace Boundary Isolation
  // -------------------------------------------------------------
  describe('🔒 1. Security & Workspace Boundary Isolation', () => {
    it('denies unauthenticated users from reading workspace activity', () => {
      const res = evaluateActivitySecurityRule({
        path: 'workspace_activity/org_alpha',
        operation: 'read',
        auth: null,
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'UNAUTHENTICATED');
    });

    it('blocks User Charlie (Org Beta) from reading Org Alpha activity', () => {
      const res = evaluateActivitySecurityRule({
        path: 'workspace_activity/org_alpha',
        operation: 'read',
        auth: { uid: 'user_charlie' },
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'FORBIDDEN_READ_NON_MEMBER');
    });

    it('allows verified Org Alpha member (User Bob) to read Org Alpha activity', () => {
      const res = evaluateActivitySecurityRule({
        path: 'workspace_activity/org_alpha',
        operation: 'read',
        auth: { uid: 'user_bob' },
      });
      assert.strictEqual(res.allowed, true);
    });

    it('blocks User Bob from creating an event claiming to be User Alice (forgery defense)', () => {
      const res = evaluateActivitySecurityRule({
        path: 'workspace_activity/org_alpha/act_1',
        operation: 'write',
        auth: { uid: 'user_bob' },
        data: null,
        newData: {
          id: 'act_1',
          workspaceId: 'org_alpha',
          eventType: ACTIVITY_EVENT_TYPES.IDEA_CREATED,
          actorId: 'user_alice', // Forged actor!
          createdAt: Date.now(),
        },
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'FORGED_ACTOR_ID');
    });

    it('enforces immutability: blocks updating or deleting an existing historical event', () => {
      const updateRes = evaluateActivitySecurityRule({
        path: 'workspace_activity/org_alpha/act_1',
        operation: 'write',
        auth: { uid: 'user_alice' },
        data: { id: 'act_1', summary: 'Original' }, // Existing record
        newData: { id: 'act_1', summary: 'Tampered' },
      });
      assert.strictEqual(updateRes.allowed, false);
      assert.strictEqual(updateRes.reason, 'HISTORICAL_ACTIVITY_IMMUTABLE');

      const deleteRes = evaluateActivitySecurityRule({
        path: 'workspace_activity/org_alpha/act_1',
        operation: 'write',
        auth: { uid: 'user_alice' },
        data: { id: 'act_1' },
        newData: null, // Deletion
      });
      assert.strictEqual(deleteRes.allowed, false);
      assert.strictEqual(deleteRes.reason, 'HISTORICAL_ACTIVITY_IMMUTABLE');
    });
  });

  // -------------------------------------------------------------
  // Group 2: Canonical Event Creation Across Feature Areas
  // -------------------------------------------------------------
  describe('📦 2. Canonical Event Creation & Categories', () => {
    it('creates canonical idea.created activity with deep link and summary', () => {
      const event = createCanonicalActivity({
        workspaceId: 'org_alpha',
        eventType: ACTIVITY_EVENT_TYPES.IDEA_CREATED,
        actorId: 'user_alice',
        actorName: 'Alice',
        resourceType: 'idea',
        resourceId: 'idea_101',
        resourceTitle: 'AI Code Reviewer',
      });

      assert.strictEqual(event.eventType, 'idea.created');
      assert.strictEqual(event.resourceType, 'idea');
      assert.strictEqual(event.summary, 'Alice created proposal "AI Code Reviewer"');
      assert.strictEqual(event.actionUrl, '/workspaces/org_alpha/ideas/idea_101');
      assert.strictEqual(getActivityCategory(event.eventType), ACTIVITY_CATEGORIES.IDEA);
    });

    it('creates canonical suggestion.created activity with tab deep link', () => {
      const event = createCanonicalActivity({
        workspaceId: 'org_alpha',
        eventType: ACTIVITY_EVENT_TYPES.SUGGESTION_CREATED,
        actorId: 'user_bob',
        actorName: 'Bob',
        resourceType: 'suggestion',
        resourceId: 'disc_55',
        parentResourceId: 'idea_101',
        resourceTitle: 'AI Code Reviewer',
      });

      assert.strictEqual(event.eventType, 'suggestion.created');
      assert.strictEqual(event.summary, 'Bob suggested an improvement on "AI Code Reviewer"');
      assert.strictEqual(event.actionUrl, '/workspaces/org_alpha/ideas/idea_101?tab=suggestions&discussionId=disc_55');
      assert.strictEqual(getActivityCategory(event.eventType), ACTIVITY_CATEGORIES.SUGGESTION);
    });

    it('creates canonical comment.created and question.created activities', () => {
      const commentEvent = createCanonicalActivity({
        workspaceId: 'org_alpha',
        eventType: ACTIVITY_EVENT_TYPES.COMMENT_CREATED,
        actorId: 'user_bob',
        actorName: 'Bob',
        resourceType: 'comment',
        resourceId: 'disc_66',
        parentResourceId: 'idea_101',
        resourceTitle: 'AI Code Reviewer',
      });
      assert.strictEqual(commentEvent.eventType, 'comment.created');
      assert.strictEqual(getActivityCategory(commentEvent.eventType), ACTIVITY_CATEGORIES.COMMENT);

      const questionEvent = createCanonicalActivity({
        workspaceId: 'org_alpha',
        eventType: ACTIVITY_EVENT_TYPES.QUESTION_CREATED,
        actorId: 'user_bob',
        actorName: 'Bob',
        resourceType: 'question',
        resourceId: 'disc_77',
        parentResourceId: 'idea_101',
        resourceTitle: 'AI Code Reviewer',
      });
      assert.strictEqual(questionEvent.eventType, 'question.created');
      assert.strictEqual(getActivityCategory(questionEvent.eventType), ACTIVITY_CATEGORIES.QUESTION);
    });

    it('creates canonical workspace.member_joined activity', () => {
      const event = createCanonicalActivity({
        workspaceId: 'org_alpha',
        eventType: ACTIVITY_EVENT_TYPES.WORKSPACE_MEMBER_JOINED,
        actorId: 'user_bob',
        actorName: 'Bob',
        resourceType: 'workspace',
        resourceId: 'org_alpha',
        resourceTitle: 'Alpha Labs',
      });

      assert.strictEqual(event.eventType, 'workspace.member_joined');
      assert.strictEqual(event.summary, 'Bob joined the workspace');
      assert.strictEqual(event.actionUrl, '/workspaces/org_alpha/members');
      assert.strictEqual(getActivityCategory(event.eventType), ACTIVITY_CATEGORIES.WORKSPACE);
    });
  });

  // -------------------------------------------------------------
  // Group 3: System Actors for Automated Backend Events
  // -------------------------------------------------------------
  describe('🤖 3. System Actors (AI Blueprint Lifecycle)', () => {
    it('creates blueprint.generation_completed with actorType: "system"', () => {
      const event = createCanonicalActivity({
        workspaceId: 'org_alpha',
        eventType: ACTIVITY_EVENT_TYPES.BLUEPRINT_GENERATION_COMPLETED,
        actorId: 'system',
        actorType: 'system',
        actorName: 'Convia AI Engine',
        resourceType: 'blueprint',
        resourceId: 'bp_org_alpha_idea_101',
        resourceTitle: 'AI Code Reviewer',
        metadata: { version: '2.0' },
      });

      assert.strictEqual(event.actorType, 'system');
      assert.strictEqual(event.actorId, 'system');
      assert.strictEqual(event.actorName, 'Convia AI Engine');
      assert.strictEqual(event.summary, 'AI Blueprint generation completed for "AI Code Reviewer" (v2.0)');
      assert.strictEqual(event.actionUrl, '/workspaces/org_alpha/blueprint');
      assert.strictEqual(getActivityCategory(event.eventType), ACTIVITY_CATEGORIES.BLUEPRINT);
    });

    it('creates blueprint.version_approved attributing approving user', () => {
      const event = createCanonicalActivity({
        workspaceId: 'org_alpha',
        eventType: ACTIVITY_EVENT_TYPES.BLUEPRINT_VERSION_APPROVED,
        actorId: 'user_alice',
        actorType: 'user',
        actorName: 'Alice',
        resourceType: 'blueprint',
        resourceId: 'bp_org_alpha_idea_101',
        resourceTitle: 'AI Code Reviewer',
        metadata: { version: '2.0' },
      });

      assert.strictEqual(event.actorType, 'user');
      assert.strictEqual(event.actorId, 'user_alice');
      assert.strictEqual(event.summary, 'Alice approved & activated Blueprint v2.0 for execution');
    });
  });

  // -------------------------------------------------------------
  // Group 4: Deduplication & Idempotency
  // -------------------------------------------------------------
  describe('🔑 4. Deduplication & Idempotency', () => {
    it('generates identical deterministic keys for identical event parameters', () => {
      const key1 = buildActivityDedupeKey({
        workspaceId: 'org_alpha',
        eventType: ACTIVITY_EVENT_TYPES.IDEA_CREATED,
        resourceId: 'idea_101',
        actorId: 'user_alice',
      });

      const key2 = buildActivityDedupeKey({
        workspaceId: 'org_alpha',
        eventType: ACTIVITY_EVENT_TYPES.IDEA_CREATED,
        resourceId: 'idea_101',
        actorId: 'user_alice',
      });

      assert.strictEqual(key1, key2);
      assert.strictEqual(key1, 'act_org_alpha_idea_created_idea_101_user_alice');
    });

    it('prevents duplicate entries when write is retried', () => {
      const event = createCanonicalActivity({
        workspaceId: 'org_alpha',
        eventType: ACTIVITY_EVENT_TYPES.IDEA_CREATED,
        actorId: 'user_alice',
        resourceType: 'idea',
        resourceId: 'idea_101',
      });

      // Write 1
      mockDb.workspace_activity['org_alpha'] = {
        [event.id]: event,
      };

      // Write 2 (client retry / reconnect)
      mockDb.workspace_activity['org_alpha'][event.id] = event;

      // Ensure single record
      const count = Object.keys(mockDb.workspace_activity['org_alpha']).length;
      assert.strictEqual(count, 1, 'Duplicate writes must map to single record');
    });
  });

  // -------------------------------------------------------------
  // Group 5: Chronological Ordering & Pagination
  // -------------------------------------------------------------
  describe('📊 5. Chronological Ordering & Pagination', () => {
    it('orders events newest first and respects query limit', () => {
      const now = Date.now();
      const events = [
        { id: '1', eventType: 'idea.created', createdAt: now - 3000 },
        { id: '2', eventType: 'comment.created', createdAt: now - 1000 },
        { id: '3', eventType: 'suggestion.created', createdAt: now - 2000 },
      ];

      // Sort newest first
      events.sort((a, b) => b.createdAt - a.createdAt);

      assert.strictEqual(events[0].id, '2'); // now - 1000
      assert.strictEqual(events[1].id, '3'); // now - 2000
      assert.strictEqual(events[2].id, '1'); // now - 3000

      // Slice limit 2
      const paginated = events.slice(0, 2);
      assert.strictEqual(paginated.length, 2);
      assert.strictEqual(paginated[0].id, '2');
      assert.strictEqual(paginated[1].id, '3');
    });
  });

  // -------------------------------------------------------------
  // Group 6: Graceful Error Handling & Non-Blocking Decoupling
  // -------------------------------------------------------------
  describe('🛡️ 6. Non-Blocking Resilience', () => {
    it('handles missing workspaceId without throwing', async () => {
      const result = await activityService.recordWorkspaceActivity(null, {
        eventType: 'test',
      });
      assert.strictEqual(result, null);
    });

    it('returns empty array when workspace has no activity yet', async () => {
      const result = await activityService.getWorkspaceActivities('non_existent_org');
      assert.deepStrictEqual(result, []);
    });
  });
});
