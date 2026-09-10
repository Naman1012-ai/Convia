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
