/**
 * Formats a Firestore timestamp or JS Date object into relative or absolute text strings.
 */
export function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) {
    return 'just now';
  }
  if (diffInSeconds < 3600) {
    const mins = Math.floor(diffInSeconds / 60);
    return `${mins}m ago`;
  }
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}h ago`;
  }
  if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days}d ago`;
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Safely parses input into a valid Date object or null.
 */
function parseDate(timestamp) {
  if (!timestamp) return null;
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return null;
  return date;
}

/**
 * Formats a timestamp into an absolute date string (e.g., "Sep 12, 2026").
 * Returns fallback string if invalid.
 */
export function formatDate(timestamp, fallback = 'Join date unavailable') {
  const date = parseDate(timestamp);
  if (!date) return fallback;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Formats a workspace membership join timestamp.
 * Example output: "Joined Sep 12, 2026" or fallback "Join date unavailable".
 */
export function formatWorkspaceJoinDate(timestamp) {
  const date = parseDate(timestamp);
  if (!date) return 'Join date unavailable';

  const formatted = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `Joined ${formatted}`;
}

/**
 * Formats a workspace creation timestamp for the original workspace creator.
 * Example output: "Workspace created Sep 12, 2026" or fallback "Workspace creation date unavailable".
 */
export function formatWorkspaceCreatedDate(timestamp) {
  const date = parseDate(timestamp);
  if (!date) return 'Workspace creation date unavailable';

  const formatted = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `Workspace created ${formatted}`;
}

/**
 * Formats a platform user registration / first sign-in timestamp.
 * Example output: "Joined Convia Sep 12, 2026" or fallback "Join date unavailable".
 */
export function formatPlatformJoinDate(timestamp) {
  const date = parseDate(timestamp);
  if (!date) return 'Join date unavailable';

  const formatted = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `Joined Convia ${formatted}`;
}

export function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

export function getInitials(name) {
  if (!name) return 'U';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Resolves user organization with backward compatibility for legacy college field.
 */
export function resolveOrganization(profile) {
  return (profile?.organization || profile?.college || '').trim();
}

