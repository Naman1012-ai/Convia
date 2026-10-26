import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useParams } from 'react-router-dom';
import { orgService } from '../../services/orgService';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Plus, X, CheckSquare, Tag } from 'lucide-react';

export function CreateTaskModal({ isOpen, onClose, onSubmit, initialStatus = 'Todo' }) {
  const { orgId } = useParams();
  const [members, setMembers] = useState([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [status, setStatus] = useState(initialStatus || 'Todo');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');

  // Subtasks & Tags
  const [selectedTags, setSelectedTags] = useState([]);
  const [subtasks, setSubtasks] = useState([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const AVAILABLE_TAGS = [
    'Frontend',
    'Backend',
    'AI/ML',
    'UI/UX',
    'Database',
    'DevOps',
    'Docs',
    'Bug',
  ];

  useEffect(() => {
    if (isOpen) {
      setStatus(initialStatus || 'Todo');
    }
  }, [isOpen, initialStatus]);

  useEffect(() => {
    if (!orgId) return;
    orgService.getOrganizationMembers(orgId).then((memList) => {
      setMembers(memList || []);
    });
  }, [orgId]);

  const handleToggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    const item = {
      id: `st_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: newSubtaskTitle.trim(),
      completed: false,
    };
    setSubtasks((prev) => [...prev, item]);
    setNewSubtaskTitle('');
  };

  const handleRemoveSubtask = (id) => {
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Task title is required.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    const selectedMember = members.find((m) => m.uid === assignedTo);
    const assignedToName = selectedMember
      ? selectedMember.displayName || selectedMember.email
      : 'Unassigned';

    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        priority,
        status,
        assignedTo,
        assignedToName,
        dueDate,
        tags: selectedTags,
        subtasks,
      });

      setTitle('');
      setDescription('');
      setPriority('Medium');
      setStatus('Todo');
      setAssignedTo('');
      setDueDate('');
      setSelectedTags([]);
      setSubtasks([]);
      setNewSubtaskTitle('');
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const memberOptions = [
    { value: '', label: 'Unassigned' },
    ...members.map((m) => ({
      value: m.uid,
      label: `${m.displayName || m.email} (${m.role})`,
    })),
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Actionable Sprint Task" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700">
            {error}
          </div>
        )}

        <Input
          label="Task Title"
          placeholder="e.g., Setup Mapbox GL JS Map Container"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <Textarea
          label="Description & Specifications"
          placeholder="Detailed task breakdown, API specifications, or acceptance criteria..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />

        {/* Category Tags Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5 text-slate-400" />
            <span>Category Tags</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {AVAILABLE_TAGS.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleToggleTag(tag)}
                  className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
                    isSelected
                      ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        {/* Subtasks / Checklist Builder */}
        <div className="space-y-2 pt-1 border-t border-slate-100">
          <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <CheckSquare className="h-3.5 w-3.5 text-slate-400" />
            <span>Subtasks & Acceptance Checklist</span>
          </label>

          {/* Subtasks items list */}
          {subtasks.length > 0 && (
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {subtasks.map((st) => (
                <div
                  key={st.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200/80 text-xs"
                >
                  <span className="font-medium text-slate-700">{st.title}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSubtask(st.id)}
                    className="p-1 rounded text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add Subtask Input Row */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddSubtask();
                }
              }}
              placeholder="Add checklist item (e.g. Write integration test)..."
              className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddSubtask}
              disabled={!newSubtaskTitle.trim()}
            >
              Add
            </Button>
          </div>
        </div>

        {/* Form Meta Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-slate-100">
          <Select
            label="Priority Level"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            options={[
              { value: 'Critical', label: 'Critical' },
              { value: 'High', label: 'High' },
              { value: 'Medium', label: 'Medium' },
              { value: 'Low', label: 'Low' },
            ]}
          />

          <Select
            label="Initial Status Swimlane"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[
              { value: 'Todo', label: 'Todo' },
              { value: 'In Progress', label: 'In Progress' },
              { value: 'Review', label: 'Review' },
              { value: 'Completed', label: 'Completed' },
            ]}
          />

          <Select
            label="Assignee"
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            options={memberOptions}
          />

          <Input
            label="Due Date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" isLoading={isSubmitting} icon={<Plus className="h-4 w-4" />}>
            Create Task
          </Button>
        </div>
      </form>
    </Modal>
  );
}

CreateTaskModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  initialStatus: PropTypes.string,
};
