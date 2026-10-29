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
  Plus,
  Unlock,
  RotateCcw,
  X,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { safeText, safeArray } from '../../utils/safeRender';

export function BlueprintRisksAndQualityTab({
  content,
  onInspectEntity,
  isLeader = false,
  onUpdateQualityGate,
  onUpdateRisk,
  onAddRisk,
}) {
  const [riskFilter, setRiskFilter] = useState('all');
  const [showAddRiskModal, setShowAddRiskModal] = useState(false);
  const [newRisk, setNewRisk] = useState({
    title: '',
    description: '',
    severity: 'Medium',
    likelihood: 'Medium',
    impact: 'Medium',
    mitigation: '',
    contingency: '',
  });

  const v2 = content?.rawV2Content || content?.__v2Content || content || {};
  const quality = v2.quality || {};
  const risks = safeArray(quality.risks || content?.challengesAndDifficulties);
  const qualityGates = safeArray(quality.qualityGates);
  const testCases = safeArray(quality.testingStrategy?.testCases);
  const coverage = quality.testingStrategy?.coverage || {};

  const filteredRisks = risks.filter((r) => {
    if (riskFilter === 'all') return true;
    return safeText(r.severity, 'Medium').toLowerCase() === riskFilter.toLowerCase();
  });

  const handleCreateRiskSubmit = (e) => {
    e.preventDefault();
    if (!newRisk.title.trim()) return;
    if (onAddRisk) {
      onAddRisk(newRisk);
    }
    setNewRisk({
      title: '',
      description: '',
      severity: 'Medium',
      likelihood: 'Medium',
      impact: 'Medium',
      mitigation: '',
      contingency: '',
    });
    setShowAddRiskModal(false);
  };

  return (
    <div className="space-y-6">
      {/* 1. QUALITY GATES PIPELINE (8-Gate Verification) */}
      <Card className="p-6 bg-slate-900 border border-slate-800 space-y-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" /> 8-Stage Quality Gate Pipeline
            </h3>
            <p className="text-xs text-slate-400">Continuous quality verification with automated evidence validation & human sign-off</p>
          </div>

          <span className="text-xs font-mono text-emerald-400 font-bold bg-emerald-950 px-2.5 py-1 rounded-lg border border-emerald-800">
            {qualityGates.filter((g) => g.status === 'passed').length} / {qualityGates.length || 8} Gates Passed
          </span>
        </div>

        {/* Gate Progress Bar & Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {qualityGates.map((gate, idx) => {
            const gateId = gate.id || `GATE-0${idx + 1}`;
            const status = String(gate.status || 'pending').toLowerCase();
            const isPassed = status === 'passed';
            const isInProg = status === 'in_progress';
            const isBlocked = status === 'blocked';
            const isWaived = status === 'waived';
            const criteriaText = safeText(gate.criteria || gate.evidenceRequirements);

            return (
              <div
                key={gateId}
                onClick={() =>
                  onInspectEntity &&
                  onInspectEntity({
                    id: gateId,
                    type: 'quality_gate',
                    title: safeText(gate.name, `Gate ${idx + 1}`),
                    description: criteriaText,
                    priority: isPassed ? 'Passed' : isInProg ? 'In Progress' : isBlocked ? 'Blocked' : isWaived ? 'Waived' : 'Pending',
                    status: gate.status || 'pending',
                    raw: gate,
                  })
                }
                className={`p-3.5 rounded-xl border space-y-2 flex flex-col justify-between transition-all cursor-pointer hover:border-primary-500/60 ${
                  isPassed
                    ? 'bg-emerald-950/30 border-emerald-800/80 text-emerald-200'
                    : isBlocked
                    ? 'bg-rose-950/30 border-rose-800/80 text-rose-200'
                    : isInProg
                    ? 'bg-amber-950/30 border-amber-800/80 text-amber-200'
                    : isWaived
                    ? 'bg-purple-950/30 border-purple-800/80 text-purple-200'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold uppercase">Gate {gate.gateNumber || idx + 1}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase ${
                        isPassed
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : isBlocked
                          ? 'bg-rose-950 text-rose-300 border border-rose-800 animate-pulse'
                          : isInProg
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : isWaived
                          ? 'bg-purple-950 text-purple-300 border border-purple-800'
                          : 'bg-slate-900 text-slate-500 border border-slate-800'
                      }`}
                    >
                      {safeText(gate.status, 'pending')}
                    </span>
                  </div>

                  <h5 className="text-xs font-bold text-white">{safeText(gate.name, `Gate ${idx + 1}`)}</h5>
                  <p className="text-[11px] text-slate-300 leading-snug line-clamp-2">
                    {criteriaText || 'Verification criteria defined in release matrix.'}
                  </p>

                  {gate.verifiedBy && (
                    <p className="text-[10px] font-mono text-emerald-400 truncate">
                      ✓ By: {safeText(gate.verifiedBy)}
                    </p>
                  )}
                </div>

                {/* Interactive Gate Actions */}
                <div className="pt-2 border-t border-slate-900/80">
                  {isLeader && isBlocked && onUpdateQualityGate && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateQualityGate(gateId, { status: 'in_progress', unblockedAt: Date.now() });
                      }}
                      className="w-full py-1 px-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-mono text-[10px] font-bold flex items-center justify-center gap-1 shadow transition-all cursor-pointer"
                    >
                      <Unlock className="h-3 w-3" /> Unblock Gate
                    </button>
                  )}

                  {isLeader && isInProg && onUpdateQualityGate && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateQualityGate(gateId, { status: 'passed' });
                        }}
                        className="flex-1 py-1 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-[10px] font-bold flex items-center justify-center gap-1 shadow transition-all cursor-pointer"
                      >
                        <Check className="h-3 w-3" /> Mark Passed
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateQualityGate(gateId, { status: 'waived' });
                        }}
                        className="py-1 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[10px] transition-all cursor-pointer"
                        title="Waive gate requirement"
                      >
                        Waive
                      </button>
                    </div>
                  )}

                  {isLeader && status === 'pending' && onUpdateQualityGate && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateQualityGate(gateId, { status: 'in_progress' });
                      }}
                      className="w-full py-1 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-[10px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                    >
                      <Zap className="h-3 w-3 text-amber-400" /> Start Verification
                    </button>
                  )}

                  {(isPassed || isWaived) && (
                    <div className="flex items-center justify-between text-[10px] font-mono text-emerald-400">
                      <span className="flex items-center gap-1 font-bold">
                        <CheckCircle2 className="h-3.5 w-3.5" /> {isWaived ? 'Waived' : 'Verified'}
                      </span>
                      {isLeader && onUpdateQualityGate && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateQualityGate(gateId, { status: 'in_progress' });
                          }}
                          className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                        >
                          Reopen
                        </button>
                      )}
                    </div>
                  )}
                </div>
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
            <p className="text-xs text-slate-400">Likelihood × Impact risk assessment with active mitigation workflows</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-xs font-mono">
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

            {isLeader && onAddRisk && (
              <Button
                variant="primary"
                size="sm"
                icon={<Plus className="h-3.5 w-3.5" />}
                onClick={() => setShowAddRiskModal(true)}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shrink-0 whitespace-nowrap"
              >
                Add Custom Risk
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {filteredRisks.map((rk, idx) => {
            const riskId = safeText(rk.id, `RISK-0${idx + 1}`);
            const severity = safeText(rk.severity, 'Medium');
            const title = safeText(rk.title || rk.challenge, 'Identified Risk');
            const status = String(rk.status || 'identified').toLowerCase();
            const isMitigated = status === 'mitigated';

            return (
              <div
                key={riskId}
                onClick={() =>
                  onInspectEntity &&
                  onInspectEntity({
                    id: riskId,
                    type: 'risk',
                    title,
                    description: safeText(rk.description),
                    priority: severity,
                    status: rk.status || 'identified',
                    raw: rk,
                  })
                }
                className={`p-4 rounded-xl border transition-all space-y-2.5 group shadow-sm cursor-pointer ${
                  isMitigated
                    ? 'bg-slate-950/80 border-emerald-950/80 hover:border-emerald-600/60'
                    : 'bg-slate-950 border-slate-800 hover:border-primary-600/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded font-mono text-xs font-black border ${
                        isMitigated
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                          : 'bg-rose-950 text-rose-300 border-rose-800'
                      }`}
                    >
                      {riskId}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        severity === 'Critical' || severity === 'High'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : 'bg-slate-900 text-slate-300 border border-slate-800'
                      }`}
                    >
                      Severity: {severity}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-400 font-mono text-[10px]">
                      L: {safeText(rk.likelihood, 'Med')} · I: {safeText(rk.impact, 'High')}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        isMitigated
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : status === 'mitigating'
                          ? 'bg-blue-950 text-blue-300 border border-blue-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}
                    >
                      {safeText(rk.status, 'identified')}
                    </span>
                  </div>

                  {/* 1-Click Mitigation Action */}
                  <div className="flex items-center gap-2">
                    {isLeader && onUpdateRisk && !isMitigated && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateRisk(riskId, { status: 'mitigated', mitigatedAt: Date.now() });
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-800 hover:bg-emerald-900 font-mono text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                      >
                        <CheckCircle2 className="h-3 w-3" /> Mark Mitigated
                      </button>
                    )}

                    {isLeader && onUpdateRisk && isMitigated && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateRisk(riskId, { status: 'mitigating' });
                        }}
                        className="px-2 py-0.5 rounded text-slate-500 hover:text-slate-300 font-mono text-[10px] transition-colors cursor-pointer"
                      >
                        Reopen
                      </button>
                    )}

                    <span className="text-[11px] font-mono text-primary-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1 font-bold">
                      Details <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
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

      {/* ADD CUSTOM RISK MODAL */}
      {showAddRiskModal && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-rose-400" /> Add Custom Risk
              </h3>
              <button
                type="button"
                onClick={() => setShowAddRiskModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRiskSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 font-bold font-mono text-[11px]">Risk Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Latency Spike on Vector Search"
                  value={newRisk.title}
                  onChange={(e) => setNewRisk((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-primary-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-bold font-mono text-[11px]">Severity</label>
                  <select
                    value={newRisk.severity}
                    onChange={(e) => setNewRisk((prev) => ({ ...prev, severity: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-primary-500 font-mono"
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-bold font-mono text-[11px]">Likelihood</label>
                  <select
                    value={newRisk.likelihood}
                    onChange={(e) => setNewRisk((prev) => ({ ...prev, likelihood: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-primary-500 font-mono"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-bold font-mono text-[11px]">Impact</label>
                  <select
                    value={newRisk.impact}
                    onChange={(e) => setNewRisk((prev) => ({ ...prev, impact: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-primary-500 font-mono"
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-bold font-mono text-[11px]">Mitigation Strategy</label>
                <textarea
                  rows="2"
                  placeholder="Proactive steps to prevent or minimize impact..."
                  value={newRisk.mitigation}
                  onChange={(e) => setNewRisk((prev) => ({ ...prev, mitigation: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-primary-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-bold font-mono text-[11px]">Contingency Plan</label>
                <textarea
                  rows="2"
                  placeholder="Fallback action if the risk materializes..."
                  value={newRisk.contingency}
                  onChange={(e) => setNewRisk((prev) => ({ ...prev, contingency: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-primary-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddRiskModal(false)}
                  className="border-slate-800 text-slate-400 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
                >
                  Save Custom Risk
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
