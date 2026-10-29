import { rtdbService } from './rtdbService';
import { activityService } from './activityService';
import { ACTIVITY_EVENT_TYPES } from '../constants/activityConstants';
import { apiClient } from './apiClient';

/**
 * Convia Sprint Service Layer.
 * Manages sprint lifecycle states, real-time subscriptions, completion retrospectives,
 * and velocity analytics under `sprints/${orgId}`.
 */
export const sprintService = {
  /**
   * Fetch active sprint snapshot once.
   */
  getActiveSprint: async (orgId) => {
    if (!orgId) return null;
    try {
      const res = await apiClient.get(`/api/workspaces/${encodeURIComponent(orgId)}/sprints/current`).catch(() => null);
      if (res && typeof res === 'object' && res.status === 'active') {
        return res;
      }
      const current =
        (await rtdbService.getData(`organizations/${orgId}/activeSprint`)) ||
        (await rtdbService.getData(`sprints/${orgId}/current`));
      if (current && current.status === 'active') {
        return current;
      }
      return null;
    } catch (err) {
      console.warn('[sprintService] getActiveSprint error:', err.message);
      return null;
    }
  },

  /**
   * Real-time subscription to active sprint.
   * Uses dual subscription on organizations/${orgId}/activeSprint (whitelisted in RTDB rules)
   * and sprints/${orgId}/current with immediate API snapshot.
   */
  subscribeToActiveSprint: (orgId, callback) => {
    if (!orgId || typeof callback !== 'function') {
      return () => {};
    }

    let isSubscribed = true;

    // 1. Initial snapshot fetch via authoritative backend
    apiClient
      .get(`/api/workspaces/${encodeURIComponent(orgId)}/sprints/current`)
      .then((res) => {
        if (!isSubscribed) return;
        const sprint = res && typeof res === 'object' && res.status === 'active' ? res : null;
        if (sprint) {
          callback(sprint);
        }
      })
      .catch((err) => {
        console.warn('[sprintService] Initial sprint fetch warning:', err?.message);
      });

    // 2. Real-time RTDB listener on organizations/:orgId/activeSprint (universally readable by members)
    const unsubOrgSprint = rtdbService.subscribe(`organizations/${orgId}/activeSprint`, (data) => {
      if (!isSubscribed) return;
      if (data && typeof data === 'object' && data.status === 'active') {
        callback(data);
      } else if (data === null) {
        callback(null);
      }
    });

    // 3. Compatibility listener on workspaces/:orgId/activeSprint
    const unsubWsSprint = rtdbService.subscribe(`workspaces/${orgId}/activeSprint`, (data) => {
      if (!isSubscribed) return;
      if (data && typeof data === 'object' && data.status === 'active') {
        callback(data);
      }
    });

    // 4. Fallback listener on sprints/:orgId/current
    const unsubDirectSprint = rtdbService.subscribe(`sprints/${orgId}/current`, (data) => {
      if (!isSubscribed) return;
      if (data && typeof data === 'object' && data.status === 'active') {
        callback(data);
      }
    });

    return () => {
      isSubscribed = false;
      if (typeof unsubOrgSprint === 'function') unsubOrgSprint();
      if (typeof unsubWsSprint === 'function') unsubWsSprint();
      if (typeof unsubDirectSprint === 'function') unsubDirectSprint();
    };
  },

  /**
   * Get all past completed sprints from archive.
   */
  getSprintHistory: async (orgId) => {
    if (!orgId) return [];
    try {
      const res = await apiClient.get(`/api/workspaces/${encodeURIComponent(orgId)}/sprints/history`).catch(() => null);
      if (Array.isArray(res) && res.length > 0) {
        return res;
      }
      const historyObj = (await rtdbService.getData(`sprints/${orgId}/history`)) || {};
      const list = Object.values(historyObj).filter(Boolean);
      list.sort((a, b) => (Number(b.completedAt) || 0) - (Number(a.completedAt) || 0));
      return list;
    } catch (err) {
      console.warn('[sprintService] getSprintHistory error:', err.message);
      return [];
    }
  },

  /**
   * Start a new sprint cycle.
   */
  startSprint: async (orgId, sprintData, actorUser) => {
    if (!orgId) throw new Error('Organization ID is required.');
    const actorUid = typeof actorUser === 'string' ? actorUser : actorUser?.uid;
    if (!actorUid) throw new Error('Authenticated user is required to start a sprint.');

    const actorName = (typeof actorUser === 'object' && (actorUser?.displayName || actorUser?.email)) || 'Team Lead';
    const actorPhotoURL = (typeof actorUser === 'object' && actorUser?.photoURL) || null;

    const sprintNumber = Number(sprintData.sprintNumber) || 1;
    const sprintId = `sprint_${Date.now()}_s${sprintNumber}`;
    const timestamp = Date.now();
    const selectedTaskIds = Array.isArray(sprintData.selectedTaskIds) ? sprintData.selectedTaskIds : [];

    const newSprint = {
      sprintId,
      orgId,
      sprintNumber,
      name: sprintData.name || `Sprint ${sprintNumber}`,
      goal: sprintData.goal ? sprintData.goal.trim() : 'Deliver high-impact sprint tasks.',
      status: 'active',
      startedAt: timestamp,
      startDate: sprintData.startDate || new Date(timestamp).toISOString().split('T')[0],
      targetEndDate: sprintData.targetEndDate || new Date(timestamp + 14 * 86400000).toISOString().split('T')[0],
      taskIds: selectedTaskIds,
      totalSprintTasks: selectedTaskIds.length,
      startedBy: actorUid,
      startedByName: actorName,
      updatedAt: timestamp,
    };

    // 1. Authoritative Backend Initiation Primary
    try {
      const apiRes = await apiClient.post(`/api/workspaces/${encodeURIComponent(orgId)}/sprints`, {
        name: newSprint.name,
        goal: newSprint.goal,
        startDate: newSprint.startDate,
        targetEndDate: newSprint.targetEndDate,
        selectedTaskIds: newSprint.taskIds,
        sprintNumber: newSprint.sprintNumber,
      });
      if (apiRes && apiRes.sprintId) {
        return apiRes;
      }
    } catch (apiErr) {
      console.warn('[sprintService] Authoritative backend sprint start failed, attempting RTDB direct fallback:', apiErr?.message);
    }

    // 2. Direct RTDB Fallback
    await Promise.all([
      rtdbService.setData(`sprints/${orgId}/current`, newSprint).catch(() => {}),
      rtdbService.setData(`organizations/${orgId}/activeSprint`, newSprint).catch(() => {}),
    ]);

    // Tag selected tasks with sprintId in RTDB
    if (selectedTaskIds.length > 0) {
      const updates = {};
      selectedTaskIds.forEach((taskId) => {
        updates[`tasks/${orgId}/${taskId}/sprintId`] = sprintId;
        updates[`tasks/${orgId}/${taskId}/updatedAt`] = timestamp;
      });
      try {
        if (typeof rtdbService.updateMultiple === 'function') {
          await rtdbService.updateMultiple(updates);
        } else if (typeof rtdbService.updateData === 'function') {
          await rtdbService.updateData('', updates);
        }
      } catch (err) {
        console.warn('[sprintService] Task sprint tag batch update notice:', err.message);
      }
    }

    // Record activity audit trail
    activityService.recordWorkspaceActivity(orgId, {
      eventType: ACTIVITY_EVENT_TYPES.TASK_CREATED,
      actorId: actorUid,
      actorType: 'user',
      actorName: actorName,
      actorPhotoURL: actorPhotoURL,
      resourceType: 'sprint',
      resourceId: sprintId,
      resourceTitle: newSprint.name,
      metadata: {
        goal: newSprint.goal,
        targetEndDate: newSprint.targetEndDate,
        taskCount: selectedTaskIds.length,
      },
    }).catch((err) => console.warn('[sprintService] Activity logging notice:', err.message));

    return newSprint;
  },

  /**
   * Complete an active sprint and generate retrospective archive.
   */
  completeSprint: async (orgId, sprintId, payload, actorUser) => {
    if (!orgId || !sprintId) throw new Error('Workspace ID and Sprint ID are required.');
    const timestamp = Date.now();
    const actorUid = typeof actorUser === 'string' ? actorUser : actorUser?.uid || null;
    const actorName = (typeof actorUser === 'object' && (actorUser?.displayName || actorUser?.email)) || 'Team Lead';

    const activeSprint = (await rtdbService.getData(`sprints/${orgId}/current`)) || {};
    const metrics = payload.metrics || {};

    const archivedSprint = {
      ...activeSprint,
      sprintId,
      status: 'completed',
      completedAt: timestamp,
      completedBy: actorUid,
      completedByName: actorName,
      metrics: {
        totalTasks: metrics.totalTasks || 0,
        completedTasks: metrics.completedTasks || 0,
        completionRate: metrics.completionRate || 0,
        uncompletedTasks: metrics.uncompletedTasks || 0,
        priorityBreakdown: metrics.priorityBreakdown || {},
      },
      retrospective: {
        notes: payload.retrospectiveNotes || '',
        aiSummary: payload.aiSummary || null,
        rolloverAction: payload.rolloverAction || 'keep', // 'keep' | 'todo'
      },
      updatedAt: timestamp,
    };

    // 1. Authoritative Backend Primary
    try {
      const apiRes = await apiClient.post(
        `/api/workspaces/${encodeURIComponent(orgId)}/sprints/${encodeURIComponent(sprintId)}/complete`,
        {
          metrics,
          retrospective: {
            notes: payload.retrospectiveNotes || '',
            aiSummary: payload.aiSummary || null,
            rolloverAction: payload.rolloverAction || 'keep',
          },
        }
      );
      if (apiRes && apiRes.sprintId) {
        return apiRes;
      }
    } catch (apiErr) {
      console.warn('[sprintService] Authoritative backend sprint completion fallback to RTDB:', apiErr?.message);
    }

    // 2. Direct RTDB Historical Archive Fallback
    await rtdbService.setData(`sprints/${orgId}/history/${sprintId}`, archivedSprint).catch(() => {});

    // Clear active sprint pointer
    await Promise.all([
      rtdbService.setData(`sprints/${orgId}/current`, {
        status: 'planning',
        lastSprintId: sprintId,
        lastSprintNumber: activeSprint.sprintNumber || 1,
        completedAt: timestamp,
      }).catch(() => {}),
      rtdbService.setData(`organizations/${orgId}/activeSprint`, null).catch(() => {}),
    ]);

    // 3. Handle incomplete tasks rollover if requested
    if (payload.rolloverAction === 'todo' && Array.isArray(payload.incompleteTaskIds) && payload.incompleteTaskIds.length > 0) {
      const updates = {};
      payload.incompleteTaskIds.forEach((tId) => {
        updates[`tasks/${orgId}/${tId}/status`] = 'Todo';
        updates[`tasks/${orgId}/${tId}/updatedAt`] = timestamp;
      });
      try {
        if (typeof rtdbService.updateMultiple === 'function') {
          await rtdbService.updateMultiple(updates);
        } else if (typeof rtdbService.updateData === 'function') {
          await rtdbService.updateData('', updates);
        }
      } catch (err) {
        console.warn('[sprintService] Rollover batch update notice:', err.message);
      }
    }

    // 4. Record completion activity
    activityService.recordWorkspaceActivity(orgId, {
      eventType: ACTIVITY_EVENT_TYPES.TASK_COMPLETED,
      actorId: actorUser?.uid,
      actorType: 'user',
      actorName: actorUser?.displayName || actorUser?.email || 'Team Member',
      actorPhotoURL: actorUser?.photoURL || null,
      resourceType: 'sprint',
      resourceId: sprintId,
      resourceTitle: activeSprint.name || 'Sprint',
      metadata: {
        completedTasks: metrics.completedTasks,
        totalTasks: metrics.totalTasks,
      },
    }).catch((err) => console.warn('[sprintService] Completion activity logging notice:', err.message));

    return archivedSprint;
  },

  /**
   * Add a task to an ongoing active sprint.
   */
  addTaskToActiveSprint: async (orgId, sprintId, taskId) => {
    if (!orgId || !sprintId || !taskId) return null;
    try {
      const res = await apiClient.post(`/api/workspaces/${encodeURIComponent(orgId)}/sprints/${encodeURIComponent(sprintId)}/tasks`, {
        taskId,
      });
      return res?.data || res;
    } catch (_apiErr) {
      const activeSprint = (await rtdbService.getData(`sprints/${orgId}/current`)) || {};
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
      await rtdbService.updateMultiple({
        [`sprints/${orgId}/current`]: sprintUpdate,
        [`sprints/${orgId}/${sprintId}`]: sprintUpdate,
        [`organizations/${orgId}/activeSprint`]: sprintUpdate,
        [`workspaces/${orgId}/sprint`]: sprintUpdate,
        [`tasks/${orgId}/${taskId}/sprintId`]: sprintId,
        [`tasks/${orgId}/${taskId}/sprintName`]: activeSprint.name || 'Active Sprint',
        [`tasks/${orgId}/${taskId}/updatedAt`]: timestamp,
      });
      return sprintUpdate;
    }
  },

  /**
   * Remove a task from an active sprint (moves it back to Backlog).
   */
  removeTaskFromActiveSprint: async (orgId, sprintId, taskId) => {
    if (!orgId || !sprintId || !taskId) return null;
    try {
      const res = await apiClient.delete(`/api/workspaces/${encodeURIComponent(orgId)}/sprints/${encodeURIComponent(sprintId)}/tasks/${encodeURIComponent(taskId)}`);
      return res?.data || res;
    } catch (_apiErr) {
      const activeSprint = (await rtdbService.getData(`sprints/${orgId}/current`)) || {};
      const currentTaskIds = Array.isArray(activeSprint.taskIds) ? [...activeSprint.taskIds] : [];
      const updatedTaskIds = currentTaskIds.filter((id) => id !== taskId);
      const timestamp = Date.now();
      const sprintUpdate = {
        ...activeSprint,
        taskIds: updatedTaskIds,
        totalSprintTasks: updatedTaskIds.length,
        updatedAt: timestamp,
      };
      await rtdbService.updateMultiple({
        [`sprints/${orgId}/current`]: sprintUpdate,
        [`sprints/${orgId}/${sprintId}`]: sprintUpdate,
        [`organizations/${orgId}/activeSprint`]: sprintUpdate,
        [`workspaces/${orgId}/sprint`]: sprintUpdate,
        [`tasks/${orgId}/${taskId}/sprintId`]: null,
        [`tasks/${orgId}/${taskId}/sprintName`]: null,
        [`tasks/${orgId}/${taskId}/updatedAt`]: timestamp,
      });
      return sprintUpdate;
    }
  },

  /**
   * Deterministic velocity and retrospective analysis generator.
   */
  calculateSprintMetrics: (tasks = [], targetTaskIds = null) => {
    let list = Array.isArray(tasks) ? tasks.filter((t) => t && !t.isDeleted) : [];
    if (Array.isArray(targetTaskIds) && targetTaskIds.length > 0) {
      list = list.filter((t) => targetTaskIds.includes(t.taskId || t.id));
    }
    const totalTasks = list.length;
    const completedTasks = list.filter((t) => t.status === 'Completed').length;
    const inProgressTasks = list.filter((t) => t.status === 'In Progress').length;
    const reviewTasks = list.filter((t) => t.status === 'Review').length;
    const todoTasks = list.filter((t) => t.status === 'Todo').length;
    const uncompletedTasks = totalTasks - completedTasks;

    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const priorityBreakdown = {
      Critical: list.filter((t) => t.priority === 'Critical').length,
      High: list.filter((t) => t.priority === 'High').length,
      Medium: list.filter((t) => t.priority === 'Medium').length,
      Low: list.filter((t) => t.priority === 'Low').length,
    };

    const incompleteTaskIds = list
      .filter((t) => t.status !== 'Completed')
      .map((t) => t.taskId || t.id)
      .filter(Boolean);

    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      reviewTasks,
      todoTasks,
      uncompletedTasks,
      completionRate,
      priorityBreakdown,
      incompleteTaskIds,
    };
  },
};

export default sprintService;
