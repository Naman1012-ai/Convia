import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  mapAuthError,
  extractAuthErrorCode,
  AUTH_ERROR_MESSAGES,
  AuthError,
} from '../utils/authErrorMapper.js';
import { getErrorMessage } from '../utils/errorMessages.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 ====================================================');
console.log('🧪 CONVIA AUTHENTICATION ERROR HANDLING REGRESSION TEST SUITE');
console.log('🧪 ====================================================\n');

// -------------------------------------------------------------------
// 1. Password Authentication Error Mapping
// -------------------------------------------------------------------
console.log('🔍 TEST GROUP 1: Email & Password Error Mapping');

// Test 1: Wrong password returns exact user-friendly credential error
{
  assert.strictEqual(
    AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS,
    'Incorrect email or password. Please check your credentials and try again.'
  );
  const result = mapAuthError('auth/wrong-password', { provider: 'password', context: 'signin' });
  assert.strictEqual(
    result,
    'Incorrect email or password. Please check your credentials and try again.',
    'auth/wrong-password must map to generic credential error'
  );
  console.log('  ✅ PASS: TEST 1: auth/wrong-password maps to expected generic message');
}

// Test 2: Modern Firebase auth/invalid-credential returns exact credential error
{
  const result = mapAuthError('auth/invalid-credential', { provider: 'password', context: 'signin' });
  assert.strictEqual(
    result,
    'Incorrect email or password. Please check your credentials and try again.',
    'auth/invalid-credential must map to generic credential error'
  );
  console.log('  ✅ PASS: TEST 2: auth/invalid-credential maps to expected generic message');
}

// Test 3: Non-existent email (auth/user-not-found) returns identical generic message (anti-enumeration)
{
  const result = mapAuthError('auth/user-not-found', { provider: 'password', context: 'signin' });
  assert.strictEqual(
    result,
    'Incorrect email or password. Please check your credentials and try again.',
    'auth/user-not-found must map to identical credential error to prevent account enumeration'
  );
  console.log('  ✅ PASS: TEST 3: auth/user-not-found maps to identical generic message (privacy safe)');
}

// Test 4: Invalid email format
{
  const result = mapAuthError('auth/invalid-email', { provider: 'password', context: 'signin' });
  assert.strictEqual(
    result,
    'Please enter a valid email address.',
    'auth/invalid-email must map to valid email format message'
  );
  console.log('  ✅ PASS: TEST 4: auth/invalid-email maps to "Please enter a valid email address."');
}

// Test 5: Too many requests / rate limiting
{
  const result = mapAuthError('auth/too-many-requests', { provider: 'password', context: 'signin' });
  assert.strictEqual(
    result,
    'Too many sign-in attempts. Please wait a moment and try again.',
    'auth/too-many-requests must map to rate limit message'
  );
  console.log('  ✅ PASS: TEST 5: auth/too-many-requests maps to rate limit message');
}

// Test 6: Network connection failure
{
  const result = mapAuthError('auth/network-request-failed', { provider: 'password', context: 'signin' });
  assert.strictEqual(
    result,
    'Unable to connect. Check your internet connection and try again.',
    'auth/network-request-failed must map to network connection message'
  );
  console.log('  ✅ PASS: TEST 6: auth/network-request-failed maps to connection message');
}

// Test 7: Disabled user account
{
  const result = mapAuthError('auth/user-disabled', { provider: 'password', context: 'signin' });
  assert.strictEqual(
    result,
    'This account has been disabled. Please contact support.',
    'auth/user-disabled must map to account disabled message'
  );
  console.log('  ✅ PASS: TEST 7: auth/user-disabled maps to account disabled message');
}

// -------------------------------------------------------------------
// 2. Google OAuth Error Isolation
// -------------------------------------------------------------------
console.log('\n🔍 TEST GROUP 2: Google Sign-In Error Mapping & Isolation');

// Test 8: Popup blocked
{
  const result = mapAuthError('auth/popup-blocked', { provider: 'google', context: 'signin' });
  assert.strictEqual(
    result,
    'The Google sign-in popup was blocked by your browser. Please allow popups for this site and try again.',
    'auth/popup-blocked must guide user to allow popups'
  );
  console.log('  ✅ PASS: TEST 8: Google popup-blocked mapped correctly');
}

// Test 9: Popup cancelled
{
  const result = mapAuthError('auth/cancelled-popup-request', { provider: 'google', context: 'signin' });
  assert.strictEqual(
    result,
    'Google sign-in was cancelled. Please try again.',
    'auth/cancelled-popup-request must map to cancelled message'
  );
  console.log('  ✅ PASS: TEST 9: Google cancelled-popup-request mapped correctly');
}

// Test 10: Unrelated Google error NEVER returns password error
{
  const result = mapAuthError('auth/internal-error', { provider: 'google', context: 'signin' });
  assert.notStrictEqual(
    result,
    'Incorrect email or password. Please check your credentials and try again.',
    'Google error must never return password error'
  );
  assert.strictEqual(
    result,
    'Unable to sign in with Google. Please try again.',
    'Google fallback error must be Google-specific'
  );
  console.log('  ✅ PASS: TEST 10: Google errors isolated from password credential error');
}

// -------------------------------------------------------------------
// 3. Raw Firebase Message Parsing & Code Extraction
// -------------------------------------------------------------------
console.log('\n🔍 TEST GROUP 3: Raw Firebase Error Extraction & Object Support');

// Test 11: Parses "Firebase: Error (auth/invalid-credential)."
{
  const rawMsg = 'Firebase: Error (auth/invalid-credential).';
  const extracted = extractAuthErrorCode(rawMsg);
  assert.strictEqual(extracted, 'auth/invalid-credential');

  const mapped = mapAuthError(rawMsg, { provider: 'password' });
  assert.strictEqual(
    mapped,
    'Incorrect email or password. Please check your credentials and try again.'
  );
  console.log('  ✅ PASS: TEST 11: Raw SDK string "Firebase: Error (auth/invalid-credential)." parsed');
}

// Test 12: Handles Error object with .code property
{
  const errObj = new Error('Some error');
  errObj.code = 'auth/wrong-password';
  const mapped = mapAuthError(errObj, { provider: 'password' });
  assert.strictEqual(
    mapped,
    'Incorrect email or password. Please check your credentials and try again.'
  );
  console.log('  ✅ PASS: TEST 12: Error object with .code property handled');
}

// -------------------------------------------------------------------
// 4. Double Translation Prevention (Root Cause Fix)
// -------------------------------------------------------------------
console.log('\n🔍 TEST GROUP 4: Double Translation Prevention & Idempotency');

// Test 13: Passing already mapped message through getErrorMessage preserves it
{
  const userMsg = 'Incorrect email or password. Please check your credentials and try again.';
  const secondPass = getErrorMessage(userMsg);
  assert.strictEqual(
    secondPass,
    userMsg,
    'getErrorMessage must preserve already-mapped message and never fall back to unexpected error'
  );
  console.log('  ✅ PASS: TEST 13: Idempotency guaranteed: already-mapped message is preserved');
}

// Test 14: getErrorMessage delegates auth codes accurately
{
  const result = getErrorMessage('auth/invalid-credential');
  assert.strictEqual(
    result,
    'Incorrect email or password. Please check your credentials and try again.'
  );
  console.log('  ✅ PASS: TEST 14: getErrorMessage correctly delegates auth codes');
}

// -------------------------------------------------------------------
// 5. AuthError Class & Service Layer Architecture
// -------------------------------------------------------------------
console.log('\n🔍 TEST GROUP 5: AuthError Class Integrity');

// Test 15: AuthError preserves code, message, and original error
{
  const origErr = new Error('Firebase raw error');
  origErr.code = 'auth/invalid-credential';

  const authErr = new AuthError(origErr.code, 'Incorrect email or password. Please check your credentials and try again.', origErr);
  assert.strictEqual(authErr.name, 'AuthError');
  assert.strictEqual(authErr.code, 'auth/invalid-credential');
  assert.strictEqual(authErr.message, 'Incorrect email or password. Please check your credentials and try again.');
  assert.strictEqual(authErr.isAuthError, true);
  assert.strictEqual(authErr.originalError, origErr);
  console.log('  ✅ PASS: TEST 15: AuthError class preserves code, message, and original error');
}

// -------------------------------------------------------------------
// 6. UI Form Verification (SignInForm.jsx Code Audit)
// -------------------------------------------------------------------
console.log('\n🔍 TEST GROUP 6: SignInForm Presentation & Accessibility Audit');

// Test 16: SignInForm does NOT call toast.error on auth failures
{
  const formPath = path.resolve(__dirname, '../features/auth/SignInForm.jsx');
  const content = fs.readFileSync(formPath, 'utf8');

  // Verify toast.error is removed from handleSubmit catch block
  const handleSubmitCatchMatch = content.match(/catch\s*\(err\)\s*\{([\s\S]*?)\}\s*finally/);
  assert.ok(handleSubmitCatchMatch, 'handleSubmit must have catch block');
  const catchBody = handleSubmitCatchMatch[1];
  assert.ok(
    !catchBody.includes('toast.error'),
    'SignInForm catch block must NOT call toast.error to prevent duplicate error displays'
  );
  console.log('  ✅ PASS: TEST 16: Verified NO duplicate toast.error on login failure');
}

// Test 17: Inline error is placed inside <form> and has role="alert" and aria-live="polite"
{
  const formPath = path.resolve(__dirname, '../features/auth/SignInForm.jsx');
  const content = fs.readFileSync(formPath, 'utf8');

  assert.ok(content.includes('role="alert"'), 'Inline error must have role="alert" for accessibility');
  assert.ok(content.includes('aria-live="polite"'), 'Inline error must have aria-live="polite"');

  // Verify serverError appears inside <form> before the submit button
  const formTagIndex = content.indexOf('<form onSubmit={handleSubmit}');
  const serverErrorIndex = content.indexOf('{serverError && (');
  const submitButtonIndex = content.indexOf('<Button type="submit"');

  assert.ok(formTagIndex !== -1, '<form> must exist');
  assert.ok(serverErrorIndex !== -1, '{serverError} must exist');
  assert.ok(submitButtonIndex !== -1, '<Button type="submit"> must exist');

  assert.ok(
    formTagIndex < serverErrorIndex,
    '{serverError} must appear inside <form>'
  );
  assert.ok(
    serverErrorIndex < submitButtonIndex,
    '{serverError} must appear before <Button type="submit"> near credential inputs'
  );
  console.log('  ✅ PASS: TEST 17: Inline error placed inside <form> above submit button with accessibility attributes');
}

// Test 18: Typing in email or password clears serverError
{
  const formPath = path.resolve(__dirname, '../features/auth/SignInForm.jsx');
  const content = fs.readFileSync(formPath, 'utf8');

  assert.ok(
    content.includes('handleEmailChange'),
    'SignInForm must have handleEmailChange'
  );
  assert.ok(
    content.includes('handlePasswordChange'),
    'SignInForm must have handlePasswordChange'
  );
  assert.ok(
    content.includes("if (serverError) setServerError('');"),
    'Typing must reset serverError immediately'
  );
  console.log('  ✅ PASS: TEST 18: Typing in fields clears inline error immediately');
}

console.log('\n====================================================');
console.log('📊 ALL 18 AUTHENTICATION ERROR HANDLING TESTS PASSED!');
console.log('====================================================\n');
