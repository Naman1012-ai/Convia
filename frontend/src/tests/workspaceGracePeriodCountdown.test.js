import { describe, it } from 'node:test';
import assert from 'node:assert';

export const getCountdownLabel = (scheduledDeletionAt, currentNow = Date.now()) => {
  if (!scheduledDeletionAt) return 'Scheduled for deletion';
  const msLeft = scheduledDeletionAt - currentNow;
  if (msLeft <= 0) return 'Deleting permanently...';

  const oneDayMs = 24 * 60 * 60 * 1000;
  const oneHourMs = 60 * 60 * 1000;

  if (msLeft > oneDayMs) {
    const days = Math.ceil(msLeft / oneDayMs);
    return `Deletes permanently in ${days} days`;
  }

  const hours = Math.ceil(msLeft / oneHourMs);
  if (hours > 1) {
    return `Deletes permanently in ${hours} hours`;
  }
  return `Deletes permanently in less than an hour`;
};

export const filterPendingWorkspaces = (organizations, currentNow = Date.now(), onExpiredPurge = () => {}) => {
  return organizations.filter((org) => {
    if (!org.isDeleted) return false;
    if (org.scheduledDeletionAt && currentNow >= org.scheduledDeletionAt) {
      onExpiredPurge(org.orgId);
      return false;
    }
    return true;
  });
};

describe('Workspace Grace Period Countdown & Filter Suite', () => {
  const baseTime = 1700000000000;

  it('1. Correctly formats countdown for multi-day grace period (> 1 day)', () => {
    // 7 days left
    const sevenDays = baseTime + 7 * 24 * 60 * 60 * 1000;
    assert.strictEqual(getCountdownLabel(sevenDays, baseTime), 'Deletes permanently in 7 days');

    // 2 days left
    const twoDays = baseTime + 2 * 24 * 60 * 60 * 1000;
    assert.strictEqual(getCountdownLabel(twoDays, baseTime), 'Deletes permanently in 2 days');

    // 1.5 days left (36 hours) -> rounds up to 2 days
    const oneAndHalfDays = baseTime + 36 * 60 * 60 * 1000;
    assert.strictEqual(getCountdownLabel(oneAndHalfDays, baseTime), 'Deletes permanently in 2 days');
  });

  it('2. Correctly formats countdown for sub-day grace period (< 24 hours)', () => {
    // 23 hours left
    const twentyThreeHours = baseTime + 23 * 60 * 60 * 1000;
    assert.strictEqual(getCountdownLabel(twentyThreeHours, baseTime), 'Deletes permanently in 23 hours');

    // 5 hours left
    const fiveHours = baseTime + 5 * 60 * 60 * 1000;
    assert.strictEqual(getCountdownLabel(fiveHours, baseTime), 'Deletes permanently in 5 hours');

    // 2 hours left
    const twoHours = baseTime + 2 * 60 * 60 * 1000;
    assert.strictEqual(getCountdownLabel(twoHours, baseTime), 'Deletes permanently in 2 hours');

    // 45 minutes left
    const fortyFiveMinutes = baseTime + 45 * 60 * 1000;
    assert.strictEqual(getCountdownLabel(fortyFiveMinutes, baseTime), 'Deletes permanently in less than an hour');
  });

  it('3. Correctly formats countdown for expired states (never stuck at 1 day)', () => {
    // Exactly at expiration
    assert.strictEqual(getCountdownLabel(baseTime, baseTime), 'Deleting permanently...');

    // Past expiration by 1 hour
    assert.strictEqual(getCountdownLabel(baseTime - 3600000, baseTime), 'Deleting permanently...');

    // Past expiration by 2 days
    assert.strictEqual(getCountdownLabel(baseTime - 172800000, baseTime), 'Deleting permanently...');
  });

  it('4. Filters expired workspaces and invokes purge callback', () => {
    const purged = [];
    const testOrgs = [
      { orgId: 'org_active', name: 'Active Org', isDeleted: false },
      { orgId: 'org_in_grace', name: 'In Grace Org', isDeleted: true, scheduledDeletionAt: baseTime + 86400000 },
      { orgId: 'org_expired', name: 'Expired Org', isDeleted: true, scheduledDeletionAt: baseTime - 1000 },
    ];

    const pending = filterPendingWorkspaces(testOrgs, baseTime, (id) => purged.push(id));

    assert.strictEqual(pending.length, 1);
    assert.strictEqual(pending[0].orgId, 'org_in_grace');
    assert.deepStrictEqual(purged, ['org_expired']);
  });
});
