/**
 * Idempotent Discussion Path Migration Utility
 * Migrates legacy flat discussions:
 *   discussions/{ideaId}/{discussionId}
 * To workspace-aware hierarchical paths:
 *   discussions/{orgId}/{ideaId}/{discussionId}  (Workspace Ideas)
 *   discussions/public/{ideaId}/{discussionId}   (Public Ideas)
 *
 * Usage:
 *   node backend/src/scripts/migrateDiscussions.js --dry-run
 *   node backend/src/scripts/migrateDiscussions.js --execute
 *
 * CRITICAL SAFETY RULES:
 * - Does NOT delete or mutate legacy data.
 * - Does NOT overwrite differing canonical data (canonical is authoritative).
 * - Idempotent (safe to run multiple times).
 * - Exclusively uses Firebase Admin SDK.
 */

import { rtdbService } from '../services/rtdbService.js';
import { fileURLToPath } from 'url';

/**
 * Checks if two discussion records have equivalent core payload values.
 */
function areDiscussionsEquivalent(recA, recB) {
  if (!recA || !recB) return false;
  const keysToCompare = ['message', 'authorId', 'isDeleted', 'type', 'parentId'];
  for (const k of keysToCompare) {
    if (recA[k] !== undefined || recB[k] !== undefined) {
      if (String(recA[k] ?? '') !== String(recB[k] ?? '')) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Core discussion migration engine.
 *
 * @param {Object} options
 * @param {boolean} [options.isDryRun] - If true, performs dry-run audit with zero writes
 * @param {Object} [options.db=rtdbService] - RTDB service abstraction
 * @returns {Promise<Object>} Machine-readable migration summary report
 */
export async function runDiscussionMigration(options = {}) {
  const isDryRun = options.isDryRun ?? !process.argv.includes('--execute');
  const db = options.db || rtdbService;

  console.log('======================================================');
  console.log(`🚀 [Discussion Migration] Starting in ${isDryRun ? 'DRY-RUN mode (READ-ONLY)' : 'LIVE EXECUTION mode'}...`);
  console.log('======================================================');

  const report = {
    mode: isDryRun ? 'dry-run' : 'execute',
    timestamp: Date.now(),
    scannedCount: 0,
    eligibleCount: 0,
    migratedCount: 0,
    alreadyCanonicalCount: 0,
    conflictCount: 0,
    orphanedCount: 0,
    invalidCount: 0,
    errorCount: 0,
    classifications: [],
    conflicts: [],
    backup: [],
  };

  try {
    const [discussionsData, ideasData, publicIdeasData, orgsData, wsData] = await Promise.all([
      db.getData('discussions').catch(() => null),
      db.getData('ideas').catch(() => null),
      db.getData('publicIdeas').catch(() => null),
      db.getData('organizations').catch(() => null),
      db.getData('workspaces').catch(() => null),
    ]);

    if (!discussionsData || typeof discussionsData !== 'object' || Object.keys(discussionsData).length === 0) {
      console.log('ℹ️ No discussions data found in database. Zero migrations required.');
      console.log('\n======================================================');
      console.log('📊 DISCUSSION MIGRATION SUMMARY REPORT');
      console.log('======================================================');
      console.log(`Execution Mode:           ${isDryRun ? 'DRY-RUN (Simulated)' : 'LIVE EXECUTION (Committed)'}`);
      console.log('Discussions Scanned:      0');
      console.log('Eligible for Migration:   0');
      console.log('Successfully Migrated:    0');
      console.log('Already Canonical:        0');
      console.log('Canonical Conflicts:      0');
      console.log('Orphaned Ideas:           0');
      console.log('Invalid Records:          0');
      console.log('Errors:                   0');
      console.log('Legacy Data Preserved:    YES (discussions untouched)');
      console.log('======================================================\n');
      return report;
    }

    const organizations = orgsData || {};
    const workspaces = wsData || {};

    // Build Idea ID -> { orgId, isPublic } mapping
    const ideaToOrgMap = new Map();

    // Map workspace ideas: ideas/{orgId}/{ideaId}
    if (ideasData && typeof ideasData === 'object') {
      Object.entries(ideasData).forEach(([orgId, orgIdeas]) => {
        if (orgIdeas && typeof orgIdeas === 'object') {
          Object.keys(orgIdeas).forEach((ideaId) => {
            ideaToOrgMap.set(ideaId, { orgId, isPublic: false });
          });
        }
      });
    }

    // Map public ideas: publicIdeas/{ideaId}
    if (publicIdeasData && typeof publicIdeasData === 'object') {
      Object.keys(publicIdeasData).forEach((ideaId) => {
        if (!ideaToOrgMap.has(ideaId)) {
          ideaToOrgMap.set(ideaId, { orgId: 'public', isPublic: true });
        }
      });
    }

    console.log(`🔍 [Discussion Migration] Resolved mapping for ${ideaToOrgMap.size} ideas.`);

    const migrationCandidates = [];

    for (const [topLevelKey, topLevelVal] of Object.entries(discussionsData)) {
      if (!topLevelVal || typeof topLevelVal !== 'object') continue;

      // 1. Identify canonical containers: 'public' or known org IDs
      const isKnownOrg = topLevelKey === 'public' || Boolean(organizations[topLevelKey] || workspaces[topLevelKey]);
      
      // Also inspect structure: if first child is an object and does not look like a discussion record
      const firstChild = Object.values(topLevelVal)[0];
      const isNestedContainer = firstChild && typeof firstChild === 'object' && !firstChild.message && !firstChild.authorId && !firstChild.discussionId && !firstChild.id;

      if (isKnownOrg || isNestedContainer) {
        // This is already a canonical 3-segment container (discussions/public or discussions/$orgId)
        continue;
      }

      // If we reach here, topLevelKey is an ideaId from legacy 2-segment path: discussions/{ideaId}
      const ideaId = topLevelKey;
      const mapping = ideaToOrgMap.get(ideaId);

      // Check if parent idea exists in workspace or public ideas
      if (!mapping) {
        // Missing parent idea in both workspace and public ideas -> ORPHANED_IDEA
        for (const [discKey, discRecord] of Object.entries(topLevelVal)) {
          report.scannedCount++;
          report.orphanedCount++;
          report.classifications.push({
            ideaId,
            discussionId: discRecord?.discussionId || discRecord?.id || discKey,
            status: 'ORPHANED_IDEA',
            reason: 'Parent idea not found in workspace ideas or public ideas',
          });
        }
        continue;
      }

      const { orgId: resolvedOrgId, isPublic } = mapping;
      const targetOrg = isPublic ? 'public' : resolvedOrgId;

      for (const [discKey, discRecord] of Object.entries(topLevelVal)) {
        report.scannedCount++;

        const discId = discRecord?.discussionId || discRecord?.id || discKey;
        const hasDiscId = Boolean(discRecord && (discRecord.discussionId || discRecord.id));
        const hasMessage = Boolean(discRecord && typeof discRecord.message === 'string' && discRecord.message !== undefined);

        // Validate basic record shape
        if (!discRecord || typeof discRecord !== 'object' || !hasDiscId || !hasMessage) {
          report.invalidCount++;
          report.classifications.push({
            ideaId,
            discussionId: discId,
            status: 'INVALID',
            reason: 'Missing discussionId, id, or message',
          });
          continue;
        }

        const targetPath = `discussions/${targetOrg}/${ideaId}/${discId}`;

        // Check if canonical record already exists
        const canonicalRecord = discussionsData[targetOrg]?.[ideaId]?.[discId];

        if (canonicalRecord) {
          if (areDiscussionsEquivalent(discRecord, canonicalRecord)) {
            report.alreadyCanonicalCount++;
            report.classifications.push({
              ideaId,
              discussionId: discId,
              targetPath,
              status: 'ALREADY_CANONICAL',
            });
          } else {
            report.conflictCount++;
            const conflictEntry = {
              ideaId,
              discussionId: discId,
              targetPath,
              status: 'CANONICAL_CONFLICT',
              legacyRecord: { ...discRecord },
              canonicalRecord: { ...canonicalRecord },
              chosenAuthority: 'canonical',
              reason: 'Canonical record already exists with differing payload; preserving canonical without overwrite',
            };
            report.conflicts.push(conflictEntry);
            report.classifications.push(conflictEntry);
          }
          continue;
        }

        // Eligible for migration
        const canonicalPayload = {
          ...discRecord,
          discussionId: discRecord.discussionId || discRecord.id || discId,
          ideaId: discRecord.ideaId || ideaId,
          orgId: isPublic ? null : resolvedOrgId,
        };

        report.eligibleCount++;
        const candidateEntry = {
          ideaId,
          discussionId: discId,
          targetPath,
          status: 'MIGRATE',
          record: canonicalPayload,
          legacySnapshot: { ...discRecord },
        };

        migrationCandidates.push(candidateEntry);
        report.classifications.push(candidateEntry);
        report.backup.push({
          ideaId,
          discussionId: discId,
          legacyRecord: { ...discRecord },
          plannedCanonicalPayload: canonicalPayload,
        });
      }
    }

    // Execution Phase (Only if NOT dry-run and candidates exist)
    if (!isDryRun) {
      if (migrationCandidates.length === 0) {
        console.log('ℹ️ No eligible discussion records to migrate.');
      } else {
        console.log(`⏳ Applying ${migrationCandidates.length} canonical discussion writes...`);
        for (const candidate of migrationCandidates) {
          try {
            await db.setData(candidate.targetPath, candidate.record);
            report.migratedCount++;
            candidate.status = 'MIGRATED';
          } catch (writeErr) {
            report.errorCount++;
            candidate.status = 'MIGRATION_FAILED';
            candidate.error = writeErr.message;
            console.error(`🚨 Failed to write ${candidate.targetPath}:`, writeErr.message);
          }
        }
      }
    }

    // Print Summary Report
    console.log('\n======================================================');
    console.log('📊 DISCUSSION MIGRATION SUMMARY REPORT');
    console.log('======================================================');
    console.log(`Execution Mode:           ${isDryRun ? 'DRY-RUN (Simulated)' : 'LIVE EXECUTION (Committed)'}`);
    console.log(`Discussions Scanned:      ${report.scannedCount}`);
    console.log(`Eligible for Migration:   ${report.eligibleCount}`);
    if (!isDryRun) {
      console.log(`Successfully Migrated:    ${report.migratedCount}`);
    }
    console.log(`Already Canonical:        ${report.alreadyCanonicalCount}`);
    console.log(`Canonical Conflicts:      ${report.conflictCount}`);
    console.log(`Orphaned Ideas:           ${report.orphanedCount}`);
    console.log(`Invalid Records:          ${report.invalidCount}`);
    console.log(`Errors:                   ${report.errorCount}`);
    console.log('Legacy Data Preserved:    YES (No legacy entries deleted)');
    if (isDryRun) {
      console.log('DRY RUN COMPLETE: Zero database writes executed.');
    } else {
      console.log('EXECUTION COMPLETE: Canonical discussions updated.');
    }
    console.log('======================================================\n');

    return report;
  } catch (err) {
    console.error('🚨 [Discussion Migration Fatal Error]:', err.message);
    report.errorCount++;
    throw err;
  }
}

// Alias for backwards compatibility
export const migrateDiscussions = runDiscussionMigration;

// Auto-run if executed directly via node CLI
const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && (process.argv[1] === currentFilePath || process.argv[1].endsWith('migrateDiscussions.js'))) {
  runDiscussionMigration()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fatal CLI discussion migration failure:', err);
      process.exit(1);
    });
}
