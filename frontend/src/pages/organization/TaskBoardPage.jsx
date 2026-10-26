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
import {
  Plus,
  Search,
  ListTodo,
  Sparkles,
  User,
  FilterX,
  Download,
  FileText,
  ChevronDown,
} from 'lucide-react';
import { aiBlueprintService } from '../../services/aiBlueprintService';
import { exportSprintAsMarkdown, exportSprintAsCsv } from '../../utils/sprintExportUtil';
import { cn } from '../../utils/cn';

function TaskBoardContent() {
  const { user } = useAuth();
  const { org, members, isLeader } = useOrg();
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
    assigneeFilter,
    setAssigneeFilter,
    sortBy,
    setSortBy,
    createTask,
    updateTask,
    updateTaskStatus,
    deleteTask,
  } = taskContext;

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createInitialStatus, setCreateInitialStatus] = useState('Todo');
  const [isSyncing, setIsSyncing] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [deletingTask, setDeletingTask] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState('Todo');
  const [dragOverColumnId, setDragOverColumnId] = useState(null);
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
      // Handled by context/service toast
    } finally {
      setIsDeleting(false);
    }
  };

  // Drag and Drop Handlers
  const handleDragOver = (e, columnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumnId !== columnId) {
      setDragOverColumnId(columnId);
    }
  };

  const handleDragLeave = (e, columnId) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    if (dragOverColumnId === columnId) {
      setDragOverColumnId(null);
    }
  };

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault();
    setDragOverColumnId(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    const task = activeTasks.find((t) => t.taskId === taskId);
    if (!task || task.status === targetStatus) return;

    await handleStatusChange(taskId, targetStatus);
  };

  const handleOpenCreateInStatus = (statusId) => {
    setCreateInitialStatus(statusId);
    setIsCreateModalOpen(true);
  };

  const handleExportMarkdown = () => {
    exportSprintAsMarkdown({
      workspaceName: org?.name || 'Workspace',
      tasks: activeTasks,
      progressPercentage,
    });
    toast.success('Sprint Markdown report downloaded.');
  };

  const handleExportCsv = () => {
    exportSprintAsCsv({
      workspaceName: org?.name || 'Workspace',
      tasks: activeTasks,
    });
    toast.success('Sprint CSV report downloaded.');
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
      badgeBg: 'bg-slate-100 text-slate-700 border border-slate-200',
      columnBg: 'bg-slate-50/70 border-slate-200/90',
      dropActiveBg: 'bg-slate-100 border-slate-400 ring-2 ring-slate-300',
      activeTabBg: 'bg-slate-800 text-white',
    },
    {
      id: 'In Progress',
      label: 'In Progress',
      tasks: inProgressTasks,
      dotColor: 'bg-primary-500 animate-pulse',
      badgeBg: 'bg-primary-50 text-primary-700 border border-primary-200',
      columnBg: 'bg-primary-50/30 border-primary-200/60',
      dropActiveBg: 'bg-primary-50/70 border-primary-400 ring-2 ring-primary-300',
      activeTabBg: 'bg-primary-600 text-white',
    },
    {
      id: 'Review',
      label: 'Review',
      tasks: reviewTasks,
      dotColor: 'bg-amber-500',
      badgeBg: 'bg-amber-50 text-amber-800 border border-amber-200',
      columnBg: 'bg-amber-50/30 border-amber-200/60',
      dropActiveBg: 'bg-amber-50/70 border-amber-400 ring-2 ring-amber-300',
      activeTabBg: 'bg-amber-600 text-white',
    },
    {
      id: 'Completed',
      label: 'Completed',
      tasks: completedList,
      dotColor: 'bg-emerald-500',
      badgeBg: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
      columnBg: 'bg-emerald-50/30 border-emerald-200/60',
      dropActiveBg: 'bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-300',
      activeTabBg: 'bg-emerald-600 text-white',
    },
  ];

  const hasActiveFilters =
    Boolean(searchQuery) ||
    priorityFilter !== 'all' ||
    assigneeFilter !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setPriorityFilter('all');
    setAssigneeFilter('all');
  };

  const isAssignedToMe = user?.uid && assigneeFilter === user.uid;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 overflow-x-hidden">
      {/* Real-time Sprint Progress Metric Header */}
      <Card className="p-4 sm:p-6 bg-white border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary-600 shrink-0" /> Overall Sprint Build Completion
            </span>
            <span className="text-xs font-bold text-slate-500 block">
              {completedTasks} of {totalTasks} Tasks Done ({progressPercentage}%)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">
            {/* Sprint Export Dropdown */}
            <div className="relative inline-block text-left">
              <Button
                variant="outline"
                size="sm"
                icon={<Download className="h-4 w-4 text-slate-600" />}
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                className="shrink-0 text-slate-700 border-slate-200 hover:bg-slate-50 text-xs font-bold"
              >
                <span>Export</span>
                <ChevronDown className="h-3 w-3 ml-0.5" />
              </Button>
              {isExportMenuOpen && (
                <div className="absolute left-0 sm:left-auto sm:right-0 mt-1.5 w-48 rounded-xl bg-white border border-slate-200 shadow-xl py-1 z-30">
                  <button
                    type="button"
                    onClick={() => {
                      setIsExportMenuOpen(false);
                      handleExportMarkdown();
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <FileText className="h-3.5 w-3.5 text-primary-600" />
                    <span>Export Markdown (.md)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsExportMenuOpen(false);
                      handleExportCsv();
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Download className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Export Spreadsheet (.csv)</span>
                  </button>
                </div>
              )}
            </div>

            {isLeader && (
              <>
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
                  onClick={() => handleOpenCreateInStatus('Todo')}
                  className="shrink-0 font-bold text-xs shadow-sm"
                >
                  <span>New Task</span>
                  <span className="hidden sm:inline">&nbsp;Sprint</span>
                </Button>
              </>
            )}
          </div>
        </div>
        <ProgressBar percentage={progressPercentage} size="md" />
      </Card>

      {/* Filter & Sort Controls Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
        {/* Left: Search Bar & My Tasks Quick Toggle */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto flex-1">
          <div className="relative w-full sm:w-72">
            <Input
              placeholder="Search tasks, descriptions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs py-2 bg-slate-50/50 border-slate-200 focus:bg-white"
            />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          </div>

          {/* "My Tasks" Quick Filter Toggle Pill */}
          {user?.uid && (
            <button
              type="button"
              onClick={() => setAssigneeFilter(isAssignedToMe ? 'all' : user.uid)}
              className={cn(
                'px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 border',
                isAssignedToMe
                  ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              )}
            >
              <User className="h-3.5 w-3.5" />
              <span>My Tasks</span>
            </button>
          )}
        </div>

        {/* Right: Dropdowns (Assignee, Priority, Sort) & Clear */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5 w-full lg:w-auto justify-start sm:justify-end">
          {/* Assignee Filter Dropdown */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 hidden sm:inline">
              Assignee:
            </span>
            <Select
              options={[
                { value: 'all', label: 'All Assignees' },
                ...(members || []).map((m) => ({
                  value: m.uid,
                  label: m.displayName || m.name || m.email?.split('@')[0] || 'Member',
                })),
              ]}
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="w-full sm:w-36 py-1.5 text-xs bg-slate-50/50 border-slate-200"
            />
          </div>

          {/* Priority Filter Dropdown */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 hidden sm:inline">
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
              className="w-full sm:w-32 py-1.5 text-xs bg-slate-50/50 border-slate-200"
            />
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 hidden sm:inline">
              Sort:
            </span>
            <Select
              options={[
                { value: 'priority', label: 'Sort: Priority' },
                { value: 'due_date', label: 'Sort: Due Date' },
                { value: 'updated', label: 'Sort: Recent' },
              ]}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full sm:w-32 py-1.5 text-xs bg-slate-50/50 border-slate-200"
            />
          </div>

          {/* Clear Filters Reset Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0 self-center"
              title="Clear all filters"
            >
              <FilterX className="h-4 w-4" />
            </button>
          )}
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
              <Button variant="primary" onClick={() => handleOpenCreateInStatus('Todo')}>
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

          {/* Kanban Columns Grid (Drag & Drop Dropzones) */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
            {COLUMNS.map((col) => {
              const isVisibleOnMobile = mobileTab === col.id;
              const isDragTarget = dragOverColumnId === col.id;

              return (
                <div
                  key={col.id}
                  onDragOver={(e) => handleDragOver(e, col.id)}
                  onDragLeave={(e) => handleDragLeave(e, col.id)}
                  onDrop={(e) => handleDrop(e, col.id)}
                  className={cn(
                    'flex flex-col rounded-2xl border p-4 transition-all duration-150 h-[560px] lg:h-[calc(100vh-320px)] lg:min-h-[480px]',
                    col.columnBg,
                    isDragTarget ? col.dropActiveBg : '',
                    isVisibleOnMobile ? 'flex' : 'hidden lg:flex'
                  )}
                >
                  {/* Column Header */}
                  <div className="shrink-0 flex items-center justify-between pb-2.5 mb-3 border-b border-inherit">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                      <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', col.dotColor)} />
                      {col.label}
                    </h3>
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', col.badgeBg)}>
                      {col.tasks.length} {col.tasks.length === 1 ? 'Task' : 'Tasks'}
                    </span>
                  </div>

                  {/* Scrollable Tasks List (Child Scroll) */}
                  <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1.5 scrollbar-thin">
                    {col.tasks.length === 0 ? (
                      <div className="h-full min-h-[140px] flex flex-col items-center justify-center text-center p-4 rounded-xl border border-dashed border-slate-300/80 bg-white/50 text-slate-400">
                        <p className="text-xs font-semibold">
                          {isDragTarget ? 'Drop task here' : 'No tasks in this stage'}
                        </p>
                      </div>
                    ) : (
                      col.tasks.map((task) => (
                        <TaskCard
                          key={task.taskId}
                          task={task}
                          isDraggable={isLeader}
                          onClick={(t) => (isLeader ? setEditingTask(t) : setEditingTask(t))}
                          onEdit={isLeader ? (t) => setEditingTask(t) : null}
                          onDelete={isLeader ? (t) => setDeletingTask(t) : null}
                          onStatusChange={isLeader ? handleStatusChange : null}
                        />
                      ))
                    )}
                  </div>

                  {/* In-Column Quick Add Button */}
                  {isLeader && (
                    <button
                      type="button"
                      onClick={() => handleOpenCreateInStatus(col.id)}
                      className="shrink-0 mt-3 w-full py-2 px-3 rounded-xl border border-dashed border-slate-300 hover:border-primary-400 hover:bg-white text-slate-500 hover:text-primary-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-none hover:shadow-sm"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add task</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={isCreateModalOpen}
        initialStatus={createInitialStatus}
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
