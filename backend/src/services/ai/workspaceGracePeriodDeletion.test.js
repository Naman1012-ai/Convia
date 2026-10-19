import { describe, it } from 'node:test';
import assert from 'node:assert';
import { workspaceDeletionService } from '../workspaceDeletionService.js';
import { rtdbService } from '../rtdbService.js';

describe('Authoritative Workspace Grace Period & Cascade Deletion Suite', () => {
  it('1. deleteWorkspaceCascade removes all core workspace trees, members, ideas, and cleans user profiles', async () => {
    const mockDb = new Map();
    const removedPaths = [];
    const updatedPaths = [];

    const originalGetData = rtdbService.getData;
    const originalRemoveData = rtdbService.removeData;
    const originalUpdateData = rtdbService.updateData;

    try {
      mockDb.set('organizations/ws_test_cascade', {
        orgId: 'ws_test_cascade',
        name: 'Test Cascade Purge',
        inviteCode: 'TEST1234',
        isDeleted: true,
        scheduledDeletionAt: Date.now() - 1000,
      });

      mockDb.set('organization_members/ws_test_cascade', {
        user_alpha: { uid: 'user_alpha', role: 'owner' },
        user_beta: { uid: 'user_beta', role: 'member' },
      });

      mockDb.set('ideas/ws_test_cascade', {
        idea_1: { ideaId: 'idea_1', title: 'Idea 1' },
      });

      mockDb.set('users/user_alpha', {
        uid: 'user_alpha',
        name: 'Alpha',
        organizationId: 'ws_test_cascade',
      });

      mockDb.set('users/user_beta', {
        uid: 'user_beta',
        name: 'Beta',
        organizationId: 'ws_test_cascade',
      });

      rtdbService.getData = async (path) => mockDb.get(path) || null;
      rtdbService.removeData = async (path) => {
        removedPaths.push(path);
        mockDb.delete(path);
        return true;
      };
      rtdbService.updateData = async (path, updates) => {
        updatedPaths.push({ path, updates });
        const existing = mockDb.get(path) || {};
        mockDb.set(path, { ...existing, ...updates });
        return true;
      };

      const result = await workspaceDeletionService.deleteWorkspaceCascade('ws_test_cascade');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.workspaceId, 'ws_test_cascade');

      // Verify all required paths were removed
      const expectedRemovals = [
        'organizations/ws_test_cascade',
        'workspaces/ws_test_cascade',
        'organization_members/ws_test_cascade',
        'blueprints/ws_test_cascade',
        'tasks/ws_test_cascade',
        'ideas/ws_test_cascade',
        'discussions/ws_test_cascade',
        'workspaceChats/ws_test_cascade',
        'workspace_activity/ws_test_cascade',
        'invite_codes/TEST1234',
      ];

      for (const expected of expectedRemovals) {
        assert.ok(
          removedPaths.includes(expected),
          `Expected path ${expected} to be removed, but got: ${JSON.stringify(removedPaths)}`
        );
      }

      // Verify user profiles were reset
      assert.strictEqual(mockDb.get('users/user_alpha').organizationId, null);
      assert.strictEqual(mockDb.get('users/user_beta').organizationId, null);
    } finally {
      rtdbService.getData = originalGetData;
      rtdbService.removeData = originalRemoveData;
      rtdbService.updateData = originalUpdateData;
    }
  });

  it('2. purgeExpiredWorkspaces sweeps and purges only expired workspaces', async () => {
    const mockOrgs = {
      ws_active: {
        orgId: 'ws_active',
        name: 'Active Workspace',
        isDeleted: false,
      },
      ws_in_grace: {
        orgId: 'ws_in_grace',
        name: 'In Grace Workspace',
        isDeleted: true,
        scheduledDeletionAt: Date.now() + 5 * 24 * 60 * 60 * 1000, // 5 days left
      },
      ws_expired_1: {
        orgId: 'ws_expired_1',
        name: 'Expired Workspace 1',
        isDeleted: true,
        scheduledDeletionAt: Date.now() - 1000, // Expired 1 second ago
      },
      ws_expired_2: {
        orgId: 'ws_expired_2',
        name: 'Expired Workspace 2',
        isDeleted: true,
        scheduledDeletionAt: Date.now() - 24 * 60 * 60 * 1000, // Expired 1 day ago
      },
    };

    const originalGetData = rtdbService.getData;
    const originalCascade = workspaceDeletionService.deleteWorkspaceCascade;
    const purgedIds = [];

    try {
      rtdbService.getData = async (path) => {
        if (path === 'organizations') return mockOrgs;
        return null;
      };

      workspaceDeletionService.deleteWorkspaceCascade = async (id) => {
        purgedIds.push(id);
        return { success: true, workspaceId: id };
      };

      const result = await workspaceDeletionService.purgeExpiredWorkspaces();

      assert.strictEqual(result.purgedCount, 2);
      assert.deepStrictEqual(result.purgedWorkspaces, ['ws_expired_1', 'ws_expired_2']);
      assert.strictEqual(purgedIds.includes('ws_active'), false);
      assert.strictEqual(purgedIds.includes('ws_in_grace'), false);
    } finally {
      rtdbService.getData = originalGetData;
      workspaceDeletionService.deleteWorkspaceCascade = originalCascade;
    }
  });
});
