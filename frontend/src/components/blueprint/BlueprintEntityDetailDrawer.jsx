import React from 'react';
import { Link } from 'react-router-dom';
import {
  X,
  FileText,
  Workflow,
  CheckSquare,
  ShieldAlert,
  MessageSquare,
  HelpCircle,
  RotateCcw,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  Shield,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { formatTimestamp } from '../../utils/formatting';
import { safeText, safeArray } from '../../utils/safeRender';

/**
 * Blueprint 2.0 Unified Entity Detail Drawer.
 * Displays deep bidirectional traceability, related entities, and actions for any inspected element.
 */
export function BlueprintEntityDetailDrawer({
  isOpen,
  onClose,
  entity,
  orgId,
  ideaId,
  onSelectEntityById,
}) {
  if (!isOpen || !entity) return null;

  const { type, id, title, description, priority, status, raw } = entity;

  const safeType = safeText(type, 'entity').replace('_', ' ');
  const safeId = safeText(id);
  const safeTitle = safeText(title);
  const safeDescription = safeText(description);
  const safePriority = safeText(priority);
  const safeStatus = safeText(status);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-sm animate-fadeIn flex justify-end">
      <div className="w-full max-w-xl bg-slate-900 border-l border-slate-800 h-full shadow-2xl flex flex-col overflow-hidden animate-slideLeft">
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/80 flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-lg bg-primary-950 text-primary-300 font-mono text-xs font-black border border-primary-800">
                {safeId}
              </span>
              <span className="px-2.5 py-0.5 rounded bg-slate-900 text-slate-300 font-mono text-[10px] uppercase font-bold border border-slate-800">
                {safeType}
              </span>
              {safePriority && (
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                  safePriority === 'Critical' || safePriority === 'Blocking' || safePriority === 'High'
                    ? 'bg-rose-950 text-rose-300 border border-rose-800'
                    : 'bg-slate-900 text-slate-300 border border-slate-800'
                }`}>
                  {safePriority}
                </span>
              )}
              {safeStatus && (
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                  safeStatus === 'approved' || safeStatus === 'Completed' || safeStatus === 'passed'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : safeStatus === 'In Progress' || safeStatus === 'under_review' || safeStatus === 'proposed'
                    ? 'bg-amber-950 text-amber-300 border border-amber-800'
                    : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}>
                  {safeStatus}
                </span>
              )}
            </div>
            <h3 className="text-base font-extrabold text-white leading-snug">
              {safeTitle}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Main Description / Overview */}
          {safeDescription && (
            <div className="space-y-2">
              <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                Specification & Full Content
              </span>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 leading-relaxed font-medium whitespace-pre-line space-y-2">
                {safeDescription.split('\n').map((line, idx) => (
                  <p key={idx}>{line}</p>
                ))}
              </div>
            </div>
          )}

          {/* SPECIFIC VIEW: PROJECT DIRECTION & SUMMARY CARDS */}
          {(type === 'Project Direction' || type === 'summary_card') && raw && (
            <div className="space-y-4">
              {raw.context && (
                <div className="p-3.5 rounded-xl bg-primary-950/40 border border-primary-900/60 text-xs text-primary-200 font-medium">
                  <span className="font-bold font-mono text-primary-300">Context: </span>
                  {safeText(raw.context)}
                </div>
              )}

              {/* In-Scope Items */}
              {safeArray(raw.inScope).length > 0 && (
                <div className="p-4 rounded-xl bg-slate-950 border border-emerald-950/60 space-y-2.5">
                  <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" /> In-Scope for First MVP Release ({safeArray(raw.inScope).length})
                  </span>
                  <ul className="space-y-1.5 text-xs text-slate-200">
                    {safeArray(raw.inScope).map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-emerald-400 font-bold">•</span>
                        <span>{safeText(item)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Out-of-Scope Items */}
              {safeArray(raw.outOfScope).length > 0 && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                  <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Out-of-Scope (Future Iterations) ({safeArray(raw.outOfScope).length})
                  </span>
                  <ul className="space-y-1.5 text-xs text-slate-400">
                    {safeArray(raw.outOfScope).map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-slate-600 font-bold">•</span>
                        <span>{safeText(item)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* SPECIFIC VIEW: QUALITY GATE */}
          {type === 'quality_gate' && raw && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Gate Status</span>
                  <span className={`font-bold uppercase ${
                    raw.status === 'passed' ? 'text-emerald-400' : raw.status === 'in_progress' ? 'text-amber-400' : 'text-slate-400'
                  }`}>
                    {safeText(raw.status, 'pending')}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Gate Number</span>
                  <span className="text-white font-bold">Gate {raw.gateNumber || 1}</span>
                </div>
              </div>

              {(raw.criteria || raw.evidenceRequirements) && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <span className="text-[10px] font-mono font-bold uppercase text-primary-400">Verification Evidence Criteria</span>
                  <p className="text-xs text-slate-200 leading-relaxed font-medium">
                    {safeText(raw.criteria || raw.evidenceRequirements)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* SPECIFIC VIEW: TEST CASE */}
          {type === 'test_case' && raw && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Category</span>
                  <span className="text-white font-bold">{safeText(raw.category, 'Integration')}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Priority</span>
                  <span className="text-amber-400 font-bold">{safeText(raw.priority, 'Medium')}</span>
                </div>
              </div>

              {raw.expectedResult && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <span className="text-[10px] font-mono font-bold uppercase text-emerald-400">Expected Result</span>
                  <p className="text-xs text-slate-200 leading-relaxed font-medium">
                    {safeText(raw.expectedResult)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* SPECIFIC VIEW: REQUIREMENT */}
          {type === 'requirement' && raw && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Requirement Type</span>
                  <span className="text-white font-bold">{safeText(raw.type, 'functional')}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Source</span>
                  <span className="text-white font-bold">{safeText(raw.source, 'ai_inferred')}</span>
                </div>
              </div>

              {/* Linked Features */}
              {safeArray(raw.linkedFeatureIds).length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                    Linked Features
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {safeArray(raw.linkedFeatureIds).map((fId) => (
                      <button
                        key={fId}
                        onClick={() => onSelectEntityById && onSelectEntityById(fId, 'feature')}
                        className="px-2.5 py-1 rounded-lg bg-primary-950/80 text-primary-300 border border-primary-800 font-mono text-xs font-bold hover:bg-primary-900 transition-colors flex items-center gap-1.5"
                      >
                        <Workflow className="h-3 w-3" />
                        <span>{safeText(fId)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Linked Tasks */}
              {safeArray(raw.linkedTaskIds).length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                    Linked Tasks
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {safeArray(raw.linkedTaskIds).map((tId) => (
                      <button
                        key={tId}
                        onClick={() => onSelectEntityById && onSelectEntityById(tId, 'task')}
                        className="px-2.5 py-1 rounded-lg bg-emerald-950/80 text-emerald-300 border border-emerald-800 font-mono text-xs font-bold hover:bg-emerald-900 transition-colors flex items-center gap-1.5"
                      >
                        <CheckSquare className="h-3 w-3" />
                        <span>{safeText(tId)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SPECIFIC VIEW: TASK */}
          {type === 'task' && raw && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Live Execution Status</span>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase inline-flex items-center gap-1.5 border ${
                    raw.status === 'Completed' || raw.status === 'completed'
                      ? 'bg-emerald-950/90 text-emerald-300 border-emerald-800'
                      : raw.status === 'In Progress' || raw.status === 'in_progress'
                      ? 'bg-blue-950/90 text-blue-300 border-blue-800'
                      : raw.status === 'Review' || raw.status === 'review'
                      ? 'bg-amber-950/90 text-amber-300 border-amber-800'
                      : raw.status === 'Blocked' || raw.status === 'blocked'
                      ? 'bg-rose-950/90 text-rose-300 border-rose-800'
                      : raw.status === 'Unlinked' || raw.isExecutionDeleted
                      ? 'bg-slate-800 text-slate-400 border-slate-700'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}>
                    {raw.status === 'Completed' && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
                    {raw.status === 'In Progress' && <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />}
                    {raw.status === 'Unlinked' && <AlertTriangle className="h-3 w-3 text-amber-400" />}
                    <span>{safeText(raw.status, 'Todo')}</span>
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Source Version</span>
                  <span className="text-primary-300 font-bold">
                    v{safeText(raw.sourceBlueprintVersionId || raw.blueprintVersion, '1.0')}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Task Board Link</span>
                  <span className={`font-bold ${
                    raw.isExecutionLinked || raw.convertedTaskId
                      ? 'text-emerald-400 flex items-center gap-1'
                      : raw.isExecutionDeleted
                      ? 'text-amber-400'
                      : 'text-slate-400'
                  }`}>
                    {raw.isExecutionLinked || raw.convertedTaskId
                      ? '✓ Synced'
                      : raw.isExecutionDeleted
                      ? '⚠️ Unlinked'
                      : 'Not Synced'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Estimated Effort</span>
                  <span className="text-white font-bold">{raw.estimatedEffortHours || 4} hours</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Assignee</span>
                  <span className="text-white font-bold">{safeText(raw.assignedUserName, 'Unassigned')}</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Critical Path</span>
                  <span className={raw.isCriticalPath ? 'text-amber-400 font-bold' : 'text-slate-400 font-bold'}>
                    {raw.isCriticalPath ? '🔥 Critical' : 'Standard'}
                  </span>
                </div>
              </div>

              {/* Dependencies */}
              {safeArray(raw.dependencyIds).length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                    Depends On Tasks
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {safeArray(raw.dependencyIds).map((depId) => (
                      <button
                        key={depId}
                        onClick={() => onSelectEntityById && onSelectEntityById(depId, 'task')}
                        className="px-2.5 py-1 rounded-lg bg-slate-950 text-slate-300 border border-slate-800 font-mono text-xs font-bold hover:text-white hover:border-primary-600 transition-colors flex items-center gap-1.5"
                      >
                        <Clock className="h-3 w-3 text-amber-400" />
                        <span>{safeText(depId)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Live Task Board Navigation */}
              {orgId && (
                <div className="pt-2">
                  <Link
                    to={ideaId ? `/workspaces/${orgId}/ideas/${ideaId}/tasks` : `/workspaces/${orgId}/tasks`}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md"
                  >
                    <CheckSquare className="h-4 w-4" />
                    <span>Open in Workspace Task Board</span>
                    <ExternalLink className="h-3 w-3 ml-1 opacity-70" />
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* SPECIFIC VIEW: DECISION */}
          {type === 'decision' && raw && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-[10px] font-mono font-bold uppercase text-primary-400">Technical Rationale (Why)</span>
                <p className="text-xs text-slate-200 leading-relaxed font-medium">
                  {safeText(raw.rationale, 'Derived from architecture constraints and requirements.')}
                </p>
              </div>

              {raw.approvedByName && (
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-900/60 text-xs font-mono text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Approved by {safeText(raw.approvedByName)} {raw.approvedAt ? `on ${formatTimestamp(raw.approvedAt)}` : ''}</span>
                </div>
              )}

              {/* Affected Entities */}
              <div className="space-y-2">
                <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                  Cross-Entity Impact Matrix
                </span>
                <div className="flex flex-wrap gap-2 text-xs font-mono">
                  {safeArray(raw.affectedRequirementIds).map((rId) => (
                    <button
                      key={rId}
                      onClick={() => onSelectEntityById && onSelectEntityById(rId, 'requirement')}
                      className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 hover:bg-blue-900"
                    >
                      Req: {safeText(rId)}
                    </button>
                  ))}
                  {safeArray(raw.affectedTaskIds).map((tId) => (
                    <button
                      key={tId}
                      onClick={() => onSelectEntityById && onSelectEntityById(tId, 'task')}
                      className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 hover:bg-emerald-900"
                    >
                      Task: {safeText(tId)}
                    </button>
                  ))}
                  {safeArray(raw.affectedRiskIds).map((rkId) => (
                    <button
                      key={rkId}
                      onClick={() => onSelectEntityById && onSelectEntityById(rkId, 'risk')}
                      className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 hover:bg-rose-900"
                    >
                      Risk: {safeText(rkId)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SPECIFIC VIEW: RISK */}
          {type === 'risk' && raw && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-xs font-mono">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Likelihood</span>
                  <span className="text-white font-bold">{safeText(raw.likelihood, 'Medium')}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Impact</span>
                  <span className="text-white font-bold">{safeText(raw.impact, 'High')}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Severity</span>
                  <span className="text-rose-400 font-bold">{safeText(raw.severity, 'High')}</span>
                </div>
              </div>

              {raw.mitigation && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <span className="text-[10px] font-mono font-bold uppercase text-emerald-400">Mitigation Strategy</span>
                  <p className="text-xs text-slate-200 leading-relaxed font-medium">{safeText(raw.mitigation)}</p>
                </div>
              )}

              {raw.contingency && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <span className="text-[10px] font-mono font-bold uppercase text-amber-400">Contingency Plan</span>
                  <p className="text-xs text-slate-200 leading-relaxed font-medium">{safeText(raw.contingency)}</p>
                </div>
              )}
            </div>
          )}

          {/* SPECIFIC VIEW: QUESTION */}
          {type === 'question' && raw && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <span className="text-[10px] font-mono font-bold uppercase text-primary-400">Recommended Next Action</span>
                <p className="text-xs text-slate-200 leading-relaxed font-medium">
                  {safeText(raw.recommendedNextAction || raw.suggestedResolution, 'Clarify during sprint planning.')}
                </p>
              </div>

              {raw.isBlocking && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-900/60 text-xs font-mono text-rose-300 flex items-center gap-2 animate-pulse">
                  <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                  <span>🚨 Blocking critical-path task execution or architecture decision</span>
                </div>
              )}

              {raw.resolvedByDecisionId && (
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-900/60 text-xs font-mono text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Resolved by decision {safeText(raw.resolvedByDecisionId)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[11px] font-mono text-slate-500">
            Convia Canonical Entity Inspector
          </span>
          <Button variant="outline" size="sm" onClick={onClose} className="border-slate-800 text-xs">
            Close Panel
          </Button>
        </div>
      </div>
    </div>
  );
}
