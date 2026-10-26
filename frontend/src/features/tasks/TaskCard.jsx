import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { Select } from '../../components/ui/Select';
import {
  Pencil,
  Trash2,
  Calendar,
  ArrowRightLeft,
  GripVertical,
  CheckSquare,
  Sparkles,
} from 'lucide-react';

export function TaskCard({
  task,
  onClick = null,
  onEdit = null,
  onDelete = null,
  onStatusChange = null,
  isDraggable = true,
  onDragStart = null,
  onDragEnd = null,
}) {
  const [isDragging, setIsDragging] = useState(false);

  const priorityVariants = {
    Critical: 'danger',
    High: 'warning',
    Medium: 'info',
    Low: 'default',
  };

  const statusOptions = ['Todo', 'In Progress', 'Review', 'Completed'];

  const tagColors = {
    Frontend: 'bg-sky-50 text-sky-700 border-sky-200',
    Backend: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'AI/ML': 'bg-purple-50 text-purple-700 border-purple-200',
    'UI/UX': 'bg-pink-50 text-pink-700 border-pink-200',
    Database: 'bg-amber-50 text-amber-700 border-amber-200',
    DevOps: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    Docs: 'bg-slate-50 text-slate-700 border-slate-200',
    Bug: 'bg-rose-50 text-rose-700 border-rose-200',
  };

  const handleDragStart = (e) => {
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.taskId);
    e.dataTransfer.setData('application/json', JSON.stringify({
      taskId: task.taskId,
      fromStatus: task.status,
    }));
    if (onDragStart) onDragStart(task);
  };

  const handleDragEnd = (e) => {
    setIsDragging(false);
    if (onDragEnd) onDragEnd(task);
  };

  const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
  const completedSubtasks = subtasks.filter((s) => s.completed).length;
  const subtasksTotal = subtasks.length;
  const subtaskProgress = subtasksTotal > 0 ? Math.round((completedSubtasks / subtasksTotal) * 100) : 0;

  return (
    <div
      draggable={Boolean(isDraggable && onStatusChange)}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => onClick && onClick(task)}
      className={`group transition-all duration-150 ${
        Boolean(isDraggable && onStatusChange) ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
      } ${isDragging ? 'opacity-40 scale-95 rotate-1 shadow-lg' : 'opacity-100'}`}
    >
      <Card
        hover
        className="p-4 bg-white border border-slate-200/90 hover:border-primary-300 hover:shadow-md transition-all rounded-xl space-y-3 relative select-none"
      >
        {/* Header Badges & Actions */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {Boolean(isDraggable && onStatusChange) && (
              <GripVertical className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-400 transition-colors shrink-0" />
            )}
            <Badge variant={priorityVariants[task.priority] || 'default'}>
              {task.priority || 'Medium'}
            </Badge>
            {Boolean(task.blueprintTaskId || task.fromBlueprint) && (
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200/80 flex items-center gap-1"
                title="Planned from AI Architecture Blueprint"
              >
                <Sparkles className="h-2.5 w-2.5 text-purple-600" />
                <span>Blueprint</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
            {onEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(task);
                }}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                title="Edit Task"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(task);
                }}
                className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                title="Delete Task"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Title & Description */}
        <div>
          <h4 className="text-sm font-bold text-slate-900 leading-snug group-hover:text-primary-900 transition-colors">
            {task.title}
          </h4>
          {task.description && (
            <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
              {task.description}
            </p>
          )}
        </div>

        {/* Tags Row */}
        {Array.isArray(task.tags) && task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {task.tags.map((tag) => (
              <span
                key={tag}
                className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${
                  tagColors[tag] || 'bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Subtasks Progress Indicator Pill */}
        {subtasksTotal > 0 && (
          <div className="space-y-1 pt-0.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
              <span className="flex items-center gap-1">
                <CheckSquare className="h-3 w-3 text-primary-600" />
                <span>
                  {completedSubtasks}/{subtasksTotal} Subtasks
                </span>
              </span>
              <span className="text-[10px] font-bold text-slate-400">{subtaskProgress}%</span>
            </div>
            <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-200"
                style={{ width: `${subtaskProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Assignee & Due Date */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
          <div className="flex items-center gap-1.5" title={`Assigned to ${task.assignedToName || 'Unassigned'}`}>
            <Avatar name={task.assignedToName} size="sm" />
            <span className="font-semibold text-slate-700 truncate max-w-[110px]">
              {task.assignedToName || 'Unassigned'}
            </span>
          </div>

          {task.dueDate && (
            <span className="flex items-center gap-1 font-medium text-slate-400 text-[11px]">
              <Calendar className="h-3 w-3" /> {task.dueDate}
            </span>
          )}
        </div>

        {/* Quick Move Status Selector */}
        {onStatusChange && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5 min-w-0"
          >
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1 shrink-0">
              <ArrowRightLeft className="h-3 w-3" /> Move:
            </span>
            <div className="flex-1 min-w-0 max-w-[130px]">
              <Select
                value={task.status || 'Todo'}
                onChange={(e) => onStatusChange(task.taskId, e.target.value)}
                options={statusOptions.map((opt) => ({ value: opt, label: opt }))}
                className="w-full py-1 text-xs bg-slate-50 border-slate-200"
                align="right"
              />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

TaskCard.propTypes = {
  task: PropTypes.shape({
    taskId: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    description: PropTypes.string,
    priority: PropTypes.string,
    status: PropTypes.string,
    assignedToName: PropTypes.string,
    dueDate: PropTypes.string,
    subtasks: PropTypes.array,
    tags: PropTypes.array,
  }).isRequired,
  onClick: PropTypes.func,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  onStatusChange: PropTypes.func,
  isDraggable: PropTypes.bool,
  onDragStart: PropTypes.func,
  onDragEnd: PropTypes.func,
};
