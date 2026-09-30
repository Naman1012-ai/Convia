import { rtdbService } from '../services/rtdbService.js';
import { countUniqueActiveMembers } from '../utils/workspaceAuthHelper.js';

/**
 * Controlled Workspace Member Count Reconciliation Script
 *
 * Traverses all workspaces in Convia RTDB, determines canonical active memberships
 * from organization_members/{workspaceId}, and authoritatively updates denormalized
 * memberCount fields where discrepancies are detected.
 */
export async function runReconciliation(dryRun = false) {
  console.log(`\n============================================================`);
  console.log(`🔍 CONVIA WORKSPACE MEMBERSHIP RECONCILIATION AUDIT`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (Read-Only)' : 'LIVE EXECUTION'}`);
  console.log(`============================================================\n`);

  const [allOrgs, allMembers] = await Promise.all([
    rtdbService.getData('organizations'),
    rtdbService.getData('organization_members'),
  ]);

  if (!allOrgs || typeof allOrgs !== 'object') {
    console.log('No organizations found in database.');
    return [];
  }

  const membersMap = allMembers || {};
  const auditResults = [];
  const atomicUpdates = {};
  const timestamp = Date.now();

  for (const [orgId, org] of Object.entries(allOrgs)) {
    if (!org || typeof org !== 'object') continue;

    const orgMembers = membersMap[orgId] || {};
    const activeUids = [];

    for (const [key, val] of Object.entries(orgMembers)) {
      if (!val || typeof val !== 'object') continue;
      if (val.status === 'inactive' || val.status === 'removed' || val.isDeleted) continue;
      const uid = val.uid || key;
      if (uid && typeof uid === 'string') {
        activeUids.push(uid);
      }
    }

    const uniqueUids = Array.from(new Set(activeUids));
    const canonicalCount = uniqueUids.length;
    const storedCount = typeof org.memberCount === 'number' ? org.memberCount : null;
    const maxMembers = org.maxMembers || org.teamSizeLimit || 5;
    const isDiscrepant = storedCount !== canonicalCount;

    auditResults.push({
      workspaceId: orgId,
      name: org.name || 'Unnamed Workspace',
      maxMembers,
      storedCount,
      canonicalCount,
      activeMemberUids: uniqueUids,
      status: isDiscrepant ? 'REQUIRES_RECONCILIATION' : 'IN_SYNC',
    });

    if (isDiscrepant) {
      atomicUpdates[`organizations/${orgId}/memberCount`] = canonicalCount;
      atomicUpdates[`organizations/${orgId}/updatedAt`] = timestamp;
    }
  }

  // Print Audit Report
  console.table(
    auditResults.map((r) => ({
      'Workspace ID': r.workspaceId,
      'Name': r.name,
      'Max': r.maxMembers,
      'Stored Count': r.storedCount === null ? 'null' : r.storedCount,
      'Canonical Count': r.canonicalCount,
      'Active Members': r.activeMemberUids.length,
      'Status': r.status,
    }))
  );

  // If live and updates exist, apply them atomically
  if (!dryRun && Object.keys(atomicUpdates).length > 0) {
    console.log(`\nWriting ${Object.keys(atomicUpdates).length} updates to RTDB...`);
    await rtdbService.updateData('', atomicUpdates);
    console.log('✅ Reconciliation updates applied successfully.');
  } else if (dryRun) {
    console.log('\n[Dry Run] No writes performed.');
  } else {
    console.log('\n✅ All workspaces are already synchronized. Zero updates required.');
  }

  return auditResults;
}

// Execute standalone if called directly
if (process.argv[1] && process.argv[1].endsWith('reconcileWorkspaceMemberCounts.js')) {
  const isDryRun = process.argv.includes('--dry-run');
  runReconciliation(isDryRun)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('🚨 Reconciliation error:', err);
      process.exit(1);
    });
}
