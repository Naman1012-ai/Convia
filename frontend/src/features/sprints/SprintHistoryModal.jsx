import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Modal } from '../../components/ui/Modal';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { sprintService } from '../../services/sprintService';
import {
  History,
  CheckCircle2,
  Calendar,
  Target,
  Award,
  RotateCcw,
  Sparkles,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { cn } from '../../utils/cn';

export function SprintHistoryModal({ isOpen, onClose, orgId }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !orgId) return;

    setLoading(true);
    sprintService
      .getSprintHistory(orgId)
      .then((list) => {
        setHistory(list || []);
      })
      .catch((err) => {
        console.warn('[SprintHistoryModal] getSprintHistory error:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, orgId]);

  // Aggregate Lifetime Metrics
  const totalCompletedSprints = history.length;
  const totalCompletedTasks = history.reduce(
    (sum, s) => sum + (Number(s.metrics?.completedTasks) || 0),
    0
  );
  const avgCompletionRate =
    totalCompletedSprints > 0
      ? Math.round(
          history.reduce((sum, s) => sum + (Number(s.metrics?.completionRate) || 0), 0) /
            totalCompletedSprints
        )
      : 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Sprint History & Retrospective Archive"
      size="xl"
    >
      <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto scrollbar-thin">
        {/* Lifetime Summary KPI Banner */}
        <div className="p-4 rounded-2xl bg-linear-to-r from-primary-50/70 via-slate-50 to-primary-50/40 border border-primary-100 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-primary-800 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-primary-600" />
              Workspace Sprint Track Record
            </span>
            <span className="text-xs font-bold text-primary-700 bg-white px-2.5 py-0.5 rounded-full border border-primary-200 shadow-2xs">
              {totalCompletedSprints} Sprint{totalCompletedSprints === 1 ? '' : 's'} Delivered
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-xl bg-white/90 border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Sprints
              </span>
              <span className="text-lg font-black text-slate-800">{totalCompletedSprints}</span>
            </div>
            <div className="p-3 rounded-xl bg-white/90 border border-emerald-200/80 shadow-2xs">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">
                Tasks Delivered
              </span>
              <span className="text-lg font-black text-emerald-700">{totalCompletedTasks}</span>
            </div>
            <div className="p-3 rounded-xl bg-white/90 border border-primary-200/80 shadow-2xs">
              <span className="text-[10px] font-bold text-primary-600 uppercase tracking-wider block">
                Avg Velocity
              </span>
              <span className="text-lg font-black text-primary-700">{avgCompletionRate}%</span>
            </div>
          </div>
        </div>

        {/* Sprint History Timeline List */}
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">
            <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading sprint history...
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-12 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 space-y-2">
            <History className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-700">No Past Sprints Archived Yet</p>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
              Completed sprints will automatically appear here with their task execution metrics,
              velocity, and retrospective notes.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((sprint, idx) => {
              const metrics = sprint.metrics || {};
              const completionRate = metrics.completionRate || 0;
              const completedTasks = metrics.completedTasks || 0;
              const totalTasks = metrics.totalTasks || 0;
              const uncompletedTasks = metrics.uncompletedTasks || 0;
              const retrospective = sprint.retrospective || {};

              return (
                <div
                  key={sprint.sprintId || idx}
                  className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-primary-200 transition-all space-y-4"
                >
                  {/* Sprint Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-slate-900">
                          {sprint.name || `Sprint ${sprint.sprintNumber || idx + 1}`}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          Completed
                        </span>
                      </div>
                      {sprint.goal && (
                        <p className="text-xs text-slate-600 flex items-center gap-1.5">
                          <Target className="w-3.5 h-3.5 text-primary-600 shrink-0" />
                          <span>{sprint.goal}</span>
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-right">
                      <span className="text-xs font-black text-primary-700 bg-primary-50 px-2.5 py-1 rounded-xl border border-primary-100">
                        {completionRate}% Delivered
                      </span>
                    </div>
                  </div>

                  {/* Dates & Timeline Info */}
                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 font-medium">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        {sprint.startDate || 'Start'} &rarr; {sprint.targetEndDate || 'End'}
                      </span>
                    </span>
                    {sprint.completedByName && (
                      <span>Completed by <strong className="text-slate-700">{sprint.completedByName}</strong></span>
                    )}
                  </div>

                  {/* Progress Bar & Breakdown */}
                  <div className="space-y-2">
                    <ProgressBar percentage={completionRate} size="sm" />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/60">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Planned</span>
                        <span className="font-extrabold text-slate-800">{totalTasks}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-emerald-50/60 border border-emerald-200/60">
                        <span className="text-[10px] text-emerald-600 uppercase font-bold block">Done</span>
                        <span className="font-extrabold text-emerald-700">{completedTasks}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-amber-50/60 border border-amber-200/60">
                        <span className="text-[10px] text-amber-600 uppercase font-bold block">Rolled Over</span>
                        <span className="font-extrabold text-amber-700">{uncompletedTasks}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/60">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Critical</span>
                        <span className="font-extrabold text-slate-800">{metrics.priorityBreakdown?.Critical || 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* Retrospective Notes & Learnings */}
                  {(retrospective.notes || retrospective.whatWentWell || retrospective.aiSummary) && (
                    <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-2 text-xs">
                      <div className="flex items-center gap-1.5 text-primary-700 font-bold">
                        <Award className="w-3.5 h-3.5" />
                        <span>Retrospective & Key Learnings</span>
                      </div>
                      {retrospective.notes && (
                        <p className="text-slate-700 whitespace-pre-wrap leading-relaxed pl-5">
                          {retrospective.notes}
                        </p>
                      )}
                      {retrospective.whatWentWell && (
                        <p className="text-slate-700 whitespace-pre-wrap leading-relaxed pl-5">
                          <strong>Highlights:</strong> {retrospective.whatWentWell}
                        </p>
                      )}
                      {retrospective.rolloverAction && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pl-5 pt-1">
                          <RotateCcw className="w-3 h-3 text-slate-400" />
                          <span>
                            Incomplete tasks action:{' '}
                            <strong className="text-slate-700">
                              {retrospective.rolloverAction === 'todo' ? 'Reset to Todo Backlog' : 'Kept in Current Stage'}
                            </strong>
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}

SprintHistoryModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  orgId: PropTypes.string,
};

export default SprintHistoryModal;
