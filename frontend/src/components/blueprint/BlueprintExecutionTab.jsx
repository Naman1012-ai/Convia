import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Workflow,
  CheckSquare,
  GitBranch,
  Clock,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ArrowRight,
  Shield,
  Layers,
  Calendar,
  Sparkles,
  Filter,
  Check,
  ChevronRight,
  Zap,
  RefreshCw,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { safeText, safeArray } from '../../utils/safeRender';

export function BlueprintExecutionTab({
  content,
  orgId,
  ideaId,
  onInspectEntity,
  onSyncTasks,
  isSyncingTasks = false,
}) {
  const [subView, setSubView] = useState('waves'); // 'waves' | 'graph' | 'tasks' | 'features' | 'workflow' | 'timeline'
  const [taskFilter, setTaskFilter] = useState('all');

  const v2 = content?.rawV2Content || content?.__v2Content || content || {};
  const execution = v2.execution || {};
  const tasks = safeArray(execution.tasks);
  const features = safeArray(execution.features || content?.coreFeatures);
  const workflow = safeArray(execution.workflow || content?.userFlow);
  const dependencies = safeArray(execution.dependencies);
  const milestones = safeArray(execution.timeline?.milestones || content?.developmentRoadmap);

  // Derived execution graphs & waves from Phase 4
  const derived = content?.derivedExecution || {};
  const executionWaves = safeArray(derived.executionWaves);
  const criticalPath = safeArray(derived.criticalPath);
  const blockedTasks = safeArray(derived.blockedTasks);

  // Lookup maps
  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const criticalPathSet = useMemo(() => new Set(criticalPath.map((t) => (typeof t === 'object' ? t.id : t))), [criticalPath]);
  const blockedTaskSet = useMemo(() => new Set(blockedTasks.map((t) => (typeof t === 'object' ? t.id : t))), [blockedTasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const statusLower = String(t.status || '').toLowerCase();
      if (taskFilter === 'critical') return criticalPathSet.has(t.id) || t.isCriticalPath;
      if (taskFilter === 'blocked') return blockedTaskSet.has(t.id) || statusLower === 'blocked';
      if (taskFilter === 'in progress') return statusLower === 'in progress' || statusLower === 'in_progress';
      if (taskFilter === 'completed') return statusLower === 'completed';
      if (taskFilter === 'todo') return statusLower === 'todo' || !t.status;
      if (taskFilter === 'unassigned') return !t.assignedUserId && !t.assignedUserName;
      return true;
    });
  }, [tasks, taskFilter, criticalPathSet, blockedTaskSet]);

  const completedCount = useMemo(() => tasks.filter((t) => String(t.status || '').toLowerCase() === 'completed').length, [tasks]);
  const inProgressCount = useMemo(() => tasks.filter((t) => String(t.status || '').toLowerCase().includes('progress')).length, [tasks]);
  const syncedCount = useMemo(() => tasks.filter((t) => t.isExecutionLinked || t.convertedTaskId || t.executionTaskId).length, [tasks]);

  return (
    <div className="space-y-6">
      {/* Sub-navigation Controls */}
      <Card className="p-4 bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'waves', label: 'Execution Waves', icon: Layers },
            { id: 'graph', label: 'Dependency Graph', icon: GitBranch },
            { id: 'tasks', label: 'Task List & Board', icon: CheckSquare, count: tasks.length },
            { id: 'features', label: 'Feature Decomposition', icon: Workflow, count: features.length },
            { id: 'workflow', label: 'System Workflow', icon: Workflow },
            { id: 'timeline', label: 'Milestones & Timeline', icon: Calendar },
          ].map((item) => {
            const Icon = item.icon;
            const active = subView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSubView(item.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  active
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
                {item.count !== undefined && (
                  <span className={`px-1.5 py-0.2 rounded font-mono text-[10px] ${
                    active ? 'bg-primary-800 text-white' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {orgId && (
          <Link
            to={ideaId ? `/workspaces/${orgId}/ideas/${ideaId}/tasks` : `/workspaces/${orgId}/tasks`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono text-xs font-bold hover:bg-emerald-900 transition-colors shrink-0"
          >
            <CheckSquare className="h-3.5 w-3.5" />
            <span>Open Live Task Board</span>
            <ExternalLink className="h-3 w-3 ml-0.5 opacity-70" />
          </Link>
        )}
      </Card>

      {/* 1. EXECUTION WAVES VIEW */}
      {subView === 'waves' && (
        <div className="space-y-6">
          {/* Critical Path Callout Banner */}
          {criticalPath.length > 0 && (
            <Card className="p-4 bg-amber-950/30 border border-amber-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-900/60 border border-amber-700 text-amber-400 shrink-0">
                  <Flame className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-amber-200 font-mono uppercase">
                    Critical Execution Path ({criticalPath.length} Tasks)
                  </h4>
                  <p className="text-xs text-amber-300/90 font-medium">
                    {criticalPath.map((t) => safeText(t.id || t.title || t)).join(' → ')}
                  </p>
                </div>
              </div>

              <span className="text-[11px] font-mono text-amber-400 bg-amber-950 px-2.5 py-1 rounded-lg border border-amber-800 shrink-0 font-bold">
                Zero Slack
              </span>
            </Card>
          )}

          {/* Waves Grid */}
          <div className="space-y-4">
            {executionWaves.length > 0 ? (
              executionWaves.map((wave, waveIdx) => (
                <Card
                  key={waveIdx}
                  className="p-5 bg-slate-900 border border-slate-800 space-y-3.5 shadow-md"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-lg bg-primary-950 text-primary-300 font-mono text-xs font-black border border-primary-800">
                        Wave {wave.waveNumber || waveIdx + 1}
                      </span>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                        {safeText(wave.name, `Execution Stage ${waveIdx + 1}`)}
                      </h4>
                    </div>

                    <span className="text-xs font-mono text-slate-400">
                      {safeArray(wave.tasks).length} Parallel Tasks · Est: {wave.durationHours || wave.totalEffortHours || 8}h
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {safeArray(wave.tasks).map((t) => {
                      const taskId = typeof t === 'object' ? t.id : t;
                      const taskObj = typeof t === 'object' ? t : taskMap.get(taskId) || { id: taskId };

                      return (
                        <div
                          key={taskId}
                          onClick={() =>
                            onInspectEntity({
                              id: taskObj.id,
                              type: 'task',
                              title: taskObj.title,
                              description: taskObj.description,
                              priority: taskObj.priority,
                              status: taskObj.status,
                              raw: taskObj,
                            })
                          }
                          className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-primary-600/60 cursor-pointer transition-all space-y-2 group shadow-sm"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-black text-primary-300">
                              {taskObj.id}
                            </span>
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase ${
                              taskObj.priority === 'Critical' || taskObj.isCriticalPath
                                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                : 'bg-slate-900 text-slate-300 border border-slate-800'
                            }`}>
                              {safeText(taskObj.priority, 'Medium')}
                            </span>
                          </div>

                          <h5 className="text-xs font-bold text-white group-hover:text-primary-200 transition-colors line-clamp-1">
                            {safeText(taskObj.title, 'Task Details')}
                          </h5>

                          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-900">
                            <span>{taskObj.estimatedEffortHours || 4}h effort</span>
                            <span>{safeText(taskObj.assignedUserName, 'Unassigned')}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              ))
            ) : (
              /* Fallback wave visualization if derived waves not generated yet */
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {tasks.map((task, idx) => (
                  <div
                    key={task.id || idx}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-primary-300">{task.id}</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 font-mono text-[10px]">
                        {safeText(task.status, 'Todo')}
                      </span>
                    </div>
                    <h5 className="text-xs font-bold text-white">{safeText(task.title)}</h5>
                    <p className="text-xs text-slate-400 line-clamp-2">{safeText(task.description)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. DEPENDENCY GRAPH VIEW */}
      {subView === 'graph' && (
        <Card className="p-6 bg-slate-900 border border-slate-800 space-y-5 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-primary-400" /> Interactive Dependency Graph
              </h3>
              <p className="text-xs text-slate-400">Node-to-node execution precedence and critical path highlighting</p>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-amber-400 font-bold">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" /> Critical Path Node
              </span>
              <span className="flex items-center gap-1.5 text-primary-400">
                <span className="h-2.5 w-2.5 rounded-full bg-primary-500" /> Standard Node
              </span>
            </div>
          </div>

          {/* Graph Node Container */}
          <div className="space-y-4">
            {tasks.map((task) => {
              const isCrit = criticalPathSet.has(task.id) || task.isCriticalPath;
              const isBlock = blockedTaskSet.has(task.id);
              const deps = safeArray(task.dependencyIds);

              return (
                <div
                  key={task.id}
                  className={`p-4 rounded-xl border transition-all space-y-3 ${
                    isCrit
                      ? 'bg-amber-950/20 border-amber-700/80 shadow-md shadow-amber-950/40'
                      : isBlock
                      ? 'bg-rose-950/20 border-rose-800/80'
                      : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded-lg font-mono text-xs font-black border ${
                        isCrit ? 'bg-amber-900/60 text-amber-200 border-amber-600' : 'bg-primary-950 text-primary-300 border border-primary-800'
                      }`}>
                        {task.id}
                      </span>
                      <h4 className="text-xs font-bold text-white">{safeText(task.title)}</h4>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] font-mono">
                      {isCrit && (
                        <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 font-bold border border-amber-800">
                          🔥 Critical Path
                        </span>
                      )}
                      {isBlock && (
                        <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 font-bold border border-rose-800">
                          Blocked
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                        {safeText(task.status, 'Todo')}
                      </span>
                    </div>
                  </div>

                  {/* Precedence Connections */}
                  <div className="flex items-center gap-2 flex-wrap text-xs font-mono pt-1 border-t border-slate-900">
                    <span className="text-slate-500 font-bold text-[10px] uppercase">Prerequisites:</span>
                    {deps.length > 0 ? (
                      deps.map((dId) => (
                        <span key={dId} className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800 flex items-center gap-1">
                          <ArrowRight className="h-3 w-3 text-primary-400" />
                          <span>{safeText(dId)}</span>
                        </span>
                      ))
                    ) : (
                      <span className="text-emerald-400 text-[10px]">Zero Dependencies (Ready for Wave 0)</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* 3. TASK LIST & TASK BOARD VIEW */}
      {subView === 'tasks' && (
        <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4 shadow-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-emerald-400" /> Complete Task Register ({tasks.length})
              </h3>
              <div className="flex items-center gap-3 text-xs text-slate-400 font-mono flex-wrap">
                <span>{completedCount} Completed</span>
                <span className="text-slate-600">·</span>
                <span className="text-blue-400">{inProgressCount} In Progress</span>
                <span className="text-slate-600">·</span>
                <span className="text-primary-400">{syncedCount} Synced to Board</span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {onSyncTasks && (
                <Button
                  variant="outline"
                  size="sm"
                  icon={<RefreshCw className={`h-3.5 w-3.5 text-primary-400 ${isSyncingTasks ? 'animate-spin' : ''}`} />}
                  onClick={onSyncTasks}
                  isLoading={isSyncingTasks}
                  className="border-primary-800/80 bg-primary-950/40 hover:bg-primary-900 text-primary-200 text-xs font-bold py-1 px-3 h-8 shadow-sm"
                >
                  Sync Blueprint Tasks
                </Button>
              )}

              <div className="flex items-center gap-1 text-xs font-mono flex-wrap">
                {['all', 'todo', 'in progress', 'completed', 'critical', 'unassigned'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setTaskFilter(f)}
                    className={`px-2.5 py-1 rounded-lg font-bold capitalize transition-all ${
                      taskFilter === f
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {filteredTasks.map((t) => (
              <div
                key={t.id}
                onClick={() =>
                  onInspectEntity({
                    id: t.id,
                    type: 'task',
                    title: t.title,
                    description: t.description,
                    priority: t.priority,
                    status: t.status,
                    raw: t,
                  })
                }
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-primary-600/60 cursor-pointer transition-all space-y-2 group shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-black text-primary-300">
                      {t.id}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                      t.priority === 'Critical' || t.isCriticalPath
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : 'bg-slate-900 text-slate-300 border border-slate-800'
                    }`}>
                      {safeText(t.priority, 'Medium')}
                    </span>
                    <span className={`px-2 py-0.5 rounded font-mono text-[10px] uppercase border font-bold flex items-center gap-1.5 ${
                      t.status === 'Completed' || t.status === 'completed'
                        ? 'bg-emerald-950/90 text-emerald-300 border-emerald-800'
                        : t.status === 'In Progress' || t.status === 'in_progress'
                        ? 'bg-blue-950/90 text-blue-300 border-blue-800'
                        : t.status === 'Review' || t.status === 'review'
                        ? 'bg-amber-950/90 text-amber-300 border-amber-800'
                        : t.status === 'Blocked' || t.status === 'blocked'
                        ? 'bg-rose-950/90 text-rose-300 border-rose-800'
                        : t.status === 'Unlinked' || t.isExecutionDeleted
                        ? 'bg-slate-800 text-slate-400 border-slate-700'
                        : 'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}>
                      {t.status === 'Completed' && <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />}
                      {t.status === 'In Progress' && <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />}
                      {t.status === 'Unlinked' && <AlertTriangle className="h-2.5 w-2.5 text-amber-400" />}
                      <span>{safeText(t.status, 'Todo')}</span>
                    </span>

                    {t.isExecutionLinked && (
                      <span className="px-1.5 py-0.5 rounded bg-primary-950/60 text-primary-300 font-mono text-[9px] border border-primary-800/80 flex items-center gap-1 font-bold">
                        <CheckSquare className="h-2.5 w-2.5 text-primary-400" />
                        <span>Synced</span>
                      </span>
                    )}
                  </div>

                  <span className="text-xs font-mono text-slate-400">
                    Effort: {t.estimatedEffortHours || 4}h · Assignee: {safeText(t.assignedUserName, 'Unassigned')}
                  </span>
                </div>

                <h4 className="text-xs font-bold text-white group-hover:text-primary-200 transition-colors">
                  {safeText(t.title)}
                </h4>
                {t.description && (
                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                    {safeText(t.description)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 4. FEATURE DECOMPOSITION VIEW */}
      {subView === 'features' && (
        <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4 shadow-lg">
          <h3 className="text-sm font-extrabold text-white flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="flex items-center gap-2">
              <Workflow className="h-4 w-4 text-primary-400" /> Feature Decomposition ({features.length})
            </span>
          </h3>

          <div className="space-y-4">
            {features.map((f, idx) => (
              <div
                key={f.id || idx}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg bg-primary-950 text-primary-300 font-mono text-xs font-black border border-primary-800">
                      {safeText(f.id, `FEAT-0${idx + 1}`)}
                    </span>
                    <span className="font-mono text-xs font-bold text-white">{safeText(f.name || f.featureName || f.title)}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 font-mono text-[10px] font-bold uppercase border border-slate-800">
                    {safeText(f.priority, 'Must Have')}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed font-medium">
                  {safeText(f.description)}
                </p>

                {/* Acceptance Criteria */}
                {safeArray(f.acceptanceCriteria).length > 0 && (
                  <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1.5">
                    <span className="text-[10px] font-mono uppercase text-emerald-400 font-bold">Acceptance Criteria:</span>
                    <ul className="space-y-1 text-xs text-slate-300">
                      {safeArray(f.acceptanceCriteria).map((ac, acIdx) => (
                        <li key={acIdx} className="flex items-start gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{safeText(ac)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 5. WORKFLOW VIEW */}
      {subView === 'workflow' && (
        <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4 shadow-lg">
          <h3 className="text-sm font-extrabold text-white flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="flex items-center gap-2">
              <Workflow className="h-4 w-4 text-primary-400" /> Implementation Workflow Pipeline ({workflow.length} Steps)
            </span>
          </h3>

          <div className="space-y-3 relative before:absolute before:left-4 before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-800">
            {workflow.map((step, idx) => (
              <div key={idx} className="relative pl-10 space-y-1">
                <div className="absolute left-2 top-2 -translate-x-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-white font-mono text-[10px] font-bold ring-4 ring-slate-900">
                  {step.stepNumber || idx + 1}
                </div>
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <h4 className="text-xs font-bold text-white">{safeText(step.stepName || step.title || step.name)}</h4>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">{safeText(step.description)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 6. MILESTONES & TIMELINE VIEW */}
      {subView === 'timeline' && (
        <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4 shadow-lg">
          <h3 className="text-sm font-extrabold text-white flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-400" /> Planned Milestones & Timeline ({milestones.length})
            </span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {milestones.map((m, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-black text-white">{safeText(m.name || m.phase || m.title)}</span>
                  <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 font-mono text-[10px] font-bold border border-blue-800">
                    {safeText(m.duration, 'Sprint')}
                  </span>
                </div>
                {m.description && <p className="text-xs text-slate-400">{safeText(m.description)}</p>}
                {safeArray(m.deliverables).length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-slate-900">
                    <span className="text-[10px] font-mono text-slate-500 uppercase font-bold">Deliverables:</span>
                    <ul className="space-y-1 text-xs text-slate-300">
                      {safeArray(m.deliverables).map((d, dIdx) => (
                        <li key={dIdx} className="flex items-start gap-1.5">
                          <span className="text-blue-400 font-bold">•</span>
                          <span>{safeText(d)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
