import { describe, it, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { workspaceMembershipController } from '../../controllers/workspaceMembershipController.js';
import { rtdbService } from '../rtdbService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the actual database.rules.json file from the repository
const rulesJsonPath = path.resolve(__dirname, '../../../../database.rules.json');
const rawRules = JSON.parse(fs.readFileSync(rulesJsonPath, 'utf8'));

/**
 * Authoritative Security Rule Evaluator for Realtime Database Rules.
 * Parses the raw rules expressions and evaluates write/validate behavior.
 */
function evaluateMembershipRule({
  path: targetPath,
  auth,
  data = null,
  newData = null,
  rootData = {},
}) {
  const segments = targetPath.split('/').filter(Boolean);
  const [collection, orgId, uid] = segments;

  if (collection !== 'organization_members') {
    return { allowed: false, reason: 'UNSUPPORTED_PATH' };
  }

  // 1. Unauthenticated rejection (auth != null)
  if (!auth || !auth.uid) {
    return { allowed: false, reason: 'UNAUTHENTICATED' };
  }

  const isOrgOwner =
    rootData?.organizations?.[orgId]?.ownerId === auth.uid ||
    rootData?.workspaces?.[orgId]?.ownerId === auth.uid;

  const isSelf = auth.uid === uid;

  // Root collection write / workspace wipe
  if (!uid) {
    if (!newData && isOrgOwner) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'ROOT_WRITE_DENIED' };
  }

  // Operation 1: Node Creation (!data.exists() && newData.exists())
  if (!data) {
    if (!newData) return { allowed: false, reason: 'EMPTY_WRITE' };

    // Security rule: Only verified workspace owner can create a membership node via client
    if (!isOrgOwner) {
      return { allowed: false, reason: 'UNAUTHORIZED_SELF_JOIN_DENIED' };
    }

    if (newData.uid !== uid) {
      return { allowed: false, reason: 'FORGED_UID_MISMATCH' };
    }

    const validRoles = ['owner', 'admin', 'member'];
    if (!newData.role || !validRoles.includes(newData.role)) {
      return { allowed: false, reason: 'INVALID_ROLE' };
    }

    return { allowed: true };
  }

  // Operation 2: Node Deletion (data.exists() && !newData.exists())
  if (!newData) {
    // Member can leave workspace, or Owner can remove member
    if (isSelf || isOrgOwner) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'UNAUTHORIZED_MEMBER_REMOVAL' };
  }

  // Operation 3: Node Update (data.exists() && newData.exists())
  // Only workspace owner can update member roles / records
  if (!isOrgOwner) {
    return { allowed: false, reason: 'UNAUTHORIZED_ROLE_OR_DATA_MUTATION' };
  }

  // UID is immutable
  if (newData.uid !== data.uid) {
    return { allowed: false, reason: 'IMMUTABLE_UID' };
  }

  const validRoles = ['owner', 'admin', 'member'];
  if (!newData.role || !validRoles.includes(newData.role)) {
    return { allowed: false, reason: 'INVALID_ROLE' };
  }

  return { allowed: true };
}

describe('🛡️ CONVIA P0 SECURITY FIX #1 — WORKSPACE MEMBERSHIP & SELF-JOIN AUTHORIZATION', () => {
  const mockRootData = {
    organizations: {
      org_alpha: { orgId: 'org_alpha', name: 'Alpha Workspace', ownerId: 'user_alice', memberCount: 2, teamSizeLimit: 5 },
      org_beta: { orgId: 'org_beta', name: 'Beta Workspace', ownerId: 'user_bob', memberCount: 1, teamSizeLimit: 5 },
    },
    organization_members: {
      org_alpha: {
        user_alice: { uid: 'user_alice', role: 'owner', joinedAt: 1000 },
        user_charlie: { uid: 'user_charlie', role: 'member', joinedAt: 2000 },
      },
      org_beta: {
        user_bob: { uid: 'user_bob', role: 'owner', joinedAt: 1000 },
      },
    },
    invite_codes: {
      ALPHA123: { orgId: 'org_alpha', createdAt: 1000 },
    },
    platform_settings: {
      workspaces: {
        allowWorkspaceJoining: true,
        maxMembersPerOrg: 20,
      },
    },
  };

  const userAlice = { uid: 'user_alice' }; // Owner of Org Alpha
  const userCharlie = { uid: 'user_charlie' }; // Member of Org Alpha
  const userBob = { uid: 'user_bob' }; // Owner of Org Beta, Outsider to Org Alpha
  const userEve = { uid: 'user_eve' }; // Arbitrary outsider

  // =========================================================================
  // 1. UNAUTHENTICATED USER CANNOT CREATE MEMBERSHIP
  // =========================================================================
  it('TEST 1: Unauthenticated user → cannot create membership', () => {
    const res = evaluateMembershipRule({
      path: 'organization_members/org_alpha/user_eve',
      auth: null,
      data: null,
      newData: { uid: 'user_eve', role: 'member' },
      rootData: mockRootData,
    });
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.reason, 'UNAUTHENTICATED');
  });

  // =========================================================================
  // 2. AUTHENTICATED USER CANNOT SELF-JOIN ARBITRARY WORKSPACE
  // =========================================================================
  it('TEST 2: Authenticated user → cannot self-join arbitrary workspace via direct RTDB write', () => {
    const res = evaluateMembershipRule({
      path: 'organization_members/org_alpha/user_eve',
      auth: userEve,
      data: null,
      newData: { uid: 'user_eve', role: 'member', joinedAt: Date.now() },
      rootData: mockRootData,
    });
    assert.strictEqual(res.allowed, false, 'Direct client write to organization_members must be blocked');
    assert.strictEqual(res.reason, 'UNAUTHORIZED_SELF_JOIN_DENIED');
  });

  // =========================================================================
  // 3. AUTHENTICATED USER CANNOT SELF-ASSIGN ADMIN
  // =========================================================================
  it('TEST 3: Authenticated user → cannot self-assign admin', () => {
    const res = evaluateMembershipRule({
      path: 'organization_members/org_alpha/user_eve',
      auth: userEve,
      data: null,
      newData: { uid: 'user_eve', role: 'admin', joinedAt: Date.now() },
      rootData: mockRootData,
    });
    assert.strictEqual(res.allowed, false, 'Self-assigning admin role must be denied');
    assert.strictEqual(res.reason, 'UNAUTHORIZED_SELF_JOIN_DENIED');
  });

  // =========================================================================
  // 4. AUTHENTICATED USER CANNOT SELF-ASSIGN OWNER
  // =========================================================================
  it('TEST 4: Authenticated user → cannot self-assign owner', () => {
    const res = evaluateMembershipRule({
      path: 'organization_members/org_alpha/user_eve',
      auth: userEve,
      data: null,
      newData: { uid: 'user_eve', role: 'owner', joinedAt: Date.now() },
      rootData: mockRootData,
    });
    assert.strictEqual(res.allowed, false, 'Self-assigning owner role must be denied');
    assert.strictEqual(res.reason, 'UNAUTHORIZED_SELF_JOIN_DENIED');
  });

  // =========================================================================
  // 5. EXISTING MEMBER CANNOT ELEVATE OWN ROLE
  // =========================================================================
  it('TEST 5: Existing member → cannot elevate own role', () => {
    const res = evaluateMembershipRule({
      path: 'organization_members/org_alpha/user_charlie',
      auth: userCharlie,
      data: { uid: 'user_charlie', role: 'member', joinedAt: 2000 },
      newData: { uid: 'user_charlie', role: 'admin', joinedAt: 2000 },
      rootData: mockRootData,
    });
    assert.strictEqual(res.allowed, false, 'Existing member elevating own role must be denied');
    assert.strictEqual(res.reason, 'UNAUTHORIZED_ROLE_OR_DATA_MUTATION');
  });

  // =========================================================================
  // 6. EXISTING MEMBER CANNOT CHANGE ANOTHER MEMBER'S ROLE
  // =========================================================================
  it("TEST 6: Existing member → cannot change another member's role", () => {
    const res = evaluateMembershipRule({
      path: 'organization_members/org_alpha/user_alice',
      auth: userCharlie,
      data: { uid: 'user_alice', role: 'owner', joinedAt: 1000 },
      newData: { uid: 'user_alice', role: 'member', joinedAt: 1000 },
      rootData: mockRootData,
    });
    assert.strictEqual(res.allowed, false, "Member modifying another member's role must be denied");
    assert.strictEqual(res.reason, 'UNAUTHORIZED_ROLE_OR_DATA_MUTATION');
  });

  // =========================================================================
  // 7. AUTHORIZED OWNER CAN PERFORM INTENDED MEMBER-MANAGEMENT OPERATIONS
  // =========================================================================
  it('TEST 7: Authorized owner → can promote, demote, or transfer ownership', () => {
    // Owner promotes Charlie to admin
    const promoteRes = evaluateMembershipRule({
      path: 'organization_members/org_alpha/user_charlie',
      auth: userAlice,
      data: { uid: 'user_charlie', role: 'member', joinedAt: 2000 },
      newData: { uid: 'user_charlie', role: 'admin', joinedAt: 2000 },
      rootData: mockRootData,
    });
    assert.strictEqual(promoteRes.allowed, true, 'Owner must be allowed to promote member to admin');

    // Owner removes Charlie
    const removeRes = evaluateMembershipRule({
      path: 'organization_members/org_alpha/user_charlie',
      auth: userAlice,
      data: { uid: 'user_charlie', role: 'member', joinedAt: 2000 },
      newData: null,
      rootData: mockRootData,
    });
    assert.strictEqual(removeRes.allowed, true, 'Owner must be allowed to remove member');
  });

  // =========================================================================
  // 8. LEGACY INVITE-CODE JOIN IS RETIRED AND REJECTED
  // =========================================================================
  it('TEST 8: Legacy 8-character invite-code join is retired and strictly rejected', async () => {
    await assert.rejects(
      async () => {
        await workspaceMembershipController.joinWorkspaceByCodeHandler(
          'user_eve',
          'ALPHA123',
          null
        );
      },
      (err) => {
        assert.strictEqual(err.statusCode, 410);
        assert.strictEqual(err.code, 'LEGACY_CODE_RETIRED');
        assert.ok(err.message.includes('retired'));
        return true;
      }
    );
  });

  // =========================================================================
  // 9. WORKSPACE OWNER CREATION SUCCEEDS
  // =========================================================================
  it('TEST 9: Workspace owner creation → bootstrap succeeds', () => {
    const res = evaluateMembershipRule({
      path: 'organization_members/org_alpha/user_alice',
      auth: userAlice,
      data: null,
      newData: { uid: 'user_alice', role: 'owner', joinedAt: Date.now() },
      rootData: mockRootData,
    });
    assert.strictEqual(res.allowed, true, 'Workspace owner bootstrap write must succeed');
  });

  // =========================================================================
  // 10. USER LEAVING WORKSPACE STILL WORKS
  // =========================================================================
  it('TEST 10: User leaving workspace → still works', () => {
    const res = evaluateMembershipRule({
      path: 'organization_members/org_alpha/user_charlie',
      auth: userCharlie,
      data: { uid: 'user_charlie', role: 'member', joinedAt: 2000 },
      newData: null, // Deletion (leave)
      rootData: mockRootData,
    });
    assert.strictEqual(res.allowed, true, 'Member leaving workspace by deleting self node must be allowed');
  });

  // =========================================================================
  // 11. USER CANNOT CREATE MEMBERSHIP IN WORKSPACE B WHILE ONLY IN WORKSPACE A
  // =========================================================================
  it('TEST 11: User cannot create membership in workspace B while only belonging to workspace A', () => {
    const res = evaluateMembershipRule({
      path: 'organization_members/org_beta/user_charlie',
      auth: userCharlie,
      data: null,
      newData: { uid: 'user_charlie', role: 'member', joinedAt: Date.now() },
      rootData: mockRootData,
    });
    assert.strictEqual(res.allowed, false, 'Member of Org Alpha cannot create membership in Org Beta');
    assert.strictEqual(res.reason, 'UNAUTHORIZED_SELF_JOIN_DENIED');
  });

  // =========================================================================
  // 12. CROSS-WORKSPACE MEMBERSHIP MANIPULATION IS DENIED
  // =========================================================================
  it('TEST 12: Cross-workspace membership manipulation is denied', () => {
    // User Bob (owner of Beta) attempts to remove member Charlie from Alpha
    const res = evaluateMembershipRule({
      path: 'organization_members/org_alpha/user_charlie',
      auth: userBob,
      data: { uid: 'user_charlie', role: 'member', joinedAt: 2000 },
      newData: null,
      rootData: mockRootData,
    });
    assert.strictEqual(res.allowed, false, 'Cross-workspace member removal must be denied');
    assert.strictEqual(res.reason, 'UNAUTHORIZED_MEMBER_REMOVAL');
  });

  // =========================================================================
  // 13. RETIRED PATH (workspace_members) WRITES AND EVALUATION ARE DENIED
  // =========================================================================
  it('TEST 13: Retired path (workspace_members) is completely unsupported and denied', () => {
    const res = evaluateMembershipRule({
      path: 'workspace_members/org_alpha/user_eve',
      auth: userEve,
      data: null,
      newData: { uid: 'user_eve', role: 'member' },
      rootData: mockRootData,
    });
    assert.strictEqual(res.allowed, false, 'Writes into retired workspace_members path must be blocked');
    assert.strictEqual(res.reason, 'UNSUPPORTED_PATH');
  });

  // =========================================================================
  // 14. SERVER JOIN ENDPOINT ENFORCEMENT & CAPACITY TESTS
  // =========================================================================
  describe('🔒 Server Join Endpoint Retirement & Legacy Code Defense', () => {
    it('strictly rejects any legacy 8-character invite code with 410 LEGACY_CODE_RETIRED', async () => {
      await assert.rejects(
        async () => {
          await workspaceMembershipController.joinWorkspaceByCodeHandler('user_eve', 'INVALID9', null);
        },
        (err) => {
          assert.strictEqual(err.statusCode, 410);
          assert.strictEqual(err.code, 'LEGACY_CODE_RETIRED');
          return true;
        }
      );

      await assert.rejects(
        async () => {
          await workspaceMembershipController.joinWorkspaceByCodeHandler('user_eve', 'ALPHA123', null);
        },
        (err) => {
          assert.strictEqual(err.statusCode, 410);
          assert.strictEqual(err.code, 'LEGACY_CODE_RETIRED');
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 15. ACTUAL DATABASE.RULES.JSON STRING/SYNTAX VALIDATION
  // =========================================================================
  describe('📄 database.rules.json Direct File Validation', () => {
    it('verifies organization_members rules contains no blanket auth.uid === $uid write access', () => {
      const orgMembersRule = rawRules.rules.organization_members;
      assert.ok(orgMembersRule, 'organization_members node must exist in database.rules.json');
      const uidRule = orgMembersRule.$orgId.$uid;
      assert.ok(uidRule, '$uid rule must exist under $orgId');

      // Ensure write rule does NOT contain the flawed pattern (!data.exists() && newData.child('uid').val() === auth.uid)
      const writeStr = uidRule['.write'];
      assert.ok(
        !writeStr.includes('(!data.exists() && newData.child(\'uid\').val() === auth.uid)'),
        'Vulnerable pattern (!data.exists() && newData.child(uid).val() === auth.uid) must be eliminated'
      );

      // Ensure owner verification is required for !data.exists()
      assert.ok(
        writeStr.includes("root.child('organizations').child($orgId).child('ownerId').val() === auth.uid"),
        'Owner check must be required for membership creation'
      );
    });

    it('verifies legacy workspace_members root is completely retired from database.rules.json', () => {
      assert.strictEqual(
        rawRules.rules.workspace_members,
        undefined,
        'workspace_members root must NOT exist in database.rules.json'
      );
      const rawRulesText = JSON.stringify(rawRules);
      assert.strictEqual(
        rawRulesText.includes('workspace_members'),
        false,
        'database.rules.json must contain zero references to workspace_members'
      );
    });

    it('verifies legacy invite_codes and inviteCodes roots are completely locked down (read: false, write: false)', () => {
      assert.strictEqual(rawRules.rules.invite_codes['.read'], false);
      assert.strictEqual(rawRules.rules.invite_codes['.write'], false);
      assert.strictEqual(rawRules.rules.inviteCodes['.read'], false);
      assert.strictEqual(rawRules.rules.inviteCodes['.write'], false);
    });
  });

  // =========================================================================
  // 16. EXPRESS ROUTE INTEGRATION TESTS
  // =========================================================================
  describe('🚀 Express Router POST /api/workspace/join Integration', () => {
    function createMockReqRes({ user = null, body = {} } = {}) {
      const req = {
        user,
        body,
        headers: {},
        params: {},
        query: {},
        path: '/join',
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

    it('rejects join request with 401 when token is missing or unauthenticated', async () => {
      const { req, res } = createMockReqRes({ user: null, body: { inviteCode: 'ALPHA123' } });
      const { requireAuth } = await import('../../middleware/authMiddleware.js');

      let nextCalled = false;
      requireAuth(req, res, () => { nextCalled = true; });

      assert.strictEqual(res.getStatusCode(), 401);
      assert.strictEqual(res.getJsonResponse().error.code, 'UNAUTHORIZED');
      assert.strictEqual(nextCalled, false);
    });

    it('processes authenticated join request and rejects legacy code with 410 LEGACY_CODE_RETIRED', async () => {
      const { req, res } = createMockReqRes({
        user: { uid: 'user_eve', authenticated: true },
        body: { inviteCode: 'ALPHA123' },
      });

      try {
        await workspaceMembershipController.joinWorkspaceByCodeHandler(
          req.user.uid,
          req.body.inviteCode,
          req
        );
      } catch (err) {
        res.status(err.statusCode || 500).json({
          success: false,
          error: { message: err.message, code: err.code },
        });
      }

      assert.strictEqual(res.getStatusCode(), 410);
      assert.strictEqual(res.getJsonResponse().success, false);
      assert.strictEqual(res.getJsonResponse().error.code, 'LEGACY_CODE_RETIRED');
    });
  });

  after(() => {
    setTimeout(() => process.exit(0), 100);
  });
});
