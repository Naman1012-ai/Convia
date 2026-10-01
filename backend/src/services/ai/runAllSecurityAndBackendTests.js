import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testFiles = [
  './securityAudit.test.js',
  './rateLimitResilienceAudit.test.js',
  './inputSecurityAudit.test.js',
  './backendAuthorizationAudit.test.js',
  './databaseRulesValidation.test.js',
  './accountDeletion.test.js',
  './adminAuthorization.test.js',
  './discussionPathValidation.test.js',
  './blueprintTaskSyncPathValidation.test.js',
  './blueprintPhase11Approval.test.js',
  './blueprintPersistenceSanitization.test.js',
  './blueprintPhase9Persistence.test.js',
  './blueprintLiveStatusReflection.test.js',
  './blueprintTaskSyncRouting.test.js',
  './blueprintSummaryVisibility.test.js',
  './blueprintActionFlow.test.js',
  './blueprintPersistenceEngine.test.js',
  './taskSyncEngine.test.js',
  './blueprintExportEngine.test.js',
  './blueprintUi2Verification.test.js',
  './workspaceRoleRestructuring.test.js',
  './invitationBugFixAndTeamCaptainConsistency.test.js',
  './threeRoleOwnershipTransfer.test.js',
  './separatedRoleManagementAndPermissions.test.js',
  './buttonVisualStateAndContrast.test.js',
  './globalTimestampAudit.test.js',
  './joinTimeChatAccessControl.test.js',
];

async function main() {
  console.log('🚀 [Fast Test Runner] Dynamically executing all 20 backend test suites...\n');
  let passed = 0;
  let failed = 0;

  for (const file of testFiles) {
    try {
      const startTime = Date.now();
      await import(`${file}?t=${Date.now()}`);
      const duration = Date.now() - startTime;
      console.log(`  ✅ PASS (${duration}ms): ${file}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${file} | Error:`, err.message);
      failed++;
    }
  }

  console.log('\n======================================================');
  console.log(`📊 TOTAL BACKEND SUITES: ${testFiles.length} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main();
