import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Button } from '../../components/ui/Button';
import { Sparkles, Calendar, Target, CheckSquare, Square, Search, CheckCircle2 } from 'lucide-react';
import { cn } from '../../utils/cn';

const PRIORITY_BADGES = {
  Critical: 'bg-rose-50 text-rose-700 border-rose-200',
  High: 'bg-orange-50 text-orange-700 border-orange-200',
  Medium: 'bg-amber-50 text-amber-700 border-amber-200',
  Low: 'bg-slate-100 text-slate-700 border-slate-200',
};

const STATUS_BADGES = {
  Todo: 'bg-slate-100 text-slate-700 border-slate-200',
  'In Progress': 'bg-primary-50 text-primary-700 border-primary-200',
  Review: 'bg-amber-50 text-amber-700 border-amber-200',
  Completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export function StartSprintModal({
  isOpen,
  onClose,
  onStart,
  onSubmit,
  tasks = [],
  defaultSprintNumber = 1,
}) {
  const [sprintNumber, setSprintNumber] = useState(defaultSprintNumber);
  const [name, setName] = useState(`Sprint ${defaultSprintNumber}`);
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState('');
  const [targetEndDate, setTargetEndDate] = useState('');
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const availableTasks = useMemo(() => {
    return (tasks || []).filter((t) => t && !t.isDeleted);
  }, [tasks]);

  // Only uncompleted tasks are eligible to be planned into a new sprint cycle
  const eligibleTasks = useMemo(() => {
    return availableTasks.filter((t) => t.status !== 'Completed');
  }, [availableTasks]);

  const completedTasksCount = availableTasks.length - eligibleTasks.length;

  useEffect(() => {
    if (isOpen) {
      const today = new Date();
      const inTwoWeeks = new Date(today.getTime() + 14 * 86400000);
      const startStr = today.toISOString().split('T')[0];
      const endStr = inTwoWeeks.toISOString().split('T')[0];

      setSprintNumber(defaultSprintNumber);
      setName(`Sprint ${defaultSprintNumber}`);
      setGoal('');
      setStartDate(startStr);
      setTargetEndDate(endStr);
      // By default select all uncompleted eligible tasks
      const defaultIds = eligibleTasks.map((t) => t.taskId || t.id);
      setSelectedTaskIds(defaultIds);
      setTaskSearchQuery('');
      setError('');
    }
  }, [isOpen, defaultSprintNumber, eligibleTasks]);

  const filteredTasks = useMemo(() => {
    if (!taskSearchQuery.trim()) return eligibleTasks;
    const q = taskSearchQuery.toLowerCase();
    return eligibleTasks.filter(
      (t) =>
        t.title?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.assignedToName?.toLowerCase().includes(q)
    );
  }, [eligibleTasks, taskSearchQuery]);

  const isAllSelected =
    eligibleTasks.length > 0 && selectedTaskIds.length === eligibleTasks.length;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(eligibleTasks.map((t) => t.taskId || t.id));
    }
  };

  const handleToggleTask = (taskId) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Sprint name is required.');
      return;
    }
    if (!startDate || !targetEndDate) {
      setError('Start date and target end date are required.');
      return;
    }
    if (new Date(targetEndDate) <= new Date(startDate)) {
      setError('Target end date must be after the start date.');
      return;
    }
    if (selectedTaskIds.length === 0) {
      setError('Please select at least 1 task to include in this sprint.');
      return;
    }

    setIsSubmitting(true);
    try {
      const startHandler = onStart || onSubmit;
      if (typeof startHandler !== 'function') {
        throw new Error('No start handler provided.');
      }
      await startHandler({
        sprintNumber: Number(sprintNumber) || defaultSprintNumber,
        name: name.trim(),
        goal: goal.trim(),
        startDate,
        targetEndDate,
        selectedTaskIds,
      });
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to start sprint.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Start New Sprint" size="lg">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700">Sprint Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sprint 1"
            required
            className="text-xs py-2 bg-slate-50/50 border-slate-200 focus:bg-white"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-primary-600" />
            <span>Sprint Goal / Milestone</span>
          </label>
          <Textarea
            rows={2}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="What is the primary target or milestone for this sprint?"
            className="text-xs p-3 bg-slate-50/50 border-slate-200 focus:bg-white rounded-xl resize-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Start Date</span>
            </label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className="text-xs py-2 bg-slate-50/50 border-slate-200 focus:bg-white"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary-600" />
              <span>Target End Date</span>
            </label>
            <Input
              type="date"
              value={targetEndDate}
              onChange={(e) => setTargetEndDate(e.target.value)}
              required
              className="text-xs py-2 bg-slate-50/50 border-slate-200 focus:bg-white"
            />
          </div>
        </div>

        {/* Task Selection Section */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800">Sprint Task Scope</span>
              <span className="text-[11px] font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full border border-primary-100">
                {selectedTaskIds.length} of {eligibleTasks.length} eligible selected
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="text-xs font-bold text-primary-600 hover:text-primary-800 flex items-center gap-1 transition-colors"
              >
                {isAllSelected ? (
                  <CheckSquare className="w-3.5 h-3.5" />
                ) : (
                  <Square className="w-3.5 h-3.5" />
                )}
                <span>{isAllSelected ? 'Deselect All' : 'Select All Eligible'}</span>
              </button>
            </div>
          </div>

          {completedTasksCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-[11px] text-slate-500 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>
                {completedTasksCount} already-completed task{completedTasksCount > 1 ? 's' : ''} excluded from sprint planning.
              </span>
            </div>
          )}

          {eligibleTasks.length > 5 && (
            <div className="relative">
              <Input
                value={taskSearchQuery}
                onChange={(e) => setTaskSearchQuery(e.target.value)}
                placeholder="Filter eligible tasks to include..."
                className="pl-8 text-xs py-1.5 bg-slate-50/60 border-slate-200"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
          )}

          {/* Scrollable Tasks Checklist */}
          <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-xl border border-slate-200/80 bg-slate-50/40 p-2 scrollbar-thin">
            {eligibleTasks.length === 0 ? (
              <p className="text-center py-4 text-xs text-slate-400">
                All workspace tasks are already completed! Create new tasks before starting a sprint.
              </p>
            ) : filteredTasks.length === 0 ? (
              <p className="text-center py-4 text-xs text-slate-400">
                No tasks matching &quot;{taskSearchQuery}&quot;
              </p>
            ) : (
              filteredTasks.map((task) => {
                const taskId = task.taskId || task.id;
                const isSelected = selectedTaskIds.includes(taskId);
                const priorityClass =
                  PRIORITY_BADGES[task.priority] || PRIORITY_BADGES.Medium;
                const statusClass = STATUS_BADGES[task.status] || STATUS_BADGES.Todo;

                return (
                  <label
                    key={taskId}
                    className={cn(
                      'flex items-center gap-3 p-2.5 rounded-lg border transition-all cursor-pointer',
                      isSelected
                        ? 'bg-white border-primary-300 shadow-2xs'
                        : 'bg-white/60 hover:bg-white border-slate-200/70 text-slate-600'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleTask(taskId)}
                      className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                    />

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">
                        {task.title}
                      </p>
                      {task.assignedToName && task.assignedToName !== 'Unassigned' && (
                        <p className="text-[10px] text-slate-400 truncate">
                          Assigned to {task.assignedToName}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={cn(
                          'text-[10px] font-bold px-1.5 py-0.5 rounded border',
                          priorityClass
                        )}
                      >
                        {task.priority || 'Medium'}
                      </span>
                      <span
                        className={cn(
                          'text-[10px] font-bold px-1.5 py-0.5 rounded border',
                          statusClass
                        )}
                      >
                        {task.status || 'Todo'}
                      </span>
                    </div>
                  </label>
                );
              })
            )}
          </div>

          <p className="text-[11px] text-slate-500 leading-normal">
            Only selected tasks will appear on the Active Sprint board. Unselected tasks will remain preserved in the Backlog.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-xs font-semibold"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            disabled={selectedTaskIds.length === 0}
            icon={<Sparkles className="w-3.5 h-3.5" />}
            className="text-xs font-bold shadow-sm"
          >
            Start Sprint ({selectedTaskIds.length} Tasks)
          </Button>
        </div>
      </form>
    </Modal>
  );
}

StartSprintModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onStart: PropTypes.func,
  onSubmit: PropTypes.func,
  tasks: PropTypes.array,
  defaultSprintNumber: PropTypes.number,
};

export default StartSprintModal;
