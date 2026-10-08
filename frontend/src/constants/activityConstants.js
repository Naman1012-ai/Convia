/**
 * Convia Phase 8: Centralized Activity Event Constants & Canonical Factory.
 * Defines supported activity event types, categories, and utility builders.
 */

export const ACTIVITY_EVENT_TYPES = Object.freeze({
  // Workspace events
  WORKSPACE_MEMBER_JOINED: 'workspace.member_joined',
  WORKSPACE_MEMBER_REMOVED: 'workspace.member_removed',

  // Idea events
  IDEA_CREATED: 'idea.created',
  IDEA_UPDATED: 'idea.updated',
  IDEA_SELECTED_AS_MVP: 'idea.selected_as_mvp',

  // Suggestion events
  SUGGESTION_CREATED: 'suggestion.created',
  SUGGESTION_ACCEPTED: 'suggestion.accepted',

  // Comment events
  COMMENT_CREATED: 'comment.created',

  // Question events
  QUESTION_CREATED: 'question.created',
  QUESTION_ANSWERED: 'question.answered',

  // Blueprint events
  BLUEPRINT_GENERATION_STARTED: 'blueprint.generation_started',
  BLUEPRINT_GENERATION_COMPLETED: 'blueprint.generation_completed',
  BLUEPRINT_GENERATION_FAILED: 'blueprint.generation_failed',
  BLUEPRINT_VERSION_APPROVED: 'blueprint.version_approved',

  // Task events
  TASK_CREATED: 'task.created',
  TASK_UPDATED: 'task.updated',
  TASK_COMPLETED: 'task.completed',
  TASK_ASSIGNED: 'task.assigned',

  // Chat events
  CHAT_MESSAGE: 'chat.message',
});

export const ACTIVITY_CATEGORIES = Object.freeze({
  WORKSPACE: 'workspace',
  IDEA: 'idea',
  SUGGESTION: 'suggestion',
  COMMENT: 'comment',
  QUESTION: 'question',
  BLUEPRINT: 'blueprint',
  TASK: 'task',
  CHAT: 'chat',
  OTHER: 'other',
});

/**
 * Returns the high-level category for a given activity event type.
 */
export function getActivityCategory(eventType) {
  if (!eventType || typeof eventType !== 'string') return ACTIVITY_CATEGORIES.OTHER;
  const prefix = eventType.split('.')[0];
  switch (prefix) {
    case 'workspace':
      return ACTIVITY_CATEGORIES.WORKSPACE;
    case 'idea':
      return ACTIVITY_CATEGORIES.IDEA;
    case 'suggestion':
      return ACTIVITY_CATEGORIES.SUGGESTION;
    case 'comment':
      return ACTIVITY_CATEGORIES.COMMENT;
    case 'question':
      return ACTIVITY_CATEGORIES.QUESTION;
    case 'blueprint':
      return ACTIVITY_CATEGORIES.BLUEPRINT;
    case 'chat':
      return ACTIVITY_CATEGORIES.CHAT;
    default:
      return ACTIVITY_CATEGORIES.OTHER;
  }
}

/**
 * Builds a deterministic deduplication key for an activity event.
 * Incorporates timestamp for recurring temporal lifecycle events (e.g. member joins, leaves, generation runs)
 * so multiple legitimate occurrences do not collide in immutable !data.exists() database rules.
 */
export function buildActivityDedupeKey({ workspaceId, eventType, resourceId, actorId, version = null, timestamp = null }) {
  const cleanOrg = String(workspaceId || '').trim();
  const cleanType = String(eventType || '').trim().replace(/\./g, '_');
  const cleanRes = String(resourceId || '').trim();
  const cleanActor = String(actorId || 'system').trim();
  const verSuffix = version ? `_v${String(version).replace(/\./g, '_')}` : '';

  const isRecurring =
    cleanType.includes('member_joined') ||
    cleanType.includes('member_removed') ||
    cleanType.includes('generation_started') ||
    cleanType.includes('generation_completed') ||
    cleanType.includes('version_approved') ||
    cleanType.includes('updated');

  const timeSuffix = isRecurring && timestamp ? `_${timestamp}` : '';

  return `act_${cleanOrg}_${cleanType}_${cleanRes}_${cleanActor}${verSuffix}${timeSuffix}`;
}

/**
 * Formats a default human-readable summary if none was explicitly provided.
 */
export function formatActivitySummary({ eventType, actorName = 'Someone', resourceTitle = '', metadata = {} }) {
  const targetTitle = resourceTitle ? `"${resourceTitle}"` : 'a resource';
  const name = actorName || 'Someone';

  switch (eventType) {
    case ACTIVITY_EVENT_TYPES.WORKSPACE_MEMBER_JOINED:
      return `${name} joined the workspace`;
    case ACTIVITY_EVENT_TYPES.WORKSPACE_MEMBER_REMOVED:
      return `${name} left the workspace`;
    case ACTIVITY_EVENT_TYPES.IDEA_CREATED:
      return `${name} created proposal ${targetTitle}`;
    case ACTIVITY_EVENT_TYPES.IDEA_UPDATED:
      return `${name} updated proposal ${targetTitle}`;
    case ACTIVITY_EVENT_TYPES.IDEA_SELECTED_AS_MVP:
      return `${name} selected proposal ${targetTitle} as the active project MVP`;
    case ACTIVITY_EVENT_TYPES.SUGGESTION_CREATED:
      return `${name} suggested an improvement on ${targetTitle}`;
    case ACTIVITY_EVENT_TYPES.SUGGESTION_ACCEPTED:
      return `${name} accepted a suggestion on ${targetTitle}`;
    case ACTIVITY_EVENT_TYPES.COMMENT_CREATED:
      return `${name} commented on ${targetTitle}`;
    case ACTIVITY_EVENT_TYPES.QUESTION_CREATED:
      return `${name} asked a question regarding ${targetTitle}`;
    case ACTIVITY_EVENT_TYPES.QUESTION_ANSWERED:
      return `${name} answered a question regarding ${targetTitle}`;
    case ACTIVITY_EVENT_TYPES.BLUEPRINT_GENERATION_STARTED:
      return `AI Blueprint generation started for ${targetTitle}`;
    case ACTIVITY_EVENT_TYPES.BLUEPRINT_GENERATION_COMPLETED:
      return `AI Blueprint generation completed for ${targetTitle}${metadata?.version ? ` (v${metadata.version})` : ''}`;
    case ACTIVITY_EVENT_TYPES.BLUEPRINT_GENERATION_FAILED:
      return `AI Blueprint generation could not be completed for ${targetTitle}`;
    case ACTIVITY_EVENT_TYPES.BLUEPRINT_VERSION_APPROVED:
      return `${name} approved & activated Blueprint ${metadata?.version ? `v${metadata.version}` : ''} for execution`;
    case ACTIVITY_EVENT_TYPES.TASK_CREATED:
      return `${name} created task ${targetTitle}`;
    case ACTIVITY_EVENT_TYPES.TASK_COMPLETED:
      return `${name} completed task ${targetTitle}`;
    case ACTIVITY_EVENT_TYPES.TASK_ASSIGNED:
      return `${name} assigned task ${targetTitle}${metadata?.assigneeName ? ` to ${metadata.assigneeName}` : ''}`;
    case ACTIVITY_EVENT_TYPES.TASK_UPDATED:
      return `${name} updated task ${targetTitle}`;
    case ACTIVITY_EVENT_TYPES.CHAT_MESSAGE:
      return `${name} shared a key message in chat`;
    default:
      return `${name} performed an action on ${targetTitle}`;
  }
}

/**
 * Builds a safe deep link URL for an activity event.
 */
export function buildActivityActionUrl({ workspaceId, resourceType, resourceId, parentResourceId, metadata = {} }) {
  if (!workspaceId) return '#';
  const base = `/workspaces/${workspaceId}`;

  switch (resourceType) {
    case 'idea':
      return `${base}/ideas/${resourceId}`;
    case 'suggestion':
      return `${base}/ideas/${parentResourceId || resourceId}?tab=suggestions&discussionId=${resourceId}`;
    case 'comment':
      return `${base}/ideas/${parentResourceId || resourceId}?tab=comments&discussionId=${resourceId}`;
    case 'question':
      return `${base}/ideas/${parentResourceId || resourceId}?tab=questions&discussionId=${resourceId}`;
    case 'task':
      return `${base}/tasks`;
    case 'blueprint':
      return `${base}/blueprint`;
    case 'chat':
      return metadata.channelId
        ? `${base}/chat?channel=${metadata.channelId}${metadata.messageId ? `&messageId=${metadata.messageId}` : ''}`
        : `${base}/chat`;
    case 'workspace':
      return `${base}/members`;
    default:
      return base;
  }
}

/**
 * Canonical Activity Factory.
 */
export function createCanonicalActivity({
  id = null,
  workspaceId,
  eventType,
  actorId,
  actorType = 'user',
  actorName = 'Someone',
  actorPhotoURL = null,
  resourceType,
  resourceId,
  resourceTitle = null,
  parentResourceId = null,
  summary = null,
  actionUrl = null,
  metadata = {},
  createdAt = Date.now(),
}) {
  if (!workspaceId || !eventType || !actorId || !resourceType || !resourceId) {
    throw new Error('workspaceId, eventType, actorId, resourceType, and resourceId are required for canonical activity.');
  }

  const generatedId = id || buildActivityDedupeKey({
    workspaceId,
    eventType,
    resourceId,
    actorId,
    version: metadata?.version,
    timestamp: createdAt,
  });

  const generatedSummary = summary || formatActivitySummary({
    eventType,
    actorName,
    resourceTitle,
    metadata,
  });

  const generatedActionUrl = actionUrl || buildActivityActionUrl({
    workspaceId,
    resourceType,
    resourceId,
    parentResourceId,
    metadata,
  });

  return {
    id: generatedId,
    workspaceId: String(workspaceId),
    eventType: String(eventType),
    actorId: String(actorId),
    actorType: actorType === 'system' ? 'system' : 'user',
    actorName: String(actorName || 'Someone'),
    actorPhotoURL: actorPhotoURL || null,
    resourceType: String(resourceType),
    resourceId: String(resourceId),
    resourceTitle: resourceTitle ? String(resourceTitle) : null,
    parentResourceId: parentResourceId ? String(parentResourceId) : null,
    summary: String(generatedSummary),
    actionUrl: String(generatedActionUrl),
    metadata: metadata && typeof metadata === 'object' ? metadata : {},
    createdAt: typeof createdAt === 'number' ? createdAt : Date.now(),
  };
}
