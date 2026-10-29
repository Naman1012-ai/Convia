import test from 'node:test';
import assert from 'node:assert/strict';

// Helper mimicking taskRoutes role checking logic
function checkPrivilegedRole(membership) {
  const role = String(membership?.role || '').toLowerCase();
  return role === 'owner' || role === 'captain' || role === 'admin';
}

function canModifyTask({ membership }) {
  return checkPrivilegedRole(membership);
}

function canCreateTask({ membership }) {
  return checkPrivilegedRole(membership);
}

function canDeleteTask({ membership }) {
  return checkPrivilegedRole(membership);
}

function canDeleteProposal({ isLeader, isAuthor, isSelectedMvp, isFrozen }) {
  if (isFrozen) return false;
  if (isLeader) return true;
  if (isAuthor && !isSelectedMvp) return true;
  return false;
}

test('Workspace Governance RBAC Suite', async (t) => {
  await t.test('1.1: Leaders (owner, captain, admin) are granted privileged governance roles', () => {
    assert.strictEqual(checkPrivilegedRole({ role: 'owner' }), true);
    assert.strictEqual(checkPrivilegedRole({ role: 'captain' }), true);
    assert.strictEqual(checkPrivilegedRole({ role: 'admin' }), true);
  });

  await t.test('1.2: Regular members are strictly denied privileged governance roles', () => {
    assert.strictEqual(checkPrivilegedRole({ role: 'member' }), false);
    assert.strictEqual(checkPrivilegedRole({ role: 'contributor' }), false);
    assert.strictEqual(checkPrivilegedRole({ role: 'guest' }), false);
    assert.strictEqual(checkPrivilegedRole({}), false);
    assert.strictEqual(checkPrivilegedRole(null), false);
  });

  await t.test('1.3: Task modification is restricted strictly to leaders', () => {
    const memberContext = { membership: { role: 'member' } };
    const captainContext = { membership: { role: 'captain' } };
    const ownerContext = { membership: { role: 'owner' } };

    assert.strictEqual(canModifyTask(memberContext), false);
    assert.strictEqual(canModifyTask(captainContext), true);
    assert.strictEqual(canModifyTask(ownerContext), true);
  });

  await t.test('1.4: Task creation is restricted strictly to leaders', () => {
    const memberContext = { membership: { role: 'member' } };
    const captainContext = { membership: { role: 'captain' } };

    assert.strictEqual(canCreateTask(memberContext), false);
    assert.strictEqual(canCreateTask(captainContext), true);
  });

  await t.test('1.5: Task deletion is restricted strictly to leaders', () => {
    const memberContext = { membership: { role: 'member' } };
    const captainContext = { membership: { role: 'captain' } };

    assert.strictEqual(canDeleteTask(memberContext), false);
    assert.strictEqual(canDeleteTask(captainContext), true);
  });

  await t.test('1.6: Authors can delete standard proposals, but cannot delete selected MVP proposals', () => {
    // Normal proposal authored by member:
    assert.strictEqual(canDeleteProposal({ isLeader: false, isAuthor: true, isSelectedMvp: false, isFrozen: false }), true);

    // Winning MVP proposal authored by member: CANNOT delete (prevents workspace wipeout)
    assert.strictEqual(canDeleteProposal({ isLeader: false, isAuthor: true, isSelectedMvp: true, isFrozen: false }), false);

    // Leader can manage/delete if needed:
    assert.strictEqual(canDeleteProposal({ isLeader: true, isAuthor: false, isSelectedMvp: true, isFrozen: false }), true);

    // Frozen workspace blocks deletions:
    assert.strictEqual(canDeleteProposal({ isLeader: true, isAuthor: true, isSelectedMvp: false, isFrozen: true }), false);
  });
});
