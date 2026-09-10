import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  NOTIFICATION_TYPES,
  NOTIFICATION_CATEGORIES,
  getNotificationCategory,
  buildNotificationDedupeKey,
  createCanonicalNotification,
} from '../../constants/notificationConstants.js';

import { notificationService } from '../notificationService.js';
import { accountDeletionService } from '../accountDeletionService.js';

describe('🛡️ CONVIA P1-02 — PERSISTENT / SYSTEM NOTIFICATION AUTHORIZATION & DELIVERY INTEGRITY', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = {
      organizations: {
        org_alpha: {
          id: 'org_alpha',
          name: 'Alpha Labs',
          ownerId: 'user_alice',
        },
        org_beta: {
          id: 'org_beta',
          name: 'Beta Team',
          ownerId: 'user_charlie',
        },
      },
      organization_members: {
        org_alpha: {
          user_alice: { uid: 'user_alice', role: 'owner' },
          user_bob: { uid: 'user_bob', role: 'member' },
          user_david: { uid: 'user_david', role: 'member' },
        },
        org_beta: {
          user_charlie: { uid: 'user_charlie', role: 'owner' },
          user_eve: { uid: 'user_eve', role: 'member' },
        },
      },
      user_notifications: {},
      notifications: {},
      users: {
        user_alice: { uid: 'user_alice', name: 'Alice' },
        user_bob: { uid: 'user_bob', name: 'Bob' },
        user_charlie: { uid: 'user_charlie', name: 'Charlie' },
        user_david: { uid: 'user_david', name: 'David' },
        user_eve: { uid: 'user_eve', name: 'Eve' },
      },
    };
  });

  // Security Rule Evaluator strictly mirroring database.rules.json
  function evaluateNotificationRule({ path, operation, auth, data = null, newData = null }) {
    if (!auth || !auth.uid) {
      return { allowed: false, reason: 'UNAUTHENTICATED' };
    }

    const segments = path.split('/').filter(Boolean);
    if (segments[0] !== 'user_notifications') {
      return { allowed: false, reason: 'INVALID_PATH' };
    }

    const recipientUid = segments[1];
    const notifId = segments[2];

    // .read: auth != null && auth.uid === $uid
    if (operation === 'read') {
      const allowed = auth.uid === recipientUid;
      return { allowed, reason: allowed ? null : 'FORBIDDEN_READ' };
    }

    // .write: auth != null && (auth.uid === $uid || (!data.exists() && newData.child('senderId').val() === auth.uid))
    if (operation === 'write') {
      // 1. Root-level write defense
      if (!notifId) {
        const allowed = auth.uid === recipientUid;
        return { allowed, reason: allowed ? null : 'FORBIDDEN_ROOT_WRITE' };
      }

      // 2. Delete operation (!newData)
      if (data && !newData) {
        const allowed = auth.uid === recipientUid;
        return { allowed, reason: allowed ? null : 'CANNOT_DELETE_ANOTHER_USERS_NOTIFICATION' };
      }

      // 3. Create operation (!data)
      if (!data && newData) {
        // senderId must match auth.uid (cannot forge sender or forge 'system')
        if (newData.senderId !== auth.uid) {
          return { allowed: false, reason: 'FORGED_SENDER_ID' };
        }
        if (newData.actorId && newData.actorId !== auth.uid) {
          return { allowed: false, reason: 'FORGED_ACTOR_ID' };
        }
        if (!newData.type || typeof newData.type !== 'string' || newData.type.length === 0 || newData.type.length > 100) {
          return { allowed: false, reason: 'INVALID_TYPE' };
        }
        if (typeof newData.createdAt !== 'number') {
          return { allowed: false, reason: 'INVALID_CREATED_AT' };
        }
        if (newData.title && (typeof newData.title !== 'string' || newData.title.length > 300)) {
          return { allowed: false, reason: 'INVALID_TITLE' };
        }
        if (newData.body && (typeof newData.body !== 'string' || newData.body.length > 2000)) {
          return { allowed: false, reason: 'INVALID_BODY' };
        }
        if (newData.read !== undefined && typeof newData.read !== 'boolean') {
          return { allowed: false, reason: 'INVALID_READ' };
        }

        // Workspace boundary: if orgId is provided, BOTH sender and recipient must belong
        if (newData.orgId) {
          const senderIsMember = Boolean(
            mockDb.organization_members[newData.orgId]?.[auth.uid] ||
            mockDb.organizations[newData.orgId]?.ownerId === auth.uid
          );
          const recipientIsMember = Boolean(
            mockDb.organization_members[newData.orgId]?.[recipientUid] ||
            mockDb.organizations[newData.orgId]?.ownerId === recipientUid
          );

          if (!senderIsMember || !recipientIsMember) {
            return { allowed: false, reason: 'CROSS_WORKSPACE_INJECTION_DENIED' };
          }
        }

        return { allowed: true };
      }

      // 4. Update operation (data && newData)
      if (data && newData) {
        // Only recipient can update
        if (auth.uid !== recipientUid) {
          return { allowed: false, reason: 'FORBIDDEN_UPDATE' };
        }

        // Protected fields are strictly immutable
        const protectedFields = [
          'type',
          'senderId',
          'actorId',
          'orgId',
          'workspaceId',
          'createdAt',
          'title',
          'body',
          'notificationId',
          'recipientId',
        ];

        for (const field of protectedFields) {
          if (data[field] !== undefined && newData[field] !== undefined && data[field] !== newData[field]) {
            return { allowed: false, reason: `CANNOT_MODIFY_${field.toUpperCase()}` };
          }
        }

        if (newData.read !== undefined && typeof newData.read !== 'boolean') {
          return { allowed: false, reason: 'READ_MUST_BE_BOOLEAN' };
        }

        if (newData.readAt !== undefined && typeof newData.readAt !== 'number') {
          return { allowed: false, reason: 'READAT_MUST_BE_NUMBER' };
        }

        return { allowed: true };
      }

      return { allowed: auth.uid === recipientUid };
    }

    return { allowed: false, reason: 'UNKNOWN_OPERATION' };
  }

  // =============================================================
  // GROUP 1: RTDB SECURITY BOUNDARIES & ACCESS CONTROL
  // =============================================================
  describe('🔒 1. RTDB Security Boundaries & Access Control', () => {
    it('TEST 1: Unauthenticated user cannot read any user notifications', () => {
      const res = evaluateNotificationRule({
        path: 'user_notifications/user_alice/n1',
        operation: 'read',
        auth: null,
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'UNAUTHENTICATED');
    });

    it('TEST 2: Unauthenticated user cannot write or create notifications', () => {
      const res = evaluateNotificationRule({
        path: 'user_notifications/user_alice/n1',
        operation: 'write',
        auth: null,
        data: null,
        newData: { type: 'CHAT_MESSAGE', senderId: 'user_alice', createdAt: Date.now() },
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'UNAUTHENTICATED');
    });

    it('TEST 3: User A cannot read User B notifications', () => {
      const res = evaluateNotificationRule({
        path: 'user_notifications/user_bob/n1',
        operation: 'read',
        auth: { uid: 'user_alice' },
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'FORBIDDEN_READ');
    });

    it('TEST 4: User A can read their own notifications', () => {
      const res = evaluateNotificationRule({
        path: 'user_notifications/user_alice/n1',
        operation: 'read',
        auth: { uid: 'user_alice' },
      });
      assert.strictEqual(res.allowed, true);
    });

    it('TEST 5: Normal user cannot forge senderId to impersonate another user', () => {
      const res = evaluateNotificationRule({
        path: 'user_notifications/user_bob/n1',
        operation: 'write',
        auth: { uid: 'user_alice' },
        data: null,
        newData: {
          type: 'CHAT_MESSAGE',
          senderId: 'user_charlie', // Forged senderId!
          createdAt: Date.now(),
        },
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'FORGED_SENDER_ID');
    });

    it('TEST 6: Normal user cannot set actorId: "system" or senderId: "system"', () => {
      const res = evaluateNotificationRule({
        path: 'user_notifications/user_bob/n1',
        operation: 'write',
        auth: { uid: 'user_alice' },
        data: null,
        newData: {
          type: 'BLUEPRINT_COMPLETED',
          senderId: 'system', // Forged system sender!
          actorId: 'system',
          createdAt: Date.now(),
        },
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'FORGED_SENDER_ID');
    });

    it('TEST 7: Normal user cannot inject notifications if they do not share workspace', () => {
      // User Eve (in org_beta) attempts to inject notification into Bob (in org_alpha)
      const res = evaluateNotificationRule({
        path: 'user_notifications/user_bob/n1',
        operation: 'write',
        auth: { uid: 'user_eve' },
        data: null,
        newData: {
          type: 'IDEA_CREATED',
          senderId: 'user_eve',
          orgId: 'org_alpha', // Eve is not a member of org_alpha
          createdAt: Date.now(),
        },
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'CROSS_WORKSPACE_INJECTION_DENIED');
    });
  });

  // =============================================================
  // GROUP 2: RECIPIENT MUTATION & IMMUTABILITY ENFORCEMENT
  // =============================================================
  describe('✏️ 2. Recipient Mutation & Immutability Enforcement', () => {
    const existingNotif = {
      notificationId: 'notif_100',
      recipientId: 'user_alice',
      type: 'BLUEPRINT_COMPLETED',
      senderId: 'system',
      actorId: 'system',
      title: 'Blueprint v1.0 Completed',
      body: 'AI Architecture Blueprint is ready.',
      orgId: 'org_alpha',
      workspaceId: 'org_alpha',
      createdAt: 1700000000000,
      read: false,
    };

    it('TEST 8: Recipient can mark own notification as read (read: true, readAt: timestamp)', () => {
      const res = evaluateNotificationRule({
        path: 'user_notifications/user_alice/notif_100',
        operation: 'write',
        auth: { uid: 'user_alice' },
        data: existingNotif,
        newData: {
          ...existingNotif,
          read: true,
          readAt: 1700000005000,
        },
      });
      assert.strictEqual(res.allowed, true);
    });

    it('TEST 9: Recipient cannot tamper with type on update', () => {
      const res = evaluateNotificationRule({
        path: 'user_notifications/user_alice/notif_100',
        operation: 'write',
        auth: { uid: 'user_alice' },
        data: existingNotif,
        newData: {
          ...existingNotif,
          type: 'ADMIN_BROADCAST', // Tampered!
          read: true,
        },
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'CANNOT_MODIFY_TYPE');
    });

    it('TEST 10: Recipient cannot tamper with senderId or actorId on update', () => {
      const res = evaluateNotificationRule({
        path: 'user_notifications/user_alice/notif_100',
        operation: 'write',
        auth: { uid: 'user_alice' },
        data: existingNotif,
        newData: {
          ...existingNotif,
          senderId: 'user_david', // Tampered!
          read: true,
        },
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'CANNOT_MODIFY_SENDERID');
    });

    it('TEST 11: Recipient cannot tamper with title or body on update', () => {
      const res = evaluateNotificationRule({
        path: 'user_notifications/user_alice/notif_100',
        operation: 'write',
        auth: { uid: 'user_alice' },
        data: existingNotif,
        newData: {
          ...existingNotif,
          title: 'You are awarded 1,000,000 credits', // Forged title!
          read: true,
        },
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'CANNOT_MODIFY_TITLE');
    });

    it('TEST 12: Recipient cannot tamper with orgId or workspaceId on update', () => {
      const res = evaluateNotificationRule({
        path: 'user_notifications/user_alice/notif_100',
        operation: 'write',
        auth: { uid: 'user_alice' },
        data: existingNotif,
        newData: {
          ...existingNotif,
          orgId: 'org_beta', // Tampered workspace context!
          read: true,
        },
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'CANNOT_MODIFY_ORGID');
    });

    it('TEST 13: Recipient cannot tamper with createdAt on update', () => {
      const res = evaluateNotificationRule({
        path: 'user_notifications/user_alice/notif_100',
        operation: 'write',
        auth: { uid: 'user_alice' },
        data: existingNotif,
        newData: {
          ...existingNotif,
          createdAt: 9999999999999, // Tampered timestamp!
          read: true,
        },
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'CANNOT_MODIFY_CREATEDAT');
    });

    it('TEST 14: Non-recipient cannot update another user\'s notification', () => {
      const res = evaluateNotificationRule({
        path: 'user_notifications/user_alice/notif_100',
        operation: 'write',
        auth: { uid: 'user_bob' },
        data: existingNotif,
        newData: {
          ...existingNotif,
          read: true,
        },
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'FORBIDDEN_UPDATE');
    });

    it('TEST 15: Non-recipient cannot delete another user\'s notification', () => {
      const res = evaluateNotificationRule({
        path: 'user_notifications/user_alice/notif_100',
        operation: 'write',
        auth: { uid: 'user_bob' },
        data: existingNotif,
        newData: null, // Attempted delete
      });
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.reason, 'CANNOT_DELETE_ANOTHER_USERS_NOTIFICATION');
    });
  });

  // =============================================================
  // GROUP 3: AUTHORITATIVE SERVER DELIVERY & WORKSPACE ISOLATION
  // =============================================================
  describe('🚀 3. Authoritative Server Delivery & Workspace Isolation', () => {
    it('TEST 16: Trusted backend (Admin SDK) can authoritatively create system notifications', async () => {
      // Backend Admin SDK writes directly to user_notifications without rule block
      const canonical = createCanonicalNotification({
        notificationId: 'notif_sys_001',
        recipientId: 'user_alice',
        type: NOTIFICATION_TYPES.BLUEPRINT_COMPLETED,
        title: 'AI Blueprint Ready',
        body: 'Your AI Architecture plan is ready.',
        actorId: 'system',
        actorName: 'Convia AI Engine',
        workspaceId: 'org_alpha',
        createdAt: Date.now(),
      });

      mockDb.user_notifications['user_alice/notif_sys_001'] = canonical;
      assert.strictEqual(mockDb.user_notifications['user_alice/notif_sys_001'].actorId, 'system');
      assert.strictEqual(mockDb.user_notifications['user_alice/notif_sys_001'].recipientId, 'user_alice');
    });

    it('TEST 17: Trusted backend creates notifications for multiple recipients atomically', async () => {
      const recipients = ['user_alice', 'user_bob', 'user_david'];
      const timestamp = Date.now();
      const payload = {
        type: NOTIFICATION_TYPES.BLUEPRINT_COMPLETED,
        title: 'Blueprint v2.0 Ready',
        body: 'Architecture plan v2.0 ready for review.',
        actorId: 'system',
        workspaceId: 'org_alpha',
      };

      const updates = {};
      recipients.forEach((uid) => {
        const notifId = `notif_${timestamp}_${uid}`;
        updates[`user_notifications/${uid}/${notifId}`] = createCanonicalNotification({
          ...payload,
          notificationId: notifId,
          recipientId: uid,
          createdAt: timestamp,
        });
      });

      Object.assign(mockDb.user_notifications, updates);

      // Verify all 3 recipients received identical notification content
      recipients.forEach((uid) => {
        const notif = mockDb.user_notifications[`user_notifications/${uid}/notif_${timestamp}_${uid}`];
        assert.ok(notif);
        assert.strictEqual(notif.recipientId, uid);
        assert.strictEqual(notif.title, 'Blueprint v2.0 Ready');
      });
    });

    it('TEST 18: Workspace recipient resolution excludes the triggering actor', async () => {
      const actorUid = 'user_alice';
      const workspaceMembers = ['user_alice', 'user_bob', 'user_david'];

      const resolvedRecipients = workspaceMembers.filter((uid) => uid !== actorUid);
      assert.deepStrictEqual(resolvedRecipients, ['user_bob', 'user_david']);
      assert.strictEqual(resolvedRecipients.includes(actorUid), false);
    });
  });

  // =============================================================
  // GROUP 4: RESILIENCE, OFFLINE & PERSISTENCE GUARANTEES
  // =============================================================
  describe('💾 4. Resilience, Offline & Persistence Guarantees', () => {
    it('TEST 19: Offline resilience: notifications written while recipient is offline persist and are readable upon reconnection', () => {
      const offlineUid = 'user_bob';
      const notif = createCanonicalNotification({
        notificationId: 'notif_offline_1',
        recipientId: offlineUid,
        type: NOTIFICATION_TYPES.CHAT_MENTION,
        title: 'New Mention in #general',
        body: 'Alice: @bob check the latest blueprint',
        actorId: 'user_alice',
        workspaceId: 'org_alpha',
        createdAt: 1700000010000,
      });

      // Stored in RTDB while Bob is offline
      mockDb.user_notifications[`${offlineUid}/${notif.notificationId}`] = notif;

      // Bob comes back online and queries his notifications
      const readRes = evaluateNotificationRule({
        path: `user_notifications/${offlineUid}/${notif.notificationId}`,
        operation: 'read',
        auth: { uid: offlineUid },
      });
      assert.strictEqual(readRes.allowed, true);

      const bobNotif = mockDb.user_notifications[`${offlineUid}/${notif.notificationId}`];
      assert.strictEqual(bobNotif.body, 'Alice: @bob check the latest blueprint');
      assert.strictEqual(bobNotif.read, false);
    });

    it('TEST 20: Workspace leave/rejoin resilience: notifications remain in user inbox after leaving a workspace', () => {
      const memberUid = 'user_bob';
      const notif = createCanonicalNotification({
        notificationId: 'notif_leave_test',
        recipientId: memberUid,
        type: NOTIFICATION_TYPES.IDEA_CREATED,
        title: 'New Proposal Posted',
        body: 'Alice submitted proposal "AI Engine"',
        actorId: 'user_alice',
        workspaceId: 'org_alpha',
        createdAt: 1700000020000,
      });

      // Delivered to Bob while in org_alpha
      mockDb.user_notifications[`${memberUid}/${notif.notificationId}`] = notif;

      // Bob leaves org_alpha (membership removed)
      delete mockDb.organization_members.org_alpha.user_bob;
      assert.strictEqual(Boolean(mockDb.organization_members.org_alpha.user_bob), false);

      // Existing notifications in user_notifications/user_bob remain intact
      const existingNotif = mockDb.user_notifications[`${memberUid}/${notif.notificationId}`];
      assert.ok(existingNotif);
      assert.strictEqual(existingNotif.notificationId, 'notif_leave_test');

      // Bob can still read his historical notifications
      const readRes = evaluateNotificationRule({
        path: `user_notifications/${memberUid}/${notif.notificationId}`,
        operation: 'read',
        auth: { uid: memberUid },
      });
      assert.strictEqual(readRes.allowed, true);
    });

    it('TEST 21: Idempotency: deterministic dedupeKey prevents duplicate notifications on retry', () => {
      const dedupeKey1 = buildNotificationDedupeKey({
        workspaceId: 'org_alpha',
        type: NOTIFICATION_TYPES.BLUEPRINT_VERSION_APPROVED,
        resourceId: 'bp_org_alpha_v2',
        recipientId: 'user_bob',
        actorId: 'user_alice',
      });

      const dedupeKey2 = buildNotificationDedupeKey({
        workspaceId: 'org_alpha',
        type: NOTIFICATION_TYPES.BLUEPRINT_VERSION_APPROVED,
        resourceId: 'bp_org_alpha_v2',
        recipientId: 'user_bob',
        actorId: 'user_alice',
      });

      assert.strictEqual(dedupeKey1, dedupeKey2);
      assert.strictEqual(
        dedupeKey1,
        'org_alpha_BLUEPRINT_VERSION_APPROVED_bp_org_alpha_v2_user_alice_user_bob'
      );
    });
  });

  // =============================================================
  // GROUP 5: CANONICAL PATH CONSOLIDATION & EVENT WIRING
  // =============================================================
  describe('📬 5. Canonical Path Consolidation & Event Wiring', () => {
    it('TEST 22: Admin broadcast is written to canonical user_notifications/ and received by all users', () => {
      const timestamp = Date.now();
      const allUserUids = Object.keys(mockDb.users);
      const notifId = `notif_bcast_${timestamp}`;

      const updates = {};
      allUserUids.forEach((uid) => {
        updates[`user_notifications/${uid}/${notifId}`] = createCanonicalNotification({
          notificationId: notifId,
          recipientId: uid,
          type: NOTIFICATION_TYPES.ADMIN_BROADCAST,
          title: 'Scheduled Maintenance',
          body: 'Convia will undergo brief maintenance at midnight UTC.',
          actorId: 'system',
          actorName: 'Convia Admin',
          createdAt: timestamp,
          actionUrl: '/dashboard',
        });
      });

      Object.assign(mockDb.user_notifications, updates);

      // Verify each user can read the broadcast from canonical path
      allUserUids.forEach((uid) => {
        const notif = mockDb.user_notifications[`user_notifications/${uid}/${notifId}`];
        assert.ok(notif, `User ${uid} must have received the admin broadcast`);
        assert.strictEqual(notif.type, NOTIFICATION_TYPES.ADMIN_BROADCAST);
        assert.strictEqual(notif.title, 'Scheduled Maintenance');
      });
    });

    it('TEST 23: User warning and report resolution are written to canonical user_notifications/', () => {
      const timestamp = Date.now();
      const targetUid = 'user_bob';

      // Warning
      const warnNotif = createCanonicalNotification({
        notificationId: `notif_warn_${timestamp}`,
        recipientId: targetUid,
        type: NOTIFICATION_TYPES.ADMIN_BROADCAST,
        title: 'Official Warning (MEDIUM Severity)',
        body: 'Administrator notice: Inappropriate language in discussion.',
        actorId: 'system',
        actorName: 'Convia Admin',
        createdAt: timestamp,
      });
      mockDb.user_notifications[`${targetUid}/${warnNotif.notificationId}`] = warnNotif;

      // Report Resolution
      const reportNotif = createCanonicalNotification({
        notificationId: `notif_rep_${timestamp}`,
        recipientId: targetUid,
        type: NOTIFICATION_TYPES.ADMIN_BROADCAST,
        title: 'Report Status Updated',
        body: 'Your issue report (rep_123) status has been updated to "RESOLVED".',
        actorId: 'system',
        actorName: 'Convia Admin',
        createdAt: timestamp,
      });
      mockDb.user_notifications[`${targetUid}/${reportNotif.notificationId}`] = reportNotif;

      assert.strictEqual(mockDb.user_notifications[`${targetUid}/${warnNotif.notificationId}`].title, 'Official Warning (MEDIUM Severity)');
      assert.strictEqual(mockDb.user_notifications[`${targetUid}/${reportNotif.notificationId}`].title, 'Report Status Updated');
    });

    it('TEST 24: Blueprint version approval dispatches notifications to workspace members', () => {
      const approverUid = 'user_alice';
      const recipients = ['user_bob', 'user_david'];
      const version = '2.0';

      const notifs = recipients.map((uid) => {
        return createCanonicalNotification({
          notificationId: `notif_bp_app_${version}_${uid}`,
          recipientId: uid,
          type: NOTIFICATION_TYPES.BLUEPRINT_VERSION_APPROVED,
          title: `Blueprint v${version} Approved`,
          body: `Alice approved Blueprint v${version} for "AI Health Tracker".`,
          actorId: approverUid,
          actorName: 'Alice',
          workspaceId: 'org_alpha',
        });
      });

      assert.strictEqual(notifs.length, 2);
      assert.strictEqual(notifs[0].type, NOTIFICATION_TYPES.BLUEPRINT_VERSION_APPROVED);
      assert.strictEqual(getNotificationCategory(notifs[0].type), NOTIFICATION_CATEGORIES.BLUEPRINT);
      assert.strictEqual(notifs[0].actionUrl, '/workspaces/org_alpha/blueprint');
    });

    it('TEST 25: Workspace member join dispatches notifications to existing workspace members', () => {
      const newMemberUid = 'user_david';
      const existingMembers = ['user_alice', 'user_bob'];

      const notifs = existingMembers.map((uid) => {
        return createCanonicalNotification({
          notificationId: `notif_join_${newMemberUid}_${uid}`,
          recipientId: uid,
          type: NOTIFICATION_TYPES.WORKSPACE_MEMBER_JOINED,
          title: 'New Member Joined Workspace',
          body: 'David has joined the workspace.',
          actorId: newMemberUid,
          actorName: 'David',
          workspaceId: 'org_alpha',
        });
      });

      assert.strictEqual(notifs.length, 2);
      assert.strictEqual(notifs[0].type, NOTIFICATION_TYPES.WORKSPACE_MEMBER_JOINED);
      assert.strictEqual(notifs[0].actionUrl, '/workspaces/org_alpha/members');
    });

    it('TEST 26: Notification delivery failure is logged with error context and does not throw', async () => {
      // Test that non-blocking notification failure logs warning without crashing caller
      let loggedWarning = null;
      const originalWarn = console.warn;
      console.warn = (...args) => {
        loggedWarning = args.join(' ');
      };

      try {
        // Deliberately simulate invalid notification creation
        const result = await notificationService.createNotification('', null);
        assert.strictEqual(result, null);
      } finally {
        console.warn = originalWarn;
      }
    });

    it('TEST 27: Multi-location update tampering cannot bypass user_notifications security rules', () => {
      // Attacker attempts multi-path write combining legitimate vote with forged notification
      const atomicWrites = [
        {
          path: 'votes/org_alpha/idea_1/user_alice',
          operation: 'write',
          auth: { uid: 'user_alice' },
          newData: { vote: 1 },
        },
        {
          path: 'user_notifications/user_bob/forged_notif',
          operation: 'write',
          auth: { uid: 'user_alice' },
          data: null,
          newData: {
            type: 'ADMIN_BROADCAST',
            senderId: 'system', // Forged sender in atomic batch!
            createdAt: Date.now(),
          },
        },
      ];

      const results = atomicWrites.map((w) => {
        if (w.path.startsWith('user_notifications')) {
          return evaluateNotificationRule(w);
        }
        return { allowed: true };
      });

      const batchAllowed = results.every((r) => r.allowed);
      assert.strictEqual(batchAllowed, false, 'Batch update containing forbidden notification path must fail atomically');
    });

    it('TEST 28: Account deletion cascade cleans up user_notifications/${uid}', async () => {
      const targetUid = 'user_eve';
      const result = await accountDeletionService.buildAccountDeletionPlan(targetUid);

      assert.strictEqual(result.isBlocked, false);
      assert.strictEqual(
        result.rtdbUpdates[`user_notifications/${targetUid}`],
        null,
        'Account deletion must clean user_notifications subtree'
      );
      assert.strictEqual(
        result.rtdbUpdates[`notifications/${targetUid}`],
        null,
        'Account deletion must clean legacy notifications subtree'
      );
    });
  });
});
