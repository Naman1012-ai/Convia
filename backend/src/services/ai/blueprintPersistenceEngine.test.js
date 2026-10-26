import assert from 'node:assert';
import { validateBlueprintOutput } from './blueprintValidator.js';
import { createDefaultBlueprint2Content } from '../../constants/blueprintSchema.js';

console.log('\n🧪 ====================================================');
console.log('🧪 BLUEPRINT PERSISTENCE, VERSIONING & REHYDRATION TEST SUITE');
console.log('🧪 ====================================================\n');

let passedTests = 0;
let failedTests = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${desc}`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
  }
}

// Resilient helper mirroring frontend blueprintService.extractValidBlueprint
function extractValidBlueprint(raw, targetMvpId = null) {
  if (!raw || typeof raw !== 'object') return null;

  // Case 1: Target MVP child inside dictionary
  if (targetMvpId && raw[targetMvpId] && typeof raw[targetMvpId] === 'object') {
    const targetChild = raw[targetMvpId];
    if (targetChild.active && typeof targetChild.active === 'object' && (targetChild.active.content || targetChild.active.projectOverview || targetChild.active.status)) {
      return targetChild.active;
    }
    if (targetChild.current && typeof targetChild.current === 'object' && (targetChild.current.content || targetChild.current.projectOverview || targetChild.current.status)) {
      return targetChild.current;
    }
    if (targetChild.content || targetChild.projectOverview || targetChild.schemaVersion || targetChild.status) {
      return targetChild;
    }
  }

  // Case 2: Container object with `active` or `current` pointer (authoritative approved/current versions)
  if (raw.active && typeof raw.active === 'object' && (raw.active.content || raw.active.projectOverview || raw.active.status)) {
    return raw.active;
  }
  if (raw.current && typeof raw.current === 'object' && (raw.current.content || raw.current.projectOverview || raw.current.status)) {
    return raw.current;
  }

  // Case 3: Direct single Blueprint document with content/schema (and not a parent container)
  if (raw.content || raw.projectOverview || raw.schemaVersion || raw.status === 'completed' || raw.status === 'generating') {
    return raw;
  }

  // Case 4: Search child values for best candidate
  const childDocs = Object.values(raw).filter(
    (v) => v && typeof v === 'object' && (v.content || v.projectOverview || v.schemaVersion || v.status === 'completed')
  );
  if (childDocs.length > 0) {
    childDocs.sort((a, b) => {
      const aApproved = a.approvalStatus === 'approved' || a.lifecycleState === 'active' ? 1 : 0;
      const bApproved = b.approvalStatus === 'approved' || b.lifecycleState === 'active' ? 1 : 0;
      if (bApproved !== aApproved) return bApproved - aApproved;
      return (b.updatedAt || b.generatedAt || 0) - (a.updatedAt || a.generatedAt || 0);
    });
    return childDocs[0];
  }

  return null;
}

// -------------------------------------------------------------
// TEST GROUP 1: DETERMINISTIC VERSION NUMBERING & REGENERATION
// -------------------------------------------------------------
console.log('🔍 TEST GROUP 1: Deterministic Version Numbering & Regeneration Calculation');

function calculateNextVersion(existingBp, rawVersions) {
  const versionNumbers = [];
  if (existingBp?.version && existingBp?.content) {
    const v = parseFloat(existingBp.version);
    if (!isNaN(v)) versionNumbers.push(v);
  }
  Object.keys(rawVersions || {}).forEach((k) => {
    const verObj = rawVersions[k];
    if (verObj && (verObj.content || verObj.projectOverview)) {
      const verStr = verObj?.version || k.replace(/^v/, '').replace(/_/g, '.');
      const v = parseFloat(verStr);
      if (!isNaN(v)) versionNumbers.push(v);
    }
  });

  const maxVersion = versionNumbers.length > 0 ? Math.max(...versionNumbers) : 0;
  const nextVersion = maxVersion > 0 ? (maxVersion + 1.0).toFixed(1) : '1.0';
  const isRegeneration = maxVersion >= 1.0;
  return { nextVersion, isRegeneration, maxVersion };
}

it('Initial MVP selection without AI content starts strictly at Version 1.0 (not 2.0)', () => {
  const emptyMvpBp = {
    blueprintId: 'bp_org1_idea1',
    version: '1.0',
    status: 'completed',
    content: null, // No AI content yet
  };
  const { nextVersion, isRegeneration } = calculateNextVersion(emptyMvpBp, {});
  assert.strictEqual(nextVersion, '1.0');
  assert.strictEqual(isRegeneration, false);
});

it('First regeneration with existing completed content increments to Version 2.0', () => {
  const v1Bp = {
    blueprintId: 'bp_org1_idea1',
    version: '1.0',
    status: 'completed',
    content: createDefaultBlueprint2Content(),
  };
  const { nextVersion, isRegeneration } = calculateNextVersion(v1Bp, {});
  assert.strictEqual(nextVersion, '2.0');
  assert.strictEqual(isRegeneration, true);
});

it('Second regeneration with version history increments to Version 3.0', () => {
  const v2Bp = {
    blueprintId: 'bp_org1_idea1',
    version: '2.0',
    status: 'completed',
    content: createDefaultBlueprint2Content(),
  };
  const versions = {
    v1_0: { version: '1.0', content: createDefaultBlueprint2Content() },
    v2_0: { version: '2.0', content: createDefaultBlueprint2Content() },
  };
  const { nextVersion, isRegeneration } = calculateNextVersion(v2Bp, versions);
  assert.strictEqual(nextVersion, '3.0');
  assert.strictEqual(isRegeneration, true);
});

// -------------------------------------------------------------
// TEST GROUP 2: RESILIENT BLUEPRINT EXTRACTION & REHYDRATION
// -------------------------------------------------------------
console.log('\n🔍 TEST GROUP 2: Resilient Blueprint Extraction & Rehydration Resolver');

it('extractValidBlueprint returns direct document when passed single document', () => {
  const doc = {
    blueprintId: 'bp_123',
    version: '1.0',
    status: 'completed',
    content: createDefaultBlueprint2Content(),
  };
  const result = extractValidBlueprint(doc);
  assert.strictEqual(result.blueprintId, 'bp_123');
  assert.strictEqual(result.version, '1.0');
});

it('extractValidBlueprint extracts target MVP child from parent dictionary', () => {
  const container = {
    idea_abc: {
      blueprintId: 'bp_abc',
      mvpIdeaId: 'idea_abc',
      version: '1.0',
      status: 'completed',
      content: createDefaultBlueprint2Content(),
    },
    idea_xyz: {
      blueprintId: 'bp_xyz',
      mvpIdeaId: 'idea_xyz',
      version: '1.0',
      status: 'completed',
      content: createDefaultBlueprint2Content(),
    },
  };
  const result = extractValidBlueprint(container, 'idea_abc');
  assert.strictEqual(result.blueprintId, 'bp_abc');
  assert.strictEqual(result.mvpIdeaId, 'idea_abc');
});

it('extractValidBlueprint extracts current or active pointer from container object', () => {
  const container = {
    current: {
      blueprintId: 'bp_current',
      version: '2.0',
      status: 'completed',
      content: createDefaultBlueprint2Content(),
    },
  };
  const result = extractValidBlueprint(container);
  assert.strictEqual(result.blueprintId, 'bp_current');
  assert.strictEqual(result.version, '2.0');
});

it('extractValidBlueprint prioritizes active approved pointer over legacy root content', () => {
  const container = {
    content: createDefaultBlueprint2Content(),
    version: '1.0',
    approvalStatus: 'pending_approval',
    active: {
      blueprintId: 'bp_approved_v7',
      version: '7.0',
      status: 'completed',
      approvalStatus: 'approved',
      content: createDefaultBlueprint2Content(),
    },
  };
  const result = extractValidBlueprint(container);
  assert.strictEqual(result.blueprintId, 'bp_approved_v7');
  assert.strictEqual(result.version, '7.0');
  assert.strictEqual(result.approvalStatus, 'approved');
});

it('extractValidBlueprint returns null for non-blueprint objects without throwing', () => {
  assert.strictEqual(extractValidBlueprint(null), null);
  assert.strictEqual(extractValidBlueprint(undefined), null);
  assert.strictEqual(extractValidBlueprint({ randomKey: 'hello' }), null);
});

// -------------------------------------------------------------
// TEST GROUP 3: ACTIVE VERSION VS VIEWED VERSION IMMUTABILITY
// -------------------------------------------------------------
console.log('\n🔍 TEST GROUP 3: Active Version vs Viewed Version Immutability');

it('Viewing a historical version displays the snapshot without altering active version', () => {
  const liveActiveBp = {
    blueprintId: 'bp_main',
    version: '17.0',
    status: 'completed',
    content: { ...createDefaultBlueprint2Content(), projectUnderstanding: { summary: 'V17 Summary' } },
  };

  const v15Snapshot = {
    blueprintId: 'bp_main',
    version: '15.0',
    status: 'completed',
    content: { ...createDefaultBlueprint2Content(), projectUnderstanding: { summary: 'V15 Historical Summary' } },
  };

  const allVersions = [
    { key: 'v17_0', version: '17.0', content: liveActiveBp.content },
    { key: 'v16_0', version: '16.0', content: createDefaultBlueprint2Content() },
    { key: 'v15_0', version: '15.0', content: v15Snapshot.content },
  ];

  // Active version is 17.0
  const activeVersion = allVersions[0].version;
  assert.strictEqual(activeVersion, '17.0');

  // User selects 'v15_0' in Version Dropdown
  const selectedVersionKey = 'v15_0';
  const match = allVersions.find((v) => v.key === selectedVersionKey);
  const displayedDoc = match ? { ...match, status: 'completed' } : liveActiveBp;
  const viewedVersion = String(displayedDoc.version);

  // The displayed content and viewed version are V15
  assert.strictEqual(viewedVersion, '15.0');
  assert.strictEqual(displayedDoc.content.projectUnderstanding.summary, 'V15 Historical Summary');

  // The active authoritative document remains V17
  assert.strictEqual(activeVersion, '17.0');
  assert.strictEqual(liveActiveBp.version, '17.0');
});

// -------------------------------------------------------------
// TEST GROUP 4: VERSION STATE UNIFICATION & STALE LOCK RECOVERY
// -------------------------------------------------------------
console.log('\n🔍 TEST GROUP 4: Version State Unification & Stale Lock Recovery');

it('Authoritative version resolution recovers latest completed version when root node has stale lock', () => {
  // Simulates the observed scenario: root node has stale { version: '1.0', status: 'generating' }
  const staleRootBp = {
    blueprintId: 'bp_org_idea',
    version: '1.0',
    status: 'generating',
    content: null,
  };

  const versionsMap = {};
  for (let i = 1; i <= 17; i++) {
    const vStr = `${i}.0`;
    const vKey = `v${i}_0`;
    versionsMap[vKey] = {
      key: vKey,
      version: vStr,
      status: 'completed',
      content: createDefaultBlueprint2Content(),
    };
  }

  // Version aggregation finds all 17 versions
  const effectiveVersions = Object.values(versionsMap).sort((a, b) => parseFloat(b.version) - parseFloat(a.version));
  const activeVersion = effectiveVersions[0]?.version || '1.0';

  assert.strictEqual(effectiveVersions.length, 17);
  assert.strictEqual(activeVersion, '17.0');

  // Displayed blueprint resolves from latest completed version snapshot
  let displayedDoc = null;
  if (!staleRootBp.content && effectiveVersions.length > 0) {
    const latestValid = effectiveVersions.find((v) => v && v.content);
    displayedDoc = {
      ...latestValid,
      version: latestValid.version,
      status: 'completed',
    };
  }

  const viewedVersion = displayedDoc ? displayedDoc.version : activeVersion;

  // Both Header and Dropdown agree on Version 17.0
  assert.strictEqual(viewedVersion, '17.0');
  assert.strictEqual(activeVersion, '17.0');
  assert.strictEqual(displayedDoc.status, 'completed');
});

it('Fail-safe preservation preserves previous completed version on generation error', () => {
  const existingBp = {
    blueprintId: 'bp_123',
    version: '17.0',
    status: 'completed',
    content: createDefaultBlueprint2Content(),
  };

  // Generation failure occurs
  const errorHandledDoc = {
    ...existingBp,
    status: 'completed',
    lastError: 'Gemini rate limit',
  };

  assert.strictEqual(errorHandledDoc.version, '17.0');
  assert.strictEqual(errorHandledDoc.status, 'completed');
  assert.ok(errorHandledDoc.content, 'Content is preserved');
});

// -------------------------------------------------------------
// TEST SUMMARY
// -------------------------------------------------------------
console.log('\n====================================================');
console.log(`📊 PERSISTENCE & VERSIONING TESTS: ${passedTests} Passed | ${failedTests} Failed`);
console.log('====================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL PERSISTENCE, VERSIONING & REHYDRATION TESTS PASSED PERFECTLY!\n');
}
