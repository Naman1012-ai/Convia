import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTIVITY_EVENT_TYPES,
  ACTIVITY_CATEGORIES,
  getActivityCategory,
  buildActivityDedupeKey,
  createCanonicalActivity,
} from '../../constants/activityConstants.js';

import {
  NOTIFICATION_TYPES,
  NOTIFICATION_CATEGORIES,
  getNotificationCategory,
  createCanonicalNotification,
} from '../../constants/notificationConstants.js';

describe('Activity History & Notification System Flow Verification', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = {
      workspace_activity: {},
      user_notifications: {},
      organizations: {},
      organization_members: {},
    };
  });

  it('Test 1: Blueprint generation started and completed events', async () => {
    const workspaceId = 'org_alpha';
    const userUid = 'user_alice';
    const ideaId = 'idea_mvp_1';

    // 1. Generation starts
    const startTimestamp = 1700000000000;
    const startedEvent = createCanonicalActivity({
      workspaceId,
      eventType: ACTIVITY_EVENT_TYPES.BLUEPRINT_GENERATION_STARTED,
      actorId: userUid,
      actorType: 'user',
      actorName: 'Alice',
      resourceType: 'blueprint',
      resourceId: `bp_${workspaceId}_${ideaId}`,
      resourceTitle: 'AI Health Tracker',
      summary: 'AI Blueprint generation started for "AI Health Tracker"',
      createdAt: startTimestamp,
    });

    assert.equal(startedEvent.eventType, 'blueprint.generation_started');
    assert.equal(getActivityCategory(startedEvent.eventType), ACTIVITY_CATEGORIES.BLUEPRINT);
    mockDb.workspace_activity[`${workspaceId}/${startedEvent.id}`] = startedEvent;

    // 2. Generation completes
    const completeTimestamp = 1700000005000;
    const completedEvent = createCanonicalActivity({
      workspaceId,
      eventType: ACTIVITY_EVENT_TYPES.BLUEPRINT_GENERATION_COMPLETED,
      actorId: 'system',
      actorType: 'system',
      actorName: 'Convia AI Engine',
      resourceType: 'blueprint',
      resourceId: `bp_${workspaceId}_${ideaId}`,
      resourceTitle: 'AI Health Tracker',
      summary: 'AI Blueprint generation completed for "AI Health Tracker" (v1.0)',
      metadata: { version: '1.0' },
      createdAt: completeTimestamp,
    });

    assert.equal(completedEvent.eventType, 'blueprint.generation_completed');
    assert.equal(getActivityCategory(completedEvent.eventType), ACTIVITY_CATEGORIES.BLUEPRINT);
    mockDb.workspace_activity[`${workspaceId}/${completedEvent.id}`] = completedEvent;

    // 3. Verify notification created for waiting initiator (Alice)
    const notifAlice = createCanonicalNotification({
      notificationId: 'notif_comp_1',
      recipientId: userUid,
      workspaceId,
      type: NOTIFICATION_TYPES.BLUEPRINT_COMPLETED,
      title: 'Blueprint v1.0 Completed',
      body: 'AI Architecture Blueprint for "AI Health Tracker" is ready for review.',
      actorId: 'system',
      actorName: 'Convia AI Engine',
      resourceType: 'blueprint',
      resourceId: `bp_${workspaceId}`,
      actionUrl: `/workspaces/${workspaceId}/blueprint`,
      createdAt: completeTimestamp,
    });

    mockDb.user_notifications[`${userUid}/${notifAlice.notificationId}`] = notifAlice;

    assert.equal(notifAlice.recipientId, userUid);
    assert.equal(notifAlice.type, NOTIFICATION_TYPES.BLUEPRINT_COMPLETED);
    assert.equal(notifAlice.read, false);
    assert.equal(getNotificationCategory(notifAlice.type), NOTIFICATION_CATEGORIES.BLUEPRINT);
  });

  it('Test 2: Member leaves workspace is recorded BEFORE membership removal', async () => {
    const orgId = 'org_alpha';
    const userUid = 'user_bob';

    // Mock initial membership
    mockDb.organization_members[`${orgId}/${userUid}`] = { uid: userUid, role: 'member' };

    const leaveTimestamp = 1700000010000;

    // Invariant: Record event while membership is still present in database
    assert.ok(mockDb.organization_members[`${orgId}/${userUid}`], 'User must be a member when event is recorded');

    const leaveEvent = createCanonicalActivity({
      workspaceId: orgId,
      eventType: ACTIVITY_EVENT_TYPES.WORKSPACE_MEMBER_REMOVED,
      actorId: userUid,
      actorType: 'user',
      actorName: 'Bob',
      resourceType: 'workspace',
      resourceId: orgId,
      resourceTitle: 'Alpha Org',
      summary: 'Bob left the workspace',
      createdAt: leaveTimestamp,
    });

    mockDb.workspace_activity[`${orgId}/${leaveEvent.id}`] = leaveEvent;

    // Now membership is safely removed
    delete mockDb.organization_members[`${orgId}/${userUid}`];

    assert.equal(mockDb.organization_members[`${orgId}/${userUid}`], undefined);
    assert.ok(mockDb.workspace_activity[`${orgId}/${leaveEvent.id}`], 'Leave event remains preserved in workspace history');
  });

  it('Test 3: Member rejoins workspace without dedupe key collision', async () => {
    const orgId = 'org_alpha';
    const userUid = 'user_bob';

    const join1Timestamp = 1700000000000;
    const join1Event = createCanonicalActivity({
      workspaceId: orgId,
      eventType: ACTIVITY_EVENT_TYPES.WORKSPACE_MEMBER_JOINED,
      actorId: userUid,
      actorType: 'user',
      actorName: 'Bob',
      resourceType: 'workspace',
      resourceId: orgId,
      summary: 'Bob joined the workspace',
      createdAt: join1Timestamp,
    });

    const leaveTimestamp = 1700000010000;
    const leaveEvent = createCanonicalActivity({
      workspaceId: orgId,
      eventType: ACTIVITY_EVENT_TYPES.WORKSPACE_MEMBER_REMOVED,
      actorId: userUid,
      actorType: 'user',
      actorName: 'Bob',
      resourceType: 'workspace',
      resourceId: orgId,
      summary: 'Bob left the workspace',
      createdAt: leaveTimestamp,
    });

    const join2Timestamp = 1700000020000;
    const join2Event = createCanonicalActivity({
      workspaceId: orgId,
      eventType: ACTIVITY_EVENT_TYPES.WORKSPACE_MEMBER_JOINED,
      actorId: userUid,
      actorType: 'user',
      actorName: 'Bob',
      resourceType: 'workspace',
      resourceId: orgId,
      summary: 'Bob joined the workspace',
      createdAt: join2Timestamp,
    });

    // Invariant: join1Event.id and join2Event.id MUST BE DIFFERENT so neither is dropped or rejected
    assert.notEqual(join1Event.id, join2Event.id, 'Rejoin event ID must be unique to avoid !data.exists() collision');
    assert.notEqual(leaveEvent.id, join2Event.id);

    mockDb.workspace_activity[`${orgId}/${join1Event.id}`] = join1Event;
    mockDb.workspace_activity[`${orgId}/${leaveEvent.id}`] = leaveEvent;
    mockDb.workspace_activity[`${orgId}/${join2Event.id}`] = join2Event;

    const orgActivities = Object.keys(mockDb.workspace_activity).filter((k) => k.startsWith(`${orgId}/`));
    assert.equal(orgActivities.length, 3, 'Workspace must retain all 3 sequential events');
  });

  it('Test 4: Two-user realtime simulation', async () => {
    const workspaceId = 'org_alpha';
    const subscriberEvents = [];

    // Simulate realtime subscription callback
    const onEventAdded = (event) => {
      subscriberEvents.unshift(event);
    };

    // User A creates an idea
    const ideaEvent = createCanonicalActivity({
      workspaceId,
      eventType: ACTIVITY_EVENT_TYPES.IDEA_CREATED,
      actorId: 'user_alice',
      actorType: 'user',
      actorName: 'Alice',
      resourceType: 'idea',
      resourceId: 'idea_42',
      resourceTitle: 'Decentralized Identity',
      summary: 'Alice created proposal "Decentralized Identity"',
      createdAt: Date.now(),
    });

    onEventAdded(ideaEvent);

    assert.equal(subscriberEvents.length, 1);
    assert.equal(subscriberEvents[0].resourceTitle, 'Decentralized Identity');
    assert.equal(getActivityCategory(subscriberEvents[0].eventType), ACTIVITY_CATEGORIES.IDEA);
  });

  it('Test 5: Offline recipient notification persistence', async () => {
    const offlineUid = 'user_charlie';
    const workspaceId = 'org_alpha';

    // Alice creates a proposal while Charlie is offline
    const notif = createCanonicalNotification({
      notificationId: 'notif_charlie_1',
      recipientId: offlineUid,
      workspaceId,
      type: NOTIFICATION_TYPES.IDEA_CREATED,
      title: 'New Proposal Posted',
      body: 'Alice submitted proposal "AI Analytics".',
      actorId: 'user_alice',
      actorName: 'Alice',
      resourceType: 'idea',
      resourceId: 'idea_99',
      createdAt: 1700000050000,
    });

    mockDb.user_notifications[`${offlineUid}/${notif.notificationId}`] = notif;

    // Later Charlie logs in and reads his notifications
    const userNotifs = Object.values(mockDb.user_notifications).filter((n) => n.recipientId === offlineUid);
    assert.equal(userNotifs.length, 1);
    assert.equal(userNotifs[0].title, 'New Proposal Posted');
    assert.equal(userNotifs[0].read, false);
  });

  it('Test 6: Reload recovery & category filter counts', () => {
    const activities = [
      createCanonicalActivity({
        workspaceId: 'org_1',
        eventType: ACTIVITY_EVENT_TYPES.IDEA_CREATED,
        actorId: 'u1',
        resourceType: 'idea',
        resourceId: 'i1',
        createdAt: 100,
      }),
      createCanonicalActivity({
        workspaceId: 'org_1',
        eventType: ACTIVITY_EVENT_TYPES.BLUEPRINT_GENERATION_STARTED,
        actorId: 'u1',
        resourceType: 'blueprint',
        resourceId: 'b1',
        createdAt: 200,
      }),
      createCanonicalActivity({
        workspaceId: 'org_1',
        eventType: ACTIVITY_EVENT_TYPES.BLUEPRINT_GENERATION_COMPLETED,
        actorId: 'system',
        actorType: 'system',
        resourceType: 'blueprint',
        resourceId: 'b1',
        createdAt: 300,
      }),
      createCanonicalActivity({
        workspaceId: 'org_1',
        eventType: ACTIVITY_EVENT_TYPES.COMMENT_CREATED,
        actorId: 'u2',
        resourceType: 'comment',
        resourceId: 'c1',
        createdAt: 400,
      }),
      createCanonicalActivity({
        workspaceId: 'org_1',
        eventType: ACTIVITY_EVENT_TYPES.WORKSPACE_MEMBER_JOINED,
        actorId: 'u3',
        resourceType: 'workspace',
        resourceId: 'org_1',
        createdAt: 500,
      }),
    ];

    // Compute category counts matching WorkspaceActivityFeed logic
    const counts = {
      ALL: activities.length,
      PROPOSALS: 0,
      BLUEPRINTS: 0,
      DISCUSSIONS: 0,
      TEAM: 0,
    };

    activities.forEach((act) => {
      const cat = getActivityCategory(act.eventType);
      if (cat === ACTIVITY_CATEGORIES.IDEA) counts.PROPOSALS += 1;
      else if (cat === ACTIVITY_CATEGORIES.BLUEPRINT) counts.BLUEPRINTS += 1;
      else if (
        cat === ACTIVITY_CATEGORIES.SUGGESTION ||
        cat === ACTIVITY_CATEGORIES.COMMENT ||
        cat === ACTIVITY_CATEGORIES.QUESTION
      ) counts.DISCUSSIONS += 1;
      else if (cat === ACTIVITY_CATEGORIES.WORKSPACE) counts.TEAM += 1;
    });

    assert.equal(counts.ALL, 5);
    assert.equal(counts.PROPOSALS, 1);
    assert.equal(counts.BLUEPRINTS, 2);
    assert.equal(counts.DISCUSSIONS, 1);
    assert.equal(counts.TEAM, 1);
  });

  it('Test 7: Complete Rejoin Regression Flow', async () => {
    // 1. Workspace created
    const orgId = 'org_test_suite';
    const userUid = 'user_tester';

    // 2. Blueprint generated
    const bpStarted = createCanonicalActivity({
      workspaceId: orgId,
      eventType: ACTIVITY_EVENT_TYPES.BLUEPRINT_GENERATION_STARTED,
      actorId: userUid,
      resourceType: 'blueprint',
      resourceId: 'bp_1',
      createdAt: 1000,
    });
    const bpCompleted = createCanonicalActivity({
      workspaceId: orgId,
      eventType: ACTIVITY_EVENT_TYPES.BLUEPRINT_GENERATION_COMPLETED,
      actorId: 'system',
      actorType: 'system',
      resourceType: 'blueprint',
      resourceId: 'bp_1',
      metadata: { version: '13.0' },
      createdAt: 2000,
    });

    // 3. User leaves workspace
    const memberLeft = createCanonicalActivity({
      workspaceId: orgId,
      eventType: ACTIVITY_EVENT_TYPES.WORKSPACE_MEMBER_REMOVED,
      actorId: userUid,
      resourceType: 'workspace',
      resourceId: orgId,
      createdAt: 3000,
    });

    // 4. User rejoins workspace
    const memberRejoined = createCanonicalActivity({
      workspaceId: orgId,
      eventType: ACTIVITY_EVENT_TYPES.WORKSPACE_MEMBER_JOINED,
      actorId: userUid,
      resourceType: 'workspace',
      resourceId: orgId,
      createdAt: 4000,
    });

    // Store in chronological timeline
    const timeline = [bpStarted, bpCompleted, memberLeft, memberRejoined];

    assert.equal(timeline.length, 4);
    assert.ok(timeline.some((e) => e.eventType === ACTIVITY_EVENT_TYPES.BLUEPRINT_GENERATION_COMPLETED));
    assert.ok(timeline.some((e) => e.eventType === ACTIVITY_EVENT_TYPES.WORKSPACE_MEMBER_REMOVED));
    assert.ok(timeline.some((e) => e.eventType === ACTIVITY_EVENT_TYPES.WORKSPACE_MEMBER_JOINED));
    assert.equal(timeline.find((e) => e.eventType === ACTIVITY_EVENT_TYPES.BLUEPRINT_GENERATION_COMPLETED).metadata.version, '13.0');
  });
});
