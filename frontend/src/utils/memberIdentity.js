/**
 * Canonical Member Identity & Display Name Resolver for Convia.
 *
 * Section 27: Authoritative Identity Priority Hierarchy:
 * 1. displayName (Primary human-readable display name entered in profile, e.g. "Paras")
 * 2. name / fullName (Legacy canonical profile display-name equivalent)
 * 3. username (Fallback only when displayName/name is absent)
 * 4. "Unknown member" (Final fallback)
 *
 * Disallowed normal fallbacks: Firebase UID, raw email address, email prefix (@...).
 */

/**
 * Resolves the canonical human-readable display name for any member or user object.
 *
 * @param {Object|string|null|undefined} member - Member object, User object, or string name
 * @returns {string} The canonical display name
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

  // 1. Primary: displayName
  if (typeof member.displayName === 'string' && member.displayName.trim()) {
    return member.displayName.trim();
  }

  // 2. Legacy canonical names (name, fullName)
  if (typeof member.name === 'string' && member.name.trim()) {
    return member.name.trim();
  }
  if (typeof member.fullName === 'string' && member.fullName.trim()) {
    return member.fullName.trim();
  }

  // 3. Fallback: username (only when displayName is absent)
  if (typeof member.username === 'string' && member.username.trim()) {
    return member.username.trim();
  }
  if (typeof member.userName === 'string' && member.userName.trim()) {
    return member.userName.trim();
  }

  // 4. Message snapshot senderName
  if (typeof member.senderName === 'string' && member.senderName.trim()) {
    return member.senderName.trim();
  }

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
