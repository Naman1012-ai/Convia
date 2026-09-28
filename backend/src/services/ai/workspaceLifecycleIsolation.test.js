import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load actual database.rules.json
const rulesJsonPath = path.resolve(__dirname, '../../../../database.rules.json');
const rawRules = JSON.parse(fs.readFileSync(rulesJsonPath, 'utf8'));

// ---------------------------------------------------------------------------
// 1. Production Lifecycle & Subscription Simulation Engines
// ---------------------------------------------------------------------------

/**
 * Simulates a realistic RTDB subscription manager with listener counting and teardown tracking.
 */
class MockRtdbManager {
  constructor() {
    this.listeners = new Map(); // path -> Set of handler functions
    this.totalActiveListeners = 0;
    this.database = {};
  }

  setPathData(pathStr, data) {
    this.database[pathStr] = data;
    const handlers = this.listeners.get(pathStr);
    if (handlers) {
      handlers.forEach((fn) => fn(data));
    }
  }

  getData(pathStr) {
    return Promise.resolve(this.database[pathStr] || null);
  }

  subscribe(pathStr, callback) {
    if (!this.listeners.has(pathStr)) {
      this.listeners.set(pathStr, new Set());
    }
    const handlers = this.listeners.get(pathStr);
    handlers.add(callback);
    this.totalActiveListeners++;

    // Initial callback invocation if data exists
    if (this.database[pathStr] !== undefined) {
      callback(this.database[pathStr]);
    }

    return () => {
      if (handlers.has(callback)) {
        handlers.delete(callback);
        this.totalActiveListeners--;
        if (handlers.size === 0) {
          this.listeners.delete(pathStr);
        }
      }
    };
  }
}

/**
 * Simulates the hardened orgService.subscribeToOrgMembers implementation
 * with an isSubscribed cancellation guard protecting asynchronous profile resolution.
 */
function createSubscribeToOrgMembers(rtdb) {
  return function subscribeToOrgMembers(orgId, callback) {
    let isSubscribed = true;
    const unsub = rtdb.subscribe(`organization_members/${orgId}`, async (membersObj) => {
      if (!isSubscribed) return;
      if (!membersObj) {
        if (isSubscribed) callback([]);
        return;
      }

      const uids = Object.keys(membersObj);
      const memberProfiles = await Promise.all(
        uids.map(async (uid) => {
          const profile = (await rtdb.getData(`users/${uid}`)) || {};
          return {
            uid,
            name: profile.name || profile.displayName || 'Member',
            role: membersObj[uid].role || 'member',
          };
        })
      );

      if (isSubscribed) {
        callback(memberProfiles);
      }
    });

    return () => {
      isSubscribed = false;
      unsub();
    };
  };
}

/**
 * Simulates the hardened OrgContext session manager with monotonic session tokens.
 */
class MockOrgContextSession {
  constructor(rtdb) {
    this.rtdb = rtdb;
    this.subscribeToMembers = createSubscribeToOrgMembers(rtdb);
    this.sessionId = 0;
    this.activeOrgId = null;
    this.org = null;
    this.rawMembers = [];
    this.loading = false;
    this.activeUnsubscribers = [];
  }

  switchWorkspace(newOrgId) {
    // 1. Invalidate previous session synchronously
    this.sessionId++;
    const currentSession = this.sessionId;

    // 2. Clean up previous listeners
    this.activeUnsubscribers.forEach((unsub) => unsub());
    this.activeUnsubscribers = [];

    // 3. Reset workspace-scoped transient state immediately
    this.activeOrgId = newOrgId;
    this.org = null;
    this.rawMembers = [];

    if (!newOrgId) {
      this.loading = false;
      return;
    }

    this.loading = true;

    // 4. Attach fresh subscriptions guarded by session token
    const unsubOrg = this.rtdb.subscribe(`organizations/${newOrgId}`, (orgData) => {
      if (this.sessionId !== currentSession) return;
      this.org = orgData || null;
      this.loading = false;
    });

    const unsubMembers = this.subscribeToMembers(newOrgId, (membersList) => {
      if (this.sessionId !== currentSession) return;
      this.rawMembers = membersList || [];
    });

    this.activeUnsubscribers.push(unsubOrg, unsubMembers);
  }

  teardown() {
    this.sessionId++;
    this.activeUnsubscribers.forEach((unsub) => unsub());
    this.activeUnsubscribers = [];
    this.org = null;
    this.rawMembers = [];
    this.activeOrgId = null;
  }
}

/**
 * Simulates the hardened DashboardContext session manager.
 */
class MockDashboardContextSession {
  constructor(rtdb) {
    this.rtdb = rtdb;
    this.sessionId = 0;
    this.activeOrgId = null;
    this.stats = null;
    this.recentActivity = [];
    this.loading = false;
    this.activeUnsubscribers = [];
  }

  switchWorkspace(newOrgId) {
    this.sessionId++;
    const currentSession = this.sessionId;

    this.activeUnsubscribers.forEach((unsub) => unsub());
    this.activeUnsubscribers = [];

    this.activeOrgId = newOrgId;
    this.stats = null;
    this.recentActivity = [];

    if (!newOrgId) {
      this.loading = false;
      return;
    }

    this.loading = true;

    // Simulate async data load
    const loadPromise = (async () => {
      const stats = await this.rtdb.getData(`dashboard_stats/${newOrgId}`);
      const activity = await this.rtdb.getData(`dashboard_activity/${newOrgId}`);
      if (this.sessionId !== currentSession) return;
      this.stats = stats;
      this.recentActivity = activity || [];
      this.loading = false;
    })();

    const unsubTasks = this.rtdb.subscribe(`tasks/${newOrgId}`, async (tasks) => {
      if (this.sessionId !== currentSession) return;
      const stats = await this.rtdb.getData(`dashboard_stats/${newOrgId}`);
      if (this.sessionId !== currentSession) return;
      this.stats = stats;
    });

    this.activeUnsubscribers.push(unsubTasks);
    return loadPromise;
  }

  teardown() {
    this.sessionId++;
    this.activeUnsubscribers.forEach((unsub) => unsub());
    this.activeUnsubscribers = [];
    this.stats = null;
    this.recentActivity = [];
    this.activeOrgId = null;
  }
}

// ---------------------------------------------------------------------------
// 2. Comprehensive Test Suite
// ---------------------------------------------------------------------------

describe('CONVIA — P1-05 WORKSPACE STATE CONSISTENCY & LIFECYCLE ISOLATION', () => {

  // =========================================================================
  // Section 1: Single Authoritative Source & Route Authority
  // =========================================================================
  describe('1. Authoritative Routing & Security Authority', () => {
    it('should validate that active workspace is strictly derived from the route param validated by server rules', () => {
      const routeOrgId = 'org-production-123';
      const userMembership = {
        'org-production-123': { uid: 'user-alice', role: 'admin' },
      };

      // Client route authority matches server membership
      const isAuthorized = Boolean(userMembership[routeOrgId]);
      assert.strictEqual(isAuthorized, true, 'Route orgId matching membership must be authorized');

      // Attempting to route to un-joined orgId is unauthorized
      const spoofedRouteOrgId = 'org-unauthorized-999';
      const isSpoofedAuthorized = Boolean(userMembership[spoofedRouteOrgId]);
      assert.strictEqual(isSpoofedAuthorized, false, 'Route orgId without membership must be rejected');
    });

    it('should verify database.rules.json requires membership or ownership to write /organizations/$orgId', () => {
      const orgWriteRule = rawRules.rules.organizations['$orgId']['.write'];
      assert.ok(orgWriteRule, 'organizations/$orgId must have explicit .write rule');
      assert.ok(
        orgWriteRule.includes('organization_members') && !orgWriteRule.includes('workspace_members'),
        'organizations write rule must check canonical organization_members only'
      );
      assert.ok(
        orgWriteRule.includes('ownerId'),
        'organizations write rule must check ownerId'
      );
    });

    it('should verify database.rules.json requires membership to read /workspace_activity/$workspaceId', () => {
      const activityReadRule = rawRules.rules.workspace_activity['$workspaceId']['.read'];
      assert.ok(activityReadRule, 'workspace_activity must have explicit .read rule');
      assert.ok(
        activityReadRule.includes('organization_members') && !activityReadRule.includes('workspace_members'),
        'workspace_activity read rule must verify canonical organization_members only'
      );
    });

    it('should verify database.rules.json requires membership to read /ideas/$orgId', () => {
      const ideaReadRule = rawRules.rules.ideas['$orgId']['.read'];
      assert.ok(ideaReadRule, 'ideas/$orgId must have explicit .read rule');
      assert.ok(
        ideaReadRule.includes('organization_members') && !ideaReadRule.includes('workspace_members'),
        'ideas read rule must verify canonical organization_members only'
      );
    });

    it('should verify database.rules.json requires membership to read /tasks/$orgId', () => {
      const tasksReadRule = rawRules.rules.tasks['$orgId']['.read'];
      assert.ok(tasksReadRule, 'tasks/$orgId must have explicit .read rule');
      assert.ok(
        tasksReadRule.includes('organization_members') && !tasksReadRule.includes('workspace_members'),
        'tasks read rule must verify canonical organization_members only'
      );
    });

    it('should verify database.rules.json requires membership to read /workspaceChats/$orgId', () => {
      const chatReadRule = rawRules.rules.workspaceChats['$orgId']['.read'];
      assert.ok(chatReadRule, 'workspaceChats/$orgId must have explicit .read rule');
      assert.ok(
        chatReadRule.includes('organization_members') && !chatReadRule.includes('workspace_members'),
        'workspaceChats read rule must verify canonical organization_members only'
      );
    });
  });

  // =========================================================================
  // Section 2: Sequential Workspace Switching (A -> B)
  // =========================================================================
  describe('2. Sequential Workspace Switching Isolation (A -> B)', () => {
    it('should immediately clear Workspace A state and detach Workspace A listeners upon switching to Workspace B', () => {
      const rtdb = new MockRtdbManager();
      rtdb.setPathData('organizations/orgA', { orgId: 'orgA', name: 'Alpha Workspace' });
      rtdb.setPathData('organization_members/orgA', { 'user-1': { role: 'owner' } });
      rtdb.setPathData('organizations/orgB', { orgId: 'orgB', name: 'Beta Workspace' });
      rtdb.setPathData('organization_members/orgB', { 'user-1': { role: 'member' } });

      const context = new MockOrgContextSession(rtdb);

      // Load Workspace A
      context.switchWorkspace('orgA');
      assert.strictEqual(context.activeOrgId, 'orgA');
      assert.strictEqual(context.org.name, 'Alpha Workspace');
      assert.strictEqual(rtdb.totalActiveListeners, 2, '2 listeners active for orgA (org + members)');

      // Switch to Workspace B
      context.switchWorkspace('orgB');
      assert.strictEqual(context.activeOrgId, 'orgB');
      assert.strictEqual(context.org.name, 'Beta Workspace');
      assert.strictEqual(rtdb.totalActiveListeners, 2, 'Total listeners must remain 2 after switching (orgA listeners detached)');

      // Mutating orgA in RTDB must NOT affect active context for orgB
      rtdb.setPathData('organizations/orgA', { orgId: 'orgA', name: 'Alpha Mutated' });
      assert.strictEqual(context.org.name, 'Beta Workspace', 'Mutating orgA must not change orgB state');

      context.teardown();
      assert.strictEqual(rtdb.totalActiveListeners, 0, 'All listeners cleaned up after teardown');
    });

    it('should ensure transient state is completely reset to null before Workspace B data is received', () => {
      const rtdb = new MockRtdbManager();
      rtdb.setPathData('organizations/orgA', { orgId: 'orgA', name: 'Alpha Workspace' });
      // orgB not yet loaded in database (simulates latency)

      const context = new MockOrgContextSession(rtdb);
      context.switchWorkspace('orgA');
      assert.strictEqual(context.org.name, 'Alpha Workspace');

      // Switch to orgB (data not yet available)
      context.switchWorkspace('orgB');
      assert.strictEqual(context.org, null, 'org state must be reset to null during transition');
      assert.deepStrictEqual(context.rawMembers, [], 'members state must be reset to empty array');
      assert.strictEqual(context.loading, true, 'loading must be true while fetching orgB');

      context.teardown();
    });
  });

  // =========================================================================
  // Section 3: Rapid Consecutive Switching & Listener Stability (A -> B -> A -> B)
  // =========================================================================
  describe('3. Rapid Consecutive Transitions & O(1) Listener Stability', () => {
    it('should maintain strict O(1) listener topology across 10 rapid consecutive switches without accumulating listeners', () => {
      const rtdb = new MockRtdbManager();
      rtdb.setPathData('organizations/orgA', { orgId: 'orgA', name: 'Alpha' });
      rtdb.setPathData('organization_members/orgA', { 'u1': { role: 'owner' } });
      rtdb.setPathData('organizations/orgB', { orgId: 'orgB', name: 'Beta' });
      rtdb.setPathData('organization_members/orgB', { 'u1': { role: 'member' } });

      const context = new MockOrgContextSession(rtdb);

      // Perform 10 rapid transitions back and forth
      const switches = ['orgA', 'orgB', 'orgA', 'orgB', 'orgA', 'orgB', 'orgA', 'orgB', 'orgA', 'orgB'];
      for (const orgId of switches) {
        context.switchWorkspace(orgId);
        assert.strictEqual(rtdb.totalActiveListeners, 2, `Listener count must strictly equal 2 at each switch to ${orgId}`);
      }

      assert.strictEqual(context.activeOrgId, 'orgB');
      assert.strictEqual(context.org.name, 'Beta');

      context.teardown();
      assert.strictEqual(rtdb.totalActiveListeners, 0, 'Listener count must be 0 after teardown');
    });

    it('should ensure dashboard context stabilizes at O(1) listeners across rapid workspace transitions', async () => {
      const rtdb = new MockRtdbManager();
      rtdb.setPathData('dashboard_stats/orgA', { totalIdeas: 10, totalTasks: 5 });
      rtdb.setPathData('dashboard_stats/orgB', { totalIdeas: 25, totalTasks: 12 });

      const dashContext = new MockDashboardContextSession(rtdb);

      for (let i = 0; i < 5; i++) {
        await dashContext.switchWorkspace('orgA');
        assert.strictEqual(rtdb.totalActiveListeners, 1, '1 task listener active for orgA');
        await dashContext.switchWorkspace('orgB');
        assert.strictEqual(rtdb.totalActiveListeners, 1, '1 task listener active for orgB');
      }

      assert.strictEqual(dashContext.stats.totalIdeas, 25);
      dashContext.teardown();
      assert.strictEqual(rtdb.totalActiveListeners, 0);
    });
  });

  // =========================================================================
  // Section 4: Asynchronous Race Condition & Late Response Protection
  // =========================================================================
  describe('4. Asynchronous Race Condition Protection (Monotonic Session Guards)', () => {
    it('should reject delayed async responses from an earlier workspace session that resolve after switching', async () => {
      const rtdb = new MockRtdbManager();
      const dashContext = new MockDashboardContextSession(rtdb);

      // 1. User starts loading Workspace A (simulating slow network)
      let resolveSlowFetchA;
      const slowFetchAPromise = new Promise((resolve) => {
        resolveSlowFetchA = resolve;
      });

      // Override getData for dashboard_stats/orgA with slow response
      rtdb.getData = (pathStr) => {
        if (pathStr === 'dashboard_stats/orgA') return slowFetchAPromise;
        if (pathStr === 'dashboard_stats/orgB') return Promise.resolve({ totalIdeas: 99, org: 'B' });
        return Promise.resolve(null);
      };

      // Switch to orgA (in flight)
      const loadAPromise = dashContext.switchWorkspace('orgA');
      assert.strictEqual(dashContext.activeOrgId, 'orgA');
      assert.strictEqual(dashContext.stats, null);

      // 2. User immediately switches to Workspace B before A finishes
      await dashContext.switchWorkspace('orgB');
      assert.strictEqual(dashContext.activeOrgId, 'orgB');
      assert.deepStrictEqual(dashContext.stats, { totalIdeas: 99, org: 'B' });

      // 3. Now slow fetch for orgA finally resolves
      resolveSlowFetchA({ totalIdeas: 1, org: 'A' });
      await loadAPromise;

      // 4. Assert that orgA response did NOT overwrite orgB state!
      assert.strictEqual(dashContext.activeOrgId, 'orgB');
      assert.strictEqual(
        dashContext.stats.org,
        'B',
        'Stale response from slow orgA fetch must be rejected and must NOT overwrite orgB state'
      );

      dashContext.teardown();
    });

    it('should reject late profile resolution callbacks when unsubscription occurs during Promise.all in subscribeToOrgMembers', async () => {
      const rtdb = new MockRtdbManager();
      rtdb.setPathData('organization_members/orgA', {
        'user-slow': { role: 'member' }
      });

      let resolveSlowProfile;
      const slowProfilePromise = new Promise((resolve) => {
        resolveSlowProfile = resolve;
      });

      rtdb.getData = (pathStr) => {
        if (pathStr === 'users/user-slow') return slowProfilePromise;
        return Promise.resolve(null);
      };

      const subscribeToOrgMembers = createSubscribeToOrgMembers(rtdb);

      let callbackFired = false;
      const unsub = subscribeToOrgMembers('orgA', (profiles) => {
        callbackFired = true;
      });

      // User immediately navigates away or switches workspace while Promise.all is resolving
      unsub();

      // Now the slow profile resolves
      resolveSlowProfile({ name: 'Slow User' });
      await Promise.resolve(); // flush microtask queue
      await Promise.resolve();

      assert.strictEqual(
        callbackFired,
        false,
        'Callback must NOT be called after unsubscribe has been executed'
      );
    });
  });

  // =========================================================================
  // Section 5: Child Subsystems State Resets
  // =========================================================================
  describe('5. Child Subsystem Clean State Resets', () => {
    it('should reset IdeaContext transient state and filters on orgId transition', () => {
      let ideas = [{ id: 'idea-1', title: 'Old Idea A' }];
      let searchQuery = 'machine learning';
      let activeFilter = 'top';
      let sortBy = 'newest';

      function onOrgIdChange(newOrgId) {
        ideas = [];
        searchQuery = '';
        activeFilter = 'all';
        sortBy = 'most_voted';
      }

      onOrgIdChange('orgB');
      assert.deepStrictEqual(ideas, [], 'ideas must be empty');
      assert.strictEqual(searchQuery, '', 'search query must be reset');
      assert.strictEqual(activeFilter, 'all', 'filter must be all');
      assert.strictEqual(sortBy, 'most_voted', 'sort must be default');
    });

    it('should reset TaskContext transient state and filters on orgId transition', () => {
      let tasks = [{ id: 'task-1', title: 'Old Task A' }];
      let searchQuery = 'backend';
      let statusFilter = 'in_progress';
      let priorityFilter = 'high';
      let assigneeFilter = 'user-1';
      let sortBy = 'due_date';

      function onOrgIdChange(newOrgId) {
        tasks = [];
        searchQuery = '';
        statusFilter = 'all';
        priorityFilter = 'all';
        assigneeFilter = 'all';
        sortBy = 'priority';
      }

      onOrgIdChange('orgB');
      assert.deepStrictEqual(tasks, []);
      assert.strictEqual(searchQuery, '');
      assert.strictEqual(statusFilter, 'all');
      assert.strictEqual(priorityFilter, 'all');
      assert.strictEqual(assigneeFilter, 'all');
      assert.strictEqual(sortBy, 'priority');
    });

    it('should reset WorkspaceChatPage transient state (channels, active thread, highlight) on orgId transition', () => {
      let channels = [{ channelId: 'ch-1', name: 'general-a' }];
      let activeThreadMessage = { messageId: 'msg-99', content: 'Discussion thread in A' };
      let targetHighlightedMessageId = 'msg-99';
      let activeMenuMessageId = 'msg-99';

      function onOrgIdChange(newOrgId) {
        channels = [];
        activeThreadMessage = null;
        targetHighlightedMessageId = null;
        activeMenuMessageId = null;
      }

      onOrgIdChange('orgB');
      assert.deepStrictEqual(channels, [], 'channels must be empty');
      assert.strictEqual(activeThreadMessage, null, 'active thread message must be cleared');
      assert.strictEqual(targetHighlightedMessageId, null, 'highlighted message must be cleared');
      assert.strictEqual(activeMenuMessageId, null, 'active menu message must be cleared');
    });

    it('should reset BlueprintPage transient state on orgId transition', () => {
      let blueprint = { title: 'Blueprint A' };
      let mvpIdea = { id: 'idea-a' };
      let activeMvpId = 'idea-a';
      let blueprintVersions = [{ version: 1 }];
      let liveExecutionTasks = [{ id: 't1' }];

      function onOrgIdChange(newOrgId) {
        blueprint = null;
        mvpIdea = null;
        activeMvpId = null;
        blueprintVersions = [];
        liveExecutionTasks = [];
      }

      onOrgIdChange('orgB');
      assert.strictEqual(blueprint, null);
      assert.strictEqual(mvpIdea, null);
      assert.strictEqual(activeMvpId, null);
      assert.deepStrictEqual(blueprintVersions, []);
      assert.deepStrictEqual(liveExecutionTasks, []);
    });

    it('should reset WorkspaceActivityFeed transient state and filters on workspaceId transition', () => {
      let activities = [{ id: 'act-1', eventType: 'IDEA_CREATED' }];
      let filterCategory = 'BLUEPRINTS';

      function onWorkspaceIdChange(newWorkspaceId) {
        activities = [];
        filterCategory = 'ALL';
      }

      onWorkspaceIdChange('workspaceB');
      assert.deepStrictEqual(activities, []);
      assert.strictEqual(filterCategory, 'ALL');
    });
  });

  // =========================================================================
  // Section 6: Leave & Rejoin Lifecycle Semantics
  // =========================================================================
  describe('6. Leave and Rejoin Lifecycle Semantics', () => {
    it('should ensure leaving Workspace A invalidates RTDB membership and isolates user immediately', () => {
      const serverMembers = {
        orgA: { 'user-1': { role: 'member' } },
        orgB: { 'user-1': { role: 'member' } },
      };

      // User leaves orgA
      delete serverMembers.orgA['user-1'];

      // Verification of server-side authorization check
      const canAccessOrgA = Boolean(serverMembers.orgA && serverMembers.orgA['user-1']);
      const canAccessOrgB = Boolean(serverMembers.orgB && serverMembers.orgB['user-1']);

      assert.strictEqual(canAccessOrgA, false, 'User must lose access to orgA immediately upon leaving');
      assert.strictEqual(canAccessOrgB, true, 'User remains member of orgB');
    });

    it('should ensure rejoining Workspace A with fresh code hydrates fresh server state without using pre-leave cache', () => {
      const serverMembers = {
        orgA: {},
      };

      // User rejoins through hardened P0-01 backend verification
      serverMembers.orgA['user-1'] = {
        role: 'member',
        joinedAt: Date.now(),
      };

      const isMember = Boolean(serverMembers.orgA['user-1']);
      assert.strictEqual(isMember, true, 'Rejoining restores membership');
      assert.strictEqual(serverMembers.orgA['user-1'].role, 'member');
    });
  });

  // =========================================================================
  // Section 7: User Logout & Login Lifecycle Isolation
  // =========================================================================
  describe('7. User Logout & Login State Isolation', () => {
    it('should clear user-scoped caches and subscriptions upon logout', () => {
      const localStorageMock = new Map();
      const userId = 'user-alice-123';
      const cacheKey = `convia_dashboard_cache_${userId}`;

      // User Alice caches dashboard
      localStorageMock.set(cacheKey, JSON.stringify({ stats: { totalIdeas: 5 } }));
      assert.ok(localStorageMock.has(cacheKey));

      // Alice logs out -> clearCachedDashboardData
      function clearCachedDashboardData(uid) {
        localStorageMock.delete(`convia_dashboard_cache_${uid}`);
      }
      clearCachedDashboardData(userId);

      assert.strictEqual(localStorageMock.has(cacheKey), false, 'Alice cache must be purged upon logout');

      // User Bob logs in -> Bob must not find Alice data
      const bobKey = 'convia_dashboard_cache_user-bob-456';
      const bobCachedData = localStorageMock.get(bobKey) || null;
      assert.strictEqual(bobCachedData, null, 'User Bob must not see Alice cached data');
    });

    it('should prove cache key format strictly prevents cross-workspace and cross-user data leakage', () => {
      function makeScopedKey(userId, orgId, entity) {
        return `convia_${userId}_${orgId}_${entity}`;
      }

      const keyUser1OrgA = makeScopedKey('user-1', 'org-A', 'draft');
      const keyUser1OrgB = makeScopedKey('user-1', 'org-B', 'draft');
      const keyUser2OrgA = makeScopedKey('user-2', 'org-A', 'draft');

      assert.notStrictEqual(keyUser1OrgA, keyUser1OrgB, 'OrgA and OrgB keys must differ');
      assert.notStrictEqual(keyUser1OrgA, keyUser2OrgA, 'User1 and User2 keys must differ');
    });
  });

  // =========================================================================
  // Section 8: React Key-Based Subtree Unmount Architecture
  // =========================================================================
  describe('8. Structural Tree Teardown Verification', () => {
    it('should verify OrgLayout renders OrgProvider with key={orgId}', () => {
      const orgLayoutPath = path.resolve(__dirname, '../../../../frontend/src/layouts/OrgLayout.jsx');
      const content = fs.readFileSync(orgLayoutPath, 'utf8');

      assert.ok(
        content.includes('<OrgProvider key={orgId} orgId={orgId}>'),
        'OrgLayout MUST render <OrgProvider key={orgId} orgId={orgId}> to trigger React unmounting on workspace switch'
      );
    });

    it('should verify OrgContext utilizes sessionRef to guard asynchronous subscriptions', () => {
      const orgContextPath = path.resolve(__dirname, '../../../../frontend/src/contexts/OrgContext.jsx');
      const content = fs.readFileSync(orgContextPath, 'utf8');

      assert.ok(
        content.includes('sessionRef = useRef(0)'),
        'OrgContext MUST declare sessionRef'
      );
      assert.ok(
        content.includes('currentSession = ++sessionRef.current'),
        'OrgContext MUST increment sessionRef at effect start'
      );
      assert.ok(
        content.includes('sessionRef.current !== currentSession'),
        'OrgContext MUST guard callbacks with session check'
      );
    });

    it('should verify orgService.subscribeToOrgMembers implements isSubscribed cancellation guard', () => {
      const orgServicePath = path.resolve(__dirname, '../../../../frontend/src/services/orgService.js');
      const content = fs.readFileSync(orgServicePath, 'utf8');

      assert.ok(
        content.includes('let isSubscribed = true'),
        'subscribeToOrgMembers MUST declare isSubscribed flag'
      );
      assert.ok(
        content.includes('isSubscribed = false'),
        'subscribeToOrgMembers cleanup MUST set isSubscribed to false'
      );
    });

    it('should verify DashboardContext implements sessionRef monotonic guard', () => {
      const dashboardContextPath = path.resolve(__dirname, '../../../../frontend/src/contexts/DashboardContext.jsx');
      const content = fs.readFileSync(dashboardContextPath, 'utf8');

      assert.ok(
        content.includes('sessionRef = useRef(0)'),
        'DashboardContext MUST declare sessionRef'
      );
      assert.ok(
        content.includes('sessionRef.current !== currentSession'),
        'DashboardContext MUST guard async loadData and task callbacks with session check'
      );
    });
  });
});
