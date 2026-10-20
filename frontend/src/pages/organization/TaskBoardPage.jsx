import React, { useState, useEffect, useRef } from 'react';
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
import { cn } from '../../utils/cn';

function TaskBoardContent() {
  const { user } = useAuth();
  const { org, isLeader } = useOrg();
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
  const [mobileTab, setMobileTab] = useState('Todo');
  const hasInitializedTabRef = useRef(false);

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

  // Auto-switch mobile tab to the first non-empty column on initial load
  useEffect(() => {
    if (!hasInitializedTabRef.current && activeFilteredTasks.length > 0) {
      if (todoTasks.length > 0) {
        setMobileTab('Todo');
      } else if (inProgressTasks.length > 0) {
        setMobileTab('In Progress');
      } else if (reviewTasks.length > 0) {
        setMobileTab('Review');
      } else if (completedList.length > 0) {
        setMobileTab('Completed');
      }
      hasInitializedTabRef.current = true;
    }
  }, [activeFilteredTasks.length, todoTasks.length, inProgressTasks.length, reviewTasks.length, completedList.length]);

  const COLUMNS = [
    {
      id: 'Todo',
      label: 'Todo',
      tasks: todoTasks,
      dotColor: 'bg-slate-400',
      badgeBg: 'bg-slate-200 text-slate-700',
      columnBg: 'bg-slate-100/60 border-slate-200/80',
      activeTabBg: 'bg-slate-800 text-white',
    },
    {
      id: 'In Progress',
      label: 'In Progress',
      tasks: inProgressTasks,
      dotColor: 'bg-primary-500 animate-pulse',
      badgeBg: 'bg-primary-100 text-primary-800',
      columnBg: 'bg-primary-50/50 border-primary-200/60',
      activeTabBg: 'bg-primary-600 text-white',
    },
    {
      id: 'Review',
      label: 'Review',
      tasks: reviewTasks,
      dotColor: 'bg-amber-500',
      badgeBg: 'bg-amber-200 text-amber-900',
      columnBg: 'bg-amber-50/50 border-amber-200/60',
      activeTabBg: 'bg-amber-600 text-white',
    },
    {
      id: 'Completed',
      label: 'Completed',
      tasks: completedList,
      dotColor: 'bg-emerald-500',
      badgeBg: 'bg-emerald-200 text-emerald-900',
      columnBg: 'bg-emerald-50/50 border-emerald-200/60',
      activeTabBg: 'bg-emerald-600 text-white',
    },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 overflow-x-hidden">
      {/* Real-time Sprint Progress Metric Header */}
      <Card className="p-4 sm:p-6 bg-white border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <span className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary-600 shrink-0" /> Overall Sprint Build Completion
          </span>
          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 w-full lg:w-auto">
            <span className="text-xs font-bold text-slate-500 w-full sm:w-auto text-left sm:text-right">
              {completedTasks} of {totalTasks} Tasks Done ({progressPercentage}%)
            </span>
            {isLeader && (
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Sparkles className="h-4 w-4 text-primary-600" />}
                  onClick={handleSyncBlueprintTasks}
                  isLoading={isSyncing}
                  className="shrink-0 border-primary-200 hover:bg-primary-50 text-primary-700 font-bold text-xs"
                >
                  <span className="hidden sm:inline">Sync Blueprint Tasks</span>
                  <span className="sm:hidden">Sync Tasks</span>
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() => setIsCreateModalOpen(true)}
                  className="shrink-0 font-bold text-xs"
                >
                  <span>New Task</span>
                  <span className="hidden sm:inline">&nbsp;Sprint</span>
                </Button>
              </div>
            )}
          </div>
        </div>
        <ProgressBar percentage={progressPercentage} size="md" />
      </Card>

      {/* Filter & Sort Controls Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative w-full md:w-80">
          <Input
            placeholder="Search tasks or assignee..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-start md:justify-end">
          <div className="flex items-center gap-1.5 flex-1 sm:flex-none">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0">
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
              className="w-full sm:w-36 py-1 text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-1 sm:flex-none">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0">
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
              className="w-full sm:w-36 py-1 text-xs"
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
        <div className="space-y-4">
          {/* Mobile Segmented Column Tabs (shown on < lg screens) */}
          <div className="lg:hidden flex items-center p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80 gap-2 overflow-x-auto scrollbar-none">
            {COLUMNS.map((col) => {
              const isActive = mobileTab === col.id;
              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => setMobileTab(col.id)}
                  className={cn(
                    'py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shrink-0 whitespace-nowrap',
                    isActive
                      ? `${col.activeTabBg} shadow-sm ring-1 ring-black/5`
                      : 'text-slate-600 hover:text-slate-900 bg-white/70 hover:bg-white border border-slate-200/60'
                  )}
                >
                  <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', col.dotColor)} />
                  <span className="font-extrabold tracking-tight">{col.label}</span>
                  <span
                    className={cn(
                      'text-[10px] px-2 py-0.5 rounded-full font-black shrink-0',
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
                    )}
                  >
                    {col.tasks.length}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Kanban Columns Grid (Single column on mobile, 4 columns on lg) */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
            {COLUMNS.map((col) => {
              const isVisibleOnMobile = mobileTab === col.id;
              return (
                <div
                  key={col.id}
                  className={cn(
                    'flex flex-col rounded-2xl border p-4 transition-all min-h-[300px]',
                    col.columnBg,
                    isVisibleOnMobile ? 'flex' : 'hidden lg:flex'
                  )}
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-inherit">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                      <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', col.dotColor)} />
                      {col.label}
                    </h3>
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', col.badgeBg)}>
                      {col.tasks.length} {col.tasks.length === 1 ? 'Task' : 'Tasks'}
                    </span>
                  </div>

                  {/* Scrollable Tasks List with internal scrollbar */}
                  <div className="flex-1 overflow-y-auto max-h-[520px] lg:max-h-[640px] space-y-3 pr-1">
                    {col.tasks.length === 0 ? (
                      <div className="h-32 flex flex-col items-center justify-center text-center p-4 rounded-xl border border-dashed border-slate-300/60 bg-white/40 text-slate-400">
                        <p className="text-xs font-semibold">No tasks in this stage</p>
                      </div>
                    ) : (
                      col.tasks.map((task) => (
                        <TaskCard
                          key={task.taskId}
                          task={task}
                          onEdit={isLeader ? (t) => setEditingTask(t) : null}
                          onDelete={isLeader ? (t) => setDeletingTask(t) : null}
                          onStatusChange={isLeader ? handleStatusChange : null}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
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
