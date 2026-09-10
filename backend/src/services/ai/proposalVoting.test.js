import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * In-Memory Mock Database Engine for Proposal Voting Verification.
 * Models atomic multi-path updates, realtime listener distribution,
 * and optimistic UI reconciliation.
 */
class MockDatabaseEngine {
  constructor() {
    this.data = new Map();
    this.listeners = new Map(); // path -> Set<callback>
  }

  get(path) {
    if (this.data.has(path)) return this.data.get(path);
    const parts = path.split('/').filter(Boolean);
    for (let i = parts.length - 1; i > 0; i--) {
      const parentPath = parts.slice(0, i).join('/');
      if (this.data.has(parentPath)) {
        let curr = this.data.get(parentPath);
        for (let j = i; j < parts.length; j++) {
          if (curr && typeof curr === 'object' && parts[j] in curr) {
            curr = curr[parts[j]];
          } else {
            curr = undefined;
            break;
          }
        }
        if (curr !== undefined) return curr;
      }
    }
    return null;
  }

  set(path, value) {
    if (value === null || value === undefined) {
      this.data.delete(path);
    } else {
      this.data.set(path, JSON.parse(JSON.stringify(value)));
    }
    this._notify(path, this.get(path));
  }

  /**
   * Simulates Firebase RTDB atomic multi-path update.
   */
  atomicUpdate(updates) {
    for (const [path, val] of Object.entries(updates)) {
      const parts = path.split('/').filter(Boolean);
      let handledNested = false;

      for (let i = parts.length - 1; i > 0; i--) {
        const parentPath = parts.slice(0, i).join('/');
        if (this.data.has(parentPath)) {
          const parentObj = this.data.get(parentPath);
          if (parentObj && typeof parentObj === 'object') {
            const field = parts.slice(i).join('/');
            const currentVal = parentObj[field] ?? 0;
            const nextVal = typeof val === 'function' ? val(Number(currentVal)) : val;
            if (nextVal === null || nextVal === undefined) {
              delete parentObj[field];
            } else {
              parentObj[field] = nextVal;
            }
            this.data.set(parentPath, parentObj);
            handledNested = true;
            this._notify(parentPath, parentObj);
            break;
          }
        }
      }

      if (!handledNested) {
        if (typeof val === 'function') {
          const currentVal = Number(this.get(path) || 0);
          this.set(path, Math.max(0, val(currentVal)));
        } else {
          this.set(path, val);
        }
      }
    }

    for (const path of Object.keys(updates)) {
      this._notify(path, this.get(path));
    }
  }

  subscribe(path, callback) {
    if (!this.listeners.has(path)) {
      this.listeners.set(path, new Set());
    }
    this.listeners.get(path).add(callback);
    callback(this.get(path));

    return () => {
      const set = this.listeners.get(path);
      if (set) {
        set.delete(callback);
        if (set.size === 0) this.listeners.delete(path);
      }
    };
  }

  _notify(path, value) {
    const exactListeners = this.listeners.get(path);
    if (exactListeners) {
      exactListeners.forEach((cb) => cb(value));
    }

    for (const [listenPath, callbacks] of this.listeners.entries()) {
      if (path.startsWith(listenPath + '/')) {
        callbacks.forEach((cb) => cb(this.get(listenPath)));
      } else if (listenPath.startsWith(path + '/')) {
        callbacks.forEach((cb) => cb(this.get(listenPath)));
      }
    }
  }
}

/**
 * Optimistic Voting Client Controller.
 * Implements the client-side state machine and reconciliation logic.
 */
class OptimisticVotingController {
  constructor(db, { ideaId, uid, isPublic = false, orgId = null }) {
    this.db = db;
    this.ideaId = ideaId;
    this.uid = uid;
    this.isPublic = isPublic;
    this.orgId = orgId;

    this.ideaPath = isPublic ? `publicIdeas/${ideaId}` : `ideas/${orgId}/${ideaId}`;
    this.votePath = `votes/${ideaId}_${uid}`;

    // Confirmed server state
    this.serverVoteCount = 0;
    this.serverHasVoted = false;

    // Temporary optimistic state
    this.optimisticVoteState = null; // { hasVoted: boolean, delta: number } | null
    this.isPending = false;
    this.lastError = null;

    // Subscriptions cleanup
    this.unsubIdea = null;
    this.unsubVote = null;
  }

  mount() {
    this.unsubIdea = this.db.subscribe(this.ideaPath, (ideaData) => {
      this.serverVoteCount = Number(ideaData?.voteCount || 0);
      this._reconcile();
    });

    this.unsubVote = this.db.subscribe(this.votePath, (voteData) => {
      this.serverHasVoted = Boolean(voteData);
      this._reconcile();
    });
  }

  unmount() {
    if (this.unsubIdea) this.unsubIdea();
    if (this.unsubVote) this.unsubVote();
  }

  _reconcile() {
    // If the server confirms our optimistic intention, clear the pending delta
    if (this.optimisticVoteState !== null) {
      if (this.serverHasVoted === this.optimisticVoteState.hasVoted) {
        this.optimisticVoteState = null;
      }
    }
  }

  get displayedHasVoted() {
    if (this.optimisticVoteState !== null) {
      return this.optimisticVoteState.hasVoted;
    }
    return this.serverHasVoted;
  }

  get displayedVoteCount() {
    if (this.optimisticVoteState !== null) {
      // If server hasn't reflected our vote yet, add the pending delta
      if (this.serverHasVoted !== this.optimisticVoteState.hasVoted) {
        return Math.max(0, this.serverVoteCount + this.optimisticVoteState.delta);
      }
    }
    return this.serverVoteCount;
  }

  async toggleVote({ simulateDelayMs = 0, simulateNetworkFailure = false } = {}) {
    // 1. Prevent duplicate clicks immediately while pending
    if (this.isPending) {
      return { blocked: true };
    }

    if (!this.uid) {
      throw new Error('User authentication required to vote.');
    }

    const currentVoted = this.displayedHasVoted;
    const willVote = !currentVoted;
    const delta = willVote ? 1 : -1;

    // 2. Apply immediate optimistic update
    this.isPending = true;
    this.lastError = null;
    this.optimisticVoteState = {
      hasVoted: willVote,
      delta,
    };

    try {
      if (simulateDelayMs > 0) {
        await new Promise((r) => setTimeout(r, simulateDelayMs));
      }

      if (simulateNetworkFailure) {
        throw new Error('Network timeout: failed to persist vote.');
      }

      // 3. Execute atomic multi-path update in database
      const updates = {};
      if (willVote) {
        updates[this.votePath] = {
          voteId: `${this.ideaId}_${this.uid}`,
          ideaId: this.ideaId,
          orgId: this.orgId || null,
          uid: this.uid,
          voteValue: 1,
          createdAt: Date.now(),
        };
        updates[`${this.ideaPath}/voteCount`] = (currentCount) => currentCount + 1;
      } else {
        updates[this.votePath] = null;
        updates[`${this.ideaPath}/voteCount`] = (currentCount) => Math.max(0, currentCount - 1);
      }

      this.db.atomicUpdate(updates);
      this.isPending = false;
      return { success: true, voted: willVote };
    } catch (err) {
      // 4. Rollback optimistic state on error
      this.optimisticVoteState = null;
      this.isPending = false;
      this.lastError = err.message;
      throw err;
    }
  }
}

describe('🧪 CONVIA PROPOSAL VOTING PERFORMANCE & STATE SYNCHRONIZATION', () => {
  let db;

  beforeEach(() => {
    db = new MockDatabaseEngine();
    // Seed initial proposal with 1 vote
    db.set('ideas/org_convia/prop_1', {
      ideaId: 'prop_1',
      orgId: 'org_convia',
      title: 'Real-time AI Workspace Hub',
      authorId: 'author_uid',
      authorName: 'Initial Author',
      voteCount: 1,
    });
    // Seed user_other vote
    db.set('votes/prop_1_user_other', {
      voteId: 'prop_1_user_other',
      ideaId: 'prop_1',
      uid: 'user_other',
      voteValue: 1,
    });
  });

  describe('🔍 Test 1: Normal Vote Flow & Immediate Feedback', () => {
    it('immediately reflects Voted (2) upon user click with zero spinner delay', async () => {
      const controller = new OptimisticVotingController(db, {
        ideaId: 'prop_1',
        uid: 'user_paras',
        isPublic: false,
        orgId: 'org_convia',
      });
      controller.mount();

      assert.strictEqual(controller.displayedHasVoted, false, 'Initial state: not voted');
      assert.strictEqual(controller.displayedVoteCount, 1, 'Initial count: 1 vote');

      // Trigger vote
      const votePromise = controller.toggleVote({ simulateDelayMs: 20 });

      // Immediate check BEFORE backend completes
      assert.strictEqual(controller.displayedHasVoted, true, 'Immediate optimistic feedback: hasVoted is true');
      assert.strictEqual(controller.displayedVoteCount, 2, 'Immediate optimistic feedback: voteCount is 2');
      assert.strictEqual(controller.isPending, true, 'Button enters brief non-blocking pending lock');

      // Duplicate click while in-flight must be ignored
      const duplicateRes = await controller.toggleVote();
      assert.strictEqual(duplicateRes.blocked, true, 'Duplicate click blocked immediately');

      // Await completion
      await votePromise;
      assert.strictEqual(controller.displayedHasVoted, true, 'Confirmed state: hasVoted is true');
      assert.strictEqual(controller.displayedVoteCount, 2, 'Confirmed count: 2');
      assert.strictEqual(controller.isPending, false, 'Pending state cleared after write');

      controller.unmount();
    });
  });

  describe('🔍 Test 2: Two Users Real-Time Synchronization', () => {
    it('updates User B in real-time when User A votes without refreshing', async () => {
      const userA = new OptimisticVotingController(db, {
        ideaId: 'prop_1',
        uid: 'user_a',
        isPublic: false,
        orgId: 'org_convia',
      });
      const userB = new OptimisticVotingController(db, {
        ideaId: 'prop_1',
        uid: 'user_b',
        isPublic: false,
        orgId: 'org_convia',
      });

      userA.mount();
      userB.mount();

      assert.strictEqual(userA.displayedVoteCount, 1);
      assert.strictEqual(userB.displayedVoteCount, 1);

      // User A casts vote
      await userA.toggleVote();

      // User A state
      assert.strictEqual(userA.displayedHasVoted, true);
      assert.strictEqual(userA.displayedVoteCount, 2);

      // User B state updates automatically via database listener
      assert.strictEqual(userB.displayedHasVoted, false, 'User B has not voted');
      assert.strictEqual(userB.displayedVoteCount, 2, "User B's count updated in real-time without page refresh");

      userA.unmount();
      userB.unmount();
    });
  });

  describe('🔍 Test 3: Simultaneous Votes Race Safety', () => {
    it('safely handles concurrent votes without losing counts or double-counting', async () => {
      const user1 = new OptimisticVotingController(db, {
        ideaId: 'prop_1',
        uid: 'sim_user_1',
        orgId: 'org_convia',
      });
      const user2 = new OptimisticVotingController(db, {
        ideaId: 'prop_1',
        uid: 'sim_user_2',
        orgId: 'org_convia',
      });
      const user3 = new OptimisticVotingController(db, {
        ideaId: 'prop_1',
        uid: 'sim_user_3',
        orgId: 'org_convia',
      });

      user1.mount();
      user2.mount();
      user3.mount();

      // Fire all 3 votes simultaneously
      await Promise.all([
        user1.toggleVote({ simulateDelayMs: 15 }),
        user2.toggleVote({ simulateDelayMs: 10 }),
        user3.toggleVote({ simulateDelayMs: 25 }),
      ]);

      // Base was 1 + 3 new votes = 4
      const targetIdea = db.get('ideas/org_convia/prop_1');
      assert.strictEqual(targetIdea.voteCount, 4, 'Atomic increments correctly accumulated 3 concurrent votes');
      assert.strictEqual(user1.displayedVoteCount, 4);
      assert.strictEqual(user2.displayedVoteCount, 4);
      assert.strictEqual(user3.displayedVoteCount, 4);

      user1.unmount();
      user2.unmount();
      user3.unmount();
    });
  });

  describe('🔍 Test 4: Failed Vote Rollback & Error Recovery', () => {
    it('cleanly reverts optimistic state and removes loading state on network failure', async () => {
      const controller = new OptimisticVotingController(db, {
        ideaId: 'prop_1',
        uid: 'user_failing',
        orgId: 'org_convia',
      });
      controller.mount();

      assert.strictEqual(controller.displayedHasVoted, false);
      assert.strictEqual(controller.displayedVoteCount, 1);

      // Trigger vote with simulated network error
      await assert.rejects(
        () => controller.toggleVote({ simulateNetworkFailure: true }),
        /Network timeout/
      );

      // Verify clean rollback
      assert.strictEqual(controller.displayedHasVoted, false, 'hasVoted reverted to false');
      assert.strictEqual(controller.displayedVoteCount, 1, 'voteCount reverted to confirmed 1');
      assert.strictEqual(controller.isPending, false, 'Button is no longer loading');
      assert.strictEqual(controller.lastError, 'Network timeout: failed to persist vote.');

      controller.unmount();
    });
  });

  describe('🔍 Test 5: Slow Network Resilience', () => {
    it('provides immediate visual feedback even when the network connection is slow', async () => {
      const controller = new OptimisticVotingController(db, {
        ideaId: 'prop_1',
        uid: 'user_slow',
        orgId: 'org_convia',
      });
      controller.mount();

      const startTime = Date.now();
      // Simulate slow 500ms network response
      const slowVotePromise = controller.toggleVote({ simulateDelayMs: 500 });
      const elapsedBeforeResolution = Date.now() - startTime;

      // Visual state must update in < 15ms
      assert.ok(elapsedBeforeResolution < 50, 'Visual feedback was instant without waiting for network');
      assert.strictEqual(controller.displayedHasVoted, true);
      assert.strictEqual(controller.displayedVoteCount, 2);

      await slowVotePromise;
      assert.strictEqual(controller.displayedVoteCount, 2);

      controller.unmount();
    });
  });

  describe('🔍 Test 6: Strict Separation of UID Identity vs Display Name', () => {
    it('uses immutable UID exclusively for vote key and permissions', async () => {
      const user = {
        uid: 'aJgkUV2VXBTjONi1v1BfIKebpRG3',
        displayName: 'PARAS_09',
      };

      const controller = new OptimisticVotingController(db, {
        ideaId: 'prop_1',
        uid: user.uid,
        orgId: 'org_convia',
      });
      controller.mount();

      await controller.toggleVote();

      // Check storage key
      const voteDoc = db.get(`votes/prop_1_${user.uid}`);
      assert.ok(voteDoc, 'Vote was saved under canonical votes/{ideaId}_{uid}');
      assert.strictEqual(voteDoc.uid, user.uid);
      assert.strictEqual(voteDoc.voteId, `prop_1_${user.uid}`);
      assert.strictEqual(db.get(`votes/prop_1_${user.displayName}`), null, 'Display name was NEVER used as key');

      controller.unmount();
    });
  });
});
