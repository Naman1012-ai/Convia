/**
 * Convia Centralized Authentication Error Mapping System.
 * Maps Firebase Auth error codes and error objects to user-friendly, security-conscious messages.
 */

/**
 * Custom semantic authentication error that preserves error code and original error.
 */
export class AuthError extends Error {
  constructor(code, message, originalError = null) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.isAuthError = true;
    this.originalError = originalError;
  }
}

export const AUTH_ERROR_MESSAGES = {
  // Generic credential error (intentionally identical for wrong password & non-existent user to prevent enumeration)
  INVALID_CREDENTIALS: 'Incorrect email or password. Please check your credentials and try again.',

  // Input & Account validations
  INVALID_EMAIL: 'Please enter a valid email address.',
  WEAK_PASSWORD: 'Password must be at least 6 characters long.',
  EMAIL_ALREADY_IN_USE: 'An account with this email address already exists.',
  ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL:
    'An account already exists with this email using a different sign-in method.',

  // Rate Limiting & Account Status
  TOO_MANY_REQUESTS: 'Too many sign-in attempts. Please wait a moment and try again.',
  USER_DISABLED: 'This account has been disabled. Please contact support.',

  // Network & Connectivity
  NETWORK_ERROR: 'Unable to connect. Check your internet connection and try again.',

  // Google OAuth & Popup specifics
  POPUP_CLOSED: 'Sign-in window was closed before completing.',
  POPUP_BLOCKED:
    'The Google sign-in popup was blocked by your browser. Please allow popups for this site and try again.',
  POPUP_CANCELLED: 'Google sign-in was cancelled. Please try again.',
  GOOGLE_SIGN_IN_FAILED: 'Unable to sign in with Google. Please try again.',

  // System & Fallback messages
  GENERIC_SIGN_IN_ERROR: 'Something went wrong while signing you in. Please try again.',
  DEFAULT_UNEXPECTED: 'An unexpected error occurred. Please try again.',
};

const KNOWN_AUTH_MESSAGES = new Set(Object.values(AUTH_ERROR_MESSAGES));

/**
 * Extracts a normalized Firebase Auth error code from any input:
 * - Error objects with `.code`
 * - String error codes ('auth/invalid-credential')
 * - Raw Firebase error strings ('Firebase: Error (auth/invalid-credential).')
 */
export function extractAuthErrorCode(input) {
  if (!input) return null;

  // 1. Direct code property on Error or object
  if (typeof input === 'object' && input.code && typeof input.code === 'string') {
    return input.code.trim().toLowerCase();
  }

  const rawStr = typeof input === 'string' ? input.trim() : (input.message || '');
  if (!rawStr) return null;

  // 2. Direct string starting with auth/
  if (rawStr.toLowerCase().startsWith('auth/')) {
    return rawStr.toLowerCase();
  }

  // 3. Embedded Firebase message pattern: (auth/xxx)
  const match = rawStr.match(/auth\/[a-z0-9-]+/i);
  if (match) {
    return match[0].toLowerCase();
  }

  return null;
}

/**
 * Maps an authentication error to a clean, user-facing message.
 * @param {Error|string|null} errorOrCode - The error object, code string, or message.
 * @param {Object} [options]
 * @param {'password'|'google'} [options.provider='password'] - The auth provider used.
 * @param {'signin'|'signup'|'reset'|'general'} [options.context='signin'] - Action context.
 * @returns {string} User-facing error message.
 */
export function mapAuthError(errorOrCode, options = {}) {
  const { provider = 'password', context = 'signin' } = options;

  if (!errorOrCode) {
    return AUTH_ERROR_MESSAGES.GENERIC_SIGN_IN_ERROR;
  }

  // If the input is ALREADY one of our user-facing messages, return it directly (idempotency guard)
  if (typeof errorOrCode === 'string' && KNOWN_AUTH_MESSAGES.has(errorOrCode)) {
    return errorOrCode;
  }
  if (typeof errorOrCode === 'object' && errorOrCode.message && KNOWN_AUTH_MESSAGES.has(errorOrCode.message)) {
    return errorOrCode.message;
  }

  const code = extractAuthErrorCode(errorOrCode);

  // 1. Google OAuth specific flow
  if (provider === 'google') {
    switch (code) {
      case 'auth/popup-closed-by-user':
        return AUTH_ERROR_MESSAGES.POPUP_CLOSED;
      case 'auth/popup-blocked':
        return AUTH_ERROR_MESSAGES.POPUP_BLOCKED;
      case 'auth/cancelled-popup-request':
        return AUTH_ERROR_MESSAGES.POPUP_CANCELLED;
      case 'auth/account-exists-with-different-credential':
        return AUTH_ERROR_MESSAGES.ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL;
      case 'auth/network-request-failed':
        return AUTH_ERROR_MESSAGES.NETWORK_ERROR;
      case 'auth/too-many-requests':
        return AUTH_ERROR_MESSAGES.TOO_MANY_REQUESTS;
      case 'auth/user-disabled':
        return AUTH_ERROR_MESSAGES.USER_DISABLED;
      default:
        return AUTH_ERROR_MESSAGES.GOOGLE_SIGN_IN_FAILED;
    }
  }

  // 2. Email / Password and general auth flow
  switch (code) {
    // Expected credential failures: intentionally generic for security/privacy
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS;

    // Formatting & validation
    case 'auth/invalid-email':
      return AUTH_ERROR_MESSAGES.INVALID_EMAIL;
    case 'auth/weak-password':
      return AUTH_ERROR_MESSAGES.WEAK_PASSWORD;
    case 'auth/email-already-in-use':
      return AUTH_ERROR_MESSAGES.EMAIL_ALREADY_IN_USE;

    // Security & rate limits
    case 'auth/too-many-requests':
      return AUTH_ERROR_MESSAGES.TOO_MANY_REQUESTS;
    case 'auth/user-disabled':
      return AUTH_ERROR_MESSAGES.USER_DISABLED;

    // Network & transport
    case 'auth/network-request-failed':
      return AUTH_ERROR_MESSAGES.NETWORK_ERROR;

    // Session & reauth
    case 'auth/requires-recent-login':
      return 'This action requires recent authentication. Please sign in again.';
    case 'auth/user-mismatch':
      return 'Provided credentials do not match the current user.';
    case 'auth/credential-already-in-use':
      return 'These credentials are already associated with another account.';
    case 'auth/operation-not-allowed':
      return 'Sign-in provider is disabled. Please contact support.';

    default:
      if (context === 'signin') {
        return AUTH_ERROR_MESSAGES.GENERIC_SIGN_IN_ERROR;
      }
      return AUTH_ERROR_MESSAGES.DEFAULT_UNEXPECTED;
  }
}
