import crypto from 'crypto';

// Characters excluding ambiguous 0, O, 1, I
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Standard expiration window for email-bound invitation codes (5 minutes).
 */
export const INVITATION_EXPIRATION_MS = 5 * 60 * 1000;

/**
 * Generates a cryptographically secure random invitation code in format: CNV-XXXX-XXXX
 */
export function generateInvitationCode() {
  const bytes = crypto.randomBytes(8);
  let part1 = '';
  let part2 = '';
  for (let i = 0; i < 4; i++) {
    part1 += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  for (let i = 4; i < 8; i++) {
    part2 += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return `CNV-${part1}-${part2}`;
}

/**
 * Normalizes an invitation code:
 * - Trims whitespace
 * - Converts to uppercase
 * - Strips extra internal whitespace
 * - Supports missing CNV prefix or missing hyphens (e.g. 8K4PX7QM or cnv8k4px7qm -> CNV-8K4P-X7QM)
 */
export function normalizeInvitationCode(rawCode) {
  if (!rawCode || typeof rawCode !== 'string') return '';
  let clean = rawCode.trim().toUpperCase().replace(/\s+/g, '');

  // Strip all non-alphanumeric
  const alphanumeric = clean.replace(/[^A-Z0-9]/g, '');

  if (alphanumeric.startsWith('CNV') && alphanumeric.length === 11) {
    return `CNV-${alphanumeric.slice(3, 7)}-${alphanumeric.slice(7, 11)}`;
  }

  if (alphanumeric.length === 8) {
    return `CNV-${alphanumeric.slice(0, 4)}-${alphanumeric.slice(4, 8)}`;
  }

  // Fallback to standard hyphenated if matches pattern
  if (/^CNV-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(clean)) {
    return clean;
  }

  return clean;
}

/**
 * Validates format of normalized invitation code
 */
export function isValidInvitationCodeFormat(code) {
  return /^CNV-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code);
}

/**
 * Normalizes email address (trim whitespace and lowercase)
 */
export function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

/**
 * Computes secure SHA-256 hash of normalized code for storage and lookup
 */
export function hashInvitationCode(normalizedCode) {
  if (!normalizedCode || typeof normalizedCode !== 'string') return '';
  return crypto.createHash('sha256').update(normalizedCode).digest('hex');
}

/**
 * Formats expiration timestamp for display:
 * - If expired or invalid: 'Expired'
 * - If pending: 'Expires in 4m 32s', 'Expires in 32s', etc.
 */
export function formatInvitationExpiry(expiresAt, now = Date.now()) {
  if (!expiresAt || isNaN(expiresAt)) return 'Expired';
  const remainingMs = Number(expiresAt) - now;
  if (remainingMs <= 0) return 'Expired';

  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `Expires in ${minutes}m ${seconds.toString().padStart(2, '0')}s`;
  }
  return `Expires in ${seconds}s`;
}

/**
 * Returns whether an invitation is effectively expired based on its timestamp and status.
 */
export function isInvitationExpired(inv, now = Date.now()) {
  if (!inv) return true;
  if (inv.status === 'expired') return true;
  if (inv.status !== 'pending') return false;
  if (!inv.expiresAt || isNaN(inv.expiresAt)) return true;
  return now >= Number(inv.expiresAt);
}

/**
 * Formats a terminal event timestamp (Accepted, Revoked, Created) for display:
 * - If within 60s: 'Prefix just now'
 * - Otherwise: 'Prefix MMM D, YYYY, h:mm A' (e.g., 'Accepted Sep 30, 2026, 3:42 PM')
 */
export function formatInvitationEventDate(prefix, timestamp) {
  if (!timestamp) return `${prefix} just now`;
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  if (isNaN(date.getTime())) return `${prefix} just now`;

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffInSeconds < 60) {
    return `${prefix} just now`;
  }

  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return `${prefix} ${dateStr}, ${timeStr}`;
}

/**
 * Authoritatively formats the "Expires / Date" column according to invitation lifecycle:
 * - 'accepted': 'Accepted just now' or 'Accepted Sep 30, 2026, 3:42 PM' (Terminal - never expires)
 * - 'revoked': 'Revoked just now' or 'Revoked Sep 30, 2026, 3:42 PM' (Terminal - never expires)
 * - 'expired': 'Expired'
 * - 'pending': 'Expires in 4m 01s' (live countdown) or 'Expired' once now >= expiresAt
 */
export function formatInvitationStatusDate(inv, now = Date.now()) {
  if (!inv) return '';
  if (inv.status === 'accepted') {
    return formatInvitationEventDate('Accepted', inv.acceptedAt || inv.updatedAt || inv.createdAt);
  }
  if (inv.status === 'revoked') {
    return formatInvitationEventDate('Revoked', inv.revokedAt || inv.updatedAt || inv.createdAt);
  }
  if (inv.status === 'expired' || isInvitationExpired(inv, now)) {
    return 'Expired';
  }
  if (inv.status === 'pending') {
    return formatInvitationExpiry(inv.expiresAt, now);
  }
  return formatInvitationEventDate('Created', inv.createdAt);
}
