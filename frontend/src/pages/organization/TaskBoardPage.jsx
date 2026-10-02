import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useOrg } from '../../hooks/useOrg';
import { useToast } from '../../hooks/useToast';
import { TaskProvider, TaskContext } from '../../contexts/TaskContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { ErrorBoundary } from '../../components/feedback/ErrorBoundary';
import { TaskCard } from '../../features/tasks/TaskCard';
import { CreateTaskModal } from '../../features/tasks/CreateTaskModal';
import { EditTaskModal } from '../../features/tasks/EditTaskModal';
import { Plus, Search, CheckSquare, ListTodo, Sparkles } from 'lucide-react';
import { aiBlueprintService } from '../../services/aiBlueprintService';

function TaskBoardContent() {
  const { user } = useAuth();
  const { org } = useOrg();
  const { toast } = useToast();
  const taskContext = React.useContext(TaskContext);

  const {
    tasks,
    filteredTasks,
    loading,
    searchQuery,
    setSearchQuery,
    priorityFilter,
    setPriorityFilter,
    sortBy,
    setSortBy,
    createTask,
    updateTask,
    updateTaskStatus,
    deleteTask,
  } = taskContext;

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [deletingTask, setDeletingTask] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSyncBlueprintTasks = async () => {
    if (!org?.orgId || !user?.uid) return;
    setIsSyncing(true);
    try {
      const res = await aiBlueprintService.syncBlueprintTasks(org.orgId, user.uid);
      const msg = res?.data?.message || res?.message || 'Blueprint planned tasks synchronized to Task Board.';
      toast.success(msg);
    } catch (err) {
      console.error('[TaskBoardPage] handleSyncBlueprintTasks error:', err);
      toast.error(err.message || 'Failed to sync Blueprint tasks.');
    } finally {
      setIsSyncing(false);
    }
  };

  if (org && org.status !== 'project') {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <EmptyState
          icon={<ListTodo className="h-8 w-8 text-slate-400" />}
          title="Sprint Task Board Locked"
          description="The Sprint Task Board will unlock once the Organization Owner selects a winning MVP project blueprint."
          action={
            <Link to={`/workspaces/${org.orgId}/ideas`}>
              <Button variant="primary">Go to Idea Board</Button>
            </Link>
          }
        />
      </div>
    );
  }

  // Calculate Progress Metrics
  const activeTasks = tasks || [];
  const activeFilteredTasks = filteredTasks || [];

  const totalTasks = activeTasks.length;
  const completedTasks = activeTasks.filter((t) => t && t.status === 'Completed').length;
  const progressPercentage =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const handleCreateTask = async (taskData) => {
    await createTask(taskData);
  };

  const handleUpdateTask = async (taskId, updates) => {
    await updateTask(taskId, updates);
  };

  const handleStatusChange = async (taskId, newStatus) => {
    await updateTaskStatus(taskId, newStatus);
  };

  const handleConfirmDelete = async () => {
    if (!deletingTask) return;
    setIsDeleting(true);
    try {
      await deleteTask(deletingTask.taskId);
      setDeletingTask(null);
    } catch (err) {
      // Error handled by NotificationService inside TaskContext or Service
    } finally {
      setIsDeleting(false);
    }
  };

  // Group Tasks by Kanban Status Swimlane
  const todoTasks = activeFilteredTasks.filter((t) => t && t.status === 'Todo');
  const inProgressTasks = activeFilteredTasks.filter((t) => t && t.status === 'In Progress');
  const reviewTasks = activeFilteredTasks.filter((t) => t && t.status === 'Review');
  const completedList = activeFilteredTasks.filter((t) => t && t.status === 'Completed');

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 overflow-x-hidden">
      {/* Real-time Sprint Progress Metric Header */}
      <Card className="p-6 bg-white border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <span className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary-600" /> Overall Sprint Build Completion
          </span>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-500">
              {completedTasks} of {totalTasks} Tasks Done ({progressPercentage}%)
            </span>
            <Button
              variant="outline"
              size="sm"
              icon={<Sparkles className="h-4 w-4 text-primary-600" />}
              onClick={handleSyncBlueprintTasks}
              isLoading={isSyncing}
              className="shrink-0 border-primary-200 hover:bg-primary-50 text-primary-700 font-bold"
            >
              Sync Blueprint Tasks
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setIsCreateModalOpen(true)}
              className="shrink-0"
            >
              + New Sprint Task
            </Button>
          </div>
        </div>
        <ProgressBar percentage={progressPercentage} size="md" />
      </Card>

      {/* Filter & Sort Controls Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Input
            placeholder="Search tasks or assignee..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Priority:
            </span>
            <Select
              options={[
                { value: 'all', label: 'All Priorities' },
                { value: 'Critical', label: 'Critical' },
                { value: 'High', label: 'High' },
                { value: 'Medium', label: 'Medium' },
                { value: 'Low', label: 'Low' },
              ]}
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-32 py-1 text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Sort By:
            </span>
            <Select
              options={[
                { value: 'priority', label: 'Priority' },
                { value: 'due_date', label: 'Due Date' },
                { value: 'updated', label: 'Recently Updated' },
              ]}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-36 py-1 text-xs"
            />
          </div>
        </div>
      </div>

      {/* 4-Column Realtime Kanban Board */}
      {loading ? (
        <LoadingSkeleton variant="card" count={3} />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={<ListTodo className="h-8 w-8 text-primary-500" />}
          title="No Sprint Tasks Created Yet"
          description="Break down your Project Blueprint into actionable build items or sync planned technical tasks directly from the AI Blueprint."
          action={
            <div className="flex items-center gap-3">
              <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
                Create First Task
              </Button>
              <Button
                variant="outline"
                icon={<Sparkles className="h-4 w-4 text-primary-600" />}
                onClick={handleSyncBlueprintTasks}
                isLoading={isSyncing}
                className="border-primary-300 hover:bg-primary-50 text-primary-700 font-bold"
              >
                Sync Blueprint Tasks
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
          {/* Column 1: Todo */}
          <div className="space-y-3 bg-slate-100/60 p-4 rounded-2xl border border-slate-200/60 min-h-[400px]">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-400" /> Todo
              </h3>
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                {todoTasks.length}
              </span>
            </div>
            {todoTasks.map((task) => (
              <TaskCard
                key={task.taskId}
                task={task}
                onEdit={(t) => setEditingTask(t)}
                onDelete={(t) => setDeletingTask(t)}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>

          {/* Column 2: In Progress */}
          <div className="space-y-3 bg-primary-50/50 p-4 rounded-2xl border border-primary-200/60 min-h-[400px]">
            <div className="flex items-center justify-between pb-2 border-b border-primary-200">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-primary-900 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-primary-500 animate-pulse" /> In Progress
              </h3>
              <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-bold text-primary-800">
                {inProgressTasks.length}
              </span>
            </div>
            {inProgressTasks.map((task) => (
              <TaskCard
                key={task.taskId}
                task={task}
                onEdit={(t) => setEditingTask(t)}
                onDelete={(t) => setDeletingTask(t)}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>

          {/* Column 3: Review */}
          <div className="space-y-3 bg-amber-50/50 p-4 rounded-2xl border border-amber-200/60 min-h-[400px]">
            <div className="flex items-center justify-between pb-2 border-b border-amber-200">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-900 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Review
              </h3>
              <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                {reviewTasks.length}
              </span>
            </div>
            {reviewTasks.map((task) => (
              <TaskCard
                key={task.taskId}
                task={task}
                onEdit={(t) => setEditingTask(t)}
                onDelete={(t) => setDeletingTask(t)}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>

          {/* Column 4: Completed */}
          <div className="space-y-3 bg-emerald-50/50 p-4 rounded-2xl border border-emerald-200/60 min-h-[400px]">
            <div className="flex items-center justify-between pb-2 border-b border-emerald-200">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-900 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Completed
              </h3>
              <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-[11px] font-bold text-emerald-900">
                {completedList.length}
              </span>
            </div>
            {completedList.map((task) => (
              <TaskCard
                key={task.taskId}
                task={task}
                onEdit={(t) => setEditingTask(t)}
                onDelete={(t) => setDeletingTask(t)}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateTask}
      />

      {/* Edit Task Modal */}
      {editingTask && (
        <EditTaskModal
          isOpen={Boolean(editingTask)}
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSubmit={handleUpdateTask}
        />
      )}

      {/* Delete Task Confirmation Modal */}
      <ConfirmDialog
        isOpen={Boolean(deletingTask)}
        title="Delete Task"
        description={`Are you sure you want to remove "${deletingTask?.title}" from the Task Board?`}
        confirmLabel="Delete Task"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingTask(null)}
      />
    </div>
  );
}

export default function TaskBoardPage() {
  return (
    <TaskProvider>
      <ErrorBoundary>
        <TaskBoardContent />
      </ErrorBoundary>
    </TaskProvider>
  );
}
