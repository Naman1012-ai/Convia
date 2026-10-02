import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  RotateCcw,
  X,
  FileCheck,
  Layers,
  Workflow,
  Users,
  Clock,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { safeText, safeArray } from '../../utils/safeRender';

export function BlueprintApprovalModal({
  isOpen,
  onClose,
  version = '1.0',
  readinessData = null,
  onApprove,
  isApproving = false,
}) {
  if (!isOpen) return null;

  const canApprove = Boolean(readinessData?.canApprove);
  const readinessScore = readinessData?.readinessScore ?? 0;
  const checklist = safeArray(readinessData?.checklist);
  const blockingErrors = safeArray(readinessData?.blockingErrors);
  const warnings = safeArray(readinessData?.warnings);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* MODAL HEADER */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-950 border border-primary-700/80 text-primary-400">
              <ShieldCheck className="h-6 w-6 text-primary-400" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                Blueprint Approval Gate
                <span className="px-2.5 py-0.5 rounded-lg bg-primary-950 text-primary-300 font-mono text-xs border border-primary-800">
                  v{safeText(version, '1.0')}
                </span>
              </h3>
              <p className="text-xs text-slate-400">Verify structural preconditions and quality gates before formal activation</p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isApproving}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* MODAL CONTENT BODY */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* READINESS SCORE SUMMARY CARD */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase text-slate-400 font-bold">Execution Readiness</span>
              <div className="text-2xl font-black text-white font-mono flex items-center gap-2">
                {readinessScore}%
                <span className={`text-xs font-sans px-2 py-0.5 rounded-full font-bold uppercase ${
                  canApprove ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
                }`}>
                  {canApprove ? 'Ready to Activate' : 'Blocked'}
                </span>
              </div>
            </div>

            <div className="w-48 bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-800">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  readinessScore >= 80 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : readinessScore >= 50 ? 'bg-gradient-to-r from-amber-500 to-orange-400' : 'bg-gradient-to-r from-rose-500 to-pink-500'
                }`}
                style={{ width: `${Math.min(readinessScore, 100)}%` }}
              />
            </div>
          </div>

          {/* BLOCKING ERRORS BANNER */}
          {blockingErrors.length > 0 && (
            <div className="p-4 rounded-2xl bg-rose-950/50 border border-rose-800/80 text-rose-200 space-y-2 animate-fadeIn">
              <div className="flex items-center gap-2 font-bold text-xs text-rose-300">
                <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
                <span>Approval Blocked ({blockingErrors.length} unresolved issue{blockingErrors.length > 1 ? 's' : ''})</span>
              </div>
              <ul className="text-xs text-rose-200/90 list-disc list-inside space-y-1 font-medium pl-1">
                {blockingErrors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* WARNINGS BANNER */}
          {warnings.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800/80 text-amber-200 space-y-2">
              <div className="flex items-center gap-2 font-bold text-xs text-amber-300">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                <span>Review Warnings ({warnings.length} non-blocking note{warnings.length > 1 ? 's' : ''})</span>
              </div>
              <ul className="text-xs text-amber-200/90 list-disc list-inside space-y-1 font-medium pl-1">
                {warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* CHECKLIST TABLE */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold font-mono text-slate-300 uppercase tracking-wider">
              Verification Preconditions ({checklist.length})
            </h4>

            <div className="space-y-2">
              {checklist.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/90 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    {item.status === 'pass' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    ) : item.status === 'warning' ? (
                      <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
                    )}
                    <div>
                      <div className="font-bold text-white">{item.label}</div>
                      <div className="text-[11px] text-slate-400">{item.message}</div>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                    item.status === 'pass'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/80'
                      : item.status === 'warning'
                      ? 'bg-amber-950 text-amber-300 border border-amber-800/80'
                      : 'bg-rose-950 text-rose-300 border border-rose-800/80'
                  }`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* MODAL ACTIONS FOOTER */}
        <div className="p-6 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isApproving}
            className="text-xs border-slate-800 text-slate-400 hover:text-white"
          >
            Cancel
          </Button>

          <Button
            variant="primary"
            size="sm"
            icon={<CheckCircle2 className="h-4 w-4" />}
            isLoading={isApproving}
            disabled={!canApprove || isApproving}
            onClick={onApprove}
            className={`text-xs font-extrabold py-2 px-5 shadow-lg ${
              canApprove ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            Approve & Activate Execution Plan
          </Button>
        </div>
      </div>
    </div>
  );
}
