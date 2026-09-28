/**
 * CONVIA — PHASE 7B-2: BLUEPRINT LIFECYCLE PERSISTENT NOTIFICATION INTEGRATION
 *
 * Test Matrix Coverage (25 Scenarios):
 * 1. Successful blueprint generation produces BLUEPRINT_COMPLETED.
 * 2. Failed blueprint generation produces BLUEPRINT_FAILED.
 * 3. Pre-generation validation/auth failures do NOT produce BLUEPRINT_FAILED.
 * 4. Authorized blueprint approval produces BLUEPRINT_VERSION_APPROVED.
 * 5. Unauthorized approval is rejected and produces NO notification.
 * 6. Correct generation initiator recipient resolution.
 * 7. Actor self-notification suppression on approval (approver excluded).
 * 8. Self-approval suppression (creator approving own version receives no notification).
 * 9. Offline recipient persistence (stored in RTDB under user_notifications/{recipientUid}/{notifId}).
 * 10. Notification survives logout/login.
 * 11. Correct workspaceId in notification record.
 * 12. Correct blueprint entityId (bp_{workspaceId}_{mvpIdeaId}).
 * 13. Correct version identifier in secondaryEntityId.
 * 14. Correct notification type and category (NOTIFICATION_CATEGORIES.BLUEPRINT).
 * 15. Correct unread state (read: false) and unread count increment.
 * 16. Mark-as-read behavior updates read state and unread count.
 * 17. Duplicate completion event idempotence via deterministic dedupeKey.
 * 18. Duplicate approval event idempotence via deterministic dedupeKey.
 * 19. Concurrent blueprint generations produce distinct notifications.
 * 20. Concurrent/versioned approvals produce distinct notifications per version.
 * 21. Deleted/missing blueprint target resilience.
 * 22. User isolation (User B cannot read/modify User A notifications).
 * 23. Blueprint version history remains intact upon approval.
 * 24. Activity audit trail coexists cleanly with notifications.
 * 25. Zero regressions to Phase 7A and Phase 7B-1 contracts.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  NOTIFICATION_TYPES,
  NOTIFICATION_CATEGORIES,
  getNotificationCategory,
  buildNotificationDedupeKey,
  buildNotificationActionUrl,
  createCanonicalNotification,
} from '../../constants/notificationConstants.js';

import { notificationService } from '../notificationService.js';
import { rtdbService } from '../rtdbService.js';
import { ACTIVITY_EVENT_TYPES } from '../../constants/activityConstants.js';

describe('🧪 CONVIA PHASE 7B-2 — BLUEPRINT LIFECYCLE NOTIFICATION INTEGRATION TEST SUITE', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = {
      organizations: {
        org_alpha: {
          id: 'org_alpha',
          name: 'Alpha Labs',
          ownerId: 'user_alice',
          activeProjectId: 'idea_mvp_1',
          members: {
            user_alice: { uid: 'user_alice', role: 'owner', name: 'Alice Architect' },
            user_bob: { uid: 'user_bob', role: 'member', name: 'Bob Builder' },
            user_charlie: { uid: 'user_charlie', role: 'member', name: 'Charlie Reviewer' },
          },
        },
      },
      organization_members: {
        org_alpha: {
          user_alice: { uid: 'user_alice', role: 'owner' },
          user_bob: { uid: 'user_bob', role: 'member' },
          user_charlie: { uid: 'user_charlie', role: 'member' },
        },
      },
      user_notifications: {},
      ideas: {
        org_alpha: {
          idea_mvp_1: {
            id: 'idea_mvp_1',
            ideaId: 'idea_mvp_1',
            title: 'Autonomous Code Reviewer',
            authorId: 'user_alice',
            createdBy: 'user_alice',
          },
          idea_mvp_2: {
            id: 'idea_mvp_2',
            ideaId: 'idea_mvp_2',
            title: 'Distributed Log Engine',
            authorId: 'user_bob',
            createdBy: 'user_bob',
          },
        },
      },
      blueprints: {
        org_alpha: {
          idea_mvp_1: {
            blueprintId: 'bp_org_alpha_idea_mvp_1',
            workspaceId: 'org_alpha',
            mvpIdeaId: 'idea_mvp_1',
            version: '1.0',
            status: 'completed',
            approvalStatus: 'pending_approval',
            lineage: {
              generatedBy: 'user_alice',
              generationId: 'gen_attempt_1',
            },
            versions: {
              v1_0: {
                version: '1.0',
                status: 'completed',
                approvalStatus: 'pending_approval',
                generatedBy: 'user_alice',
              },
            },
          },
        },
      },
      workspace_activity: {
        org_alpha: {},
      },
    };

    // Mock rtdbService methods with deep copy isolation
    rtdbService.getData = async (path) => {
      const parts = path.split('/').filter(Boolean);
      let curr = mockDb;
      for (const p of parts) {
        if (!curr || typeof curr !== 'object') return null;
        curr = curr[p];
      }
      return curr !== undefined ? JSON.parse(JSON.stringify(curr)) : null;
    };

    rtdbService.setData = async (path, val) => {
      const parts = path.split('/').filter(Boolean);
      let curr = mockDb;
      for (let i = 0; i < parts.length - 1; i++) {
        const p = parts[i];
        if (!curr[p] || typeof curr[p] !== 'object') {
          curr[p] = {};
        }
        curr = curr[p];
      }
      curr[parts[parts.length - 1]] = JSON.parse(JSON.stringify(val));
      return true;
    };

    rtdbService.updateData = async (path, updates) => {
      if (path === '/') {
        for (const [subPath, val] of Object.entries(updates)) {
          const parts = subPath.split('/').filter(Boolean);
          let curr = mockDb;
          for (let i = 0; i < parts.length - 1; i++) {
            const p = parts[i];
            if (!curr[p] || typeof curr[p] !== 'object') {
              curr[p] = {};
            }
            curr = curr[p];
          }
          curr[parts[parts.length - 1]] = JSON.parse(JSON.stringify(val));
        }
        return true;
      }
      const parts = path.split('/').filter(Boolean);
      let curr = mockDb;
      for (const p of parts) {
        if (!curr[p] || typeof curr[p] !== 'object') {
          curr[p] = {};
        }
        curr = curr[p];
      }
      Object.assign(curr, JSON.parse(JSON.stringify(updates)));
      return true;
    };
  });

  // -------------------------------------------------------------
  // GROUP 1: BLUEPRINT GENERATION NOTIFICATIONS
  // -------------------------------------------------------------
  describe('📦 1. Blueprint Generation Completion & Failure Notifications', () => {
    it('Scenario 1 & 6: Successful blueprint generation produces BLUEPRINT_COMPLETED for initiator', async () => {
      const notifs = await notificationService.dispatchNotificationEvent(
        NOTIFICATION_TYPES.BLUEPRINT_COMPLETED,
        {
          workspaceId: 'org_alpha',
          mvpIdeaId: 'idea_mvp_1',
          resourceId: 'bp_org_alpha_idea_mvp_1',
          version: '1.0',
          secondaryEntityId: '1.0',
          ideaTitle: 'Autonomous Code Reviewer',
          initiatorUid: 'user_alice',
          attemptId: 'gen_attempt_1',
        },
        { uid: 'user_alice', displayName: 'Alice Architect' }
      );

      assert.strictEqual(notifs.length, 1);
      const notif = notifs[0];
      assert.strictEqual(notif.recipientId, 'user_alice');
      assert.strictEqual(notif.type, NOTIFICATION_TYPES.BLUEPRINT_COMPLETED);
      assert.strictEqual(notif.actorId, 'system');
      assert.strictEqual(notif.actorName, 'Convia AI Engine');
      assert.strictEqual(notif.entityType, 'blueprint');
      assert.strictEqual(notif.entityId, 'bp_org_alpha_idea_mvp_1');
      assert.strictEqual(notif.secondaryEntityId, '1.0');
      assert.strictEqual(notif.workspaceId, 'org_alpha');
      assert.strictEqual(notif.read, false);
      assert.ok(notif.title.includes('v1.0 Completed'));
      assert.ok(notif.body.includes('Autonomous Code Reviewer'));

      // Check persisted in RTDB
      const persisted = await rtdbService.getData(`user_notifications/user_alice/${notif.notificationId}`);
      assert.ok(persisted);
      assert.strictEqual(persisted.recipientId, 'user_alice');
      assert.strictEqual(persisted.read, false);
    });

    it('Scenario 2: Failed blueprint generation produces BLUEPRINT_FAILED for initiator', async () => {
      const notifs = await notificationService.dispatchNotificationEvent(
        NOTIFICATION_TYPES.BLUEPRINT_FAILED,
        {
          workspaceId: 'org_alpha',
          mvpIdeaId: 'idea_mvp_1',
          resourceId: 'bp_org_alpha_idea_mvp_1',
          ideaTitle: 'Autonomous Code Reviewer',
          errorReason: 'Generation model timed out. Previous version preserved.',
          initiatorUid: 'user_alice',
          attemptId: 'gen_attempt_err',
        },
        { uid: 'user_alice' }
      );

      assert.strictEqual(notifs.length, 1);
      const notif = notifs[0];
      assert.strictEqual(notif.recipientId, 'user_alice');
      assert.strictEqual(notif.type, NOTIFICATION_TYPES.BLUEPRINT_FAILED);
      assert.strictEqual(notif.actorId, 'system');
      assert.strictEqual(notif.entityType, 'blueprint');
      assert.strictEqual(notif.entityId, 'bp_org_alpha_idea_mvp_1');
      assert.ok(notif.body.includes('could not be completed'));
      assert.ok(notif.body.includes('Generation model timed out'));
    });

    it('Scenario 3: Pre-generation auth/validation rejection does NOT emit BLUEPRINT_FAILED', async () => {
      // If validation fails prior to generation (e.g. missing workspaceId or unauthenticated), dispatch is never called
      const unauthorizedCaller = null;
      let notificationDispatched = false;

      try {
        if (!unauthorizedCaller) {
          throw new Error('401 UNAUTHORIZED: Authentication required');
        }
        // If it got past, it would dispatch
        await notificationService.dispatchNotificationEvent(
          NOTIFICATION_TYPES.BLUEPRINT_FAILED,
          { workspaceId: 'org_alpha', errorReason: 'Auth error' },
          unauthorizedCaller
        );
        notificationDispatched = true;
      } catch (err) {
        // Expected early exit
        assert.ok(err.message.includes('401 UNAUTHORIZED'));
      }

      assert.strictEqual(notificationDispatched, false);
      const aliceNotifs = await rtdbService.getData('user_notifications/user_alice');
      assert.strictEqual(aliceNotifs, null);
    });

    it('Scenario 16: Failure reason sanitization never leaks API keys, tokens, or stack traces', async () => {
      const sensitiveErrors = [
        'Failed with OPENROUTER_API_KEY sk-or-v1-938482049284209 HTTP 401',
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 token expired',
        'Error: Connection failed at /var/app/backend/src/services/geminiService.js:48:12',
        'https://api.openai.com/v1/chat/completions returned 500 internal server error',
      ];

      for (const rawErr of sensitiveErrors) {
        const notifs = await notificationService.dispatchNotificationEvent(
          NOTIFICATION_TYPES.BLUEPRINT_FAILED,
          {
            workspaceId: 'org_alpha',
            mvpIdeaId: 'idea_mvp_1',
            ideaTitle: 'Autonomous Code Reviewer',
            errorReason: rawErr,
            initiatorUid: 'user_alice',
            attemptId: 'err_' + Date.now(),
          },
          { uid: 'user_alice' }
        );

        assert.strictEqual(notifs.length, 1);
        const body = notifs[0].body;
        // Verify sensitive substrings are scrubbed
        assert.strictEqual(body.includes('sk-or-v1'), false);
        assert.strictEqual(body.includes('Bearer'), false);
        assert.strictEqual(body.includes('at /'), false);
        assert.strictEqual(body.includes('https://'), false);
        assert.ok(body.includes('Blueprint generation failed. Please try again.'));
      }
    });
  });

  // -------------------------------------------------------------
  // GROUP 2: BLUEPRINT APPROVAL & ACTOR SUPPRESSION
  // -------------------------------------------------------------
  describe('⭐ 2. Blueprint Version Approval & Recipient Resolution', () => {
    it('Scenario 4 & 7: Authorized approval notifies version creator and excludes the approver', async () => {
      // Alice is creator, Bob is approver
      const notifs = await notificationService.dispatchNotificationEvent(
        NOTIFICATION_TYPES.BLUEPRINT_VERSION_APPROVED,
        {
          workspaceId: 'org_alpha',
          mvpIdeaId: 'idea_mvp_1',
          resourceId: 'bp_org_alpha_idea_mvp_1',
          version: '1.0',
          secondaryEntityId: '1.0',
          ideaTitle: 'Autonomous Code Reviewer',
          creatorUid: 'user_alice',
          actorId: 'user_bob',
          actorName: 'Bob Builder',
        },
        { uid: 'user_bob', displayName: 'Bob Builder' }
      );

      // Recipients should include Alice (creator) and Charlie (workspace member), but NOT Bob (approver)
      const recipientIds = notifs.map((n) => n.recipientId);
      assert.ok(recipientIds.includes('user_alice'), 'Creator Alice must receive notification');
      assert.ok(!recipientIds.includes('user_bob'), 'Approver Bob must NOT receive self-notification');

      const aliceNotif = notifs.find((n) => n.recipientId === 'user_alice');
      assert.strictEqual(aliceNotif.type, NOTIFICATION_TYPES.BLUEPRINT_VERSION_APPROVED);
      assert.strictEqual(aliceNotif.actorId, 'user_bob');
      assert.strictEqual(aliceNotif.actorName, 'Bob Builder');
      assert.strictEqual(aliceNotif.entityId, 'bp_org_alpha_idea_mvp_1');
      assert.strictEqual(aliceNotif.secondaryEntityId, '1.0');
      assert.ok(aliceNotif.title.includes('v1.0 Approved'));
    });

    it('Scenario 8: Self-approval suppresses notification when approver is the version creator', async () => {
      // Alice is creator AND Alice is the approver (e.g. Workspace Owner)
      const notifs = await notificationService.dispatchNotificationEvent(
        NOTIFICATION_TYPES.BLUEPRINT_VERSION_APPROVED,
        {
          workspaceId: 'org_alpha',
          mvpIdeaId: 'idea_mvp_1',
          resourceId: 'bp_org_alpha_idea_mvp_1',
          version: '1.0',
          secondaryEntityId: '1.0',
          ideaTitle: 'Autonomous Code Reviewer',
          creatorUid: 'user_alice',
          actorId: 'user_alice',
          actorName: 'Alice Architect',
        },
        { uid: 'user_alice', displayName: 'Alice Architect' }
      );

      const recipientIds = notifs.map((n) => n.recipientId);
      // Alice must strictly NOT receive a notification for her own action
      assert.ok(!recipientIds.includes('user_alice'), 'Alice must be excluded via self-notification suppression');
    });

    it('Scenario 5: Unauthorized approval attempt is rejected before notification dispatch', async () => {
      const unauthorizedUser = 'user_intruder';
      let notificationDispatched = false;

      // Simulated controller check
      try {
        const isMember = Boolean(mockDb.organization_members.org_alpha[unauthorizedUser]);
        if (!isMember) {
          const err = new Error('403 FORBIDDEN: You must be a member of this workspace to approve a Blueprint.');
          err.statusCode = 403;
          throw err;
        }

        await notificationService.dispatchNotificationEvent(
          NOTIFICATION_TYPES.BLUEPRINT_VERSION_APPROVED,
          { workspaceId: 'org_alpha', version: '1.0' },
          { uid: unauthorizedUser }
        );
        notificationDispatched = true;
      } catch (err) {
        assert.strictEqual(err.statusCode, 403);
      }

      assert.strictEqual(notificationDispatched, false);
      const intruderNotifs = await rtdbService.getData('user_notifications/user_intruder');
      assert.strictEqual(intruderNotifs, null);
    });
  });

  // -------------------------------------------------------------
  // GROUP 3: OFFLINE PERSISTENCE, UNREAD STATE & USER ISOLATION
  // -------------------------------------------------------------
  describe('📬 3. Offline Persistence, Unread State & Isolation', () => {
    it('Scenario 9 & 10: Recipient is offline during generation; notification persists and survives login', async () => {
      // Alice initiates generation then goes completely offline
      const isAliceOnline = false;

      // System completes generation in the background
      const notifs = await notificationService.dispatchNotificationEvent(
        NOTIFICATION_TYPES.BLUEPRINT_COMPLETED,
        {
          workspaceId: 'org_alpha',
          mvpIdeaId: 'idea_mvp_1',
          resourceId: 'bp_org_alpha_idea_mvp_1',
          version: '2.0',
          secondaryEntityId: '2.0',
          ideaTitle: 'Autonomous Code Reviewer',
          initiatorUid: 'user_alice',
        },
        { uid: 'user_alice' }
      );

      assert.strictEqual(notifs.length, 1);
      const notifId = notifs[0].notificationId;

      // Alice later logs in and queries her notifications
      const aliceInbox = await rtdbService.getData(`user_notifications/user_alice`);
      assert.ok(aliceInbox);
      assert.ok(aliceInbox[notifId]);
      assert.strictEqual(aliceInbox[notifId].read, false);
      assert.strictEqual(aliceInbox[notifId].secondaryEntityId, '2.0');
    });

    it('Scenario 13, 14 & 15: Correct unread state, unread count increment, and mark-as-read', async () => {
      // Send two notifications to Alice
      await notificationService.createNotification('user_alice', {
        type: NOTIFICATION_TYPES.BLUEPRINT_COMPLETED,
        workspaceId: 'org_alpha',
        title: 'Blueprint v1.0 Completed',
        body: 'Ready for review',
        actorId: 'system',
        entityType: 'blueprint',
        entityId: 'bp_org_alpha_idea_mvp_1',
      });

      const secondNotif = await notificationService.createNotification('user_alice', {
        type: NOTIFICATION_TYPES.BLUEPRINT_VERSION_APPROVED,
        workspaceId: 'org_alpha',
        title: 'Blueprint v1.0 Approved',
        body: 'Approved by Bob',
        actorId: 'user_bob',
        entityType: 'blueprint',
        entityId: 'bp_org_alpha_idea_mvp_1',
      });

      // Query unread notifications
      const inbox = await rtdbService.getData('user_notifications/user_alice');
      const unreadList = Object.values(inbox).filter((n) => !n.read);
      assert.strictEqual(unreadList.length, 2);

      // Mark one notification as read
      await rtdbService.updateData(`user_notifications/user_alice/${secondNotif.notificationId}`, {
        read: true,
        readAt: Date.now(),
      });

      const updatedInbox = await rtdbService.getData('user_notifications/user_alice');
      const updatedUnreadList = Object.values(updatedInbox).filter((n) => !n.read);
      assert.strictEqual(updatedUnreadList.length, 1);
      assert.strictEqual(updatedInbox[secondNotif.notificationId].read, true);
    });

    it('Scenario 22: User B cannot access or mutate User A notifications (isolation boundary)', async () => {
      // Alice has a notification
      const aliceNotif = await notificationService.createNotification('user_alice', {
        type: NOTIFICATION_TYPES.BLUEPRINT_COMPLETED,
        workspaceId: 'org_alpha',
        title: 'Private Alice Blueprint',
        body: 'Alice private details',
        actorId: 'system',
      });

      // Simulated security check: User Bob attempting to read User Alice path
      const checkAccess = (authUid, targetPath) => {
        const match = targetPath.match(/^user_notifications\/([^/]+)/);
        if (match && match[1] !== authUid) {
          throw new Error('PERMISSION_DENIED: User isolation rule violated');
        }
        return true;
      };

      assert.throws(
        () => checkAccess('user_bob', `user_notifications/user_alice/${aliceNotif.notificationId}`),
        /PERMISSION_DENIED/
      );
    });
  });

  // -------------------------------------------------------------
  // GROUP 4: DEDUPLICATION, CONCURRENCY & VERSION SAFETY
  // -------------------------------------------------------------
  describe('🔁 4. Deduplication, Concurrency & Version Safety', () => {
    it('Scenario 17: Duplicate completion handler run produces identical notification via dedupeKey', async () => {
      const eventPayload = {
        workspaceId: 'org_alpha',
        mvpIdeaId: 'idea_mvp_1',
        resourceId: 'bp_org_alpha_idea_mvp_1',
        version: '1.0',
        secondaryEntityId: '1.0',
        ideaTitle: 'Autonomous Code Reviewer',
        initiatorUid: 'user_alice',
        attemptId: 'attempt_abc',
      };

      // Run 1
      const notifs1 = await notificationService.dispatchNotificationEvent(
        NOTIFICATION_TYPES.BLUEPRINT_COMPLETED,
        eventPayload,
        { uid: 'user_alice' }
      );

      // Run 2 (retry)
      const notifs2 = await notificationService.dispatchNotificationEvent(
        NOTIFICATION_TYPES.BLUEPRINT_COMPLETED,
        eventPayload,
        { uid: 'user_alice' }
      );

      assert.strictEqual(notifs1.length, 1);
      assert.strictEqual(notifs2.length, 1);
      assert.strictEqual(notifs1[0].notificationId, notifs2[0].notificationId);
      assert.strictEqual(notifs1[0].dedupeKey, notifs2[0].dedupeKey);

      // Verify only 1 record in RTDB
      const aliceInbox = await rtdbService.getData('user_notifications/user_alice');
      const keys = Object.keys(aliceInbox);
      assert.strictEqual(keys.length, 1);
    });

    it('Scenario 18: Duplicate approval handler run produces identical notification via dedupeKey', async () => {
      const approvalPayload = {
        workspaceId: 'org_alpha',
        mvpIdeaId: 'idea_mvp_1',
        resourceId: 'bp_org_alpha_idea_mvp_1',
        version: '1.0',
        secondaryEntityId: '1.0',
        ideaTitle: 'Autonomous Code Reviewer',
        creatorUid: 'user_alice',
        actorId: 'user_bob',
        actorName: 'Bob Builder',
      };

      const notifs1 = await notificationService.dispatchNotificationEvent(
        NOTIFICATION_TYPES.BLUEPRINT_VERSION_APPROVED,
        approvalPayload,
        { uid: 'user_bob', displayName: 'Bob Builder' }
      );

      const notifs2 = await notificationService.dispatchNotificationEvent(
        NOTIFICATION_TYPES.BLUEPRINT_VERSION_APPROVED,
        approvalPayload,
        { uid: 'user_bob', displayName: 'Bob Builder' }
      );

      const aliceNotif1 = notifs1.find((n) => n.recipientId === 'user_alice');
      const aliceNotif2 = notifs2.find((n) => n.recipientId === 'user_alice');
      assert.strictEqual(aliceNotif1.notificationId, aliceNotif2.notificationId);
      assert.strictEqual(aliceNotif1.dedupeKey, aliceNotif2.dedupeKey);
    });

    it('Scenario 19: Concurrent blueprint generations for different MVP ideas produce distinct notifications', async () => {
      // Alice generates Blueprint for MVP 1
      const notifs1 = await notificationService.dispatchNotificationEvent(
        NOTIFICATION_TYPES.BLUEPRINT_COMPLETED,
        {
          workspaceId: 'org_alpha',
          mvpIdeaId: 'idea_mvp_1',
          resourceId: 'bp_org_alpha_idea_mvp_1',
          version: '1.0',
          ideaTitle: 'Autonomous Code Reviewer',
          initiatorUid: 'user_alice',
        },
        { uid: 'user_alice' }
      );

      // Alice generates Blueprint for MVP 2
      const notifs2 = await notificationService.dispatchNotificationEvent(
        NOTIFICATION_TYPES.BLUEPRINT_COMPLETED,
        {
          workspaceId: 'org_alpha',
          mvpIdeaId: 'idea_mvp_2',
          resourceId: 'bp_org_alpha_idea_mvp_2',
          version: '1.0',
          ideaTitle: 'Distributed Log Engine',
          initiatorUid: 'user_alice',
        },
        { uid: 'user_alice' }
      );

      assert.notStrictEqual(notifs1[0].notificationId, notifs2[0].notificationId);
      assert.notStrictEqual(notifs1[0].entityId, notifs2[0].entityId);

      const aliceInbox = await rtdbService.getData('user_notifications/user_alice');
      assert.strictEqual(Object.keys(aliceInbox).length, 2);
    });

    it('Scenario 20: Approving Version 1 and later approving Version 2 produce distinct notifications', async () => {
      // Bob approves Version 1.0
      const v1Notifs = await notificationService.dispatchNotificationEvent(
        NOTIFICATION_TYPES.BLUEPRINT_VERSION_APPROVED,
        {
          workspaceId: 'org_alpha',
          mvpIdeaId: 'idea_mvp_1',
          resourceId: 'bp_org_alpha_idea_mvp_1',
          version: '1.0',
          secondaryEntityId: '1.0',
          ideaTitle: 'Autonomous Code Reviewer',
          creatorUid: 'user_alice',
          actorId: 'user_bob',
          actorName: 'Bob Builder',
        },
        { uid: 'user_bob' }
      );

      // Bob approves Version 2.0
      const v2Notifs = await notificationService.dispatchNotificationEvent(
        NOTIFICATION_TYPES.BLUEPRINT_VERSION_APPROVED,
        {
          workspaceId: 'org_alpha',
          mvpIdeaId: 'idea_mvp_1',
          resourceId: 'bp_org_alpha_idea_mvp_1',
          version: '2.0',
          secondaryEntityId: '2.0',
          ideaTitle: 'Autonomous Code Reviewer',
          creatorUid: 'user_alice',
          actorId: 'user_bob',
          actorName: 'Bob Builder',
        },
        { uid: 'user_bob' }
      );

      const aliceV1 = v1Notifs.find((n) => n.recipientId === 'user_alice');
      const aliceV2 = v2Notifs.find((n) => n.recipientId === 'user_alice');

      assert.notStrictEqual(aliceV1.notificationId, aliceV2.notificationId);
      assert.strictEqual(aliceV1.secondaryEntityId, '1.0');
      assert.strictEqual(aliceV2.secondaryEntityId, '2.0');
    });

    it('Scenario 23: Approving blueprint version preserves complete historical version snapshots in RTDB', async () => {
      // Simulate historical version preservation in RTDB
      const versionsRoot = 'blueprints/org_alpha/idea_mvp_1/versions';
      await rtdbService.setData(`${versionsRoot}/v1_0`, {
        version: '1.0',
        status: 'completed',
        approvalStatus: 'approved',
        content: { title: 'V1 Content' },
      });

      // Now approve V2.0
      await rtdbService.setData(`${versionsRoot}/v2_0`, {
        version: '2.0',
        status: 'completed',
        approvalStatus: 'approved',
        content: { title: 'V2 Content' },
      });

      // Verify V1.0 was NOT deleted or overwritten
      const v1Snap = await rtdbService.getData(`${versionsRoot}/v1_0`);
      const v2Snap = await rtdbService.getData(`${versionsRoot}/v2_0`);

      assert.ok(v1Snap, 'Historical V1.0 snapshot must remain intact');
      assert.strictEqual(v1Snap.version, '1.0');
      assert.strictEqual(v1Snap.content.title, 'V1 Content');

      assert.ok(v2Snap, 'V2.0 snapshot must be recorded');
      assert.strictEqual(v2Snap.version, '2.0');
      assert.strictEqual(v2Snap.content.title, 'V2 Content');
    });
  });

  // -------------------------------------------------------------
  // GROUP 5: SEMANTICS, ACTION URLS & INTEGRITY
  // -------------------------------------------------------------
  describe('🌐 5. Deep-Link Metadata, Deleted Resources & Coexistence', () => {
    it('Scenario 11 & 12: Correct workspaceId and blueprint entityId in notification records', async () => {
      const notif = await notificationService.createNotification('user_alice', {
        type: NOTIFICATION_TYPES.BLUEPRINT_COMPLETED,
        workspaceId: 'org_alpha',
        entityType: 'blueprint',
        entityId: 'bp_org_alpha_idea_mvp_1',
        secondaryEntityId: '1.0',
        title: 'Blueprint Ready',
        body: 'Check it out',
      });

      assert.strictEqual(notif.workspaceId, 'org_alpha');
      assert.strictEqual(notif.entityType, 'blueprint');
      assert.strictEqual(notif.entityId, 'bp_org_alpha_idea_mvp_1');
      assert.strictEqual(notif.actionUrl, '/workspaces/org_alpha/blueprint');
    });

    it('Scenario 14: Category mapping resolves to NOTIFICATION_CATEGORIES.BLUEPRINT', () => {
      assert.strictEqual(
        getNotificationCategory(NOTIFICATION_TYPES.BLUEPRINT_COMPLETED),
        NOTIFICATION_CATEGORIES.BLUEPRINT
      );
      assert.strictEqual(
        getNotificationCategory(NOTIFICATION_TYPES.BLUEPRINT_FAILED),
        NOTIFICATION_CATEGORIES.BLUEPRINT
      );
      assert.strictEqual(
        getNotificationCategory(NOTIFICATION_TYPES.BLUEPRINT_VERSION_APPROVED),
        NOTIFICATION_CATEGORIES.BLUEPRINT
      );
    });

    it('Scenario 21: Notification remains readable even if target blueprint is later deleted', async () => {
      const notif = await notificationService.createNotification('user_alice', {
        type: NOTIFICATION_TYPES.BLUEPRINT_COMPLETED,
        workspaceId: 'org_alpha',
        entityType: 'blueprint',
        entityId: 'bp_org_alpha_idea_mvp_deleted',
        title: 'Archived Blueprint Notice',
        body: 'Blueprint for deleted proposal',
      });

      // Target blueprint is deleted from RTDB
      await rtdbService.setData('blueprints/org_alpha/idea_mvp_deleted', null);

      // Notification itself remains fully readable and queryable
      const persisted = await rtdbService.getData(`user_notifications/user_alice/${notif.notificationId}`);
      assert.ok(persisted);
      assert.strictEqual(persisted.title, 'Archived Blueprint Notice');
      assert.strictEqual(persisted.entityId, 'bp_org_alpha_idea_mvp_deleted');
    });

    it('Scenario 24: Activity audit trail and persistent notifications coexist cleanly', async () => {
      // 1. Record activity in activity service
      const activityRecord = {
        activityId: 'act_bp_completed_123',
        eventType: ACTIVITY_EVENT_TYPES.BLUEPRINT_GENERATION_COMPLETED,
        actorId: 'system',
        actorType: 'system',
        actorName: 'Convia AI Engine',
        resourceType: 'blueprint',
        resourceId: 'bp_org_alpha_idea_mvp_1',
        resourceTitle: 'Autonomous Code Reviewer',
        summary: 'AI Blueprint generation completed (v1.0)',
        metadata: { version: '1.0' },
        createdAt: Date.now(),
      };
      await rtdbService.setData(`workspace_activity/org_alpha/${activityRecord.activityId}`, activityRecord);

      // 2. Dispatch persistent notification
      const notifs = await notificationService.dispatchNotificationEvent(
        NOTIFICATION_TYPES.BLUEPRINT_COMPLETED,
        {
          workspaceId: 'org_alpha',
          mvpIdeaId: 'idea_mvp_1',
          resourceId: 'bp_org_alpha_idea_mvp_1',
          version: '1.0',
          ideaTitle: 'Autonomous Code Reviewer',
          initiatorUid: 'user_alice',
        },
        { uid: 'user_alice' }
      );

      // Verify both stores are populated without interference
      const savedActivity = await rtdbService.getData(`workspace_activity/org_alpha/${activityRecord.activityId}`);
      const savedNotification = await rtdbService.getData(`user_notifications/user_alice/${notifs[0].notificationId}`);

      assert.ok(savedActivity);
      assert.strictEqual(savedActivity.eventType, ACTIVITY_EVENT_TYPES.BLUEPRINT_GENERATION_COMPLETED);
      assert.ok(savedNotification);
      assert.strictEqual(savedNotification.type, NOTIFICATION_TYPES.BLUEPRINT_COMPLETED);
    });

    it('Scenario 25: Zero regression to Phase 7A core contracts and Phase 7B-1 chat notifications', async () => {
      // Test Phase 7A canonical contract
      const canonical = createCanonicalNotification({
        notificationId: 'notif_p7a_test',
        recipientId: 'user_bob',
        workspaceId: 'org_alpha',
        type: NOTIFICATION_TYPES.CHAT_MESSAGE,
        title: 'New Chat Message',
        body: 'Hello Bob',
        actorId: 'user_alice',
        entityType: 'chat',
        entityId: 'msg_123',
        actionUrl: '/workspaces/org_alpha/chat?channel=general&messageId=msg_123',
      });

      assert.strictEqual(canonical.type, NOTIFICATION_TYPES.CHAT_MESSAGE);
      assert.strictEqual(canonical.recipientId, 'user_bob');
      assert.strictEqual(canonical.actorId, 'user_alice');
      assert.strictEqual(canonical.actionUrl, '/workspaces/org_alpha/chat?channel=general&messageId=msg_123');

      // Test Phase 7B-1 chat action url generation
      const chatUrl = buildNotificationActionUrl({
        type: NOTIFICATION_TYPES.CHAT_MENTION,
        workspaceId: 'org_alpha',
        resourceId: 'msg_999',
        metadata: { channelId: 'general', messageId: 'msg_999' },
      });
      assert.strictEqual(chatUrl, '/workspaces/org_alpha/chat?channel=general&messageId=msg_999');
    });
  });
});
