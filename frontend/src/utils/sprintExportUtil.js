/**
 * Convia Sprint Board Export Utility
 * Generates downloadable Markdown & CSV sprint summaries.
 */

export function exportSprintAsMarkdown({ workspaceName = 'Workspace', tasks = [], progressPercentage = 0 }) {
  const now = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === 'Completed').length;

  const todoTasks = tasks.filter((t) => t.status === 'Todo');
  const inProgressTasks = tasks.filter((t) => t.status === 'In Progress');
  const reviewTasks = tasks.filter((t) => t.status === 'Review');
  const completedTasks = tasks.filter((t) => t.status === 'Completed');

  let md = `# ${workspaceName} — Sprint Execution Board Report\n`;
  md += `*Generated on ${now} via Convia*\n\n`;
  md += `**Overall Sprint Completion:** ${completed} of ${total} Tasks Done (${progressPercentage}%)\n\n`;
  md += `---\n\n`;

  const renderSection = (title, emoji, list) => {
    md += `## ${emoji} ${title} (${list.length})\n\n`;
    if (list.length === 0) {
      md += `*No tasks in this stage.*\n\n`;
      return;
    }

    list.forEach((t) => {
      md += `### ${t.title}\n`;
      md += `- **Priority:** ${t.priority || 'Medium'}\n`;
      md += `- **Assignee:** ${t.assignedToName || 'Unassigned'}\n`;
      if (t.dueDate) md += `- **Due Date:** ${t.dueDate}\n`;
      if (t.tags && t.tags.length > 0) md += `- **Tags:** ${t.tags.join(', ')}\n`;
      if (t.blueprintTaskId) md += `- **Source:** Planned from AI Architecture Blueprint\n`;
      if (t.description) {
        md += `\n**Description:**\n${t.description}\n`;
      }
      if (Array.isArray(t.subtasks) && t.subtasks.length > 0) {
        md += `\n**Checklist:**\n`;
        t.subtasks.forEach((st) => {
          md += `- [${st.completed ? 'x' : ' '}] ${st.title}\n`;
        });
      }
      md += `\n`;
    });
  };

  renderSection('In Progress', '⚡', inProgressTasks);
  renderSection('Review', '🔍', reviewTasks);
  renderSection('Todo', '📋', todoTasks);
  renderSection('Completed', '✅', completedTasks);

  // Trigger download
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${workspaceName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_sprint_report.md`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportSprintAsCsv({ workspaceName = 'Workspace', tasks = [] }) {
  const headers = ['Task ID', 'Title', 'Status', 'Priority', 'Assignee', 'Due Date', 'Tags', 'Created At'];

  const rows = tasks.map((t) => [
    `"${(t.taskId || '').replace(/"/g, '""')}"`,
    `"${(t.title || '').replace(/"/g, '""')}"`,
    `"${(t.status || 'Todo').replace(/"/g, '""')}"`,
    `"${(t.priority || 'Medium').replace(/"/g, '""')}"`,
    `"${(t.assignedToName || 'Unassigned').replace(/"/g, '""')}"`,
    `"${(t.dueDate || '').replace(/"/g, '""')}"`,
    `"${Array.isArray(t.tags) ? t.tags.join(', ') : ''}"`,
    `"${t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ''}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${workspaceName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_tasks.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
