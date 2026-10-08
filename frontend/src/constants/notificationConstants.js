/**
 * Convia Phase 7: Canonical Notification Constants & Schema Contracts.
 * Single authoritative source of truth for in-app notification types, categories, and factories.
 */

export const NOTIFICATION_TYPES = {
  // 1. CHAT
  CHAT_MESSAGE: 'CHAT_MESSAGE',
  CHAT_MENTION: 'CHAT_MENTION',
  CHAT_REPLY: 'CHAT_REPLY',
  MESSAGE_REPLY: 'MESSAGE_REPLY',
  COMMUNITY_REPLY: 'COMMUNITY_REPLY',
  COMMUNITY_POST: 'COMMUNITY_POST',
  MENTION: 'MENTION',
  CHAT_REACTION: 'CHAT_REACTION',
  MESSAGE_REACTION: 'MESSAGE_REACTION',

  // 2. BLUEPRINT
  BLUEPRINT_COMPLETED: 'BLUEPRINT_COMPLETED',
  BLUEPRINT_FAILED: 'BLUEPRINT_FAILED',
  BLUEPRINT_VERSION_APPROVED: 'BLUEPRINT_VERSION_APPROVED',

  // 3. IDEA
  IDEA_POSTED: 'IDEA_POSTED',
  IDEA_CREATED: 'IDEA_CREATED',
  IDEA_ACTIVITY: 'IDEA_ACTIVITY',

  // 4. IDEA SUGGESTION
  IDEA_SUGGESTION: 'IDEA_SUGGESTION',
  IDEA_SUGGESTION_CREATED: 'IDEA_SUGGESTION_CREATED',
  IDEA_SUGGESTION_ACCEPTED: 'IDEA_SUGGESTION_ACCEPTED',

  // 5. COMMENT
  IDEA_COMMENT: 'IDEA_COMMENT',
  COMMENT_CREATED: 'COMMENT_CREATED',

  // 6. QUESTION
  IDEA_QUESTION: 'IDEA_QUESTION',
  QUESTION_CREATED: 'QUESTION_CREATED',
  QUESTION_ANSWERED: 'QUESTION_ANSWERED',

  // 7. WORKSPACE MEMBERSHIP
  WORKSPACE_MEMBER_JOINED: 'WORKSPACE_MEMBER_JOINED',
  WORKSPACE_MEMBER_LEFT: 'WORKSPACE_MEMBER_LEFT',
  WORKSPACE_MEMBER_INVITED: 'WORKSPACE_MEMBER_INVITED',
  INVITATION_DECLINED: 'INVITATION_DECLINED',

  // 8. TASKS & PROJECT EXECUTION
  TASK_ASSIGNED: 'TASK_ASSIGNED',
  TASK_COMPLETED: 'TASK_COMPLETED',
  TASK_STATUS_CHANGED: 'TASK_STATUS_CHANGED',

  // SYSTEM / ADMIN
  ADMIN_BROADCAST: 'ADMIN_BROADCAST',
};

export const NOTIFICATION_CATEGORIES = {
  CHAT: 'chat',
  BLUEPRINT: 'blueprint',
  IDEA: 'idea',
  SUGGESTION: 'suggestion',
  COMMENT: 'comment',
  QUESTION: 'question',
  TASK: 'task',
  SYSTEM: 'system',
};

/**
 * Authoritative set of notification types permitted to trigger FCM browser push notifications.
 * All other notification types are either IN-APP ONLY or suppressed from notification systems.
 */
export const PUSH_ALLOWED_NOTIFICATION_TYPES = new Set([
  NOTIFICATION_TYPES.CHAT_MENTION,
  NOTIFICATION_TYPES.MENTION,
  NOTIFICATION_TYPES.BLUEPRINT_FAILED,
  NOTIFICATION_TYPES.BLUEPRINT_VERSION_APPROVED,
  'BLUEPRINT_APPROVED',
  NOTIFICATION_TYPES.TASK_ASSIGNED,
  NOTIFICATION_TYPES.WORKSPACE_MEMBER_INVITED,
  'MEMBER_INVITED',
  NOTIFICATION_TYPES.ADMIN_BROADCAST,
]);

/**
 * Checks whether an event type is authorized for FCM browser push delivery.
 * @param {string} type - Notification type
 * @returns {boolean}
 */
export function isPushNotificationAllowed(type) {
  return Boolean(type && PUSH_ALLOWED_NOTIFICATION_TYPES.has(type));
}

export function getNotificationCategory(type) {
  switch (type) {
    case NOTIFICATION_TYPES.CHAT_MESSAGE:
    case NOTIFICATION_TYPES.CHAT_MENTION:
    case NOTIFICATION_TYPES.CHAT_REPLY:
    case NOTIFICATION_TYPES.MESSAGE_REPLY:
    case NOTIFICATION_TYPES.COMMUNITY_REPLY:
    case NOTIFICATION_TYPES.COMMUNITY_POST:
    case NOTIFICATION_TYPES.MENTION:
    case NOTIFICATION_TYPES.CHAT_REACTION:
    case NOTIFICATION_TYPES.MESSAGE_REACTION:
      return NOTIFICATION_CATEGORIES.CHAT;

    case NOTIFICATION_TYPES.BLUEPRINT_COMPLETED:
    case NOTIFICATION_TYPES.BLUEPRINT_FAILED:
    case NOTIFICATION_TYPES.BLUEPRINT_VERSION_APPROVED:
      return NOTIFICATION_CATEGORIES.BLUEPRINT;

    case NOTIFICATION_TYPES.IDEA_POSTED:
    case NOTIFICATION_TYPES.IDEA_CREATED:
    case NOTIFICATION_TYPES.IDEA_ACTIVITY:
      return NOTIFICATION_CATEGORIES.IDEA;

    case NOTIFICATION_TYPES.IDEA_SUGGESTION:
    case NOTIFICATION_TYPES.IDEA_SUGGESTION_CREATED:
    case NOTIFICATION_TYPES.IDEA_SUGGESTION_ACCEPTED:
      return NOTIFICATION_CATEGORIES.SUGGESTION;

    case NOTIFICATION_TYPES.IDEA_COMMENT:
    case NOTIFICATION_TYPES.COMMENT_CREATED:
      return NOTIFICATION_CATEGORIES.COMMENT;

    case NOTIFICATION_TYPES.IDEA_QUESTION:
    case NOTIFICATION_TYPES.QUESTION_CREATED:
    case NOTIFICATION_TYPES.QUESTION_ANSWERED:
      return NOTIFICATION_CATEGORIES.QUESTION;

    case NOTIFICATION_TYPES.TASK_ASSIGNED:
    case NOTIFICATION_TYPES.TASK_COMPLETED:
    case NOTIFICATION_TYPES.TASK_STATUS_CHANGED:
      return NOTIFICATION_CATEGORIES.TASK;

    case NOTIFICATION_TYPES.ADMIN_BROADCAST:
    default:
      return NOTIFICATION_CATEGORIES.SYSTEM;
  }
}

/**
 * Default user notification preferences.
 */
export const DEFAULT_NOTIFICATION_PREFERENCES = {
  [NOTIFICATION_CATEGORIES.CHAT]: true,
  [NOTIFICATION_CATEGORIES.BLUEPRINT]: true,
  [NOTIFICATION_CATEGORIES.IDEA]: true,
  [NOTIFICATION_CATEGORIES.SUGGESTION]: true,
  [NOTIFICATION_CATEGORIES.COMMENT]: true,
  [NOTIFICATION_CATEGORIES.QUESTION]: true,
  [NOTIFICATION_CATEGORIES.TASK]: true,
  [NOTIFICATION_CATEGORIES.SYSTEM]: true,
};

/**
 * Builds a deterministic deduplication key for notifications to prevent duplicates.
 */
export function buildNotificationDedupeKey({
  workspaceId = 'global',
  type,
  resourceId = 'res',
  recipientId,
  actorId = 'system',
}) {
  const cleanOrg = (workspaceId || 'global').trim();
  const cleanType = (type || 'general').trim();
  const cleanRes = (resourceId || 'res').trim();
  const cleanRecip = (recipientId || 'all').trim();
  const cleanActor = (actorId || 'system').trim();

  return `${cleanOrg}_${cleanType}_${cleanRes}_${cleanActor}_${cleanRecip}`;
}

/**
 * Builds canonical deep-link navigation URL based on resource type and context.
 */
export function buildNotificationActionUrl({
  type,
  workspaceId = null,
  resourceId = null,
  metadata = {},
}) {
  const org = workspaceId ? String(workspaceId).trim() : null;

  switch (type) {
    case NOTIFICATION_TYPES.CHAT_MESSAGE:
    case NOTIFICATION_TYPES.CHAT_MENTION:
    case NOTIFICATION_TYPES.MENTION:
    case NOTIFICATION_TYPES.CHAT_REACTION:
    case NOTIFICATION_TYPES.MESSAGE_REACTION: {
      const channel = metadata.channelId || 'general';
      const msgId = metadata.messageId || resourceId;
      if (org === 'community' || org === 'public') {
        return `/community?messageId=${msgId}`;
      }
      return org
        ? `/workspaces/${org}/chat?channel=${channel}&messageId=${msgId}`
        : `/dashboard`;
    }

    case NOTIFICATION_TYPES.CHAT_REPLY:
    case NOTIFICATION_TYPES.MESSAGE_REPLY:
    case NOTIFICATION_TYPES.COMMUNITY_REPLY: {
      const channel = metadata.channelId || 'general';
      const parentId = metadata.parentMessageId || metadata.threadId;
      const replyId = metadata.replyId || resourceId;
      if (org === 'community' || org === 'public' || type === NOTIFICATION_TYPES.COMMUNITY_REPLY) {
        return `/community?threadId=${parentId || replyId}`;
      }
      return org
        ? `/workspaces/${org}/chat?channel=${channel}&threadId=${parentId}&replyId=${replyId}`
        : `/dashboard`;
    }

    case NOTIFICATION_TYPES.COMMUNITY_POST: {
      const msgId = metadata.messageId || resourceId;
      return `/community?messageId=${msgId}`;
    }

    case NOTIFICATION_TYPES.BLUEPRINT_COMPLETED:
    case NOTIFICATION_TYPES.BLUEPRINT_FAILED:
    case NOTIFICATION_TYPES.BLUEPRINT_VERSION_APPROVED:
      return org ? `/workspaces/${org}/blueprint` : `/dashboard`;

    case NOTIFICATION_TYPES.IDEA_POSTED:
    case NOTIFICATION_TYPES.IDEA_CREATED:
    case NOTIFICATION_TYPES.IDEA_ACTIVITY:
      return org
        ? `/workspaces/${org}/ideas/${resourceId}`
        : `/explore?ideaId=${resourceId}`;

    case NOTIFICATION_TYPES.IDEA_SUGGESTION:
    case NOTIFICATION_TYPES.IDEA_SUGGESTION_CREATED:
    case NOTIFICATION_TYPES.IDEA_SUGGESTION_ACCEPTED: {
      const ideaId = metadata.ideaId || resourceId;
      const discId = metadata.discussionId || resourceId;
      return org
        ? `/workspaces/${org}/ideas/${ideaId}?tab=suggestions&discussionId=${discId}`
        : `/explore?ideaId=${ideaId}&tab=suggestions`;
    }

    case NOTIFICATION_TYPES.IDEA_COMMENT:
    case NOTIFICATION_TYPES.COMMENT_CREATED: {
      const ideaId = metadata.ideaId || resourceId;
      const discId = metadata.discussionId || resourceId;
      return org
        ? `/workspaces/${org}/ideas/${ideaId}?tab=comments&discussionId=${discId}`
        : `/explore?ideaId=${ideaId}&tab=comments`;
    }

    case NOTIFICATION_TYPES.IDEA_QUESTION:
    case NOTIFICATION_TYPES.QUESTION_CREATED:
    case NOTIFICATION_TYPES.QUESTION_ANSWERED: {
      const ideaId = metadata.ideaId || resourceId;
      const discId = metadata.discussionId || resourceId;
      return org
        ? `/workspaces/${org}/ideas/${ideaId}?tab=questions&discussionId=${discId}`
        : `/explore?ideaId=${ideaId}&tab=questions`;
    }

    case NOTIFICATION_TYPES.WORKSPACE_MEMBER_JOINED:
    case NOTIFICATION_TYPES.WORKSPACE_MEMBER_LEFT:
    case NOTIFICATION_TYPES.WORKSPACE_MEMBER_INVITED:
    case NOTIFICATION_TYPES.INVITATION_DECLINED:
      return org ? `/workspaces/${org}/members` : `/dashboard`;

    case NOTIFICATION_TYPES.TASK_ASSIGNED:
    case NOTIFICATION_TYPES.TASK_COMPLETED:
    case NOTIFICATION_TYPES.TASK_STATUS_CHANGED: {
      const taskId = metadata.taskId || resourceId;
      return org
        ? `/workspaces/${org}/tasks?taskId=${taskId}`
        : `/dashboard`;
    }

    case NOTIFICATION_TYPES.ADMIN_BROADCAST:
    default:
      return metadata.actionUrl || (org ? `/workspaces/${org}` : `/dashboard`);
  }
}

/**
 * Factory to create a clean, canonical Convia In-App Notification object.
 */
export function createCanonicalNotification({
  id = null,
  notificationId,
  recipientId,
  workspaceId = null,
  orgId = null,
  type,
  title,
  body,
  previewText = '',
  actorId = 'system',
  senderId = null,
  actorDisplayName = null,
  actorName = 'Member',
  senderName = null,
  actorAvatar = '',
  senderAvatar = '',
  entityType = '',
  resourceType = '',
  entityId = '',
  resourceId = '',
  secondaryEntityId = null,
  actionUrl = '',
  metadata = {},
  createdAt = Date.now(),
  read = false,
}) {
  const finalNotifId = String(id || notificationId).trim();
  const effectiveOrg = (workspaceId || orgId || null);
  const isSpecialOrg = effectiveOrg === 'community' || effectiveOrg === 'public' || effectiveOrg === 'global';
  const effectiveActorId = (senderId || actorId || 'system');
  const effectiveActorName = (actorDisplayName || senderName || actorName || 'Member');
  const effectiveActorAvatar = (senderAvatar || actorAvatar || '');
  const effectiveBody = (body || previewText || '').trim();
  const effectiveEntityType = (entityType || resourceType || '');
  const effectiveEntityId = (entityId || resourceId || '');
  const effectiveSecondaryId = (
    secondaryEntityId ||
    metadata?.secondaryEntityId ||
    metadata?.parentMessageId ||
    metadata?.commentId ||
    metadata?.replyId ||
    null
  );

  const dedupeKey = buildNotificationDedupeKey({
    workspaceId: effectiveOrg,
    type,
    resourceId: effectiveEntityId,
    recipientId,
    actorId: effectiveActorId,
  });

  const resolvedActionUrl = actionUrl || buildNotificationActionUrl({
    type,
    workspaceId: effectiveOrg,
    resourceId: effectiveEntityId,
    metadata,
  });

  return {
    id: finalNotifId,
    notificationId: finalNotifId,
    recipientId: String(recipientId).trim(),
    workspaceId: effectiveOrg ? String(effectiveOrg).trim() : null,
    orgId: (effectiveOrg && !isSpecialOrg) ? String(effectiveOrg).trim() : null,
    type: String(type).trim(),
    title: String(title || 'New Notification').trim(),
    body: effectiveBody.substring(0, 300),
    previewText: effectiveBody.substring(0, 150),
    actorId: effectiveActorId,
    actorDisplayName: effectiveActorName,
    actorName: effectiveActorName,
    senderId: effectiveActorId,
    senderName: effectiveActorName,
    actorAvatar: effectiveActorAvatar,
    senderAvatar: effectiveActorAvatar,
    entityType: effectiveEntityType,
    resourceType: effectiveEntityType,
    entityId: effectiveEntityId,
    resourceId: effectiveEntityId,
    secondaryEntityId: effectiveSecondaryId,
    read: Boolean(read),
    createdAt: typeof createdAt === 'number' ? createdAt : Date.now(),
    actionUrl: resolvedActionUrl,
    metadata: metadata && typeof metadata === 'object' ? metadata : {},
    dedupeKey,
  };
}
