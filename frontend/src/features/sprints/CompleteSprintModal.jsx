import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Textarea';
import { Button } from '../../components/ui/Button';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { CheckCircle2, AlertCircle, ArrowRight, Award, RotateCcw } from 'lucide-react';

export function CompleteSprintModal({ isOpen, sprint, metrics, onClose, onComplete, onSubmit }) {
  const [retrospectiveNotes, setRetrospectiveNotes] = useState('');
  const [rolloverAction, setRolloverAction] = useState('todo'); // 'todo' | 'keep'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!sprint) return null;

  const totalTasks = metrics?.totalTasks || 0;
  const completedTasks = metrics?.completedTasks || 0;
  const uncompletedTasks = metrics?.uncompletedTasks || 0;
  const completionRate = metrics?.completionRate || 0;

  const handleFinish = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const finishHandler = onComplete || onSubmit;
      if (typeof finishHandler !== 'function') {
        throw new Error('No complete handler provided.');
      }
      await finishHandler({
        sprintId: sprint.sprintId,
        rolloverAction,
        retrospectiveNotes: retrospectiveNotes.trim(),
        incompleteTaskIds: metrics?.incompleteTaskIds || [],
        metrics: {
          totalTasks,
          completedTasks,
          uncompletedTasks,
          completionRate,
          priorityBreakdown: metrics?.priorityBreakdown || {},
        },
      });
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to complete sprint.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Complete ${sprint.name || 'Sprint'}`} size="lg">
      <form onSubmit={handleFinish} className="p-6 space-y-5">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
            {error}
          </div>
        )}

        {/* Sprint Summary Card */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
              Sprint Velocity & Outcome
            </span>
            <span className="text-xs font-bold text-primary-700 bg-primary-50 px-2.5 py-0.5 rounded-full border border-primary-200">
              {completionRate}% Completed
            </span>
          </div>

          <ProgressBar percentage={completionRate} size="md" />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-200/80 text-center">
            <div className="p-2.5 rounded-xl bg-white border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Planned</span>
              <span className="text-base font-extrabold text-slate-800">{totalTasks}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white border border-emerald-200">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Done</span>
              <span className="text-base font-extrabold text-emerald-600">{completedTasks}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white border border-amber-200">
              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Remaining</span>
              <span className="text-base font-extrabold text-amber-600">{uncompletedTasks}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Critical</span>
              <span className="text-base font-extrabold text-slate-800">{metrics?.priorityBreakdown?.Critical || 0}</span>
            </div>
          </div>
        </div>

        {/* Incomplete Tasks Handling */}
        {uncompletedTasks > 0 && (
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>Incomplete Tasks ({uncompletedTasks})</span>
            </label>
            <div className="space-y-2">
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border text-xs cursor-pointer transition-colors ${
                  rolloverAction === 'todo'
                    ? 'bg-primary-50/50 border-primary-300 text-slate-900'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="rollover"
                  checked={rolloverAction === 'todo'}
                  onChange={() => setRolloverAction('todo')}
                  className="mt-0.5 text-primary-600 focus:ring-primary-500"
                />
                <div>
                  <span className="font-bold block">Reset Incomplete Tasks to "Todo" (Recommended)</span>
                  <span className="text-slate-500 text-[11px] leading-relaxed block mt-0.5">
                    Moves remaining In Progress and Review tasks back to the Todo backlog for the next sprint cycle.
                  </span>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3 rounded-xl border text-xs cursor-pointer transition-colors ${
                  rolloverAction === 'keep'
                    ? 'bg-primary-50/50 border-primary-300 text-slate-900'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="rollover"
                  checked={rolloverAction === 'keep'}
                  onChange={() => setRolloverAction('keep')}
                  className="mt-0.5 text-primary-600 focus:ring-primary-500"
                />
                <div>
                  <span className="font-bold block">Keep Tasks in Current Status</span>
                  <span className="text-slate-500 text-[11px] leading-relaxed block mt-0.5">
                    Leave tasks in their current column states on the board.
                  </span>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Retrospective Notes */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-primary-600" />
            <span>Sprint Retrospective & Learnings</span>
          </label>
          <Textarea
            rows={3}
            value={retrospectiveNotes}
            onChange={(e) => setRetrospectiveNotes(e.target.value)}
            placeholder="What went well? Any obstacles or process adjustments for the upcoming sprint?"
            className="text-xs p-3 bg-slate-50/50 border-slate-200 focus:bg-white rounded-xl resize-none"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-xs font-semibold"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            className="text-xs font-bold shadow-sm"
          >
            Complete Sprint & Archive
          </Button>
        </div>
      </form>
    </Modal>
  );
}

CompleteSprintModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  sprint: PropTypes.object,
  metrics: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onComplete: PropTypes.func,
  onSubmit: PropTypes.func,
};

export default CompleteSprintModal;
