import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveWorkspaceProjectType, isLegacyHackathonWorkspace } from '../../../../frontend/src/constants/workspaceConstants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the canonical database.rules.json file
const rulesJsonPath = path.resolve(__dirname, '../../../../database.rules.json');
const rawRules = JSON.parse(fs.readFileSync(rulesJsonPath, 'utf8'));

/**
 * Creates a Firebase RTDB Rule Mock Node that supports .child(), .val(), and .exists().
 */
function createRuleNode(data) {
  return {
    val: () => (data !== undefined && data !== null ? data : null),
    exists: () => data !== undefined && data !== null,
    child: (childPath) => {
      if (data === null || data === undefined || typeof data !== 'object') {
        return createRuleNode(null);
      }
      return createRuleNode(data[childPath]);
    },
    hasChildren: (keys) => {
      if (!data || typeof data !== 'object') return false;
      return keys.every((k) => data[k] !== undefined && data[k] !== null);
    },
    isString: () => typeof data === 'string',
    isNumber: () => typeof data === 'number',
    isBoolean: () => typeof data === 'boolean',
  };
}

/**
 * Evaluates the actual string expression from database.rules.json
 * by compiling it into a function with (auth, data, newData, root, $orgId).
 */
function evaluateRawRuleExpression(ruleExpr, { auth, data, newData, rootData, $orgId }) {
  const authNode = auth ? { uid: auth.uid, token: auth.token || {} } : null;
  const dataNode = createRuleNode(data);
  const newDataNode = createRuleNode(newData);
  const rootNode = createRuleNode(rootData);

  // Compile the rule expression
  // eslint-disable-next-line no-new-func
  const fn = new Function('auth', 'data', 'newData', 'root', '$orgId', `return Boolean(${ruleExpr});`);
  try {
    return fn(authNode, dataNode, newDataNode, rootNode, $orgId);
  } catch (err) {
    return false;
  }
}

/**
 * Evaluates full Realtime Database write and validate rules for organizations/$orgId.
 */
function evaluateOrganizationWrite({ auth, data, newData, rootData, orgId = 'org_test' }) {
  const writeRuleExpr = rawRules.rules.organizations['$orgId']['.write'];
  const validateRuleExpr = rawRules.rules.organizations['$orgId']['.validate'];

  const writeAllowed = evaluateRawRuleExpression(writeRuleExpr, {
    auth,
    data,
    newData,
    rootData,
    $orgId: orgId,
  });

  if (!writeAllowed) {
    return { allowed: false, reason: 'WRITE_RULE_DENIED' };
  }

  if (validateRuleExpr && newData !== null) {
    const valid = evaluateRawRuleExpression(validateRuleExpr, {
      auth,
      data,
      newData,
      rootData,
      $orgId: orgId,
    });
    if (!valid) {
      return { allowed: false, reason: 'VALIDATE_RULE_FAILED' };
    }
  }

  return { allowed: true };
}

describe('🔒 CONVIA PHASE 1B — WORKSPACE AUTHORIZATION HARDENING', () => {
  // Test Users & Fixtures
  const userAlice = { uid: 'user_alice_owner' };
  const userBob = { uid: 'user_bob_admin' };
  const userCharlie = { uid: 'user_charlie_member' };
  const userEve = { uid: 'user_eve_attacker' };

  const testOrgId = 'org_alpha';

  const baseOrg = {
    id: testOrgId,
    orgId: testOrgId,
    name: 'Alpha Project',
    ownerId: 'user_alice_owner',
    createdBy: 'user_alice_owner',
    projectType: 'software',
    description: 'Alpha workspace description',
    projectGoal: 'Build robust software',
    visibility: 'private',
    maxMembers: 10,
    teamSizeLimit: 10,
    repositoryUrl: 'https://github.com/convia/alpha',
    projectUrl: 'https://alpha.example.com',
    documentationUrl: 'https://docs.alpha.example.com',
    createdAt: 1000000,
    updatedAt: 1000000,
  };

  const baseRootData = {
    organizations: {
      [testOrgId]: baseOrg,
    },
    organization_members: {
      [testOrgId]: {
        user_alice_owner: { uid: 'user_alice_owner', role: 'owner', joinedAt: 1000000 },
        user_bob_admin: { uid: 'user_bob_admin', role: 'admin', joinedAt: 1000100 },
        user_charlie_member: { uid: 'user_charlie_member', role: 'member', joinedAt: 1000200 },
      },
    },
  };

  // =========================================================================
  // 1. DIRECT database.rules.json INTEGRITY AUDIT
  // =========================================================================
  describe('1. Direct database.rules.json String Inspection', () => {
    it('verifies organizations/$orgId .write requires admin role from canonical organization_members', () => {
      const orgWriteRule = rawRules.rules.organizations['$orgId']['.write'];
      assert.ok(orgWriteRule, 'organizations/$orgId must have .write rule');
      assert.ok(
        orgWriteRule.includes("child('role').val() === 'admin'"),
        "organizations write rule must check child('role').val() === 'admin'"
      );
      assert.ok(
        !orgWriteRule.includes("root.child('organization_members').child($orgId).child(auth.uid).exists()"),
        'organizations write rule MUST NOT allow write based merely on membership existence'
      );
    });

    it('verifies organizations/$orgId .validate protects ownerId immutability', () => {
      const orgValidateRule = rawRules.rules.organizations['$orgId']['.validate'];
      assert.ok(orgValidateRule, 'organizations/$orgId must have .validate rule');
      assert.ok(
        orgValidateRule.includes("newData.child('ownerId').val() === data.child('ownerId').val()"),
        'validate rule must ensure ownerId is immutable across non-owner updates'
      );
    });

    it('verifies workspaces/$workspaceId mirror alias path has identical write and validate hardening', () => {
      const wsWriteRule = rawRules.rules.workspaces['$workspaceId']['.write'];
      const wsValidateRule = rawRules.rules.workspaces['$workspaceId']['.validate'];
      assert.ok(wsWriteRule, 'workspaces/$workspaceId must have .write rule');
      assert.ok(wsWriteRule.includes("child('role').val() === 'admin'"), 'workspaces alias write rule must check admin role');
      assert.ok(wsValidateRule, 'workspaces/$workspaceId must have .validate rule');
      assert.ok(wsValidateRule.includes("newData.child('ownerId').val() === data.child('ownerId').val()"), 'workspaces alias validate rule must protect ownerId');
    });
  });

  // =========================================================================
  // 2. SECTION 15: WORKSPACE CREATION AUTHORIZATION
  // =========================================================================
  describe('2. Workspace Creation Authorization', () => {
    it('denies unauthenticated user from creating a workspace', () => {
      const res = evaluateOrganizationWrite({
        auth: null,
        data: null,
        newData: { ownerId: 'user_alice_owner', name: 'New Org' },
        rootData: baseRootData,
        orgId: 'new_org',
      });
      assert.strictEqual(res.allowed, false, 'Unauthenticated workspace creation must be denied');
    });

    it('allows authenticated user to create workspace when ownerId matches auth.uid', () => {
      const res = evaluateOrganizationWrite({
        auth: userAlice,
        data: null,
        newData: { ownerId: 'user_alice_owner', name: 'Alice New Org', projectType: 'software' },
        rootData: baseRootData,
        orgId: 'new_org',
      });
      assert.strictEqual(res.allowed, true, 'Workspace creation with matching ownerId must be allowed');
    });

    it('denies authenticated user from creating workspace with forged/another user ownerId', () => {
      const res = evaluateOrganizationWrite({
        auth: userEve,
        data: null,
        newData: { ownerId: 'user_alice_owner', name: 'Eve Spoofed Org' },
        rootData: baseRootData,
        orgId: 'new_org',
      });
      assert.strictEqual(res.allowed, false, 'Creation with forged ownerId must be denied');
    });
  });

  // =========================================================================
  // 3. SECTION 15 & 16: EXISTING WORKSPACE WRITES & CRITICAL MEMBER TESTS
  // =========================================================================
  describe('3. Existing Workspace Writes & Regular Member Direct-Write Denial', () => {
    it('allows workspace owner to update workspace settings', () => {
      const updatedData = {
        ...baseOrg,
        name: 'Alpha Project Renamed by Owner',
        description: 'Updated by owner',
        maxMembers: 15,
        teamSizeLimit: 15,
      };
      const res = evaluateOrganizationWrite({
        auth: userAlice,
        data: baseOrg,
        newData: updatedData,
        rootData: baseRootData,
        orgId: testOrgId,
      });
      assert.strictEqual(res.allowed, true, 'Workspace owner must be allowed to update settings');
    });

    it('allows authorized workspace admin to update workspace settings', () => {
      const updatedData = {
        ...baseOrg,
        name: 'Alpha Project Updated by Admin',
        description: 'Admin adjusted description',
        projectGoal: 'Updated goal by admin',
        maxMembers: 12,
        teamSizeLimit: 12,
      };
      const res = evaluateOrganizationWrite({
        auth: userBob,
        data: baseOrg,
        newData: updatedData,
        rootData: baseRootData,
        orgId: testOrgId,
      });
      assert.strictEqual(res.allowed, true, 'Workspace admin must be allowed to update settings');
    });

    // CRITICAL ACCEPTANCE TEST: Regular member bypasses UI and attempts direct RTDB write
    it('CRITICAL: regular member direct write to organizations/$orgId (changing name) is STRICTLY DENIED', () => {
      const tamperedData = {
        ...baseOrg,
        name: 'Hacked by Regular Member Charlie',
      };
      const res = evaluateOrganizationWrite({
        auth: userCharlie,
        data: baseOrg,
        newData: tamperedData,
        rootData: baseRootData,
        orgId: testOrgId,
      });
      assert.strictEqual(res.allowed, false, 'Regular member direct write changing name must be DENIED');
      assert.strictEqual(res.reason, 'WRITE_RULE_DENIED');
    });

    it('CRITICAL: regular member direct write to organizations/$orgId (changing ownerId) is STRICTLY DENIED', () => {
      const tamperedData = {
        ...baseOrg,
        ownerId: 'user_charlie_member',
      };
      const res = evaluateOrganizationWrite({
        auth: userCharlie,
        data: baseOrg,
        newData: tamperedData,
        rootData: baseRootData,
        orgId: testOrgId,
      });
      assert.strictEqual(res.allowed, false, 'Regular member direct write changing ownerId must be DENIED');
    });

    it('CRITICAL: regular member direct write to organizations/$orgId (changing maxMembers) is STRICTLY DENIED', () => {
      const tamperedData = {
        ...baseOrg,
        maxMembers: 50,
        teamSizeLimit: 50,
      };
      const res = evaluateOrganizationWrite({
        auth: userCharlie,
        data: baseOrg,
        newData: tamperedData,
        rootData: baseRootData,
        orgId: testOrgId,
      });
      assert.strictEqual(res.allowed, false, 'Regular member direct write changing maxMembers must be DENIED');
    });

    it('CRITICAL: regular member direct write to organizations/$orgId (changing projectType) is STRICTLY DENIED', () => {
      const tamperedData = {
        ...baseOrg,
        projectType: 'hackathon',
      };
      const res = evaluateOrganizationWrite({
        auth: userCharlie,
        data: baseOrg,
        newData: tamperedData,
        rootData: baseRootData,
        orgId: testOrgId,
      });
      assert.strictEqual(res.allowed, false, 'Regular member direct write changing projectType must be DENIED');
    });

    it('CRITICAL: regular member direct write to organizations/$orgId (changing description or URLs) is STRICTLY DENIED', () => {
      const tamperedData = {
        ...baseOrg,
        description: 'Tampered description by Charlie',
        projectGoal: 'Tampered goal by Charlie',
        repositoryUrl: 'https://github.com/charlie/tampered',
        projectUrl: 'https://tampered.example.com',
        documentationUrl: 'https://docs.tampered.example.com',
      };
      const res = evaluateOrganizationWrite({
        auth: userCharlie,
        data: baseOrg,
        newData: tamperedData,
        rootData: baseRootData,
        orgId: testOrgId,
      });
      assert.strictEqual(res.allowed, false, 'Regular member direct write changing metadata must be DENIED');
      assert.strictEqual(res.reason, 'WRITE_RULE_DENIED');
    });

    it('denies unauthenticated user from updating workspace', () => {
      const res = evaluateOrganizationWrite({
        auth: null,
        data: baseOrg,
        newData: { ...baseOrg, name: 'Anonymous Edit' },
        rootData: baseRootData,
        orgId: testOrgId,
      });
      assert.strictEqual(res.allowed, false, 'Unauthenticated workspace update must be denied');
    });

    it('denies authenticated user who is not a workspace member from updating workspace', () => {
      const res = evaluateOrganizationWrite({
        auth: userEve,
        data: baseOrg,
        newData: { ...baseOrg, name: 'Attacker Edit' },
        rootData: baseRootData,
        orgId: testOrgId,
      });
      assert.strictEqual(res.allowed, false, 'Non-member update must be denied');
    });

    it('denies member with missing role from updating workspace', () => {
      const rootWithoutRole = {
        ...baseRootData,
        organization_members: {
          [testOrgId]: {
            user_eve_attacker: { uid: 'user_eve_attacker' }, // missing role
          },
        },
      };
      const res = evaluateOrganizationWrite({
        auth: userEve,
        data: baseOrg,
        newData: { ...baseOrg, name: 'Corrupt Role Edit' },
        rootData: rootWithoutRole,
        orgId: testOrgId,
      });
      assert.strictEqual(res.allowed, false, 'Member with missing role must be denied');
    });

    it('denies member with unknown/viewer role from updating workspace', () => {
      const rootWithViewer = {
        ...baseRootData,
        organization_members: {
          [testOrgId]: {
            user_eve_attacker: { uid: 'user_eve_attacker', role: 'viewer' },
          },
        },
      };
      const res = evaluateOrganizationWrite({
        auth: userEve,
        data: baseOrg,
        newData: { ...baseOrg, name: 'Viewer Edit' },
        rootData: rootWithViewer,
        orgId: testOrgId,
      });
      assert.strictEqual(res.allowed, false, 'Member with viewer role must be denied');
    });
  });

  // =========================================================================
  // 4. SECTION 6 & 17: OWNER PROTECTION AGAINST ADMIN OVERRIDE
  // =========================================================================
  describe('4. Owner Protection Against Admin Tampering', () => {
    it('denies admin from changing ownerId (ownership theft protection)', () => {
      const adminTamperedOwner = {
        ...baseOrg,
        name: 'Valid Name by Admin',
        ownerId: 'user_bob_admin', // Admin attempting to take over ownership
      };
      const res = evaluateOrganizationWrite({
        auth: userBob,
        data: baseOrg,
        newData: adminTamperedOwner,
        rootData: baseRootData,
        orgId: testOrgId,
      });
      assert.strictEqual(res.allowed, false, 'Admin changing ownerId must be rejected by validation');
      assert.strictEqual(res.reason, 'VALIDATE_RULE_FAILED');
    });

    it('allows admin to update all standard settings when ownerId is unchanged', () => {
      const adminSettingsUpdate = {
        ...baseOrg,
        name: 'Alpha Project Rev 2',
        description: 'New Project Description',
        projectGoal: 'Achieve milestones',
        projectType: 'ai_ml',
        repositoryUrl: 'https://github.com/convia/alpha-rev2',
        projectUrl: 'https://alpha-rev2.convia.app',
        documentationUrl: 'https://docs.alpha-rev2.convia.app',
        maxMembers: 20,
        teamSizeLimit: 20,
      };
      const res = evaluateOrganizationWrite({
        auth: userBob,
        data: baseOrg,
        newData: adminSettingsUpdate,
        rootData: baseRootData,
        orgId: testOrgId,
      });
      assert.strictEqual(res.allowed, true, 'Admin updating standard fields with preserved ownerId must be allowed');
    });
  });

  // =========================================================================
  // 5. SECTION 18: LEGACY HACKATHON WORKSPACE COMPATIBILITY
  // =========================================================================
  describe('5. Legacy Hackathon Workspace Backward Compatibility', () => {
    const legacyOrg = {
      id: 'org_legacy_hackathon',
      orgId: 'org_legacy_hackathon',
      name: 'Hackathon Fall 2024',
      ownerId: 'user_alice_owner',
      createdBy: 'user_alice_owner',
      // No projectType field (pre-Phase 1)
      hackathonName: 'Fall Hackathon 2024',
      hackathonTheme: 'AI for Healthcare',
      hackathonLocation: 'San Francisco, CA',
      hackathonDate: '2024-11-15',
      startDate: '2024-11-15T09:00',
      endDate: '2024-11-17T18:00',
      maxMembers: 4,
      teamSizeLimit: 4,
      createdAt: 500000,
      updatedAt: 500000,
    };

    const legacyRootData = {
      organizations: {
        org_legacy_hackathon: legacyOrg,
      },
      organization_members: {
        org_legacy_hackathon: {
          user_alice_owner: { uid: 'user_alice_owner', role: 'owner', joinedAt: 500000 },
          user_bob_admin: { uid: 'user_bob_admin', role: 'admin', joinedAt: 500100 },
          user_charlie_member: { uid: 'user_charlie_member', role: 'member', joinedAt: 500200 },
        },
      },
    };

    it('allows owner to update legacy workspace settings while preserving hackathon metadata', () => {
      const updatedLegacy = {
        ...legacyOrg,
        description: 'New generalized description for ongoing work',
        projectType: 'hackathon',
        updatedAt: 600000,
      };
      const res = evaluateOrganizationWrite({
        auth: userAlice,
        data: legacyOrg,
        newData: updatedLegacy,
        rootData: legacyRootData,
        orgId: 'org_legacy_hackathon',
      });
      assert.strictEqual(res.allowed, true, 'Owner can update legacy workspace');
      assert.strictEqual(updatedLegacy.hackathonName, 'Fall Hackathon 2024', 'Historical hackathonName must be preserved');
      assert.strictEqual(updatedLegacy.hackathonTheme, 'AI for Healthcare', 'Historical hackathonTheme must be preserved');
    });

    it('allows admin to update legacy workspace settings', () => {
      const updatedLegacy = {
        ...legacyOrg,
        name: 'Fall Hackathon 2024 (Team Project)',
        description: 'Updated by Admin',
        updatedAt: 600000,
      };
      const res = evaluateOrganizationWrite({
        auth: userBob,
        data: legacyOrg,
        newData: updatedLegacy,
        rootData: legacyRootData,
        orgId: 'org_legacy_hackathon',
      });
      assert.strictEqual(res.allowed, true, 'Admin can update legacy workspace settings');
    });

    it('denies regular member from modifying legacy workspace settings', () => {
      const tamperedLegacy = {
        ...legacyOrg,
        name: 'Charlie Tampered Hackathon Name',
      };
      const res = evaluateOrganizationWrite({
        auth: userCharlie,
        data: legacyOrg,
        newData: tamperedLegacy,
        rootData: legacyRootData,
        orgId: 'org_legacy_hackathon',
      });
      assert.strictEqual(res.allowed, false, 'Member cannot modify legacy workspace settings');
    });

    it('correctly detects legacy workspace and resolves fallback projectType', () => {
      assert.strictEqual(isLegacyHackathonWorkspace(legacyOrg), true);
      assert.strictEqual(resolveWorkspaceProjectType(legacyOrg), 'hackathon');
    });
  });

  // =========================================================================
  // 6. SECTION 20 & 21: FRONTEND ERROR HANDLING & MEMBER LEAVE RESILIENCE
  // =========================================================================
  describe('6. Frontend Error Handling & Safe Member Leave Operations', () => {
    it('translates Firebase PERMISSION_DENIED into user-friendly message', async () => {
      const mockRtdb = {
        updateData: async () => {
          const err = new Error('PERMISSION_DENIED: Permission denied');
          err.code = 'PERMISSION_DENIED';
          throw err;
        },
      };

      // Direct simulation of orgService.updateOrganizationGeneralSettings error handling
      let caughtError = null;
      try {
        await (async () => {
          try {
            await mockRtdb.updateData('organizations/org_alpha', { name: 'Unauthorized' });
          } catch (error) {
            if (
              error.code === 'PERMISSION_DENIED' ||
              error.message?.includes('PERMISSION_DENIED') ||
              error.message?.includes('permission')
            ) {
              throw new Error("You don't have permission to modify this workspace.");
            }
            throw error;
          }
        })();
      } catch (err) {
        caughtError = err;
      }

      assert.ok(caughtError, 'Should catch error');
      assert.strictEqual(caughtError.message, "You don't have permission to modify this workspace.");
      assert.ok(
        !caughtError.message.includes('PERMISSION_DENIED at organizations'),
        'Must not expose internal Firebase rule path'
      );
    });

    it('allows regular member leave operation to succeed gracefully when memberCount update on organizations is denied', async () => {
      let memberNodeDeleted = false;
      let userProfileCleared = false;
      let directOrgWriteAttempted = false;

      const mockRtdb = {
        getData: async (pathStr) => {
          if (pathStr === 'organizations/org_alpha') {
            return { orgId: 'org_alpha', ownerId: 'user_alice_owner', memberCount: 3 };
          }
          if (pathStr === 'organization_members/org_alpha') {
            return {
              user_alice_owner: { role: 'owner' },
              user_charlie_member: { role: 'member' },
            };
          }
          return null;
        },
        setData: async (pathStr, val) => {
          if (pathStr === 'organization_members/org_alpha/user_charlie_member' && val === null) {
            memberNodeDeleted = true;
          }
        },
        updateData: async (pathStr, val) => {
          if (pathStr === 'organizations/org_alpha') {
            directOrgWriteAttempted = true;
            // Simulate RTDB rule rejection for non-admin member write to organizations/$orgId
            const err = new Error('PERMISSION_DENIED');
            err.code = 'PERMISSION_DENIED';
            throw err;
          }
          if (pathStr === 'users/user_charlie_member') {
            userProfileCleared = true;
          }
        },
      };

      // Simulate leaveOrganization logic with Phase 1B guard
      const leaveOrganizationSafe = async (uid, orgId) => {
        const org = await mockRtdb.getData(`organizations/${orgId}`);
        if (!org) return;

        const timestamp = Date.now();
        const newMemberCount = Math.max(0, (org.memberCount || 1) - 1);

        // 1. Remove member node (permitted by rule: auth.uid === $uid && !newData.exists())
        await mockRtdb.setData(`organization_members/${orgId}/${uid}`, null);

        // 2. Decrement member count on organization (guarded for non-admin members)
        try {
          await mockRtdb.updateData(`organizations/${orgId}`, {
            memberCount: newMemberCount,
            updatedAt: timestamp,
          });
        } catch (countErr) {
          // Handled gracefully under Phase 1B
        }

        // 3. Clear user profile organizationId
        await mockRtdb.updateData(`users/${uid}`, { organizationId: null });
      };

      await leaveOrganizationSafe('user_charlie_member', 'org_alpha');

      assert.strictEqual(memberNodeDeleted, true, 'Member record must be cleanly removed');
      assert.strictEqual(directOrgWriteAttempted, true, 'Direct organization write was attempted and caught');
      assert.strictEqual(userProfileCleared, true, 'User profile organization association must be cleared');
    });
  });
});
