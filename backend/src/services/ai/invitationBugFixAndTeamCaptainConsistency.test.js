import assert from 'node:assert/strict';
import { rtdbService } from '../rtdbService.js';
import { workspaceInvitationController } from '../../controllers/workspaceInvitationController.js';
import { hashInvitationCode, INVITATION_EXPIRATION_MS } from '../../utils/invitationCodeHelper.js';

console.log('🧪 Running [invitationBugFixAndTeamCaptainConsistency.test.js] — Two-Role Model...');

async function testInvitationBugFixAndTeamCaptainConsistency() {
  const originalGetData = rtdbService.getData;
  const originalUpdateData = rtdbService.updateData;

  const mockDb = {};

  const setInDb = (path, value) => {
    mockDb[path] = value;
    const parts = path.split('/');
    if (parts.length > 1) {
      const parentPath = parts.slice(0, -1).join('/');
      const childProp = parts[parts.length - 1];
      if (mockDb[parentPath] && typeof mockDb[parentPath] === 'object') {
        mockDb[parentPath][childProp] = value;
      }
    }
  };

  rtdbService.getData = async (path) => {
    return mockDb[path] ?? null;
  };

  rtdbService.updateData = async (basePath, updates) => {
    for (const [key, val] of Object.entries(updates)) {
      const fullPath = basePath ? `${basePath}/${key}` : key;
      setInDb(fullPath, val);
    }
    return true;
  };

  try {
    const wsId = 'ws_inv_fix_test';
    const inviterUid = 'user_owner';
    const inviteeEmail = 'invitee@convia.ai';
    const inviteeUid = 'user_invitee';

    // Seed Workspace
    mockDb[`organizations/${wsId}`] = {
      orgId: wsId,
      name: 'Invitation Test Workspace',
      ownerId: inviterUid,
      maxMembers: 5,
    };

    mockDb[`organization_members/${wsId}/${inviterUid}`] = {
      uid: inviterUid,
      email: 'owner@convia.ai',
      role: 'owner',
    };

    // 1. Creation, Lookup & Acceptance of Team Captain invitation in Two-Role Model
    {
      const reqMock = { user: { displayName: 'Owner' } };

      const res1 = await workspaceInvitationController.createInvitationHandler(
        wsId,
        inviterUid,
        { email: inviteeEmail, role: 'team_captain' },
        reqMock
      );
      assert.equal(res1.invitation.role, 'team_captain', 'Team Captain invitation role must be "team_captain"');
      assert.equal(res1.invitation.isSecondOwner, false, 'isSecondOwner must be false');
      assert.equal(res1.invitation.isTeamCaptain, true, 'isTeamCaptain must be true');

      const codeDisplay1 = res1.invitation.codeDisplay;

      // 2. Lookup preview metadata
      const lookup1 = await workspaceInvitationController.lookupInvitationByCodeHandler(codeDisplay1);
      assert.equal(lookup1.role, 'team_captain', 'Lookup must return role="team_captain"');
      assert.equal(lookup1.isTeamCaptain, true, 'Lookup must return isTeamCaptain=true');
      assert.equal(lookup1.status, 'pending', 'Lookup must return status="pending"');

      // 3. Acceptance executes cleanly
      const acceptRes1 = await workspaceInvitationController.acceptInvitationHandler(
        inviteeUid,
        inviteeEmail,
        codeDisplay1,
        reqMock
      );

      assert.equal(acceptRes1.success, true, 'Acceptance must succeed');

      const createdMember1 = mockDb[`organization_members/${wsId}/${inviteeUid}`];
      assert.ok(createdMember1, 'Membership record must be created');
      assert.equal(createdMember1.email, inviteeEmail, 'Member email must be set to verified userEmail');
      assert.equal(createdMember1.role, 'team_captain', 'Accepted member role must be "team_captain"');
      assert.equal(createdMember1.isTeamCaptain, true, 'isTeamCaptain must be true');

      console.log('  ✅ Invariants 1, 2 & Bug A/B/C Passed: Creation, Lookup preview & Acceptance of Team Captain invitation succeed');
    }

    // 4. Test Decline behavior preserves membership without creating records
    {
      const invitee2Email = 'invitee2@convia.ai';
      const invitee2Uid = 'user_invitee_2';
      const reqMock = { user: { displayName: 'Owner' } };

      // Create Member invitation for invitee 2
      const res2 = await workspaceInvitationController.createInvitationHandler(
        wsId,
        inviterUid,
        { email: invitee2Email, role: 'member' },
        reqMock
      );
      const codeDisplay2 = res2.invitation.codeDisplay;

      // Decline Invitation
      const declineRes = await workspaceInvitationController.declineInvitationHandler(
        invitee2Uid,
        invitee2Email,
        codeDisplay2
      );

      assert.equal(declineRes.success, true, 'Decline must return success');

      // Verify NO membership record was created
      const member2Record = mockDb[`organization_members/${wsId}/${invitee2Uid}`];
      assert.equal(member2Record, undefined, 'Declining invitation must NOT create a membership record');

      // Verify status is updated to 'declined'
      const inv2Record = mockDb[`workspace_invitations/${wsId}/${res2.invitation.invitationId}`];
      assert.equal(inv2Record.status, 'declined', 'Invitation status must be "declined"');

      // Verify attempting to accept a declined invitation fails
      try {
        await workspaceInvitationController.acceptInvitationHandler(
          invitee2Uid,
          invitee2Email,
          codeDisplay2,
          reqMock
        );
        assert.fail('Accepting a declined invitation should have failed');
      } catch (err) {
        assert.equal(err.code, 'INVITATION_DECLINED', 'Must reject acceptance of declined invitation with INVITATION_DECLINED');
      }

      console.log('  ✅ Invariant 4 & Bug D Passed: Declining updates invitation status to declined without altering workspace membership');
    }

    // 5. Test Security & Wrong Account Protection
    {
      const invitee3Email = 'invitee3@convia.ai';
      const wrongAccountEmail = 'wrong@convia.ai';
      const reqMock = { user: { displayName: 'Owner' } };

      const res3 = await workspaceInvitationController.createInvitationHandler(
        wsId,
        inviterUid,
        { email: invitee3Email, role: 'member' },
        reqMock
      );
      const codeDisplay3 = res3.invitation.codeDisplay;

      try {
        await workspaceInvitationController.acceptInvitationHandler(
          'user_wrong',
          wrongAccountEmail,
          codeDisplay3,
          reqMock
        );
        assert.fail('Wrong account acceptance should have failed');
      } catch (err) {
        assert.equal(err.code, 'WRONG_ACCOUNT', 'Must throw WRONG_ACCOUNT error when email does not match bound invitation');
      }

      console.log('  ✅ Invariant 5 Passed: Server-authoritative email binding blocks wrong-account acceptance');
    }

    console.log('🎉 [invitationBugFixAndTeamCaptainConsistency.test.js] All invitation bug fixes & Team Captain consistency tests passed cleanly!');
  } finally {
    rtdbService.getData = originalGetData;
    rtdbService.updateData = originalUpdateData;
  }
}

testInvitationBugFixAndTeamCaptainConsistency();
