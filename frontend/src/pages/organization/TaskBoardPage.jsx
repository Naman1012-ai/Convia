import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
  StartSprintModal,
  CompleteSprintModal,
  SprintCountdown,
  SprintHistoryModal,
} from '../../features/sprints';
import { sprintService } from '../../services/sprintService';
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
  Flag,
  Clock,
  Play,
  CheckCircle2,
  Layers,
  History,
} from 'lucide-react';
import { aiBlueprintService } from '../../services/aiBlueprintService';
import { exportSprintAsMarkdown, exportSprintAsCsv } from '../../utils/sprintExportUtil';
import { cn } from '../../utils/cn';

function TaskBoardContent() {
  const { user } = useAuth();
  const { org, members, isLeader } = useOrg();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
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

  const [activeSprint, setActiveSprint] = useState(null);
  const [boardView, setBoardView] = useState('active_sprint');
  const [isStartSprintOpen, setIsStartSprintOpen] = useState(false);
  const [isCompleteSprintOpen, setIsCompleteSprintOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createInitialStatus, setCreateInitialStatus] = useState('Todo');
  const [createTargetSprint, setCreateTargetSprint] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [deletingTask, setDeletingTask] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState('Todo');
  const [dragOverColumnId, setDragOverColumnId] = useState(null);
  const hasInitializedTabRef = useRef(false);

  // 1. Two-Way URL Search Params Filter Synchronization
  useEffect(() => {
    const qParam = searchParams.get('q') || '';
    const assigneeParam = searchParams.get('assignee') || 'all';
    const priorityParam = searchParams.get('priority') || 'all';
    const sortParam = searchParams.get('sort') || 'priority';

    if (qParam !== searchQuery) setSearchQuery(qParam);
    if (assigneeParam !== assigneeFilter) setAssigneeFilter(assigneeParam);
    if (priorityParam !== priorityFilter) setPriorityFilter(priorityParam);
    if (sortParam !== sortBy) setSortBy(sortParam);
  }, [searchParams]);

  const updateUrlFilters = (updates) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(updates).forEach(([key, val]) => {
        if (!val || val === 'all' || (key === 'sort' && val === 'priority')) {
          next.delete(key);
        } else {
          next.set(key, val);
        }
      });
      return next;
    }, { replace: true });
  };

  // 2. Real-Time Active Sprint Subscription
  useEffect(() => {
    if (!org?.orgId) return;
    const unsub = sprintService.subscribeToActiveSprint(org.orgId, (sprint) => {
      setActiveSprint(sprint);
    });
    return () => unsub();
  }, [org?.orgId]);

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
      <div className="w-full space-y-6">
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

  // Task Segmentation & View Modes
  const isSprintActive = activeSprint?.status === 'active';
  const allWorkspaceTasks = useMemo(() => tasks || [], [tasks]);

  // Synchronize board view when sprint state changes
  useEffect(() => {
    if (isSprintActive) {
      setBoardView('active_sprint');
    } else {
      setBoardView('all');
    }
  }, [isSprintActive, activeSprint?.sprintId]);

  const activeSprintTaskIds = useMemo(() => {
    if (!isSprintActive) return [];
    if (Array.isArray(activeSprint.taskIds) && activeSprint.taskIds.length > 0) {
      return activeSprint.taskIds;
    }
    return allWorkspaceTasks.filter((t) => t.sprintId === activeSprint.sprintId).map((t) => t.taskId);
  }, [isSprintActive, activeSprint, allWorkspaceTasks]);

  const activeSprintTasks = useMemo(() => {
    if (!isSprintActive) return [];
    return allWorkspaceTasks.filter(
      (t) => activeSprintTaskIds.includes(t.taskId) || t.sprintId === activeSprint?.sprintId
    );
  }, [isSprintActive, allWorkspaceTasks, activeSprintTaskIds, activeSprint?.sprintId]);

  const isTaskInActiveSprint = useCallback(
    (task) => {
      if (!isSprintActive || !task) return false;
      const taskId = task.taskId || task.id;
      return (
        task.sprintId === activeSprint?.sprintId ||
        activeSprintTaskIds.includes(taskId)
      );
    },
    [isSprintActive, activeSprint?.sprintId, activeSprintTaskIds]
  );

  const backlogTasks = useMemo(() => {
    if (!isSprintActive) return allWorkspaceTasks;
    return allWorkspaceTasks.filter(
      (t) => !activeSprintTaskIds.includes(t.taskId) && t.sprintId !== activeSprint?.sprintId
    );
  }, [isSprintActive, allWorkspaceTasks, activeSprintTaskIds, activeSprint?.sprintId]);

  // Progress calculations strictly targeting the active sprint scope (or all tasks in planning mode)
  const sprintTargetTasks = isSprintActive && activeSprintTasks.length > 0 ? activeSprintTasks : allWorkspaceTasks;
  const totalSprintTasks = sprintTargetTasks.length;
  const completedSprintTasks = sprintTargetTasks.filter((t) => t && t.status === 'Completed').length;
  const progressPercentage =
    totalSprintTasks > 0 ? Math.round((completedSprintTasks / totalSprintTasks) * 100) : 0;

  const sprintMetrics = useMemo(() => {
    return sprintService.calculateSprintMetrics(sprintTargetTasks);
  }, [sprintTargetTasks]);

  const sprintRemainingDays = activeSprint?.targetEndDate
    ? Math.max(0, Math.ceil((new Date(activeSprint.targetEndDate) - new Date()) / (1000 * 60 * 60 * 24)))
    : null;

  // Filtered tasks based on active boardView mode:
  const displayedFilteredTasks = useMemo(() => {
    const list = filteredTasks || [];
    if (boardView === 'active_sprint' && isSprintActive) {
      return list.filter(
        (t) => activeSprintTaskIds.includes(t.taskId) || t.sprintId === activeSprint?.sprintId
      );
    }
    if (boardView === 'backlog' && isSprintActive) {
      return list.filter(
        (t) => !activeSprintTaskIds.includes(t.taskId) && t.sprintId !== activeSprint?.sprintId
      );
    }
    return list;
  }, [filteredTasks, boardView, isSprintActive, activeSprintTaskIds, activeSprint?.sprintId]);

  const handleStartSprintSubmit = async (sprintData) => {
    if (!org?.orgId || !user) return;
    try {
      const newSprint = await sprintService.startSprint(org.orgId, sprintData, user);
      setActiveSprint(newSprint);
      setBoardView('active_sprint');
      setIsStartSprintOpen(false);
      toast.success(
        `Sprint "${sprintData.name}" is now active with ${sprintData.selectedTaskIds?.length || 0} tasks!`
      );
    } catch (err) {
      console.error('[TaskBoardPage] startSprint error:', err);
      toast.error(err.message || 'Failed to start sprint.');
    }
  };

  const handleCompleteSprintSubmit = async (completePayload) => {
    if (!org?.orgId || !user) return;
    try {
      const sprintId = completePayload.sprintId || activeSprint?.sprintId;
      const res = await sprintService.completeSprint(
        org.orgId,
        sprintId,
        completePayload,
        user
      );
      setActiveSprint(null);
      setBoardView('all');
      setIsCompleteSprintOpen(false);
      const completedCount = res?.metrics?.completedTasks ?? res?.metrics?.completed ?? 0;
      toast.success(`Sprint completed! ${completedCount} tasks delivered.`);
    } catch (err) {
      console.error('[TaskBoardPage] completeSprint error:', err);
      toast.error(err.message || 'Failed to complete sprint.');
    }
  };

  const handleCreateTask = async (taskData) => {
    try {
      const created = await createTask(taskData);
      if (taskData.sprintId && activeSprint?.sprintId === taskData.sprintId) {
        const taskId = created?.taskId || created?.id;
        if (taskId) {
          const updatedSprint = await sprintService.addTaskToActiveSprint(org.orgId, activeSprint.sprintId, taskId);
          if (updatedSprint) {
            setActiveSprint(updatedSprint);
          }
          toast.success(`Task created and added to ${activeSprint.name || 'Active Sprint'}!`);
          return;
        }
      }
      toast.success('Task created in Backlog.');
    } catch (err) {
      console.error('[TaskBoardPage] handleCreateTask error:', err);
      toast.error(err.message || 'Failed to create task.');
    }
  };

  const handleUpdateTask = async (taskId, updates) => {
    await updateTask(taskId, updates);
  };

  const handleStatusChange = async (taskId, newStatus) => {
    if (!isLeader) return;
    await updateTaskStatus(taskId, newStatus);
  };

  const handleConfirmDelete = async () => {
    if (!isLeader || !deletingTask) return;
    setIsDeleting(true);
    try {
      const taskId = deletingTask.taskId || deletingTask.id;
      if (isSprintActive && (deletingTask.sprintId === activeSprint?.sprintId || activeSprintTaskIds.includes(taskId))) {
        const updatedSprint = await sprintService.removeTaskFromActiveSprint(org.orgId, activeSprint.sprintId, taskId);
        if (updatedSprint) {
          setActiveSprint(updatedSprint);
        }
      }
      await deleteTask(taskId);
      toast.success('Task deleted successfully.');
      setDeletingTask(null);
    } catch (err) {
      console.error('[TaskBoardPage] deleteTask error:', err);
      toast.error(err.message || 'Failed to delete task.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMoveTaskToBacklog = async (taskId) => {
    if (!isLeader || !taskId) return;
    try {
      if (isSprintActive && activeSprint?.sprintId) {
        const updatedSprint = await sprintService.removeTaskFromActiveSprint(org.orgId, activeSprint.sprintId, taskId);
        if (updatedSprint) {
          setActiveSprint(updatedSprint);
        }
      }
      await updateTask(taskId, { sprintId: null, sprintName: null });
      toast.success('Task moved out of sprint to Backlog.');
    } catch (err) {
      console.error('[TaskBoardPage] handleMoveTaskToBacklog error:', err);
      toast.error(err.message || 'Failed to move task to backlog.');
    }
  };

  const handleMoveTaskToSprint = async (taskId) => {
    if (!isLeader || !taskId || !isSprintActive || !activeSprint?.sprintId) return;
    try {
      const updatedSprint = await sprintService.addTaskToActiveSprint(org.orgId, activeSprint.sprintId, taskId);
      if (updatedSprint) {
        setActiveSprint(updatedSprint);
      }
      await updateTask(taskId, {
        sprintId: activeSprint.sprintId,
        sprintName: activeSprint.name || 'Active Sprint',
      });
      toast.success(`Task moved to "${activeSprint.name || 'Active Sprint'}"!`);
    } catch (err) {
      console.error('[TaskBoardPage] handleMoveTaskToSprint error:', err);
      toast.error(err.message || 'Failed to move task to active sprint.');
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
    if (!isLeader) return;
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    const task = allWorkspaceTasks.find((t) => t.taskId === taskId);
    if (!task || task.status === targetStatus) return;

    await handleStatusChange(taskId, targetStatus);
  };

  // 1. Universal Create: Always creates outside the active sprint (Backlog mode)
  const handleOpenUniversalCreate = () => {
    if (!isLeader) return;
    setCreateTargetSprint(null);
    setCreateInitialStatus('Todo');
    setIsCreateModalOpen(true);
  };

  // 2. In-Column Quick Create: When sprint is active, creates directly inside ongoing sprint
  const handleOpenColumnCreate = (statusId) => {
    if (!isLeader) return;
    if (isSprintActive && (boardView === 'active_sprint' || boardView === 'all')) {
      setCreateTargetSprint(activeSprint);
    } else {
      setCreateTargetSprint(null);
    }
    setCreateInitialStatus(statusId);
    setIsCreateModalOpen(true);
  };

  const handleExportMarkdown = () => {
    exportSprintAsMarkdown({
      workspaceName: org?.name || 'Workspace',
      tasks: sprintTargetTasks,
      progressPercentage,
    });
    toast.success('Sprint Markdown report downloaded.');
  };

  const handleExportCsv = () => {
    exportSprintAsCsv({
      workspaceName: org?.name || 'Workspace',
      tasks: sprintTargetTasks,
    });
    toast.success('Sprint CSV report downloaded.');
  };

  // Group Tasks by Kanban Status Swimlane
  const todoTasks = displayedFilteredTasks.filter((t) => t && t.status === 'Todo');
  const inProgressTasks = displayedFilteredTasks.filter((t) => t && t.status === 'In Progress');
  const reviewTasks = displayedFilteredTasks.filter((t) => t && t.status === 'Review');
  const completedList = displayedFilteredTasks.filter((t) => t && t.status === 'Completed');

  // Auto-switch mobile tab to the first non-empty column on initial load
  useEffect(() => {
    if (!hasInitializedTabRef.current && displayedFilteredTasks.length > 0) {
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
  }, [displayedFilteredTasks.length, todoTasks.length, inProgressTasks.length, reviewTasks.length, completedList.length]);

  const COLUMNS = [
    {
      id: 'Todo',
      label: 'Todo',
      tasks: todoTasks,
      dotColor: 'bg-slate-400',
      badgeBg: 'bg-slate-100 text-slate-700 border border-slate-200',
      columnBg: 'bg-slate-50/70 border-slate-200/90',
      dropActiveBg: 'ring-2 ring-primary-400 bg-primary-50/80 border-primary-400 shadow-sm',
      activeTabBg: 'bg-slate-800 text-white',
    },
    {
      id: 'In Progress',
      label: 'In Progress',
      tasks: inProgressTasks,
      dotColor: 'bg-primary-500 animate-pulse',
      badgeBg: 'bg-primary-50 text-primary-700 border border-primary-200',
      columnBg: 'bg-primary-50/30 border-primary-200/60',
      dropActiveBg: 'ring-2 ring-primary-400 bg-primary-50/80 border-primary-400 shadow-sm',
      activeTabBg: 'bg-primary-600 text-white',
    },
    {
      id: 'Review',
      label: 'Review',
      tasks: reviewTasks,
      dotColor: 'bg-amber-500',
      badgeBg: 'bg-amber-50 text-amber-800 border border-amber-200',
      columnBg: 'bg-amber-50/30 border-amber-200/60',
      dropActiveBg: 'ring-2 ring-primary-400 bg-primary-50/80 border-primary-400 shadow-sm',
      activeTabBg: 'bg-amber-600 text-white',
    },
    {
      id: 'Completed',
      label: 'Completed',
      tasks: completedList,
      dotColor: 'bg-emerald-500',
      badgeBg: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
      columnBg: 'bg-emerald-50/30 border-emerald-200/60',
      dropActiveBg: 'ring-2 ring-primary-400 bg-primary-50/80 border-primary-400 shadow-sm',
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
    setSortBy('priority');
    updateUrlFilters({ q: '', priority: 'all', assignee: 'all', sort: 'priority' });
  };

  const isAssignedToMe = user?.uid && assigneeFilter === user.uid;

  return (
    <div className="w-full space-y-6 overflow-x-hidden">
      {/* Real-time Sprint Progress & Lifecycle Command Header */}
      <Card className="p-4 sm:p-6 bg-white border border-slate-200 shadow-sm space-y-4">
        {/* Top Row: Sprint Status / Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider border',
                activeSprint?.status === 'active'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              )}
            >
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  activeSprint?.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                )}
              />
              {activeSprint?.status === 'active' ? (activeSprint.name || 'Active Sprint') : 'Sprint Planning'}
            </span>

            {activeSprint?.status === 'active' && activeSprint?.targetEndDate && (
              <SprintCountdown targetEndDate={activeSprint.targetEndDate} />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">
            {isLeader && (
              <>
                {activeSprint?.status === 'active' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                    onClick={() => setIsCompleteSprintOpen(true)}
                    className="border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/60 text-emerald-700 text-xs font-bold"
                  >
                    Complete Sprint
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Play className="h-3.5 w-3.5 text-primary-600 fill-primary-600" />}
                    onClick={() => setIsStartSprintOpen(true)}
                    className="border-primary-200 bg-primary-50/40 hover:bg-primary-100/60 text-primary-700 text-xs font-bold"
                  >
                    Start Sprint
                  </Button>
                )}
              </>
            )}

            {/* Sprint History Button (Available to all members) */}
            <Button
              variant="outline"
              size="sm"
              icon={<History className="h-4 w-4 text-primary-600" />}
              onClick={() => setIsHistoryOpen(true)}
              className="shrink-0 text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-primary-700 text-xs font-bold"
            >
              <span>Sprint History</span>
            </Button>

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
                  <span className="sm:hidden">Sync</span>
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={handleOpenUniversalCreate}
                  className="shrink-0 font-bold text-xs shadow-sm"
                >
                  <span>New Task</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Sprint Goal Banner if present */}
        {activeSprint?.goal && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-primary-50/40 border border-primary-100 text-slate-700 text-xs">
            <Flag className="h-4 w-4 text-primary-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold text-primary-900 mr-1.5">Sprint Goal:</span>
              <span className="text-slate-600 leading-relaxed">{activeSprint.goal}</span>
            </div>
          </div>
        )}

        {/* Completion Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-600">
            <span className="flex items-center gap-1.5 text-slate-900 font-extrabold">
              <Sparkles className="h-3.5 w-3.5 text-primary-600" /> Overall Sprint Build Completion
            </span>
            <span>
              {completedSprintTasks} of {totalSprintTasks} Tasks Done ({progressPercentage}%)
            </span>
          </div>
          <ProgressBar percentage={progressPercentage} size="md" />
        </div>
      </Card>

      {/* Board View Mode Segmentation (Active Sprint vs Backlog vs All) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setBoardView('active_sprint')}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 border',
              boardView === 'active_sprint'
                ? 'bg-primary-600 text-white border-primary-600 shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
            )}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Active Sprint</span>
            <span
              className={cn(
                'text-[10px] font-extrabold px-1.5 py-0.2 rounded-full',
                boardView === 'active_sprint' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              )}
            >
              {activeSprintTasks.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setBoardView('backlog')}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 border',
              boardView === 'backlog'
                ? 'bg-primary-600 text-white border-primary-600 shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
            )}
          >
            <ListTodo className="w-3.5 h-3.5" />
            <span>Backlog</span>
            <span
              className={cn(
                'text-[10px] font-extrabold px-1.5 py-0.2 rounded-full',
                boardView === 'backlog' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              )}
            >
              {backlogTasks.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setBoardView('all')}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 border',
              boardView === 'all'
                ? 'bg-primary-600 text-white border-primary-600 shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
            )}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All Tasks</span>
            <span
              className={cn(
                'text-[10px] font-extrabold px-1.5 py-0.2 rounded-full',
                boardView === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              )}
            >
              {allWorkspaceTasks.length}
            </span>
          </button>
        </div>

        {/* View Explanatory Note */}
        <div className="text-[11px] font-medium text-slate-500 px-2 hidden sm:block">
          {boardView === 'active_sprint' && isSprintActive && (
            <span>Showing {activeSprintTasks.length} active sprint tasks committed to {activeSprint?.name || 'this cycle'}.</span>
          )}
          {boardView === 'backlog' && (
            <span>Showing {backlogTasks.length} backlog tasks preserved for future sprints.</span>
          )}
          {boardView === 'all' && (
            <span>Showing all {allWorkspaceTasks.length} workspace tasks across sprint and backlog.</span>
          )}
          {!isSprintActive && boardView === 'active_sprint' && (
            <span>No active sprint. Showing full backlog in planning mode.</span>
          )}
        </div>
      </div>

      {/* Filter & Sort Controls Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
        {/* Left: Search Bar & My Tasks Quick Toggle */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto flex-1">
          <div className="relative w-full sm:w-72">
            <Input
              placeholder="Search tasks, descriptions..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); updateUrlFilters({ q: e.target.value }); }}
              className="pl-9 text-xs py-2 bg-slate-50/50 border-slate-200 focus:bg-white"
            />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          </div>

          {/* "My Tasks" Quick Filter Toggle Pill */}
          {user?.uid && (
            <button
              type="button"
              onClick={() => { const next = isAssignedToMe ? 'all' : user.uid; setAssigneeFilter(next); updateUrlFilters({ assignee: next }); }}
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
              onChange={(e) => { setAssigneeFilter(e.target.value); updateUrlFilters({ assignee: e.target.value }); }}
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
              onChange={(e) => { setPriorityFilter(e.target.value); updateUrlFilters({ priority: e.target.value }); }}
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
              onChange={(e) => { setSortBy(e.target.value); updateUrlFilters({ sort: e.target.value }); }}
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
              <Button variant="primary" onClick={handleOpenUniversalCreate}>
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
                      col.tasks.map((task) => {
                        const inActiveSprint = isTaskInActiveSprint(task);
                        return (
                          <TaskCard
                            key={task.taskId}
                            task={task}
                            isDraggable={isLeader}
                            isInActiveSprint={inActiveSprint}
                            onClick={(t) => setEditingTask(t)}
                            onEdit={isLeader ? (t) => setEditingTask(t) : null}
                            onDelete={isLeader ? (t) => setDeletingTask(t) : null}
                            onStatusChange={isLeader ? handleStatusChange : null}
                            onMoveToBacklog={isLeader && inActiveSprint ? handleMoveTaskToBacklog : null}
                            onMoveToSprint={isLeader && isSprintActive && !inActiveSprint ? handleMoveTaskToSprint : null}
                          />
                        );
                      })
                    )}
                  </div>

                  {/* In-Column Quick Add Button */}
                  {isLeader && (
                    <button
                      type="button"
                      onClick={() => handleOpenColumnCreate(col.id)}
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
        targetSprint={createTargetSprint}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateTask}
      />

      {/* Edit Task Modal */}
      {editingTask && (
        <EditTaskModal
          isOpen={Boolean(editingTask)}
          isLeader={isLeader}
          task={
            allWorkspaceTasks.find(
              (t) => (t.taskId || t.id) === (editingTask.taskId || editingTask.id)
            ) || editingTask
          }
          isInActiveSprint={isTaskInActiveSprint(editingTask)}
          isSprintActive={isSprintActive}
          activeSprintName={activeSprint?.name || 'Active Sprint'}
          onClose={() => setEditingTask(null)}
          onSubmit={handleUpdateTask}
          onMoveToBacklog={
            isLeader && isTaskInActiveSprint(editingTask)
              ? handleMoveTaskToBacklog
              : null
          }
          onMoveToSprint={
            isLeader && isSprintActive && !isTaskInActiveSprint(editingTask)
              ? handleMoveTaskToSprint
              : null
          }
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

      {/* Start Sprint Modal */}
      <StartSprintModal
        isOpen={isStartSprintOpen}
        onClose={() => setIsStartSprintOpen(false)}
        onStart={handleStartSprintSubmit}
        onSubmit={handleStartSprintSubmit}
        tasks={allWorkspaceTasks}
      />

      {/* Complete Sprint Modal */}
      <CompleteSprintModal
        isOpen={isCompleteSprintOpen}
        onClose={() => setIsCompleteSprintOpen(false)}
        onComplete={handleCompleteSprintSubmit}
        onSubmit={handleCompleteSprintSubmit}
        metrics={sprintMetrics}
        sprint={activeSprint}
      />

      {/* Sprint History & Retrospective Archive Modal */}
      <SprintHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        orgId={org?.orgId}
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
