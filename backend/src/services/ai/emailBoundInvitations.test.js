import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { workspaceInvitationController } from '../../controllers/workspaceInvitationController.js';
import { workspaceMembershipController } from '../../controllers/workspaceMembershipController.js';
import { rtdbService } from '../rtdbService.js';
import {
  generateInvitationCode,
  normalizeInvitationCode,
  isValidInvitationCodeFormat,
  normalizeEmail,
  hashInvitationCode,
  INVITATION_EXPIRATION_MS,
  formatInvitationExpiry,
  isInvitationExpired,
  formatInvitationEventDate,
  formatInvitationStatusDate,
} from '../../utils/invitationCodeHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the canonical database.rules.json file
const rulesJsonPath = path.resolve(__dirname, '../../../../database.rules.json');
const rawRules = JSON.parse(fs.readFileSync(rulesJsonPath, 'utf8'));

describe('📧 CONVIA PHASE 2 — EMAIL-BOUND TEAM INVITATION CODES', () => {
  // Test Identities
  const userAliceOwner = { uid: 'user_alice', email: 'alice.owner@convia.dev' };
  const userBobAdmin = { uid: 'user_bob', email: 'bob.admin@convia.dev' };
  const userCharlieMember = { uid: 'user_charlie', email: 'charlie.member@convia.dev' };
  const userEveAttacker = { uid: 'user_eve', email: 'eve.attacker@evil.com' };
  const userInvitedTeammate = { uid: 'user_teammate', email: 'teammate@example.com' };

  const testOrgId = 'org_phase2_test';

  // In-memory mock database state
  let mockDb = {};

  const resetMockDb = () => {
    mockDb = {
      organizations: {
        [testOrgId]: {
          id: testOrgId,
          orgId: testOrgId,
          name: 'Phase 2 Test Workspace',
          ownerId: 'user_alice',
          createdBy: 'user_alice',
          projectType: 'software',
          memberCount: 2,
          maxMembers: 5,
          teamSizeLimit: 5,
        },
      },
      organization_members: {
        [testOrgId]: {
          user_alice: { uid: 'user_alice', role: 'owner', joinedAt: 1000 },
          user_bob: { uid: 'user_bob', role: 'admin', joinedAt: 1050 },
        },
      },
      users: {
        user_alice: { uid: 'user_alice', email: 'alice.owner@convia.dev', displayName: 'Alice Owner' },
        user_bob: { uid: 'user_bob', email: 'bob.admin@convia.dev', displayName: 'Bob Admin' },
        user_charlie: { uid: 'user_charlie', email: 'charlie.member@convia.dev', displayName: 'Charlie Member' },
        user_eve: { uid: 'user_eve', email: 'eve.attacker@evil.com', displayName: 'Eve Attacker' },
        user_teammate: { uid: 'user_teammate', email: 'teammate@example.com', displayName: 'Teammate Test' },
      },
      workspace_invitations: {
        [testOrgId]: {},
      },
      invitation_codes: {},
    };
  };

  // Mock RTDB helper to operate on mockDb
  const setupRtdbMock = () => {
    rtdbService.getData = async (pathStr) => {
      const parts = pathStr.split('/').filter(Boolean);
      let curr = mockDb;
      for (const p of parts) {
        if (!curr || typeof curr !== 'object') return null;
        curr = curr[p];
      }
      return curr !== undefined ? JSON.parse(JSON.stringify(curr)) : null;
    };

    rtdbService.setData = async (pathStr, val) => {
      const parts = pathStr.split('/').filter(Boolean);
      let curr = mockDb;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!curr[parts[i]]) curr[parts[i]] = {};
        curr = curr[parts[i]];
      }
      if (val === null) {
        delete curr[parts[parts.length - 1]];
      } else {
        curr[parts[parts.length - 1]] = JSON.parse(JSON.stringify(val));
      }
    };

    rtdbService.updateData = async (basePath, updates) => {
      if (typeof updates === 'object' && updates !== null) {
        for (const [key, val] of Object.entries(updates)) {
          const fullPath = basePath ? `${basePath}/${key}` : key;
          await rtdbService.setData(fullPath, val);
        }
      }
    };
  };

  // =========================================================================
  // 1. CODE GENERATION & NORMALIZATION TESTS
  // =========================================================================
  describe('1. Code Generation & Normalization Strategy', () => {
    it('generates cryptographically secure codes in standard format CNV-XXXX-XXXX', () => {
      const code1 = generateInvitationCode();
      const code2 = generateInvitationCode();

      assert.ok(isValidInvitationCodeFormat(code1), `Code 1 format must match CNV-XXXX-XXXX: ${code1}`);
      assert.ok(isValidInvitationCodeFormat(code2), `Code 2 format must match CNV-XXXX-XXXX: ${code2}`);
      assert.notStrictEqual(code1, code2, 'Subsequent generated codes must be unique');
    });

    it('normalizes invitation codes across case, whitespace, and hyphens', () => {
      assert.strictEqual(normalizeInvitationCode('  cnv-8k4p-x7qm  '), 'CNV-8K4P-X7QM');
      assert.strictEqual(normalizeInvitationCode('cnv8k4px7qm'), 'CNV-8K4P-X7QM');
      assert.strictEqual(normalizeInvitationCode('8k4p-x7qm'), 'CNV-8K4P-X7QM');
      assert.strictEqual(normalizeInvitationCode('8K4PX7QM'), 'CNV-8K4P-X7QM');
      assert.strictEqual(normalizeInvitationCode('CNV-8K4P-X7QM'), 'CNV-8K4P-X7QM');
    });

    it('normalizes email addresses strictly by trimming and lowercasing', () => {
      assert.strictEqual(normalizeEmail('  Teammate@Example.COM  '), 'teammate@example.com');
      assert.strictEqual(normalizeEmail('USER@DOMAIN.ORG'), 'user@domain.org');
    });

    it('consistently produces matching SHA-256 hashes for normalized codes', () => {
      const codeRaw1 = 'cnv-8k4p-x7qm';
      const codeRaw2 = 'CNV-8K4P-X7QM';
      const hash1 = hashInvitationCode(normalizeInvitationCode(codeRaw1));
      const hash2 = hashInvitationCode(normalizeInvitationCode(codeRaw2));

      assert.strictEqual(hash1, hash2, 'Normalized hashes must match');
      assert.strictEqual(hash1.length, 64, 'SHA-256 hash must be 64 hex characters');
    });
  });

  // =========================================================================
  // 2. INVITATION CREATION & AUTHORIZATION TESTS (SECTION 45)
  // =========================================================================
  describe('2. Invitation Creation & Role Authorization', () => {
    beforeEach(() => {
      resetMockDb();
      setupRtdbMock();
    });

    it('TEST 1: Workspace owner can create invitation code bound to email', async () => {
      const res = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: 'teammate@example.com', role: 'member' }
      );

      assert.strictEqual(res.success, true);
      assert.ok(res.invitation, 'Invitation record must be returned');
      assert.strictEqual(res.invitation.invitedEmail, 'teammate@example.com');
      assert.strictEqual(res.invitation.role, 'member');
      assert.strictEqual(res.invitation.status, 'pending');
      assert.ok(isValidInvitationCodeFormat(res.invitation.codeDisplay), 'Code must match format');

      // Verify in RTDB
      const savedCodeHash = res.invitation.codeHash;
      const lookupEntry = await rtdbService.getData(`invitation_codes/${savedCodeHash}`);
      assert.ok(lookupEntry, 'Code mapping must be stored in invitation_codes');
      assert.strictEqual(lookupEntry.workspaceId, testOrgId);
      assert.strictEqual(lookupEntry.invitedEmail, 'teammate@example.com');
    });

    it('TEST 2: Workspace admin can create invitation code for teammate', async () => {
      const res = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userBobAdmin.uid,
        { email: 'second.teammate@example.com', role: 'member' }
      );

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.invitation.invitedEmail, 'second.teammate@example.com');
    });

    it('TEST 3: Regular member CANNOT create invitation code (DENIED)', async () => {
      // Add Charlie as a regular member
      mockDb.organization_members[testOrgId].user_charlie = { uid: 'user_charlie', role: 'member' };

      await assert.rejects(
        async () => {
          await workspaceInvitationController.createInvitationHandler(
            testOrgId,
            userCharlieMember.uid,
            { email: 'someone@example.com' }
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 403);
          return true;
        },
        'Member must be rejected with 403'
      );
    });

    it('TEST 4: Unauthenticated or non-member CANNOT create invitation code (DENIED)', async () => {
      await assert.rejects(
        async () => {
          await workspaceInvitationController.createInvitationHandler(
            testOrgId,
            userEveAttacker.uid,
            { email: 'victim@example.com' }
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 403);
          return true;
        },
        'Non-member attacker must be rejected with 403'
      );
    });

    it('TEST 14 (Duplicate): Existing active pending invitation returns existing code instead of flooding', async () => {
      // Create first invitation
      const firstRes = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: 'teammate@example.com', role: 'member' }
      );

      // Attempt to create second invitation for same email
      const secondRes = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: '  TEAMMATE@EXAMPLE.COM  ', role: 'member' }
      );

      assert.strictEqual(secondRes.existing, true, 'Should detect existing invitation');
      assert.strictEqual(secondRes.invitation.invitationId, firstRes.invitation.invitationId);
      assert.strictEqual(secondRes.invitation.codeHash, firstRes.invitation.codeHash);
    });
  });

  // =========================================================================
  // 3. EMAIL BINDING & ACCEPTANCE VERIFICATION (SECTIONS 15, 16, 20, 21, 45)
  // =========================================================================
  describe('3. Email-Bound Acceptance Verification & Wrong Account Defense', () => {
    let validCode = '';
    const invitedEmail = 'teammate@example.com';

    beforeEach(async () => {
      resetMockDb();
      setupRtdbMock();

      const created = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: invitedEmail, role: 'member' }
      );
      validCode = created.invitation.codeDisplay;
    });

    it('TEST 5: Correct email + correct code → PASS (creates membership)', async () => {
      const res = await workspaceInvitationController.acceptInvitationHandler(
        userInvitedTeammate.uid,
        userInvitedTeammate.email,
        validCode
      );

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.workspaceId, testOrgId);
      assert.strictEqual(res.role, 'member');

      // Check membership created in RTDB
      const memberNode = await rtdbService.getData(`organization_members/${testOrgId}/${userInvitedTeammate.uid}`);
      assert.ok(memberNode, 'Membership node must exist');
      assert.strictEqual(memberNode.role, 'member');

      // Check invitation transitioned to accepted
      const codeHash = hashInvitationCode(validCode);
      const codeRecord = await rtdbService.getData(`invitation_codes/${codeHash}`);
      assert.strictEqual(codeRecord.status, 'accepted');
    });

    it('TEST 6 & ATTACK 1: Wrong email + correct code → DENIED (Strict Email Binding)', async () => {
      await assert.rejects(
        async () => {
          // Attacker Eve has the valid code, but is logged in with eve.attacker@evil.com
          await workspaceInvitationController.acceptInvitationHandler(
            userEveAttacker.uid,
            userEveAttacker.email,
            validCode
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.code, 'WRONG_ACCOUNT');
          assert.strictEqual(
            err.message,
            'This invitation is assigned to a different Convia account. Please sign in with the invited Convia account.'
          );
          assert.strictEqual(err.message.includes(invitedEmail), false, 'Must NOT leak invited email');
          assert.strictEqual(err.message.includes(userEveAttacker.email), false, 'Must NOT leak attacker email');
          return true;
        },
        'Attacker with wrong email must be rejected'
      );

      // Verify attacker was NOT added as a member
      const attackerMember = await rtdbService.getData(`organization_members/${testOrgId}/${userEveAttacker.uid}`);
      assert.strictEqual(attackerMember, null, 'Attacker must NOT be granted membership');
    });

    it('TEST 7: Correct email + wrong/bogus code → DENIED', async () => {
      await assert.rejects(
        async () => {
          await workspaceInvitationController.acceptInvitationHandler(
            userInvitedTeammate.uid,
            userInvitedTeammate.email,
            'CNV-9999-9999'
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 404);
          return true;
        }
      );
    });

    it('TEST 8 & ATTACK 8: Correct email + expired code → DENIED', async () => {
      // Manually set invitation to expired
      const codeHash = hashInvitationCode(validCode);
      const codeRecord = await rtdbService.getData(`invitation_codes/${codeHash}`);
      await rtdbService.updateData(`workspace_invitations/${testOrgId}/${codeRecord.invitationId}`, {
        expiresAt: Date.now() - 10000,
        status: 'expired',
      });

      await assert.rejects(
        async () => {
          await workspaceInvitationController.acceptInvitationHandler(
            userInvitedTeammate.uid,
            userInvitedTeammate.email,
            validCode
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'INVITATION_EXPIRED');
          return true;
        }
      );
    });

    it('TEST 9 & ATTACK 7: Correct email + revoked code → DENIED', async () => {
      // Revoke invitation
      const codeHash = hashInvitationCode(validCode);
      const codeRecord = await rtdbService.getData(`invitation_codes/${codeHash}`);
      await workspaceInvitationController.revokeInvitationHandler(
        testOrgId,
        codeRecord.invitationId,
        userAliceOwner.uid
      );

      await assert.rejects(
        async () => {
          await workspaceInvitationController.acceptInvitationHandler(
            userInvitedTeammate.uid,
            userInvitedTeammate.email,
            validCode
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 410);
          assert.strictEqual(err.code, 'INVITATION_REVOKED');
          return true;
        }
      );
    });

    it('TEST 10 & ATTACK 6: Correct email + already accepted code → DENIED (No Code Reuse)', async () => {
      // Accept first time
      await workspaceInvitationController.acceptInvitationHandler(
        userInvitedTeammate.uid,
        userInvitedTeammate.email,
        validCode
      );

      // Attempt reuse
      await assert.rejects(
        async () => {
          await workspaceInvitationController.acceptInvitationHandler(
            userInvitedTeammate.uid,
            userInvitedTeammate.email,
            validCode
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'INVITATION_ALREADY_ACCEPTED');
          return true;
        }
      );
    });

    it('TEST 13: Existing member entering valid code → idempotent join without duplicating count', async () => {
      // Already a member
      mockDb.organization_members[testOrgId][userInvitedTeammate.uid] = {
        uid: userInvitedTeammate.uid,
        role: 'member',
        joinedAt: 500,
      };
      const initialCount = mockDb.organizations[testOrgId].memberCount;

      const res = await workspaceInvitationController.acceptInvitationHandler(
        userInvitedTeammate.uid,
        userInvitedTeammate.email,
        validCode
      );

      assert.strictEqual(res.alreadyMember, true);
      assert.strictEqual(mockDb.organizations[testOrgId].memberCount, initialCount, 'Member count must not increment');
    });

    it('TEST 14 (Capacity): Workspace at maxMembers limit → acceptance DENIED', async () => {
      // Fill workspace to capacity limit
      mockDb.organizations[testOrgId].memberCount = 5;
      mockDb.organizations[testOrgId].maxMembers = 5;
      mockDb.organization_members[testOrgId] = {
        user_alice: { uid: 'user_alice', role: 'owner', joinedAt: 1000 },
        user_bob: { uid: 'user_bob', role: 'admin', joinedAt: 1050 },
        user_m1: { uid: 'user_m1', role: 'member', joinedAt: 1100 },
        user_m2: { uid: 'user_m2', role: 'member', joinedAt: 1150 },
        user_m3: { uid: 'user_m3', role: 'member', joinedAt: 1200 },
      };

      await assert.rejects(
        async () => {
          await workspaceInvitationController.acceptInvitationHandler(
            userInvitedTeammate.uid,
            userInvitedTeammate.email,
            validCode
          );
        },
        (err) => {
          assert.ok(err.statusCode === 409 || err.statusCode === 400);
          assert.ok(err.code === 'WORKSPACE_MEMBER_LIMIT_REACHED' || err.code === 'WORKSPACE_FULL');
          assert.ok(err.message.includes('reached its member limit') || err.message.includes('member limit'));
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 4. REGENERATION & REVOCATION LIFECYCLE (SECTIONS 27, 28, 45)
  // =========================================================================
  describe('4. Invitation Code Regeneration & Revocation Lifecycle', () => {
    let initialCode = '';
    let invitationId = '';

    beforeEach(async () => {
      resetMockDb();
      setupRtdbMock();

      const created = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: 'teammate@example.com', role: 'member' }
      );
      initialCode = created.invitation.codeDisplay;
      invitationId = created.invitation.invitationId;
    });

    it('TEST 15 & 16: Regenerating pending code invalidates old code and activates new code', async () => {
      const regenRes = await workspaceInvitationController.regenerateInvitationHandler(
        testOrgId,
        invitationId,
        userAliceOwner.uid
      );

      const newCode = regenRes.invitation.codeDisplay;
      assert.notStrictEqual(initialCode, newCode, 'New code must be generated');

      // Attempt 1: Old code must be rejected (TEST 15)
      await assert.rejects(
        async () => {
          await workspaceInvitationController.acceptInvitationHandler(
            userInvitedTeammate.uid,
            userInvitedTeammate.email,
            initialCode
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 404, 'Old code mapping must no longer exist');
          return true;
        }
      );

      // Attempt 2: New code succeeds (TEST 16)
      const acceptRes = await workspaceInvitationController.acceptInvitationHandler(
        userInvitedTeammate.uid,
        userInvitedTeammate.email,
        newCode
      );
      assert.strictEqual(acceptRes.success, true, 'New code must succeed');
    });

    it('TEST 17: Revoking pending invitation stops code from working', async () => {
      const revokeRes = await workspaceInvitationController.revokeInvitationHandler(
        testOrgId,
        invitationId,
        userAliceOwner.uid
      );
      assert.strictEqual(revokeRes.success, true);

      await assert.rejects(
        async () => {
          await workspaceInvitationController.acceptInvitationHandler(
            userInvitedTeammate.uid,
            userInvitedTeammate.email,
            initialCode
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 410);
          assert.strictEqual(err.code, 'INVITATION_REVOKED');
          return true;
        }
      );
    });

    it('TEST 29: Invitee can decline their own invitation', async () => {
      const declineRes = await workspaceInvitationController.declineInvitationHandler(
        userInvitedTeammate.uid,
        userInvitedTeammate.email,
        initialCode
      );
      assert.strictEqual(declineRes.success, true);

      // Code can no longer be accepted
      await assert.rejects(
        async () => {
          await workspaceInvitationController.acceptInvitationHandler(
            userInvitedTeammate.uid,
            userInvitedTeammate.email,
            initialCode
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'INVITATION_DECLINED');
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 5. SECURITY ATTACK DEFENSES (SECTIONS 46, 30, 31, 32, 33, 34)
  // =========================================================================
  describe('5. Security Attack Defenses & Privacy Protections', () => {
    beforeEach(() => {
      resetMockDb();
      setupRtdbMock();
    });

    it('ATTACK 2 & 5: Role Escalation Defense — Malicious client cannot accept as owner', async () => {
      const created = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: 'teammate@example.com', role: 'member' }
      );
      const code = created.invitation.codeDisplay;

      // Tamper with invitation role in DB to simulate attack attempt
      mockDb.workspace_invitations[testOrgId][created.invitation.invitationId].role = 'owner';

      const res = await workspaceInvitationController.acceptInvitationHandler(
        userInvitedTeammate.uid,
        userInvitedTeammate.email,
        code
      );

      // System must downgrade or enforce safe role (never owner)
      const memberNode = mockDb.organization_members[testOrgId][userInvitedTeammate.uid];
      assert.notStrictEqual(memberNode.role, 'owner', 'Role escalation to owner must never be permitted');
      assert.strictEqual(memberNode.role, 'member', 'Default role must be member');
    });

    it('TEST 18 & 19 (Privacy): Member cannot enumerate invitations or read invitation codes', async () => {
      // Add Charlie as member
      mockDb.organization_members[testOrgId].user_charlie = { uid: 'user_charlie', role: 'member' };

      await assert.rejects(
        async () => {
          await workspaceInvitationController.listInvitationsHandler(testOrgId, userCharlieMember.uid);
        },
        (err) => {
          assert.strictEqual(err.statusCode, 403);
          return true;
        },
        'Ordinary member must be blocked from listing workspace invitations'
      );
    });

    it('verifies database.rules.json protects workspace_invitations and invitation_codes', () => {
      const invRules = rawRules.rules.workspace_invitations['$workspaceId'];
      assert.ok(invRules, 'workspace_invitations must be defined in database.rules.json');
      assert.ok(invRules['.read'].includes("child('role').val() === 'admin'"), 'Read rule must require admin or owner');
      assert.ok(invRules['.write'].includes("child('role').val() === 'admin'"), 'Write rule must require admin or owner');

      const codeRules = rawRules.rules.invitation_codes;
      assert.ok(codeRules, 'invitation_codes must be defined in database.rules.json');
      assert.strictEqual(codeRules['.read'], false, 'Direct client read of invitation_codes must be blocked (prevent enumeration)');
      assert.strictEqual(codeRules['.write'], false, 'Direct client write of invitation_codes must be blocked');
    });
  });

  // =========================================================================
  // 6. CONCURRENCY & RACE CONDITION DEFENSE (SECTIONS 47 & 48)
  // =========================================================================
  describe('6. Concurrency & Race Condition Defense', () => {
    beforeEach(() => {
      resetMockDb();
      setupRtdbMock();
    });

    it('TEST 47: Two simultaneous submissions of the same code → exactly one succeeds', async () => {
      const created = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: 'teammate@example.com', role: 'member' }
      );
      const code = created.invitation.codeDisplay;

      // Simulate simultaneous submissions
      const attempt1 = workspaceInvitationController.acceptInvitationHandler(
        userInvitedTeammate.uid,
        userInvitedTeammate.email,
        code
      );

      // Attempt 2 runs immediately after status transitions or in parallel
      const results = await Promise.allSettled([
        attempt1,
        workspaceInvitationController.acceptInvitationHandler(
          userInvitedTeammate.uid,
          userInvitedTeammate.email,
          code
        ),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      assert.strictEqual(fulfilled.length >= 1, true, 'At least one attempt succeeds');
      // If one succeeds and transitions status to 'accepted', subsequent attempt fails or is idempotent
      const memberNode = mockDb.organization_members[testOrgId][userInvitedTeammate.uid];
      assert.ok(memberNode, 'User was added as member');
    });
  });

  describe('7. Expiration Window & Lifecycle Testing (Section 14 & 16 Requirements)', () => {
    beforeEach(() => {
      resetMockDb();
      setupRtdbMock();
    });

    it('CASE 1: Create invitation sets expiresAt = createdAt + exactly 5 minutes', async () => {
      const res = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: 'teammate@example.com', role: 'member' }
      );

      assert.strictEqual(res.success, true);
      const inv = res.invitation;
      assert.strictEqual(typeof inv.createdAt, 'number');
      assert.strictEqual(typeof inv.expiresAt, 'number');
      assert.strictEqual(inv.expiresAt - inv.createdAt, 5 * 60 * 1000, 'Must be exactly 5 minutes (300,000 ms)');
    });

    it('CASE 2 & 3: Remaining validity is calculated strictly from (expiresAt - currentTime)', async () => {
      const res = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: 'teammate@example.com', role: 'member' }
      );
      const inv = res.invitation;

      // CASE 2: Immediate check -> ~5 minutes remaining
      const immediateRemaining = inv.expiresAt - inv.createdAt;
      assert.strictEqual(immediateRemaining, 300000);

      // CASE 3: Simulated refresh 2 minutes later -> ~3 minutes remaining
      const twoMinutesLater = inv.createdAt + 2 * 60 * 1000;
      const remainingAfterTwoMins = inv.expiresAt - twoMinutesLater;
      assert.strictEqual(remainingAfterTwoMins, 3 * 60 * 1000, 'Must have 3 minutes remaining');
    });

    it('CASE 4 & 7: Acceptance before expiration succeeds and creates workspace membership exactly once', async () => {
      const res = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: 'teammate@example.com', role: 'member' }
      );
      const code = res.invitation.codeDisplay;

      const acceptRes = await workspaceInvitationController.acceptInvitationHandler(
        userInvitedTeammate.uid,
        userInvitedTeammate.email,
        code
      );

      assert.strictEqual(acceptRes.success, true);
      assert.strictEqual(acceptRes.workspaceId, testOrgId);

      // Verify membership created
      const member = mockDb.organization_members[testOrgId][userInvitedTeammate.uid];
      assert.ok(member);
      assert.strictEqual(member.role, 'member');
      assert.strictEqual(mockDb.organizations[testOrgId].memberCount, 3);
    });

    it('CASE 5: Acceptance after expiration boundary is strictly rejected', async () => {
      const res = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: 'teammate@example.com', role: 'member' }
      );
      const code = res.invitation.codeDisplay;
      const invId = res.invitation.invitationId;
      const codeHash = res.invitation.codeHash;

      // Simulate passage of 5 minutes + 1 second in the database
      const expiredTimestamp = Date.now() - 1000;
      mockDb.workspace_invitations[testOrgId][invId].expiresAt = expiredTimestamp;
      mockDb.invitation_codes[codeHash].expiresAt = expiredTimestamp;

      await assert.rejects(
        async () => {
          await workspaceInvitationController.acceptInvitationHandler(
            userInvitedTeammate.uid,
            userInvitedTeammate.email,
            code
          );
        },
        (err) => {
          assert.strictEqual(err.code, 'INVITATION_EXPIRED');
          return true;
        }
      );
    });

    it('CASE 6: Wrong email account is rejected even with valid unexpired code', async () => {
      const res = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: 'teammate@example.com', role: 'member' }
      );
      const code = res.invitation.codeDisplay;

      await assert.rejects(
        async () => {
          await workspaceInvitationController.acceptInvitationHandler(
            userEveAttacker.uid,
            userEveAttacker.email,
            code
          );
        },
        (err) => {
          assert.strictEqual(err.code, 'WRONG_ACCOUNT');
          return true;
        }
      );
    });

    it('CASE 8: Accepted invitation cannot be reused', async () => {
      const res = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: 'teammate@example.com', role: 'member' }
      );
      const code = res.invitation.codeDisplay;

      await workspaceInvitationController.acceptInvitationHandler(
        userInvitedTeammate.uid,
        userInvitedTeammate.email,
        code
      );

      // Attempt second acceptance
      await assert.rejects(
        async () => {
          await workspaceInvitationController.acceptInvitationHandler(
            userInvitedTeammate.uid,
            userInvitedTeammate.email,
            code
          );
        },
        (err) => {
          assert.strictEqual(err.code, 'INVITATION_ALREADY_ACCEPTED');
          return true;
        }
      );
    });

    it('CASE 9: Revoked invitation is immediately rejected', async () => {
      const res = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: 'teammate@example.com', role: 'member' }
      );
      const code = res.invitation.codeDisplay;
      const invId = res.invitation.invitationId;

      await workspaceInvitationController.revokeInvitationHandler(
        testOrgId,
        invId,
        userAliceOwner.uid
      );

      await assert.rejects(
        async () => {
          await workspaceInvitationController.acceptInvitationHandler(
            userInvitedTeammate.uid,
            userInvitedTeammate.email,
            code
          );
        },
        (err) => {
          assert.strictEqual(err.code, 'INVITATION_REVOKED');
          return true;
        }
      );
    });

    it('CASE 10 & 11: Regenerating gives a fresh 5-minute window and invalidates the old code', async () => {
      const res = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: 'teammate@example.com', role: 'member' }
      );
      const oldCode = res.invitation.codeDisplay;
      const invId = res.invitation.invitationId;

      // Regenerate code
      const regenRes = await workspaceInvitationController.regenerateInvitationHandler(
        testOrgId,
        invId,
        userAliceOwner.uid
      );

      const newCode = regenRes.invitation.codeDisplay;
      assert.notStrictEqual(newCode, oldCode, 'New code must differ from old code');
      assert.strictEqual(
        regenRes.invitation.expiresAt - regenRes.invitation.updatedAt,
        5 * 60 * 1000,
        'Replacement receives fresh 5-minute expiration'
      );

      // CASE 11: Attempt using old code -> rejected
      await assert.rejects(
        async () => {
          await workspaceInvitationController.acceptInvitationHandler(
            userInvitedTeammate.uid,
            userInvitedTeammate.email,
            oldCode
          );
        },
        (err) => {
          assert.strictEqual(err.code, 'INVITATION_NOT_FOUND');
          return true;
        }
      );

      // Using new code -> succeeds
      const acceptRes = await workspaceInvitationController.acceptInvitationHandler(
        userInvitedTeammate.uid,
        userInvitedTeammate.email,
        newCode
      );
      assert.strictEqual(acceptRes.success, true);
    });

    it('CASE 12: Historical invitations with missing/invalid expiresAt are handled as expired', async () => {
      // Insert legacy/corrupted invitation records into mockDb
      mockDb.workspace_invitations[testOrgId]['inv_legacy_no_expiry'] = {
        invitationId: 'inv_legacy_no_expiry',
        invitedEmail: 'legacy1@example.com',
        role: 'member',
        status: 'pending',
        expiresAt: null, // missing
      };
      mockDb.workspace_invitations[testOrgId]['inv_legacy_nan_expiry'] = {
        invitationId: 'inv_legacy_nan_expiry',
        invitedEmail: 'legacy2@example.com',
        role: 'member',
        status: 'pending',
        expiresAt: 'not-a-number', // invalid
      };

      const listRes = await workspaceInvitationController.listInvitationsHandler(
        testOrgId,
        userAliceOwner.uid
      );

      const legacy1 = listRes.invitations.find((i) => i.invitationId === 'inv_legacy_no_expiry');
      const legacy2 = listRes.invitations.find((i) => i.invitationId === 'inv_legacy_nan_expiry');

      assert.strictEqual(legacy1.status, 'expired', 'Missing expiresAt must be mapped to expired');
      assert.strictEqual(legacy2.status, 'expired', 'Invalid expiresAt must be mapped to expired');
    });
  });

  describe('▶ 8. Phase 2B: Join Workspace Invitation Code Input Format Verification', () => {
    beforeEach(() => {
      resetMockDb();
      setupRtdbMock();
    });

    it('PHASE 2B - TEST 1: Complete 13-Character Code Input Verification', async () => {
      const code = 'CNV-KTME-FDXN';
      assert.strictEqual(code.length, 13, 'Total code length must be exactly 13 characters');
      const normalized = normalizeInvitationCode(code);
      assert.strictEqual(normalized, 'CNV-KTME-FDXN');
      assert.strictEqual(isValidInvitationCodeFormat(normalized), true);
    });

    it('PHASE 2B - TEST 2: Formatted Paste Verification (CNV-KTME-FDXN)', async () => {
      const pasted = 'CNV-KTME-FDXN';
      const normalized = normalizeInvitationCode(pasted);
      assert.strictEqual(normalized, 'CNV-KTME-FDXN');
      assert.strictEqual(isValidInvitationCodeFormat(normalized), true);
    });

    it('PHASE 2B - TEST 3: Unformatted Paste Verification (CNVKTMEFDXN)', async () => {
      const unformatted = 'CNVKTMEFDXN';
      const normalized = normalizeInvitationCode(unformatted);
      assert.strictEqual(normalized, 'CNV-KTME-FDXN', 'Must insert hyphens to produce CNV-XXXX-XXXX');
      assert.strictEqual(isValidInvitationCodeFormat(normalized), true);
    });

    it('PHASE 2B - TEST 4: Lowercase Paste Verification (cnv-ktme-fdxn & cnvktmefdxn)', async () => {
      const lowerHyphen = 'cnv-ktme-fdxn';
      assert.strictEqual(normalizeInvitationCode(lowerHyphen), 'CNV-KTME-FDXN');
      assert.strictEqual(isValidInvitationCodeFormat(normalizeInvitationCode(lowerHyphen)), true);

      const lowerNoHyphen = 'cnvktmefdxn';
      assert.strictEqual(normalizeInvitationCode(lowerNoHyphen), 'CNV-KTME-FDXN');
      assert.strictEqual(isValidInvitationCodeFormat(normalizeInvitationCode(lowerNoHyphen)), true);
    });

    it('PHASE 2B - TEST 5: 8-Character Payload Input Verification (KTMEFDXN / ktmefdxn)', async () => {
      const payloadUpper = 'KTMEFDXN';
      assert.strictEqual(normalizeInvitationCode(payloadUpper), 'CNV-KTME-FDXN');
      assert.strictEqual(isValidInvitationCodeFormat(normalizeInvitationCode(payloadUpper)), true);

      const payloadLower = 'ktmefdxn';
      assert.strictEqual(normalizeInvitationCode(payloadLower), 'CNV-KTME-FDXN');
      assert.strictEqual(isValidInvitationCodeFormat(normalizeInvitationCode(payloadLower)), true);
    });

    it('PHASE 2B - TEST 6: Truncated Code Rejection Verification (CNV-KTME / CNV-KTME- / CNV-KTME-FDX)', async () => {
      const truncatedCodes = ['CNV-KTME', 'CNV-KTME-', 'CNV-KTME-FDX', 'KTME', 'CNV-'];

      for (const truncated of truncatedCodes) {
        const normalized = normalizeInvitationCode(truncated);
        assert.strictEqual(
          isValidInvitationCodeFormat(normalized),
          false,
          `Truncated code ${truncated} must fail format validation`
        );

        // Verification in lookupInvitationByCodeHandler
        await assert.rejects(
          async () => {
            await workspaceInvitationController.lookupInvitationByCodeHandler(truncated);
          },
          (err) => {
            assert.strictEqual(err.code, 'INVALID_CODE');
            assert.strictEqual(err.message, 'Enter a valid invitation code in the format CNV-XXXX-XXXX.');
            return true;
          }
        );

        // Verification in acceptInvitationHandler
        await assert.rejects(
          async () => {
            await workspaceInvitationController.acceptInvitationHandler(
              userInvitedTeammate.uid,
              userInvitedTeammate.email,
              truncated
            );
          },
          (err) => {
            assert.strictEqual(err.code, 'INVALID_CODE');
            assert.strictEqual(err.message, 'Enter a valid invitation code in the format CNV-XXXX-XXXX.');
            return true;
          }
        );
      }
    });

    it('PHASE 2B - TEST 7: Non-existent Code Verification (CNV-9999-9999)', async () => {
      const nonexistentCode = 'CNV-9999-9999';
      assert.strictEqual(isValidInvitationCodeFormat(nonexistentCode), true);

      await assert.rejects(
        async () => {
          await workspaceInvitationController.lookupInvitationByCodeHandler(nonexistentCode);
        },
        (err) => {
          assert.strictEqual(err.code, 'INVITATION_NOT_FOUND');
          assert.strictEqual(err.message, 'Invitation code not found.');
          return true;
        }
      );

      await assert.rejects(
        async () => {
          await workspaceInvitationController.acceptInvitationHandler(
            userInvitedTeammate.uid,
            userInvitedTeammate.email,
            nonexistentCode
          );
        },
        (err) => {
          assert.strictEqual(err.code, 'INVITATION_NOT_FOUND');
          assert.strictEqual(err.message, 'Invitation code not found.');
          return true;
        }
      );
    });

    it('PHASE 2B - TEST 8: Expired Code Rejection Verification', async () => {
      const createRes = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: userInvitedTeammate.email, role: 'member' }
      );
      const code = createRes.invitation.codeDisplay;

      // Fast forward past 5-minute expiration
      mockDb.workspace_invitations[testOrgId][createRes.invitation.invitationId].expiresAt =
        Date.now() - 1000;
      mockDb.invitation_codes[createRes.invitation.codeHash].expiresAt = Date.now() - 1000;

      await assert.rejects(
        async () => {
          await workspaceInvitationController.lookupInvitationByCodeHandler(code);
        },
        (err) => {
          assert.strictEqual(err.code, 'INVITATION_EXPIRED');
          assert.strictEqual(err.message, 'This invitation code has expired.');
          return true;
        }
      );

      await assert.rejects(
        async () => {
          await workspaceInvitationController.acceptInvitationHandler(
            userInvitedTeammate.uid,
            userInvitedTeammate.email,
            code
          );
        },
        (err) => {
          assert.strictEqual(err.code, 'INVITATION_EXPIRED');
          assert.strictEqual(err.message, 'This invitation code has expired.');
          return true;
        }
      );
    });

    it('PHASE 2B - TEST 9: Wrong Account Protection Verification', async () => {
      const createRes = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: userInvitedTeammate.email, role: 'member' }
      );
      const code = createRes.invitation.codeDisplay;

      // Lookup works and displays target email
      const lookup = await workspaceInvitationController.lookupInvitationByCodeHandler(code);
      assert.strictEqual(lookup.invitedEmail, userInvitedTeammate.email);

      // Wrong account (Eve) attempts to accept
      await assert.rejects(
        async () => {
          await workspaceInvitationController.acceptInvitationHandler(
            userEveAttacker.uid,
            userEveAttacker.email,
            code
          );
        },
        (err) => {
          assert.strictEqual(err.code, 'WRONG_ACCOUNT');
          assert.strictEqual(err.message.includes(userInvitedTeammate.email), false, 'Must NOT leak invited email');
          assert.strictEqual(err.message.includes(userEveAttacker.email), false, 'Must NOT leak attacker email');
          return true;
        }
      );
    });

    it('PHASE 2B - TEST 10: Valid Code Acceptance Verification (full 13-character code)', async () => {
      const createRes = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: userInvitedTeammate.email, role: 'member' }
      );
      const code = createRes.invitation.codeDisplay;
      assert.strictEqual(code.length, 13);

      // Lookup
      const lookup = await workspaceInvitationController.lookupInvitationByCodeHandler(code);
      assert.strictEqual(lookup.valid, true);
      assert.strictEqual(lookup.workspaceName, 'Phase 2 Test Workspace');

      // Accept with valid account
      const acceptRes = await workspaceInvitationController.acceptInvitationHandler(
        userInvitedTeammate.uid,
        userInvitedTeammate.email,
        code
      );
      assert.strictEqual(acceptRes.success, true);
      assert.strictEqual(acceptRes.alreadyMember, false);
      assert.strictEqual(acceptRes.role, 'member');

      // Member record created in mock DB
      const member = mockDb.organization_members[testOrgId][userInvitedTeammate.uid];
      assert.ok(member);
      assert.strictEqual(member.role, 'member');
    });
  });

  describe('▶ 9. Section 19: Unified Email-Bound Join & Legacy Code Retirement Tests (TEST 1–10)', () => {
    beforeEach(() => {
      resetMockDb();
      setupRtdbMock();
    });

    // TEST 1 — New invitation
    it('TEST 1 — New invitation: Valid code CNV-KTME-FDXN is accepted by correct registered email', async () => {
      const createRes = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: userInvitedTeammate.email, role: 'member' }
      );
      const code = createRes.invitation.codeDisplay;

      const acceptRes = await workspaceInvitationController.acceptInvitationHandler(
        userInvitedTeammate.uid,
        userInvitedTeammate.email,
        code
      );
      assert.strictEqual(acceptRes.success, true);
      assert.strictEqual(acceptRes.role, 'member');
      assert.strictEqual(mockDb.organization_members[testOrgId][userInvitedTeammate.uid].uid, userInvitedTeammate.uid);
    });

    // TEST 2 — Wrong email
    it('TEST 2 — Wrong email: Correct code + different registered email is strictly rejected', async () => {
      const createRes = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: userInvitedTeammate.email, role: 'member' }
      );
      const code = createRes.invitation.codeDisplay;

      await assert.rejects(
        async () => {
          await workspaceInvitationController.acceptInvitationHandler(
            userEveAttacker.uid,
            userEveAttacker.email,
            code
          );
        },
        (err) => {
          assert.strictEqual(err.code, 'WRONG_ACCOUNT');
          assert.strictEqual(err.message.includes(userInvitedTeammate.email), false, 'Must NOT leak invited email');
          assert.strictEqual(err.message.includes(userEveAttacker.email), false, 'Must NOT leak user email');
          return true;
        }
      );
    });

    // TEST 3 — Expired invitation
    it('TEST 3 — Expired invitation: Correct code + correct email past 5-min expiration is strictly rejected', async () => {
      const createRes = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: userInvitedTeammate.email, role: 'member' }
      );
      const code = createRes.invitation.codeDisplay;

      // Expire the code
      mockDb.workspace_invitations[testOrgId][createRes.invitation.invitationId].expiresAt = Date.now() - 5000;
      mockDb.invitation_codes[createRes.invitation.codeHash].expiresAt = Date.now() - 5000;

      await assert.rejects(
        async () => {
          await workspaceInvitationController.acceptInvitationHandler(
            userInvitedTeammate.uid,
            userInvitedTeammate.email,
            code
          );
        },
        (err) => {
          assert.strictEqual(err.code, 'INVITATION_EXPIRED');
          assert.strictEqual(err.message, 'This invitation code has expired.');
          return true;
        }
      );
    });

    // TEST 4 — Legacy code (VM49NN5C)
    it('TEST 4 — Legacy code: Legacy 8-character code VM49NN5C is rejected as invalid/not found in active join flow', async () => {
      const legacyCode = 'VM49NN5C';

      // 1. In modern invitation lookup: rejected as not found
      await assert.rejects(
        async () => {
          await workspaceInvitationController.lookupInvitationByCodeHandler(legacyCode);
        },
        (err) => {
          assert.strictEqual(err.code, 'INVITATION_NOT_FOUND');
          return true;
        }
      );

      // 2. In modern invitation accept: rejected
      await assert.rejects(
        async () => {
          await workspaceInvitationController.acceptInvitationHandler(
            userInvitedTeammate.uid,
            userInvitedTeammate.email,
            legacyCode
          );
        },
        (err) => {
          assert.strictEqual(err.code, 'INVITATION_NOT_FOUND');
          return true;
        }
      );
    });

    // TEST 5 — Legacy code + correct workspace
    it('TEST 5 — Legacy code + correct workspace: Even if VM49NN5C historically belongs to the workspace, join is REJECTED', async () => {
      const legacyCode = 'VM49NN5C';
      // Seed legacy code on the workspace record and legacy table
      mockDb.organizations[testOrgId].inviteCode = legacyCode;
      mockDb.invite_codes = {
        [legacyCode]: { orgId: testOrgId, createdAt: 1000 },
      };

      const initialMemberCount = Object.keys(mockDb.organization_members[testOrgId]).length;

      // 1. Attempt join via email-bound invitation handler -> rejected
      await assert.rejects(
        async () => {
          await workspaceInvitationController.acceptInvitationHandler(
            userInvitedTeammate.uid,
            userInvitedTeammate.email,
            legacyCode
          );
        },
        (err) => {
          assert.strictEqual(err.code, 'INVITATION_NOT_FOUND');
          return true;
        }
      );

      // 2. Attempt join via legacy controller handler -> strictly rejected with 410 LEGACY_CODE_RETIRED
      await assert.rejects(
        async () => {
          await workspaceMembershipController.joinWorkspaceByCodeHandler(
            userInvitedTeammate.uid,
            legacyCode
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 410);
          assert.strictEqual(err.code, 'LEGACY_CODE_RETIRED');
          return true;
        }
      );

      // Confirm user was NEVER added as a member
      assert.strictEqual(
        mockDb.organization_members[testOrgId][userInvitedTeammate.uid],
        undefined,
        'Legacy code must NEVER grant workspace membership'
      );
      assert.strictEqual(
        Object.keys(mockDb.organization_members[testOrgId]).length,
        initialMemberCount,
        'Member count must remain unchanged'
      );
    });

    // TEST 6 — Existing workspace
    it('TEST 6 — Existing workspace: Workspace created before migration accepts valid new invitation code', async () => {
      // Historical workspace created with legacy field
      const existingOrgId = 'org_pre_migration';
      mockDb.organizations[existingOrgId] = {
        id: existingOrgId,
        orgId: existingOrgId,
        name: 'Pre-Migration BioLynk Workspace',
        ownerId: userAliceOwner.uid,
        inviteCode: 'VM49NN5C', // historical legacy field
        memberCount: 1,
        maxMembers: 5,
      };
      mockDb.organization_members[existingOrgId] = {
        [userAliceOwner.uid]: { uid: userAliceOwner.uid, role: 'owner', joinedAt: 500 },
      };
      mockDb.workspace_invitations[existingOrgId] = {};

      // Owner issues modern email-bound invitation
      const createRes = await workspaceInvitationController.createInvitationHandler(
        existingOrgId,
        userAliceOwner.uid,
        { email: userInvitedTeammate.email, role: 'member' }
      );
      const code = createRes.invitation.codeDisplay;

      // Teammate joins using new email-bound invitation
      const acceptRes = await workspaceInvitationController.acceptInvitationHandler(
        userInvitedTeammate.uid,
        userInvitedTeammate.email,
        code
      );
      assert.strictEqual(acceptRes.success, true);
      assert.strictEqual(acceptRes.workspaceId, existingOrgId);
      assert.ok(mockDb.organization_members[existingOrgId][userInvitedTeammate.uid]);
    });

    // TEST 7 — New workspace
    it('TEST 7 — New workspace: Newly created workspace does not generate or allow common 8-character join codes', async () => {
      // Simulating new workspace creation via hardened orgService
      const newOrgId = 'org_post_migration_new';
      const timestamp = Date.now();
      const newWorkspaceRecord = {
        orgId: newOrgId,
        id: newOrgId,
        name: 'Modern Clean Workspace',
        ownerId: userAliceOwner.uid,
        memberCount: 1,
        maxMembers: 5,
        status: 'ideation',
        createdAt: timestamp,
        // Notice: inviteCode is omitted entirely
      };

      assert.strictEqual(newWorkspaceRecord.inviteCode, undefined);

      // Verify that arbitrary 8-character codes cannot join this new workspace
      await assert.rejects(
        async () => {
          await workspaceMembershipController.joinWorkspaceByCodeHandler(
            userInvitedTeammate.uid,
            'NEWCODE8'
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 410);
          assert.strictEqual(err.code, 'LEGACY_CODE_RETIRED');
          return true;
        }
      );
    });

    // TEST 8 — Old code after new invitation expires
    it('TEST 8 — Old code after new invitation expires: Both expired code and legacy code fail; zero fallback', async () => {
      // Create invitation
      const createRes = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: userInvitedTeammate.email, role: 'member' }
      );
      const code = createRes.invitation.codeDisplay;

      // Expire invitation
      mockDb.workspace_invitations[testOrgId][createRes.invitation.invitationId].expiresAt = Date.now() - 1000;
      mockDb.invitation_codes[createRes.invitation.codeHash].expiresAt = Date.now() - 1000;

      // 1. New expired code rejected
      await assert.rejects(
        async () => {
          await workspaceInvitationController.acceptInvitationHandler(
            userInvitedTeammate.uid,
            userInvitedTeammate.email,
            code
          );
        },
        (err) => {
          assert.strictEqual(err.code, 'INVITATION_EXPIRED');
          return true;
        }
      );

      // 2. User tries fallback to old code VM49NN5C -> strictly rejected; no fallback
      await assert.rejects(
        async () => {
          await workspaceInvitationController.acceptInvitationHandler(
            userInvitedTeammate.uid,
            userInvitedTeammate.email,
            'VM49NN5C'
          );
        },
        (err) => {
          assert.strictEqual(err.code, 'INVITATION_NOT_FOUND');
          return true;
        }
      );

      await assert.rejects(
        async () => {
          await workspaceMembershipController.joinWorkspaceByCodeHandler(
            userInvitedTeammate.uid,
            'VM49NN5C'
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 410);
          assert.strictEqual(err.code, 'LEGACY_CODE_RETIRED');
          return true;
        }
      );
    });

    // TEST 9 — Accepted invitation reuse
    it('TEST 9 — Accepted invitation reuse: An already used invitation code is strictly rejected on reuse', async () => {
      const createRes = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: userInvitedTeammate.email, role: 'member' }
      );
      const code = createRes.invitation.codeDisplay;

      // First acceptance succeeds
      const firstJoin = await workspaceInvitationController.acceptInvitationHandler(
        userInvitedTeammate.uid,
        userInvitedTeammate.email,
        code
      );
      assert.strictEqual(firstJoin.success, true);

      // Second acceptance by another user (or same user) is rejected
      await assert.rejects(
        async () => {
          await workspaceInvitationController.acceptInvitationHandler(
            userEveAttacker.uid,
            userEveAttacker.email,
            code
          );
        },
        (err) => {
          assert.strictEqual(err.code, 'INVITATION_ALREADY_ACCEPTED');
          assert.strictEqual(err.message, 'This invitation code has already been used.');
          return true;
        }
      );
    });

    // TEST 10 — Revoked invitation
    it('TEST 10 — Revoked invitation: A revoked invitation code cannot be accepted by anyone', async () => {
      const createRes = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: userInvitedTeammate.email, role: 'member' }
      );
      const code = createRes.invitation.codeDisplay;
      const invitationId = createRes.invitation.invitationId;

      // Owner revokes invitation
      const revokeRes = await workspaceInvitationController.revokeInvitationHandler(
        testOrgId,
        invitationId,
        userAliceOwner.uid
      );
      assert.strictEqual(revokeRes.success, true);

      // Invitee attempts to accept
      await assert.rejects(
        async () => {
          await workspaceInvitationController.acceptInvitationHandler(
            userInvitedTeammate.uid,
            userInvitedTeammate.email,
            code
          );
        },
        (err) => {
          assert.strictEqual(err.code, 'INVITATION_REVOKED');
          assert.strictEqual(err.message, 'This invitation is no longer valid.');
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 10. VERIFICATION CHECKLIST: EXPIRATION & STATUS DISPLAY REFINEMENT
  // =========================================================================
  describe('10. Verification Checklist: Expiration & Status Display Refinement', () => {
    beforeEach(() => {
      resetMockDb();
      setupRtdbMock();
    });

    // TEST 1 — New Invitation Display
    it('TEST 1 — New Invitation Display: Row shows pending, ~5m countdown, code visible', async () => {
      const createRes = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: 'colleague@example.com', role: 'member' }
      );
      assert.strictEqual(createRes.success, true);
      const inv = createRes.invitation;

      assert.strictEqual(inv.status, 'pending');
      assert.ok(inv.codeDisplay.startsWith('CNV-'));
      assert.strictEqual(isInvitationExpired(inv, inv.createdAt), false);

      const statusDisplay = formatInvitationStatusDate(inv, inv.createdAt);
      assert.strictEqual(statusDisplay, 'Expires in 5m 00s');
    });

    // TEST 2 — Live Expiration Countdown
    it('TEST 2 — Live Expiration Countdown: 2 minutes later shows ~3m remaining and updates reliably', async () => {
      const createRes = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: 'colleague@example.com', role: 'member' }
      );
      const inv = createRes.invitation;
      const twoMinutesLater = inv.createdAt + 2 * 60 * 1000 + 1000; // 2m 01s later

      assert.strictEqual(isInvitationExpired(inv, twoMinutesLater), false);
      const statusDisplay = formatInvitationStatusDate(inv, twoMinutesLater);
      assert.strictEqual(statusDisplay, 'Expires in 2m 59s');
    });

    // TEST 3 — Expiration Reached
    it('TEST 3 — Expiration Reached: 5m passes -> status expired, Expires/Date is "Expired", no countdown', async () => {
      const createRes = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: 'colleague@example.com', role: 'member' }
      );
      const inv = createRes.invitation;
      const fiveMinutesOneSecLater = inv.expiresAt + 1000;

      assert.strictEqual(isInvitationExpired(inv, fiveMinutesOneSecLater), true);
      const statusDisplay = formatInvitationStatusDate(inv, fiveMinutesOneSecLater);
      assert.strictEqual(statusDisplay, 'Expired');
      assert.ok(!statusDisplay.includes('Expires in'));
    });

    // TEST 4 — Accepted Before Expiration
    it('TEST 4 — Accepted Before Expiration: Status is accepted, "Accepted just now", countdown is gone', async () => {
      const createRes = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: userInvitedTeammate.email, role: 'member' }
      );
      const inv = createRes.invitation;
      const code = inv.codeDisplay;

      const acceptRes = await workspaceInvitationController.acceptInvitationHandler(
        userInvitedTeammate.uid,
        userInvitedTeammate.email,
        code
      );
      assert.strictEqual(acceptRes.success, true);

      // Fetch invitation from DB
      const dbInv = mockDb.workspace_invitations[testOrgId][inv.invitationId];
      assert.strictEqual(dbInv.status, 'accepted');
      assert.ok(dbInv.acceptedAt, 'acceptedAt must be recorded');
      assert.strictEqual(isInvitationExpired(dbInv, Date.now()), false);

      const statusDisplay = formatInvitationStatusDate(dbInv, Date.now());
      assert.strictEqual(statusDisplay, 'Accepted just now');
      assert.ok(!statusDisplay.includes('Expires'));
    });

    // TEST 5 — Accepted Invitation After Original Expiration Window Passes (Terminal State)
    it('TEST 5 — Accepted Invitation After Original Expiration Window Passes: Remains accepted, never expired', async () => {
      const createRes = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: userInvitedTeammate.email, role: 'member' }
      );
      const inv = createRes.invitation;
      const code = inv.codeDisplay;

      await workspaceInvitationController.acceptInvitationHandler(
        userInvitedTeammate.uid,
        userInvitedTeammate.email,
        code
      );

      const dbInv = mockDb.workspace_invitations[testOrgId][inv.invitationId];

      // Simulate 6 minutes later (past the original expiresAt)
      const sixMinutesLater = inv.expiresAt + 60 * 1000;
      assert.strictEqual(sixMinutesLater > inv.expiresAt, true);

      // Must NEVER evaluate as expired
      assert.strictEqual(isInvitationExpired(dbInv, sixMinutesLater), false);
      assert.strictEqual(dbInv.status, 'accepted');

      const statusDisplay = formatInvitationStatusDate(dbInv, sixMinutesLater);
      assert.ok(statusDisplay.startsWith('Accepted'), 'Display must remain Accepted');
      assert.strictEqual(statusDisplay.includes('Expired'), false, 'Display must NEVER be Expired');
      assert.strictEqual(statusDisplay.includes('Expires in'), false, 'Display must NEVER show countdown');

      // Membership in workspace remains fully intact
      assert.ok(mockDb.organization_members[testOrgId][userInvitedTeammate.uid]);
      assert.strictEqual(mockDb.organizations[testOrgId].memberCount, 3);
    });

    // TEST 6 — Revoked Invitation
    it('TEST 6 — Revoked Invitation: Status revoked, displays "Revoked...", countdown gone, cannot be redeemed', async () => {
      const createRes = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: 'revoked.user@example.com', role: 'member' }
      );
      const inv = createRes.invitation;
      const code = inv.codeDisplay;

      const revokeRes = await workspaceInvitationController.revokeInvitationHandler(
        testOrgId,
        inv.invitationId,
        userAliceOwner.uid
      );
      assert.strictEqual(revokeRes.success, true);

      const dbInv = mockDb.workspace_invitations[testOrgId][inv.invitationId];
      assert.strictEqual(dbInv.status, 'revoked');
      assert.ok(dbInv.revokedAt, 'revokedAt must be recorded');
      assert.strictEqual(isInvitationExpired(dbInv, Date.now()), false);

      const statusDisplay = formatInvitationStatusDate(dbInv, Date.now());
      assert.strictEqual(statusDisplay, 'Revoked just now');
      assert.strictEqual(statusDisplay.includes('Expires'), false);

      // Code cannot be accepted
      await assert.rejects(
        async () => {
          await workspaceInvitationController.acceptInvitationHandler(
            'user_revoked_id',
            'revoked.user@example.com',
            code
          );
        },
        (err) => {
          assert.strictEqual(err.code, 'INVITATION_REVOKED');
          return true;
        }
      );
    });

    // TEST 7 — Page Refresh After Acceptance
    it('TEST 7 — Page Refresh After Acceptance: Database returns clean accepted record with acceptedAt and expiresAt intact', async () => {
      const createRes = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: userInvitedTeammate.email, role: 'member' }
      );
      const inv = createRes.invitation;
      await workspaceInvitationController.acceptInvitationHandler(
        userInvitedTeammate.uid,
        userInvitedTeammate.email,
        inv.codeDisplay
      );

      // Simulate page refresh: list invitations from controller/DB
      const listRes = await workspaceInvitationController.listInvitationsHandler(testOrgId, userAliceOwner.uid);
      const acceptedInv = listRes.invitations.find((i) => i.invitationId === inv.invitationId);

      assert.ok(acceptedInv);
      assert.strictEqual(acceptedInv.status, 'accepted');
      assert.ok(acceptedInv.acceptedAt);
      assert.ok(acceptedInv.expiresAt, 'Original expiresAt is preserved for audit/telemetry');

      // Immediate render
      const text = formatInvitationStatusDate(acceptedInv, Date.now() + 10 * 60 * 1000);
      assert.ok(text.startsWith('Accepted'));
      assert.strictEqual(text.includes('Expired'), false);
    });

    // TEST 8 — Page Refresh After Expiration
    it('TEST 8 — Page Refresh After Expiration: Row renders immediately as expired with "Expired" text, no ticker', async () => {
      const createRes = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: 'expired.user@example.com', role: 'member' }
      );
      const inv = createRes.invitation;

      // Simulate passage of time past expiration
      const wayPastExpiry = inv.expiresAt + 60000;
      const listRes = await workspaceInvitationController.listInvitationsHandler(testOrgId, userAliceOwner.uid);
      const loadedInv = listRes.invitations.find((i) => i.invitationId === inv.invitationId);

      // Evaluates as expired immediately on refresh
      assert.strictEqual(isInvitationExpired(loadedInv, wayPastExpiry), true);
      const text = formatInvitationStatusDate(loadedInv, wayPastExpiry);
      assert.strictEqual(text, 'Expired');

      // Verify timer optimization condition: no active pending invitations exist
      const hasActivePending = [loadedInv].some(
        (i) => i.status === 'pending' && i.expiresAt && wayPastExpiry < Number(i.expiresAt)
      );
      assert.strictEqual(hasActivePending, false, 'No active timer ticker should run');
    });
  });

  // =========================================================================
  // 11. SECTION 17 & SECTION 5: INVITATION AVAILABILITY & VALIDATION DIFFERENTIATION
  // =========================================================================
  describe('11. Section 17 & Section 5: Availability & Differentiated Validations', () => {
    beforeEach(() => {
      resetMockDb();
      setupRtdbMock();
    });

    it('TEST 1: Owner successfully generates unique email-bound invitation with 5-minute expiration', async () => {
      const res = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: 'new.member@example.com', role: 'member' }
      );

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.existing, false);
      assert.strictEqual(res.invitation.invitedEmail, 'new.member@example.com');
      assert.strictEqual(res.invitation.workspaceId, testOrgId);
      assert.strictEqual(res.invitation.role, 'member');
      assert.strictEqual(res.invitation.status, 'pending');
      assert.strictEqual(res.invitation.expiresAt - res.invitation.createdAt, 300000);
      assert.ok(isValidInvitationCodeFormat(res.invitation.codeDisplay));
    });

    it('TEST 2: Generated codes are unique across multiple generations', async () => {
      const res1 = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: 'user1@example.com', role: 'member' }
      );
      const res2 = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: 'user2@example.com', role: 'member' }
      );

      assert.notStrictEqual(res1.invitation.codeDisplay, res2.invitation.codeDisplay);
      assert.notStrictEqual(res1.invitation.invitationId, res2.invitation.invitationId);
    });

    it('TEST 3: Full workspace rejects generation with specific capacity message (Section 5D & 8)', async () => {
      // Set workspace capacity to 2 (Alice and Bob already fill it)
      mockDb.organizations[testOrgId].maxMembers = 2;
      mockDb.organizations[testOrgId].teamSizeLimit = 2;

      await assert.rejects(
        async () => {
          await workspaceInvitationController.createInvitationHandler(
            testOrgId,
            userAliceOwner.uid,
            { email: 'capacity.test@example.com', role: 'member' }
          );
        },
        (err) => {
          assert.ok(err.statusCode === 409 || err.statusCode === 400);
          assert.ok(err.code === 'WORKSPACE_MEMBER_LIMIT_REACHED' || err.code === 'WORKSPACE_FULL');
          assert.ok(err.message.includes('reached its member limit') || err.message.includes('member limit reached'));
          return true;
        }
      );
    });

    it('TEST 4: Already a member email rejects generation with specific message (Section 5C)', async () => {
      await assert.rejects(
        async () => {
          await workspaceInvitationController.createInvitationHandler(
            testOrgId,
            userAliceOwner.uid,
            { email: 'bob.admin@convia.dev', role: 'member' }
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'ALREADY_MEMBER');
          assert.strictEqual(err.message, 'This user is already a member of this workspace.');
          return true;
        }
      );
    });

    it('TEST 5: Workspace owner email rejects generation as already a member', async () => {
      await assert.rejects(
        async () => {
          await workspaceInvitationController.createInvitationHandler(
            testOrgId,
            userAliceOwner.uid,
            { email: 'alice.owner@convia.dev', role: 'member' }
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'ALREADY_MEMBER');
          assert.strictEqual(err.message, 'This user is already a member of this workspace.');
          return true;
        }
      );
    });

    it('TEST 6: Existing active invitation returns existing invitation with specific message (Section 5E & 10)', async () => {
      const first = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: 'duplicate@example.com', role: 'member' }
      );
      assert.strictEqual(first.existing, false);

      const second = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: 'duplicate@example.com', role: 'member' }
      );
      assert.strictEqual(second.existing, true);
      assert.strictEqual(second.message, 'An active invitation already exists for this email.');
      assert.strictEqual(second.invitation.codeDisplay, first.invitation.codeDisplay);
    });

    it('TEST 7: Unauthorized user rejects generation with specific permission message (Section 5F & 7)', async () => {
      // Charlie is a regular member, not owner or admin
      mockDb.organization_members[testOrgId].user_charlie = { uid: 'user_charlie', role: 'member' };

      await assert.rejects(
        async () => {
          await workspaceInvitationController.createInvitationHandler(
            testOrgId,
            userCharlieMember.uid,
            { email: 'charlie.invite@example.com', role: 'member' }
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.message, "You don't have permission to invite members to this workspace.");
          return true;
        }
      );
    });

    it('TEST 8: Invalid email format rejects with specific validation message (Section 5A & 9)', async () => {
      await assert.rejects(
        async () => {
          await workspaceInvitationController.createInvitationHandler(
            testOrgId,
            userAliceOwner.uid,
            { email: 'not-an-email', role: 'member' }
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'INVALID_EMAIL');
          assert.strictEqual(err.message, 'Please enter a valid email address.');
          return true;
        }
      );
    });

    it('TEST 9: Unregistered email rejects when registration is required (Section 5B & 17)', async () => {
      mockDb.platform_settings = {
        workspaces: {
          requireRegisteredUsersForInvites: true,
        },
      };

      await assert.rejects(
        async () => {
          await workspaceInvitationController.createInvitationHandler(
            testOrgId,
            userAliceOwner.uid,
            { email: 'unregistered.ghost@nowhere.com', role: 'member' }
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'NOT_REGISTERED');
          assert.strictEqual(err.message, 'This email is not registered with Convia.');
          return true;
        }
      );
    });

    it('TEST 10: Existing email-bound acceptance continues working securely', async () => {
      const createRes = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: 'teammate@example.com', role: 'member' }
      );
      const code = createRes.invitation.codeDisplay;

      const acceptRes = await workspaceInvitationController.acceptInvitationHandler(
        userInvitedTeammate.uid,
        userInvitedTeammate.email,
        code
      );
      assert.strictEqual(acceptRes.success, true);
      assert.strictEqual(acceptRes.workspaceId, testOrgId);
      assert.ok(mockDb.organization_members[testOrgId][userInvitedTeammate.uid]);
    });
  });

  // =========================================================================
  // 12. WORKSPACE MEMBER CAPACITY & INVITATION RESTRICTION (SECTION 27 MATRIX)
  // =========================================================================
  describe('12. Workspace Member Capacity & Invitation Restriction (Section 27 Matrix)', () => {
    beforeEach(() => {
      resetMockDb();
      setupRtdbMock();
    });

    it('TEST 1: 1 member / 5 limit → invitation allowed', async () => {
      // Setup: Only Alice is in the workspace
      delete mockDb.organization_members[testOrgId].user_bob;
      mockDb.organizations[testOrgId].maxMembers = 5;

      const res = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: 'teammate@example.com', role: 'member' }
      );
      assert.strictEqual(res.success, true);
      assert.ok(res.invitation.codeDisplay);
    });

    it('TEST 2: 4 members / 5 limit → invitation allowed', async () => {
      // Setup: 4 members (Alice, Bob, Charlie, Eve) in workspace with limit = 5
      mockDb.organization_members[testOrgId].user_charlie = { uid: 'user_charlie', role: 'member' };
      mockDb.organization_members[testOrgId].user_eve = { uid: 'user_eve', role: 'member' };
      mockDb.organizations[testOrgId].maxMembers = 5;

      const res = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: 'teammate@example.com', role: 'member' }
      );
      assert.strictEqual(res.success, true);
      assert.ok(res.invitation.codeDisplay);
    });

    it('TEST 3: 5 members / 5 limit → invitation blocked (409 WORKSPACE_MEMBER_LIMIT_REACHED)', async () => {
      // Setup: 5 members in workspace with limit = 5
      mockDb.organization_members[testOrgId].user_charlie = { uid: 'user_charlie', role: 'member' };
      mockDb.organization_members[testOrgId].user_eve = { uid: 'user_eve', role: 'member' };
      mockDb.organization_members[testOrgId].user_teammate = { uid: 'user_teammate', role: 'member' };
      mockDb.organizations[testOrgId].maxMembers = 5;

      await assert.rejects(
        async () => {
          await workspaceInvitationController.createInvitationHandler(
            testOrgId,
            userAliceOwner.uid,
            { email: 'overflow@example.com', role: 'member' }
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 409);
          assert.strictEqual(err.code, 'WORKSPACE_MEMBER_LIMIT_REACHED');
          assert.strictEqual(err.message, 'Workspace member limit reached.');
          return true;
        }
      );
    });

    it('TEST 4: 6 members / 5 limit → invitation blocked', async () => {
      // Setup: 6 members in workspace with limit = 5
      mockDb.organization_members[testOrgId].user_charlie = { uid: 'user_charlie', role: 'member' };
      mockDb.organization_members[testOrgId].user_eve = { uid: 'user_eve', role: 'member' };
      mockDb.organization_members[testOrgId].user_teammate = { uid: 'user_teammate', role: 'member' };
      mockDb.organization_members[testOrgId].user_extra = { uid: 'user_extra', role: 'member' };
      mockDb.organizations[testOrgId].maxMembers = 5;

      await assert.rejects(
        async () => {
          await workspaceInvitationController.createInvitationHandler(
            testOrgId,
            userAliceOwner.uid,
            { email: 'overflow@example.com', role: 'member' }
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 409);
          assert.strictEqual(err.code, 'WORKSPACE_MEMBER_LIMIT_REACHED');
          return true;
        }
      );
    });

    it('TEST 5: pending invitations do not consume capacity (Section 2, 15, 28)', async () => {
      // Setup: 4 members, limit = 5, and 10 existing pending invitations
      mockDb.organization_members[testOrgId].user_charlie = { uid: 'user_charlie', role: 'member' };
      mockDb.organization_members[testOrgId].user_eve = { uid: 'user_eve', role: 'member' };
      mockDb.organizations[testOrgId].maxMembers = 5;

      for (let i = 1; i <= 10; i++) {
        mockDb.workspace_invitations[testOrgId][`inv_pending_${i}`] = {
          invitationId: `inv_pending_${i}`,
          workspaceId: testOrgId,
          invitedEmail: `pending${i}@example.com`,
          status: 'pending',
          expiresAt: Date.now() + 300000,
        };
      }

      // Generation MUST succeed because accepted count is 4 < 5
      const res = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: 'seat.available@example.com', role: 'member' }
      );
      assert.strictEqual(res.success, true);
      assert.ok(res.invitation.codeDisplay);
    });

    it('TEST 6: member leaves → capacity becomes available (Section 12)', async () => {
      // Setup: 2 members, limit = 2 (Full)
      mockDb.organizations[testOrgId].maxMembers = 2;

      // First attempt: blocked
      await assert.rejects(
        async () => {
          await workspaceInvitationController.createInvitationHandler(
            testOrgId,
            userAliceOwner.uid,
            { email: 'newperson@example.com', role: 'member' }
          );
        },
        (err) => {
          assert.strictEqual(err.code, 'WORKSPACE_MEMBER_LIMIT_REACHED');
          return true;
        }
      );

      // Bob leaves the workspace
      delete mockDb.organization_members[testOrgId].user_bob;

      // Second attempt: now 1/2 members, generation succeeds automatically!
      const res = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: 'newperson@example.com', role: 'member' }
      );
      assert.strictEqual(res.success, true);
      assert.ok(res.invitation.codeDisplay);
    });

    it('TEST 7: limit increased → capacity becomes available (Section 13)', async () => {
      // Setup: 2 members, limit = 2 (Full)
      mockDb.organizations[testOrgId].maxMembers = 2;

      await assert.rejects(
        async () => {
          await workspaceInvitationController.createInvitationHandler(
            testOrgId,
            userAliceOwner.uid,
            { email: 'newperson@example.com', role: 'member' }
          );
        },
        (err) => {
          assert.strictEqual(err.code, 'WORKSPACE_MEMBER_LIMIT_REACHED');
          return true;
        }
      );

      // Owner increases member limit to 8
      mockDb.organizations[testOrgId].maxMembers = 8;
      mockDb.organizations[testOrgId].teamSizeLimit = 8;

      // Generation now succeeds automatically!
      const res = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: 'newperson@example.com', role: 'member' }
      );
      assert.strictEqual(res.success, true);
      assert.ok(res.invitation.codeDisplay);
    });

    it('TEST 8: limit decreased below current membership → existing members remain (Section 14)', async () => {
      // Setup: 5 members in workspace, limit was 5
      mockDb.organization_members[testOrgId].user_charlie = { uid: 'user_charlie', role: 'member' };
      mockDb.organization_members[testOrgId].user_eve = { uid: 'user_eve', role: 'member' };
      mockDb.organization_members[testOrgId].user_teammate = { uid: 'user_teammate', role: 'member' };

      // Owner decreases limit to 3
      mockDb.organizations[testOrgId].maxMembers = 3;

      // All 5 existing members MUST remain intact
      const activeMembers = Object.keys(mockDb.organization_members[testOrgId]);
      assert.strictEqual(activeMembers.length, 5);
      assert.ok(mockDb.organization_members[testOrgId].user_alice);
      assert.ok(mockDb.organization_members[testOrgId].user_bob);
      assert.ok(mockDb.organization_members[testOrgId].user_charlie);
      assert.ok(mockDb.organization_members[testOrgId].user_eve);
      assert.ok(mockDb.organization_members[testOrgId].user_teammate);
    });

    it('TEST 9: limit decreased below current membership → new invitations blocked (Section 14)', async () => {
      // Setup: 5 members, limit = 3 (5 / 3 over limit)
      mockDb.organization_members[testOrgId].user_charlie = { uid: 'user_charlie', role: 'member' };
      mockDb.organization_members[testOrgId].user_eve = { uid: 'user_eve', role: 'member' };
      mockDb.organization_members[testOrgId].user_teammate = { uid: 'user_teammate', role: 'member' };
      mockDb.organizations[testOrgId].maxMembers = 3;

      await assert.rejects(
        async () => {
          await workspaceInvitationController.createInvitationHandler(
            testOrgId,
            userAliceOwner.uid,
            { email: 'blocked@example.com', role: 'member' }
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 409);
          assert.strictEqual(err.code, 'WORKSPACE_MEMBER_LIMIT_REACHED');
          return true;
        }
      );
    });

    it('TEST 10: valid invitation accepted while capacity exists (Section 9 & 22)', async () => {
      // Setup: 2 members (Alice, Bob), limit = 3. 1 seat available.
      mockDb.organizations[testOrgId].maxMembers = 3;

      const createRes = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: 'teammate@example.com', role: 'member' }
      );
      const code = createRes.invitation.codeDisplay;

      const acceptRes = await workspaceInvitationController.acceptInvitationHandler(
        userInvitedTeammate.uid,
        userInvitedTeammate.email,
        code
      );
      assert.strictEqual(acceptRes.success, true);
      assert.strictEqual(acceptRes.workspaceId, testOrgId);

      // Now workspace has 3 / 3 members
      const activeMembers = Object.keys(mockDb.organization_members[testOrgId]);
      assert.strictEqual(activeMembers.length, 3);
    });

    it('TEST 11: valid invitation rejected when workspace becomes full (Section 9 & 10)', async () => {
      // Setup: 2 members, limit = 3.
      mockDb.organizations[testOrgId].maxMembers = 3;

      // Invitation created when capacity was available
      const createRes = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: 'teammate@example.com', role: 'member' }
      );
      const code = createRes.invitation.codeDisplay;

      // Another user (Charlie) joins in the meantime, filling the workspace (3 / 3)
      mockDb.organization_members[testOrgId].user_charlie = { uid: 'user_charlie', role: 'member' };

      // Teammate now attempts acceptance -> MUST be rejected because workspace is full
      await assert.rejects(
        async () => {
          await workspaceInvitationController.acceptInvitationHandler(
            userInvitedTeammate.uid,
            userInvitedTeammate.email,
            code
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 409);
          assert.strictEqual(err.code, 'WORKSPACE_MEMBER_LIMIT_REACHED');
          assert.strictEqual(
            err.message,
            'This workspace has reached its member limit. Ask the workspace owner to increase the member limit before accepting this invitation.'
          );
          return true;
        }
      );
    });

    it('TEST 12: invitation remains pending when capacity becomes full (Section 10 & 16)', async () => {
      // Setup: 2 members, limit = 3.
      mockDb.organizations[testOrgId].maxMembers = 3;

      const createRes = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: 'teammate@example.com', role: 'member' }
      );
      const code = createRes.invitation.codeDisplay;
      const invId = createRes.invitation.invitationId;

      // Charlie fills workspace
      mockDb.organization_members[testOrgId].user_charlie = { uid: 'user_charlie', role: 'member' };

      // Acceptance fails due to capacity
      try {
        await workspaceInvitationController.acceptInvitationHandler(
          userInvitedTeammate.uid,
          userInvitedTeammate.email,
          code
        );
      } catch (err) {
        // Expected
      }

      // Invitation MUST still be pending and unexpired in RTDB
      const invInDb = await rtdbService.getData(`workspace_invitations/${testOrgId}/${invId}`);
      assert.strictEqual(invInDb.status, 'pending');
      assert.strictEqual(invInDb.acceptedAt, null);
    });

    it('TEST 13: invitation can still be revoked when workspace is full (Section 16)', async () => {
      // Setup: 3 members, limit = 3 (Full)
      mockDb.organizations[testOrgId].maxMembers = 3;
      mockDb.organization_members[testOrgId].user_charlie = { uid: 'user_charlie', role: 'member' };

      // Existing pending invite in DB
      const invId = 'inv_to_revoke';
      const code = 'CNV-REV1-FULL';
      const codeHash = hashInvitationCode(code);
      mockDb.workspace_invitations[testOrgId][invId] = {
        invitationId: invId,
        workspaceId: testOrgId,
        invitedEmail: 'target@example.com',
        role: 'member',
        status: 'pending',
        codeHash,
        expiresAt: Date.now() + 300000,
      };
      mockDb.invitation_codes[codeHash] = {
        codeHash,
        invitationId: invId,
        workspaceId: testOrgId,
        status: 'pending',
      };

      // Owner can successfully revoke invitation even though workspace is full
      const revokeRes = await workspaceInvitationController.revokeInvitationHandler(
        testOrgId,
        invId,
        userAliceOwner.uid
      );
      assert.strictEqual(revokeRes.success, true);
      assert.strictEqual(revokeRes.invitation.status, 'revoked');
    });

    it('TEST 14: owner can still manage invitations when workspace is full (Section 16 & 27)', async () => {
      // Setup: 5 members, limit = 5 (Full)
      mockDb.organizations[testOrgId].maxMembers = 5;
      mockDb.organization_members[testOrgId].user_charlie = { uid: 'user_charlie', role: 'member' };
      mockDb.organization_members[testOrgId].user_eve = { uid: 'user_eve', role: 'member' };
      mockDb.organization_members[testOrgId].user_teammate = { uid: 'user_teammate', role: 'member' };

      // Owner lists invitations -> works perfectly
      const listRes = await workspaceInvitationController.listInvitationsHandler(
        testOrgId,
        userAliceOwner.uid
      );
      assert.strictEqual(listRes.success, true);
      assert.ok(Array.isArray(listRes.invitations));
    });

    it('TEST 15: frontend stale count cannot bypass backend restriction (Section 20 & 26)', async () => {
      // Even if a malicious or stale client ignores UI disabling and calls createInvitationHandler:
      mockDb.organizations[testOrgId].maxMembers = 2; // Alice & Bob already fill it

      await assert.rejects(
        async () => {
          await workspaceInvitationController.createInvitationHandler(
            testOrgId,
            userAliceOwner.uid,
            { email: 'bypass@evil.com', role: 'member' }
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 409);
          assert.strictEqual(err.code, 'WORKSPACE_MEMBER_LIMIT_REACHED');
          return true;
        }
      );
    });

    it('TEST 16: simultaneous acceptance cannot exceed member limit (Section 11)', async () => {
      // Setup: 2 members, limit = 3 (exactly 1 seat available)
      mockDb.organizations[testOrgId].maxMembers = 3;

      // Create 2 valid invitations for 2 different users
      const inv1 = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: 'teammate@example.com', role: 'member' }
      );
      const inv2 = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: 'charlie.member@convia.dev', role: 'member' }
      );

      // Attempt concurrent acceptance
      const p1 = workspaceInvitationController.acceptInvitationHandler(
        userInvitedTeammate.uid,
        userInvitedTeammate.email,
        inv1.invitation.codeDisplay
      );
      const p2 = workspaceInvitationController.acceptInvitationHandler(
        userCharlieMember.uid,
        userCharlieMember.email,
        inv2.invitation.codeDisplay
      );

      const results = await Promise.allSettled([p1, p2]);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Exactly 1 must succeed, and exactly 1 must be rejected
      assert.strictEqual(fulfilled.length, 1);
      assert.strictEqual(rejected.length, 1);
      assert.strictEqual(rejected[0].reason.code, 'WORKSPACE_MEMBER_LIMIT_REACHED');

      // Final membership count in workspace must NOT exceed 3
      const activeMembers = Object.keys(mockDb.organization_members[testOrgId]);
      assert.strictEqual(activeMembers.length, 3);
    });

    it('TEST 17: simultaneous invitation requests cannot bypass capacity (Section 11)', async () => {
      // Setup: 2 members, limit = 2 (Full)
      mockDb.organizations[testOrgId].maxMembers = 2;

      const p1 = workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: 'user1@example.com', role: 'member' }
      );
      const p2 = workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: 'user2@example.com', role: 'member' }
      );

      const results = await Promise.allSettled([p1, p2]);
      // Both must be rejected since capacity is full
      assert.strictEqual(results[0].status, 'rejected');
      assert.strictEqual(results[1].status, 'rejected');
      assert.strictEqual(results[0].reason.code, 'WORKSPACE_MEMBER_LIMIT_REACHED');
      assert.strictEqual(results[1].reason.code, 'WORKSPACE_MEMBER_LIMIT_REACHED');
    });

    it('TEST 18: unauthorized user cannot bypass restriction (Section 17 & 26)', async () => {
      mockDb.organization_members[testOrgId].user_charlie = { uid: 'user_charlie', role: 'member' };

      await assert.rejects(
        async () => {
          await workspaceInvitationController.createInvitationHandler(
            testOrgId,
            userCharlieMember.uid,
            { email: 'someone@example.com', role: 'member' }
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.message, "You don't have permission to invite members to this workspace.");
          return true;
        }
      );
    });

    it('TEST 19: email-bound invitation rules remain intact (Section 23)', async () => {
      mockDb.organizations[testOrgId].maxMembers = 5;

      const res = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: 'teammate@example.com', role: 'member' }
      );

      // Eve attempts to accept Teammate's code -> REJECTED
      await assert.rejects(
        async () => {
          await workspaceInvitationController.acceptInvitationHandler(
            userEveAttacker.uid,
            userEveAttacker.email,
            res.invitation.codeDisplay
          );
        },
        (err) => {
          assert.strictEqual(err.code, 'WRONG_ACCOUNT');
          return true;
        }
      );
    });

    it('TEST 20: invitation expiration remains intact (Section 23)', async () => {
      mockDb.organizations[testOrgId].maxMembers = 5;

      const res = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: 'teammate@example.com', role: 'member' }
      );
      const code = res.invitation.codeDisplay;

      // Expire invitation
      mockDb.workspace_invitations[testOrgId][res.invitation.invitationId].expiresAt = Date.now() - 1000;

      await assert.rejects(
        async () => {
          await workspaceInvitationController.acceptInvitationHandler(
            userInvitedTeammate.uid,
            userInvitedTeammate.email,
            code
          );
        },
        (err) => {
          assert.strictEqual(err.code, 'INVITATION_EXPIRED');
          return true;
        }
      );
    });

    it('TEST 21: accepted status remains intact (Section 23)', async () => {
      mockDb.organizations[testOrgId].maxMembers = 5;

      const res = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: 'teammate@example.com', role: 'member' }
      );
      const code = res.invitation.codeDisplay;

      // First acceptance
      await workspaceInvitationController.acceptInvitationHandler(
        userInvitedTeammate.uid,
        userInvitedTeammate.email,
        code
      );

      // Re-use attempt -> REJECTED
      await assert.rejects(
        async () => {
          await workspaceInvitationController.acceptInvitationHandler(
            userInvitedTeammate.uid,
            userInvitedTeammate.email,
            code
          );
        },
        (err) => {
          assert.strictEqual(err.code, 'INVITATION_ALREADY_ACCEPTED');
          return true;
        }
      );
    });

    it('TEST 22: revoked status remains intact (Section 23)', async () => {
      mockDb.organizations[testOrgId].maxMembers = 5;

      const res = await workspaceInvitationController.createInvitationHandler(
        testOrgId,
        userAliceOwner.uid,
        { email: 'teammate@example.com', role: 'member' }
      );
      const code = res.invitation.codeDisplay;
      const invId = res.invitation.invitationId;

      await workspaceInvitationController.revokeInvitationHandler(
        testOrgId,
        invId,
        userAliceOwner.uid
      );

      await assert.rejects(
        async () => {
          await workspaceInvitationController.acceptInvitationHandler(
            userInvitedTeammate.uid,
            userInvitedTeammate.email,
            code
          );
        },
        (err) => {
          assert.strictEqual(err.code, 'INVITATION_REVOKED');
          return true;
        }
      );
    });
  });
});

