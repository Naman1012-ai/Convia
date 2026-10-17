import assert from 'node:assert';
import { rtdbService } from '../rtdbService.js';
import { importRequestService } from '../importRequestService.js';

console.log('🧪 ====================================================');
console.log('🧪 PUBLIC IDEA IMPORT APPROVAL SYSTEM TEST SUITE');
console.log('🧪 ====================================================\n');

// In-Memory Database Simulator for Testing
const mockDb = new Map();

// Intercept rtdbService calls for deterministic hermetic testing
rtdbService.getData = async (path) => {
  const cleanPath = String(path).replace(/^\/+|\/+$/g, '');
  if (!cleanPath) {
    const root = {};
    for (const [k, v] of mockDb.entries()) {
      const parts = k.split('/');
      let curr = root;
      for (let i = 0; i < parts.length - 1; i++) {
        curr[parts[i]] = curr[parts[i]] || {};
        curr = curr[parts[i]];
      }
      curr[parts[parts.length - 1]] = v;
    }
    return root;
  }

  // Exact match
  if (mockDb.has(cleanPath)) {
    return JSON.parse(JSON.stringify(mockDb.get(cleanPath)));
  }

  // Prefix match (folder query)
  const result = {};
  let found = false;
  const prefix = cleanPath + '/';
  for (const [k, v] of mockDb.entries()) {
    if (k.startsWith(prefix)) {
      found = true;
      const subKey = k.slice(prefix.length);
      const parts = subKey.split('/');
      let curr = result;
      for (let i = 0; i < parts.length - 1; i++) {
        curr[parts[i]] = curr[parts[i]] || {};
        curr = curr[parts[i]];
      }
      curr[parts[parts.length - 1]] = JSON.parse(JSON.stringify(v));
    }
  }

  return found ? result : null;
};

rtdbService.setData = async (path, val) => {
  const cleanPath = String(path).replace(/^\/+|\/+$/g, '');
  mockDb.set(cleanPath, JSON.parse(JSON.stringify(val)));
  return true;
};

rtdbService.updateData = async (basePath, updates) => {
  if (typeof updates !== 'object') return false;
  for (const [key, val] of Object.entries(updates)) {
    const fullPath = [basePath, key].filter(Boolean).join('/').replace(/\/+/g, '/').replace(/^\/+|\/+$/g, '');
    mockDb.set(fullPath, JSON.parse(JSON.stringify(val)));

    for (const [existingKey, existingVal] of mockDb.entries()) {
      if (typeof existingVal === 'object' && existingVal !== null) {
        if (fullPath.startsWith(existingKey + '/')) {
          const subProp = fullPath.slice(existingKey.length + 1);
          existingVal[subProp] = JSON.parse(JSON.stringify(val));
        } else if (existingKey === basePath) {
          existingVal[key] = JSON.parse(JSON.stringify(val));
        }
      }
    }
  }
  return true;
};

rtdbService.removeData = async (path) => {
  const cleanPath = String(path).replace(/^\/+|\/+$/g, '');
  mockDb.delete(cleanPath);
  return true;
};

async function runTests() {
  // Setup Seed Data
  const creatorUid = 'user_creator_001';
  const requesterUid = 'user_requester_002';
  const strangerUid = 'user_stranger_003';
  const workspaceId = 'ws_hackathon_99';
  const strangerWorkspaceId = 'ws_stranger_88';

  const samplePublicIdea = {
    ideaId: 'pub_idea_100',
    title: 'Autonomous Solar Water Purifier',
    description: 'An AI-powered solar device that purifies brackish water.',
    problemStatement: 'Lack of clean drinking water in arid zones.',
    proposedSolution: 'Solar distillation with ML yield optimization.',
    techStack: 'Raspberry Pi, Python, Solar Cells',
    category: 'CleanTech',
    authorId: creatorUid,
    authorName: 'Dr. Solar Innovator',
    voteCount: 42,
    commentCount: 5,
    createdAt: Date.now() - 100000,
    isDeleted: false,
  };

  const sampleWorkspace = {
    orgId: workspaceId,
    name: 'Hackathon Alpha Team',
    ownerId: 'user_lead_000',
  };

  const requesterMembership = {
    uid: requesterUid,
    role: 'member',
    isDeleted: false,
  };

  mockDb.set(`publicIdeas/${samplePublicIdea.ideaId}`, samplePublicIdea);
  mockDb.set(`organizations/${workspaceId}`, sampleWorkspace);
  mockDb.set(`organization_members/${workspaceId}/${requesterUid}`, requesterMembership);
  mockDb.set(`users/${creatorUid}`, { uid: creatorUid, displayName: 'Dr. Solar Innovator', email: 'creator@test.com' });
  mockDb.set(`users/${requesterUid}`, { uid: requesterUid, displayName: 'Alice Engineer', email: 'alice@test.com' });

  // TEST 1: Request note validation (rejection of < 20 characters)
  console.log('🔍 TEST GROUP 1: Request Note & Input Validation');
  await assert.rejects(
    async () => {
      await importRequestService.createRequest({
        ideaId: samplePublicIdea.ideaId,
        requesterUid,
        requesterWorkspaceId: workspaceId,
        requestNote: 'Too short',
        userRecord: { displayName: 'Alice Engineer' },
      });
    },
    (err) => {
      assert.strictEqual(err.code, 'INVALID_NOTE_LENGTH');
      return true;
    },
    'Should reject notes shorter than 20 characters'
  );
  console.log('  ✅ PASS: TEST 1: Rejects note under 20 characters');

  // TEST 2: Workspace Membership Validation
  console.log('\n🔍 TEST GROUP 2: Workspace Membership Verification');
  await assert.rejects(
    async () => {
      await importRequestService.createRequest({
        ideaId: samplePublicIdea.ideaId,
        requesterUid: strangerUid,
        requesterWorkspaceId: workspaceId,
        requestNote: 'We want to build this for our final semester capstone project.',
        userRecord: { displayName: 'Stranger' },
      });
    },
    (err) => {
      assert.strictEqual(err.code, 'FORBIDDEN_WORKSPACE_MEMBERSHIP');
      return true;
    },
    'Should reject users who are not active members of target workspace'
  );
  console.log('  ✅ PASS: TEST 2: Strictly verifies requester workspace membership');

  // TEST 3: Creator Self-Import Shortcut
  console.log('\n🔍 TEST GROUP 3: Creator Self-Import Shortcut');
  mockDb.set(`organization_members/${workspaceId}/${creatorUid}`, { uid: creatorUid, role: 'admin', isDeleted: false });
  const selfImportResult = await importRequestService.createRequest({
    ideaId: samplePublicIdea.ideaId,
    requesterUid: creatorUid,
    requesterWorkspaceId: workspaceId,
    requestNote: 'Direct self import bypassing review',
    userRecord: { displayName: 'Dr. Solar Innovator' },
  });
  assert.strictEqual(selfImportResult.selfImport, true);
  assert.ok(selfImportResult.importedIdea);
  assert.strictEqual(selfImportResult.importedIdea.title, samplePublicIdea.title);
  assert.strictEqual(selfImportResult.importedIdea.origin.originalAuthorId, creatorUid);
  console.log('  ✅ PASS: TEST 3: Original creator can import directly without creating approval request');

  // Clean up workspace idea from test 3 so we can test the standard request flow
  mockDb.delete(`ideas/${workspaceId}/${selfImportResult.importedIdea.ideaId}`);

  // TEST 4: Submit Valid Import Request
  console.log('\n🔍 TEST GROUP 4: Import Request Creation & Duplication Prevention');
  const validNote = 'We are a clean energy team competing in Global Hack 2026 and want to test this design.';
  const reqResult = await importRequestService.createRequest({
    ideaId: samplePublicIdea.ideaId,
    requesterUid,
    requesterWorkspaceId: workspaceId,
    requestNote: validNote,
    userRecord: { displayName: 'Alice Engineer', email: 'alice@test.com' },
  });
  assert.strictEqual(reqResult.success, true);
  assert.strictEqual(reqResult.request.status, 'PENDING');
  assert.strictEqual(reqResult.request.creatorUid, creatorUid);
  assert.strictEqual(reqResult.request.requesterUid, requesterUid);
  const createdRequestId = reqResult.request.requestId;
  console.log('  ✅ PASS: TEST 4: Valid import request created with status PENDING');

  // TEST 5: Duplicate Pending Request Prevention
  await assert.rejects(
    async () => {
      await importRequestService.createRequest({
        ideaId: samplePublicIdea.ideaId,
        requesterUid,
        requesterWorkspaceId: workspaceId,
        requestNote: 'Sending another identical request while first is still pending.',
        userRecord: { displayName: 'Alice Engineer' },
      });
    },
    (err) => {
      assert.strictEqual(err.code, 'USER_REQUEST_ALREADY_PENDING');
      return true;
    },
    'Should prevent duplicate pending requests for same idea and workspace'
  );
  console.log('  ✅ PASS: TEST 5: Prevents duplicate pending request for same idea & workspace');

  // TEST 6: Authorization on Approval (Non-creator / Requester cannot approve)
  console.log('\n🔍 TEST GROUP 5: Approval Authorization & Atomic Execution');
  await assert.rejects(
    async () => {
      await importRequestService.approveRequest({
        requestId: createdRequestId,
        actorUid: requesterUid, // Requester trying to approve their own request!
        actorName: 'Alice Engineer',
      });
    },
    (err) => {
      assert.strictEqual(err.code, 'FORBIDDEN_APPROVAL');
      return true;
    },
    'Requester must not be allowed to approve their own request'
  );
  console.log('  ✅ PASS: TEST 6: Requester is prevented from approving their own request');

  await assert.rejects(
    async () => {
      await importRequestService.approveRequest({
        requestId: createdRequestId,
        actorUid: strangerUid, // Random user trying to approve
        actorName: 'Stranger',
      });
    },
    (err) => {
      assert.strictEqual(err.code, 'FORBIDDEN_APPROVAL');
      return true;
    },
    'Third party cannot approve request'
  );
  console.log('  ✅ PASS: TEST 7: Random non-creator cannot approve request');

  // TEST 8: Creator Approves -> Atomic Import Creation
  const approveResult = await importRequestService.approveRequest({
    requestId: createdRequestId,
    actorUid: creatorUid,
    actorName: 'Dr. Solar Innovator',
  });
  assert.strictEqual(approveResult.success, true);
  assert.strictEqual(approveResult.request.status, 'IMPORTED');
  assert.ok(approveResult.importedIdea);

  // Verify workspace idea attribution & independence
  const importedIdea = approveResult.importedIdea;
  assert.strictEqual(importedIdea.orgId, workspaceId);
  assert.strictEqual(importedIdea.authorId, requesterUid);
  assert.strictEqual(importedIdea.origin.type, 'imported');
  assert.strictEqual(importedIdea.origin.publicIdeaId, samplePublicIdea.ideaId);
  assert.strictEqual(importedIdea.origin.originalAuthorId, creatorUid);
  assert.strictEqual(importedIdea.importedFromPublicId, samplePublicIdea.ideaId);

  // Verify original public idea was NOT mutated
  const originalIdeaAfter = mockDb.get(`publicIdeas/${samplePublicIdea.ideaId}`);
  assert.strictEqual(originalIdeaAfter.authorId, creatorUid);
  assert.strictEqual(originalIdeaAfter.voteCount, 42); // Untouched!
  console.log('  ✅ PASS: TEST 8: Creator approval creates independent attributed workspace idea and preserves public idea');

  // TEST 9: Already Imported Check
  console.log('\n🔍 TEST GROUP 6: Already Imported Safeguard');
  await assert.rejects(
    async () => {
      await importRequestService.createRequest({
        ideaId: samplePublicIdea.ideaId,
        requesterUid,
        requesterWorkspaceId: workspaceId,
        requestNote: 'Trying to request an idea that was already imported into this workspace.',
        userRecord: { displayName: 'Alice Engineer' },
      });
    },
    (err) => {
      assert.strictEqual(err.code, 'ALREADY_IMPORTED');
      return true;
    },
    'Should reject requests for ideas already imported into workspace'
  );
  console.log('  ✅ PASS: TEST 9: Rejects new import request when idea is already imported');

  // TEST 10: Rejection Flow
  console.log('\n🔍 TEST GROUP 7: Rejection Flow');
  const idea2 = {
    ideaId: 'pub_idea_200',
    title: 'Quantum Drone Mesh',
    problemStatement: 'Drone mesh network synchronization.',
    authorId: creatorUid,
    authorName: 'Dr. Solar Innovator',
    createdAt: Date.now(),
    isDeleted: false,
  };
  mockDb.set(`publicIdeas/${idea2.ideaId}`, idea2);

  const req2 = await importRequestService.createRequest({
    ideaId: idea2.ideaId,
    requesterUid,
    requesterWorkspaceId: workspaceId,
    requestNote: 'We want to test this for an urban search and rescue simulation.',
    userRecord: { displayName: 'Alice Engineer' },
  });

  // Rejection requires valid reason (5-500 chars)
  await assert.rejects(
    async () => {
      await importRequestService.rejectRequest({
        requestId: req2.request.requestId,
        actorUid: creatorUid,
        rejectionReason: 'No', // Too short
      });
    },
    (err) => {
      assert.strictEqual(err.code, 'INVALID_REJECTION_REASON');
      return true;
    }
  );

  const rejectResult = await importRequestService.rejectRequest({
    requestId: req2.request.requestId,
    actorUid: creatorUid,
    rejectionReason: 'This idea is under active patent application and cannot be used yet.',
  });
  assert.strictEqual(rejectResult.success, true);
  assert.strictEqual(rejectResult.request.status, 'REJECTED');
  assert.strictEqual(rejectResult.request.rejectionReason, 'This idea is under active patent application and cannot be used yet.');
  console.log('  ✅ PASS: TEST 10: Rejection flow requires reason and records status REJECTED');

  // TEST 11: Cancellation Flow
  console.log('\n🔍 TEST GROUP 8: Requester Cancellation Flow');
  const idea3 = {
    ideaId: 'pub_idea_300',
    title: 'Smart Waste Sorting Bin',
    problemStatement: 'Sorting waste efficiently.',
    authorId: creatorUid,
    authorName: 'Dr. Solar Innovator',
    createdAt: Date.now(),
    isDeleted: false,
  };
  mockDb.set(`publicIdeas/${idea3.ideaId}`, idea3);

  const req3 = await importRequestService.createRequest({
    ideaId: idea3.ideaId,
    requesterUid,
    requesterWorkspaceId: workspaceId,
    requestNote: 'Interested in prototyping this sensor with our robotics club.',
    userRecord: { displayName: 'Alice Engineer' },
  });

  // Stranger cannot cancel
  await assert.rejects(
    async () => {
      await importRequestService.cancelRequest({
        requestId: req3.request.requestId,
        actorUid: strangerUid,
      });
    },
    (err) => {
      assert.strictEqual(err.code, 'FORBIDDEN_CANCELLATION');
      return true;
    }
  );

  // Requester cancels
  const cancelResult = await importRequestService.cancelRequest({
    requestId: req3.request.requestId,
    actorUid: requesterUid,
  });
  assert.strictEqual(cancelResult.success, true);
  const req3After = mockDb.get(`import_requests/${req3.request.requestId}`);
  assert.strictEqual(req3After.status, 'CANCELLED');
  console.log('  ✅ PASS: TEST 11: Requester can cancel pending request; strangers are forbidden');

  // TEST 12: Roster Queries
  console.log('\n🔍 TEST GROUP 9: Roster Queries');
  const creatorRequests = await importRequestService.getRequestsForCreator(creatorUid);
  assert.strictEqual(creatorRequests.length, 3);

  const requesterRequests = await importRequestService.getRequestsForRequester(requesterUid);
  assert.strictEqual(requesterRequests.length, 3);
  console.log('  ✅ PASS: TEST 12: Creator and requester roster queries return ordered records');

  // TEST 13: Cross-Workspace Per-User Lock (USER_PENDING_IN_ANOTHER_WORKSPACE)
  console.log('\n🔍 TEST GROUP 10: Multi-Workspace & Teammate Collision Safeguards');
  const idea4 = {
    ideaId: 'pub_idea_400',
    title: 'Autonomous Agro Drone',
    problemStatement: 'Precision irrigation.',
    authorId: creatorUid,
    authorName: 'Dr. Solar Innovator',
    createdAt: Date.now(),
    isDeleted: false,
  };
  mockDb.set(`publicIdeas/${idea4.ideaId}`, idea4);

  const workspaceB = 'ws_hackathon_beta';
  mockDb.set(`organizations/${workspaceB}`, { orgId: workspaceB, name: 'Beta Innovators' });
  mockDb.set(`organization_members/${workspaceB}/${requesterUid}`, { uid: requesterUid, role: 'member', isDeleted: false });

  // Requester submits request for idea4 into workspaceA (workspaceId)
  const reqIdea4A = await importRequestService.createRequest({
    ideaId: idea4.ideaId,
    requesterUid,
    requesterWorkspaceId: workspaceId,
    requestNote: 'We want to test this in our Alpha Workspace for local field trials.',
    userRecord: { displayName: 'Alice Engineer' },
  });
  assert.strictEqual(reqIdea4A.success, true);

  // Now, same requester tries to submit request for idea4 into workspaceB -> Should be rejected with USER_PENDING_IN_ANOTHER_WORKSPACE
  await assert.rejects(
    async () => {
      await importRequestService.createRequest({
        ideaId: idea4.ideaId,
        requesterUid,
        requesterWorkspaceId: workspaceB,
        requestNote: 'Now also requesting the exact same idea for our Beta Workspace.',
        userRecord: { displayName: 'Alice Engineer' },
      });
    },
    (err) => {
      assert.strictEqual(err.code, 'USER_PENDING_IN_ANOTHER_WORKSPACE');
      assert.strictEqual(err.details?.conflictingWorkspaceId, workspaceId);
      return true;
    },
    'Should prevent single user from requesting same idea into multiple workspaces simultaneously'
  );
  console.log('  ✅ PASS: TEST 13: Prevents single user from requesting same idea across multiple workspaces simultaneously');

  // TEST 14: Teammate Collision in Same Workspace (TEAMMATE_REQUEST_ALREADY_PENDING)
  const teammateUid = 'user_teammate_bob';
  mockDb.set(`users/${teammateUid}`, { uid: teammateUid, displayName: 'Bob Colleague', email: 'bob@test.com' });
  mockDb.set(`organization_members/${workspaceId}/${teammateUid}`, { uid: teammateUid, role: 'member', isDeleted: false });

  await assert.rejects(
    async () => {
      await importRequestService.createRequest({
        ideaId: idea4.ideaId,
        requesterUid: teammateUid,
        requesterWorkspaceId: workspaceId,
        requestNote: 'Bob also requesting the same idea into Alpha Team workspace.',
        userRecord: { displayName: 'Bob Colleague' },
      });
    },
    (err) => {
      assert.strictEqual(err.code, 'TEAMMATE_REQUEST_ALREADY_PENDING');
      assert.strictEqual(err.details?.teammateName, 'Alice Engineer');
      assert.strictEqual(err.details?.requestId, reqIdea4A.request.requestId);
      return true;
    },
    'Should detect teammate collision and report existing requester name'
  );
  console.log('  ✅ PASS: TEST 14: Detects teammate collision in same workspace and returns @teammate details');

  // TEST 15: Distinct Workspaces Can Independently Request Idea
  const charlieUid = 'user_charlie_gamma';
  const workspaceGamma = 'ws_hackathon_gamma';
  mockDb.set(`users/${charlieUid}`, { uid: charlieUid, displayName: 'Charlie External', email: 'charlie@test.com' });
  mockDb.set(`organizations/${workspaceGamma}`, { orgId: workspaceGamma, name: 'Gamma Lab' });
  mockDb.set(`organization_members/${workspaceGamma}/${charlieUid}`, { uid: charlieUid, role: 'member', isDeleted: false });

  const reqIdea4Gamma = await importRequestService.createRequest({
    ideaId: idea4.ideaId,
    requesterUid: charlieUid,
    requesterWorkspaceId: workspaceGamma,
    requestNote: 'Gamma Lab independently requesting this idea for academic research.',
    userRecord: { displayName: 'Charlie External' },
  });
  assert.strictEqual(reqIdea4Gamma.success, true);
  assert.strictEqual(reqIdea4Gamma.request.requesterWorkspaceId, workspaceGamma);
  console.log('  ✅ PASS: TEST 15: Multiple distinct workspaces can independently request the same idea');

  // TEST 16: Pre-flight Status Query (getIdeaImportStatus)
  console.log('\n🔍 TEST GROUP 11: Pre-flight Import Status Check');
  const bobStatus = await importRequestService.getIdeaImportStatus({
    ideaId: idea4.ideaId,
    userUid: teammateUid,
    workspaceIds: [workspaceId, workspaceB],
  });
  assert.strictEqual(bobStatus.ideaId, idea4.ideaId);
  assert.strictEqual(bobStatus.userPendingRequest, null); // Bob hasn't submitted one
  assert.ok(bobStatus.workspaceStatuses[workspaceId]);
  assert.strictEqual(bobStatus.workspaceStatuses[workspaceId].isImported, false);
  assert.ok(bobStatus.workspaceStatuses[workspaceId].pendingRequest);
  assert.strictEqual(bobStatus.workspaceStatuses[workspaceId].pendingRequest.isSelf, false); // Alice submitted, not Bob!
  assert.strictEqual(bobStatus.workspaceStatuses[workspaceId].pendingRequest.requesterName, 'Alice Engineer');

  const aliceStatus = await importRequestService.getIdeaImportStatus({
    ideaId: idea4.ideaId,
    userUid: requesterUid,
    workspaceIds: [workspaceId, workspaceB],
  });
  assert.ok(aliceStatus.userPendingRequest);
  assert.strictEqual(aliceStatus.userPendingRequest.requesterWorkspaceId, workspaceId);
  assert.strictEqual(aliceStatus.workspaceStatuses[workspaceId].pendingRequest.isSelf, true); // Alice is self!

  console.log('  ✅ PASS: TEST 16: getIdeaImportStatus returns rich per-workspace and cross-workspace status');

  // TEST 17: Requester Sent Request History with Rejection Reason
  console.log('\n🔍 TEST GROUP 12: Requester History & Creator Teammate Import Block');
  const requesterSentHistory = await importRequestService.getRequestsForRequester(requesterUid);
  const rejectedRequest = requesterSentHistory.find((r) => r.status === 'REJECTED');
  assert.ok(rejectedRequest, 'Requester history should contain the rejected request');
  assert.strictEqual(
    rejectedRequest.rejectionReason,
    'This idea is under active patent application and cannot be used yet.'
  );
  console.log('  ✅ PASS: TEST 17: Requester history accurately retains status REJECTED and rejectionReason');

  // TEST 18: Creator Trying to Import an Idea Already Imported by a Teammate
  // Setup: user2 (creatorUid) created idea5. user1 (requesterUid) and user2 are both members of workspaceDelta.
  const workspaceDelta = 'ws_hackathon_delta';
  const idea5 = {
    ideaId: 'pub_idea_500',
    title: 'Biometric Smart Lock Mesh',
    problemStatement: 'Decentralized access control.',
    authorId: creatorUid, // owned by user2 (creatorUid)
    authorName: 'Dr. Solar Innovator',
    createdAt: Date.now(),
    isDeleted: false,
  };
  mockDb.set(`publicIdeas/${idea5.ideaId}`, idea5);
  mockDb.set(`organizations/${workspaceDelta}`, { orgId: workspaceDelta, name: 'Delta Security Team' });
  // Both creator and requester are members
  mockDb.set(`organization_members/${workspaceDelta}/${creatorUid}`, { uid: creatorUid, role: 'member', isDeleted: false });
  mockDb.set(`organization_members/${workspaceDelta}/${requesterUid}`, { uid: requesterUid, role: 'member', isDeleted: false });

  // user1 (requesterUid) submits request for idea5 into workspaceDelta
  const reqIdea5 = await importRequestService.createRequest({
    ideaId: idea5.ideaId,
    requesterUid,
    requesterWorkspaceId: workspaceDelta,
    requestNote: 'We want to test this biometric lock in our Delta workspace lab.',
    userRecord: { displayName: 'Alice Engineer', email: 'alice@test.com' },
  });

  // user2 (creatorUid) approves user1's request
  await importRequestService.approveRequest({
    requestId: reqIdea5.request.requestId,
    actorUid: creatorUid,
    actorName: 'Dr. Solar Innovator',
  });

  // Now user1 has imported idea5 into workspaceDelta!
  // Pre-flight check for user2 (creatorUid) should show isImported=true, importedBy: Alice Engineer, isSelf=false
  const creatorPreflight = await importRequestService.getIdeaImportStatus({
    ideaId: idea5.ideaId,
    userUid: creatorUid,
    workspaceIds: [workspaceDelta],
  });
  assert.strictEqual(creatorPreflight.workspaceStatuses[workspaceDelta].isImported, true);
  assert.strictEqual(creatorPreflight.workspaceStatuses[workspaceDelta].importedBy.name, 'Alice Engineer');
  assert.strictEqual(creatorPreflight.workspaceStatuses[workspaceDelta].importedBy.isSelf, false);

  // Now, user2 (creatorUid) attempts to import the same idea into workspaceDelta:
  // Must be rejected with ALREADY_IMPORTED and inform that @Alice Engineer already imported it
  await assert.rejects(
    async () => {
      await importRequestService.createRequest({
        ideaId: idea5.ideaId,
        requesterUid: creatorUid,
        requesterWorkspaceId: workspaceDelta,
        requestNote: 'Direct self import into Delta workspace.',
        userRecord: { displayName: 'Dr. Solar Innovator' },
      });
    },
    (err) => {
      assert.strictEqual(err.code, 'ALREADY_IMPORTED');
      assert.strictEqual(err.details?.importerName, 'Alice Engineer');
      assert.strictEqual(err.details?.isSelf, false);
      assert.match(err.message, /@Alice Engineer has already imported this idea/);
      return true;
    },
    'Should prompt creator that teammate already imported the idea'
  );
  console.log('  ✅ PASS: TEST 18: Prompts creator that teammate (@Alice Engineer) has already imported the idea');

  console.log('\n====================================================');
  console.log('📊 ALL 18 IMPORT REQUEST APPROVAL SYSTEM TESTS PASSED!');
  console.log('====================================================\n');
}

runTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
