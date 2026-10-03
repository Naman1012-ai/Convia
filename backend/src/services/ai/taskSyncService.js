import { rtdbService } from '../rtdbService.js';
import { notificationService } from '../notificationService.js';
import { NOTIFICATION_TYPES } from '../../constants/notificationConstants.js';
import {
  extractCanonicalVersionKey,
  extractCanonicalVersionNumber,
  validatePathSegment,
  validateRtdbUpdateMap,
} from '../../utils/blueprintPathBuilder.js';

/**
 * Convia Blueprint 2.0 — Task Board Synchronization Engine (Post-Phase-11)
 *
 * Responsibilities:
 * 1. Synchronizes Blueprint planned tasks (v2.execution.tasks) into the authoritative Task Board (tasks/{workspaceId}).
 * 2. Idempotent & Deterministic: Matches tasks by `blueprintTaskId` to prevent duplicate creation on regeneration.
 * 3. Preserves Execution Work: Retains task status (e.g. 'In Progress', 'Completed'), assignees, comments, and manual edits.
 * 4. Version Traceability: Records source Blueprint version and links convertedTaskId back to the Blueprint task structure.
 */

export const taskSyncService = {
  /**
   * Synchronizes Blueprint planned tasks into the Task Board for a workspace.
   *
   * @param {string} workspaceId - The workspace/organization ID.
   * @param {Object} blueprint - The canonical Blueprint document.
   * @param {string} triggeredByUid - UID of user or 'system'.
   * @returns {Promise<Object>} Diagnostic synchronization results.
   */
  synchronizeBlueprintTasks: async (workspaceId, blueprint, triggeredByUid = 'system') => {
    const validWorkspaceId = validatePathSegment(workspaceId, 'workspaceId');
    if (!blueprint || !blueprint.content) {
      throw new Error('Valid Blueprint document is required for task synchronization.');
    }

    const v2 = blueprint.rawV2Content || blueprint.content?.rawV2Content || blueprint.content?.__v2Content || blueprint.content || {};
    const execution = v2.execution || {};
    const plannedTasks = Array.isArray(execution.tasks) ? execution.tasks : [];

    if (plannedTasks.length === 0) {
      console.log(`ℹ️ [TaskSync] No planned tasks found in Blueprint for workspace ${validWorkspaceId}.`);
      return {
        totalPlannedTasks: 0,
        createdCount: 0,
        updatedCount: 0,
        preservedCount: 0,
        totalExecutionTasks: 0,
      };
    }

    const timestamp = Date.now();
    const blueprintVersionNum = extractCanonicalVersionNumber(blueprint.version || blueprint.versionId) || '1.0';
    const blueprintVersionKey = extractCanonicalVersionKey(blueprint.version || blueprint.versionId || blueprintVersionNum) || 'v1_0';
    const rawMvpId = blueprint.mvpIdeaId || blueprint.ideaId || 'active_project';
    const mvpIdeaId = validatePathSegment(rawMvpId, 'mvpIdeaId');

    // 1. Fetch existing Task Board execution tasks
    const existingTasksObj = (await rtdbService.getData(`tasks/${validWorkspaceId}`)) || {};
    const existingTasks = Object.values(existingTasksObj).filter((t) => t && !t.isDeleted);

    // Map existing tasks by blueprintTaskId AND by taskId for fast lookup
    const existingByBlueprintTaskId = new Map();
    const existingByTaskId = new Map();

    existingTasks.forEach((t) => {
      if (t.blueprintTaskId) {
        existingByBlueprintTaskId.set(t.blueprintTaskId, t);
      }
      if (t.taskId) {
        existingByTaskId.set(t.taskId, t);
      }
    });

    let createdCount = 0;
    let updatedCount = 0;
    let preservedCount = 0;

    const tasksToSave = {};
    const updatedPlannedTasks = [];
    const newlyAssignedTasks = [];

    for (const bpTask of plannedTasks) {
      const bpTaskId = validatePathSegment(
        bpTask.id || `TASK-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        'blueprintTaskId'
      );

      // Check if task already exists on Task Board
      const existingTask =
        existingByBlueprintTaskId.get(bpTaskId) ||
        (bpTask.convertedTaskId ? existingByTaskId.get(bpTask.convertedTaskId) : null);

      if (existingTask && existingTask.taskId) {
        const executionTaskId = validatePathSegment(existingTask.taskId, 'executionTaskId');

        // PRESERVE existing execution work: status, assignees, manual edits, completedAt
        const preservedStatus = existingTask.status || 'Todo';
        const preservedAssignee = existingTask.assignedTo || bpTask.assignedUserId || '';
        const preservedAssigneeName = existingTask.assignedToName || bpTask.assignedUserName || (preservedAssignee ? 'Assigned Member' : 'Unassigned');
        const isCompleted = preservedStatus === 'Completed' || preservedStatus === 'completed';

        const updatedExecutionTask = {
          ...existingTask,
          executionTaskId,
          blueprintId: existingTask.blueprintId || blueprint.blueprintId || `bp_${validWorkspaceId}_${mvpIdeaId}`,
          blueprintTaskId: bpTaskId,
          sourceBlueprintTaskId: existingTask.sourceBlueprintTaskId || bpTaskId,
          blueprintVersion: existingTask.blueprintVersion || blueprintVersionNum,
          sourceBlueprintVersionId: existingTask.sourceBlueprintVersionId || blueprintVersionNum,
          projectId: mvpIdeaId,
          orgId: validWorkspaceId,
          workspaceId: validWorkspaceId,
          title: bpTask.title || existingTask.title || 'Untitled Blueprint Task',
          description: bpTask.description || existingTask.description || '',
          estimatedEffortHours: Number(bpTask.estimatedEffortHours) || Number(existingTask.estimatedEffortHours) || 0,
          priority: existingTask.priority || bpTask.priority || 'Medium',
          status: preservedStatus,
          assignedTo: preservedAssignee,
          assignedToName: preservedAssigneeName,
          recommendedRoleId: bpTask.recommendedRoleId || existingTask.recommendedRoleId || null,
          requiredCapabilities: bpTask.requiredCapabilities || existingTask.requiredCapabilities || [],
          isCriticalPath: Boolean(bpTask.isCriticalPath ?? existingTask.isCriticalPath),
          updatedAt: timestamp,
          completedAt: isCompleted ? (existingTask.completedAt || timestamp) : null,
          isDeleted: false,
        };

        const taskPathKey = `tasks/${validWorkspaceId}/${executionTaskId}`;
        tasksToSave[taskPathKey] = updatedExecutionTask;
        updatedCount += 1;
        if (isCompleted || existingTask.status !== 'Todo' || existingTask.assignedTo) {
          preservedCount += 1;
        }

        updatedPlannedTasks.push({
          ...bpTask,
          id: bpTaskId,
          convertedTaskId: executionTaskId,
          assignedUserId: preservedAssignee || null,
          assignedUserName: preservedAssignee ? preservedAssigneeName : null,
          status: preservedStatus,
        });
      } else {
        // CREATE new execution task
        const newTaskId = `task_${timestamp}_${Math.random().toString(36).substring(2, 7)}`;
        const executionTaskId = validatePathSegment(newTaskId, 'newExecutionTaskId');
        const assignedUserId = bpTask.assignedUserId || '';
        const assignedUserName = bpTask.assignedUserName || (assignedUserId ? 'Assigned Member' : 'Unassigned');

        const newExecutionTask = {
          taskId: executionTaskId,
          executionTaskId,
          blueprintId: blueprint.blueprintId || `bp_${validWorkspaceId}_${mvpIdeaId}`,
          blueprintTaskId: bpTaskId,
          sourceBlueprintTaskId: bpTaskId,
          blueprintVersion: blueprintVersionNum,
          sourceBlueprintVersionId: blueprintVersionNum,
          orgId: validWorkspaceId,
          workspaceId: validWorkspaceId,
          projectId: mvpIdeaId,
          title: bpTask.title || 'Untitled Blueprint Task',
          description: bpTask.description || '',
          estimatedEffortHours: Number(bpTask.estimatedEffortHours) || 0,
          priority: bpTask.priority || 'Medium',
          status: bpTask.status === 'Completed' ? 'Completed' : 'Todo',
          assignedTo: assignedUserId,
          assignedToName: assignedUserName,
          recommendedRoleId: bpTask.recommendedRoleId || null,
          requiredCapabilities: bpTask.requiredCapabilities || [],
          isCriticalPath: Boolean(bpTask.isCriticalPath),
          createdBy: triggeredByUid,
          createdByName: 'AI Blueprint Planner',
          createdAt: timestamp,
          updatedAt: timestamp,
          completedAt: bpTask.status === 'Completed' ? timestamp : null,
          isDeleted: false,
        };

        const taskPathKey = `tasks/${validWorkspaceId}/${executionTaskId}`;
        tasksToSave[taskPathKey] = newExecutionTask;
        createdCount += 1;

        if (assignedUserId && assignedUserId !== triggeredByUid) {
          newlyAssignedTasks.push({
            taskId: executionTaskId,
            title: newExecutionTask.title,
            assignedTo: assignedUserId,
            priority: newExecutionTask.priority,
          });
        }

        updatedPlannedTasks.push({
          ...bpTask,
          id: bpTaskId,
          convertedTaskId: executionTaskId,
        });
      }
    }

    // 2. Validate update map and execute multi-path atomic commit for execution tasks
    if (Object.keys(tasksToSave).length > 0) {
      validateRtdbUpdateMap(tasksToSave, 'taskSyncService.synchronizeBlueprintTasks');
      await rtdbService.updateData('/', tasksToSave);

      // Dispatch TASK_ASSIGNED notifications for newly assigned tasks
      for (const t of newlyAssignedTasks) {
        notificationService.dispatchNotificationEvent(
          NOTIFICATION_TYPES.TASK_ASSIGNED,
          {
            workspaceId: validWorkspaceId,
            taskId: t.taskId,
            taskTitle: t.title,
            assignedToUid: t.assignedTo,
            priority: t.priority,
          },
          { uid: triggeredByUid || 'system', displayName: 'AI Blueprint Planner' }
        ).catch((notifErr) => console.warn('[taskSyncService] Task assigned notification warning:', notifErr.message));
      }
    }

    // 3. Update Blueprint document with linked convertedTaskIds
    if (execution.tasks) {
      execution.tasks = updatedPlannedTasks;
      const bpUpdate = {
        updatedAt: timestamp,
        lastTaskSyncAt: timestamp,
        content: blueprint.content,
      };

      const bpUpdatePromises = [
        rtdbService.updateData(`blueprints/${validWorkspaceId}/${mvpIdeaId}`, bpUpdate).catch(() => {}),
        rtdbService.updateData(`blueprints/${validWorkspaceId}/current`, bpUpdate).catch(() => {}),
        rtdbService.updateData(`blueprints/${validWorkspaceId}`, bpUpdate).catch(() => {}),
      ];

      if (blueprintVersionKey) {
        bpUpdatePromises.push(
          rtdbService.updateData(`blueprints/${validWorkspaceId}/${mvpIdeaId}/versions/${blueprintVersionKey}`, bpUpdate).catch(() => {}),
          rtdbService.updateData(`blueprints/${validWorkspaceId}/versions/${blueprintVersionKey}`, bpUpdate).catch(() => {})
        );
      }

      await Promise.all(bpUpdatePromises);
    }

    console.log(`✅ [TaskSync Complete] Workspace: ${validWorkspaceId} | Planned: ${plannedTasks.length} | Created: ${createdCount} | Updated: ${updatedCount} | Preserved: ${preservedCount}`);

    return {
      success: true,
      totalPlannedTasks: plannedTasks.length,
      createdCount,
      updatedCount,
      preservedCount,
      totalExecutionTasks: existingTasks.length + createdCount,
    };
  },
};
