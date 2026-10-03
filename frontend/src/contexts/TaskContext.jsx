import React, { createContext, useState, useEffect, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../hooks/useAuth';
import { useOrg } from '../hooks/useOrg';
import { useToast } from '../hooks/useToast';
import { taskService } from '../services/taskService';
import { NOTIFICATION_MESSAGES } from '../utils/notificationMessages';

export const TaskContext = createContext({
  tasks: [],
  filteredTasks: [],
  loading: true,
  searchQuery: '',
  setSearchQuery: () => {},
  statusFilter: 'all',
  setStatusFilter: () => {},
  priorityFilter: 'all',
  setPriorityFilter: () => {},
  assigneeFilter: 'all',
  setAssigneeFilter: () => {},
  sortBy: 'priority',
  setSortBy: () => {},
  createTask: async () => {},
  updateTask: async () => {},
  updateTaskStatus: async () => {},
  assignTask: async () => {},
  deleteTask: async () => {},
});

export function TaskProvider({ children }) {
  const { user } = useAuth();
  const { org } = useOrg();
  const { toast } = useToast();
  const orgId = org?.orgId;

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('priority'); // 'priority' | 'due_date' | 'updated'

  useEffect(() => {
    // Reset workspace-scoped task state and filters on orgId change
    setTasks([]);
    setSearchQuery('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setAssigneeFilter('all');
    setSortBy('priority');

    if (!orgId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    let isSubscribed = true;

    const unsubscribe = taskService.subscribeToTasks(orgId, (taskList) => {
      if (!isSubscribed) return;
      setTasks(taskList || []);
      setLoading(false);
    });

    return () => {
      isSubscribed = false;
      unsubscribe();
    };
  }, [orgId]);

  const createTask = useCallback(
    async (taskData) => {
      if (!user || !orgId) return;
      try {
        const res = await taskService.createTask(user, orgId, taskData);
        toast.success(NOTIFICATION_MESSAGES.TASK.CREATED);
        return res;
      } catch (err) {
        toast.error(err);
      }
    },
    [user, orgId, toast]
  );

  const updateTask = useCallback(
    async (taskId, updates) => {
      if (!orgId) return;
      try {
        await taskService.updateTask(orgId, taskId, updates, user);
        toast.success(NOTIFICATION_MESSAGES.TASK.UPDATED);
      } catch (err) {
        toast.error(err);
      }
    },
    [orgId, user, toast]
  );

  const updateTaskStatus = useCallback(
    async (taskId, newStatus) => {
      if (!orgId) return;
      try {
        await taskService.updateTaskStatus(orgId, taskId, newStatus, user);
        if (newStatus === 'done' || newStatus === 'completed' || newStatus === 'Completed') {
          toast.success(NOTIFICATION_MESSAGES.TASK.COMPLETED);
        } else {
          toast.info(`Task status updated to ${newStatus}.`);
        }
      } catch (err) {
        toast.error(err);
      }
    },
    [orgId, user, toast]
  );

  const assignTask = useCallback(
    async (taskId, assignedToUid, assignedToName) => {
      if (!orgId) return;
      try {
        await taskService.assignTask(orgId, taskId, assignedToUid, assignedToName, user);
        toast.success(`Task assigned to ${assignedToName}.`);
      } catch (err) {
        toast.error(err);
      }
    },
    [orgId, user, toast]
  );

  const deleteTask = useCallback(
    async (taskId) => {
      if (!orgId) return;
      try {
        await taskService.deleteTask(orgId, taskId);
        toast.info(NOTIFICATION_MESSAGES.TASK.DELETED);
      } catch (err) {
        toast.error(err);
      }
    },
    [orgId, toast]
  );

  // Filter & Sort Tasks
  const filteredTasks = useMemo(() => {
    let result = (tasks || []).filter(Boolean);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          (t.title && t.title.toLowerCase().includes(q)) ||
          (t.description && t.description.toLowerCase().includes(q)) ||
          (t.assignedToName && t.assignedToName.toLowerCase().includes(q))
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter((t) => t.status === statusFilter);
    }

    if (priorityFilter !== 'all') {
      result = result.filter((t) => t.priority === priorityFilter);
    }

    if (assigneeFilter !== 'all') {
      result = result.filter((t) => t.assignedTo === assigneeFilter);
    }

    // Sorting
    const priorityWeight = { Critical: 4, High: 3, Medium: 2, Low: 1 };
    result.sort((a, b) => {
      if (sortBy === 'priority') {
        const weightB = priorityWeight[b?.priority] || 0;
        const weightA = priorityWeight[a?.priority] || 0;
        return weightB - weightA;
      } else if (sortBy === 'due_date') {
        if (!a?.dueDate) return 1;
        if (!b?.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
      } else {
        return (b?.updatedAt || 0) - (a?.updatedAt || 0);
      }
    });

    return result;
  }, [tasks, searchQuery, statusFilter, priorityFilter, assigneeFilter, sortBy]);

  return (
    <TaskContext.Provider
      value={{
        tasks,
        filteredTasks,
        loading,
        searchQuery,
        setSearchQuery,
        statusFilter,
        setStatusFilter,
        priorityFilter,
        setPriorityFilter,
        assigneeFilter,
        setAssigneeFilter,
        sortBy,
        setSortBy,
        createTask,
        updateTask,
        updateTaskStatus,
        assignTask,
        deleteTask,
      }}
    >
      {children}
    </TaskContext.Provider>
  );
}

TaskProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
