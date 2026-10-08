/**
 * App-wide business rule constants derived from PRD specification.
 */
export const CHAR_LIMITS = {
  IDEA_TITLE: 150,
  IDEA_DESCRIPTION: 5000,
  PROBLEM_STATEMENT: 3000,
  PROPOSED_SOLUTION: 3000,
  COMMENT: 3000,
  SUGGESTION: 3000,
  TASK_TITLE: 200,
  TASK_DESCRIPTION: 2000,
  ORG_NAME: 100,
  DISPLAY_NAME: 50,
};

export const TASK_STATUS = {
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
};

export const ORG_STATUS = {
  IDEATION: 'ideation',
  PROJECT: 'project',
};

export const INVITE_CODE_LENGTH = 8;

export const PRIMARY_ROLES = [
  'Student',
  'Developer',
  'Designer',
  'Founder',
  'Product/Project Manager',
  'Researcher',
  'Other',
];

export const EXPERIENCE_LEVELS = [
  'Beginner',
  'Intermediate',
  'Advanced',
  'Expert',
];
