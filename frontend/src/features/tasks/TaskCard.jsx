import React from 'react';
import PropTypes from 'prop-types';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { Pencil, Trash2, Calendar, User, ArrowRightLeft, ChevronDown } from 'lucide-react';

export function TaskCard({ task, onEdit = null, onDelete = null, onStatusChange = null }) {
  const priorityVariants = {
    Critical: 'danger',
    High: 'warning',
    Medium: 'info',
    Low: 'default',
  };

  const statusOptions = ['Todo', 'In Progress', 'Review', 'Completed'];

  return (
    <Card hover className="p-4 bg-white border border-slate-200 shadow-sm space-y-3">
      {/* Header Badges & Actions */}
      <div className="flex items-start justify-between gap-2">
        <Badge variant={priorityVariants[task.priority] || 'default'}>
          {task.priority || 'Medium'} Priority
        </Badge>

        <div className="flex items-center gap-1">
          {onEdit && (
            <button
              onClick={() => onEdit(task)}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              title="Edit Task"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(task)}
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
        <h4 className="text-sm font-bold text-slate-900 leading-snug">{task.title}</h4>
        {task.description && (
          <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
            {task.description}
          </p>
        )}
      </div>

      {/* Assignee & Due Date */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
        <div className="flex items-center gap-1.5" title={`Assigned to ${task.assignedToName}`}>
          <Avatar name={task.assignedToName} size="sm" />
          <span className="font-semibold text-slate-700 truncate max-w-[100px]">
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
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5 min-w-0">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1 shrink-0">
            <ArrowRightLeft className="h-3 w-3" /> Move:
          </span>
          <div className="relative flex-1 min-w-0 max-w-[130px]">
            <select
              value={task.status}
              onChange={(e) => onStatusChange(task.taskId, e.target.value)}
              className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 py-1 pl-2.5 pr-6 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors focus:outline-none focus:ring-1 focus:ring-primary-500 cursor-pointer truncate"
            >
              {statusOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          </div>
        </div>
      )}
    </Card>
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
  }).isRequired,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  onStatusChange: PropTypes.func,
};
