/**
 * CONVIA — P1-01: IDEA AUTHORIZATION / DATA-INTEGRITY HARDENING
 * Comprehensive 30-Scenario Security & Regression Test Suite.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { evaluateSecurityRule } from './databaseRulesValidation.test.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load actual database.rules.json from repository root
const rulesPath = path.resolve(__dirname, '../../../../database.rules.json');
const rawRules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));

describe('🔒 CONVIA P1-01: IDEA SECURITY HARDENING (30 SCENARIOS)', () => {
  const workspaceAlpha = 'ws_alpha';
  const workspaceBeta = 'ws_beta';
  const ownerUid = 'user_owner';
  const adminUid = 'user_admin';
  const authorBobUid = 'user_bob';
  const memberCharlieUid = 'user_charlie';
  const viewerUid = 'user_viewer';
  const nonMemberUid = 'user_stranger';

  const mockRootData = {
    organizations: {
      [workspaceAlpha]: {
        orgId: workspaceAlpha,
        ownerId: ownerUid,
        name: 'Workspace Alpha',
      },
      [workspaceBeta]: {
        orgId: workspaceBeta,
        ownerId: 'owner_beta',
        name: 'Workspace Beta',
      },
    },
    workspaces: {
      [workspaceAlpha]: {
        id: workspaceAlpha,
        ownerId: ownerUid,
      },
      [workspaceBeta]: {
        id: workspaceBeta,
        ownerId: 'owner_beta',
      },
    },
    organization_members: {
      [workspaceAlpha]: {
        [ownerUid]: { uid: ownerUid, role: 'owner' },
        [adminUid]: { uid: adminUid, role: 'admin' },
        [authorBobUid]: { uid: authorBobUid, role: 'member' },
        [memberCharlieUid]: { uid: memberCharlieUid, role: 'member' },
        [viewerUid]: { uid: viewerUid, role: 'viewer' },
      },
      [workspaceBeta]: {
        owner_beta: { uid: 'owner_beta', role: 'owner' },
        [nonMemberUid]: { uid: nonMemberUid, role: 'member' },
      },
    },
    workspace_members: {
      [workspaceAlpha]: {
        [ownerUid]: { uid: ownerUid, role: 'owner' },
        [adminUid]: { uid: adminUid, role: 'admin' },
        [authorBobUid]: { uid: authorBobUid, role: 'member' },
        [memberCharlieUid]: { uid: memberCharlieUid, role: 'member' },
        [viewerUid]: { uid: viewerUid, role: 'viewer' },
      },
    },
    ideas: {
      [workspaceAlpha]: {
        idea_bob_1: {
          ideaId: 'idea_bob_1',
          orgId: workspaceAlpha,
          authorId: authorBobUid,
          authorName: 'Bob Innovator',
          title: "Bob's Revolutionary Proposal",
          problemStatement: 'Current systems lack real-time synchronization.',
          proposedSolution: 'Build a decentralized event mesh.',
          techStack: 'Node.js, Firebase, React',
          difficultyLevel: 'Medium',
          status: 'active',
          projectStatus: 'Ideation',
          createdAt: 1740000000000,
          updatedAt: 1740000000000,
          voteCount: 5,
          commentCount: 2,
          suggestionCount: 1,
          isSelected: false,
          isDeleted: false,
        },
      },
      [workspaceBeta]: {
        idea_beta_1: {
          ideaId: 'idea_beta_1',
          orgId: workspaceBeta,
          authorId: 'owner_beta',
          authorName: 'Beta Owner',
          title: 'Beta Exclusive Project',
          createdAt: 1740000000000,
          status: 'active',
        },
      },
    },
    votes: {
      [`idea_bob_1_${memberCharlieUid}`]: {
        voteId: `idea_bob_1_${memberCharlieUid}`,
        ideaId: 'idea_bob_1',
        uid: memberCharlieUid,
        createdAt: 1740000000000,
      },
    },
  };

  const existingBobIdea = mockRootData.ideas[workspaceAlpha].idea_bob_1;

  // =========================================================================
  // GROUP 1: UNAUTHENTICATED ACCESS DEFENSE (TEST 1 - 4)
  // =========================================================================
  describe('Group 1: Unauthenticated Access Defense', () => {
    it('TEST 1: Unauthenticated user cannot read ideas', () => {
      const res = evaluateSecurityRule({
        path: `ideas/${workspaceAlpha}/idea_bob_1`,
        operation: 'read',
        auth: null,
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false);
    });

    it('TEST 2: Unauthenticated user cannot create ideas', () => {
      const res = evaluateSecurityRule({
        path: `ideas/${workspaceAlpha}/idea_new`,
        operation: 'write',
        auth: null,
        data: null,
        newData: {
          ideaId: 'idea_new',
          orgId: workspaceAlpha,
          authorId: 'anon',
          title: 'Anonymous Idea',
        },
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false);
    });

    it('TEST 3: Unauthenticated user cannot update ideas', () => {
      const res = evaluateSecurityRule({
        path: `ideas/${workspaceAlpha}/idea_bob_1`,
        operation: 'write',
        auth: null,
        data: existingBobIdea,
        newData: { ...existingBobIdea, title: 'Tampered Title' },
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false);
    });

    it('TEST 4: Unauthenticated user cannot delete ideas', () => {
      const res = evaluateSecurityRule({
        path: `ideas/${workspaceAlpha}/idea_bob_1`,
        operation: 'write',
        auth: null,
        data: existingBobIdea,
        newData: null,
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false);
    });
  });

  // =========================================================================
  // GROUP 2: AUTHENTICATED NON-MEMBER ACCESS DEFENSE (TEST 5 - 8)
  // =========================================================================
  describe('Group 2: Authenticated Non-Member Access Defense', () => {
    const nonMemberAuth = { uid: nonMemberUid };

    it('TEST 5: Authenticated non-member cannot read workspace ideas', () => {
      const res = evaluateSecurityRule({
        path: `ideas/${workspaceAlpha}/idea_bob_1`,
        operation: 'read',
        auth: nonMemberAuth,
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false);
    });

    it('TEST 6: Authenticated non-member cannot create workspace ideas', () => {
      const res = evaluateSecurityRule({
        path: `ideas/${workspaceAlpha}/idea_injected`,
        operation: 'write',
        auth: nonMemberAuth,
        data: null,
        newData: {
          ideaId: 'idea_injected',
          orgId: workspaceAlpha,
          authorId: nonMemberUid,
          title: 'Injected Stranger Idea',
        },
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false);
    });

    it('TEST 7: Authenticated non-member cannot modify workspace ideas', () => {
      const res = evaluateSecurityRule({
        path: `ideas/${workspaceAlpha}/idea_bob_1`,
        operation: 'write',
        auth: nonMemberAuth,
        data: existingBobIdea,
        newData: { ...existingBobIdea, title: 'Hacked by Stranger' },
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false);
    });

    it('TEST 8: Authenticated non-member cannot delete workspace ideas', () => {
      const res = evaluateSecurityRule({
        path: `ideas/${workspaceAlpha}/idea_bob_1`,
        operation: 'write',
        auth: nonMemberAuth,
        data: existingBobIdea,
        newData: null,
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false);
    });
  });

  // =========================================================================
  // GROUP 3: MEMBER AUTHORIZATION & AUTHOR IDENTITY INTEGRITY (TEST 9 - 18)
  // =========================================================================
  describe('Group 3: Member Authorization & Authorship Integrity', () => {
    const authorAuth = { uid: authorBobUid };
    const charlieAuth = { uid: memberCharlieUid };

    it('TEST 9: Member can create own idea', () => {
      const newIdea = {
        ideaId: 'idea_bob_new',
        orgId: workspaceAlpha,
        authorId: authorBobUid,
        title: 'New Legitimate Idea',
        createdAt: Date.now(),
      };
      const res = evaluateSecurityRule({
        path: `ideas/${workspaceAlpha}/idea_bob_new`,
        operation: 'write',
        auth: authorAuth,
        data: null,
        newData: newIdea,
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, true);
    });

    it('TEST 10: Member can update own idea if intended behavior allows it', () => {
      const updatedIdea = {
        ...existingBobIdea,
        title: 'Updated Title by Author',
        problemStatement: 'Refined problem statement.',
        updatedAt: Date.now(),
      };
      const res = evaluateSecurityRule({
        path: `ideas/${workspaceAlpha}/idea_bob_1`,
        operation: 'write',
        auth: authorAuth,
        data: existingBobIdea,
        newData: updatedIdea,
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, true);
    });

    it("TEST 11: Member cannot update another member's idea", () => {
      const maliciousUpdate = {
        ...existingBobIdea,
        title: 'Tampered Title by Charlie',
      };
      const res = evaluateSecurityRule({
        path: `ideas/${workspaceAlpha}/idea_bob_1`,
        operation: 'write',
        auth: charlieAuth,
        data: existingBobIdea,
        newData: maliciousUpdate,
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'MEMBER_CANNOT_EDIT_ANOTHER_USERS_TITLE');
    });

    it('TEST 12: Member can delete own idea if intended behavior allows it', () => {
      const res = evaluateSecurityRule({
        path: `ideas/${workspaceAlpha}/idea_bob_1`,
        operation: 'write',
        auth: authorAuth,
        data: existingBobIdea,
        newData: null,
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, true);
    });

    it("TEST 13: Member cannot delete another member's idea", () => {
      const res = evaluateSecurityRule({
        path: `ideas/${workspaceAlpha}/idea_bob_1`,
        operation: 'write',
        auth: charlieAuth,
        data: existingBobIdea,
        newData: null,
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'UNAUTHORIZED_IDEA_DELETION');
    });

    it('TEST 14: Member cannot change authorId', () => {
      const hijackedIdea = {
        ...existingBobIdea,
        authorId: memberCharlieUid, // Stealing authorship
      };
      const res = evaluateSecurityRule({
        path: `ideas/${workspaceAlpha}/idea_bob_1`,
        operation: 'write',
        auth: charlieAuth,
        data: existingBobIdea,
        newData: hijackedIdea,
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'IMMUTABLE_AUTHOR_ID');
    });

    it('TEST 15: Member cannot change createdBy', () => {
      const ideaWithCreatedBy = {
        ...existingBobIdea,
        createdBy: authorBobUid,
      };
      const forgedCreatedBy = {
        ...ideaWithCreatedBy,
        createdBy: memberCharlieUid,
      };
      const res = evaluateSecurityRule({
        path: `ideas/${workspaceAlpha}/idea_bob_1`,
        operation: 'write',
        auth: charlieAuth,
        data: ideaWithCreatedBy,
        newData: forgedCreatedBy,
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'IMMUTABLE_CREATED_BY');
    });

    it('TEST 16: Member cannot change workspaceId/orgId', () => {
      const crossOrgMove = {
        ...existingBobIdea,
        orgId: workspaceBeta, // Attempting to move idea to another workspace
      };
      const res = evaluateSecurityRule({
        path: `ideas/${workspaceAlpha}/idea_bob_1`,
        operation: 'write',
        auth: authorAuth,
        data: existingBobIdea,
        newData: crossOrgMove,
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'IMMUTABLE_ORG_ID');
    });

    it("TEST 17: Member cannot modify another user's idea through multi-location update", () => {
      const atomicUpdates = {
        [`votes/idea_bob_1_${memberCharlieUid}`]: {
          voteId: `idea_bob_1_${memberCharlieUid}`,
          ideaId: 'idea_bob_1',
          uid: memberCharlieUid,
        },
        [`ideas/${workspaceAlpha}/idea_bob_1`]: {
          ...existingBobIdea,
          title: 'Hacked via Multi-Location Update',
        },
      };

      // In RTDB atomic writes, every path must pass its respective rule
      const voteRes = evaluateSecurityRule({
        path: `votes/idea_bob_1_${memberCharlieUid}`,
        operation: 'write',
        auth: charlieAuth,
        data: null,
        newData: atomicUpdates[`votes/idea_bob_1_${memberCharlieUid}`],
        rootData: mockRootData,
      });
      const ideaRes = evaluateSecurityRule({
        path: `ideas/${workspaceAlpha}/idea_bob_1`,
        operation: 'write',
        auth: charlieAuth,
        data: existingBobIdea,
        newData: atomicUpdates[`ideas/${workspaceAlpha}/idea_bob_1`],
        rootData: mockRootData,
      });

      assert.strictEqual(voteRes.allowed, true);
      assert.strictEqual(ideaRes.allowed, false);
      // Because one path in the atomic batch fails, the entire transaction is rejected by RTDB
      const overallAllowed = voteRes.allowed && ideaRes.allowed;
      assert.strictEqual(overallAllowed, false);
    });

    it("TEST 18: Member cannot delete another user's idea through multi-location update", () => {
      const deleteIdeaRes = evaluateSecurityRule({
        path: `ideas/${workspaceAlpha}/idea_bob_1`,
        operation: 'write',
        auth: charlieAuth,
        data: existingBobIdea,
        newData: null,
        rootData: mockRootData,
      });
      assert.strictEqual(deleteIdeaRes.allowed, false);
    });
  });

  // =========================================================================
  // GROUP 4: ADMIN / OWNER MODERATION & VIEWER RESTRICTIONS (TEST 19 - 22)
  // =========================================================================
  describe('Group 4: Admin / Owner Moderation & Viewer Restrictions', () => {
    const adminAuth = { uid: adminUid };
    const ownerAuth = { uid: ownerUid };
    const viewerAuth = { uid: viewerUid };

    it('TEST 19: Admin can perform authorized moderation', () => {
      // Admin moderating status (e.g. promoting to Selected MVP)
      const moderatedIdea = {
        ...existingBobIdea,
        status: 'selected',
        projectStatus: 'Selected MVP',
        isSelected: true,
        updatedAt: Date.now(),
      };
      const updateRes = evaluateSecurityRule({
        path: `ideas/${workspaceAlpha}/idea_bob_1`,
        operation: 'write',
        auth: adminAuth,
        data: existingBobIdea,
        newData: moderatedIdea,
        rootData: mockRootData,
      });
      assert.strictEqual(updateRes.allowed, true);

      // Admin deleting an inappropriate idea
      const deleteRes = evaluateSecurityRule({
        path: `ideas/${workspaceAlpha}/idea_bob_1`,
        operation: 'write',
        auth: adminAuth,
        data: existingBobIdea,
        newData: null,
        rootData: mockRootData,
      });
      assert.strictEqual(deleteRes.allowed, true);
    });

    it('TEST 20: Owner can perform authorized moderation', () => {
      const moderatedIdea = {
        ...existingBobIdea,
        status: 'archived',
        projectStatus: 'Archived',
        updatedAt: Date.now(),
      };
      const updateRes = evaluateSecurityRule({
        path: `ideas/${workspaceAlpha}/idea_bob_1`,
        operation: 'write',
        auth: ownerAuth,
        data: existingBobIdea,
        newData: moderatedIdea,
        rootData: mockRootData,
      });
      assert.strictEqual(updateRes.allowed, true);

      // Owner can also cascade delete ideas/$orgId when deleting workspace
      const cascadeDeleteRes = evaluateSecurityRule({
        path: `ideas/${workspaceAlpha}`,
        operation: 'write',
        auth: ownerAuth,
        data: mockRootData.ideas[workspaceAlpha],
        newData: null,
        rootData: mockRootData,
      });
      assert.strictEqual(cascadeDeleteRes.allowed, true);
    });

    it('TEST 21: Viewer cannot perform unauthorized mutations', () => {
      // Viewer cannot create
      const createRes = evaluateSecurityRule({
        path: `ideas/${workspaceAlpha}/idea_viewer`,
        operation: 'write',
        auth: viewerAuth,
        data: null,
        newData: {
          ideaId: 'idea_viewer',
          orgId: workspaceAlpha,
          authorId: viewerUid,
          title: 'Viewer Proposal',
        },
        rootData: mockRootData,
      });
      assert.strictEqual(createRes.allowed, false);

      // Viewer cannot update
      const updateRes = evaluateSecurityRule({
        path: `ideas/${workspaceAlpha}/idea_bob_1`,
        operation: 'write',
        auth: viewerAuth,
        data: existingBobIdea,
        newData: { ...existingBobIdea, voteCount: 6 },
        rootData: mockRootData,
      });
      assert.strictEqual(updateRes.allowed, false);

      // Viewer cannot delete
      const deleteRes = evaluateSecurityRule({
        path: `ideas/${workspaceAlpha}/idea_bob_1`,
        operation: 'write',
        auth: viewerAuth,
        data: existingBobIdea,
        newData: null,
        rootData: mockRootData,
      });
      assert.strictEqual(deleteRes.allowed, false);
    });

    it('TEST 22: Cross-workspace manipulation is denied', () => {
      // Member of Workspace Alpha cannot modify Workspace Beta ideas
      const res = evaluateSecurityRule({
        path: `ideas/${workspaceBeta}/idea_beta_1`,
        operation: 'write',
        auth: { uid: authorBobUid },
        data: mockRootData.ideas[workspaceBeta].idea_beta_1,
        newData: { ...mockRootData.ideas[workspaceBeta].idea_beta_1, title: 'Tampered Beta Idea' },
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'NOT_ORG_MEMBER');
    });
  });

  // =========================================================================
  // GROUP 5: VOTING, COMMENTS, SUGGESTIONS & ACTIVITY (TEST 23 - 27)
  // =========================================================================
  describe('Group 5: Collaboration Workflows & Integrity', () => {
    const charlieAuth = { uid: memberCharlieUid };

    it('TEST 23: Voting still works', () => {
      // When a member votes, voteCount and updatedAt are updated while title/author remain identical
      const votedIdea = {
        ...existingBobIdea,
        voteCount: 6,
        updatedAt: Date.now(),
      };
      const res = evaluateSecurityRule({
        path: `ideas/${workspaceAlpha}/idea_bob_1`,
        operation: 'write',
        auth: charlieAuth,
        data: existingBobIdea,
        newData: votedIdea,
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, true);
    });

    it('TEST 24: Voting cannot modify protected Idea fields', () => {
      // Attacker sneaks in a title edit during vote increment
      const sneakyVote = {
        ...existingBobIdea,
        voteCount: 6,
        title: 'Hacked During Voting Operation',
        updatedAt: Date.now(),
      };
      const res = evaluateSecurityRule({
        path: `ideas/${workspaceAlpha}/idea_bob_1`,
        operation: 'write',
        auth: charlieAuth,
        data: existingBobIdea,
        newData: sneakyVote,
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'MEMBER_CANNOT_EDIT_ANOTHER_USERS_TITLE');
    });

    it('TEST 25: Comments still work', () => {
      // Recalculating commentCount and updatedAt
      const commentedIdea = {
        ...existingBobIdea,
        commentCount: 3,
        updatedAt: Date.now(),
      };
      const res = evaluateSecurityRule({
        path: `ideas/${workspaceAlpha}/idea_bob_1`,
        operation: 'write',
        auth: charlieAuth,
        data: existingBobIdea,
        newData: commentedIdea,
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, true);
    });

    it('TEST 26: Suggestions still work', () => {
      // Recalculating suggestionCount and acceptedSuggestionCount
      const suggestionUpdatedIdea = {
        ...existingBobIdea,
        suggestionCount: 2,
        acceptedSuggestionCount: 1,
        updatedAt: Date.now(),
      };
      const res = evaluateSecurityRule({
        path: `ideas/${workspaceAlpha}/idea_bob_1`,
        operation: 'write',
        auth: charlieAuth,
        data: existingBobIdea,
        newData: suggestionUpdatedIdea,
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, true);
    });

    it('TEST 27: Activity logging still works', () => {
      // Users can log activity events in user_activity or workspace activity
      const activityRes = evaluateSecurityRule({
        path: `user_activity/${authorBobUid}/act_1`,
        operation: 'write',
        auth: { uid: authorBobUid },
        data: null,
        newData: { type: 'idea.created', ideaId: 'idea_bob_1' },
        rootData: mockRootData,
      });
      assert.strictEqual(activityRes.allowed, true);
    });
  });

  // =========================================================================
  // GROUP 6: AUTHORSHIP DERIVATION & ATTRIBUTION INTEGRITY (TEST 28 - 30)
  // =========================================================================
  describe('Group 6: Authorship Derivation & Timestamp Integrity', () => {
    const charlieAuth = { uid: memberCharlieUid };

    it('TEST 28: Idea creation attribution comes from authenticated identity, not client payload', () => {
      // Legitimate creation: authorId matches authenticated caller
      const validCreation = {
        ideaId: 'idea_charlie_1',
        orgId: workspaceAlpha,
        authorId: memberCharlieUid,
        title: "Charlie's Real Proposal",
        createdAt: Date.now(),
      };
      const res = evaluateSecurityRule({
        path: `ideas/${workspaceAlpha}/idea_charlie_1`,
        operation: 'write',
        auth: charlieAuth,
        data: null,
        newData: validCreation,
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, true);
    });

    it('TEST 29: Tampered author identity is rejected', () => {
      // Charlie tries to create an idea on behalf of Bob or Victim
      const forgedCreation = {
        ideaId: 'idea_impersonated',
        orgId: workspaceAlpha,
        authorId: authorBobUid, // Forged!
        title: 'Impersonating Bob',
        createdAt: Date.now(),
      };
      const res = evaluateSecurityRule({
        path: `ideas/${workspaceAlpha}/idea_impersonated`,
        operation: 'write',
        auth: charlieAuth,
        data: null,
        newData: forgedCreation,
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'FORGED_AUTHOR_OR_ORG');
    });

    it('TEST 30: Tampered timestamps/ownership metadata are rejected where applicable', () => {
      // Attempting to alter createdAt after idea creation
      const alteredTimestamp = {
        ...existingBobIdea,
        createdAt: 1000000, // Forged original creation time
      };
      const res = evaluateSecurityRule({
        path: `ideas/${workspaceAlpha}/idea_bob_1`,
        operation: 'write',
        auth: { uid: authorBobUid },
        data: existingBobIdea,
        newData: alteredTimestamp,
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'IMMUTABLE_CREATED_AT');
    });
  });

  // =========================================================================
  // GROUP 7: DIRECT database.rules.json REPO FILE AUDIT
  // =========================================================================
  describe('Group 7: Direct database.rules.json Repo File Audit', () => {
    it('verifies ideas rules in database.rules.json contain no blanket member write access', () => {
      const ideasRules = rawRules.rules.ideas;
      assert.ok(ideasRules, 'rules.ideas must exist');
      assert.ok(ideasRules.$orgId, 'rules.ideas.$orgId must exist');
      assert.ok(ideasRules.$orgId.$ideaId, 'rules.ideas.$orgId.$ideaId must exist');

      const ideaIdWrite = ideasRules.$orgId.$ideaId['.write'];
      const ideaIdValidate = ideasRules.$orgId.$ideaId['.validate'];

      // Must explicitly check for authorId matching auth.uid on create
      assert.ok(ideaIdWrite.includes("newData.child('authorId').val() === auth.uid"), 'Must enforce authorId on creation in .write');

      // Must restrict deletion to author or admin/owner
      assert.ok(ideaIdWrite.includes("!newData.exists()"), 'Must handle deletion explicitly in .write');
      assert.ok(ideaIdWrite.includes("data.child('authorId').val() === auth.uid"), 'Must grant deletion to author');

      // Must enforce viewer restrictions
      assert.ok(ideaIdWrite.includes("!== 'viewer'"), 'Must exclude viewers in .write');

      // Must enforce immutability of authorId in .validate
      assert.ok(ideaIdValidate.includes("newData.child('authorId').val() === data.child('authorId').val()"), 'Must enforce immutable authorId');

      // Must protect content fields from non-author members
      assert.ok(ideaIdValidate.includes("newData.child('title').val() === data.child('title').val()"), 'Must protect title from non-author members');
      assert.ok(ideaIdValidate.includes("newData.child('problemStatement').val() === data.child('problemStatement').val()"), 'Must protect problemStatement from non-author members');
    });

    it('verifies ideas.$orgId allows owner cascade delete and blocks direct writes', () => {
      const orgWrite = rawRules.rules.ideas.$orgId['.write'];
      assert.ok(orgWrite.includes('!newData.exists()'), 'org-level write must be delete-only');
      assert.ok(orgWrite.includes('ownerId'), 'org-level write must require workspace owner');
    });
  });
});
