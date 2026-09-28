import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { runWorkspaceMembersMigration, normalizeCanonicalRole } from '../../scripts/migrateWorkspaceMembers.js';

describe('🧪 CONVIA STEP 4C.2 — WORKSPACE MEMBERSHIP MIGRATION ENGINE & DRY-RUN TEST SUITE', () => {
  let mockDb;
  let mockAuth;
  let mockRtdbService;

  beforeEach(() => {
    mockDb = {
      organizations: {
        ws_alpha: { orgId: 'ws_alpha', name: 'Alpha Workspace', ownerId: 'user_alice', isDeleted: false },
        ws_beta: { orgId: 'ws_beta', name: 'Beta Workspace', ownerId: 'user_bob', isDeleted: false },
        ws_deleted: { orgId: 'ws_deleted', name: 'Deleted Workspace', isDeleted: true },
      },
      workspaces: {},
      users: {
        user_alice: { uid: 'user_alice', name: 'Alice' },
        user_bob: { uid: 'user_bob', name: 'Bob' },
        user_charlie: { uid: 'user_charlie', name: 'Charlie' },
        user_david: { uid: 'user_david', name: 'David' },
        user_eve: { uid: 'user_eve', name: 'Eve' },
      },
      organization_members: {
        ws_alpha: {
          user_alice: { uid: 'user_alice', role: 'owner', joinedAt: 1000 },
          user_bob: { uid: 'user_bob', role: 'admin', joinedAt: 1100 }, // Canonical has admin
        },
      },
      workspace_members: {
        ws_alpha: {
          user_alice: { uid: 'user_alice', role: 'owner', joinedAt: 1000 }, // CASE C: identical
          user_bob: { uid: 'user_bob', role: 'member', joinedAt: 900 },      // CASE D: conflict (legacy says member, canonical says admin)
          user_charlie: { uid: 'user_charlie', role: 'member', joinedAt: 1200 }, // CASE A: legacy-only, eligible
        },
        ws_beta: {
          user_david: { uid: 'user_david', role: 'admin', joinedAt: 1300 }, // CASE A: legacy-only, eligible
        },
        ws_missing: {
          user_eve: { uid: 'user_eve', role: 'member', joinedAt: 1400 }, // CASE E: missing workspace
        },
        ws_deleted: {
          user_eve: { uid: 'user_eve', role: 'member', joinedAt: 1450 }, // CASE E: deleted workspace
        },
        ws_alpha: {
          user_alice: { uid: 'user_alice', role: 'owner', joinedAt: 1000 },
          user_bob: { uid: 'user_bob', role: 'member', joinedAt: 900 },
          user_charlie: { uid: 'user_charlie', role: 'member', joinedAt: 1200 },
          user_ghost: { uid: 'user_ghost', role: 'member', joinedAt: 1500 }, // CASE F: user does not exist
        },
      },
    };

    mockAuth = {
      getUser: async (uid) => {
        if (mockDb.users[uid]) return { uid };
        const err = new Error('User not found');
        err.code = 'auth/user-not-found';
        throw err;
      },
    };

    mockRtdbService = {
      getData: async (path) => {
        const parts = path.split('/').filter(Boolean);
        let curr = mockDb;
        for (const p of parts) {
          if (!curr || typeof curr !== 'object') return null;
          curr = curr[p];
        }
        return curr !== undefined ? JSON.parse(JSON.stringify(curr)) : null;
      },
      setData: async (path, data) => {
        const parts = path.split('/').filter(Boolean);
        let curr = mockDb;
        for (let i = 0; i < parts.length - 1; i++) {
          const p = parts[i];
          if (!curr[p] || typeof curr[p] !== 'object') curr[p] = {};
          curr = curr[p];
        }
        curr[parts[parts.length - 1]] = JSON.parse(JSON.stringify(data));
        return true;
      },
    };
  });

  it('1. Legacy-only membership is classified as MIGRATE', async () => {
    const report = await runWorkspaceMembersMigration({ isDryRun: true, db: mockRtdbService, auth: mockAuth });
    const charlieItem = report.classifications.find((c) => c.workspaceId === 'ws_alpha' && c.uid === 'user_charlie');

    assert.ok(charlieItem, 'user_charlie classification must be present');
    assert.strictEqual(charlieItem.status, 'MIGRATE');
    assert.strictEqual(charlieItem.record.role, 'member');
    assert.strictEqual(charlieItem.record.uid, 'user_charlie');
  });

  it('2. Canonical-only membership results in NO-OP for that user', async () => {
    // Add user_eve to organization_members only
    mockDb.organization_members.ws_alpha.user_eve = { uid: 'user_eve', role: 'member', joinedAt: 1600 };
    delete mockDb.workspace_members.ws_alpha.user_eve;

    const report = await runWorkspaceMembersMigration({ isDryRun: true, db: mockRtdbService, auth: mockAuth });
    const eveItem = report.classifications.find((c) => c.workspaceId === 'ws_alpha' && c.uid === 'user_eve');

    assert.strictEqual(eveItem, undefined, 'Canonical-only user should not appear in legacy scan');
  });

  it('3. Both identical records are classified as ALREADY_CANONICAL', async () => {
    const report = await runWorkspaceMembersMigration({ isDryRun: true, db: mockRtdbService, auth: mockAuth });
    const aliceItem = report.classifications.find((c) => c.workspaceId === 'ws_alpha' && c.uid === 'user_alice');

    assert.ok(aliceItem);
    assert.strictEqual(aliceItem.status, 'ALREADY_CANONICAL');
    assert.strictEqual(aliceItem.role, 'owner');
  });

  it('4. Differing records are classified as CANONICAL_CONFLICT without overwrite', async () => {
    const report = await runWorkspaceMembersMigration({ isDryRun: true, db: mockRtdbService, auth: mockAuth });
    const bobConflict = report.conflicts.find((c) => c.workspaceId === 'ws_alpha' && c.uid === 'user_bob');

    assert.ok(bobConflict, 'Conflict must be recorded');
    assert.strictEqual(bobConflict.status, 'CANONICAL_CONFLICT');
    assert.strictEqual(bobConflict.legacyRole, 'member');
    assert.strictEqual(bobConflict.canonicalRole, 'admin');
    assert.strictEqual(bobConflict.chosenAuthority, 'canonical');
  });

  it('5. Missing or deleted workspace is classified as ORPHANED_WORKSPACE', async () => {
    mockDb.workspace_members.ws_missing = { user_alice: { uid: 'user_alice', role: 'member' } };
    mockDb.workspace_members.ws_deleted = { user_alice: { uid: 'user_alice', role: 'member' } };

    const report = await runWorkspaceMembersMigration({ isDryRun: true, db: mockRtdbService, auth: mockAuth });
    const missingWsItem = report.classifications.find((c) => c.workspaceId === 'ws_missing');
    const deletedWsItem = report.classifications.find((c) => c.workspaceId === 'ws_deleted');

    assert.ok(missingWsItem);
    assert.strictEqual(missingWsItem.status, 'ORPHANED_WORKSPACE');
    assert.ok(deletedWsItem);
    assert.strictEqual(deletedWsItem.status, 'ORPHANED_WORKSPACE');
  });

  it('6. Missing/unverified user is classified as ORPHANED_USER', async () => {
    const report = await runWorkspaceMembersMigration({ isDryRun: true, db: mockRtdbService, auth: mockAuth });
    const ghostItem = report.classifications.find((c) => c.workspaceId === 'ws_alpha' && c.uid === 'user_ghost');

    assert.ok(ghostItem);
    assert.strictEqual(ghostItem.status, 'ORPHANED_USER');
  });

  it('7. Malformed record or key is classified as INVALID', async () => {
    mockDb.workspace_members.ws_alpha['[object Object]'] = { uid: '[object Object]', role: 'member' };
    mockDb.workspace_members.ws_alpha['user_null'] = null;

    const report = await runWorkspaceMembersMigration({ isDryRun: true, db: mockRtdbService, auth: mockAuth });
    assert.ok(report.invalidCount >= 2, 'Malformed records must be counted as invalid');
  });

  it('8. Dry-run performs zero writes to database', async () => {
    let writeCalled = false;
    mockRtdbService.setData = async () => { writeCalled = true; };

    const report = await runWorkspaceMembersMigration({ isDryRun: true, db: mockRtdbService, auth: mockAuth });
    assert.strictEqual(report.mode, 'dry-run');
    assert.strictEqual(writeCalled, false, 'Dry-run must execute zero database writes');
    assert.strictEqual(mockDb.organization_members.ws_alpha.user_charlie, undefined);
  });

  it('9. Execute creates canonical membership for eligible candidate', async () => {
    const report = await runWorkspaceMembersMigration({ isDryRun: false, db: mockRtdbService, auth: mockAuth });
    assert.strictEqual(report.mode, 'execute');
    assert.strictEqual(report.migratedCount, 2);

    const canonicalCharlie = mockDb.organization_members.ws_alpha.user_charlie;
    assert.ok(canonicalCharlie, 'user_charlie must now exist in organization_members');
    assert.strictEqual(canonicalCharlie.uid, 'user_charlie');
    assert.strictEqual(canonicalCharlie.role, 'member');

    const canonicalDavid = mockDb.organization_members.ws_beta.user_david;
    assert.ok(canonicalDavid, 'user_david must now exist in organization_members');
    assert.strictEqual(canonicalDavid.uid, 'user_david');
    assert.strictEqual(canonicalDavid.role, 'admin');
  });

  it('10. Execute does NOT delete legacy workspace_members record', async () => {
    await runWorkspaceMembersMigration({ isDryRun: false, db: mockRtdbService, auth: mockAuth });

    assert.ok(mockDb.workspace_members.ws_alpha.user_charlie, 'Legacy record must remain intact');
    assert.strictEqual(mockDb.workspace_members.ws_alpha.user_charlie.role, 'member');
  });

  it('11. Execute does NOT overwrite canonical membership', async () => {
    await runWorkspaceMembersMigration({ isDryRun: false, db: mockRtdbService, auth: mockAuth });

    // user_bob must still be admin in organization_members, not downgraded to member
    assert.strictEqual(mockDb.organization_members.ws_alpha.user_bob.role, 'admin');
  });

  it('12. Repeated execute execution is completely idempotent', async () => {
    // First execution
    const rep1 = await runWorkspaceMembersMigration({ isDryRun: false, db: mockRtdbService, auth: mockAuth });
    assert.strictEqual(rep1.migratedCount, 2);

    // Second execution
    const rep2 = await runWorkspaceMembersMigration({ isDryRun: false, db: mockRtdbService, auth: mockAuth });
    assert.strictEqual(rep2.migratedCount, 0, 'Second run must migrate 0 records');
    assert.strictEqual(rep2.eligibleCount, 0, 'Second run must find 0 eligible candidates');

    const charlieItem = rep2.classifications.find((c) => c.workspaceId === 'ws_alpha' && c.uid === 'user_charlie');
    assert.strictEqual(charlieItem.status, 'ALREADY_CANONICAL');
  });

  it('13. Role conflict never overwrites canonical role', async () => {
    mockDb.workspace_members.ws_alpha.user_bob = { uid: 'user_bob', role: 'owner' }; // Legacy claims owner
    mockDb.organization_members.ws_alpha.user_bob = { uid: 'user_bob', role: 'admin' }; // Canonical has admin

    await runWorkspaceMembersMigration({ isDryRun: false, db: mockRtdbService, auth: mockAuth });
    assert.strictEqual(mockDb.organization_members.ws_alpha.user_bob.role, 'admin');
  });

  it('14. Owner/admin canonical state always wins', async () => {
    mockDb.organization_members.ws_alpha.user_alice = { uid: 'user_alice', role: 'owner' };
    mockDb.workspace_members.ws_alpha.user_alice = { uid: 'user_alice', role: 'member' };

    await runWorkspaceMembersMigration({ isDryRun: false, db: mockRtdbService, auth: mockAuth });
    assert.strictEqual(mockDb.organization_members.ws_alpha.user_alice.role, 'owner');
  });

  it('15. Multiple workspaces are isolated and correctly attributed', async () => {
    mockDb.workspace_members.ws_beta = {
      user_david: { uid: 'user_david', role: 'member', joinedAt: 2000 },
    };
    mockDb.organization_members.ws_beta = {};

    await runWorkspaceMembersMigration({ isDryRun: false, db: mockRtdbService, auth: mockAuth });
    assert.ok(mockDb.organization_members.ws_beta.user_david);
    assert.strictEqual(mockDb.organization_members.ws_beta.user_david.uid, 'user_david');
    assert.strictEqual(mockDb.organization_members.ws_alpha.user_david, undefined);
  });

  it('16. Multiple users within one workspace are independently classified and processed', async () => {
    const report = await runWorkspaceMembersMigration({ isDryRun: true, db: mockRtdbService, auth: mockAuth });
    const alphaItems = report.classifications.filter((c) => c.workspaceId === 'ws_alpha');

    const statuses = new Set(alphaItems.map((i) => i.status));
    assert.ok(statuses.has('ALREADY_CANONICAL'), 'Must have ALREADY_CANONICAL for user_alice');
    assert.ok(statuses.has('CANONICAL_CONFLICT'), 'Must have CANONICAL_CONFLICT for user_bob');
    assert.ok(statuses.has('MIGRATE'), 'Must have MIGRATE for user_charlie');
    assert.ok(statuses.has('ORPHANED_USER'), 'Must have ORPHANED_USER for user_ghost');
  });

  it('17. normalizeCanonicalRole normalizes invalid or case-variant roles', () => {
    assert.strictEqual(normalizeCanonicalRole('OWNER'), 'owner');
    assert.strictEqual(normalizeCanonicalRole('Admin'), 'admin');
    assert.strictEqual(normalizeCanonicalRole('member'), 'member');
    assert.strictEqual(normalizeCanonicalRole('superadmin'), 'member');
    assert.strictEqual(normalizeCanonicalRole(null), 'member');
    assert.strictEqual(normalizeCanonicalRole(123), 'member');
  });
});
