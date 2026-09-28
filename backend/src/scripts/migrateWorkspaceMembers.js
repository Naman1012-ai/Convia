/**
 * Convia Step 4C.2: Idempotent Workspace Membership Migration Utility
 *
 * Migrates legacy membership records from:
 *   workspace_members/${workspaceId}/${uid}
 * To canonical membership records in:
 *   organization_members/${workspaceId}/${uid}
 *
 * Strict Safety Invariants:
 * 1. Default mode is READ-ONLY --dry-run. Mutations require explicit --execute flag.
 * 2. NEVER overwrites existing canonical organization_members records.
 * 3. NEVER modifies or deletes legacy workspace_members records.
 * 4. NEVER creates memberships for orphaned workspaces (missing or soft-deleted).
 * 5. NEVER creates memberships for nonexistent/orphaned users.
 * 6. Completely idempotent: repeated executions produce zero duplicate writes or state drift.
 * 7. Canonical data is the absolute authority in all conflict resolutions.
 *
 * Usage:
 *   node backend/src/scripts/migrateWorkspaceMembers.js --dry-run
 *   node backend/src/scripts/migrateWorkspaceMembers.js --execute
 */

import { rtdbService, getAdminAuth } from '../services/rtdbService.js';
import { fileURLToPath } from 'url';

const ALLOWED_ROLES = ['owner', 'admin', 'member'];

/**
 * Validates whether a role string is supported in canonical schema.
 *
 * @param {string} role
 * @returns {string} Normalized role ('owner' | 'admin' | 'member')
 */
export function normalizeCanonicalRole(role) {
  if (!role || typeof role !== 'string') return 'member';
  const clean = role.toLowerCase().trim();
  return ALLOWED_ROLES.includes(clean) ? clean : 'member';
}

/**
 * Core migration engine.
 *
 * @param {Object} options
 * @param {boolean} [options.isDryRun=true] - If true, performs read-only audit
 * @param {Object} [options.db=rtdbService] - RTDB service abstraction
 * @param {Object} [options.auth=getAdminAuth()] - Firebase Admin Auth instance (optional)
 * @returns {Promise<Object>} Machine-readable migration summary report
 */
export async function runWorkspaceMembersMigration(options = {}) {
  const isDryRun = options.isDryRun ?? !process.argv.includes('--execute');
  const db = options.db || rtdbService;
  const auth = options.auth || getAdminAuth();

  console.log('======================================================');
  console.log(`🚀 [Workspace Membership Migration] Starting in ${isDryRun ? 'DRY-RUN mode (READ-ONLY)' : 'LIVE EXECUTION mode'}...`);
  console.log('======================================================');

  const report = {
    mode: isDryRun ? 'dry-run' : 'execute',
    timestamp: Date.now(),
    scannedCount: 0,
    eligibleCount: 0,
    migratedCount: 0,
    alreadyCanonicalCount: 0,
    conflictCount: 0,
    orphanedWorkspaceCount: 0,
    orphanedUserCount: 0,
    invalidCount: 0,
    errorCount: 0,
    classifications: [],
    conflicts: [],
    backup: [],
  };

  try {
    // 1. Fetch legacy memberships and canonical reference roots in parallel
    const [legacyData, canonicalData, orgsData, wsData, usersData] = await Promise.all([
      db.getData('workspace_members').catch(() => null),
      db.getData('organization_members').catch(() => null),
      db.getData('organizations').catch(() => null),
      db.getData('workspaces').catch(() => null),
      db.getData('users').catch(() => null),
    ]);

    if (!legacyData || typeof legacyData !== 'object' || Object.keys(legacyData).length === 0) {
      console.log('ℹ️ No legacy workspace_members found in database. Zero migrations required.');
      console.log('\n======================================================');
      console.log('📊 WORKSPACE MEMBERSHIP MIGRATION SUMMARY REPORT');
      console.log('======================================================');
      console.log(`Execution Mode:             ${isDryRun ? 'DRY-RUN (Read-Only Audit)' : 'LIVE EXECUTION (Committed)'}`);
      console.log(`Legacy Memberships Scanned: 0`);
      console.log(`Eligible for Migration:     0`);
      console.log(`Already Canonical:          0`);
      console.log(`Canonical Conflicts:        0`);
      console.log(`Orphaned Workspaces:        0`);
      console.log(`Orphaned/Unverified Users:  0`);
      console.log(`Invalid Records:            0`);
      console.log(`Errors:                     0`);
      console.log('Legacy Data Preserved:      YES (workspace_members untouched)');
      console.log('DRY RUN COMPLETE: Zero database writes executed.');
      console.log('======================================================\n');
      return report;
    }

    const organizations = orgsData || {};
    const workspaces = wsData || {};
    const canonicalMembers = canonicalData || {};
    const users = usersData || {};

    const migrationCandidates = [];

    // 2. Iterate through legacy workspace memberships
    for (const [workspaceId, membersMap] of Object.entries(legacyData)) {
      if (!workspaceId || typeof workspaceId !== 'string' || workspaceId === '[object Object]') {
        report.invalidCount++;
        report.classifications.push({
          workspaceId,
          uid: null,
          status: 'INVALID',
          reason: 'Invalid workspace ID key',
        });
        continue;
      }

      if (!membersMap || typeof membersMap !== 'object') {
        report.invalidCount++;
        report.classifications.push({
          workspaceId,
          uid: null,
          status: 'INVALID',
          reason: 'Invalid members container',
        });
        continue;
      }

      // Check workspace existence: either in organizations or workspaces metadata
      const orgRecord = organizations[workspaceId] || workspaces[workspaceId];
      const isWorkspaceValid = Boolean(orgRecord && !orgRecord.isDeleted);

      for (const [uid, legacyRecord] of Object.entries(membersMap)) {
        report.scannedCount++;

        // Validate basic record shape
        if (!uid || typeof uid !== 'string' || uid === '[object Object]' || !legacyRecord || typeof legacyRecord !== 'object') {
          report.invalidCount++;
          report.classifications.push({
            workspaceId,
            uid,
            status: 'INVALID',
            reason: 'Malformed UID or member record',
          });
          continue;
        }

        // CASE E: Legacy exists but workspace is deleted or missing
        if (!isWorkspaceValid) {
          report.orphanedWorkspaceCount++;
          report.classifications.push({
            workspaceId,
            uid,
            status: 'ORPHANED_WORKSPACE',
            reason: 'Workspace does not exist or has been deleted',
          });
          continue;
        }

        // CASE F: Legacy exists but user does not exist in users database
        const userExistsInDb = Boolean(users[uid]);
        let userExistsInAuth = false;
        if (!userExistsInDb && auth && typeof auth.getUser === 'function') {
          try {
            await auth.getUser(uid);
            userExistsInAuth = true;
          } catch {
            userExistsInAuth = false;
          }
        }

        if (!userExistsInDb && !userExistsInAuth) {
          report.orphanedUserCount++;
          report.classifications.push({
            workspaceId,
            uid,
            status: 'ORPHANED_USER',
            reason: 'User UID not found in user directory or Auth registry',
          });
          continue;
        }

        // Check canonical organization_members state
        const canonicalRecord = canonicalMembers[workspaceId]?.[uid];

        if (canonicalRecord) {
          const canonicalRole = normalizeCanonicalRole(canonicalRecord.role);
          const legacyRole = normalizeCanonicalRole(legacyRecord.role);

          if (canonicalRole === legacyRole) {
            // CASE C: Both exist and values are equivalent
            report.alreadyCanonicalCount++;
            report.classifications.push({
              workspaceId,
              uid,
              status: 'ALREADY_CANONICAL',
              role: canonicalRole,
            });
          } else {
            // CASE D & G: Both exist but values differ — Canonical takes absolute precedence!
            report.conflictCount++;
            const conflictEntry = {
              workspaceId,
              uid,
              status: 'CANONICAL_CONFLICT',
              legacyRole,
              canonicalRole,
              chosenAuthority: 'canonical',
              reason: 'Canonical organization_members record already exists with differing role; preserving canonical without overwrite',
            };
            report.conflicts.push(conflictEntry);
            report.classifications.push(conflictEntry);
          }
        } else {
          // CASE A: Legacy exists and canonical is missing — Eligible for migration!
          const normalizedRole = normalizeCanonicalRole(legacyRecord.role);
          const canonicalPayload = {
            uid,
            role: normalizedRole,
            joinedAt: Number(legacyRecord.joinedAt) || Date.now(),
          };

          report.eligibleCount++;
          const candidateEntry = {
            workspaceId,
            uid,
            status: 'MIGRATE',
            targetPath: `organization_members/${workspaceId}/${uid}`,
            record: canonicalPayload,
            legacySnapshot: { ...legacyRecord },
          };

          migrationCandidates.push(candidateEntry);
          report.classifications.push(candidateEntry);
          report.backup.push({
            workspaceId,
            uid,
            legacyRecord: { ...legacyRecord },
            plannedCanonicalPayload: canonicalPayload,
          });
        }
      }
    }

    // 3. Execution Phase (Only if NOT dry-run and candidates exist)
    if (!isDryRun) {
      if (migrationCandidates.length === 0) {
        console.log('ℹ️ No eligible records to migrate.');
      } else {
        console.log(`⏳ Applying ${migrationCandidates.length} canonical membership writes...`);
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

    // 4. Print Summary Report
    console.log('\n======================================================');
    console.log('📊 WORKSPACE MEMBERSHIP MIGRATION SUMMARY REPORT');
    console.log('======================================================');
    console.log(`Execution Mode:             ${isDryRun ? 'DRY-RUN (Read-Only Audit)' : 'LIVE EXECUTION (Committed)'}`);
    console.log(`Legacy Memberships Scanned: ${report.scannedCount}`);
    console.log(`Eligible for Migration:     ${report.eligibleCount}`);
    if (!isDryRun) {
      console.log(`Successfully Migrated:      ${report.migratedCount}`);
    }
    console.log(`Already Canonical:          ${report.alreadyCanonicalCount}`);
    console.log(`Canonical Conflicts:        ${report.conflictCount}`);
    console.log(`Orphaned Workspaces:        ${report.orphanedWorkspaceCount}`);
    console.log(`Orphaned/Unverified Users:  ${report.orphanedUserCount}`);
    console.log(`Invalid Records:            ${report.invalidCount}`);
    console.log(`Errors:                     ${report.errorCount}`);
    console.log('Legacy Data Preserved:      YES (workspace_members untouched)');
    if (isDryRun) {
      console.log('DRY RUN COMPLETE: Zero database writes executed.');
    } else {
      console.log('EXECUTION COMPLETE: Canonical organization_members updated.');
    }
    console.log('======================================================\n');

    return report;
  } catch (err) {
    console.error('🚨 [Workspace Membership Migration Fatal Error]:', err.message);
    report.errorCount++;
    throw err;
  }
}

// Auto-run if executed directly via node CLI
const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && (process.argv[1] === currentFilePath || process.argv[1].endsWith('migrateWorkspaceMembers.js'))) {
  runWorkspaceMembersMigration()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fatal CLI migration failure:', err);
      process.exit(1);
    });
}
