/**
 * Single Authoritative Database Paths for Firebase Realtime Database.
 * Shared between backend services and frontend models.
 */
export const DB_PATHS = {
  USERS: 'users',
  USER_NOTIFICATIONS: 'user_notifications',
  ORGANIZATIONS: 'organizations',
  ORGANIZATION_MEMBERS: 'organization_members',
  WORKSPACES_METADATA: 'workspaces',
  IDEAS: 'ideas',
  DISCUSSIONS: 'discussions',
  BLUEPRINTS: 'blueprints',
  TASKS: 'tasks',
  PLATFORM_SETTINGS: 'platform_settings',
  ANNOUNCEMENTS: 'announcements',
  CHAT_MESSAGES: 'chat_messages', // Retained legacy constant for backward compatibility
  WORKSPACE_CHATS: 'workspaceChats', // Canonical root path for workspace chat system
  GLOBAL_STATS: 'globalStats',
  USER_SAVED_DISCUSSIONS: 'user_saved_discussions',
  FCM_TOKENS: 'fcm_tokens',
  FCM_DELIVERY_LEDGER: 'fcm_delivery_ledger',
};

/**
 * Builds the canonical RTDB/Firestore path for a user profile: users/{uid}
 * Strictly requires a non-empty uid.
 */
export const getUserProfilePath = (uid) => {
  if (!uid || typeof uid !== 'string' || !uid.trim()) {
    throw new Error('[databasePaths] uid is required for user profile path.');
  }
  return `users/${uid.trim()}`;
};

/**
 * Builds the canonical RTDB path for workspace discussions: discussions/{orgId}/{ideaId}/{discussionId}
 * Strictly requires a non-empty orgId and ideaId. Never defaults to public!
 */
export const getWorkspaceDiscussionPath = (orgId, ideaId, discussionId = null) => {
  if (!orgId || typeof orgId !== 'string' || !orgId.trim()) {
    throw new Error('[databasePaths] orgId is required for workspace discussion path.');
  }
  if (!ideaId || typeof ideaId !== 'string' || !ideaId.trim()) {
    throw new Error('[databasePaths] ideaId is required for workspace discussion path.');
  }
  const cleanOrg = orgId.trim();
  const cleanIdea = ideaId.trim();
  if (!discussionId) return `discussions/${cleanOrg}/${cleanIdea}`;
  return `discussions/${cleanOrg}/${cleanIdea}/${String(discussionId).trim()}`;
};

/**
 * Builds the canonical RTDB path for public discussions: discussions/public/{ideaId}/{discussionId}
 * Strictly requires a non-empty ideaId.
 */
export const getPublicDiscussionPath = (ideaId, discussionId = null) => {
  if (!ideaId || typeof ideaId !== 'string' || !ideaId.trim()) {
    throw new Error('[databasePaths] ideaId is required for public discussion path.');
  }
  const cleanIdea = ideaId.trim();
  if (!discussionId) return `discussions/public/${cleanIdea}`;
  return `discussions/public/${cleanIdea}/${String(discussionId).trim()}`;
};

/**
 * Unified discussion path builder with explicit scope selection.
 * Supports:
 *   getDiscussionPath({ scope: 'workspace' | 'public', orgId, ideaId, discussionId })
 *   getDiscussionPath(orgId, ideaId, discussionId) -> workspace path (requires orgId)
 */
export const getDiscussionPath = (arg1, arg2 = null, arg3 = null) => {
  if (arg1 && typeof arg1 === 'object') {
    const { scope = 'workspace', orgId, ideaId, discussionId = null } = arg1;
    if (scope === 'public') {
      return getPublicDiscussionPath(ideaId, discussionId);
    }
    return getWorkspaceDiscussionPath(orgId, ideaId, discussionId);
  }

  const orgId = arg1;
  const ideaId = arg2;
  const discussionId = arg3;

  if (orgId === 'public' || orgId === null || orgId === undefined) {
    if (orgId === 'public') {
      return getPublicDiscussionPath(ideaId, discussionId);
    }
    throw new Error('[databasePaths] Missing orgId. For public discussions, explicitly use getPublicDiscussionPath(ideaId) or pass orgId = "public".');
  }

  return getWorkspaceDiscussionPath(orgId, ideaId, discussionId);
};

/**
 * Builds the canonical RTDB root path for a workspace's chat: workspaceChats/{workspaceId}
 * Strictly requires a non-empty workspaceId.
 */
export const getWorkspaceChatRootPath = (workspaceId) => {
  if (!workspaceId || typeof workspaceId !== 'string' || !workspaceId.trim()) {
    throw new Error('[databasePaths] workspaceId is required for workspace chat root path.');
  }
  return `workspaceChats/${workspaceId.trim()}`;
};

/**
 * Builds the canonical RTDB root path for all channels in a workspace:
 * workspaceChats/{workspaceId}/channels
 */
export const getWorkspaceChannelsRootPath = (workspaceId) => {
  return `${getWorkspaceChatRootPath(workspaceId)}/channels`;
};

/**
 * Builds the canonical RTDB path for a channel node: workspaceChats/{workspaceId}/channels/{channelId}
 */
export const getChannelPath = (workspaceId, channelId = 'general') => {
  const root = getWorkspaceChatRootPath(workspaceId);
  const cleanChannel = (channelId || 'general').trim();
  if (!cleanChannel) {
    throw new Error('[databasePaths] channelId is required for channel path.');
  }
  return `${root}/channels/${cleanChannel}`;
};

/**
 * Builds the canonical RTDB path for a channel's messages collection:
 * workspaceChats/{workspaceId}/channels/{channelId}/messages
 */
export const getChannelMessagesPath = (workspaceId, channelId = 'general') => {
  return `${getChannelPath(workspaceId, channelId)}/messages`;
};

/**
 * Builds the canonical RTDB path for a specific message document:
 * workspaceChats/{workspaceId}/channels/{channelId}/messages/{messageId}
 */
export const getMessagePath = (workspaceId, channelId = 'general', messageId) => {
  if (!messageId || typeof messageId !== 'string' || !messageId.trim()) {
    throw new Error('[databasePaths] messageId is required for message path.');
  }
  return `${getChannelMessagesPath(workspaceId, channelId)}/${messageId.trim()}`;
};

/**
 * Builds the canonical RTDB path for a channel's metadata node:
 * workspaceChats/{workspaceId}/channels/{channelId}/metadata
 */
export const getChannelMetadataPath = (workspaceId, channelId = 'general') => {
  return `${getChannelPath(workspaceId, channelId)}/metadata`;
};

/**
 * Builds the canonical RTDB root path for a channel's message replies:
 * workspaceChats/{workspaceId}/channels/{channelId}/messageReplies
 */
export const getMessageRepliesRootPath = (workspaceId, channelId = 'general') => {
  return `${getChannelPath(workspaceId, channelId)}/messageReplies`;
};

/**
 * Builds the canonical RTDB path for a parent message's replies collection:
 * workspaceChats/{workspaceId}/channels/{channelId}/messageReplies/{messageId}
 */
export const getMessageRepliesPath = (workspaceId, channelId = 'general', messageId) => {
  if (!messageId || typeof messageId !== 'string' || !messageId.trim()) {
    throw new Error('[databasePaths] messageId is required for message replies path.');
  }
  return `${getMessageRepliesRootPath(workspaceId, channelId)}/${messageId.trim()}`;
};

/**
 * Builds the canonical RTDB path for a specific reply document:
 * workspaceChats/{workspaceId}/channels/{channelId}/messageReplies/{messageId}/{replyId}
 */
export const getMessageReplyPath = (workspaceId, channelId = 'general', messageId, replyId) => {
  if (!replyId || typeof replyId !== 'string' || !replyId.trim()) {
    throw new Error('[databasePaths] replyId is required for reply path.');
  }
  return `${getMessageRepliesPath(workspaceId, channelId, messageId)}/${replyId.trim()}`;
};

/**
 * Builds the canonical RTDB root path for a channel's message reactions:
 * workspaceChats/{workspaceId}/channels/{channelId}/messageReactions
 */
export const getMessageReactionsRootPath = (workspaceId, channelId = 'general') => {
  return `${getChannelPath(workspaceId, channelId)}/messageReactions`;
};

/**
 * Builds the canonical RTDB path for a specific message's reactions:
 * workspaceChats/{workspaceId}/channels/{channelId}/messageReactions/{messageId}
 */
export const getMessageReactionsPath = (workspaceId, channelId = 'general', messageId) => {
  if (!messageId || typeof messageId !== 'string' || !messageId.trim()) {
    throw new Error('[databasePaths] messageId is required for message reactions path.');
  }
  return `${getMessageReactionsRootPath(workspaceId, channelId)}/${messageId.trim()}`;
};

/**
 * Builds the canonical RTDB path for a specific user's emoji reaction on a message:
 * workspaceChats/{workspaceId}/channels/{channelId}/messageReactions/{messageId}/{emoji}/{uid}
 */
export const getMessageReactionPath = (workspaceId, channelId = 'general', messageId, emoji, uid) => {
  if (!emoji || typeof emoji !== 'string' || !emoji.trim()) {
    throw new Error('[databasePaths] emoji is required for reaction path.');
  }
  if (!uid || typeof uid !== 'string' || !uid.trim()) {
    throw new Error('[databasePaths] uid is required for reaction path.');
  }
  return `${getMessageReactionsPath(workspaceId, channelId, messageId)}/${emoji.trim()}/${uid.trim()}`;
};

/**
 * Builds the canonical RTDB root path for a channel's readState collection:
 * workspaceChats/{workspaceId}/channels/{channelId}/readState
 */
export const getChannelReadStateRootPath = (workspaceId, channelId = 'general') => {
  return `${getChannelPath(workspaceId, channelId)}/readState`;
};

/**
 * Builds the canonical RTDB path for a specific user's read state cursor:
 * workspaceChats/{workspaceId}/channels/{channelId}/readState/{uid}
 */
export const getChannelReadStatePath = (workspaceId, channelId = 'general', uid) => {
  if (!uid || typeof uid !== 'string' || !uid.trim()) {
    throw new Error('[databasePaths] uid is required for read state path.');
  }
  return `${getChannelReadStateRootPath(workspaceId, channelId)}/${uid.trim()}`;
};

/**
 * Builds the canonical RTDB root path for a user's in-app notifications:
 * user_notifications/{uid}
 */
export const getUserNotificationsRootPath = (uid) => {
  if (!uid || typeof uid !== 'string' || !uid.trim()) {
    throw new Error('[databasePaths] uid is required for user notifications root path.');
  }
  return `user_notifications/${uid.trim()}`;
};

/**
 * Builds the canonical RTDB path for a specific notification document:
 * user_notifications/{uid}/{notifId}
 */
export const getUserNotificationsPath = (uid, notifId) => {
  if (!notifId || typeof notifId !== 'string' || !notifId.trim()) {
    throw new Error('[databasePaths] notifId is required for user notification path.');
  }
  return `${getUserNotificationsRootPath(uid)}/${notifId.trim()}`;
};

/**
 * Builds the canonical RTDB root path for a channel's typing indicators:
 * workspaceChats/{workspaceId}/channels/{channelId}/typing
 */
export const getChannelTypingRootPath = (workspaceId, channelId = 'general') => {
  return `${getChannelPath(workspaceId, channelId)}/typing`;
};

/**
 * Builds the canonical RTDB path for a specific user's typing indicator in a channel:
 * workspaceChats/{workspaceId}/channels/{channelId}/typing/{uid}
 */
export const getChannelTypingPath = (workspaceId, channelId = 'general', uid) => {
  if (!uid || typeof uid !== 'string' || !uid.trim()) {
    throw new Error('[databasePaths] uid is required for typing path.');
  }
  return `${getChannelTypingRootPath(workspaceId, channelId)}/${uid.trim()}`;
};

/**
 * Builds the canonical RTDB root path for a reply thread's typing indicators:
 * workspaceChats/{workspaceId}/channels/{channelId}/typingThreads/{parentMessageId}
 */
export const getThreadTypingRootPath = (workspaceId, channelId = 'general', parentMessageId) => {
  if (!parentMessageId || typeof parentMessageId !== 'string' || !parentMessageId.trim()) {
    throw new Error('[databasePaths] parentMessageId is required for thread typing path.');
  }
  return `${getChannelPath(workspaceId, channelId)}/typingThreads/${parentMessageId.trim()}`;
};

/**
 * Builds the canonical RTDB path for a specific user's typing indicator in a thread:
 * workspaceChats/{workspaceId}/channels/{channelId}/typingThreads/{parentMessageId}/{uid}
 */
export const getThreadTypingPath = (workspaceId, channelId = 'general', parentMessageId, uid) => {
  if (!uid || typeof uid !== 'string' || !uid.trim()) {
    throw new Error('[databasePaths] uid is required for thread typing user path.');
  }
  return `${getThreadTypingRootPath(workspaceId, channelId, parentMessageId)}/${uid.trim()}`;
};

/**
 * Canonical RTDB path builders for Public Ideas Community Chat:
 * publicChats/ideas
 */
export const getPublicIdeasChatRootPath = () => 'publicChats/ideas';
export const getPublicIdeasChatMessagesPath = () => `${getPublicIdeasChatRootPath()}/messages`;
export const getPublicIdeasChatMessagePath = (messageId) => {
  if (!messageId || typeof messageId !== 'string' || !messageId.trim()) {
    throw new Error('[databasePaths] messageId is required for public ideas chat message path.');
  }
  return `${getPublicIdeasChatMessagesPath()}/${messageId.trim()}`;
};
export const getPublicIdeasChatTypingRootPath = () => `${getPublicIdeasChatRootPath()}/typing`;
export const getPublicIdeasChatTypingPath = (uid) => {
  if (!uid || typeof uid !== 'string' || !uid.trim()) {
    throw new Error('[databasePaths] uid is required for public ideas chat typing path.');
  }
  return `${getPublicIdeasChatTypingRootPath()}/${uid.trim()}`;
};

/**
 * Builds the canonical RTDB root path for Public Ideas Community Chat message replies:
 * publicChats/ideas/messageReplies
 */
export const getPublicIdeasChatRepliesRootPath = () => `${getPublicIdeasChatRootPath()}/messageReplies`;

/**
 * Builds the canonical RTDB path for a public parent message's replies:
 * publicChats/ideas/messageReplies/{messageId}
 */
export const getPublicIdeasChatMessageRepliesPath = (messageId) => {
  if (!messageId || typeof messageId !== 'string' || !messageId.trim()) {
    throw new Error('[databasePaths] messageId is required for public ideas chat message replies path.');
  }
  return `${getPublicIdeasChatRepliesRootPath()}/${messageId.trim()}`;
};

/**
 * Builds the canonical RTDB path for a specific reply to a public message:
 * publicChats/ideas/messageReplies/{messageId}/{replyId}
 */
export const getPublicIdeasChatMessageReplyPath = (messageId, replyId) => {
  if (!replyId || typeof replyId !== 'string' || !replyId.trim()) {
    throw new Error('[databasePaths] replyId is required for public ideas chat message reply path.');
  }
  return `${getPublicIdeasChatMessageRepliesPath(messageId)}/${replyId.trim()}`;
};

/**
 * Builds the canonical RTDB root path for Public Ideas Community Chat message reactions:
 * publicChats/ideas/messageReactions
 */
export const getPublicIdeasChatReactionsRootPath = () => `${getPublicIdeasChatRootPath()}/messageReactions`;

/**
 * Builds the canonical RTDB path for a public message's reactions:
 * publicChats/ideas/messageReactions/{messageId}
 */
export const getPublicIdeasChatMessageReactionsPath = (messageId) => {
  if (!messageId || typeof messageId !== 'string' || !messageId.trim()) {
    throw new Error('[databasePaths] messageId is required for public ideas chat message reactions path.');
  }
  return `${getPublicIdeasChatReactionsRootPath()}/${messageId.trim()}`;
};

/**
 * Builds the canonical RTDB path for a specific user's reaction to a public message:
 * publicChats/ideas/messageReactions/{messageId}/{emoji}/{uid}
 */
export const getPublicIdeasChatMessageReactionPath = (messageId, emoji, uid) => {
  if (!emoji || typeof emoji !== 'string' || !emoji.trim()) {
    throw new Error('[databasePaths] emoji is required for public ideas chat reaction path.');
  }
  if (!uid || typeof uid !== 'string' || !uid.trim()) {
    throw new Error('[databasePaths] uid is required for public ideas chat reaction path.');
  }
  return `${getPublicIdeasChatMessageReactionsPath(messageId)}/${emoji.trim()}/${uid.trim()}`;
};

/**
 * Builds the canonical RTDB root path for a user's saved discussions:
 * user_saved_discussions/{uid}
 */
export const getUserSavedDiscussionsPath = (uid) => {
  if (!uid || typeof uid !== 'string' || !uid.trim()) {
    throw new Error('[databasePaths] uid is required for saved discussions path.');
  }
  return `user_saved_discussions/${uid.trim()}`;
};

/**
 * Builds the canonical RTDB path for a specific saved discussion entry:
 * user_saved_discussions/{uid}/{messageId}
 */
export const getUserSavedDiscussionPath = (uid, messageId) => {
  if (!messageId || typeof messageId !== 'string' || !messageId.trim()) {
    throw new Error('[databasePaths] messageId is required for saved discussion item path.');
  }
  return `${getUserSavedDiscussionsPath(uid)}/${messageId.trim()}`;
};

/**
 * Builds the canonical RTDB path for the pinned community discussion ID:
 * publicChats/ideas/pinnedMessageId
 */
export const getPublicIdeasChatPinnedPath = () => `${getPublicIdeasChatRootPath()}/pinnedMessageId`;

/**
 * Builds the canonical RTDB path for the pinned community discussion object:
 * publicChats/ideas/pinned
 */
export const getPublicIdeasChatPinnedDiscussionPath = () => `${getPublicIdeasChatRootPath()}/pinned`;

/**
 * Builds the canonical RTDB root path for a user's FCM device tokens:
 * fcm_tokens/{uid}
 */
export const getFcmTokensRootPath = (uid) => {
  if (!uid || typeof uid !== 'string' || !uid.trim()) {
    throw new Error('[databasePaths] uid is required for FCM tokens root path.');
  }
  return `fcm_tokens/${uid.trim()}`;
};

/**
 * Builds the canonical RTDB path for a specific FCM device token registration:
 * fcm_tokens/{uid}/{tokenKey}
 */
export const getFcmTokenPath = (uid, tokenKey) => {
  if (!tokenKey || typeof tokenKey !== 'string' || !tokenKey.trim()) {
    throw new Error('[databasePaths] tokenKey is required for FCM token path.');
  }
  return `${getFcmTokensRootPath(uid)}/${tokenKey.trim()}`;
};

/**
 * Builds the canonical RTDB path for the authoritative push delivery ledger:
 * fcm_delivery_ledger/{notificationId}
 */
export const getFcmDeliveryLedgerPath = (notifId) => {
  if (!notifId || typeof notifId !== 'string' || !notifId.trim()) {
    throw new Error('[databasePaths] notifId is required for FCM delivery ledger path.');
  }
  return `fcm_delivery_ledger/${notifId.trim()}`;
};
