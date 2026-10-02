import React, { useState } from 'react';
import {
  MessageSquare,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  FileText,
  Workflow,
  CheckSquare,
  ShieldAlert,
  Clock,
  ArrowRight,
  Filter,
  Check,
  X,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { formatTimestamp } from '../../utils/formatting';
import { safeText, safeArray } from '../../utils/safeRender';

export function BlueprintDecisionsTab({
  content,
  onApproveDecision,
  onRejectDecision,
  processingDecisionId,
  onApproveRecommendation,
  onRejectRecommendation,
  processingRecommendationId,
  onInspectEntity,
}) {
  const [decisionFilter, setDecisionFilter] = useState('all');

  const v2 = content?.rawV2Content || content?.__v2Content || content || {};
  const disc = v2.intelligence?.discussionIntelligence || {};
  const decisions = safeArray(disc.decisions);
  const questions = safeArray(disc.unresolvedQuestions || content?.questionsAnalysis);
  const recommendations = safeArray(disc.changeRecommendations);
  const acceptedSuggestions = safeArray(disc.acceptedSuggestions || content?.suggestionsAnalysis);
  const rejectedSuggestions = safeArray(disc.rejectedSuggestions);

  const filteredDecisions = decisions.filter((d) => {
    const status = safeText(d.status, 'proposed');
    const category = safeText(d.category, 'architecture');
    if (decisionFilter === 'all') return true;
    if (decisionFilter === 'approved') return status === 'approved';
    if (decisionFilter === 'proposed') return status === 'proposed';
    return category.toLowerCase() === decisionFilter.toLowerCase();
  });

  return (
    <div className="space-y-6">
      {/* 1. METRICS OVERVIEW (4 Summary Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Decisions */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-950 text-primary-300 border border-primary-800">
              <MessageSquare className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950 px-2 py-0.5 rounded border border-emerald-900">
              {decisions.filter((d) => d.status === 'approved').length} Approved
            </span>
          </div>
          <div>
            <span className="text-xs font-mono uppercase text-slate-400 font-bold">Project Decisions</span>
            <div className="text-xl font-black text-white mt-0.5">{decisions.length} Total</div>
          </div>
        </div>

        {/* Open Questions */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-950 text-primary-300 border border-primary-800">
              <HelpCircle className="h-4 w-4" />
            </div>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
              questions.filter((q) => q.isBlocking && q.status === 'open').length > 0
                ? 'bg-rose-950 text-rose-300 border-rose-800 animate-pulse'
                : 'bg-slate-950 text-slate-400 border-slate-800'
            }`}>
              {questions.filter((q) => q.isBlocking && q.status === 'open').length} Blocking
            </span>
          </div>
          <div>
            <span className="text-xs font-mono uppercase text-slate-400 font-bold">Open Questions</span>
            <div className="text-xl font-black text-white mt-0.5">
              {questions.filter((q) => q.status === 'open').length} Unresolved
            </div>
          </div>
        </div>

        {/* Change Recommendations */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-950 text-amber-300 border border-amber-800">
              <RotateCcw className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-mono text-amber-400 font-bold bg-amber-950 px-2 py-0.5 rounded border border-amber-900">
              {recommendations.filter((r) => r.status === 'proposed').length} Pending
            </span>
          </div>
          <div>
            <span className="text-xs font-mono uppercase text-slate-400 font-bold">Recommendations</span>
            <div className="text-xl font-black text-white mt-0.5">{recommendations.length} Tracked</div>
          </div>
        </div>

        {/* Community Suggestions */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-950 text-emerald-300 border border-emerald-800">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950 px-2 py-0.5 rounded border border-emerald-900">
              {acceptedSuggestions.length} Accepted
            </span>
          </div>
          <div>
            <span className="text-xs font-mono uppercase text-slate-400 font-bold">Suggestions</span>
            <div className="text-xl font-black text-white mt-0.5">
              {acceptedSuggestions.length + rejectedSuggestions.length} Processed
            </div>
          </div>
        </div>
      </div>

      {/* 2. TRACEABLE DECISIONS LIST */}
      <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4 shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary-400" /> Traceable Project Decisions ({decisions.length})
            </h3>
            <p className="text-xs text-slate-400">Formal technical and architectural decisions governing project requirements</p>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-mono">
            {['all', 'approved', 'proposed', 'architecture', 'database', 'technology', 'scope'].map((f) => (
              <button
                key={f}
                onClick={() => setDecisionFilter(f)}
                className={`px-2.5 py-1 rounded-lg font-bold capitalize transition-all whitespace-nowrap ${
                  decisionFilter === f
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {filteredDecisions.length > 0 ? (
            filteredDecisions.map((dec, idx) => {
              const decId = safeText(dec.id, `DEC-0${idx + 1}`);
              const isApproved = dec.status === 'approved';
              const isProposed = dec.status === 'proposed';
              const status = safeText(dec.status, 'proposed');
              const category = safeText(dec.category, 'architecture');

              return (
                <div
                  key={decId}
                  className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-3.5 shadow-sm"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-lg bg-amber-950 text-amber-300 font-mono text-xs font-black border border-amber-800">
                        {decId}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 font-mono text-[10px] uppercase font-bold border border-slate-800">
                        {category}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        isApproved
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}>
                        {status}
                      </span>
                      {dec.isScopeChange && (
                        <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 font-mono text-[10px] font-bold border border-rose-800">
                          Scope Adjustment
                        </span>
                      )}
                    </div>

                    {/* Action Buttons for Lead Approval */}
                    {isProposed && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          icon={<X className="h-3.5 w-3.5 text-rose-400" />}
                          onClick={() => onRejectDecision && onRejectDecision(decId)}
                          isLoading={processingDecisionId === decId}
                          className="border-slate-800 text-slate-400 hover:text-rose-300 text-xs font-bold py-1 px-2.5 h-7"
                        >
                          Reject
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          icon={<Check className="h-3.5 w-3.5" />}
                          onClick={() => onApproveDecision && onApproveDecision(decId)}
                          isLoading={processingDecisionId === decId}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-1 px-3 h-7 shadow-sm"
                        >
                          Approve Decision
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-xs font-extrabold text-white">
                      {safeText(dec.title || dec.decision)}
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed font-medium">
                      <strong className="text-primary-300 font-mono">Why: </strong>
                      {safeText(dec.rationale)}
                    </p>
                  </div>

                  {/* Cross-Entity Links */}
                  <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-900 text-[11px] font-mono">
                    <span className="text-slate-500 font-bold uppercase text-[10px]">Affects:</span>
                    {safeArray(dec.affectedRequirementIds).map((rId) => (
                      <span key={rId} className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-900 font-bold">
                        {safeText(rId)}
                      </span>
                    ))}
                    {safeArray(dec.affectedTaskIds).map((tId) => (
                      <span key={tId} className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-900 font-bold">
                        {safeText(tId)}
                      </span>
                    ))}
                    {safeArray(dec.affectedRiskIds).map((rkId) => (
                      <span key={rkId} className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-900 font-bold">
                        {safeText(rkId)}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center text-xs text-slate-500 font-mono">
              No decisions found matching the selected filter.
            </div>
          )}
        </div>
      </Card>

      {/* 3. OPEN QUESTIONS & BLOCKERS */}
      <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4 shadow-lg">
        <h3 className="text-sm font-extrabold text-white flex items-center justify-between border-b border-slate-800 pb-3">
          <span className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-primary-400" /> Open Questions & Execution Blockers ({questions.length})
          </span>
        </h3>

        <div className="space-y-3">
          {questions.map((q, idx) => {
            const qId = safeText(q.id, `Q-0${idx + 1}`);

            return (
              <div
                key={qId}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-primary-950 text-primary-300 font-mono text-[10px] font-black border border-primary-800">
                      {qId}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400 uppercase font-bold">{safeText(q.category || q.area, 'general')}</span>
                  </div>

                  {q.isBlocking && (
                    <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 font-mono text-[10px] font-bold border border-rose-800 animate-pulse flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Execution Blocker
                    </span>
                  )}
                </div>

                <h4 className="font-bold text-white leading-snug">{safeText(q.question || q.content)}</h4>
                <p className="text-slate-400 leading-relaxed font-medium">
                  <span className="font-bold text-slate-300 font-mono">Recommended Action: </span>
                  {safeText(q.recommendedNextAction || q.suggestedResolution || q.recommendation, 'Clarify during sprint planning.')}
                </p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 4. DOWNSTREAM CHANGE RECOMMENDATIONS */}
      {recommendations.length > 0 && (
        <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4 shadow-lg">
          <h3 className="text-sm font-extrabold text-white flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-primary-400" /> Downstream Change Recommendations ({recommendations.length})
            </span>
          </h3>

          <div className="space-y-3">
            {recommendations.map((cr, idx) => {
              const crId = safeText(cr.id, `CR-0${idx + 1}`);

              return (
                <div
                  key={crId}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs font-mono"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-primary-950 text-primary-300 text-[10px] font-black border border-primary-800">
                        {crId}
                      </span>
                      <span className="text-white font-bold uppercase">{safeText(cr.changeType)} {safeText(cr.targetType)} {safeText(cr.targetId)}</span>
                    </div>

                    {cr.status === 'proposed' && !cr.isStale && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onRejectRecommendation && onRejectRecommendation(crId)}
                          isLoading={processingRecommendationId === crId}
                          className="border-slate-800 text-slate-400 text-xs py-1 px-2 h-6"
                        >
                          Reject
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => onApproveRecommendation && onApproveRecommendation(crId)}
                          isLoading={processingRecommendationId === crId}
                          className="bg-primary-600 hover:bg-primary-700 text-white text-xs py-1 px-3 h-6 shadow-sm"
                        >
                          Approve Change
                        </Button>
                      </div>
                    )}
                  </div>

                  <p className="text-slate-300 font-sans text-xs">{safeText(cr.proposedChange || cr.reason)}</p>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
