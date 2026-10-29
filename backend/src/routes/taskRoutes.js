import express from 'express';
import { rtdbService } from '../services/rtdbService.js';
import { requireWorkspaceMember } from '../utils/workspaceAuthHelper.js';
import { notificationService } from '../services/notificationService.js';
import { NOTIFICATION_TYPES } from '../constants/notificationConstants.js';

export const taskRouter = express.Router({ mergeParams: true });

/**
 * Convia Phase 4 / Phase 9 Authoritative Task Management Router
 * Schema: /tasks/{workspaceId}/{taskId}
 * Enforces strict 5-role permission matrix:
 * - Owner & Team Captain: Full control
 * - Creator: Full control over own task
 * - Assignee: May update status/completion; cannot edit content, reassign, or delete
 * - Other Member: May create tasks; cannot edit, reassign, or delete others' tasks
 * - Removed / Non-Member: Zero access
 */

function checkPrivilegedRole(membership) {
  return Boolean(
    membership.isOwner ||
    membership.isTeamCaptain ||
    membership.isSecondOwner ||
    membership.role === 'team_captain' ||
    membership.role === 'admin'
  );
}

/**
 * POST /api/workspaces/:workspaceId/tasks
 * Create a new task. Any active workspace member may create a task.
 */
taskRouter.post('/', async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId || req.params.orgId;
    const userUid = req.user?.uid;

    if (!userUid) {
      return res.status(401).json({ success: false, error: { message: 'Authentication required.' } });
    }

    const membership = await requireWorkspaceMember(workspaceId, userUid);
    const isPrivileged = checkPrivilegedRole(membership);
    if (!isPrivileged) {
      return res.status(403).json({
        success: false,
        error: { message: 'Forbidden: Only Team Captains and Workspace Owners can create tasks.', code: 'UNAUTHORIZED_TASK_CREATION' },
      });
    }
    const { title, description, priority, dueDate, assignedTo, assignedToName, projectId } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ success: false, error: { message: 'Task title is required.' } });
    }

    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();

    const newTask = {
      taskId,
      orgId: workspaceId,
      projectId: projectId || 'active_project',
      sprintId: req.body.sprintId || null,
      sprintName: req.body.sprintName || null,
      title: title.trim(),
      description: typeof description === 'string' ? description.trim() : '',
      priority: priority || 'Medium',
      status: req.body.status || 'Todo',
      dueDate: dueDate || '',
      assignedTo: assignedTo || '',
      assignedToName: assignedToName || 'Unassigned',
      createdBy: userUid,
      createdByName: req.user.displayName || req.user.email || 'Team Member',
      createdAt: now,
      updatedAt: now,
      completedAt: req.body.status === 'Completed' ? now : null,
      isDeleted: false,
    };

    await rtdbService.setData(`tasks/${workspaceId}/${taskId}`, newTask);

    // If task was assigned to an active sprint, dynamically append taskId to active sprint roster
    if (newTask.sprintId) {
      try {
        const activeSprint = (await rtdbService.getData(`sprints/${workspaceId}/current`)) || {};
        if (activeSprint?.sprintId === newTask.sprintId && activeSprint?.status === 'active') {
          const currentTaskIds = Array.isArray(activeSprint.taskIds) ? [...activeSprint.taskIds] : [];
          if (!currentTaskIds.includes(taskId)) {
            currentTaskIds.push(taskId);
            const updatedSprint = {
              ...activeSprint,
              taskIds: currentTaskIds,
              totalSprintTasks: currentTaskIds.length,
              updatedAt: now,
            };
            await rtdbService.updateMultiple({
              [`sprints/${workspaceId}/current`]: updatedSprint,
              [`sprints/${workspaceId}/${newTask.sprintId}`]: updatedSprint,
              [`organizations/${workspaceId}/activeSprint`]: updatedSprint,
              [`workspaces/${workspaceId}/sprint`]: updatedSprint,
            });
          }
        }
      } catch (sprintSyncErr) {
        console.warn('[taskRoutes] Error syncing task to active sprint:', sprintSyncErr?.message);
      }
    }

    // Phase 7: Dispatch TASK_ASSIGNED notification if assigned to another team member
    if (newTask.assignedTo && newTask.assignedTo !== userUid) {
      notificationService.dispatchNotificationEvent(
        NOTIFICATION_TYPES.TASK_ASSIGNED,
        {
          workspaceId,
          taskId,
          taskTitle: newTask.title,
          assignedToUid: newTask.assignedTo,
          priority: newTask.priority,
        },
        req.user
      ).catch((e) => console.warn('[taskRoutes] Task assignment notification warning:', e?.message || e));
    }

    res.status(201).json({ success: true, data: newTask });
  } catch (err) {
    const status = err.statusCode || (err.message.includes('Unauthorized') ? 403 : 500);
    res.status(status).json({ success: false, error: { message: err.message || 'Failed to create task.' } });
  }
});

/**
 * GET /api/workspaces/:workspaceId/tasks
 * List non-deleted tasks for workspace.
 */
taskRouter.get('/', async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId || req.params.orgId;
    const userUid = req.user?.uid;

    if (!userUid) {
      return res.status(401).json({ success: false, error: { message: 'Authentication required.' } });
    }

    await requireWorkspaceMember(workspaceId, userUid);

    const tasksObj = (await rtdbService.getData(`tasks/${workspaceId}`)) || {};
    const taskList = Object.values(tasksObj).filter((t) => t && !t.isDeleted);

    res.json({ success: true, data: taskList });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, error: { message: err.message } });
  }
});

/**
 * GET /api/workspaces/:workspaceId/tasks/:taskId
 * Retrieve single task.
 */
taskRouter.get('/:taskId', async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId || req.params.orgId;
    const taskId = req.params.taskId;
    const userUid = req.user?.uid;

    if (!userUid) {
      return res.status(401).json({ success: false, error: { message: 'Authentication required.' } });
    }

    await requireWorkspaceMember(workspaceId, userUid);

    const task = await rtdbService.getData(`tasks/${workspaceId}/${taskId}`);
    if (!task || task.isDeleted) {
      return res.status(404).json({ success: false, error: { message: 'Task not found.' } });
    }

    res.json({ success: true, data: task });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, error: { message: err.message } });
  }
});

/**
 * PATCH /api/workspaces/:workspaceId/tasks/:taskId
 * Modify task fields following strict authorization matrix.
 */
taskRouter.patch('/:taskId', async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId || req.params.orgId;
    const taskId = req.params.taskId;
    const userUid = req.user?.uid;

    if (!userUid) {
      return res.status(401).json({ success: false, error: { message: 'Authentication required.' } });
    }

    const membership = await requireWorkspaceMember(workspaceId, userUid);
    const existingTask = await rtdbService.getData(`tasks/${workspaceId}/${taskId}`);

    if (!existingTask) {
      return res.status(404).json({ success: false, error: { message: 'Task not found.' } });
    }

    if (existingTask.orgId && existingTask.orgId !== workspaceId) {
      return res.status(403).json({ success: false, error: { message: 'Cross-workspace task mutation is strictly forbidden.' } });
    }

    // 1. Strict Immutable Fields Defense
    const immutableFields = ['taskId', 'orgId', 'createdBy', 'createdAt'];
    for (const field of immutableFields) {
      if (req.body[field] !== undefined && req.body[field] !== existingTask[field]) {
        return res.status(400).json({
          success: false,
          error: { message: `Protected field '${field}' cannot be modified.`, code: 'IMMUTABLE_FIELD' },
        });
      }
    }

    const isPrivileged = checkPrivilegedRole(membership);

    // 2. Strict Governance Verification: Only Team Captains or Workspace Owners can modify tasks
    if (!isPrivileged) {
      return res.status(403).json({
        success: false,
        error: { message: 'Forbidden: Only Team Captains and Workspace Owners can modify tasks.', code: 'UNAUTHORIZED_TASK_MUTATION' },
      });
    }

    const now = Date.now();
    const patch = { ...req.body, updatedAt: now };

    // Remove protected keys if present
    delete patch.taskId;
    delete patch.orgId;
    delete patch.createdBy;
    delete patch.createdAt;

    if (patch.status === 'Completed') {
      patch.completedAt = now;
    } else if (patch.status && patch.status !== 'Completed') {
      patch.completedAt = null;
    }

    await rtdbService.updateData(`tasks/${workspaceId}/${taskId}`, patch);
    const updatedTask = { ...existingTask, ...patch };

    // Phase 7: Dispatch Task Notifications on Status or Assignee Change
    if (patch.status === 'Completed' && existingTask.status !== 'Completed') {
      notificationService.dispatchNotificationEvent(
        NOTIFICATION_TYPES.TASK_COMPLETED,
        {
          workspaceId,
          taskId,
          taskTitle: updatedTask.title || 'Task',
          createdByUid: existingTask.createdBy || null,
        },
        req.user
      ).catch((e) => console.warn('[taskRoutes] Task completion notification warning:', e?.message || e));
    } else if (patch.status && patch.status !== existingTask.status) {
      const targetUser = existingTask.assignedTo || existingTask.createdBy;
      if (targetUser && targetUser !== userUid) {
        notificationService.dispatchNotificationEvent(
          NOTIFICATION_TYPES.TASK_STATUS_CHANGED,
          {
            workspaceId,
            taskId,
            taskTitle: updatedTask.title || 'Task',
            oldStatus: existingTask.status || 'Todo',
            newStatus: patch.status,
            targetUid: targetUser,
          },
          req.user
        ).catch((e) => console.warn('[taskRoutes] Task status changed notification warning:', e?.message || e));
      }
    }

    if (patch.assignedTo && patch.assignedTo !== existingTask.assignedTo && patch.assignedTo !== userUid) {
      notificationService.dispatchNotificationEvent(
        NOTIFICATION_TYPES.TASK_ASSIGNED,
        {
          workspaceId,
          taskId,
          taskTitle: updatedTask.title || 'Task',
          assignedToUid: patch.assignedTo,
          priority: updatedTask.priority || 'Medium',
        },
        req.user
      ).catch((e) => console.warn('[taskRoutes] Reassignment notification warning:', e?.message || e));
    }

    res.json({ success: true, data: updatedTask });
  } catch (err) {
    const status = err.statusCode || (err.message.includes('Unauthorized') ? 403 : 500);
    res.status(status).json({ success: false, error: { message: err.message || 'Failed to update task.' } });
  }
});

/**
 * DELETE /api/workspaces/:workspaceId/tasks/:taskId
 * Delete task (creator, captain, or owner ONLY).
 */
taskRouter.delete('/:taskId', async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId || req.params.orgId;
    const taskId = req.params.taskId;
    const userUid = req.user?.uid;

    if (!userUid) {
      return res.status(401).json({ success: false, error: { message: 'Authentication required.' } });
    }

    const membership = await requireWorkspaceMember(workspaceId, userUid);
    const existingTask = await rtdbService.getData(`tasks/${workspaceId}/${taskId}`);

    if (!existingTask) {
      return res.status(404).json({ success: false, error: { message: 'Task not found.' } });
    }

    if (existingTask.orgId && existingTask.orgId !== workspaceId) {
      return res.status(403).json({ success: false, error: { message: 'Cross-workspace task deletion is forbidden.' } });
    }

    const isPrivileged = checkPrivilegedRole(membership);

    // Strict Governance Enforcement: Only Team Captains or Workspace Owners can delete tasks
    if (!isPrivileged) {
      return res.status(403).json({
        success: false,
        error: { message: 'Forbidden: Only Team Captains and Workspace Owners can delete tasks.', code: 'UNAUTHORIZED_TASK_DELETION' },
      });
    }

    const hardDelete = req.query.hard === 'true';
    if (hardDelete) {
      await rtdbService.deleteData(`tasks/${workspaceId}/${taskId}`);
    } else {
      await rtdbService.updateData(`tasks/${workspaceId}/${taskId}`, {
        isDeleted: true,
        updatedAt: Date.now(),
      });
    }

    // Clean up task from active sprint scope if it was associated with an active sprint
    try {
      const activeSprint = (await rtdbService.getData(`sprints/${workspaceId}/current`)) || {};
      const currentTaskIds = Array.isArray(activeSprint.taskIds) ? [...activeSprint.taskIds] : [];
      if (currentTaskIds.includes(taskId) || existingTask?.sprintId === activeSprint?.sprintId) {
        const updatedTaskIds = currentTaskIds.filter((id) => id !== taskId);
        const updatedSprint = {
          ...activeSprint,
          taskIds: updatedTaskIds,
          totalSprintTasks: updatedTaskIds.length,
          updatedAt: Date.now(),
        };
        await rtdbService.updateMultiple({
          [`sprints/${workspaceId}/current`]: updatedSprint,
          [`sprints/${workspaceId}/${activeSprint.sprintId}`]: updatedSprint,
          [`organizations/${workspaceId}/activeSprint`]: updatedSprint,
          [`workspaces/${workspaceId}/sprint`]: updatedSprint,
        });
      }
    } catch (sprintDelErr) {
      console.warn('[taskRoutes] Error removing deleted task from active sprint:', sprintDelErr?.message);
    }

    res.json({ success: true, message: 'Task deleted successfully.' });
  } catch (err) {
    const status = err.statusCode || (err.message.includes('Unauthorized') ? 403 : 500);
    res.status(status).json({ success: false, error: { message: err.message || 'Failed to delete task.' } });
  }
});

/**
 * GET /api/workspaces/:workspaceId/tasks/:taskId/comments
 * List comments on a task.
 */
taskRouter.get('/:taskId/comments', async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId || req.params.orgId;
    const taskId = req.params.taskId;
    const userUid = req.user?.uid;

    if (!userUid) {
      return res.status(401).json({ success: false, error: { message: 'Authentication required.' } });
    }

    await requireWorkspaceMember(workspaceId, userUid);

    const commentsObj =
      (await rtdbService.getData(`task_comments/${workspaceId}/${taskId}`)) ||
      (await rtdbService.getData(`tasks/${workspaceId}/${taskId}/comments`)) ||
      {};

    const list = Object.values(commentsObj).filter((c) => c && !c.isDeleted);
    list.sort((a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0));

    res.json({ success: true, data: list });
  } catch (err) {
    const status = err.statusCode || (err.message.includes('Unauthorized') ? 403 : 500);
    res.status(status).json({ success: false, error: { message: err.message || 'Failed to fetch comments.' } });
  }
});

/**
 * POST /api/workspaces/:workspaceId/tasks/:taskId/comments
 * Add a comment to a task.
 */
taskRouter.post('/:taskId/comments', async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId || req.params.orgId;
    const taskId = req.params.taskId;
    const userUid = req.user?.uid;
    const { content, authorName, authorPhotoURL } = req.body;

    if (!userUid) {
      return res.status(401).json({ success: false, error: { message: 'Authentication required.' } });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: { message: 'Comment content cannot be empty.' } });
    }

    await requireWorkspaceMember(workspaceId, userUid);

    const commentId = `comment_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const timestamp = Date.now();

    const newComment = {
      commentId,
      taskId,
      orgId: workspaceId,
      content: content.trim(),
      authorId: userUid,
      authorName: authorName || req.user.displayName || req.user.email?.split('@')[0] || 'Team Member',
      authorPhotoURL: authorPhotoURL || req.user.photoURL || null,
      createdAt: timestamp,
      updatedAt: timestamp,
      isDeleted: false,
    };

    // Save to both paths via Admin SDK
    await Promise.all([
      rtdbService.setData(`task_comments/${workspaceId}/${taskId}/${commentId}`, newComment),
      rtdbService.setData(`tasks/${workspaceId}/${taskId}/comments/${commentId}`, newComment),
    ]);

    // Dispatch mention notification if @mention exists
    const mentionMatches = content.match(/@([a-zA-Z0-9_-]+)/g);
    if (mentionMatches && mentionMatches.length > 0) {
      const task = (await rtdbService.getData(`tasks/${workspaceId}/${taskId}`)) || {};
      notificationService.dispatchNotificationEvent(
        NOTIFICATION_TYPES.CHAT_MENTION,
        {
          workspaceId,
          taskId,
          taskTitle: task.title || 'Task',
          commentId,
          snippet: content.substring(0, 80),
        },
        req.user
      ).catch((e) => console.warn('[taskRoutes] Mention notification warning:', e?.message || e));
    }

    res.status(201).json({ success: true, data: newComment });
  } catch (err) {
    const status = err.statusCode || (err.message.includes('Unauthorized') ? 403 : 500);
    res.status(status).json({ success: false, error: { message: err.message || 'Failed to post comment.' } });
  }
});

/**
 * DELETE /api/workspaces/:workspaceId/tasks/:taskId/comments/:commentId
 * Soft delete a comment.
 */
taskRouter.delete('/:taskId/comments/:commentId', async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId || req.params.orgId;
    const taskId = req.params.taskId;
    const commentId = req.params.commentId;
    const userUid = req.user?.uid;

    if (!userUid) {
      return res.status(401).json({ success: false, error: { message: 'Authentication required.' } });
    }

    const membership = await requireWorkspaceMember(workspaceId, userUid);
    const existingComment =
      (await rtdbService.getData(`task_comments/${workspaceId}/${taskId}/${commentId}`)) ||
      (await rtdbService.getData(`tasks/${workspaceId}/${taskId}/comments/${commentId}`));

    if (!existingComment) {
      return res.status(404).json({ success: false, error: { message: 'Comment not found.' } });
    }

    const isPrivileged = checkPrivilegedRole(membership);
    const isAuthor = existingComment.authorId === userUid;

    if (!isPrivileged && !isAuthor) {
      return res.status(403).json({
        success: false,
        error: { message: 'Only comment authors or workspace managers can delete comments.' },
      });
    }

    const deleteUpdate = {
      isDeleted: true,
      deletedAt: Date.now(),
    };

    await Promise.all([
      rtdbService.updateData(`task_comments/${workspaceId}/${taskId}/${commentId}`, deleteUpdate),
      rtdbService.updateData(`tasks/${workspaceId}/${taskId}/comments/${commentId}`, deleteUpdate),
    ]);

    res.json({ success: true, message: 'Comment deleted successfully.' });
  } catch (err) {
    const status = err.statusCode || (err.message.includes('Unauthorized') ? 403 : 500);
    res.status(status).json({ success: false, error: { message: err.message || 'Failed to delete comment.' } });
  }
});
