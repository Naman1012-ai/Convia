import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';

describe('🧪 CONVIA BLUEPRINT VERSION HISTORY & APPROVAL PERSISTENCE SUITE', () => {
  let mockDb = {};

  beforeEach(() => {
    mockDb = {
      blueprints: {},
      organizations: {
        org_1: {
          id: 'org_1',
          name: 'Workspace Alpha',
          ownerId: 'user_1',
          activeProjectId: 'idea_mvp',
        },
      },
      organization_members: {
        org_1: {
          user_1: { uid: 'user_1', role: 'owner' },
          user_2: { uid: 'user_2', role: 'member' },
        },
      },
    };
  });

  // Simulated backend approval handler mirroring blueprintController.approveBlueprintVersionHandler
  function simulateApproveBlueprintVersion(workspaceId, userUid, targetVerNumber) {
    const activeMvpId = mockDb.organizations[workspaceId]?.activeProjectId || 'idea_mvp';
    const cleanVerKey = `v${String(targetVerNumber).replace(/\./g, '_')}`;

    const mvpVersions = mockDb.blueprints[`${workspaceId}/${activeMvpId}/versions`] || {};
    const rootVersions = mockDb.blueprints[`${workspaceId}/versions`] || {};
    const currentBp = mockDb.blueprints[`${workspaceId}/${activeMvpId}`] || {};

    const targetVersionDoc = mvpVersions[cleanVerKey] || rootVersions[cleanVerKey];
    if (!targetVersionDoc) {
      throw new Error(`Target version ${cleanVerKey} not found`);
    }

    const timestamp = Date.now();

    // 1. Gather all existing versions across all locations
    const allVersionsMap = {};

    // From root versions
    Object.entries(rootVersions).forEach(([k, v]) => {
      if (v && typeof v === 'object') allVersionsMap[k] = { ...v };
    });

    // From mvp versions
    Object.entries(mvpVersions).forEach(([k, v]) => {
      if (v && typeof v === 'object') allVersionsMap[k] = { ...v };
    });

    // From current document versions
    if (currentBp.versions && typeof currentBp.versions === 'object') {
      Object.entries(currentBp.versions).forEach(([k, v]) => {
        if (v && typeof v === 'object') allVersionsMap[k] = { ...v };
      });
    }

    // 2. Mark previous version as superseded
    if (currentBp.version && String(currentBp.version) !== String(targetVerNumber)) {
      const oldVerKey = `v${String(currentBp.version).replace(/\./g, '_')}`;
      if (allVersionsMap[oldVerKey]) {
        allVersionsMap[oldVerKey] = {
          ...allVersionsMap[oldVerKey],
          status: 'superseded',
          lifecycleState: 'superseded',
          supersededAt: timestamp,
          supersededBy: userUid,
        };
      }
    }

    // 3. Build approved document
    const approvedDocument = {
      ...targetVersionDoc,
      status: 'completed',
      lifecycleState: 'active',
      approvalStatus: 'approved',
      activeVersionId: String(targetVerNumber),
      version: String(targetVerNumber),
      updatedAt: timestamp,
      approvedAt: timestamp,
      approvedBy: userUid,
    };

    const approvedSnapshot = { ...approvedDocument, key: cleanVerKey };
    delete approvedSnapshot.versions;
    allVersionsMap[cleanVerKey] = approvedSnapshot;

    approvedDocument.versions = allVersionsMap;

    // 4. Persist across all authoritative locations
    mockDb.blueprints[`${workspaceId}/${activeMvpId}`] = approvedDocument;
    mockDb.blueprints[`${workspaceId}/current`] = approvedDocument;
    mockDb.blueprints[`${workspaceId}/active`] = approvedDocument;

    // Ensure all versions in allVersionsMap are written to both version collections
    mockDb.blueprints[`${workspaceId}/${activeMvpId}/versions`] = { ...allVersionsMap };
    mockDb.blueprints[`${workspaceId}/versions`] = { ...allVersionsMap };

    return approvedDocument;
  }

  // Simulated frontend subscriber parser mirroring blueprintService.subscribeToBlueprintVersions
  function simulateSubscribeToBlueprintVersions(workspaceId, mvpIdeaId) {
    const mvpRaw = mockDb.blueprints[`${workspaceId}/${mvpIdeaId}/versions`] || {};
    const rootRaw = mockDb.blueprints[`${workspaceId}/versions`] || {};

    const combined = {};
    Object.entries(rootRaw).forEach(([k, v]) => {
      if (v && typeof v === 'object') combined[k] = v;
    });
    Object.entries(mvpRaw).forEach(([k, v]) => {
      if (v && typeof v === 'object') combined[k] = v;
    });

    const list = Object.entries(combined).map(([k, v]) => {
      const vNum = String(v.version || k.replace(/^v/, '').replace(/_/g, '.') || '1.0');
      return {
        key: `v${vNum.replace(/\./g, '_')}`,
        version: vNum,
        status: v.status || 'completed',
        approvalStatus: v.approvalStatus || 'pending_approval',
        content: v.content || {},
      };
    });

    list.sort((a, b) => (parseFloat(b.version) || 0) - (parseFloat(a.version) || 0));
    return list;
  }

  // Helper to seed blueprint versions
  function seedVersions(workspaceId, mvpIdeaId, versionsList) {
    const versionsObj = {};
    versionsList.forEach((ver) => {
      const vKey = `v${String(ver.version).replace(/\./g, '_')}`;
      versionsObj[vKey] = {
        key: vKey,
        version: String(ver.version),
        status: ver.status || 'completed',
        approvalStatus: ver.approvalStatus || 'pending_approval',
        content: { title: `Content for ${ver.version}` },
        createdAt: 1000 * parseFloat(ver.version),
      };
    });

    mockDb.blueprints[`${workspaceId}/${mvpIdeaId}/versions`] = { ...versionsObj };
    mockDb.blueprints[`${workspaceId}/versions`] = { ...versionsObj };

    const latest = versionsList[versionsList.length - 1];
    mockDb.blueprints[`${workspaceId}/${mvpIdeaId}`] = {
      blueprintId: `bp_${workspaceId}_${mvpIdeaId}`,
      version: String(latest.version),
      activeVersionId: String(latest.version),
      content: { title: `Content for ${latest.version}` },
      versions: { ...versionsObj },
    };
  }

  // -------------------------------------------------------------
  // Test 1: Basic approval preserves all versions
  // -------------------------------------------------------------
  it('TEST 1: Approving V3.0 preserves V1.0 and V2.0 in version history and updates active version to V3.0', () => {
    seedVersions('org_1', 'idea_mvp', [
      { version: '1.0', status: 'completed' },
      { version: '2.0', status: 'completed' },
      { version: '3.0', status: 'completed' },
    ]);

    // Initial check: 3 versions before approval
    const beforeList = simulateSubscribeToBlueprintVersions('org_1', 'idea_mvp');
    assert.strictEqual(beforeList.length, 3);

    // User approves Version 3.0
    const approvedDoc = simulateApproveBlueprintVersion('org_1', 'user_1', '3.0');
    assert.strictEqual(approvedDoc.version, '3.0');
    assert.strictEqual(approvedDoc.approvalStatus, 'approved');

    // Check version list after approval: MUST NOT drop to 1!
    const afterList = simulateSubscribeToBlueprintVersions('org_1', 'idea_mvp');
    assert.strictEqual(afterList.length, 3, 'All 3 versions must remain available in version history');

    // Verify ordering and statuses
    assert.strictEqual(afterList[0].version, '3.0');
    assert.strictEqual(afterList[0].approvalStatus, 'approved');
    assert.strictEqual(afterList[1].version, '2.0');
    assert.strictEqual(afterList[2].version, '1.0');
  });

  // -------------------------------------------------------------
  // Test 2: Multiple approvals preserve full history
  // -------------------------------------------------------------
  it('TEST 2: Multiple approvals preserve complete historical chain across all versions', () => {
    seedVersions('org_1', 'idea_mvp', [
      { version: '1.0', status: 'completed' },
      { version: '2.0', status: 'completed' },
      { version: '3.0', status: 'approved', approvalStatus: 'approved' },
      { version: '4.0', status: 'completed' },
    ]);

    // Current active blueprint was 3.0
    mockDb.blueprints['org_1/idea_mvp'].version = '3.0';
    mockDb.blueprints['org_1/idea_mvp'].activeVersionId = '3.0';

    // Approve Version 4.0
    simulateApproveBlueprintVersion('org_1', 'user_1', '4.0');

    const versions = simulateSubscribeToBlueprintVersions('org_1', 'idea_mvp');
    assert.strictEqual(versions.length, 4, 'All 4 versions must remain visible');

    // V4.0 is now active & approved
    const v4 = versions.find((v) => v.version === '4.0');
    assert.strictEqual(v4.approvalStatus, 'approved');

    // V3.0 was marked superseded
    const v3 = versions.find((v) => v.version === '3.0');
    assert.strictEqual(v3.status, 'superseded');

    // V2.0 and V1.0 still exist
    assert(versions.some((v) => v.version === '2.0'));
    assert(versions.some((v) => v.version === '1.0'));
  });

  // -------------------------------------------------------------
  // Test 3: Viewing historical version does not change active version
  // -------------------------------------------------------------
  it('TEST 3: Selecting and viewing historical V2.0 leaves active version as V4.0', () => {
    seedVersions('org_1', 'idea_mvp', [
      { version: '1.0' },
      { version: '2.0' },
      { version: '3.0' },
      { version: '4.0', approvalStatus: 'approved' },
    ]);

    // Active blueprint
    const activeBp = mockDb.blueprints['org_1/idea_mvp'];
    assert.strictEqual(activeBp.version, '4.0');

    // User selects V2.0 for read-only preview
    const selectedVersionKey = 'v2_0';
    const versions = simulateSubscribeToBlueprintVersions('org_1', 'idea_mvp');
    const selected = versions.find((v) => v.key === selectedVersionKey);

    assert(selected);
    assert.strictEqual(selected.version, '2.0');
    assert.strictEqual(selected.content.title, 'Content for 2.0');

    // Verify active version in database has NOT changed
    const currentActive = mockDb.blueprints['org_1/idea_mvp'];
    assert.strictEqual(currentActive.version, '4.0');
    assert.strictEqual(currentActive.activeVersionId, '4.0');
  });

  // -------------------------------------------------------------
  // Test 4: Realtime synchronization between two users
  // -------------------------------------------------------------
  it('TEST 4: User B sees User A approval in real-time with full version history intact', () => {
    seedVersions('org_1', 'idea_mvp', [
      { version: '1.0' },
      { version: '2.0' },
    ]);

    // User B listener state
    let userBSnapshot = null;
    const userBListener = (list) => {
      userBSnapshot = list;
    };

    // User B subscribes
    userBListener(simulateSubscribeToBlueprintVersions('org_1', 'idea_mvp'));
    assert.strictEqual(userBSnapshot.length, 2);

    // User A generates and approves V3.0
    const v3Key = 'v3_0';
    mockDb.blueprints['org_1/idea_mvp/versions'][v3Key] = {
      key: v3Key,
      version: '3.0',
      status: 'completed',
      content: { title: 'Content for 3.0' },
    };
    mockDb.blueprints['org_1/versions'][v3Key] = {
      key: v3Key,
      version: '3.0',
      status: 'completed',
      content: { title: 'Content for 3.0' },
    };

    simulateApproveBlueprintVersion('org_1', 'user_1', '3.0');

    // Realtime notification fires for User B
    userBListener(simulateSubscribeToBlueprintVersions('org_1', 'idea_mvp'));

    assert.strictEqual(userBSnapshot.length, 3, 'User B sees all 3 versions without reload');
    assert.strictEqual(userBSnapshot[0].version, '3.0');
    assert.strictEqual(userBSnapshot[0].approvalStatus, 'approved');
  });

  // -------------------------------------------------------------
  // Test 5: Recovery of historical versions across reloads
  // -------------------------------------------------------------
  it('TEST 5: Recovers historical versions from root path even if mvp path suffered partial wipe', () => {
    // Simulate legacy bug state: mvp path has only 1 version (v13_0),
    // while root path still retains all 13 versions (v1_0 through v13_0)
    const all13 = {};
    for (let i = 1; i <= 13; i++) {
      all13[`v${i}_0`] = {
        key: `v${i}_0`,
        version: `${i}.0`,
        status: i === 13 ? 'approved' : 'superseded',
        content: { title: `Version ${i}.0` },
      };
    }

    mockDb.blueprints['org_1/versions'] = { ...all13 }; // Root has all 13
    mockDb.blueprints['org_1/idea_mvp/versions'] = { v13_0: all13['v13_0'] }; // MVP path was wiped to 1

    // New subscriber merges dual paths
    const recoveredList = simulateSubscribeToBlueprintVersions('org_1', 'idea_mvp');
    assert.strictEqual(recoveredList.length, 13, 'Successfully recovered all 13 historical versions');
    assert.strictEqual(recoveredList[0].version, '13.0');
    assert.strictEqual(recoveredList[12].version, '1.0');

    // Subsequent approval re-syncs and repairs both paths
    simulateApproveBlueprintVersion('org_1', 'user_1', '13.0');

    // Both paths are now completely restored to 13 versions
    const repairedMvp = Object.keys(mockDb.blueprints['org_1/idea_mvp/versions']);
    assert.strictEqual(repairedMvp.length, 13, 'Repaired and restored all 13 versions to MVP path');
  });
});
