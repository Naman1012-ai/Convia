import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useOrg } from '../../hooks/useOrg';
import { orgService } from '../../services/orgService';
import { taskCommentService } from '../../services/taskCommentService';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Check, X, Tag, Plus, MessageSquare, FileText, Send, Trash2 } from 'lucide-react';

export function EditTaskModal({
  isOpen,
  task,
  onClose,
  onSubmit,
  isLeader: propIsLeader,
  onMoveToBacklog = null,
  onMoveToSprint = null,
  isInActiveSprint = false,
  isSprintActive = false,
  activeSprintName = '',
}) {
  const { orgId: routeOrgId } = useParams();
  const { org, isLeader: orgIsLeader } = useOrg();
  const canEdit = typeof propIsLeader === 'boolean' ? propIsLeader : Boolean(orgIsLeader);
  const orgId = routeOrgId || org?.orgId || task?.orgId;
  const effectiveTaskId = task?.taskId || task?.id || task?.executionTaskId;
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'comments'
  const [members, setMembers] = useState([]);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [status, setStatus] = useState('Todo');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');

  // Subtasks & Tags
  const [selectedTags, setSelectedTags] = useState([]);
  const [subtasks, setSubtasks] = useState([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // Comments state
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);

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
    if (task && isOpen) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setPriority(task.priority || 'Medium');
      setStatus(task.status || 'Todo');
      setAssignedTo(task.assignedTo || '');
      setDueDate(task.dueDate || '');
      setSelectedTags(Array.isArray(task.tags) ? task.tags : []);
      setSubtasks(Array.isArray(task.subtasks) ? task.subtasks : []);
      if (task.comments && typeof task.comments === 'object') {
        const seedComments = Object.values(task.comments).filter((c) => c && !c.isDeleted);
        seedComments.sort((a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0));
        setComments(seedComments);
      }
      setActiveTab('details');
      setError('');
    }
  }, [task, isOpen]);

  useEffect(() => {
    if (!orgId) return;
    orgService.getOrganizationMembers(orgId).then((memList) => {
      setMembers(memList || []);
    });
  }, [orgId]);

  // Real-time subscription to task comments
  useEffect(() => {
    if (!isOpen || !orgId || !effectiveTaskId) {
      setComments([]);
      return;
    }

    const unsub = taskCommentService.subscribeToTaskComments(orgId, effectiveTaskId, (list) => {
      setComments(list || []);
    });

    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [isOpen, orgId, effectiveTaskId]);

  if (!task) return null;

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

  const handleToggleSubtaskCompleted = (id) => {
    setSubtasks((prev) =>
      prev.map((s) => (s.id === id ? { ...s, completed: !s.completed } : s))
    );
  };

  const handleRemoveSubtask = (id) => {
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
  };

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !user || !orgId || !effectiveTaskId) return;

    setIsPostingComment(true);
    try {
      const created = await taskCommentService.addTaskComment(
        orgId,
        effectiveTaskId,
        newComment.trim(),
        user,
        task.title
      );
      if (created) {
        setComments((prev) => {
          if (prev.some((c) => c.commentId === created.commentId)) return prev;
          return [...prev, created];
        });
      }
      setNewComment('');
    } catch (err) {
      console.error('[EditTaskModal] Post comment error:', err);
      setError(err?.message || 'Failed to post note.');
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!orgId || !effectiveTaskId || !commentId) return;
    try {
      await taskCommentService.deleteTaskComment(orgId, effectiveTaskId, commentId);
      setComments((prev) => prev.filter((c) => c.commentId !== commentId));
    } catch (err) {
      console.error('[EditTaskModal] Delete comment error:', err);
    }
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
      await onSubmit(task.taskId, {
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

      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const memberOptions = [
    { value: '', label: 'Unassigned' },
    ...members.map((m) => ({
      value: m.uid,
      label: `${m.displayName || m.name || m.email} (${m.role || 'Member'})`,
    })),
  ];

  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return '';
    const diff = Math.floor((Date.now() - Number(timestamp)) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Sprint Task Details" size="lg">
      <div className="space-y-4">
        {/* Top Tab Navigation */}
        <div className="flex items-center gap-1 p-1 bg-slate-100/80 rounded-xl border border-slate-200/80">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'details'
                ? 'bg-white text-primary-700 shadow-xs font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Specifications</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('comments')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'comments'
                ? 'bg-white text-primary-700 shadow-xs font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Discussion & Notes</span>
            {comments.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary-100 text-primary-700 font-bold">
                {comments.length}
              </span>
            )}
          </button>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700">
            {error}
          </div>
        )}

        {/* TAB 1: DETAILS & SPECIFICATIONS */}
        {activeTab === 'details' && (
          canEdit ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Task Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="text-xs py-2 bg-slate-50/50 border-slate-200 focus:bg-white"
              />

              <Textarea
                label="Description & Acceptance Criteria"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="text-xs p-3 bg-slate-50/50 border-slate-200 focus:bg-white rounded-xl resize-none"
              />

              {/* Category Tags Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-slate-500" />
                  <span>Categories</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {AVAILABLE_TAGS.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleToggleTag(tag)}
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                          isSelected
                            ? 'bg-primary-50 text-primary-700 border-primary-200 shadow-2xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Checklist / Subtasks Section */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Checklist & Subtasks ({subtasks.filter((s) => s.completed).length}/{subtasks.length})</span>
                </label>

                {subtasks.length > 0 && (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {subtasks.map((st) => (
                      <div
                        key={st.id}
                        className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs"
                      >
                        <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={st.completed}
                            onChange={() => handleToggleSubtaskCompleted(st.id)}
                            className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                          />
                          <span className={`font-medium truncate ${st.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                            {st.title}
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleRemoveSubtask(st.id)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 transition-colors shrink-0"
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
                    placeholder="Add checklist item..."
                    className="flex-1 bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-primary-500"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddSubtask}
                    disabled={!newSubtaskTitle.trim()}
                    className="text-xs font-semibold"
                  >
                    Add
                  </Button>
                </div>
              </div>

              {/* Form Meta Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
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
                  label="Status Swimlane"
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
                  className="text-xs py-2 bg-slate-50/50 border-slate-200 focus:bg-white"
                />
              </div>

              <div className="flex justify-between items-center gap-2.5 pt-3 border-t border-slate-100">
                {isInActiveSprint && onMoveToBacklog && (
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => {
                      onMoveToBacklog(task.taskId || task.id);
                      onClose();
                    }}
                    className="text-xs font-semibold text-amber-700 hover:bg-amber-50 border-amber-200"
                  >
                    Move to Backlog
                  </Button>
                )}
                {!isInActiveSprint && isSprintActive && onMoveToSprint && (
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => {
                      onMoveToSprint(task.taskId || task.id);
                      onClose();
                    }}
                    className="text-xs font-semibold text-primary-700 hover:bg-primary-50 border-primary-200"
                  >
                    Add to {activeSprintName || 'Active Sprint'}
                  </Button>
                )}
                <div className="flex items-center gap-2 ml-auto">
                  <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting} className="text-xs font-semibold">
                    Cancel
                  </Button>
                  <Button variant="primary" type="submit" isLoading={isSubmitting} icon={<Check className="h-4 w-4" />} className="text-xs font-bold shadow-sm">
                    Save Changes
                  </Button>
                </div>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {/* Member Read-Only Notice Banner */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                  <span className="font-bold text-slate-700">Read-Only View</span>
                </div>
                <span className="text-[11px] text-slate-500 font-medium">Specifications managed by Team Captain or Owner</span>
              </div>

              {/* Task Title Display */}
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">Task Title</span>
                <h3 className="text-sm font-bold text-slate-900 leading-snug">{title || 'Untitled Task'}</h3>
              </div>

              {/* Description Display */}
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">Description & Acceptance Criteria</span>
                <div className="text-xs text-slate-700 bg-slate-50/70 p-3 rounded-xl border border-slate-200/80 leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {description || <span className="text-slate-400 italic">No description provided for this task.</span>}
                </div>
              </div>

              {/* Categories Display */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                  <Tag className="h-3 w-3 text-slate-400" />
                  <span>Categories</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedTags.length > 0 ? (
                    selectedTags.map((tag) => (
                      <span key={tag} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-primary-50 text-primary-700 border border-primary-200/80 shadow-2xs">
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic">No category tags assigned.</span>
                  )}
                </div>
              </div>

              {/* Checklist & Subtasks Display (Read-Only) */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono block">
                  Checklist & Subtasks ({subtasks.filter((s) => s.completed).length}/{subtasks.length})
                </span>
                {subtasks.length > 0 ? (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {subtasks.map((st) => (
                      <div key={st.id} className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                        <input
                          type="checkbox"
                          checked={st.completed}
                          disabled
                          className="rounded border-slate-300 text-slate-400 cursor-not-allowed h-3.5 w-3.5"
                        />
                        <span className={`font-medium truncate ${st.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                          {st.title}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic bg-slate-50/50 p-2.5 rounded-xl border border-slate-200/60">
                    No checklist items defined.
                  </p>
                )}
              </div>

              {/* Metadata Grid (Priority, Status, Assignee, Due Date) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100">
                <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/70 space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono block">Priority</span>
                  <span className={`text-xs font-bold inline-block px-2 py-0.5 rounded-md ${
                    priority === 'Critical' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                    priority === 'High' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {priority}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/70 space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono block">Status</span>
                  <span className="text-xs font-bold text-slate-800 block truncate">{status}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/70 space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono block">Assignee</span>
                  <span className="text-xs font-bold text-slate-800 block truncate">
                    {members.find((m) => m.uid === assignedTo)?.displayName || task.assignedToName || 'Unassigned'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/70 space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono block">Due Date</span>
                  <span className="text-xs font-bold text-slate-800 block truncate">
                    {dueDate ? dueDate : 'No Deadline'}
                  </span>
                </div>
              </div>

              {/* Close Button Only */}
              <div className="flex justify-end pt-3 border-t border-slate-100">
                <Button variant="outline" type="button" onClick={onClose} className="text-xs font-semibold">
                  Close
                </Button>
              </div>
            </div>
          )
        )}

        {/* TAB 2: REAL-TIME DISCUSSION & ACTIVITY */}
        {activeTab === 'comments' && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center justify-between">
              <span>Task created by <strong className="text-slate-800">{task.createdByName || 'Team Member'}</strong></span>
              <span className="text-[11px] text-slate-400 font-mono">{formatRelativeTime(task.createdAt)}</span>
            </div>

            {/* Comment Thread List */}
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {comments.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-60" />
                  <p>No comments on this task yet.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Post an update, blocker, or question for collaborators.</p>
                </div>
              ) : (
                comments.map((comment) => {
                  const isOwn = user?.uid && comment.authorId === user.uid;
                  return (
                    <div
                      key={comment.commentId}
                      className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-primary-600 text-white flex items-center justify-center text-[10px] font-bold">
                            {(comment.authorName || 'U').charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs font-bold text-slate-800">{comment.authorName}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{formatRelativeTime(comment.createdAt)}</span>
                        </div>

                        {isOwn && (
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(comment.commentId)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 transition-colors"
                            title="Delete comment"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed pl-7">
                        {comment.content}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            {/* New Comment Input Box */}
            <form onSubmit={handlePostComment} className="pt-2 border-t border-slate-100 flex items-start gap-2">
              <textarea
                rows={2}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handlePostComment(e);
                  }
                }}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="Write a comment or note... (Press Enter to post, Shift+Enter for new line)"
                className="flex-1 text-xs p-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-primary-500 resize-none leading-relaxed text-slate-800"
              />
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isPostingComment}
                disabled={!newComment.trim()}
                icon={<Send className="w-3.5 h-3.5" />}
                className="text-xs font-bold shrink-0 self-end shadow-sm select-none"
              >
                Post
              </Button>
            </form>
          </div>
        )}
      </div>
    </Modal>
  );
}

EditTaskModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  task: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  isLeader: PropTypes.bool,
  onMoveToBacklog: PropTypes.func,
  onMoveToSprint: PropTypes.func,
  isInActiveSprint: PropTypes.bool,
  isSprintActive: PropTypes.bool,
  activeSprintName: PropTypes.string,
};

export default EditTaskModal;
