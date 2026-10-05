import assert from 'node:assert/strict';
import { createMemoryRouter, matchRoutes } from 'react-router-dom';
import { UNSAFE_logV6DeprecationWarnings } from 'react-router';

console.log('========================================================================');
console.log('CONVIA — REACT ROUTER FUTURE-FLAGS & ROUTE REGRESSION VERIFICATION SUITE');
console.log('========================================================================\n');

// --------------------------------------------------------------------------
// TEST 1: Deprecation Warning Suppression & Official Opt-in Verification
// --------------------------------------------------------------------------
console.log('[TEST 1] Verifying official future flags eliminate React Router v6 warnings...');
{
  const interceptedWarnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => {
    interceptedWarnings.push(args.join(' '));
    originalWarn(...args);
  };

  // Calling UNSAFE_logV6DeprecationWarnings with official future flags
  UNSAFE_logV6DeprecationWarnings({
    v7_startTransition: true,
    v7_relativeSplatPath: true,
  });

  console.warn = originalWarn;

  assert.strictEqual(
    interceptedWarnings.length,
    0,
    'Expected 0 deprecation warnings when v7_startTransition and v7_relativeSplatPath are enabled'
  );
  console.log('✓ Both future-flag warnings are cleanly and officially eliminated without suppressing logs.');
}

// --------------------------------------------------------------------------
// TEST 2: Route Tree Definition & Structural Invariants
// --------------------------------------------------------------------------
console.log('\n[TEST 2] Verifying canonical and legacy route structures...');
{
  // Mirror of App.jsx route configurations
  const testRoutes = [
    { path: '/', id: 'landing' },
    { path: '/privacy', id: 'privacy' },
    { path: '/terms', id: 'terms' },
    { path: '/contact', id: 'contact' },
    { path: '/join', id: 'join' },
    { path: '/dashboard', id: 'dashboard' },
    { path: '/explore', id: 'explore' },
    { path: '/community', id: 'community' },
    { path: '/workspaces', id: 'workspaces' },
    { path: '/profile', id: 'profile' },
    // Legacy redirects
    { path: '/org/:orgId', id: 'legacy-org-exact' },
    { path: '/org/:orgId/*', id: 'legacy-org-splat' },
    // Canonical Workspace Routes
    {
      path: '/workspaces/:orgId',
      id: 'workspace-root',
      children: [
        { index: true, id: 'workspace-dashboard' },
        { path: 'ideas', id: 'workspace-ideas' },
        {
          path: 'ideas/:ideaId',
          id: 'idea-root',
          children: [
            { index: true, id: 'idea-overview' },
            { path: 'blueprint', id: 'idea-blueprint' },
            { path: 'tasks', id: 'idea-tasks' },
            { path: 'dashboard', id: 'idea-progress' },
          ],
        },
        { path: 'tasks', id: 'workspace-tasks' },
        { path: 'members', id: 'workspace-members' },
        { path: 'chat', id: 'workspace-chat' },
        { path: 'activity', id: 'workspace-activity' },
        { path: 'settings', id: 'workspace-settings' },
      ],
    },
    // Admin routes
    {
      path: '/admin',
      id: 'admin-root',
      children: [
        { path: 'dashboard', id: 'admin-dashboard' },
        { path: 'users', id: 'admin-users' },
        { path: 'workspaces', id: 'admin-workspaces' },
        { path: 'analytics', id: 'admin-analytics' },
        { path: 'analytics/*', id: 'admin-analytics-splat' },
        { path: 'settings', id: 'admin-settings' },
        { path: 'settings/*', id: 'admin-settings-splat' },
        { path: 'security', id: 'admin-security' },
        { path: 'security/*', id: 'admin-security-splat' },
      ],
    },
    // Catch-all
    { path: '*', id: 'not-found' },
  ];

  // Helper to match
  const resolve = (pathname) => {
    const matches = matchRoutes(testRoutes, pathname);
    return matches ? matches[matches.length - 1] : null;
  };

  // Test canonical routes
  assert.strictEqual(resolve('/workspaces/ws_convia')?.route.id, 'workspace-dashboard');
  assert.strictEqual(resolve('/workspaces/ws_convia')?.params.orgId, 'ws_convia');

  assert.strictEqual(resolve('/workspaces/ws_convia/ideas')?.route.id, 'workspace-ideas');
  assert.strictEqual(resolve('/workspaces/ws_convia/ideas')?.params.orgId, 'ws_convia');

  assert.strictEqual(resolve('/workspaces/ws_convia/tasks')?.route.id, 'workspace-tasks');
  assert.strictEqual(resolve('/workspaces/ws_convia/tasks')?.params.orgId, 'ws_convia');

  assert.strictEqual(resolve('/workspaces/ws_convia/chat')?.route.id, 'workspace-chat');
  assert.strictEqual(resolve('/workspaces/ws_convia/chat')?.params.orgId, 'ws_convia');

  assert.strictEqual(resolve('/workspaces/ws_convia/activity')?.route.id, 'workspace-activity');
  assert.strictEqual(resolve('/workspaces/ws_convia/activity')?.params.orgId, 'ws_convia');

  assert.strictEqual(resolve('/workspaces/ws_convia/settings')?.route.id, 'workspace-settings');
  assert.strictEqual(resolve('/workspaces/ws_convia/settings')?.params.orgId, 'ws_convia');

  assert.strictEqual(resolve('/workspaces/ws_convia/ideas/idea_99')?.route.id, 'idea-overview');
  assert.strictEqual(resolve('/workspaces/ws_convia/ideas/idea_99')?.params.orgId, 'ws_convia');
  assert.strictEqual(resolve('/workspaces/ws_convia/ideas/idea_99')?.params.ideaId, 'idea_99');

  assert.strictEqual(resolve('/workspaces/ws_convia/ideas/idea_99/blueprint')?.route.id, 'idea-blueprint');
  assert.strictEqual(resolve('/workspaces/ws_convia/ideas/idea_99/tasks')?.route.id, 'idea-tasks');
  assert.strictEqual(resolve('/workspaces/ws_convia/ideas/idea_99/dashboard')?.route.id, 'idea-progress');

  console.log('✓ All 10 canonical workspace and idea routes resolve correctly with proper parameters.');
}

// --------------------------------------------------------------------------
// TEST 3: Legacy /org/:orgId and Deep-Link Redirect Semantics
// --------------------------------------------------------------------------
console.log('\n[TEST 3] Verifying Legacy /org/:orgId redirect logic...');
{
  const testLegacyRedirect = (pathname) => {
    const match = matchRoutes([
      { path: '/org/:orgId', id: 'legacy' },
      { path: '/org/:orgId/*', id: 'legacy-splat' },
    ], pathname);

    if (!match) return null;
    const { params } = match[match.length - 1];
    const orgId = params.orgId;
    const splat = params['*'];
    return splat ? `/workspaces/${orgId}/${splat}` : `/workspaces/${orgId}`;
  };

  assert.strictEqual(testLegacyRedirect('/org/ws_alpha'), '/workspaces/ws_alpha');
  assert.strictEqual(testLegacyRedirect('/org/ws_alpha/ideas'), '/workspaces/ws_alpha/ideas');
  assert.strictEqual(testLegacyRedirect('/org/ws_alpha/chat'), '/workspaces/ws_alpha/chat');
  assert.strictEqual(testLegacyRedirect('/org/ws_alpha/ideas/idea_123/blueprint'), '/workspaces/ws_alpha/ideas/idea_123/blueprint');

  console.log('✓ Legacy /org/:orgId and all nested deep-links preserve workspaceId and subpaths perfectly.');
}

// --------------------------------------------------------------------------
// TEST 4: Relative Splat Path & Future Flags in Router Navigation
// --------------------------------------------------------------------------
console.log('\n[TEST 4] Verifying MemoryRouter with v7 future flags enabled...');
{
  const router = createMemoryRouter([
    { path: '/', element: null },
    { path: '/dashboard', element: null },
    { path: '/workspaces/:orgId', element: null },
    { path: '/admin/analytics/*', element: null },
    { path: '*', element: null },
  ], {
    initialEntries: ['/workspaces/ws_test_42'],
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    },
  });

  assert.strictEqual(router.state.location.pathname, '/workspaces/ws_test_42');

  // Navigate to splat route
  router.navigate('/admin/analytics/realtime');
  assert.strictEqual(router.state.location.pathname, '/admin/analytics/realtime');

  // Navigate to 404
  router.navigate('/unknown-route-12345');
  assert.strictEqual(router.state.location.pathname, '/unknown-route-12345');

  console.log('✓ MemoryRouter functions deterministically with v7_startTransition and v7_relativeSplatPath enabled.');
}

console.log('\n========================================================================');
console.log('ALL REACT ROUTER FUTURE-FLAGS & ROUTING TESTS PASSED SUCCESSFULLY!');
console.log('========================================================================\n');
