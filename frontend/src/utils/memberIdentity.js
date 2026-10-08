/**
 * Canonical Member Identity & Public Name Resolver for Convia.
 *
 * Public Identity Priority Hierarchy:
 * 1. username (Primary canonical public identity across Convia, e.g. "alexj")
 * 2. displayName (Backward-compatible fallback mirroring username)
 * 3. userName (Legacy casing fallback)
 * 4. name (Legacy member name if username is absent)
 * 5. senderName (Message snapshot sender name)
 * 6. "Unknown member" (Final fallback)
 *
 * Strictly excluded from public surfaces: fullName (private to account owner),
 * raw email address, email prefix, and Firebase UID.
 */

/**
 * Resolves the canonical public username for any member or user object.
 *
 * @param {Object|string|null|undefined} member - Member object, User object, or string name
 * @returns {string} The canonical public username
 */
export function resolveMemberDisplayName(member) {
  if (!member) return 'Unknown member';

  // If string was passed directly
  if (typeof member === 'string') {
    const trimmed = member.trim();
    return trimmed || 'Unknown member';
  }

  if (typeof member !== 'object') {
    return 'Unknown member';
  }

  // 1. Primary Public Identity: username
  if (typeof member.username === 'string' && member.username.trim()) {
    return member.username.trim();
  }

  // 2. Backward-compatible fallback: displayName (mirrors username in updated schema)
  if (typeof member.displayName === 'string' && member.displayName.trim()) {
    return member.displayName.trim();
  }

  // 3. Legacy variations
  if (typeof member.userName === 'string' && member.userName.trim()) {
    return member.userName.trim();
  }
  if (typeof member.name === 'string' && member.name.trim()) {
    return member.name.trim();
  }

  // 4. Message snapshot senderName
  if (typeof member.senderName === 'string' && member.senderName.trim()) {
    return member.senderName.trim();
  }

  // NOTE: member.fullName is strictly PRIVATE personal info and MUST NEVER be returned publicly.

  // 5. Final fallback
  return 'Unknown member';
}

/**
 * Extracts the canonical author UID from any message or discussion record across all schemas.
 * Priority order:
 * 1. authorUid (Canonical discussion author field)
 * 2. senderId (Canonical chat sender field)
 * 3. authorId (Canonical idea author field)
 * 4. userId (Common user reference)
 * 5. uid (Direct UID property)
 * 6. createdBy (Creation actor reference)
 *
 * @param {Object|null|undefined} message - Message, discussion, or reply object
 * @returns {string|null} The canonical author UID or null
 */
export function getMessageAuthorUid(message) {
  if (!message || typeof message !== 'object') return null;

  const rawUid =
    message.authorUid ||
    message.senderId ||
    message.authorId ||
    message.userId ||
    message.uid ||
    message.createdBy ||
    null;

  if (rawUid && typeof rawUid === 'string' && rawUid.trim()) {
    const trimmed = rawUid.trim();
    if (trimmed !== 'system' && trimmed !== 'unknown') {
      return trimmed;
    }
  }

  return null;
}

/**
 * Authoritative ownership comparison between a message/discussion and an authenticated user UID.
 * Replaces all brittle display-name, email, or single-property checks.
 *
 * @param {Object|null|undefined} message - Message or discussion record
 * @param {string|null|undefined} currentUserId - Authenticated user UID
 * @returns {boolean} True if the message was authored by the user
 */
export function isMessageAuthoredByUser(message, currentUserId) {
  if (!message || !currentUserId) return false;
  const authorUid = getMessageAuthorUid(message);
  if (!authorUid) return false;
  return String(authorUid).trim() === String(currentUserId).trim();
}

/**
 * Resolves the authenticated user's public display name safely, prioritizing username and preventing premature 'User' fallback.
 *
 * @param {Object|null|undefined} userProfile - RTDB user profile from useUser()
 * @param {Object|null|undefined} user - Firebase Auth user from useAuth()
 * @returns {string} The resolved public username / display name
 */
export function resolveUserDisplayName(userProfile, user) {
  const profileUsername = typeof userProfile?.username === 'string' ? userProfile.username.trim() : '';
  const profileDisplayName = typeof userProfile?.displayName === 'string' ? userProfile.displayName.trim() : '';
  const authName = typeof user?.displayName === 'string' ? user.displayName.trim() : '';

  if (profileUsername && profileUsername !== 'User') return profileUsername;
  if (profileDisplayName && profileDisplayName !== 'User') return profileDisplayName;
  if (authName && authName !== 'User') return authName;
  if (profileUsername) return profileUsername;
  if (profileDisplayName) return profileDisplayName;
  if (authName) return authName;
  if (user?.email) return user.email.split('@')[0];
  return 'User';
}

/**
 * Resolves the user's private full name for account owner visibility only.
 *
 * @param {Object|null|undefined} userProfile - RTDB user profile from useUser()
 * @returns {string} The private full name or empty string
 */
export function resolveUserFullName(userProfile) {
  if (typeof userProfile?.fullName === 'string') {
    return userProfile.fullName.trim();
  }
  return '';
}

