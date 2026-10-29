import express from 'express';
import { rtdbService } from '../services/rtdbService.js';
import { requireWorkspaceMember } from '../utils/workspaceAuthHelper.js';
import { activityService } from '../services/activityService.js';
import { ACTIVITY_EVENT_TYPES } from '../constants/activityConstants.js';

export const sprintRouter = express.Router({ mergeParams: true });

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
 * GET /api/workspaces/:workspaceId/sprints/current
 * Retrieve current active sprint for the workspace.
 */
sprintRouter.get('/current', async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId || req.params.orgId;
    const userUid = req.user?.uid;

    if (!userUid) {
      return res.status(401).json({ success: false, error: { message: 'Authentication required.' } });
    }

    await requireWorkspaceMember(workspaceId, userUid);

    // Check primary path sprints/:workspaceId/current, fallback to organizations/:workspaceId/activeSprint
    const current =
      (await rtdbService.getData(`sprints/${workspaceId}/current`)) ||
      (await rtdbService.getData(`organizations/${workspaceId}/activeSprint`));

    if (current && current.status === 'active') {
      return res.json({ success: true, data: current });
    }

    res.json({ success: true, data: null });
  } catch (err) {
    const status = err.statusCode || (err.message.includes('Unauthorized') ? 403 : 500);
    res.status(status).json({ success: false, error: { message: err.message || 'Failed to fetch active sprint.' } });
  }
});

/**
 * POST /api/workspaces/:workspaceId/sprints
 * Start a new sprint cycle. Requires owner or team captain privilege.
 */
sprintRouter.post('/', async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId || req.params.orgId;
    const userUid = req.user?.uid;

    if (!userUid) {
      return res.status(401).json({ success: false, error: { message: 'Authentication required.' } });
    }

    const membership = await requireWorkspaceMember(workspaceId, userUid);
    if (!checkPrivilegedRole(membership)) {
      return res.status(403).json({
        success: false,
        error: { message: 'Only workspace owners or team captains can initiate a sprint.' },
      });
    }

    const { name, goal, startDate, targetEndDate, selectedTaskIds = [], sprintNumber = 1 } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: { message: 'Sprint name is required.' } });
    }
    if (!startDate || !targetEndDate) {
      return res.status(400).json({ success: false, error: { message: 'Start date and target end date are required.' } });
    }

    // STRICT CONCURRENCY LOCK: Verify no active sprint is running in the workspace
    const existingSprint =
      (await rtdbService.getData(`organizations/${workspaceId}/activeSprint`)) ||
      (await rtdbService.getData(`sprints/${workspaceId}/current`)) ||
      (await rtdbService.getData(`workspaces/${workspaceId}/activeSprint`));

    if (existingSprint && existingSprint.status === 'active') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'ACTIVE_SPRINT_EXISTS',
          message: `An active sprint ("${existingSprint.name || 'Current Sprint'}") is already in progress. You must complete the active sprint before starting a new one.`,
          activeSprint: existingSprint,
        },
      });
    }

    const sprintNum = Number(sprintNumber) || 1;
    const sprintId = `sprint_${Date.now()}_s${sprintNum}`;
    const timestamp = Date.now();
    const taskIds = Array.isArray(selectedTaskIds) ? selectedTaskIds : [];

    const actorName = req.user.displayName || req.user.name || req.user.email?.split('@')[0] || 'Team Lead';
    const actorPhotoURL = req.user.photoURL || null;

    const newSprint = {
      sprintId,
      orgId: workspaceId,
      sprintNumber: sprintNum,
      name: name.trim(),
      goal: goal ? goal.trim() : 'Deliver high-impact sprint tasks.',
      status: 'active',
      startedAt: timestamp,
      startDate,
      targetEndDate,
      taskIds,
      totalSprintTasks: taskIds.length,
      startedBy: userUid,
      startedByName: actorName,
      updatedAt: timestamp,
    };

    // Save across primary sprints path AND mirror to organizations & workspaces paths for real-time clients
    await Promise.all([
      rtdbService.setData(`sprints/${workspaceId}/current`, newSprint),
      rtdbService.setData(`organizations/${workspaceId}/activeSprint`, newSprint),
      rtdbService.setData(`workspaces/${workspaceId}/activeSprint`, newSprint),
    ]);

    // Authoritatively tag selected tasks with sprintId in RTDB
    if (taskIds.length > 0) {
      const updates = {};
      taskIds.forEach((id) => {
        updates[`tasks/${workspaceId}/${id}/sprintId`] = sprintId;
        updates[`tasks/${workspaceId}/${id}/updatedAt`] = timestamp;
      });
      await rtdbService.updateMultiple(updates).catch(async (e) => {
        console.warn('[sprintRoutes] Batch updateMultiple fallback to single updates:', e.message);
        for (const id of taskIds) {
          await rtdbService.updateData(`tasks/${workspaceId}/${id}`, {
            sprintId,
            updatedAt: timestamp,
          }).catch(() => {});
        }
      });
    }

    // Activity log
    activityService.recordWorkspaceActivity(workspaceId, {
      eventType: ACTIVITY_EVENT_TYPES.TASK_CREATED,
      actorId: userUid,
      actorType: 'user',
      actorName,
      actorPhotoURL,
      resourceType: 'sprint',
      resourceId: sprintId,
      resourceTitle: newSprint.name,
      metadata: {
        goal: newSprint.goal,
        targetEndDate: newSprint.targetEndDate,
        taskCount: taskIds.length,
      },
    }).catch(() => {});

    res.status(201).json({ success: true, data: newSprint });
  } catch (err) {
    const status = err.statusCode || (err.message.includes('Unauthorized') ? 403 : 500);
    res.status(status).json({ success: false, error: { message: err.message || 'Failed to start sprint.' } });
  }
});

/**
 * POST /api/workspaces/:workspaceId/sprints/:sprintId/complete
 * Complete active sprint and generate retrospective archive.
 */
sprintRouter.post('/:sprintId/complete', async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId || req.params.orgId;
    const sprintId = req.params.sprintId;
    const userUid = req.user?.uid;

    if (!userUid) {
      return res.status(401).json({ success: false, error: { message: 'Authentication required.' } });
    }

    const membership = await requireWorkspaceMember(workspaceId, userUid);
    if (!checkPrivilegedRole(membership)) {
      return res.status(403).json({
        success: false,
        error: { message: 'Only workspace owners or team captains can complete a sprint.' },
      });
    }

    const timestamp = Date.now();
    const actorName = req.user.displayName || req.user.name || req.user.email?.split('@')[0] || 'Team Lead';

    const activeSprint =
      (await rtdbService.getData(`sprints/${workspaceId}/current`)) ||
      (await rtdbService.getData(`organizations/${workspaceId}/activeSprint`)) ||
      {};

    const metrics = req.body?.metrics || {};

    const archivedSprint = {
      ...activeSprint,
      sprintId,
      status: 'completed',
      completedAt: timestamp,
      completedBy: userUid,
      completedByName: actorName,
      metrics: {
        totalTasks: metrics.totalTasks || 0,
        completedTasks: metrics.completedTasks || 0,
        completionRate: metrics.completionRate || 0,
        uncompletedTasks: metrics.uncompletedTasks || 0,
        priorityBreakdown: metrics.priorityBreakdown || {},
      },
      retrospective: {
        whatWentWell: req.body?.retrospective?.whatWentWell || '',
        whatCouldImprove: req.body?.retrospective?.whatCouldImprove || '',
        blockersResolved: req.body?.retrospective?.blockersResolved || '',
        submittedAt: timestamp,
      },
    };

    // 1. Archive in history across primary and organization paths
    await Promise.all([
      rtdbService.setData(`sprints/${workspaceId}/history/${sprintId}`, archivedSprint),
      rtdbService.setData(`organizations/${workspaceId}/sprintHistory/${sprintId}`, archivedSprint),
    ]);

    // 2. Clear current sprint across all paths
    await Promise.all([
      rtdbService.setData(`sprints/${workspaceId}/current`, null),
      rtdbService.setData(`organizations/${workspaceId}/activeSprint`, null),
      rtdbService.setData(`workspaces/${workspaceId}/activeSprint`, null),
    ]);

    // Activity log
    activityService.recordWorkspaceActivity(workspaceId, {
      eventType: ACTIVITY_EVENT_TYPES.TASK_COMPLETED,
      actorId: userUid,
      actorType: 'user',
      actorName,
      actorPhotoURL: req.user.photoURL || null,
      resourceType: 'sprint',
      resourceId: sprintId,
      resourceTitle: archivedSprint.name || 'Sprint',
      metadata: {
        completionRate: archivedSprint.metrics.completionRate,
        completedTasks: archivedSprint.metrics.completedTasks,
        totalTasks: archivedSprint.metrics.totalTasks,
      },
    }).catch(() => {});

    res.json({ success: true, data: archivedSprint });
  } catch (err) {
    const status = err.statusCode || (err.message.includes('Unauthorized') ? 403 : 500);
    res.status(status).json({ success: false, error: { message: err.message || 'Failed to complete sprint.' } });
  }
});

/**
 * POST /api/workspaces/:workspaceId/sprints/:sprintId/tasks
 * Dynamically add a task to an ongoing active sprint.
 */
sprintRouter.post('/:sprintId/tasks', async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId || req.params.orgId;
    const sprintId = req.params.sprintId;
    const userUid = req.user?.uid;
    const { taskId } = req.body;

    if (!userUid) {
      return res.status(401).json({ success: false, error: { message: 'Authentication required.' } });
    }
    if (!taskId) {
      return res.status(400).json({ success: false, error: { message: 'taskId is required.' } });
    }

    const membership = await requireWorkspaceMember(workspaceId, userUid);
    if (!checkPrivilegedRole(membership)) {
      return res.status(403).json({
        success: false,
        error: { message: 'Only workspace owners or team captains can manage sprint scope.' },
      });
    }

    const activeSprint =
      (await rtdbService.getData(`sprints/${workspaceId}/current`)) ||
      (await rtdbService.getData(`organizations/${workspaceId}/activeSprint`)) ||
      {};

    if (activeSprint?.sprintId !== sprintId || activeSprint?.status !== 'active') {
      return res.status(400).json({ success: false, error: { message: 'Sprint is not currently active.' } });
    }

    const currentTaskIds = Array.isArray(activeSprint.taskIds) ? [...activeSprint.taskIds] : [];
    if (!currentTaskIds.includes(taskId)) {
      currentTaskIds.push(taskId);
    }

    const timestamp = Date.now();
    const sprintUpdate = {
      ...activeSprint,
      taskIds: currentTaskIds,
      totalSprintTasks: currentTaskIds.length,
      updatedAt: timestamp,
    };

    const multiUpdates = {
      [`sprints/${workspaceId}/current`]: sprintUpdate,
      [`sprints/${workspaceId}/${sprintId}`]: sprintUpdate,
      [`organizations/${workspaceId}/activeSprint`]: sprintUpdate,
      [`workspaces/${workspaceId}/sprint`]: sprintUpdate,
      [`tasks/${workspaceId}/${taskId}/sprintId`]: sprintId,
      [`tasks/${workspaceId}/${taskId}/sprintName`]: activeSprint.name || 'Active Sprint',
      [`tasks/${workspaceId}/${taskId}/updatedAt`]: timestamp,
    };

    await rtdbService.updateMultiple(multiUpdates);

    res.json({ success: true, data: sprintUpdate });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, error: { message: err.message || 'Failed to add task to sprint.' } });
  }
});

/**
 * DELETE /api/workspaces/:workspaceId/sprints/:sprintId/tasks/:taskId
 * Remove a task from an active sprint (moves it back to Backlog).
 */
sprintRouter.delete('/:sprintId/tasks/:taskId', async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId || req.params.orgId;
    const { sprintId, taskId } = req.params;
    const userUid = req.user?.uid;

    if (!userUid) {
      return res.status(401).json({ success: false, error: { message: 'Authentication required.' } });
    }

    const membership = await requireWorkspaceMember(workspaceId, userUid);
    if (!checkPrivilegedRole(membership)) {
      return res.status(403).json({
        success: false,
        error: { message: 'Only workspace owners or team captains can manage sprint scope.' },
      });
    }

    const activeSprint =
      (await rtdbService.getData(`sprints/${workspaceId}/current`)) ||
      (await rtdbService.getData(`organizations/${workspaceId}/activeSprint`)) ||
      {};

    const currentTaskIds = Array.isArray(activeSprint.taskIds) ? [...activeSprint.taskIds] : [];
    const updatedTaskIds = currentTaskIds.filter((id) => id !== taskId);

    const timestamp = Date.now();
    const sprintUpdate = {
      ...activeSprint,
      taskIds: updatedTaskIds,
      totalSprintTasks: updatedTaskIds.length,
      updatedAt: timestamp,
    };

    const multiUpdates = {
      [`sprints/${workspaceId}/current`]: sprintUpdate,
      [`sprints/${workspaceId}/${sprintId}`]: sprintUpdate,
      [`organizations/${workspaceId}/activeSprint`]: sprintUpdate,
      [`workspaces/${workspaceId}/sprint`]: sprintUpdate,
      [`tasks/${workspaceId}/${taskId}/sprintId`]: null,
      [`tasks/${workspaceId}/${taskId}/sprintName`]: null,
      [`tasks/${workspaceId}/${taskId}/updatedAt`]: timestamp,
    };

    await rtdbService.updateMultiple(multiUpdates);

    res.json({ success: true, data: sprintUpdate });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, error: { message: err.message || 'Failed to remove task from sprint.' } });
  }
});

/**
 * GET /api/workspaces/:workspaceId/sprints/history
 * Fetch past archived sprints.
 */
sprintRouter.get('/history', async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId || req.params.orgId;
    const userUid = req.user?.uid;

    if (!userUid) {
      return res.status(401).json({ success: false, error: { message: 'Authentication required.' } });
    }

    await requireWorkspaceMember(workspaceId, userUid);

    const [historyObj, orgHistoryObj] = await Promise.all([
      rtdbService.getData(`sprints/${workspaceId}/history`),
      rtdbService.getData(`organizations/${workspaceId}/sprintHistory`),
    ]);
    const merged = { ...(historyObj || {}), ...(orgHistoryObj || {}) };
    const list = Object.values(merged).filter(Boolean);
    list.sort((a, b) => (Number(b.completedAt) || 0) - (Number(a.completedAt) || 0));

    res.json({ success: true, data: list });
  } catch (err) {
    const status = err.statusCode || (err.message.includes('Unauthorized') ? 403 : 500);
    res.status(status).json({ success: false, error: { message: err.message || 'Failed to fetch sprint history.' } });
  }
});

export default sprintRouter;
