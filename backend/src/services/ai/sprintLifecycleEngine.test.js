import assert from 'node:assert';
import test from 'node:test';

// Sprint Lifecycle Calculation Engine Unit Test
function calculateSprintMetrics(tasks = [], targetTaskIds = null) {
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
}

test('Sprint Lifecycle Engine Tests', async (t) => {
  await t.test('1.1: Calculates velocity and completion metrics accurately', () => {
    const mockTasks = [
      { taskId: 't1', title: 'DB Schema', status: 'Completed', priority: 'Critical' },
      { taskId: 't2', title: 'API Endpoints', status: 'Completed', priority: 'High' },
      { taskId: 't3', title: 'Auth flow', status: 'In Progress', priority: 'High' },
      { taskId: 't4', title: 'UI Dashboard', status: 'Todo', priority: 'Medium' },
      { taskId: 't5', title: 'Testing', status: 'Review', priority: 'Low' },
    ];

    const metrics = calculateSprintMetrics(mockTasks);

    assert.strictEqual(metrics.totalTasks, 5);
    assert.strictEqual(metrics.completedTasks, 2);
    assert.strictEqual(metrics.uncompletedTasks, 3);
    assert.strictEqual(metrics.completionRate, 40);
    assert.strictEqual(metrics.priorityBreakdown.Critical, 1);
    assert.strictEqual(metrics.priorityBreakdown.High, 2);
    assert.deepStrictEqual(metrics.incompleteTaskIds, ['t3', 't4', 't5']);
  });

  await t.test('1.2: Handles zero tasks gracefully without division by zero', () => {
    const metrics = calculateSprintMetrics([]);
    assert.strictEqual(metrics.totalTasks, 0);
    assert.strictEqual(metrics.completedTasks, 0);
    assert.strictEqual(metrics.completionRate, 0);
    assert.deepStrictEqual(metrics.incompleteTaskIds, []);
  });

  await t.test('1.3: Excludes soft-deleted tasks from metric calculations', () => {
    const mockTasks = [
      { taskId: 't1', status: 'Completed', priority: 'High' },
      { taskId: 't2', status: 'Todo', priority: 'Low', isDeleted: true },
    ];
    const metrics = calculateSprintMetrics(mockTasks);
    assert.strictEqual(metrics.totalTasks, 1);
    assert.strictEqual(metrics.completedTasks, 1);
    assert.strictEqual(metrics.completionRate, 100);
  });

  await t.test('1.4: Calculates metrics strictly targeting selective taskIds', () => {
    const mockTasks = [
      { taskId: 't1', status: 'Completed', priority: 'High' },
      { taskId: 't2', status: 'In Progress', priority: 'Critical' },
      { taskId: 't3', status: 'Todo', priority: 'Low' },
      { taskId: 't4', status: 'Todo', priority: 'Medium' },
    ];
    // Select only t1 and t2 for Sprint 1
    const metrics = calculateSprintMetrics(mockTasks, ['t1', 't2']);
    assert.strictEqual(metrics.totalTasks, 2);
    assert.strictEqual(metrics.completedTasks, 1);
    assert.strictEqual(metrics.uncompletedTasks, 1);
    assert.strictEqual(metrics.completionRate, 50);
    assert.deepStrictEqual(metrics.incompleteTaskIds, ['t2']);
  });

  await t.test('1.5: Enforces single active sprint concurrency lock logic', () => {
    const existingActiveSprint = { sprintId: 'sprint_1', status: 'active', name: 'Sprint 1' };
    const canStartNewSprint = (activeSprint) => !activeSprint || activeSprint.status !== 'active';

    assert.strictEqual(canStartNewSprint(existingActiveSprint), false, 'Must reject starting second sprint while first is active');
    assert.strictEqual(canStartNewSprint(null), true, 'May start sprint when none active');
    assert.strictEqual(canStartNewSprint({ status: 'completed' }), true, 'May start sprint when previous is completed');
  });

  await t.test('1.6: Excludes completed tasks from eligible sprint planning task scope', () => {
    const mockAllTasks = [
      { taskId: 't1', title: 'Task 1', status: 'Completed' },
      { taskId: 't2', title: 'Task 2', status: 'In Progress' },
      { taskId: 't3', title: 'Task 3', status: 'Todo' },
      { taskId: 't4', title: 'Task 4', status: 'Completed' },
    ];

    const getEligibleSprintTasks = (tasks) => tasks.filter((t) => t && !t.isDeleted && t.status !== 'Completed');
    const eligible = getEligibleSprintTasks(mockAllTasks);

    assert.strictEqual(eligible.length, 2);
    assert.deepStrictEqual(eligible.map((t) => t.taskId), ['t2', 't3']);
  });

  await t.test('1.7: Adding an in-flight task to active sprint scope updates sprint metrics dynamically', () => {
    let sprintTaskIds = ['t1', 't2'];
    const mockTasks = [
      { taskId: 't1', status: 'Completed' },
      { taskId: 't2', status: 'In Progress' },
      { taskId: 't3', status: 'Todo' }, // new task added in-flight
    ];

    // Initial metrics: 1 of 2 done (50%)
    let metrics = calculateSprintMetrics(mockTasks, sprintTaskIds);
    assert.strictEqual(metrics.totalTasks, 2);
    assert.strictEqual(metrics.completionRate, 50);

    // In-flight addition:
    sprintTaskIds = [...sprintTaskIds, 't3'];
    metrics = calculateSprintMetrics(mockTasks, sprintTaskIds);
    // Updated metrics: 1 of 3 done (33%)
    assert.strictEqual(metrics.totalTasks, 3);
    assert.strictEqual(metrics.completedTasks, 1);
    assert.strictEqual(metrics.completionRate, 33);
    assert.deepStrictEqual(metrics.incompleteTaskIds, ['t2', 't3']);
  });

  await t.test('1.8: Moving an in-flight task to backlog recalculates sprint metrics', () => {
    let sprintTaskIds = ['t1', 't2', 't3'];
    const mockTasks = [
      { taskId: 't1', status: 'Completed' },
      { taskId: 't2', status: 'In Progress' },
      { taskId: 't3', status: 'Todo' },
    ];

    // t3 is moved to backlog:
    sprintTaskIds = sprintTaskIds.filter((id) => id !== 't3');
    const metrics = calculateSprintMetrics(mockTasks, sprintTaskIds);
    assert.strictEqual(metrics.totalTasks, 2);
    assert.strictEqual(metrics.completionRate, 50);
    assert.deepStrictEqual(metrics.incompleteTaskIds, ['t2']);
  });

  await t.test('1.9: Deleting an in-flight task removes it from sprint scope', () => {
    let sprintTaskIds = ['t1', 't2'];
    const mockTasks = [
      { taskId: 't1', status: 'Completed' },
      { taskId: 't2', status: 'Todo', isDeleted: true }, // deleted task
    ];

    sprintTaskIds = sprintTaskIds.filter((id) => id !== 't2');
    const metrics = calculateSprintMetrics(mockTasks, sprintTaskIds);
    assert.strictEqual(metrics.totalTasks, 1);
    assert.strictEqual(metrics.completedTasks, 1);
    assert.strictEqual(metrics.completionRate, 100);
  });

  await t.test('1.10: Move to Backlog action visibility logic strictly requires an ongoing active sprint and task membership', () => {
    const shouldShowMoveToBacklog = ({ isSprintActive, activeSprintId, taskSprintId, isLeader, isCompletedSprint }) => {
      if (isCompletedSprint) return false;
      if (!isSprintActive) return false;
      if (!isLeader) return false;
      if (!activeSprintId || taskSprintId !== activeSprintId) return false;
      return true;
    };

    // Scenario A: Sprint is completed -> NEVER show
    assert.strictEqual(
      shouldShowMoveToBacklog({ isSprintActive: false, activeSprintId: null, taskSprintId: 'sprint_1', isLeader: true, isCompletedSprint: true }),
      false
    );

    // Scenario B: No sprint active (planning mode) -> NEVER show even if task has legacy sprintId
    assert.strictEqual(
      shouldShowMoveToBacklog({ isSprintActive: false, activeSprintId: null, taskSprintId: 'sprint_1', isLeader: true, isCompletedSprint: false }),
      false
    );

    // Scenario C: Sprint is ongoing, but task is in backlog (taskSprintId != activeSprintId) -> NEVER show
    assert.strictEqual(
      shouldShowMoveToBacklog({ isSprintActive: true, activeSprintId: 'sprint_active', taskSprintId: null, isLeader: true, isCompletedSprint: false }),
      false
    );

    // Scenario D: Regular member (not leader) -> NEVER show
    assert.strictEqual(
      shouldShowMoveToBacklog({ isSprintActive: true, activeSprintId: 'sprint_active', taskSprintId: 'sprint_active', isLeader: false, isCompletedSprint: false }),
      false
    );

    // Scenario E: Ongoing sprint + committed task + team captain/owner -> ONLY THEN SHOW
    assert.strictEqual(
      shouldShowMoveToBacklog({ isSprintActive: true, activeSprintId: 'sprint_active', taskSprintId: 'sprint_active', isLeader: true, isCompletedSprint: false }),
      true
    );
  });
});
