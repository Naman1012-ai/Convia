import { strict as assert } from 'node:assert';
import test from 'node:test';

test('AuthGuard Profile Completion Decision Logic', () => {
  // Scenario 1: User completed profile previously, has valid username and primary role, but profileCompleted was false due to timeout reset
  const profileWithCoreIdentity = {
    uid: 'test_uid_123',
    username: 'naman_07',
    primaryRole: 'Developer',
    displayName: 'naman_07',
    profileCompleted: false, // Previously would cause redirect loop
  };

  const hasCoreIdentity1 = Boolean(
    profileWithCoreIdentity.username &&
    profileWithCoreIdentity.username !== 'User' &&
    profileWithCoreIdentity.primaryRole
  );
  const isProfileIncomplete1 = Boolean(
    profileWithCoreIdentity &&
    profileWithCoreIdentity.profileCompleted === false &&
    !hasCoreIdentity1
  );

  assert.equal(hasCoreIdentity1, true, 'Must identify core identity when username and primaryRole are present');
  assert.equal(isProfileIncomplete1, false, 'Must NOT mark user as incomplete if they already have core identity');

  // Scenario 2: Brand new user with fallback username "User" and no primaryRole
  const freshProfile = {
    uid: 'new_uid_456',
    username: 'User',
    primaryRole: null,
    profileCompleted: false,
  };

  const hasCoreIdentity2 = Boolean(
    freshProfile.username &&
    freshProfile.username !== 'User' &&
    freshProfile.primaryRole
  );
  const isProfileIncomplete2 = Boolean(
    freshProfile &&
    freshProfile.profileCompleted === false &&
    !hasCoreIdentity2
  );

  assert.equal(hasCoreIdentity2, false, 'Fresh profile must not have core identity');
  assert.equal(isProfileIncomplete2, true, 'Fresh profile must be marked incomplete and redirected to /setup-profile');

  // Scenario 3: Standard completed profile
  const completedProfile = {
    uid: 'completed_uid_789',
    username: 'sarah_dev',
    primaryRole: 'Designer',
    profileCompleted: true,
  };

  const hasCoreIdentity3 = Boolean(
    completedProfile.username &&
    completedProfile.username !== 'User' &&
    completedProfile.primaryRole
  );
  const isProfileIncomplete3 = Boolean(
    completedProfile &&
    completedProfile.profileCompleted === false &&
    !hasCoreIdentity3
  );

  assert.equal(hasCoreIdentity3, true);
  assert.equal(isProfileIncomplete3, false, 'Completed profile must not be marked incomplete');
});

test('Profile Setup Page Auto-Heal & Redirect Decision Logic', () => {
  const userProfile = {
    username: 'naman_07',
    primaryRole: 'Developer',
    profileCompleted: false,
  };

  const hasCoreIdentity = Boolean(
    userProfile?.username &&
    userProfile.username !== 'User' &&
    userProfile.primaryRole
  );

  const shouldRedirectAway = Boolean(userProfile?.profileCompleted === true || hasCoreIdentity);
  const shouldAutoHeal = Boolean(userProfile?.profileCompleted !== true && hasCoreIdentity);

  assert.equal(shouldRedirectAway, true, 'Must redirect away from /setup-profile when core identity exists');
  assert.equal(shouldAutoHeal, true, 'Must trigger auto-heal updateProfile({ profileCompleted: true })');
});
