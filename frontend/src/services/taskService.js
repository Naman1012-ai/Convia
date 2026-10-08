import { rtdbService } from './rtdbService';
import { getErrorMessage } from '../utils/errorMessages';
import { inAppNotificationService } from './inAppNotificationService';
import { NOTIFICATION_TYPES } from '../constants/notificationConstants';
import { activityService } from './activityService';
import { ACTIVITY_EVENT_TYPES } from '../constants/activityConstants';
import { apiClient } from './apiClient';

/**
 * Complete Service Layer for Task Management & Project Execution Module.
 * Manages operations under: tasks/{orgId}/{taskId}
 */
export const taskService = {
  /**
   * Create a new task under the organization's active project.
   */
  createTask: async (user, orgId, taskData) => {
    if (!user || !orgId) throw new Error('User and Organization ID are required.');
    if (!taskData.title || !taskData.title.trim()) {
      throw new Error('Task title is required.');
    }

    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = Date.now();

    const newTask = {
      taskId,
      projectId: taskData.projectId || 'active_project',
      orgId,
      title: taskData.title.trim(),
      description: taskData.description ? taskData.description.trim() : '',
      createdBy: user.uid,
      createdByName: user.displayName || user.email || 'Team Member',
      assignedTo: taskData.assignedTo || '',
      assignedToName: taskData.assignedToName || 'Unassigned',
      priority: taskData.priority || 'Medium', // 'Low' | 'Medium' | 'High' | 'Critical'
      status: taskData.status || 'Todo', // 'Todo' | 'In Progress' | 'Review' | 'Completed'
      dueDate: taskData.dueDate || '',
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: taskData.status === 'Completed' ? timestamp : null,
      isDeleted: false,
    };

    try {
      // 1. Authoritative Backend Endpoint Primary
      try {
        const created = await apiClient.post(`/api/workspaces/${encodeURIComponent(orgId)}/tasks`, {
          title: newTask.title,
          description: newTask.description,
          priority: newTask.priority,
          status: newTask.status,
          dueDate: newTask.dueDate,
          assignedTo: newTask.assignedTo,
          assignedToName: newTask.assignedToName,
          projectId: newTask.projectId,
        });
        if (created && created.taskId) {
          Object.assign(newTask, created);
        }
      } catch (_apiErr) {
        // Fallback to direct RTDB write if backend endpoint is unavailable
        await rtdbService.setData(`tasks/${orgId}/${taskId}`, newTask);
      }

      // If initially assigned to another user, dispatch TASK_ASSIGNED notification + FCM push
      if (newTask.assignedTo && newTask.assignedTo !== user.uid) {
        inAppNotificationService.dispatchNotificationEvent(
          NOTIFICATION_TYPES.TASK_ASSIGNED,
          {
            workspaceId: orgId,
            taskId,
            taskTitle: newTask.title,
            assignedToUid: newTask.assignedTo,
            priority: newTask.priority,
          },
          user
        ).catch((err) => {
          console.warn('[taskService] Failed to dispatch task assignment notification:', err?.message);
        });
      }

      // Record workspace activity
      activityService.recordWorkspaceActivity(orgId, {
        eventType: ACTIVITY_EVENT_TYPES.TASK_CREATED,
        actorId: user.uid,
        actorType: 'user',
        actorName: user.displayName || user.email || 'Team Member',
        actorPhotoURL: user.photoURL || null,
        resourceType: 'task',
        resourceId: taskId,
        resourceTitle: newTask.title,
        metadata: {
          priority: newTask.priority,
          assignedTo: newTask.assignedTo || null,
        },
      }).catch((err) => console.warn('[taskService] Failed to record task creation activity:', err?.message));

      return newTask;
    } catch (error) {
      console.error('[taskService] createTask error:', error);
      throw new Error(error.message || getErrorMessage(error.code || 'default'));
    }
  },

  /**
   * Fetch all non-deleted tasks for an organization once.
   */
  getTasks: async (orgId) => {
    if (!orgId) return [];
    try {
      const tasksObj = (await rtdbService.getData(`tasks/${orgId}`)) || {};
      return Object.values(tasksObj).filter((t) => t && !t.isDeleted);
    } catch (error) {
      console.error('[taskService] getTasks error:', error);
      return [];
    }
  },

  /**
   * Update task fields (Title, Description, Priority, Due Date).
   */
  updateTask: async (orgId, taskId, updates, actorUser = null) => {
    if (!orgId || !taskId) return;
    const timestamp = Date.now();
    const patch = {
      ...updates,
      updatedAt: timestamp,
    };

    if (updates.status === 'Completed') {
      patch.completedAt = timestamp;
    } else if (updates.status && updates.status !== 'Completed') {
      patch.completedAt = null;
    }

    try {
      // Fetch existing task to check status changes for notification triggers
      let existingTask = null;
      if (updates.status === 'Completed' || updates.assignedTo) {
        existingTask = await rtdbService.getData(`tasks/${orgId}/${taskId}`).catch(() => null);
      }

      try {
        await apiClient.patch(`/api/workspaces/${encodeURIComponent(orgId)}/tasks/${encodeURIComponent(taskId)}`, patch);
      } catch (_apiErr) {
        // Fallback to direct RTDB update
        await rtdbService.updateData(`tasks/${orgId}/${taskId}`, patch);
      }

      // Trigger completion notification and activity if status flipped to Completed
      if (updates.status === 'Completed' && existingTask?.status !== 'Completed') {
        const taskTitle = existingTask?.title || updates.title || 'Task';
        inAppNotificationService.dispatchNotificationEvent(
          NOTIFICATION_TYPES.TASK_COMPLETED,
          {
            workspaceId: orgId,
            taskId,
            taskTitle,
            createdByUid: existingTask?.createdBy || null,
          },
          actorUser
        ).catch((err) => {
          console.warn('[taskService] Failed to dispatch task completion notification:', err?.message);
        });

        if (actorUser?.uid) {
          activityService.recordWorkspaceActivity(orgId, {
            eventType: ACTIVITY_EVENT_TYPES.TASK_COMPLETED,
            actorId: actorUser.uid,
            actorType: 'user',
            actorName: actorUser.displayName || actorUser.email || 'Team Member',
            actorPhotoURL: actorUser.photoURL || null,
            resourceType: 'task',
            resourceId: taskId,
            resourceTitle: taskTitle,
          }).catch((err) => console.warn('[taskService] Failed to record task completion activity:', err?.message));
        }
      }
    } catch (error) {
      console.error('[taskService] updateTask error:', error);
      throw error;
    }
  },

  /**
   * Quick status update helper (e.g. dragging or changing status select).
   */
  updateTaskStatus: async (orgId, taskId, newStatus, actorUser = null) => {
    return await taskService.updateTask(orgId, taskId, { status: newStatus }, actorUser);
  },

  /**
   * Assign or reassign a task to an organization member.
   */
  assignTask: async (orgId, taskId, assignedToUid, assignedToName, actorUser = null) => {
    const res = await taskService.updateTask(orgId, taskId, {
      assignedTo: assignedToUid || '',
      assignedToName: assignedToName || 'Unassigned',
    }, actorUser);

    if (assignedToUid && (!actorUser || assignedToUid !== actorUser.uid)) {
      const taskDoc = await rtdbService.getData(`tasks/${orgId}/${taskId}`).catch(() => null);
      inAppNotificationService.dispatchNotificationEvent(
        NOTIFICATION_TYPES.TASK_ASSIGNED,
        {
          workspaceId: orgId,
          taskId,
          taskTitle: taskDoc?.title || 'Task',
          assignedToUid,
          priority: taskDoc?.priority || 'Medium',
        },
        actorUser
      ).catch((err) => {
        console.warn('[taskService] Failed to dispatch task assignment notification:', err?.message);
      });
    }

    return res;
  },

  /**
   * Soft delete a task.
   */
  deleteTask: async (orgId, taskId) => {
    if (!orgId || !taskId) return;
    try {
      try {
        await apiClient.delete(`/api/workspaces/${encodeURIComponent(orgId)}/tasks/${encodeURIComponent(taskId)}`);
      } catch (_apiErr) {
        await rtdbService.updateData(`tasks/${orgId}/${taskId}`, {
          isDeleted: true,
          updatedAt: Date.now(),
        });
      }
    } catch (error) {
      console.error('[taskService] deleteTask error:', error);
      throw error;
    }
  },

  /**
   * Real-time subscription to tasks for an organization.
   */
  subscribeToTasks: (orgId, callback) => {
    if (!orgId) {
      callback([]);
      return () => {};
    }

    return rtdbService.subscribe(`tasks/${orgId}`, (tasksObj) => {
      if (!tasksObj) {
        callback([]);
        return;
      }
      const activeList = Object.values(tasksObj).filter((t) => t && !t.isDeleted);
      callback(activeList);
    });
  },
};
