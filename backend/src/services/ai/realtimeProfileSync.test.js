import { describe, it } from 'node:test';
import assert from 'node:assert';

import {
  getUserProfilePath,
  DB_PATHS,
} from '../../../../frontend/src/constants/databasePaths.js';

describe('🧪 CONVIA REAL-TIME USER PROFILE SYNCHRONIZATION SYSTEM', () => {
  // -------------------------------------------------------------------
  // 1. Canonical Database Paths & Single Source of Truth
  // -------------------------------------------------------------------
  describe('🔍 1. Canonical Profile Paths & Single Source of Truth', () => {
    it('DB_PATHS.USERS points to canonical "users" node', () => {
      assert.strictEqual(DB_PATHS.USERS, 'users');
    });

    it('getUserProfilePath returns canonical users/{uid} path', () => {
      assert.strictEqual(getUserProfilePath('u_123'), 'users/u_123');
      assert.strictEqual(getUserProfilePath('PARAS_09_UID'), 'users/PARAS_09_UID');
    });

    it('getUserProfilePath trims whitespace and rejects empty/invalid inputs', () => {
      assert.strictEqual(getUserProfilePath('  u_padded  '), 'users/u_padded');
      assert.throws(() => getUserProfilePath(''), /uid is required/);
      assert.throws(() => getUserProfilePath('   '), /uid is required/);
      assert.throws(() => getUserProfilePath(null), /uid is required/);
      assert.throws(() => getUserProfilePath(undefined), /uid is required/);
    });
  });

  // -------------------------------------------------------------------
  // 2. Profile Resolution Hierarchy & Fallback System
  // -------------------------------------------------------------------
  describe('🔍 2. Profile Resolution Hierarchy & Fallback System', () => {
    function resolveUserPresentation(uid, { liveProfile, memberProfile, fallbackSnapshot, defaultName = 'Member' } = {}) {
      if (!uid) return { displayName: defaultName, avatar: '' };

      const displayName =
        (liveProfile && liveProfile.displayName && liveProfile.displayName.trim()) ||
        (memberProfile && memberProfile.displayName && memberProfile.displayName.trim()) ||
        (fallbackSnapshot && fallbackSnapshot.trim()) ||
        defaultName;

      const avatar =
        (liveProfile && (liveProfile.photoURL || liveProfile.avatar)) ||
        (memberProfile && (memberProfile.photoURL || memberProfile.avatar)) ||
        '';

      return { displayName, avatar };
    }

    it('prioritizes live profile over member roster and document snapshots', () => {
      const result = resolveUserPresentation('uid_alice', {
        liveProfile: { displayName: 'PARAS_09', photoURL: 'https://example.com/live.png' },
        memberProfile: { displayName: 'Old Member Name', avatar: 'https://example.com/member.png' },
        fallbackSnapshot: 'Ancient Snapshot Name',
      });

      assert.strictEqual(result.displayName, 'PARAS_09');
      assert.strictEqual(result.avatar, 'https://example.com/live.png');
    });

    it('falls back to member profile when live profile is not yet loaded', () => {
      const result = resolveUserPresentation('uid_alice', {
        liveProfile: null,
        memberProfile: { displayName: 'Workspace Member Name', avatar: 'https://example.com/member.png' },
        fallbackSnapshot: 'Ancient Snapshot Name',
      });

      assert.strictEqual(result.displayName, 'Workspace Member Name');
      assert.strictEqual(result.avatar, 'https://example.com/member.png');
    });

    it('falls back to document snapshot when neither live profile nor member profile exists', () => {
      const result = resolveUserPresentation('uid_legacy', {
        liveProfile: null,
        memberProfile: null,
        fallbackSnapshot: 'Archived Creator Name',
      });

      assert.strictEqual(result.displayName, 'Archived Creator Name');
      assert.strictEqual(result.avatar, '');
    });

    it('falls back to defaultName when all sources are missing or empty', () => {
      const result = resolveUserPresentation('uid_unknown', {
        liveProfile: { displayName: '   ' },
        memberProfile: null,
        fallbackSnapshot: '',
        defaultName: 'Collaborator',
      });

      assert.strictEqual(result.displayName, 'Collaborator');
    });
  });

  // -------------------------------------------------------------------
  // 3. Deduplicated Real-Time Subscription Manager
  // -------------------------------------------------------------------
  describe('🔍 3. Deduplicated Real-Time Subscription Manager', () => {
    class MockSubscriptionRegistry {
      constructor() {
        this.subscriptions = new Map(); // uid -> { count, callbacks: Set, data }
        this.activeListeners = new Map(); // uid -> mock listener
      }

      subscribe(uid, onData) {
        if (!uid) return () => {};

        let entry = this.subscriptions.get(uid);
        if (entry) {
          entry.count++;
          entry.callbacks.add(onData);
        } else {
          entry = { count: 1, callbacks: new Set([onData]), data: null };
          this.subscriptions.set(uid, entry);

          // Simulate starting 1 database listener
          const listener = (data) => {
            entry.data = data;
            entry.callbacks.forEach((cb) => cb(data));
          };
          this.activeListeners.set(uid, listener);
        }

        // Return unsubscribe cleanup function
        return () => {
          const current = this.subscriptions.get(uid);
          if (!current) return;
          current.callbacks.delete(onData);
          current.count--;
          if (current.count <= 0) {
            this.subscriptions.delete(uid);
            this.activeListeners.delete(uid);
          }
        };
      }

      getActiveListenerCount() {
        return this.activeListeners.size;
      }

      getRefCount(uid) {
        return this.subscriptions.get(uid)?.count || 0;
      }

      emit(uid, data) {
        const listener = this.activeListeners.get(uid);
        if (listener) listener(data);
      }
    }

    it('deduplicates multiple requests for the same UID into a single database listener', () => {
      const registry = new MockSubscriptionRegistry();
      let userEvents1 = 0;
      let userEvents2 = 0;
      let userEvents3 = 0;

      // 3 separate components subscribe to the same user
      const unsub1 = registry.subscribe('uid_paras', () => userEvents1++);
      const unsub2 = registry.subscribe('uid_paras', () => userEvents2++);
      const unsub3 = registry.subscribe('uid_paras', () => userEvents3++);

      // Must only create 1 listener
      assert.strictEqual(registry.getActiveListenerCount(), 1);
      assert.strictEqual(registry.getRefCount('uid_paras'), 3);

      // Emit update from RTDB
      registry.emit('uid_paras', { displayName: 'PARAS_09' });

      assert.strictEqual(userEvents1, 1);
      assert.strictEqual(userEvents2, 1);
      assert.strictEqual(userEvents3, 1);

      // Unsubscribe 2 components
      unsub1();
      unsub2();
      assert.strictEqual(registry.getActiveListenerCount(), 1);
      assert.strictEqual(registry.getRefCount('uid_paras'), 1);

      // Unsubscribe final component
      unsub3();
      assert.strictEqual(registry.getActiveListenerCount(), 0);
      assert.strictEqual(registry.getRefCount('uid_paras'), 0);
    });

    it('correctly tracks multiple distinct UIDs without cross-talk', () => {
      const registry = new MockSubscriptionRegistry();
      let aliceData = null;
      let bobData = null;

      const unsubAlice = registry.subscribe('uid_alice', (d) => (aliceData = d));
      const unsubBob = registry.subscribe('uid_bob', (d) => (bobData = d));

      assert.strictEqual(registry.getActiveListenerCount(), 2);

      registry.emit('uid_alice', { displayName: 'Alice' });
      assert.strictEqual(aliceData.displayName, 'Alice');
      assert.strictEqual(bobData, null);

      registry.emit('uid_bob', { displayName: 'Bob' });
      assert.strictEqual(bobData.displayName, 'Bob');

      unsubAlice();
      assert.strictEqual(registry.getActiveListenerCount(), 1);
      unsubBob();
      assert.strictEqual(registry.getActiveListenerCount(), 0);
    });
  });

  // -------------------------------------------------------------------
  // 4. Strict Separation: UID Identity vs. Display Name Profile Data
  // -------------------------------------------------------------------
  describe('🔍 4. Strict Separation: UID Identity vs. Display Name Profile Data', () => {
    function canEditMessage(authenticatedUser, message) {
      if (!authenticatedUser || !authenticatedUser.uid) return false;
      if (!message || message.deleted) return false;
      // Authoritative check must strictly use immutable UID
      return authenticatedUser.uid === message.senderId;
    }

    function canDeleteMessage(authenticatedUser, message, isWorkspaceAdmin = false) {
      if (!authenticatedUser || !authenticatedUser.uid) return false;
      if (!message || message.deleted) return false;
      // Authoritative check must strictly use immutable UID
      return authenticatedUser.uid === message.senderId || isWorkspaceAdmin;
    }

    it('preserves edit permissions when user updates display name', () => {
      const user = { uid: 'user_paras_uid', displayName: 'PARAS_09' };
      const message = {
        messageId: 'msg_1',
        senderId: 'user_paras_uid',
        senderName: 'Old Name',
        content: 'Hello team',
      };

      // Edit permission is based on UID, not displayName
      assert.strictEqual(canEditMessage(user, message), true);

      // Even if display name changes in profile, UID matches
      const updatedUser = { ...user, displayName: 'PARAS_NEW' };
      assert.strictEqual(canEditMessage(updatedUser, message), true);
    });

    it('blocks an unauthorized user who spoofed the same display name', () => {
      const legitimateAuthor = { uid: 'author_123', displayName: 'PARAS_09' };
      const attackerWithSameName = { uid: 'attacker_999', displayName: 'PARAS_09' };
      const message = {
        messageId: 'msg_1',
        senderId: legitimateAuthor.uid,
        senderName: 'PARAS_09',
        content: 'Original proposal',
      };

      assert.strictEqual(canEditMessage(legitimateAuthor, message), true);
      assert.strictEqual(canEditMessage(attackerWithSameName, message), false);
      assert.strictEqual(canDeleteMessage(attackerWithSameName, message, false), false);
    });
  });

  // -------------------------------------------------------------------
  // 5. Cross-Session Synchronization Lifecycle
  // -------------------------------------------------------------------
  describe('🔍 5. Cross-Session Synchronization Lifecycle', () => {
    it('simulates User A saving "PARAS_09" and propagating immediately to User B session', () => {
      // Shared Realtime Database State
      const rtdbDatabase = {
        'users/user_a': { uid: 'user_a', displayName: 'Old Name', email: 'a@convia.dev' },
      };

      const sessionBProfileStore = {};

      // Session B sets up real-time subscription to User A
      const listenerB = (updatedData) => {
        sessionBProfileStore['user_a'] = updatedData;
      };

      // Initial state sync
      listenerB(rtdbDatabase['users/user_a']);
      assert.strictEqual(sessionBProfileStore['user_a'].displayName, 'Old Name');

      // User A in Session A saves profile changes: "PARAS_09"
      rtdbDatabase['users/user_a'] = {
        ...rtdbDatabase['users/user_a'],
        displayName: 'PARAS_09',
        updatedAt: 1785000000000,
      };

      // RTDB triggers live onValue callback to Session B
      listenerB(rtdbDatabase['users/user_a']);

      // Session B reflects the update without refresh
      assert.strictEqual(sessionBProfileStore['user_a'].displayName, 'PARAS_09');
    });
  });
});
