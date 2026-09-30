/**
 * Constants and utility helpers for Convia's generalized Workspace model.
 */

export const PROJECT_TYPES = [
  { value: 'software', label: 'Software / Web' },
  { value: 'ai_ml', label: 'AI / ML' },
  { value: 'hardware', label: 'Hardware / Engineering' },
  { value: 'research', label: 'Research' },
  { value: 'startup', label: 'Startup / Product' },
  { value: 'academic', label: 'Academic' },
  { value: 'hackathon', label: 'Hackathon' },
  { value: 'other', label: 'Other' },
];

export const PROJECT_TYPE_VALUES = PROJECT_TYPES.map((t) => t.value);

export const PROJECT_TYPE_LABELS = PROJECT_TYPES.reduce((acc, t) => {
  acc[t.value] = t.label;
  return acc;
}, {});

/**
 * Workspace Visibility Options.
 * Convia backend currently enforces authenticated member-only workspace isolation.
 * 'private' is the active, enforced default option.
 */
export const WORKSPACE_VISIBILITY_OPTIONS = [
  {
    value: 'private',
    label: 'Private — Accessible only to invited team members',
  },
];

export const WORKSPACE_LIMITS = {
  NAME_MIN: 1,
  NAME_MAX: 80,
  DESCRIPTION_MIN: 1,
  DESCRIPTION_MAX: 1000,
  PROJECT_GOAL_MAX: 300,
  MEMBERS_MIN: 1,
  MEMBERS_MAX: 50,
  MEMBERS_DEFAULT: 5,
};

/**
 * Resolves a human-readable display label for a given projectType.
 */
export function getProjectTypeLabel(projectType) {
  if (!projectType) return 'General Project';
  return PROJECT_TYPE_LABELS[projectType] || projectType;
}

/**
 * Resolves projectType with safe backward-compatibility fallback for legacy workspaces.
 * If projectType is missing:
 * ONLY fall back to 'hackathon' if the workspace reliably exhibits hackathon-specific fields.
 * Otherwise falls back to 'other'.
 */
export function resolveWorkspaceProjectType(org) {
  if (!org) return 'other';
  if (org.projectType && PROJECT_TYPE_VALUES.includes(org.projectType)) {
    return org.projectType;
  }
  if (
    org.hackathonName ||
    org.hackathonTheme ||
    org.hackathonLocation ||
    org.hackathonDate ||
    org.startDate ||
    org.endDate
  ) {
    return 'hackathon';
  }
  return 'other';
}

/**
 * Checks whether an existing workspace contains legacy hackathon metadata
 * so it can be preserved and surfaced in the legacy details section without data loss.
 */
export function isLegacyHackathonWorkspace(org) {
  if (!org) return false;
  return Boolean(
    org.hackathonName ||
    org.hackathonTheme ||
    org.hackathonLocation ||
    org.hackathonDate ||
    org.startDate ||
    org.endDate
  );
}
