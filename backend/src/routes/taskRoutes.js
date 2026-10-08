import express from 'express';
import { rtdbService } from '../services/rtdbService.js';
import { requireWorkspaceMember } from '../utils/workspaceAuthHelper.js';

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
    const isCreator = existingTask.createdBy === userUid;
    const isAssignee = existingTask.assignedTo === userUid;

    // 2. Authorization Matrix Verification
    if (!isPrivileged && !isCreator && !isAssignee) {
      return res.status(403).json({
        success: false,
        error: { message: 'Only task creators, assignees, team captains, or workspace owners can modify tasks.', code: 'UNAUTHORIZED_TASK_MUTATION' },
      });
    }

    // 3. Assignee-Only Boundary Defense
    // If actor is assignee but NOT creator and NOT privileged:
    // Allowed ONLY to update status/completion.
    if (isAssignee && !isCreator && !isPrivileged) {
      const restrictedFields = ['title', 'description', 'priority', 'dueDate', 'assignedTo', 'assignedToName', 'isDeleted'];
      for (const field of restrictedFields) {
        if (req.body[field] !== undefined && req.body[field] !== existingTask[field]) {
          return res.status(403).json({
            success: false,
            error: {
              message: `Assignees cannot modify '${field}'. Assignees are only permitted to update task status and completion.`,
              code: 'ASSIGNEE_CANNOT_EDIT_CONTENT',
            },
          });
        }
      }
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
    const isCreator = existingTask.createdBy === userUid;

    if (!isPrivileged && !isCreator) {
      return res.status(403).json({
        success: false,
        error: { message: 'Only task creators, team captains, or workspace owners can delete tasks.', code: 'UNAUTHORIZED_TASK_DELETION' },
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

    res.json({ success: true, message: 'Task deleted successfully.' });
  } catch (err) {
    const status = err.statusCode || (err.message.includes('Unauthorized') ? 403 : 500);
    res.status(status).json({ success: false, error: { message: err.message || 'Failed to delete task.' } });
  }
});
