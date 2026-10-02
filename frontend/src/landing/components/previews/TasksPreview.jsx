import React from 'react';
import { CheckSquare, Clock, User, ArrowRight } from 'lucide-react';

const DEMO_TASKS = [
  { id: 1, title: 'Setup Firebase Auth Guard & Rules', status: 'Completed', tag: 'Backend', assignee: 'Alex' },
  { id: 2, title: 'Build Real-Time Discussion Panel', status: 'In Progress', tag: 'Frontend', assignee: 'Sarah' },
  { id: 3, title: 'Integrate Dashboard Telemetry KPIs', status: 'Review', tag: 'Analytics', assignee: 'Marcus' },
  { id: 4, title: 'Implement AI Blueprint Generator', status: 'Todo', tag: 'AI Engine', assignee: 'Naman' },
];

export function TasksPreview() {
  return (
    <div className="p-6 sm:p-7 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <CheckSquare className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-base font-extrabold text-white">Auto-Populated Kanban Sprint</h4>
            <p className="text-xs text-slate-400 font-medium">Auto-generated from AI Blueprint specifications</p>
          </div>
        </div>

        <span className="px-3 py-1 rounded-full text-xs font-mono font-extrabold bg-primary-500/20 text-primary-300 border border-primary-500/30">
          Sprint Velocity: High
        </span>
      </div>

      {/* Kanban Board Columns Mockup */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {['Todo', 'In Progress', 'Review', 'Completed'].map((colName) => {
          const colTasks = DEMO_TASKS.filter((t) => t.status === colName);
          return (
            <div key={colName} className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-mono font-bold text-slate-400 pb-1 border-b border-slate-900">
                <span>{colName}</span>
                <span className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-300">{colTasks.length}</span>
              </div>

              {colTasks.map((t) => (
                <div key={t.id} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5 text-xs">
                  <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-primary-500/10 text-primary-300 border border-primary-500/20">
                    {t.tag}
                  </span>
                  <p className="font-bold text-white text-[11px] leading-tight">{t.title}</p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 font-mono">
                    <span>@{t.assignee}</span>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
