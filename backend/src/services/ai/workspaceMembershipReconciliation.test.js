import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  countUniqueActiveMembers,
  getActiveWorkspaceMemberCount,
  reconcileWorkspaceMemberCount,
  requireWorkspaceMember,
} from '../../utils/workspaceAuthHelper.js';
import { workspaceMembershipController } from '../../controllers/workspaceMembershipController.js';
import { workspaceInvitationController } from '../../controllers/workspaceInvitationController.js';
import { rtdbService } from '../../services/rtdbService.js';
import { generateInvitationCode, hashInvitationCode } from '../../utils/invitationCodeHelper.js';

describe('🧩 CONVIA PHASE 2A — WORKSPACE MEMBERSHIP COUNT INTEGRITY & RECONCILIATION', () => {
  // Test Identities
  const userOwner = { uid: 'uid_owner_101', email: 'owner@convia.dev', displayName: 'Owner One' };
  const userMember1 = { uid: 'uid_member_102', email: 'member1@convia.dev', displayName: 'Member One' };
  const userMember2 = { uid: 'uid_member_103', email: 'member2@convia.dev', displayName: 'Member Two' };
  const userAttacker = { uid: 'uid_attacker_999', email: 'attacker@evil.dev', displayName: 'Attacker' };

  let mockDb = {};

  const setupMockDb = () => {
    mockDb = {
      organizations: {
        org_biolynk: {
          orgId: 'org_biolynk',
          name: 'BioLynk',
          ownerId: userOwner.uid,
          createdBy: userOwner.uid,
          maxMembers: 2,
          teamSizeLimit: 2,
          memberCount: 2, // Historically stale counter
        },
        org_psycho: {
          orgId: 'org_psycho',
          name: 'Psycho',
          ownerId: userOwner.uid,
          createdBy: userOwner.uid,
          maxMembers: 2,
          teamSizeLimit: 2,
          memberCount: 3, // Historically inflated counter
        },
      },
      organization_members: {
        org_biolynk: {
          [userOwner.uid]: { uid: userOwner.uid, role: 'owner', joinedAt: 1000 },
        },
        org_psycho: {
          [userOwner.uid]: { uid: userOwner.uid, role: 'owner', joinedAt: 1000 },
          [userMember1.uid]: { uid: userMember1.uid, role: 'member', joinedAt: 2000 },
        },
      },
      users: {
        [userOwner.uid]: { ...userOwner, organizationId: 'org_biolynk' },
        [userMember1.uid]: { ...userMember1, organizationId: 'org_psycho' },
        [userMember2.uid]: { ...userMember2, organizationId: null },
      },
      workspace_invitations: {},
      invitation_codes: {},
    };
  };

  beforeEach(() => {
    setupMockDb();

    // Mock RTDB service in-memory operations
    rtdbService.getData = async (path) => {
      const cleanPath = String(path || '').replace(/^\/+|\/+$/g, '');
      if (!cleanPath) return mockDb;
      const parts = cleanPath.split('/');
      let curr = mockDb;
      for (const p of parts) {
        if (!curr || typeof curr !== 'object') return null;
        curr = curr[p];
      }
      return curr !== undefined ? JSON.parse(JSON.stringify(curr)) : null;
    };

    rtdbService.setData = async (path, value) => {
      const cleanPath = String(path || '').replace(/^\/+|\/+$/g, '');
      const parts = cleanPath.split('/');
      let curr = mockDb;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!curr[parts[i]]) curr[parts[i]] = {};
        curr = curr[parts[i]];
      }
      const lastKey = parts[parts.length - 1];
      if (value === null || value === undefined) {
        delete curr[lastKey];
      } else {
        curr[lastKey] = JSON.parse(JSON.stringify(value));
      }
    };

    rtdbService.updateData = async (path, updates) => {
      const cleanPath = String(path || '').replace(/^\/+|\/+$/g, '');
      if (!cleanPath) {
        for (const [k, v] of Object.entries(updates)) {
          await rtdbService.setData(k, v);
        }
        return;
      }
      const current = (await rtdbService.getData(cleanPath)) || {};
      const merged = { ...current, ...updates };
      await rtdbService.setData(cleanPath, merged);
    };
  });

  // =========================================================================
  // SECTION 22 & 23: CANONICAL ACTIVE MEMBER COUNTING & CARD INTEGRITY
  // =========================================================================

  describe('1. Canonical Active Member Counting Function & Uniqueness', () => {
    it('CASE 1: 1 owner only → canonical count is exactly 1', () => {
      const members = {
        [userOwner.uid]: { uid: userOwner.uid, role: 'owner' },
      };
      assert.strictEqual(countUniqueActiveMembers(members), 1);
    });

    it('CASE 2: 1 owner + 1 member → canonical count is exactly 2', () => {
      const members = {
        [userOwner.uid]: { uid: userOwner.uid, role: 'owner' },
        [userMember1.uid]: { uid: userMember1.uid, role: 'member' },
      };
      assert.strictEqual(countUniqueActiveMembers(members), 2);
    });

    it('CASE 9: Filters out inactive, removed, and soft-deleted member records', () => {
      const members = {
        [userOwner.uid]: { uid: userOwner.uid, role: 'owner' },
        [userMember1.uid]: { uid: userMember1.uid, role: 'member', status: 'inactive' },
        [userMember2.uid]: { uid: userMember2.uid, role: 'member', status: 'removed' },
        uid_deleted: { uid: 'uid_deleted', role: 'member', isDeleted: true },
      };
      assert.strictEqual(countUniqueActiveMembers(members), 1, 'Only active members must be counted');
    });

    it('guarantees unique counting (Set of UIDs) even if duplicate records exist', () => {
      const members = {
        key_1: { uid: userOwner.uid, role: 'owner' },
        key_2: { uid: userOwner.uid, role: 'owner' }, // duplicate entry for owner
        key_3: { uid: userMember1.uid, role: 'member' },
      };
      assert.strictEqual(countUniqueActiveMembers(members), 2);
    });
  });

  describe('2. Specific Regressions: BioLynk & Psycho Workspaces', () => {
    it('BioLynk Regression: 1 active member with maxMembers = 2 must display 1 / 2, NOT 2 / 2', async () => {
      // BioLynk currently has only 1 active member (owner) in organization_members, but stored count was 2
      const activeCount = await getActiveWorkspaceMemberCount('org_biolynk');
      const maxMembers = mockDb.organizations.org_biolynk.maxMembers;
      assert.strictEqual(activeCount, 1, 'BioLynk active count must be 1');
      assert.strictEqual(`${activeCount} / ${maxMembers} members`, '1 / 2 members');

      // Reconcile database stored count
      const reconciliation = await reconcileWorkspaceMemberCount('org_biolynk');
      assert.strictEqual(reconciliation.canonicalCount, 1);
      assert.strictEqual(reconciliation.previousCount, 2);
      assert.strictEqual(reconciliation.updated, true);
      assert.strictEqual(mockDb.organizations.org_biolynk.memberCount, 1, 'Stored count must now be 1');
    });

    it('Psycho Regression: 2 active members with maxMembers = 2 must display 2 / 2, NEVER 3 / 2', async () => {
      // Psycho currently has 2 active members in organization_members, but stored count was 3
      const activeCount = await getActiveWorkspaceMemberCount('org_psycho');
      const maxMembers = mockDb.organizations.org_psycho.maxMembers;
      assert.strictEqual(activeCount, 2, 'Psycho active count must be 2');
      assert.strictEqual(`${activeCount} / ${maxMembers} members`, '2 / 2 members');
      assert.notStrictEqual(`${activeCount} / ${maxMembers} members`, '3 / 2 members');

      // Reconcile database stored count
      const reconciliation = await reconcileWorkspaceMemberCount('org_psycho');
      assert.strictEqual(reconciliation.canonicalCount, 2);
      assert.strictEqual(reconciliation.previousCount, 3);
      assert.strictEqual(reconciliation.updated, true);
      assert.strictEqual(mockDb.organizations.org_psycho.memberCount, 2, 'Stored count must now be 2');
    });
  });

  describe('3. Authoritative Leave Workspace Flow (Server-Side)', () => {
    it('CASE 3: Member leaves → membership removed and canonical count decrements to 1', async () => {
      // userMember1 leaves org_psycho (started with 2 members)
      const res = await workspaceMembershipController.leaveWorkspaceHandler(
        userMember1.uid,
        'org_psycho',
        { user: userMember1 }
      );

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.memberCount, 1);
      assert.strictEqual(mockDb.organization_members.org_psycho[userMember1.uid], undefined);
      assert.strictEqual(!mockDb.users[userMember1.uid].organizationId, true, 'User organizationId must be cleared');
    });

    it('CASE 11 & 12: Leaving user loses active workspace list entry; owner remains visible', async () => {
      // userMember1 leaves org_psycho
      await workspaceMembershipController.leaveWorkspaceHandler(userMember1.uid, 'org_psycho');

      // Simulate client getUserOrganizations logic for both users
      const getActiveOrgsForUser = (uid) => {
        const orgs = [];
        for (const [orgId, orgData] of Object.entries(mockDb.organizations)) {
          const orgMembers = mockDb.organization_members[orgId] || {};
          const isOwner = orgData.ownerId === uid;
          const isMember = Boolean(orgMembers[uid]);
          if (!isOwner && !isMember) continue;
          orgs.push({
            ...orgData,
            memberCount: countUniqueActiveMembers(orgMembers),
            isMember: true,
          });
        }
        return orgs;
      };

      const memberOrgs = getActiveOrgsForUser(userMember1.uid);
      const ownerOrgs = getActiveOrgsForUser(userOwner.uid);

      assert.strictEqual(
        memberOrgs.some((o) => o.orgId === 'org_psycho'),
        false,
        'CASE 11: Left workspace must NOT appear in member active list'
      );

      const ownerPsycho = ownerOrgs.find((o) => o.orgId === 'org_psycho');
      assert.ok(ownerPsycho, 'CASE 12: Owner must still see workspace');
      assert.strictEqual(ownerPsycho.memberCount, 1, 'Owner sees updated count 1 / 2');
    });

    it('CASE 4: Owner removes member → membership removed and canonical count decreases by 1', async () => {
      const res = await workspaceMembershipController.removeMemberHandler(
        userOwner.uid,
        'org_psycho',
        userMember1.uid,
        { user: userOwner }
      );

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.memberCount, 1);
      assert.strictEqual(mockDb.organization_members.org_psycho[userMember1.uid], undefined);
      assert.strictEqual(mockDb.organizations.org_psycho.memberCount, 1);
    });

    it('prevents non-owner/non-admin from removing another member', async () => {
      await assert.rejects(
        async () => {
          await workspaceMembershipController.removeMemberHandler(
            userMember1.uid,
            'org_psycho',
            userOwner.uid
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 403);
          return true;
        }
      );
    });

    it('prevents removing the workspace owner', async () => {
      // Make userMember1 an admin first
      mockDb.organization_members.org_psycho[userMember1.uid].role = 'admin';

      await assert.rejects(
        async () => {
          await workspaceMembershipController.removeMemberHandler(
            userMember1.uid,
            'org_psycho',
            userOwner.uid
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'CANNOT_REMOVE_OWNER');
          return true;
        }
      );
    });

    it('Owner Leave Restriction: Owner cannot leave while other members exist', async () => {
      await assert.rejects(
        async () => {
          await workspaceMembershipController.leaveWorkspaceHandler(userOwner.uid, 'org_psycho');
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'OWNER_CANNOT_LEAVE_WITH_MEMBERS');
          assert.match(err.message, /remove members or transfer ownership/i);
          return true;
        }
      );
    });

    it('Owner Leave Restriction: Sole owner must delete/archive rather than leaving', async () => {
      // BioLynk has only owner
      await assert.rejects(
        async () => {
          await workspaceMembershipController.leaveWorkspaceHandler(userOwner.uid, 'org_biolynk');
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'OWNER_CANNOT_LEAVE');
          assert.match(err.message, /transfer ownership or delete/i);
          return true;
        }
      );
    });
  });

  describe('4. Authoritative Join & Capacity Integration (Section 12 & 13)', () => {
    it('CASE 5 & 14: New member joins via invitation → count increases exactly once', async () => {
      // Create pending invitation for userMember2 on org_biolynk (current active count: 1, max: 2)
      const rawCode = generateInvitationCode();
      const codeHash = hashInvitationCode(rawCode);
      const invId = 'inv_test_join';

      mockDb.workspace_invitations.org_biolynk = {
        [invId]: {
          invitationId: invId,
          workspaceId: 'org_biolynk',
          invitedEmail: userMember2.email,
          role: 'member',
          codeHash,
          status: 'pending',
          expiresAt: Date.now() + 300000,
        },
      };
      mockDb.invitation_codes[codeHash] = {
        codeHash,
        workspaceId: 'org_biolynk',
        invitationId: invId,
        status: 'pending',
      };

      const res = await workspaceInvitationController.acceptInvitationHandler(
        userMember2.uid,
        userMember2.email,
        rawCode
      );

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.memberCount, 2);
      assert.ok(mockDb.organization_members.org_biolynk[userMember2.uid]);
      assert.strictEqual(mockDb.organizations.org_biolynk.memberCount, 2);
    });

    it('CASE 6: Same user joining twice → idempotent, count does NOT increment twice', async () => {
      // userMember1 is already a member of org_psycho
      const rawCode = generateInvitationCode();
      const codeHash = hashInvitationCode(rawCode);
      const invId = 'inv_test_dup';

      mockDb.workspace_invitations.org_psycho = {
        [invId]: {
          invitationId: invId,
          workspaceId: 'org_psycho',
          invitedEmail: userMember1.email,
          role: 'member',
          codeHash,
          status: 'pending',
          expiresAt: Date.now() + 300000,
        },
      };
      mockDb.invitation_codes[codeHash] = {
        codeHash,
        workspaceId: 'org_psycho',
        invitationId: invId,
        status: 'pending',
      };

      const initialStored = mockDb.organizations.org_psycho.memberCount;
      const res = await workspaceInvitationController.acceptInvitationHandler(
        userMember1.uid,
        userMember1.email,
        rawCode
      );

      assert.strictEqual(res.alreadyMember, true);
      assert.strictEqual(
        countUniqueActiveMembers(mockDb.organization_members.org_psycho),
        2,
        'Member count must remain 2'
      );
    });

    it('CASE 7: Capacity Enforcement — Workspace at capacity (2 / 2) rejects new joiners', async () => {
      // org_psycho has 2 active members (owner + member1) and maxMembers = 2
      const rawCode = generateInvitationCode();
      const codeHash = hashInvitationCode(rawCode);
      const invId = 'inv_test_cap';

      mockDb.workspace_invitations.org_psycho = {
        [invId]: {
          invitationId: invId,
          workspaceId: 'org_psycho',
          invitedEmail: userMember2.email,
          role: 'member',
          codeHash,
          status: 'pending',
          expiresAt: Date.now() + 300000,
        },
      };
      mockDb.invitation_codes[codeHash] = {
        codeHash,
        workspaceId: 'org_psycho',
        invitationId: invId,
        status: 'pending',
      };

      await assert.rejects(
        async () => {
          await workspaceInvitationController.acceptInvitationHandler(
            userMember2.uid,
            userMember2.email,
            rawCode
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'WORKSPACE_FULL');
          assert.strictEqual(err.message, 'This workspace has reached its member limit.');
          return true;
        }
      );
    });

    it('CASE 13: Removed member cannot access protected workspace resources', async () => {
      // Remove member1 from org_psycho
      await workspaceMembershipController.removeMemberHandler(userOwner.uid, 'org_psycho', userMember1.uid);

      await assert.rejects(
        async () => {
          await requireWorkspaceMember('org_psycho', userMember1.uid);
        },
        (err) => {
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.code, 'FORBIDDEN_NOT_WORKSPACE_MEMBER');
          return true;
        }
      );
    });

    it('CASE 15: Invalid invitation code does not change membership count', async () => {
      const initialCount = countUniqueActiveMembers(mockDb.organization_members.org_biolynk);

      await assert.rejects(
        async () => {
          await workspaceInvitationController.acceptInvitationHandler(
            userMember2.uid,
            userMember2.email,
            'CNV-FAKE-CODE'
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 404);
          return true;
        }
      );

      assert.strictEqual(
        countUniqueActiveMembers(mockDb.organization_members.org_biolynk),
        initialCount,
        'Count must be unchanged'
      );
    });
  });

  describe('5. Multi-Card Consistency & UI Integrity (CASE 8 & 10)', () => {
    it('CASE 8 & 10: Multiple cards derive counts consistently from authoritative active data', async () => {
      // Both org_biolynk and org_psycho cards derive counts from the exact same function
      const biolynkCount = await getActiveWorkspaceMemberCount('org_biolynk');
      const psychoCount = await getActiveWorkspaceMemberCount('org_psycho');

      assert.strictEqual(biolynkCount, 1);
      assert.strictEqual(psychoCount, 2);

      const renderCardString = (orgId) => {
        const org = mockDb.organizations[orgId];
        const active = countUniqueActiveMembers(mockDb.organization_members[orgId]);
        return `${active} / ${org.maxMembers} members`;
      };

      assert.strictEqual(renderCardString('org_biolynk'), '1 / 2 members');
      assert.strictEqual(renderCardString('org_psycho'), '2 / 2 members');
    });
  });
});
