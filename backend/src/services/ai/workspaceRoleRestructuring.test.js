import assert from 'node:assert/strict';
import { rtdbService } from '../rtdbService.js';
import { resolveWorkspaceMembership, requireWorkspaceRole } from '../../utils/workspaceAuthHelper.js';
import { workspaceMembershipController } from '../../controllers/workspaceMembershipController.js';

console.log('🧪 Running [workspaceRoleRestructuring.test.js] — Two-Role Model (Member & Team Captain)...');

async function testWorkspaceRoleRestructuring() {
  const originalGetData = rtdbService.getData;

  try {
    // 1. Invariant: Two-Role Model membership resolution & permissions
    {
      const orgData = { orgId: 'ws_role_test', ownerId: 'user_orig_owner', name: 'Two-Role Model Workspace' };
      const membersMap = {
        user_orig_owner: { role: 'owner', email: 'owner@convia.ai' },
        user_team_captain: { role: 'team_captain', isTeamCaptain: true, email: 'captain@convia.ai' },
        user_member: { role: 'member', email: 'member@convia.ai' },
      };

      rtdbService.getData = async (path) => {
        if (path === 'organizations/ws_role_test' || path === 'workspaces/ws_role_test') {
          return orgData;
        }
        if (path.startsWith('organization_members/ws_role_test/')) {
          const uid = path.replace('organization_members/ws_role_test/', '');
          return membersMap[uid] || null;
        }
        return null;
      };

      // Original Owner
      const origOwnerAuth = await resolveWorkspaceMembership('ws_role_test', 'user_orig_owner');
      assert.equal(origOwnerAuth.isOriginalOwner, true, 'Original owner must have isOriginalOwner=true');
      assert.equal(origOwnerAuth.canManageWorkspace, true, 'Original owner must have canManageWorkspace=true');
      assert.equal(origOwnerAuth.canTransferOriginalOwnership, true, 'Original owner can transfer ownership');
      assert.equal(origOwnerAuth.role, 'owner', 'Original owner role must be "owner"');

      // Team Captain
      const captainAuth = await resolveWorkspaceMembership('ws_role_test', 'user_team_captain');
      assert.equal(captainAuth.isOriginalOwner, false, 'Team Captain is not original owner');
      assert.equal(captainAuth.isTeamCaptain, true, 'Team Captain must have isTeamCaptain=true');
      assert.equal(captainAuth.canManageWorkspace, true, 'Team Captain has owner-equivalent workspace management permissions');
      assert.equal(captainAuth.canTransferOriginalOwnership, false, 'Team Captain cannot transfer original ownership');
      assert.equal(captainAuth.role, 'team_captain', 'Team Captain role must be "team_captain"');

      // Member
      const memberAuth = await resolveWorkspaceMembership('ws_role_test', 'user_member');
      assert.equal(memberAuth.isOriginalOwner, false);
      assert.equal(memberAuth.isTeamCaptain, false);
      assert.equal(memberAuth.canManageWorkspace, false, 'Standard Member cannot manage workspace');
      assert.equal(memberAuth.role, 'member');

      console.log('  ✅ Invariant 1 Passed: Two-Role membership resolution produces correct boolean flags & authorization boundaries');
    }

    // 2. Invariant: requireWorkspaceRole authorization & original owner safeguards
    {
      // Management actions allowed for Team Captain
      const captainMgmtAuth = await requireWorkspaceRole('ws_role_test', 'user_team_captain', ['team_captain']);
      assert.equal(captainMgmtAuth.canManageWorkspace, true, 'Team Captain passed workspace management check');

      // Protected original-owner-only action rejected for Team Captain
      try {
        await requireWorkspaceRole('ws_role_test', 'user_team_captain', ['original_owner']);
        assert.fail('Team Captain should have been rejected for original_owner action');
      } catch (err) {
        assert.equal(err.code, 'ORIGINAL_OWNER_REQUIRED', 'Team Captain correctly denied original_owner action');
      }

      console.log('  ✅ Invariant 2 Passed: requireWorkspaceRole enforces Team Captain management access & Original Owner safeguards');
    }

    // 3. Invariant: Original Owner protection & assignment check
    {
      try {
        await workspaceMembershipController.updateTeamCaptainHandler(
          'user_orig_owner',
          'ws_role_test',
          'user_orig_owner',
          'assign'
        );
        assert.fail('Assigning Original Owner as Team Captain should have failed');
      } catch (err) {
        assert.equal(err.code, 'CANNOT_ASSIGN_ORIGINAL_OWNER', 'Must report CANNOT_ASSIGN_ORIGINAL_OWNER code');
      }

      console.log('  ✅ Invariant 3 Passed: Original Owner cannot be assigned as Team Captain (already owns workspace)');
    }

    console.log('🎉 [workspaceRoleRestructuring.test.js] All Two-Role model restructuring tests passed cleanly!');
  } finally {
    rtdbService.getData = originalGetData;
  }
}

testWorkspaceRoleRestructuring();
