import React, { useState, useMemo } from 'react';
import {
  Sliders,
  Clock,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  Layers,
  ShieldAlert,
  ArrowRight,
  Zap,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { safeText, safeArray } from '../../utils/safeRender';

/**
 * Blueprint 2.0 Dynamic Scope vs Time Tradeoff Simulator.
 * Allows engineering leaders and PMs to dynamically simulate delivery timelines,
 * capacity caps, and automatic deferral of non-critical tasks.
 */
export function BlueprintScopeTradeoffSimulator({
  content,
  onApplyTradeoff,
  isApplying = false,
}) {
  const v2 = content?.rawV2Content || content?.__v2Content || content || {};
  const execution = v2.execution || {};
  const rawTasks = safeArray(execution.tasks);
  const derived = content?.derivedExecution || {};
  const criticalPathSet = useMemo(() => {
    const cp = safeArray(derived.criticalPath);
    return new Set(cp.map((t) => (typeof t === 'object' ? t.id : t)));
  }, [derived.criticalPath]);

  // Normalize tasks with estimated effort (default to 8h if omitted)
  const tasks = useMemo(() => {
    return rawTasks.map((t, idx) => {
      const hours = Number(t.estimatedHours || t.hours || (t.priority === 'High' ? 12 : t.priority === 'Critical' ? 16 : 8));
      const isCritical = criticalPathSet.has(t.id) || Boolean(t.isCriticalPath) || t.priority === 'Critical';
      return {
        id: t.id || `TASK-${idx + 1}`,
        title: safeText(t.title || t.name, `Planned Task ${idx + 1}`),
        phase: safeText(t.phase, 'MVP Phase'),
        priority: safeText(t.priority, 'Medium'),
        hours,
        isCritical,
        status: safeText(t.status, 'Todo'),
        isAlreadyDeferred: String(t.status).toLowerCase() === 'deferred' || Boolean(t.isDeferred),
      };
    });
  }, [rawTasks, criticalPathSet]);

  const totalBaselineHours = useMemo(() => {
    return tasks.reduce((sum, t) => sum + t.hours, 0) || 80;
  }, [tasks]);

  const criticalHours = useMemo(() => {
    return tasks.filter((t) => t.isCritical).reduce((sum, t) => sum + t.hours, 0);
  }, [tasks]);

  // Target budget slider state: percentage of total effort (e.g. 50% to 100%)
  const [budgetPercent, setBudgetPercent] = useState(100);
  const [pinnedInScopeIds, setPinnedInScopeIds] = useState(new Set());
  const [pinnedDeferredIds, setPinnedDeferredIds] = useState(new Set());

  const targetHours = Math.round((totalBaselineHours * budgetPercent) / 100);

  // Simulation algorithm:
  // 1. Critical path tasks & user-pinned tasks are always In-Scope.
  // 2. High priority tasks next.
  // 3. Medium / Low priority discretionary tasks fill remaining budget.
  // 4. Overflow tasks marked as Recommended Deferred.
  const simulation = useMemo(() => {
    const inScope = [];
    const deferred = [];
    let currentHours = 0;

    // Separate mandatory vs discretionary
    const mandatory = [];
    const discretionary = [];

    tasks.forEach((t) => {
      if (pinnedDeferredIds.has(t.id)) {
        deferred.push(t);
      } else if (t.isCritical || pinnedInScopeIds.has(t.id)) {
        mandatory.push(t);
      } else {
        discretionary.push(t);
      }
    });

    // Add mandatory
    mandatory.forEach((t) => {
      inScope.push(t);
      currentHours += t.hours;
    });

    // Sort discretionary by priority (High -> Medium -> Low) then by smallest hours
    const priorityWeight = { Critical: 4, High: 3, Medium: 2, Low: 1 };
    discretionary.sort((a, b) => {
      const pDiff = (priorityWeight[b.priority] || 2) - (priorityWeight[a.priority] || 2);
      if (pDiff !== 0) return pDiff;
      return a.hours - b.hours;
    });

    discretionary.forEach((t) => {
      if (currentHours + t.hours <= targetHours || budgetPercent === 100) {
        inScope.push(t);
        currentHours += t.hours;
      } else {
        deferred.push(t);
      }
    });

    const savedHours = totalBaselineHours - currentHours;
    const estimatedWeeks = Math.max(1, Math.round((currentHours / 40) * 10) / 10);
    const baselineWeeks = Math.max(1, Math.round((totalBaselineHours / 40) * 10) / 10);
    const timeSavedWeeks = Math.max(0, Math.round((savedHours / 40) * 10) / 10);

    return {
      inScope,
      deferred,
      allocatedHours: currentHours,
      savedHours: Math.max(0, savedHours),
      estimatedWeeks,
      baselineWeeks,
      timeSavedWeeks,
    };
  }, [tasks, targetHours, budgetPercent, pinnedInScopeIds, pinnedDeferredIds, totalBaselineHours]);

  const handleTogglePin = (taskId, currentlyDeferred) => {
    if (currentlyDeferred) {
      setPinnedDeferredIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      setPinnedInScopeIds((prev) => new Set(prev).add(taskId));
    } else {
      setPinnedInScopeIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      setPinnedDeferredIds((prev) => new Set(prev).add(taskId));
    }
  };

  const handleReset = () => {
    setBudgetPercent(100);
    setPinnedInScopeIds(new Set());
    setPinnedDeferredIds(new Set());
  };

  const handleApply = () => {
    if (!onApplyTradeoff) return;
    const deferredIds = simulation.deferred.map((t) => t.id);
    onApplyTradeoff({ deferredTaskIds: deferredIds, targetHours: simulation.allocatedHours });
  };

  return (
    <div className="space-y-6">
      {/* Simulation Control Header */}
      <Card className="p-6 bg-slate-900 border border-slate-800 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="space-y-1">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Sliders className="h-4 w-4 text-primary-400" />
              Dynamic Scope vs Time Tradeoff Simulator
            </h3>
            <p className="text-xs text-slate-400">
              Interactively adjust delivery capacity to automatically identify discretionary tasks for Post-MVP deferral while locking the critical path.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              icon={<RotateCcw className="h-3.5 w-3.5" />}
              onClick={handleReset}
              className="border-slate-800 text-xs text-slate-400 hover:text-white whitespace-nowrap"
            >
              Reset Baseline
            </Button>
            {onApplyTradeoff && (
              <Button
                variant="primary"
                size="sm"
                icon={<Sparkles className="h-3.5 w-3.5" />}
                onClick={handleApply}
                disabled={isApplying || simulation.deferred.length === 0}
                className="bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs whitespace-nowrap"
              >
                Apply Tradeoff ({simulation.deferred.length} Deferred)
              </Button>
            )}
          </div>
        </div>

        {/* Capacity Slider & Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
          {/* Slider Column */}
          <div className="lg:col-span-2 space-y-4 bg-slate-950 p-5 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary-400" />
                Target Capacity / Effort Budget
              </span>
              <span className="text-base font-extrabold font-mono text-primary-400 bg-primary-950/80 px-3 py-1 rounded-lg border border-primary-800">
                {budgetPercent}% ({simulation.allocatedHours} hrs)
              </span>
            </div>

            <div className="space-y-2">
              <input
                type="range"
                min="40"
                max="100"
                step="5"
                value={budgetPercent}
                onChange={(e) => setBudgetPercent(Number(e.target.value))}
                className="w-full accent-primary-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[11px] font-mono text-slate-500">
                <span>Minimum Viable (40% · {Math.round(totalBaselineHours * 0.4)}h)</span>
                <span>Optimized MVP (75% · {Math.round(totalBaselineHours * 0.75)}h)</span>
                <span>Full Scope (100% · {totalBaselineHours}h)</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              💡 Critical-path tasks ({criticalHours} hrs) are locked in-scope to preserve architectural integrity.
            </p>
          </div>

          {/* Quick Metrics KPI cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">Estimated Delivery</span>
              <div className="text-lg font-black text-white font-mono">
                ~{simulation.estimatedWeeks} <span className="text-xs font-normal text-slate-400">weeks</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-medium">
                {simulation.timeSavedWeeks > 0 ? `▼ Saves ${simulation.timeSavedWeeks} weeks` : 'Baseline schedule'}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">Scope Breakdown</span>
              <div className="text-lg font-black text-white font-mono">
                {simulation.inScope.length} <span className="text-xs font-normal text-slate-400">/ {tasks.length}</span>
              </div>
              <span className="text-[10px] text-amber-400 font-medium">
                {simulation.deferred.length} tasks deferred
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Task Comparison Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* In-Scope Column */}
        <Card className="p-5 bg-slate-900 border border-emerald-950/70 space-y-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                In-Scope for MVP Release ({simulation.inScope.length})
              </h4>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
              {simulation.allocatedHours} hrs
            </span>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {simulation.inScope.map((t) => (
              <div
                key={t.id}
                className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold text-primary-400">{t.id}</span>
                    {t.isCritical && (
                      <span className="px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 text-[9px] font-mono font-bold border border-rose-800">
                        CRITICAL PATH
                      </span>
                    )}
                    <span className="text-slate-400 text-[10px] font-mono">{t.hours}h</span>
                  </div>
                  <p className="text-slate-200 font-medium truncate">{t.title}</p>
                </div>

                {!t.isCritical && (
                  <button
                    type="button"
                    onClick={() => handleTogglePin(t.id, false)}
                    title="Click to manually defer task"
                    className="shrink-0 text-[10px] font-mono text-slate-500 hover:text-amber-400 px-2 py-1 rounded bg-slate-900 border border-slate-800 transition-colors"
                  >
                    Defer →
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Deferred to Post-MVP Column */}
        <Card className="p-5 bg-slate-900 border border-amber-950/70 space-y-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-amber-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Deferred to Post-MVP ({simulation.deferred.length})
              </h4>
            </div>
            <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950 px-2 py-0.5 rounded border border-amber-800">
              +{simulation.savedHours} hrs saved
            </span>
          </div>

          {simulation.deferred.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 font-mono">
              All planned tasks fit within the selected budget. Drag the slider to simulate faster release delivery.
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {simulation.deferred.map((t) => (
                <div
                  key={t.id}
                  className="p-3 rounded-xl bg-slate-950 border border-amber-950/50 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold text-amber-400">{t.id}</span>
                      <span className="px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 text-[9px] font-mono font-bold border border-amber-800">
                        DEFERRED
                      </span>
                      <span className="text-slate-400 text-[10px] font-mono">{t.hours}h</span>
                    </div>
                    <p className="text-slate-300 font-medium truncate">{t.title}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleTogglePin(t.id, true)}
                    title="Click to bring back into scope"
                    className="shrink-0 text-[10px] font-mono text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded bg-emerald-950/60 border border-emerald-800 transition-colors"
                  >
                    ← Include
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
