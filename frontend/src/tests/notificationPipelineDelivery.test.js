import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  NOTIFICATION_TYPES,
  NOTIFICATION_CATEGORIES,
  getNotificationCategory,
  buildNotificationActionUrl,
  isPushNotificationAllowed,
  PUSH_ALLOWED_NOTIFICATION_TYPES,
  createCanonicalNotification,
} from '../constants/notificationConstants.js';
import { validateReactionToggle } from '../utils/chatValidation.js';

describe('🔔 CONVIA NOTIFICATION PIPELINE DELIVERY CONTRACT SUITE', () => {
  it('1. validateReactionToggle preserves user object and returns sanitized userId and cleanEmoji', () => {
    const user = { uid: 'user_bob', displayName: 'Bob Tester' };
    const res = validateReactionToggle({
      workspaceId: 'ws_test',
      channelId: 'general',
      messageId: 'msg_999',
      emoji: '👍',
      user,
    });

    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.cleanEmoji, '👍');
    assert.strictEqual(res.userId, 'user_bob');
    assert.strictEqual(res.user, user);
  });

  it('2. PUSH_ALLOWED_NOTIFICATION_TYPES includes all chat, reaction, and community types', () => {
    assert.ok(isPushNotificationAllowed(NOTIFICATION_TYPES.CHAT_MESSAGE));
    assert.ok(isPushNotificationAllowed(NOTIFICATION_TYPES.CHAT_REACTION));
    assert.ok(isPushNotificationAllowed(NOTIFICATION_TYPES.MESSAGE_REPLY));
    assert.ok(isPushNotificationAllowed(NOTIFICATION_TYPES.COMMUNITY_REPLY));
    assert.ok(isPushNotificationAllowed(NOTIFICATION_TYPES.COMMUNITY_POST));
    assert.ok(PUSH_ALLOWED_NOTIFICATION_TYPES.has(NOTIFICATION_TYPES.CHAT_REACTION));
    assert.ok(PUSH_ALLOWED_NOTIFICATION_TYPES.has(NOTIFICATION_TYPES.COMMUNITY_REPLY));
    assert.ok(PUSH_ALLOWED_NOTIFICATION_TYPES.has(NOTIFICATION_TYPES.COMMUNITY_POST));
  });

  it('3. Category mappings handle community channels and reactions accurately', () => {
    assert.strictEqual(getNotificationCategory(NOTIFICATION_TYPES.CHAT_REACTION), NOTIFICATION_CATEGORIES.CHAT);
    assert.strictEqual(getNotificationCategory(NOTIFICATION_TYPES.COMMUNITY_REPLY), NOTIFICATION_CATEGORIES.CHAT);
    assert.strictEqual(getNotificationCategory(NOTIFICATION_TYPES.COMMUNITY_POST), NOTIFICATION_CATEGORIES.CHAT);
  });

  it('4. Action URL builders generate accurate deep links for Community and Workspace reactions', () => {
    // Community Reaction URL
    const commReactionUrl = buildNotificationActionUrl({
      type: NOTIFICATION_TYPES.CHAT_REACTION,
      workspaceId: 'community',
      resourceId: 'comm_msg_10',
      metadata: { messageId: 'comm_msg_10' },
    });
    assert.strictEqual(commReactionUrl, '/community?messageId=comm_msg_10');

    // Workspace Reaction URL
    const wsReactionUrl = buildNotificationActionUrl({
      type: NOTIFICATION_TYPES.CHAT_REACTION,
      workspaceId: 'ws_alpha',
      resourceId: 'msg_200',
      metadata: { channelId: 'general', messageId: 'msg_200' },
    });
    assert.strictEqual(wsReactionUrl, '/workspaces/ws_alpha/chat?channel=general&messageId=msg_200');
  });

  it('5. Action URL builders generate accurate deep links for Community replies and posts', () => {
    // Community Reply URL
    const replyUrl = buildNotificationActionUrl({
      type: NOTIFICATION_TYPES.COMMUNITY_REPLY,
      workspaceId: 'community',
      resourceId: 'reply_55',
      metadata: { parentMessageId: 'comm_msg_10', replyId: 'reply_55' },
    });
    assert.strictEqual(replyUrl, '/community?threadId=comm_msg_10');

    // Community Post URL
    const postUrl = buildNotificationActionUrl({
      type: NOTIFICATION_TYPES.COMMUNITY_POST,
      workspaceId: 'community',
      resourceId: 'comm_msg_20',
      metadata: { messageId: 'comm_msg_20' },
    });
    assert.strictEqual(postUrl, '/community?messageId=comm_msg_20');
  });

  it('6. createCanonicalNotification correctly formats CHAT_REACTION notifications', () => {
    const canonical = createCanonicalNotification({
      type: NOTIFICATION_TYPES.CHAT_REACTION,
      workspaceId: 'ws_alpha',
      channelId: 'general',
      recipientId: 'user_alice',
      actorId: 'user_bob',
      title: 'Bob reacted 👍 to your message',
      body: '"Great work on this!"',
      actionUrl: '/workspaces/ws_alpha/chat?channel=general&messageId=msg_100',
    });

    assert.strictEqual(canonical.type, NOTIFICATION_TYPES.CHAT_REACTION);
    assert.strictEqual(getNotificationCategory(canonical.type), NOTIFICATION_CATEGORIES.CHAT);
    assert.strictEqual(canonical.recipientId, 'user_alice');
    assert.strictEqual(canonical.actorId, 'user_bob');
    assert.strictEqual(canonical.actionUrl, '/workspaces/ws_alpha/chat?channel=general&messageId=msg_100');
    assert.strictEqual(canonical.read, false);
  });

  it('7. createCanonicalNotification correctly formats COMMUNITY_REPLY and COMMUNITY_POST notifications', () => {
    const replyCanonical = createCanonicalNotification({
      type: NOTIFICATION_TYPES.COMMUNITY_REPLY,
      workspaceId: 'community',
      recipientId: 'user_alice',
      actorId: 'user_bob',
      title: 'Bob replied to your community discussion',
      body: 'Bob: "I agree with this proposal"',
      actionUrl: '/community?threadId=comm_10&replyId=rep_1',
    });

    assert.strictEqual(replyCanonical.type, NOTIFICATION_TYPES.COMMUNITY_REPLY);
    assert.strictEqual(getNotificationCategory(replyCanonical.type), NOTIFICATION_CATEGORIES.CHAT);
    assert.strictEqual(replyCanonical.actionUrl, '/community?threadId=comm_10&replyId=rep_1');

    const postCanonical = createCanonicalNotification({
      type: NOTIFICATION_TYPES.COMMUNITY_POST,
      workspaceId: 'community',
      recipientId: 'user_alice',
      actorId: 'user_bob',
      title: 'New Community Discussion',
      body: 'Bob: "Welcome everyone"',
      actionUrl: '/community?threadId=comm_20',
    });

    assert.strictEqual(postCanonical.type, NOTIFICATION_TYPES.COMMUNITY_POST);
    assert.strictEqual(getNotificationCategory(postCanonical.type), NOTIFICATION_CATEGORIES.CHAT);
    assert.strictEqual(postCanonical.actionUrl, '/community?threadId=comm_20');
  });

  it('8. Action URL builders generate valid workspace-level and idea-level blueprint routes without 404', () => {
    // Workspace-level blueprint URL without specific ideaId
    const wsBpUrl = buildNotificationActionUrl({
      type: NOTIFICATION_TYPES.BLUEPRINT_COMPLETED,
      workspaceId: 'ws_alpha',
    });
    assert.strictEqual(wsBpUrl, '/workspaces/ws_alpha/blueprint');

    // Idea-specific blueprint URL
    const ideaBpUrl = buildNotificationActionUrl({
      type: NOTIFICATION_TYPES.BLUEPRINT_COMPLETED,
      workspaceId: 'ws_alpha',
      metadata: { ideaId: 'idea_mvp_1' },
    });
    assert.ok(ideaBpUrl.includes('/workspaces/ws_alpha/'));

    // Member and Task Action URLs
    const memberUrl = buildNotificationActionUrl({
      type: NOTIFICATION_TYPES.WORKSPACE_MEMBER_JOINED,
      workspaceId: 'ws_alpha',
    });
    assert.strictEqual(memberUrl, '/workspaces/ws_alpha/members');

    const taskUrl = buildNotificationActionUrl({
      type: NOTIFICATION_TYPES.TASK_ASSIGNED,
      workspaceId: 'ws_alpha',
      metadata: { taskId: 'task_100' },
    });
    assert.strictEqual(taskUrl, '/workspaces/ws_alpha/tasks?taskId=task_100');
  });
});
