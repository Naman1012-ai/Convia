import assert from 'node:assert/strict';
import { rtdbService } from '../rtdbService.js';
import { resolveWorkspaceMembership, requireWorkspaceRole } from '../../utils/workspaceAuthHelper.js';
import { workspaceMembershipController } from '../../controllers/workspaceMembershipController.js';

console.log('🧪 Running [threeRoleOwnershipTransfer.test.js] — 3-Role Membership & Ownership Transfer...');

async function testThreeRoleOwnershipTransfer() {
  const originalGetData = rtdbService.getData;
  const originalUpdateData = rtdbService.updateData;

  try {
    // 1. Invariant: 3-Role membership resolution & permission boundaries
    {
      const orgData = { orgId: 'ws_3role_test', ownerId: 'user_owner', createdBy: 'user_owner', name: '3-Role Workspace' };
      const membersMap = {
        user_owner: { role: 'owner', email: 'owner@convia.ai' },
        user_captain1: { role: 'team_captain', isTeamCaptain: true, email: 'cap1@convia.ai' },
        user_captain2: { role: 'team_captain', isTeamCaptain: true, email: 'cap2@convia.ai' },
        user_member1: { role: 'member', email: 'mem1@convia.ai' },
      };

      rtdbService.getData = async (path) => {
        if (path === 'organizations/ws_3role_test' || path === 'workspaces/ws_3role_test') {
          return orgData;
        }
        if (path.startsWith('organization_members/ws_3role_test/')) {
          const uid = path.replace('organization_members/ws_3role_test/', '');
          return membersMap[uid] || null;
        }
        if (path === 'organization_members/ws_3role_test') {
          return membersMap;
        }
        return null;
      };

      // Owner check
      const ownerAuth = await resolveWorkspaceMembership('ws_3role_test', 'user_owner');
      assert.equal(ownerAuth.role, 'owner');
      assert.equal(ownerAuth.isOwner, true);
      assert.equal(ownerAuth.canTransferOwnership, true);
      assert.equal(ownerAuth.canManageWorkspace, true);

      // Captain check
      const captainAuth = await resolveWorkspaceMembership('ws_3role_test', 'user_captain1');
      assert.equal(captainAuth.role, 'team_captain');
      assert.equal(captainAuth.isTeamCaptain, true);
      assert.equal(captainAuth.canTransferOwnership, false);
      assert.equal(captainAuth.canManageWorkspace, true);

      // Member check
      const memberAuth = await resolveWorkspaceMembership('ws_3role_test', 'user_member1');
      assert.equal(memberAuth.role, 'member');
      assert.equal(memberAuth.isTeamCaptain, false);
      assert.equal(memberAuth.canTransferOwnership, false);
      assert.equal(memberAuth.canManageWorkspace, false);

      console.log('  ✅ Invariant 1 Passed: 3-Role membership resolution produces accurate role, flags, and permissions');
    }

    // 2. Invariant: Team Captain capacity limit enforcement (Max 2 Team Captains)
    {
      const orgData = { orgId: 'ws_3role_test', ownerId: 'user_owner', name: '3-Role Workspace' };
      const membersMap = {
        user_owner: { role: 'owner', email: 'owner@convia.ai' },
        user_captain1: { role: 'team_captain', isTeamCaptain: true, email: 'cap1@convia.ai' },
        user_captain2: { role: 'team_captain', isTeamCaptain: true, email: 'cap2@convia.ai' },
        user_member1: { role: 'member', email: 'mem1@convia.ai' },
      };

      rtdbService.getData = async (path) => {
        if (path === 'organizations/ws_3role_test' || path === 'workspaces/ws_3role_test') return orgData;
        if (path.startsWith('organization_members/ws_3role_test/')) {
          const uid = path.replace('organization_members/ws_3role_test/', '');
          return membersMap[uid] || null;
        }
        if (path === 'organization_members/ws_3role_test') return membersMap;
        return null;
      };

      // Attempting to assign 3rd Team Captain should throw 409 TEAM_CAPTAIN_LIMIT_EXCEEDED
      try {
        await workspaceMembershipController.updateTeamCaptainHandler(
          'user_owner',
          'ws_3role_test',
          'user_member1',
          'assign'
        );
        assert.fail('Should have failed to assign 3rd Team Captain');
      } catch (err) {
        assert.equal(err.statusCode || err.status, 409);
        assert.equal(err.code, 'TEAM_CAPTAIN_LIMIT_EXCEEDED');
      }

      console.log('  ✅ Invariant 2 Passed: Rejecting 3rd Team Captain assignment with 409 TEAM_CAPTAIN_LIMIT_EXCEEDED');
    }

    // 3. Invariant: Atomic Ownership Transfer & Former Owner Role Selection
    {
      const orgData = { orgId: 'ws_3role_test', ownerId: 'user_owner', createdBy: 'user_owner', name: '3-Role Workspace' };
      const membersMap = {
        user_owner: { role: 'owner', email: 'owner@convia.ai' },
        user_captain1: { role: 'team_captain', isTeamCaptain: true, email: 'cap1@convia.ai' },
        user_member1: { role: 'member', email: 'mem1@convia.ai' },
      };

      let writtenUpdates = null;

      rtdbService.getData = async (path) => {
        if (path === 'organizations/ws_3role_test' || path === 'workspaces/ws_3role_test') return orgData;
        if (path.startsWith('organization_members/ws_3role_test/')) {
          const uid = path.replace('organization_members/ws_3role_test/', '');
          return membersMap[uid] || null;
        }
        if (path === 'organization_members/ws_3role_test') return membersMap;
        return null;
      };

      rtdbService.updateData = async (path, updates) => {
        writtenUpdates = updates;
        return updates;
      };

      // Non-owner transfer attempt must be rejected
      try {
        await workspaceMembershipController.transferOwnershipHandler(
          'user_captain1',
          'ws_3role_test',
          'user_member1',
          'team_captain'
        );
        assert.fail('Non-owner transfer should have been rejected');
      } catch (err) {
        assert.ok(
          err.code === 'ONLY_OWNER_CAN_TRANSFER' || err.code === 'ORIGINAL_OWNER_REQUIRED',
          `Unexpected error code: ${err.code}`
        );
      }

      // Valid Owner transfer where recipient is user_member1 and former owner becomes team_captain
      const result = await workspaceMembershipController.transferOwnershipHandler(
        'user_owner',
        'ws_3role_test',
        'user_member1',
        'team_captain'
      );

      assert.equal(result.success, true);
      assert.equal(result.newOwnerUid, 'user_member1');
      assert.equal(result.formerOwnerRole, 'team_captain');

      assert.ok(writtenUpdates, 'Updates must be dispatched to RTDB');
      assert.equal(writtenUpdates['organizations/ws_3role_test/ownerId'], 'user_member1');
      assert.equal(writtenUpdates['organization_members/ws_3role_test/user_member1']?.role, 'owner');
      assert.equal(writtenUpdates['organization_members/ws_3role_test/user_owner']?.role, 'team_captain');
      assert.equal(writtenUpdates['organization_members/ws_3role_test/user_owner']?.isTeamCaptain, true);

      console.log('  ✅ Invariant 3 Passed: Atomic ownership transfer correctly updates recipient, former owner, and RTDB');
    }

    console.log('\n🎉 ALL 3-ROLE MEMBERSHIP & OWNERSHIP TRANSFER TESTS PASSED PERFECTLY!\n');
  } finally {
    rtdbService.getData = originalGetData;
    rtdbService.updateData = originalUpdateData;
  }
}

testThreeRoleOwnershipTransfer().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
