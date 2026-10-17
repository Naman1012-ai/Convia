import { mapAuthError, AUTH_ERROR_MESSAGES, extractAuthErrorCode } from './authErrorMapper.js';

export { AUTH_ERROR_MESSAGES, mapAuthError, extractAuthErrorCode };

/**
 * Maps Firebase Auth, Firestore, and RTDB error codes or error objects to user-friendly error strings.
 * Preserves existing user-facing strings and prevents unexpected double-translation fallthroughs.
 * 
 * @param {string|Error|null} errorCodeOrError
 * @param {Object} [options]
 * @returns {string}
 */
export function getErrorMessage(errorCodeOrError, options = {}) {
  if (!errorCodeOrError) {
    return AUTH_ERROR_MESSAGES.DEFAULT_UNEXPECTED;
  }

  // If already a recognized user-friendly message, preserve it directly
  if (typeof errorCodeOrError === 'string') {
    const knownMessages = Object.values(AUTH_ERROR_MESSAGES);
    if (knownMessages.includes(errorCodeOrError)) {
      return errorCodeOrError;
    }
  }

  // Extract raw string or code
  const code = typeof errorCodeOrError === 'object' && errorCodeOrError.code
    ? errorCodeOrError.code
    : typeof errorCodeOrError === 'string'
    ? errorCodeOrError.trim()
    : (errorCodeOrError.message || '');

  // 1. Non-auth Firestore / RTDB codes
  switch (code) {
    case 'permission-denied':
      return "You don't have permission to perform this action.";
    case 'not-found':
      return 'The requested resource was not found.';
    case 'already-exists':
      return 'This entry already exists.';
  }

  // 2. Delegate to centralized Auth Error Mapper
  const authCode = extractAuthErrorCode(errorCodeOrError);
  if (authCode) {
    return mapAuthError(errorCodeOrError, options);
  }

  // 3. Fallback for unexpected errors
  return AUTH_ERROR_MESSAGES.DEFAULT_UNEXPECTED;
}

