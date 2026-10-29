import { rtdbService } from './rtdbService';
import { inAppNotificationService } from './inAppNotificationService';
import { NOTIFICATION_TYPES } from '../constants/notificationConstants';
import { apiClient } from './apiClient';

/**
 * Real-time Task Comments and Discussion Service.
 * Persists comments under: `task_comments/${orgId}/${taskId}/${commentId}`
 * and synchronizes with `/api/workspaces/:orgId/tasks/:taskId/comments`.
 */
export const taskCommentService = {
  /**
   * Subscribe to live comments on a task.
   */
  subscribeToTaskComments: (orgId, taskId, callback) => {
    if (!orgId || !taskId || typeof callback !== 'function') {
      return () => {};
    }

    let isSubscribed = true;

    // 1. Initial immediate fetch via Authoritative API
    apiClient
      .get(`/api/workspaces/${encodeURIComponent(orgId)}/tasks/${encodeURIComponent(taskId)}/comments`)
      .then((res) => {
        if (!isSubscribed) return;
        const list = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : (res?.data?.data || []));
        callback(list);
      })
      .catch((err) => {
        console.warn('[taskCommentService] Initial comments fetch warning:', err?.message);
      });

    // 2. Real-time RTDB listener on tasks/:orgId/:taskId/comments (whitelisted in RTDB rules)
    const unsubTaskComments = rtdbService.subscribe(`tasks/${orgId}/${taskId}/comments`, (data) => {
      if (!isSubscribed) return;
      if (data && typeof data === 'object') {
        const list = Object.values(data).filter((c) => c && !c.isDeleted);
        list.sort((a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0));
        callback(list);
      } else if (data === null) {
        callback([]);
      }
    });

    // 3. Optional real-time RTDB listener on task_comments
    const unsubComments = rtdbService.subscribe(`task_comments/${orgId}/${taskId}`, (data) => {
      if (!isSubscribed) return;
      if (data && typeof data === 'object') {
        const list = Object.values(data).filter((c) => c && !c.isDeleted);
        list.sort((a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0));
        callback(list);
      }
    });

    return () => {
      isSubscribed = false;
      if (typeof unsubComments === 'function') unsubComments();
      if (typeof unsubTaskComments === 'function') unsubTaskComments();
    };
  },

  /**
   * Post a new comment on a task.
   */
  addTaskComment: async (orgId, taskId, content, actorUser, taskTitle = 'Task') => {
    if (!orgId || !taskId) throw new Error('Workspace ID and Task ID are required.');
    if (!content || !content.trim()) throw new Error('Comment message cannot be empty.');
    if (!actorUser?.uid) throw new Error('Authenticated user is required to comment.');

    const authorName =
      actorUser.displayName || actorUser.name || actorUser.email?.split('@')[0] || 'Team Member';
    const authorPhotoURL = actorUser.photoURL || null;
    const commentId = `comment_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const timestamp = Date.now();

    const localComment = {
      commentId,
      taskId,
      orgId,
      content: content.trim(),
      authorId: actorUser.uid,
      authorName,
      authorPhotoURL,
      createdAt: timestamp,
      updatedAt: timestamp,
      isDeleted: false,
    };

    // 1. Primary: Authoritative Backend Endpoint
    try {
      const res = await apiClient.post(
        `/api/workspaces/${encodeURIComponent(orgId)}/tasks/${encodeURIComponent(taskId)}/comments`,
        {
          content: localComment.content,
          authorName,
          authorPhotoURL,
        }
      );
      const serverComment = (res && typeof res === 'object' && res.commentId)
        ? res
        : (res?.data?.commentId ? res.data : localComment);
      return serverComment;
    } catch (_apiErr) {
      console.warn('[taskCommentService] API comment post fallback to RTDB:', _apiErr?.message);
    }

    // 2. Fallback: Direct RTDB Writes
    await Promise.all([
      rtdbService.setData(`task_comments/${orgId}/${taskId}/${commentId}`, localComment).catch(() => {}),
      rtdbService.setData(`tasks/${orgId}/${taskId}/comments/${commentId}`, localComment).catch(() => {}),
    ]);

    // Dispatch mention notification
    const mentionMatches = content.match(/@([a-zA-Z0-9_-]+)/g);
    if (mentionMatches && mentionMatches.length > 0) {
      inAppNotificationService
        .dispatchNotificationEvent(
          NOTIFICATION_TYPES.CHAT_MENTION,
          {
            workspaceId: orgId,
            taskId,
            taskTitle,
            commentId,
            snippet: content.substring(0, 80),
          },
          actorUser
        )
        .catch((err) => console.warn('[taskCommentService] Mention notice:', err.message));
    }

    return localComment;
  },

  /**
   * Soft-delete a comment.
   */
  deleteTaskComment: async (orgId, taskId, commentId) => {
    if (!orgId || !taskId || !commentId) return;

    try {
      await apiClient.delete(
        `/api/workspaces/${encodeURIComponent(orgId)}/tasks/${encodeURIComponent(taskId)}/comments/${encodeURIComponent(commentId)}`
      );
    } catch (_apiErr) {
      console.warn('[taskCommentService] API delete comment fallback to RTDB:', _apiErr?.message);
    }

    const deleteUpdate = {
      isDeleted: true,
      deletedAt: Date.now(),
    };

    await Promise.all([
      rtdbService.updateData(`task_comments/${orgId}/${taskId}/${commentId}`, deleteUpdate).catch(() => {}),
      rtdbService.updateData(`tasks/${orgId}/${taskId}/comments/${commentId}`, deleteUpdate).catch(() => {}),
    ]);
  },
};

export default taskCommentService;
