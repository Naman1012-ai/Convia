import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Layers,
  Activity,
  Award,
  Filter,
  Check,
  ChevronRight,
  Shield,
  Zap,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { safeText, safeArray } from '../../utils/safeRender';

export function BlueprintRisksAndQualityTab({
  content,
  onInspectEntity,
}) {
  const [riskFilter, setRiskFilter] = useState('all');

  const v2 = content?.rawV2Content || content?.__v2Content || content || {};
  const quality = v2.quality || {};
  const risks = safeArray(quality.risks || content?.challengesAndDifficulties);
  const qualityGates = safeArray(quality.qualityGates);
  const testCases = safeArray(quality.testingStrategy?.testCases);
  const coverage = quality.testingStrategy?.coverage || {};
  const readiness = quality.productionReadiness || quality.readiness || content?.projectReadiness || {};

  const filteredRisks = risks.filter((r) => {
    if (riskFilter === 'all') return true;
    return safeText(r.severity, 'Medium').toLowerCase() === riskFilter.toLowerCase();
  });

  return (
    <div className="space-y-6">
      {/* 1. QUALITY GATES PIPELINE (8-Gate Verification) */}
      <Card className="p-6 bg-slate-900 border border-slate-800 space-y-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" /> 8-Stage Quality Gate Pipeline
            </h3>
            <p className="text-xs text-slate-400">Continuous quality verification with automated evidence validation</p>
          </div>

          <span className="text-xs font-mono text-emerald-400 font-bold bg-emerald-950 px-2.5 py-1 rounded-lg border border-emerald-800">
            {qualityGates.filter((g) => g.status === 'passed').length} / {qualityGates.length || 8} Gates Passed
          </span>
        </div>

        {/* Gate Progress Bar & Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {qualityGates.map((gate, idx) => {
            const isPassed = gate.status === 'passed';
            const isInProg = gate.status === 'in_progress';
            const criteriaText = safeText(gate.criteria || gate.evidenceRequirements);
            const isLong = criteriaText.length > 70;

            return (
              <div
                key={gate.id || idx}
                className={`p-3.5 rounded-xl border space-y-2 flex flex-col justify-between transition-all ${
                  isPassed
                    ? 'bg-emerald-950/30 border-emerald-800/80 text-emerald-200'
                    : isInProg
                    ? 'bg-amber-950/30 border-amber-800/80 text-amber-200'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold uppercase">Gate {gate.gateNumber || idx + 1}</span>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase ${
                      isPassed
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : isInProg
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : 'bg-slate-900 text-slate-500 border border-slate-800'
                    }`}>
                      {safeText(gate.status, 'pending')}
                    </span>
                  </div>

                  <h5 className="text-xs font-bold text-white">{safeText(gate.name, `Gate ${idx + 1}`)}</h5>
                  <p className={`text-[11px] text-slate-300 leading-snug ${isLong ? 'line-clamp-2' : ''}`}>
                    {criteriaText || 'Verification criteria defined in release matrix.'}
                  </p>
                </div>

                {isLong && onInspectEntity && (
                  <button
                    type="button"
                    onClick={() =>
                      onInspectEntity({
                        id: gate.id || `GATE-0${idx + 1}`,
                        type: 'quality_gate',
                        title: safeText(gate.name, `Gate ${idx + 1}`),
                        description: criteriaText,
                        priority: isPassed ? 'Passed' : isInProg ? 'In Progress' : 'Pending',
                        status: gate.status || 'pending',
                        raw: gate,
                      })
                    }
                    className="text-[10px] font-mono font-bold text-primary-400 hover:text-primary-300 flex items-center gap-1 cursor-pointer pt-1"
                  >
                    <span>See details</span>
                    <ChevronRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* 2. RISK REGISTER & SEVERITY MATRIX */}
      <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4 shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-rose-400" /> Risk Register & Mitigations ({risks.length})
            </h3>
            <p className="text-xs text-slate-400">Likelihood × Impact risk assessment with mitigation and contingency plans</p>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-mono">
            {['all', 'critical', 'high', 'medium', 'low'].map((sev) => (
              <button
                key={sev}
                onClick={() => setRiskFilter(sev)}
                className={`px-2 py-0.5 rounded-lg font-bold capitalize transition-all ${
                  riskFilter === sev
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {filteredRisks.map((rk, idx) => {
            const riskId = safeText(rk.id, `RISK-0${idx + 1}`);
            const severity = safeText(rk.severity, 'Medium');
            const title = safeText(rk.title || rk.challenge, 'Identified Risk');

            return (
              <div
                key={riskId}
                onClick={() =>
                  onInspectEntity({
                    id: riskId,
                    type: 'risk',
                    title,
                    description: safeText(rk.description),
                    priority: severity,
                    status: safeText(rk.status, 'identified'),
                    raw: rk,
                  })
                }
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-primary-600/60 cursor-pointer transition-all space-y-2.5 group shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 font-mono text-xs font-black border border-rose-800">
                      {riskId}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                      severity === 'Critical' || severity === 'High'
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : 'bg-slate-900 text-slate-300 border border-slate-800'
                    }`}>
                      Severity: {severity}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-400 font-mono text-[10px]">
                      L: {safeText(rk.likelihood, 'Med')} · I: {safeText(rk.impact, 'High')}
                    </span>
                  </div>

                  <span className="text-[11px] font-mono text-primary-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1 font-bold">
                    Details <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>

                <h4 className="text-xs font-bold text-white group-hover:text-primary-200 transition-colors">
                  {title}
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1 border-t border-slate-900">
                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-1">
                    <span className="text-[10px] font-mono uppercase text-emerald-400 font-bold">Mitigation Strategy:</span>
                    <p className="text-slate-300 leading-snug">{safeText(rk.mitigation || rk.mitigationStrategy, 'Standard monitoring and testing.')}</p>
                  </div>
                  {rk.contingency && (
                    <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-1">
                      <span className="text-[10px] font-mono uppercase text-amber-400 font-bold">Contingency Plan:</span>
                      <p className="text-slate-300 leading-snug">{safeText(rk.contingency)}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 3. TESTING STRATEGY & TEST CASES */}
      <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4 shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-400" /> Automated Testing Strategy & Test Cases ({testCases.length})
          </h3>

          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-slate-400">Req Coverage: <strong className="text-emerald-400">{coverage.requirementCoveragePercentage || 100}%</strong></span>
            <span className="text-slate-400">Feat Coverage: <strong className="text-emerald-400">{coverage.featureCoveragePercentage || 100}%</strong></span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {testCases.map((tc, idx) => {
            const descText = safeText(tc.description);
            const isLong = descText.length > 80;

            return (
              <div
                key={tc.id || idx}
                className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs flex flex-col justify-between"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 font-mono text-[10px] font-black border border-blue-800">
                      {safeText(tc.id, `TC-0${idx + 1}`)}
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-slate-900 text-slate-400 font-mono text-[10px] uppercase font-bold">
                      {safeText(tc.category, 'integration')}
                    </span>
                  </div>

                  <h5 className="font-bold text-white">{safeText(tc.title)}</h5>
                  <p className={`text-slate-300 leading-snug text-[11px] ${isLong ? 'line-clamp-2' : ''}`}>
                    {descText || 'Test case verification procedure.'}
                  </p>
                </div>

                {isLong && onInspectEntity && (
                  <button
                    type="button"
                    onClick={() =>
                      onInspectEntity({
                        id: tc.id || `TC-0${idx + 1}`,
                        type: 'test_case',
                        title: safeText(tc.title),
                        description: descText,
                        priority: safeText(tc.priority, 'Medium'),
                        status: safeText(tc.category, 'integration'),
                        raw: tc,
                      })
                    }
                    className="text-[10px] font-mono font-bold text-primary-400 hover:text-primary-300 flex items-center gap-1 cursor-pointer pt-1"
                  >
                    <span>See details</span>
                    <ChevronRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
