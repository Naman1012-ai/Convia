import assert from 'node:assert/strict';
import { rtdbService } from '../rtdbService.js';
import { resolveWorkspaceMembership, requireWorkspaceRole } from '../../utils/workspaceAuthHelper.js';
import { workspaceMembershipController } from '../../controllers/workspaceMembershipController.js';

console.log('🧪 Running [separatedRoleManagementAndPermissions.test.js] — Separated Role Management & Security Tests...');

async function testSeparatedRoleManagementAndPermissions() {
  const originalGetData = rtdbService.getData;
  const originalUpdateData = rtdbService.updateData;

  try {
    // 1. Invariant: Ordinary role update endpoint CANNOT assign Owner
    {
      const orgData = { orgId: 'ws_sep_test', ownerId: 'user_owner', name: 'Separated Roles Workspace' };
      const membersMap = {
        user_owner: { role: 'owner', email: 'owner@convia.ai' },
        user_member: { role: 'member', email: 'member@convia.ai' },
      };

      rtdbService.getData = async (path) => {
        if (path === 'organizations/ws_sep_test' || path === 'workspaces/ws_sep_test') return orgData;
        if (path.startsWith('organization_members/ws_sep_test/')) {
          const uid = path.replace('organization_members/ws_sep_test/', '');
          return membersMap[uid] || null;
        }
        if (path === 'organization_members/ws_sep_test') return membersMap;
        return null;
      };

      try {
        await workspaceMembershipController.updateTeamCaptainHandler(
          'user_owner',
          'ws_sep_test',
          'user_owner',
          'assign'
        );
        assert.fail('Should not be able to assign team captain to original owner');
      } catch (err) {
        assert.equal(err.code, 'CANNOT_ASSIGN_ORIGINAL_OWNER');
      }

      console.log('  ✅ Invariant 1 Passed: Ordinary role updates cannot target or overwrite Owner role');
    }

    // 2. Invariant: Team Captain demotion revokes elevated management permissions
    {
      const orgData = { orgId: 'ws_sep_test', ownerId: 'user_owner', name: 'Separated Roles Workspace' };
      let membersMap = {
        user_owner: { role: 'owner', email: 'owner@convia.ai' },
        user_captain: { role: 'team_captain', isTeamCaptain: true, email: 'cap@convia.ai' },
      };

      rtdbService.getData = async (path) => {
        if (path === 'organizations/ws_sep_test' || path === 'workspaces/ws_sep_test') return orgData;
        if (path.startsWith('organization_members/ws_sep_test/')) {
          const uid = path.replace('organization_members/ws_sep_test/', '');
          return membersMap[uid] || null;
        }
        if (path === 'organization_members/ws_sep_test') return membersMap;
        return null;
      };

      // Before demotion
      const beforeAuth = await resolveWorkspaceMembership('ws_sep_test', 'user_captain');
      assert.equal(beforeAuth.canManageWorkspace, true);
      assert.equal(beforeAuth.isTeamCaptain, true);

      // Perform demotion
      rtdbService.updateData = async (path, updates) => {
        membersMap.user_captain = { role: 'member', isTeamCaptain: false, email: 'cap@convia.ai' };
        return updates;
      };

      await workspaceMembershipController.updateTeamCaptainHandler(
        'user_owner',
        'ws_sep_test',
        'user_captain',
        'remove'
      );

      // After demotion
      const afterAuth = await resolveWorkspaceMembership('ws_sep_test', 'user_captain');
      assert.equal(afterAuth.canManageWorkspace, false);
      assert.equal(afterAuth.isTeamCaptain, false);
      assert.equal(afterAuth.role, 'member');

      console.log('  ✅ Invariant 2 Passed: Team Captain demotion immediately revokes elevated management permissions');
    }

    // 3. Invariant: Unauthorized members cannot modify roles or remove members
    {
      const orgData = { orgId: 'ws_sep_test', ownerId: 'user_owner', name: 'Separated Roles Workspace' };
      const membersMap = {
        user_owner: { role: 'owner', email: 'owner@convia.ai' },
        user_member1: { role: 'member', email: 'mem1@convia.ai' },
        user_member2: { role: 'member', email: 'mem2@convia.ai' },
      };

      rtdbService.getData = async (path) => {
        if (path === 'organizations/ws_sep_test' || path === 'workspaces/ws_sep_test') return orgData;
        if (path.startsWith('organization_members/ws_sep_test/')) {
          const uid = path.replace('organization_members/ws_sep_test/', '');
          return membersMap[uid] || null;
        }
        if (path === 'organization_members/ws_sep_test') return membersMap;
        return null;
      };

      // Member trying to promote another member
      try {
        await workspaceMembershipController.updateTeamCaptainHandler(
          'user_member1',
          'ws_sep_test',
          'user_member2',
          'assign'
        );
        assert.fail('Unauthorized member promotion should have been rejected');
      } catch (err) {
        if (err.code === 'ERR_ASSERTION') throw err;
        assert.ok(err.code === 'INSUFFICIENT_ROLE' || err.statusCode === 403);
      }

      // Member trying to remove another member
      try {
        await workspaceMembershipController.removeMemberHandler(
          'user_member1',
          'ws_sep_test',
          'user_member2'
        );
        assert.fail('Unauthorized member removal should have been rejected');
      } catch (err) {
        if (err.code === 'ERR_ASSERTION') throw err;
        assert.ok(err.code === 'INSUFFICIENT_ROLE' || err.statusCode === 403);
      }

      console.log('  ✅ Invariant 3 Passed: Unauthorized API requests and non-leader actions are strictly rejected');
    }

    console.log('\n🎉 ALL SEPARATED ROLE MANAGEMENT & SECURITY TESTS PASSED PERFECTLY!\n');
  } finally {
    rtdbService.getData = originalGetData;
    rtdbService.updateData = originalUpdateData;
  }
}

testSeparatedRoleManagementAndPermissions().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
