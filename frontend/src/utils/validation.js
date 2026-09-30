import { CHAR_LIMITS } from '../config/constants';

/**
 * Validates text input length and presence against business rules.
 */
export function validateString(value, maxLength, required = true, fieldName = 'Field') {
  if (!value || typeof value !== 'string') {
    if (required) {
      return { valid: false, error: `${fieldName} is required.` };
    }
    return { valid: true };
  }

  const trimmed = value.trim();
  if (required && trimmed.length === 0) {
    return { valid: false, error: `${fieldName} cannot be empty.` };
  }

  if (trimmed.length > maxLength) {
    return {
      valid: false,
      error: `${fieldName} must be at most ${maxLength} characters (currently ${trimmed.length}).`,
    };
  }

  return { valid: true };
}

export function validateIdeaTitle(title) {
  return validateString(title, CHAR_LIMITS.IDEA_TITLE, true, 'Title');
}

export function validateIdeaDescription(desc) {
  return validateString(desc, CHAR_LIMITS.IDEA_DESCRIPTION, true, 'Description');
}

export function validateProblemStatement(ps) {
  return validateString(ps, CHAR_LIMITS.PROBLEM_STATEMENT, true, 'Problem statement');
}

export function validateProposedSolution(sol) {
  return validateString(sol, CHAR_LIMITS.PROPOSED_SOLUTION, false, 'Proposed solution');
}

export function validateComment(content) {
  return validateString(content, CHAR_LIMITS.COMMENT, true, 'Comment');
}

export function validateSuggestion(content) {
  return validateString(content, CHAR_LIMITS.SUGGESTION, true, 'Suggestion');
}

export function validateTaskTitle(title) {
  return validateString(title, CHAR_LIMITS.TASK_TITLE, true, 'Task title');
}

export function validateOrgName(name) {
  return validateWorkspaceName(name);
}

export function validateWorkspaceName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Workspace name is required.' };
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Workspace name is required.' };
  }
  if (trimmed.length > 80) {
    return { valid: false, error: 'Workspace name must be 80 characters or fewer.' };
  }
  return { valid: true };
}

export function validateProjectType(projectType) {
  const allowed = [
    'software',
    'ai_ml',
    'hardware',
    'research',
    'startup',
    'academic',
    'hackathon',
    'other',
  ];
  if (!projectType || typeof projectType !== 'string' || !allowed.includes(projectType)) {
    return { valid: false, error: 'Please select a valid project type.' };
  }
  return { valid: true };
}

export function validateWorkspaceDescription(desc) {
  if (!desc || typeof desc !== 'string') {
    return { valid: false, error: 'Description is required.' };
  }
  const trimmed = desc.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Description is required.' };
  }
  if (trimmed.length > 1000) {
    return {
      valid: false,
      error: `Description must be at most 1000 characters (currently ${trimmed.length}).`,
    };
  }
  return { valid: true };
}

export function validateProjectGoal(goal) {
  if (!goal) return { valid: true };
  if (typeof goal !== 'string') return { valid: true };
  const trimmed = goal.trim();
  if (trimmed.length > 300) {
    return {
      valid: false,
      error: `Project goal must be 300 characters or fewer (currently ${trimmed.length}).`,
    };
  }
  return { valid: true };
}

export function validateWorkspaceMembersLimit(value, min = 2, max = 50) {
  if (value === undefined || value === null || value === '') {
    return { valid: false, error: `Maximum members is required.` };
  }
  const num = Number(value);
  if (!Number.isInteger(num)) {
    return { valid: false, error: 'Maximum members must be a whole number.' };
  }
  if (num < min || num > max) {
    return {
      valid: false,
      error: `Maximum members must be between ${min} and ${max}.`,
    };
  }
  return { valid: true };
}

export function validateProjectUrl(url, label = 'URL') {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return { valid: true };
  }
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, error: `${label} must begin with http:// or https://` };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: `Please enter a valid ${label} (e.g. https://example.com).` };
  }
}

export function validateDisplayName(name) {
  return validateString(name, CHAR_LIMITS.DISPLAY_NAME, true, 'Display name');
}

export function validateEmail(email) {
  if (!email || !email.trim()) {
    return { valid: false, error: 'Email address is required.' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return { valid: false, error: 'Please enter a valid email address.' };
  }
  return { valid: true };
}

