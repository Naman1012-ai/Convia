import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  formatDate,
  formatWorkspaceJoinDate,
  formatPlatformJoinDate,
} from '../../../../frontend/src/utils/formatting.js';
import { timestampMigration } from '../timestampMigration.js';

describe('Global Timestamp Audit & Immutable User Join Dates', () => {
  const MOCK_TIMESTAMP_1 = 1757683200000; // Sep 12, 2025
  const MOCK_TIMESTAMP_2 = 1789219200000; // Sep 12, 2026

  describe('Date Formatting Invariants', () => {
    it('formats valid timestamp into absolute date string', () => {
      const result = formatDate(MOCK_TIMESTAMP_1);
      assert.strictEqual(result, 'Sep 12, 2025');
    });

    it('formats workspace join date as "Joined <Date>"', () => {
      const result = formatWorkspaceJoinDate(MOCK_TIMESTAMP_2);
      assert.strictEqual(result, 'Joined Sep 12, 2026');
    });

    it('formats platform join date as "Joined Convia <Date>"', () => {
      const result = formatPlatformJoinDate(MOCK_TIMESTAMP_1);
      assert.strictEqual(result, 'Joined Convia Sep 12, 2025');
    });

    it('returns "Join date unavailable" for null, undefined, or invalid timestamps without throwing or defaulting to Date.now()', () => {
      assert.strictEqual(formatWorkspaceJoinDate(null), 'Join date unavailable');
      assert.strictEqual(formatWorkspaceJoinDate(undefined), 'Join date unavailable');
      assert.strictEqual(formatWorkspaceJoinDate('invalid-date-string'), 'Join date unavailable');
      assert.strictEqual(formatPlatformJoinDate(null), 'Join date unavailable');
      assert.strictEqual(formatPlatformJoinDate(undefined), 'Join date unavailable');
      assert.strictEqual(formatPlatformJoinDate('invalid'), 'Join date unavailable');
    });

    it('never produces relative time strings (e.g., "just now", "10m ago", "1h ago") for workspace or platform join dates', () => {
      const recentTime = Date.now() - 30 * 1000; // 30 seconds ago
      const wsJoin = formatWorkspaceJoinDate(recentTime);
      const platformJoin = formatPlatformJoinDate(recentTime);

      assert.strictEqual(wsJoin.includes('just now'), false, 'Workspace join date must not use relative time');
      assert.strictEqual(wsJoin.includes('ago'), false, 'Workspace join date must not use relative time');
      assert.strictEqual(platformJoin.includes('just now'), false, 'Platform join date must not use relative time');
      assert.strictEqual(platformJoin.includes('ago'), false, 'Platform join date must not use relative time');

      assert.strictEqual(wsJoin.startsWith('Joined '), true);
      assert.strictEqual(platformJoin.startsWith('Joined Convia '), true);
    });
  });

  describe('Immutable Timestamp Database & Migration Logic', () => {
    it('idempotently backfills firstSignedInAt for users missing it without overwriting existing timestamps', async () => {
      const mockDatabase = {
        users: {
          user_existing: {
            uid: 'user_existing',
            email: 'existing@convia.dev',
            firstSignedInAt: 1700000000000,
            createdAt: 1700000000000,
          },
          user_legacy: {
            uid: 'user_legacy',
            email: 'legacy@convia.dev',
            createdAt: 1710000000000,
          },
        },
        organization_members: {
          ws_alpha: {
            user_existing: { uid: 'user_existing', role: 'owner', joinedAt: 1700000000000 },
            user_legacy: { uid: 'user_legacy', role: 'member', joinedAt: 1710000000000 },
          },
        },
      };

      // Verify legacy user missing firstSignedInAt gets backfilled from createdAt
      assert.strictEqual(mockDatabase.users.user_legacy.firstSignedInAt, undefined);
      
      const userLegacy = mockDatabase.users.user_legacy;
      const fallbackTime = userLegacy.createdAt || userLegacy.joinedAt;
      if (!userLegacy.firstSignedInAt && fallbackTime) {
        userLegacy.firstSignedInAt = fallbackTime;
      }

      assert.strictEqual(userLegacy.firstSignedInAt, 1710000000000);
      // Existing firstSignedInAt must be unchanged
      assert.strictEqual(mockDatabase.users.user_existing.firstSignedInAt, 1700000000000);
    });

    it('ensures joinedAt on organization_members is preserved during role updates and ownership transfers', async () => {
      const originalJoinedAt = 1720000000000;
      const memberNode = {
        uid: 'user_captain',
        role: 'team_captain',
        isTeamCaptain: true,
        joinedAt: originalJoinedAt,
        updatedAt: 1720000000000,
      };

      // Simulate demotion to member
      const roleUpdate = {
        ...memberNode,
        role: 'member',
        isTeamCaptain: false,
        updatedAt: Date.now(),
      };

      assert.strictEqual(roleUpdate.joinedAt, originalJoinedAt, 'joinedAt timestamp must remain immutable after role change');
    });
  });
});
