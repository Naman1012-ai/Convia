import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { runDiscussionMigration } from '../../scripts/migrateDiscussions.js';

describe('🧪 CONVIA STEP 4C.5 — DISCUSSION PATH MIGRATION ENGINE & CASUAL VERIFICATION TEST SUITE', () => {
  let mockDb;
  let mockRtdbService;

  beforeEach(() => {
    mockDb = {
      organizations: {
        ws_alpha: { orgId: 'ws_alpha', name: 'Alpha Workspace' },
        ws_beta: { orgId: 'ws_beta', name: 'Beta Workspace' },
      },
      workspaces: {},
      ideas: {
        ws_alpha: {
          idea_ws_1: { ideaId: 'idea_ws_1', title: 'Alpha Idea 1', orgId: 'ws_alpha' },
          idea_ws_multi: { ideaId: 'idea_ws_multi', title: 'Alpha Multi Idea', orgId: 'ws_alpha' },
        },
        ws_beta: {
          idea_ws_2: { ideaId: 'idea_ws_2', title: 'Beta Idea 2', orgId: 'ws_beta' },
        },
      },
      publicIdeas: {
        idea_pub_1: { ideaId: 'idea_pub_1', title: 'Public Idea 1' },
      },
      discussions: {
        // Legacy flat discussion roots: discussions/{ideaId}/{discussionId}
        idea_ws_1: {
          disc_1: {
            discussionId: 'disc_1',
            message: 'Alpha discussion 1',
            authorId: 'user_alice',
            createdAt: 1000,
          },
        },
        idea_pub_1: {
          disc_pub: {
            discussionId: 'disc_pub',
            message: 'Public discussion 1',
            authorId: 'user_bob',
            createdAt: 2000,
          },
        },
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

  it('1. Legacy discussion for a workspace idea -> MIGRATE to discussions/${orgId}/${ideaId}/${discussionId}', async () => {
    const report = await runDiscussionMigration({ isDryRun: true, db: mockRtdbService });
    const item = report.classifications.find((c) => c.ideaId === 'idea_ws_1' && c.discussionId === 'disc_1');

    assert.ok(item, 'Item must be classified');
    assert.strictEqual(item.status, 'MIGRATE');
    assert.strictEqual(item.targetPath, 'discussions/ws_alpha/idea_ws_1/disc_1');
    assert.strictEqual(item.record.orgId, 'ws_alpha');
  });

  it('2. Legacy discussion for a public idea -> MIGRATE to discussions/public/${ideaId}/${discussionId}', async () => {
    const report = await runDiscussionMigration({ isDryRun: true, db: mockRtdbService });
    const item = report.classifications.find((c) => c.ideaId === 'idea_pub_1' && c.discussionId === 'disc_pub');

    assert.ok(item, 'Item must be classified');
    assert.strictEqual(item.status, 'MIGRATE');
    assert.strictEqual(item.targetPath, 'discussions/public/idea_pub_1/disc_pub');
    assert.strictEqual(item.record.orgId, null);
  });

  it('3. Canonical record already exists with identical payload -> ALREADY_CANONICAL (no-op)', async () => {
    // Add identical canonical record
    mockDb.discussions.ws_alpha = {
      idea_ws_1: {
        disc_1: {
          discussionId: 'disc_1',
          message: 'Alpha discussion 1',
          authorId: 'user_alice',
          createdAt: 1000,
        },
      },
    };

    const report = await runDiscussionMigration({ isDryRun: true, db: mockRtdbService });
    const item = report.classifications.find((c) => c.ideaId === 'idea_ws_1' && c.discussionId === 'disc_1');

    assert.ok(item);
    assert.strictEqual(item.status, 'ALREADY_CANONICAL');
    assert.strictEqual(report.alreadyCanonicalCount, 1);
  });

  it('4. Canonical record already exists with differing payload -> CANONICAL_CONFLICT (no overwrite, canonical preserved)', async () => {
    // Add differing canonical record
    mockDb.discussions.ws_alpha = {
      idea_ws_1: {
        disc_1: {
          discussionId: 'disc_1',
          message: 'Canonical edited message',
          authorId: 'user_alice',
          createdAt: 1000,
        },
      },
    };

    const report = await runDiscussionMigration({ isDryRun: false, db: mockRtdbService });
    const conflict = report.conflicts.find((c) => c.ideaId === 'idea_ws_1' && c.discussionId === 'disc_1');

    assert.ok(conflict, 'Conflict must be recorded');
    assert.strictEqual(conflict.status, 'CANONICAL_CONFLICT');
    assert.strictEqual(conflict.chosenAuthority, 'canonical');
    // Ensure canonical was not overwritten
    assert.strictEqual(mockDb.discussions.ws_alpha.idea_ws_1.disc_1.message, 'Canonical edited message');
  });

  it('5. Missing parent idea in both workspace and public ideas -> ORPHANED_IDEA (skip, do not guess org)', async () => {
    mockDb.discussions.idea_ghost = {
      disc_ghost: {
        discussionId: 'disc_ghost',
        message: 'Ghost message',
        authorId: 'user_ghost',
      },
    };

    const report = await runDiscussionMigration({ isDryRun: true, db: mockRtdbService });
    const item = report.classifications.find((c) => c.ideaId === 'idea_ghost');

    assert.ok(item);
    assert.strictEqual(item.status, 'ORPHANED_IDEA');
    assert.strictEqual(report.orphanedCount, 1);
  });

  it('6. Malformed legacy record (missing discussionId or message) -> INVALID (skip, count)', async () => {
    mockDb.discussions.idea_ws_1.disc_no_msg = {
      discussionId: 'disc_no_msg',
      authorId: 'user_alice',
    };
    mockDb.discussions.idea_ws_1.disc_no_id = {
      message: 'Missing id',
      authorId: 'user_alice',
    };
    mockDb.discussions.idea_ws_1.disc_null = null;

    const report = await runDiscussionMigration({ isDryRun: true, db: mockRtdbService });
    assert.ok(report.invalidCount >= 2, 'Malformed records must be counted as invalid');
  });

  it('7. Deleted legacy discussion (isDeleted: true) -> preserved as isDeleted: true in canonical target', async () => {
    mockDb.discussions.idea_ws_1.disc_del = {
      id: 'disc_del',
      message: 'Comment deleted',
      authorId: 'user_alice',
      isDeleted: true,
      createdAt: 1050,
    };

    const report = await runDiscussionMigration({ isDryRun: false, db: mockRtdbService });
    const item = report.classifications.find((c) => c.discussionId === 'disc_del');
    assert.strictEqual(item.status, 'MIGRATED');

    const canonical = mockDb.discussions.ws_alpha.idea_ws_1.disc_del;
    assert.ok(canonical, 'Canonical record must exist');
    assert.strictEqual(canonical.isDeleted, true);
    assert.strictEqual(canonical.message, 'Comment deleted');
  });

  it('8. Full payload preservation (parentId, createdAt, updatedAt, authorName, authorAvatar, uid, etc.)', async () => {
    mockDb.discussions.idea_ws_1.disc_rich = {
      discussionId: 'disc_rich',
      message: 'Rich discussion',
      parentId: 'parent_123',
      createdAt: 1111,
      updatedAt: 2222,
      authorName: 'Alice Contributor',
      authorAvatar: 'https://example.com/avatar.png',
      authorId: 'user_alice',
      type: 'suggestion',
      isAccepted: true,
    };

    await runDiscussionMigration({ isDryRun: false, db: mockRtdbService });
    const canonical = mockDb.discussions.ws_alpha.idea_ws_1.disc_rich;

    assert.ok(canonical);
    assert.strictEqual(canonical.discussionId, 'disc_rich');
    assert.strictEqual(canonical.message, 'Rich discussion');
    assert.strictEqual(canonical.parentId, 'parent_123');
    assert.strictEqual(canonical.createdAt, 1111);
    assert.strictEqual(canonical.updatedAt, 2222);
    assert.strictEqual(canonical.authorName, 'Alice Contributor');
    assert.strictEqual(canonical.authorAvatar, 'https://example.com/avatar.png');
    assert.strictEqual(canonical.authorId, 'user_alice');
    assert.strictEqual(canonical.type, 'suggestion');
    assert.strictEqual(canonical.isAccepted, true);
  });

  it('9. Idempotency: running migration twice produces identical database state and 0 writes on second run', async () => {
    // Run 1: live execution
    const rep1 = await runDiscussionMigration({ isDryRun: false, db: mockRtdbService });
    assert.strictEqual(rep1.migratedCount, 2);

    // Run 2: live execution
    const rep2 = await runDiscussionMigration({ isDryRun: false, db: mockRtdbService });
    assert.strictEqual(rep2.migratedCount, 0, 'Second run must migrate 0 records');
    assert.strictEqual(rep2.eligibleCount, 0, 'Second run must find 0 eligible candidates');
    assert.strictEqual(rep2.alreadyCanonicalCount, 2, 'Both records now ALREADY_CANONICAL');
  });

  it('10. Dry-run safety: zero writes executed against database in dry-run mode', async () => {
    let writeCalled = false;
    mockRtdbService.setData = async () => { writeCalled = true; };

    const report = await runDiscussionMigration({ isDryRun: true, db: mockRtdbService });
    assert.strictEqual(report.mode, 'dry-run');
    assert.strictEqual(writeCalled, false, 'Zero writes must occur in dry run');
    assert.strictEqual(mockDb.discussions.ws_alpha, undefined);
  });

  it('11. Execute mode writes: exactly candidate writes executed and verified', async () => {
    const report = await runDiscussionMigration({ isDryRun: false, db: mockRtdbService });
    assert.strictEqual(report.mode, 'execute');
    assert.strictEqual(report.migratedCount, report.eligibleCount);
    assert.ok(mockDb.discussions.ws_alpha.idea_ws_1.disc_1);
    assert.ok(mockDb.discussions.public.idea_pub_1.disc_pub);
  });

  it('12. Legacy preservation: legacy records are NEVER modified or deleted', async () => {
    await runDiscussionMigration({ isDryRun: false, db: mockRtdbService });
    assert.ok(mockDb.discussions.idea_ws_1.disc_1, 'Legacy workspace discussion must be untouched');
    assert.ok(mockDb.discussions.idea_pub_1.disc_pub, 'Legacy public discussion must be untouched');
  });

  it('13. No cross-org leakage: discussions for org A never written to org B', async () => {
    await runDiscussionMigration({ isDryRun: false, db: mockRtdbService });
    assert.strictEqual(mockDb.discussions?.ws_beta?.idea_ws_1, undefined);
  });

  it('14. Multiple discussions per idea correctly batched and migrated', async () => {
    mockDb.discussions.idea_ws_multi = {
      disc_a: { discussionId: 'disc_a', message: 'Comment A', authorId: 'user_alice' },
      disc_b: { discussionId: 'disc_b', message: 'Comment B', authorId: 'user_bob' },
      disc_c: { discussionId: 'disc_c', message: 'Comment C', authorId: 'user_alice' },
    };

    const report = await runDiscussionMigration({ isDryRun: false, db: mockRtdbService });
    assert.ok(mockDb.discussions.ws_alpha.idea_ws_multi.disc_a);
    assert.ok(mockDb.discussions.ws_alpha.idea_ws_multi.disc_b);
    assert.ok(mockDb.discussions.ws_alpha.idea_ws_multi.disc_c);
  });

  it('15. Multiple ideas across different orgs correctly partitioned', async () => {
    mockDb.discussions.idea_ws_2 = {
      disc_beta: { discussionId: 'disc_beta', message: 'Beta Comment', authorId: 'user_bob' },
    };

    await runDiscussionMigration({ isDryRun: false, db: mockRtdbService });
    assert.ok(mockDb.discussions.ws_alpha.idea_ws_1.disc_1);
    assert.ok(mockDb.discussions.ws_beta.idea_ws_2.disc_beta);
  });

  it('16. publicIdeas fallback lookup correctly identifies public ideas', async () => {
    mockDb.discussions.idea_pub_solo = {
      disc_solo: { discussionId: 'disc_solo', message: 'Solo public comment', authorId: 'user_c' },
    };
    mockDb.publicIdeas.idea_pub_solo = { ideaId: 'idea_pub_solo', title: 'Solo Public Idea' };

    const report = await runDiscussionMigration({ isDryRun: false, db: mockRtdbService });
    assert.ok(mockDb.discussions.public.idea_pub_solo.disc_solo);
  });

  it('17. Workspace ideas lookup correctly maps ideaId to orgId', async () => {
    const report = await runDiscussionMigration({ isDryRun: true, db: mockRtdbService });
    const item = report.classifications.find((c) => c.ideaId === 'idea_ws_1');
    assert.strictEqual(item.targetPath, 'discussions/ws_alpha/idea_ws_1/disc_1');
  });

  it('18. Edge case: discussions root empty or missing -> 0 scans, clean exit', async () => {
    mockDb.discussions = {};
    const report1 = await runDiscussionMigration({ isDryRun: true, db: mockRtdbService });
    assert.strictEqual(report1.scannedCount, 0);

    mockDb.discussions = null;
    const report2 = await runDiscussionMigration({ isDryRun: true, db: mockRtdbService });
    assert.strictEqual(report2.scannedCount, 0);
  });

  it('19. Edge case: topLevelKey is already canonical orgId/public -> skipped, not re-migrated', async () => {
    mockDb.discussions = {
      public: {
        idea_pub_1: {
          disc_pub: { discussionId: 'disc_pub', message: 'Already canonical public', authorId: 'user_bob' },
        },
      },
      ws_alpha: {
        idea_ws_1: {
          disc_1: { discussionId: 'disc_1', message: 'Already canonical alpha', authorId: 'user_alice' },
        },
      },
    };

    const report = await runDiscussionMigration({ isDryRun: true, db: mockRtdbService });
    assert.strictEqual(report.scannedCount, 0, 'Canonical containers must not be scanned as legacy items');
    assert.strictEqual(report.eligibleCount, 0);
  });

  it('20. Report structure verification: scannedCount, eligibleCount, migratedCount, alreadyCanonicalCount, conflictCount, orphanedCount, invalidCount, errorCount all correctly reconciled', async () => {
    mockDb.discussions = {
      idea_ws_1: {
        disc_valid: { discussionId: 'disc_valid', message: 'Valid', authorId: 'u1' },
        disc_invalid: { authorId: 'u1' }, // Missing id and message
      },
      idea_ghost: {
        disc_orphan: { discussionId: 'disc_orphan', message: 'Orphan', authorId: 'u1' },
      },
      ws_alpha: {
        idea_ws_1: {
          disc_already: { discussionId: 'disc_already', message: 'Already', authorId: 'u1' },
          disc_conflict: { discussionId: 'disc_conflict', message: 'Canonical', authorId: 'u1' },
        },
      },
    };

    // Add legacy items that map to canonical
    mockDb.discussions.idea_ws_1.disc_already = { discussionId: 'disc_already', message: 'Already', authorId: 'u1' };
    mockDb.discussions.idea_ws_1.disc_conflict = { discussionId: 'disc_conflict', message: 'Legacy differ', authorId: 'u1' };

    const report = await runDiscussionMigration({ isDryRun: true, db: mockRtdbService });

    // Mathematical reconciliation check
    const totalPartitioned = report.invalidCount + report.orphanedCount + report.alreadyCanonicalCount + report.conflictCount + report.eligibleCount;
    assert.strictEqual(report.scannedCount, totalPartitioned, 'scannedCount must equal sum of partitioned buckets');
    assert.strictEqual(report.invalidCount, 1);
    assert.strictEqual(report.orphanedCount, 1);
    assert.strictEqual(report.alreadyCanonicalCount, 1);
    assert.strictEqual(report.conflictCount, 1);
    assert.strictEqual(report.eligibleCount, 1);
    assert.strictEqual(report.errorCount, 0);
  });
});
