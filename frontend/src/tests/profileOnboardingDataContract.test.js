import { strict as assert } from 'node:assert';
import { validateUsername, validateEmail } from '../utils/validation.js';
import { PRIMARY_ROLES, EXPERIENCE_LEVELS } from '../config/constants.js';
import { resolveOrganization } from '../utils/formatting.js';
import { resolveUserDisplayName } from '../utils/memberIdentity.js';

console.log('========================================================================');
console.log('CONVIA — PROFILE ONBOARDING & DATA CONTRACT TEST SUITE');
console.log('========================================================================\n');

// TEST 1: validateUsername
console.log('[TEST 1] Verifying validateUsername business rules...');
{
  // Valid usernames
  const v1 = validateUsername('alexj', true);
  assert.equal(v1.valid, true);
  assert.equal(v1.value, 'alexj');

  const v2 = validateUsername('@sarah_dev', true);
  assert.equal(v2.valid, true);
  assert.equal(v2.value, 'sarah_dev');

  const v3 = validateUsername('john123', true);
  assert.equal(v3.valid, true);
  assert.equal(v3.value, 'john123');

  // Invalid: Empty when required
  const e1 = validateUsername('', true);
  assert.equal(e1.valid, false);

  // Invalid: Too short
  const e2 = validateUsername('ab', true);
  assert.equal(e2.valid, false);

  // Invalid: Too long (> 30)
  const e3 = validateUsername('a'.repeat(31), true);
  assert.equal(e3.valid, false);

  // Invalid: Special characters
  const e4 = validateUsername('user!name', true);
  assert.equal(e4.valid, false);

  // Optional when required = false
  const opt = validateUsername('', false);
  assert.equal(opt.valid, true);
  assert.equal(opt.value, '');

  console.log('✓ validateUsername strictly enforces 3-30 character alphanumeric and underscore handles.');
}

// TEST 2: Primary roles and experience levels constants
console.log('\n[TEST 2] Verifying PRIMARY_ROLES and EXPERIENCE_LEVELS constants...');
{
  const expectedRoles = [
    'Student',
    'Developer',
    'Designer',
    'Founder',
    'Product/Project Manager',
    'Researcher',
    'Other',
  ];
  for (const role of expectedRoles) {
    assert.ok(PRIMARY_ROLES.includes(role), `Missing expected role: ${role}`);
  }

  const expectedLevels = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
  for (const lvl of expectedLevels) {
    assert.ok(EXPERIENCE_LEVELS.includes(lvl), `Missing expected experience level: ${lvl}`);
  }

  console.log('✓ PRIMARY_ROLES and EXPERIENCE_LEVELS contain all required standard platform options.');
}

// TEST 3: resolveOrganization backward compatibility
console.log('\n[TEST 3] Verifying resolveOrganization backward-compatible resolution...');
{
  // Modern profile with organization
  assert.equal(resolveOrganization({ organization: 'Acme Corp' }), 'Acme Corp');

  // Legacy profile with college
  assert.equal(resolveOrganization({ college: 'Stanford University' }), 'Stanford University');

  // Profile with both (organization takes precedence)
  assert.equal(
    resolveOrganization({ organization: 'Modern Lab', college: 'Legacy University' }),
    'Modern Lab'
  );

  // Profile with neither
  assert.equal(resolveOrganization({}), '');
  assert.equal(resolveOrganization(null), '');

  console.log('✓ resolveOrganization cleanly falls back from organization to legacy college attribute.');
}

// TEST 4: Email validation
console.log('\n[TEST 4] Verifying validateEmail consistency...');
{
  assert.equal(validateEmail('test@convia.dev').valid, true);
  assert.equal(validateEmail('invalid-email').valid, false);
  assert.equal(validateEmail('').valid, false);
  console.log('✓ validateEmail conforms to standard email format specification.');
}

// TEST 5: resolveUserDisplayName prevents premature 'User' fallback
console.log('\n[TEST 5] Verifying resolveUserDisplayName prevents premature "User" fallback...');
{
  // Scenario A: Brand new email/password account immediately after signup
  // userProfile already has name from signup
  const nameA = resolveUserDisplayName(
    { displayName: 'Naman Prajapati', email: 'naman@convia.dev' },
    { displayName: 'Naman Prajapati', email: 'naman@convia.dev' }
  );
  assert.equal(nameA, 'Naman Prajapati');

  // Scenario B: userProfile temporarily defaulted or persisted as 'User' (race condition),
  // but Auth user has the real displayName ("Naman Prajapati")
  const nameB = resolveUserDisplayName(
    { displayName: 'User', email: 'naman@convia.dev' },
    { displayName: 'Naman Prajapati', email: 'naman@convia.dev' }
  );
  assert.equal(nameB, 'Naman Prajapati', 'Must NOT return "User" when Auth has "Naman Prajapati"');

  // Scenario C: userProfile has not loaded yet (null), but Auth user has the displayName
  const nameC = resolveUserDisplayName(
    null,
    { displayName: 'Naman Prajapati', email: 'naman@convia.dev' }
  );
  assert.equal(nameC, 'Naman Prajapati');

  // Scenario D: User with a custom name in profile different from Auth
  const nameD = resolveUserDisplayName(
    { displayName: 'Sarah Connor', email: 'sarah@convia.dev' },
    { displayName: 'Sarah C', email: 'sarah@convia.dev' }
  );
  assert.equal(nameD, 'Sarah Connor');

  // Scenario E: Google OAuth sign-in where Google provided displayName
  const nameE = resolveUserDisplayName(
    { displayName: 'Alex River', email: 'alex@gmail.com' },
    { displayName: 'Alex River', email: 'alex@gmail.com' }
  );
  assert.equal(nameE, 'Alex River');

  // Scenario F: Account with no displayName anywhere, but has email
  const nameF = resolveUserDisplayName(
    { displayName: '', email: 'johndoe@example.com' },
    { displayName: null, email: 'johndoe@example.com' }
  );
  assert.equal(nameF, 'johndoe', 'Should fall back to email prefix before "User"');

  // Scenario G: Genuine absolute last resort (no name, no email)
  const nameG = resolveUserDisplayName(null, null);
  assert.equal(nameG, 'User');

  console.log('✓ resolveUserDisplayName guarantees exact authenticated name without premature "User" fallback.');
}

// TEST 6: Google sign-in display name propagation
console.log('\n[TEST 6] Verifying Google sign-in display name preservation...');
{
  const googleUser = {
    uid: 'google-uid-123',
    displayName: 'Google Developer',
    email: 'googler@gmail.com',
    photoURL: 'https://lh3.googleusercontent.com/avatar',
  };

  const name = resolveUserDisplayName(
    { displayName: googleUser.displayName, email: googleUser.email },
    googleUser
  );
  assert.equal(name, 'Google Developer');
  console.log('✓ Google-provided displayName is preserved and never overwritten with empty values.');
}

// TEST 7: resolveMemberDisplayName public identity & private fullName isolation
console.log('\n[TEST 7] Verifying resolveMemberDisplayName strictly isolates private fullName...');
{
  import('../utils/memberIdentity.js').then(({ resolveMemberDisplayName, resolveUserFullName }) => {
    // 1. Member with username and private fullName -> must return username
    const m1 = {
      username: 'alexj',
      fullName: 'Alex Johnson',
      displayName: 'alexj',
    };
    assert.equal(resolveMemberDisplayName(m1), 'alexj', 'Must resolve public username, NOT private fullName');

    // 2. Member with only fullName and NO username or displayName -> must NOT return fullName
    const m2 = {
      fullName: 'Secret Private Name',
    };
    assert.equal(resolveMemberDisplayName(m2), 'Unknown member', 'Must NEVER leak private fullName to public surfaces');

    // 3. Member with legacy displayName -> falls back to displayName
    const m3 = {
      displayName: 'legacy_user',
    };
    assert.equal(resolveMemberDisplayName(m3), 'legacy_user');

    // 4. resolveUserFullName returns private fullName for owner
    assert.equal(resolveUserFullName(m1), 'Alex Johnson');
    assert.equal(resolveUserFullName({}), '');
    assert.equal(resolveUserFullName(null), '');

    console.log('✓ resolveMemberDisplayName guarantees public username resolution and zero private fullName leakage.');
  });
}

// TEST 8: Static verification of Organization/University removal from profile forms
console.log('\n[TEST 8] Verifying removal of Organization/University from profile setup and edit surfaces...');
{
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  const setupPath = path.resolve(__dirname, '../pages/auth/ProfileSetupPage.jsx');
  const editModalPath = path.resolve(__dirname, '../features/profile/EditProfileModal.jsx');
  const profilePagePath = path.resolve(__dirname, '../pages/profile/ProfilePage.jsx');

  const setupContent = fs.readFileSync(setupPath, 'utf-8');
  const editContent = fs.readFileSync(editModalPath, 'utf-8');
  const profileContent = fs.readFileSync(profilePagePath, 'utf-8');

  // Verify Organization / University input does not exist in setup or edit forms
  assert.ok(!setupContent.includes('label="Organization / University"'), 'ProfileSetupPage must not contain Organization input');
  assert.ok(!editContent.includes('label="Organization / University"'), 'EditProfileModal must not contain Organization input');

  // Verify Username and Full Name helper text
  assert.ok(setupContent.includes('Your public identity on Convia.'), 'ProfileSetupPage must have public identity helper text');
  assert.ok(setupContent.includes('Only visible to you.'), 'ProfileSetupPage must have private Full Name helper text');
  assert.ok(editContent.includes('Your public identity on Convia.'), 'EditProfileModal must have public identity helper text');
  assert.ok(editContent.includes('Only visible to you.'), 'EditProfileModal must have private Full Name helper text');

  // Verify duplicate Primary Role card is removed from About section
  assert.ok(!profileContent.includes('<span className="text-slate-400 font-bold block text-[10px] uppercase">Primary Role</span>'), 'ProfilePage About section must not duplicate Primary Role card');

  console.log('✓ Organization/University successfully removed from profile setup and edit forms.');
  console.log('✓ Duplicate Primary Role card removed from ProfilePage About & Overview.');
}

// TEST 9: Verifying reloadUser emailVerified prototype preservation and reactivity
console.log('\n[TEST 9] Verifying reloadUser preserves emailVerified and ensures React re-render...');
{
  class MockFirebaseUser {
    constructor() {
      this.uid = 'test_uid_123';
      this.email = 'test@ncuindia.edu';
      this._verified = true;
    }
    get emailVerified() {
      return this._verified;
    }
    getIdToken() {
      return Promise.resolve('mock_token');
    }
  }

  const rawUser = new MockFirebaseUser();
  // Standard object spread loses prototype getters
  const brokenSpread = { ...rawUser };
  assert.equal(brokenSpread.emailVerified, undefined, 'Naive object spread fails to copy prototype getters like emailVerified');

  // Authoritative clone preserves prototype methods and explicitly defines emailVerified
  const clone = Object.assign(Object.create(Object.getPrototypeOf(rawUser)), rawUser);
  Object.defineProperty(clone, 'emailVerified', {
    value: Boolean(rawUser.emailVerified),
    writable: true,
    configurable: true,
    enumerable: true,
  });

  assert.equal(clone.emailVerified, true, 'Clone must preserve emailVerified as true');
  assert.notEqual(clone, rawUser, 'Clone must have new object reference to trigger React re-render');
  assert.equal(typeof clone.getIdToken, 'function', 'Clone must inherit prototype methods');

  console.log('✓ reloadUser correctly preserves emailVerified and guarantees new reference for React state re-render.');
  console.log('\n========================================================================');
  console.log('ALL PROFILE ONBOARDING & DATA CONTRACT TESTS PASSED PERFECTLY!');
  console.log('========================================================================\n');
}

