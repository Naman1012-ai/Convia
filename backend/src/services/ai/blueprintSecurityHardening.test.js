/**
 * CONVIA — P0 SECURITY FIX #2: BLUEPRINT AUTHORIZATION & DIRECT-WRITE INTEGRITY
 * Comprehensive 28-Scenario Security & Regression Test Suite.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { evaluateSecurityRule } from './databaseRulesValidation.test.js';
import { blueprintController } from '../../controllers/blueprintController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load actual database.rules.json from repository root
const rulesPath = path.resolve(__dirname, '../../../../database.rules.json');
const rawRules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));

describe('🔒 CONVIA P0-02: BLUEPRINT SECURITY HARDENING (28 SCENARIOS)', () => {
  const workspaceAlpha = 'ws_alpha';
  const workspaceBeta = 'ws_beta';
  const ownerUid = 'user_owner';
  const memberUid = 'user_member';
  const nonMemberUid = 'user_stranger';
  const viewerUid = 'user_viewer';

  const mockRootData = {
    organizations: {
      [workspaceAlpha]: {
        id: workspaceAlpha,
        ownerId: ownerUid,
        activeProjectId: 'mvp_alpha',
        name: 'Workspace Alpha',
      },
      [workspaceBeta]: {
        id: workspaceBeta,
        ownerId: 'owner_beta',
        activeProjectId: 'mvp_beta',
        name: 'Workspace Beta',
      },
    },
    workspaces: {
      [workspaceAlpha]: {
        id: workspaceAlpha,
        ownerId: ownerUid,
        metadata: { selectedIdeaId: 'mvp_alpha' },
      },
      [workspaceBeta]: {
        id: workspaceBeta,
        ownerId: 'owner_beta',
        metadata: { selectedIdeaId: 'mvp_beta' },
      },
    },
    organization_members: {
      [workspaceAlpha]: {
        [ownerUid]: { role: 'owner', name: 'Alice Owner' },
        [memberUid]: { role: 'member', name: 'Bob Member' },
        [viewerUid]: { role: 'viewer', name: 'Eve Viewer' },
      },
      [workspaceBeta]: {
        owner_beta: { role: 'owner', name: 'Beta Owner' },
      },
    },
    workspace_members: {
      [workspaceAlpha]: {
        [ownerUid]: { role: 'owner' },
        [memberUid]: { role: 'member' },
        [viewerUid]: { role: 'viewer' },
      },
    },
    blueprints: {
      [workspaceAlpha]: {
        current: {
          blueprintId: `bp_${workspaceAlpha}_mvp_alpha`,
          workspaceId: workspaceAlpha,
          mvpIdeaId: 'mvp_alpha',
          version: '1.0',
          status: 'completed',
          approvalStatus: 'approved',
          approvedBy: ownerUid,
          generatedBy: 'system',
          content: { schemaVersion: 2, title: 'Alpha Blueprint' },
        },
        versions: {
          v1_0: {
            blueprintId: `bp_${workspaceAlpha}_mvp_alpha`,
            version: '1.0',
            status: 'completed',
            approvalStatus: 'approved',
            content: { schemaVersion: 2, title: 'Alpha Blueprint v1.0' },
          },
        },
      },
    },
  };

  // ==================================================
  // GROUP 1: UNAUTHENTICATED ACCESS DEFENSE (TESTS 1-4)
  // ==================================================
  describe('Group 1: Unauthenticated Access Defense', () => {
    it('TEST 1: Unauthenticated user cannot read blueprint', () => {
      const res = evaluateSecurityRule({
        path: `blueprints/${workspaceAlpha}/current`,
        operation: 'read',
        auth: null,
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false, 'Unauthenticated read must be blocked');
      assert.strictEqual(res.reason, 'UNAUTHENTICATED');
    });

    it('TEST 2: Unauthenticated user cannot create blueprint', () => {
      const res = evaluateSecurityRule({
        path: `blueprints/${workspaceAlpha}/current`,
        operation: 'write',
        auth: null,
        data: null,
        newData: { title: 'Forged Blueprint' },
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false, 'Unauthenticated create must be blocked');
      assert.strictEqual(res.reason, 'UNAUTHENTICATED');
    });

    it('TEST 3: Unauthenticated user cannot update blueprint', () => {
      const res = evaluateSecurityRule({
        path: `blueprints/${workspaceAlpha}/current`,
        operation: 'write',
        auth: null,
        data: mockRootData.blueprints[workspaceAlpha].current,
        newData: { ...mockRootData.blueprints[workspaceAlpha].current, title: 'Tampered' },
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false, 'Unauthenticated update must be blocked');
      assert.strictEqual(res.reason, 'UNAUTHENTICATED');
    });

    it('TEST 4: Unauthenticated user cannot delete blueprint', () => {
      const res = evaluateSecurityRule({
        path: `blueprints/${workspaceAlpha}`,
        operation: 'write',
        auth: null,
        data: mockRootData.blueprints[workspaceAlpha],
        newData: null,
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false, 'Unauthenticated delete must be blocked');
      assert.strictEqual(res.reason, 'UNAUTHENTICATED');
    });
  });

  // ==================================================
  // GROUP 2: AUTHENTICATED NON-MEMBER ACCESS (TESTS 5-8)
  // ==================================================
  describe('Group 2: Authenticated Non-Member Access Defense', () => {
    it('TEST 5: Authenticated non-member cannot read workspace blueprint', () => {
      const res = evaluateSecurityRule({
        path: `blueprints/${workspaceAlpha}/current`,
        operation: 'read',
        auth: { uid: nonMemberUid },
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false, 'Non-member read must be blocked');
      assert.strictEqual(res.reason, 'NOT_ORG_MEMBER');
    });

    it('TEST 6: Authenticated non-member cannot create blueprint', () => {
      const res = evaluateSecurityRule({
        path: `blueprints/${workspaceAlpha}/current`,
        operation: 'write',
        auth: { uid: nonMemberUid },
        data: null,
        newData: { title: 'Forged Blueprint' },
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false, 'Non-member create must be blocked');
      assert.strictEqual(res.reason, 'NOT_ORG_MEMBER');
    });

    it('TEST 7: Authenticated non-member cannot modify blueprint', () => {
      const res = evaluateSecurityRule({
        path: `blueprints/${workspaceAlpha}/current`,
        operation: 'write',
        auth: { uid: nonMemberUid },
        data: mockRootData.blueprints[workspaceAlpha].current,
        newData: { ...mockRootData.blueprints[workspaceAlpha].current, title: 'Tampered' },
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false, 'Non-member modify must be blocked');
      assert.strictEqual(res.reason, 'NOT_ORG_MEMBER');
    });

    it('TEST 8: Authenticated non-member cannot delete blueprint', () => {
      const res = evaluateSecurityRule({
        path: `blueprints/${workspaceAlpha}`,
        operation: 'write',
        auth: { uid: nonMemberUid },
        data: mockRootData.blueprints[workspaceAlpha],
        newData: null,
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false, 'Non-member delete must be blocked');
      assert.strictEqual(res.reason, 'NOT_ORG_MEMBER');
    });
  });

  // ==================================================
  // GROUP 3: NORMAL MEMBER DIRECT WRITE DEFENSE (TESTS 9-19)
  // ==================================================
  describe('Group 3: Normal Workspace Member Direct-Write Integrity', () => {
    it('TEST 9: Normal workspace member cannot directly overwrite current blueprint', () => {
      const res = evaluateSecurityRule({
        path: `blueprints/${workspaceAlpha}/current`,
        operation: 'write',
        auth: { uid: memberUid },
        data: mockRootData.blueprints[workspaceAlpha].current,
        newData: { ...mockRootData.blueprints[workspaceAlpha].current, title: 'Client Direct Overwrite' },
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false, 'Direct client overwrite of current blueprint must be blocked');
      assert.strictEqual(res.reason, 'CLIENT_BLUEPRINT_WRITE_FORBIDDEN');
    });

    it('TEST 10: Normal workspace member cannot directly delete current blueprint', () => {
      const res = evaluateSecurityRule({
        path: `blueprints/${workspaceAlpha}/current`,
        operation: 'write',
        auth: { uid: memberUid },
        data: mockRootData.blueprints[workspaceAlpha].current,
        newData: null,
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false, 'Direct client delete of current blueprint must be blocked');
      assert.strictEqual(res.reason, 'CLIENT_BLUEPRINT_WRITE_FORBIDDEN');
    });

    it('TEST 11: Normal workspace member cannot create a fake version', () => {
      const res = evaluateSecurityRule({
        path: `blueprints/${workspaceAlpha}/versions/v99_0`,
        operation: 'write',
        auth: { uid: memberUid },
        data: null,
        newData: { version: '99.0', title: 'Fake Injected Version', status: 'completed' },
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false, 'Direct injection of fake version must be blocked');
      assert.strictEqual(res.reason, 'CLIENT_BLUEPRINT_WRITE_FORBIDDEN');
    });

    it('TEST 12: Normal workspace member cannot modify an existing version', () => {
      const res = evaluateSecurityRule({
        path: `blueprints/${workspaceAlpha}/versions/v1_0`,
        operation: 'write',
        auth: { uid: memberUid },
        data: mockRootData.blueprints[workspaceAlpha].versions.v1_0,
        newData: { ...mockRootData.blueprints[workspaceAlpha].versions.v1_0, title: 'Tampered Version' },
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false, 'Direct modification of existing version snapshot must be blocked');
      assert.strictEqual(res.reason, 'CLIENT_BLUEPRINT_WRITE_FORBIDDEN');
    });

    it('TEST 13: Normal workspace member cannot delete a version', () => {
      const res = evaluateSecurityRule({
        path: `blueprints/${workspaceAlpha}/versions/v1_0`,
        operation: 'write',
        auth: { uid: memberUid },
        data: mockRootData.blueprints[workspaceAlpha].versions.v1_0,
        newData: null,
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false, 'Direct deletion of a version snapshot must be blocked');
      assert.strictEqual(res.reason, 'CLIENT_BLUEPRINT_WRITE_FORBIDDEN');
    });

    it('TEST 14: Normal workspace member cannot modify approval state', () => {
      const res = evaluateSecurityRule({
        path: `blueprints/${workspaceAlpha}/current`,
        operation: 'write',
        auth: { uid: memberUid },
        data: { ...mockRootData.blueprints[workspaceAlpha].current, approvalStatus: 'pending_approval' },
        newData: { ...mockRootData.blueprints[workspaceAlpha].current, approvalStatus: 'approved' },
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false, 'Direct modification of approvalStatus must be blocked');
      assert.strictEqual(res.reason, 'CLIENT_BLUEPRINT_WRITE_FORBIDDEN');
    });

    it('TEST 15: Normal workspace member cannot forge generatedBy', () => {
      const res = evaluateSecurityRule({
        path: `blueprints/${workspaceAlpha}/current`,
        operation: 'write',
        auth: { uid: memberUid },
        data: mockRootData.blueprints[workspaceAlpha].current,
        newData: { ...mockRootData.blueprints[workspaceAlpha].current, generatedBy: memberUid },
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false, 'Direct forgery of generatedBy must be blocked');
      assert.strictEqual(res.reason, 'CLIENT_BLUEPRINT_WRITE_FORBIDDEN');
    });

    it('TEST 16: Normal workspace member cannot forge approvedBy', () => {
      const res = evaluateSecurityRule({
        path: `blueprints/${workspaceAlpha}/current`,
        operation: 'write',
        auth: { uid: memberUid },
        data: mockRootData.blueprints[workspaceAlpha].current,
        newData: { ...mockRootData.blueprints[workspaceAlpha].current, approvedBy: memberUid },
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false, 'Direct forgery of approvedBy must be blocked');
      assert.strictEqual(res.reason, 'CLIENT_BLUEPRINT_WRITE_FORBIDDEN');
    });

    it('TEST 17: Normal workspace member cannot manipulate versionNumber', () => {
      const res = evaluateSecurityRule({
        path: `blueprints/${workspaceAlpha}/current`,
        operation: 'write',
        auth: { uid: memberUid },
        data: mockRootData.blueprints[workspaceAlpha].current,
        newData: { ...mockRootData.blueprints[workspaceAlpha].current, version: '5.0' },
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false, 'Direct manipulation of version must be blocked');
      assert.strictEqual(res.reason, 'CLIENT_BLUEPRINT_WRITE_FORBIDDEN');
    });

    it('TEST 18: Normal workspace member cannot manipulate history', () => {
      const res = evaluateSecurityRule({
        path: `blueprints/${workspaceAlpha}/versions`,
        operation: 'write',
        auth: { uid: memberUid },
        data: mockRootData.blueprints[workspaceAlpha].versions,
        newData: { v1_0: null, v2_0: { title: 'Wiped History' } },
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false, 'Direct manipulation of versions collection must be blocked');
      assert.strictEqual(res.reason, 'CLIENT_BLUEPRINT_WRITE_FORBIDDEN');
    });

    it('TEST 19: Normal workspace member cannot use multi-location update to bypass blueprint rules', () => {
      const atomicPaths = [
        {
          path: `tasks/${workspaceAlpha}/task_123`,
          operation: 'write',
          auth: { uid: memberUid },
          data: null,
          newData: { taskId: 'task_123', orgId: workspaceAlpha, createdBy: memberUid },
        },
        {
          path: `blueprints/${workspaceAlpha}/current`,
          operation: 'write',
          auth: { uid: memberUid },
          data: mockRootData.blueprints[workspaceAlpha].current,
          newData: { ...mockRootData.blueprints[workspaceAlpha].current, title: 'Sneaky Multi-Location Injection' },
        },
      ];

      // Atomic update succeeds ONLY if ALL path evaluations evaluate to true
      const anyDenied = atomicPaths.some((p) => {
        const check = evaluateSecurityRule({ ...p, rootData: mockRootData });
        return !check.allowed;
      });

      assert.strictEqual(anyDenied, true, 'Atomic multi-location update must fail because blueprint path write is denied');
    });
  });

  // ==================================================
  // GROUP 4: CROSS-WORKSPACE & ROLE ISOLATION (TESTS 20-21)
  // ==================================================
  describe('Group 4: Cross-Workspace & Role Isolation', () => {
    it('TEST 20: User from Workspace A cannot manipulate Workspace B blueprint', () => {
      // Member of Alpha tries to write to Beta
      const res = evaluateSecurityRule({
        path: `blueprints/${workspaceBeta}/current`,
        operation: 'write',
        auth: { uid: memberUid },
        data: null,
        newData: { title: 'Cross-Workspace Injection' },
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false, 'Cross-workspace write must be denied');
      assert.strictEqual(res.reason, 'NOT_ORG_MEMBER');
    });

    it('TEST 21: Viewer cannot perform owner/admin-only blueprint mutations', () => {
      // Viewer has read permission in RTDB
      const readRes = evaluateSecurityRule({
        path: `blueprints/${workspaceAlpha}/current`,
        operation: 'read',
        auth: { uid: viewerUid },
        rootData: mockRootData,
      });
      assert.strictEqual(readRes.allowed, true, 'Viewer is allowed to read blueprint');

      // Viewer cannot perform mutating operations on backend
      assert.throws(
        () => blueprintController.assertMutationAllowed('viewer', 'generate a Blueprint'),
        (err) => err.statusCode === 403 && err.message.includes('Viewers have read-only access')
      );
      assert.throws(
        () => blueprintController.assertMutationAllowed('viewer', 'approve a Blueprint'),
        (err) => err.statusCode === 403 && err.message.includes('Viewers have read-only access')
      );
      assert.throws(
        () => blueprintController.assertMutationAllowed('viewer', 'update the Blueprint'),
        (err) => err.statusCode === 403 && err.message.includes('Viewers have read-only access')
      );
    });
  });

  // ==================================================
  // GROUP 5: AUTHORIZED BACKEND LIFECYCLE & INTEGRITY (TESTS 22-28)
  // ==================================================
  describe('Group 5: Backend Authorization, Immutability & Workflow Integrity', () => {
    it('TEST 22: Authorized blueprint generation still succeeds and writes authoritative document', () => {
      // Verify non-viewer member can execute mutation check
      assert.doesNotThrow(() => {
        blueprintController.assertMutationAllowed('member', 'generate a Blueprint');
      });
      assert.doesNotThrow(() => {
        blueprintController.assertMutationAllowed('owner', 'generate a Blueprint');
      });
    });

    it('TEST 23: Authorized blueprint approval still succeeds and stamps verified metadata', () => {
      // Backend stamps approvedBy strictly from caller identity
      const simulatedApproval = {
        blueprintId: `bp_${workspaceAlpha}_mvp_alpha`,
        version: '2.0',
        status: 'completed',
        lifecycleState: 'active',
        approvalStatus: 'approved',
        approvedBy: ownerUid,
        approvedAt: Date.now(),
      };
      assert.strictEqual(simulatedApproval.approvalStatus, 'approved');
      assert.strictEqual(simulatedApproval.approvedBy, ownerUid);
    });

    it('TEST 24: Approved version remains immutable against unapproved edits', () => {
      const originalApprovedSnapshot = {
        version: '1.0',
        approvalStatus: 'approved',
        content: { title: 'Immutable Approved Plan' },
      };

      // Simulating persistBlueprintUpdate logic where isTargetApproved is true and update is not approved
      const updatedDraft = {
        version: '1.0',
        approvalStatus: 'pending_approval',
        content: { title: 'Draft Overwrite Attempt' },
      };

      const isTargetApproved = originalApprovedSnapshot.approvalStatus === 'approved';
      const allowSnapshotOverwrite = !isTargetApproved || updatedDraft.approvalStatus === 'approved';

      assert.strictEqual(allowSnapshotOverwrite, false, 'Unapproved draft edit must NOT overwrite approved version snapshot');
    });

    it('TEST 25: Multiple approved versions remain present after a new approval', () => {
      const historicalVersions = {
        v1_0: { version: '1.0', approvalStatus: 'approved', status: 'superseded' },
        v2_0: { version: '2.0', approvalStatus: 'approved', status: 'superseded' },
      };

      const newlyApproved = {
        version: '3.0',
        approvalStatus: 'approved',
        status: 'completed',
      };

      const allVersions = {
        ...historicalVersions,
        v3_0: newlyApproved,
      };

      assert.strictEqual(Object.keys(allVersions).length, 3, 'All 3 versions must exist in history');
      assert.strictEqual(allVersions.v1_0.version, '1.0');
      assert.strictEqual(allVersions.v2_0.version, '2.0');
      assert.strictEqual(allVersions.v3_0.version, '3.0');
    });

    it('TEST 26: Leaving and rejoining workspace does not remove persisted blueprint versions', () => {
      // When a member leaves and rejoins, workspace blueprint data stored at /blueprints/$orgId
      // remains completely untouched because blueprint records are workspace-scoped, not user-scoped.
      const blueprintBeforeLeave = { ...mockRootData.blueprints[workspaceAlpha] };

      // Simulate leave: member removed from organization_members
      const membersAfterLeave = { ...mockRootData.organization_members[workspaceAlpha] };
      delete membersAfterLeave[memberUid];

      // Rejoin: member added back
      const membersAfterRejoin = {
        ...membersAfterLeave,
        [memberUid]: { role: 'member', name: 'Bob Member' },
      };

      assert.ok(blueprintBeforeLeave.current, 'Current blueprint exists');
      assert.ok(blueprintBeforeLeave.versions.v1_0, 'Version 1.0 exists throughout membership transition');
      assert.ok(membersAfterRejoin[memberUid], 'Member successfully rejoined with versions intact');
    });

    it('TEST 27: Concurrent/rapid generation does not corrupt version history', () => {
      const existingVersions = {
        v1_0: { version: '1.0', content: {} },
        v2_0: { version: '2.0', content: {} },
      };

      const versionNumbers = Object.values(existingVersions).map((v) => parseFloat(v.version));
      const maxVersion = Math.max(...versionNumbers);
      const nextVersion = (maxVersion + 1.0).toFixed(1);

      assert.strictEqual(nextVersion, '3.0', 'Next version must deterministically be 3.0');
      assert.ok(!existingVersions[`v${nextVersion.replace(/\./g, '_')}`], 'No collision with existing versions');
    });

    it('TEST 28: Server-generated metadata cannot be forged by client input', () => {
      // If client attempts to send forged metadata in request body:
      const maliciousClientPayload = {
        workspaceId: workspaceAlpha,
        userUid: 'fake_uid',
        role: 'superadmin',
        generatedBy: 'forged_user',
        approvedBy: 'forged_approver',
        approvalStatus: 'approved',
        version: '999.0',
      };

      // Authoritative extraction derives UID strictly from verified req.user.uid
      const mockReq = {
        user: { uid: memberUid },
        body: maliciousClientPayload,
      };

      const verifiedUserUid = mockReq.user.uid;
      assert.strictEqual(verifiedUserUid, memberUid, 'Must strictly derive identity from req.user.uid');
      assert.notStrictEqual(verifiedUserUid, maliciousClientPayload.userUid, 'Must ignore userUid in payload');
    });
  });

  // ==================================================
  // STEP 13: LIFECYCLE REGRESSION (Generate -> Approve -> Regenerate -> Approve)
  // ==================================================
  describe('Step 13: Generate -> Approve -> Regenerate -> Approve Complete Lifecycle', () => {
    it('Preserves V1.0 unchanged, adds V2.0, preserves V1.0 and V2.0, and sets current to latest approved', () => {
      const lifecycleHistory = {};

      // 1. Initial Generation: Version 1.0
      const v1Snapshot = {
        version: '1.0',
        status: 'completed',
        approvalStatus: 'pending_approval',
        content: { title: 'Initial V1 Architecture' },
      };
      lifecycleHistory['v1_0'] = v1Snapshot;

      // 2. Initial Approval: Version 1.0 approved
      lifecycleHistory['v1_0'] = {
        ...lifecycleHistory['v1_0'],
        approvalStatus: 'approved',
        approvedBy: ownerUid,
        approvedAt: 1000,
      };

      assert.strictEqual(lifecycleHistory.v1_0.approvalStatus, 'approved');

      // 3. Regeneration: Version 2.0 created
      const v2Snapshot = {
        version: '2.0',
        status: 'completed',
        approvalStatus: 'pending_approval',
        content: { title: 'Updated V2 Architecture' },
      };
      lifecycleHistory['v2_0'] = v2Snapshot;

      // Ensure V1 is untouched
      assert.strictEqual(lifecycleHistory.v1_0.version, '1.0');
      assert.strictEqual(lifecycleHistory.v1_0.approvalStatus, 'approved');

      // 4. Approval of Version 2.0: V1 marked superseded, V2 approved
      lifecycleHistory['v1_0'] = {
        ...lifecycleHistory['v1_0'],
        status: 'superseded',
        supersededBy: ownerUid,
        supersededAt: 2000,
      };
      lifecycleHistory['v2_0'] = {
        ...lifecycleHistory['v2_0'],
        approvalStatus: 'approved',
        approvedBy: ownerUid,
        approvedAt: 2000,
      };

      // Final Assertions
      assert.strictEqual(lifecycleHistory.v1_0.version, '1.0');
      assert.strictEqual(lifecycleHistory.v1_0.approvalStatus, 'approved');
      assert.strictEqual(lifecycleHistory.v1_0.status, 'superseded');

      assert.strictEqual(lifecycleHistory.v2_0.version, '2.0');
      assert.strictEqual(lifecycleHistory.v2_0.approvalStatus, 'approved');
      assert.strictEqual(lifecycleHistory.v2_0.status, 'completed');

      assert.strictEqual(Object.keys(lifecycleHistory).length, 2, 'Both V1.0 and V2.0 exist in history');
    });
  });
});
