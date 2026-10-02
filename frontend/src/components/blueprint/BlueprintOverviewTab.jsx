import React from 'react';
import {
  Target,
  FileText,
  Workflow,
  CheckSquare,
  ShieldAlert,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Users,
  Cpu,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { BlueprintSummaryCard } from './BlueprintSummaryCard';
import { safeText, safeArray } from '../../utils/safeRender';

export function BlueprintOverviewTab({
  content,
  isEditing,
  editForm,
  setEditForm,
  problemStatement,
  onNavigateTab,
  onInspectEntity,
}) {
  const v2 = content?.rawV2Content || content?.__v2Content || content || {};
  const pu = v2.projectUnderstanding || {};
  const readiness = v2.quality?.productionReadiness || v2.quality?.readiness || content?.projectReadiness || {};
  const qualityGates = safeArray(v2.quality?.qualityGates);
  const passedGates = qualityGates.filter((g) => g.status === 'passed').length;

  const requirementsList = safeArray(v2.requirements);
  const requirementsCount = requirementsList.length;
  const criticalReqsCount = requirementsList.filter((r) => r.priority === 'Critical' || r.priority === 'Must Have').length;
  const featuresList = safeArray(v2.execution?.features || content?.coreFeatures);
  const featuresCount = featuresList.length;
  const tasksList = safeArray(v2.execution?.tasks);
  const tasksCount = tasksList.length;
  const completedTasksCount = tasksList.filter((t) => String(t.status || '').toLowerCase() === 'completed').length;
  const inProgressTasksCount = tasksList.filter((t) => String(t.status || '').toLowerCase().includes('progress')).length;
  const syncedTasksCount = tasksList.filter((t) => t.isExecutionLinked || t.convertedTaskId || t.executionTaskId).length;
  const totalEffortHours = tasksList.reduce((acc, t) => acc + (Number(t.estimatedEffortHours) || 0), 0);
  const decisionsList = safeArray(v2.intelligence?.discussionIntelligence?.decisions);
  const approvedDecisionsCount = decisionsList.filter((d) => d.status === 'approved').length;
  const risksList = safeArray(v2.quality?.risks || content?.challengesAndDifficulties);
  const highRisksCount = risksList.filter((r) => r.severity === 'Critical' || r.severity === 'High').length;
  const questionsList = safeArray(v2.intelligence?.discussionIntelligence?.unresolvedQuestions);
  const blockingQuestionsCount = questionsList.filter((q) => q.isBlocking && q.status === 'open').length;

  const inScopeItems = safeArray(pu.mvpScope?.inScope);
  const outOfScopeItems = safeArray(pu.mvpScope?.outOfScope);

  const rawSummary =
    safeText(pu.summary) ||
    safeText(content?.projectOverview?.summary) ||
    safeText(content?.projectOverview) ||
    safeText(content?.summary) ||
    'Comprehensive technical blueprint specification.';

  const rawVision =
    safeText(pu.vision) ||
    safeText(content?.projectOverview?.vision) ||
    safeText(content?.vision) ||
    '';

  return (
    <div className="space-y-6">
      {/* 1. PROJECT DIRECTION: WHAT ARE WE BUILDING? WHY? (Under 1-minute read) */}
      <Card className="p-6 bg-slate-900 border border-slate-800 space-y-5 shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Target className="h-4 w-4 text-primary-400" /> Project Direction: What Are We Building & Why?
            </h3>
            <p className="text-xs text-slate-400">Core value chain from problem to MVP solution</p>
          </div>
          <span className="text-[11px] font-mono text-primary-300 font-bold bg-primary-950 px-2.5 py-0.5 rounded-full border border-primary-800">
            1-Min Briefing
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {/* 1. Problem */}
          <BlueprintSummaryCard
            tag="1. Problem"
            tagColor="text-rose-400"
            title="1. Problem Statement"
            content={safeText(pu.problemStatement) || safeText(problemStatement) || 'Problem statement to be resolved by MVP.'}
            footer="Why build this"
            entityId="PROBLEM"
            entityType="Project Direction"
            onInspectEntity={onInspectEntity}
            raw={{
              tag: '1. Problem',
              title: '1. Problem Statement',
              problemStatement: safeText(pu.problemStatement) || safeText(problemStatement),
              context: 'Core user and business pain points addressed by this project.',
            }}
          />

          {/* 2. Solution */}
          <BlueprintSummaryCard
            tag="2. Solution"
            tagColor="text-primary-400"
            title="2. Proposed Solution"
            content={safeText(pu.proposedSolution) || 'Engineered software platform addressing core workflow bottlenecks.'}
            footer="Core mechanism"
            entityId="SOLUTION"
            entityType="Project Direction"
            onInspectEntity={onInspectEntity}
            raw={{
              tag: '2. Solution',
              title: '2. Proposed Solution',
              proposedSolution: safeText(pu.proposedSolution),
              context: 'Technical and architectural approach designed to resolve the problem.',
            }}
          />

          {/* 3. MVP Scope */}
          <BlueprintSummaryCard
            tag="3. MVP Scope"
            tagColor="text-emerald-400"
            title="3. MVP Scope Boundary"
            content={
              inScopeItems.length > 0
                ? inScopeItems
                : 'Delivers primary functional requirements with validated architecture.'
            }
            footer="First release"
            entityId="MVP_SCOPE"
            entityType="Project Direction"
            onInspectEntity={onInspectEntity}
            raw={{
              tag: '3. MVP Scope',
              title: '3. MVP Scope Boundary',
              inScope: inScopeItems,
              outOfScope: outOfScopeItems,
              context: 'Precise scope boundary separating initial MVP delivery from post-MVP expansion.',
            }}
          />

          {/* 4. Target Users */}
          <BlueprintSummaryCard
            tag="4. Primary Users"
            tagColor="text-blue-400"
            title="4. Primary Users & Target Audience"
            content={safeText(pu.targetAudience) || 'Developers, Product Managers, and Project Leads.'}
            footer="Audience"
            entityId="PRIMARY_USERS"
            entityType="Project Direction"
            onInspectEntity={onInspectEntity}
            raw={{
              tag: '4. Primary Users',
              title: '4. Primary Users & Target Audience',
              targetAudience: safeText(pu.targetAudience),
              context: 'Target personas, stakeholder groups, and primary system actors.',
            }}
          />

          {/* 5. Core Value */}
          <BlueprintSummaryCard
            tag="5. Core Value"
            tagColor="text-amber-400"
            title="5. Core Value Proposition"
            content={safeText(pu.valueProposition) || 'Accelerates project execution with AI-generated clarity and structure.'}
            footer="Differentiator"
            entityId="CORE_VALUE"
            entityType="Project Direction"
            onInspectEntity={onInspectEntity}
            raw={{
              tag: '5. Core Value',
              title: '5. Core Value Proposition',
              valueProposition: safeText(pu.valueProposition),
              context: 'Key business outcomes, competitive advantages, and return on investment.',
            }}
          />
        </div>
      </Card>

      {/* 2. READINESS & PRODUCTION MATURITY SNAPSHOT */}
      <Card className="p-6 bg-slate-900 border border-slate-800 space-y-5 shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-4">
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl font-black font-mono text-xl border shadow-inner ${
              (readiness.score || readiness.readinessScore || 0) >= 80
                ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                : (readiness.score || readiness.readinessScore || 0) >= 60
                ? 'bg-amber-950 text-amber-300 border-amber-800'
                : 'bg-rose-950 text-rose-300 border-rose-800'
            }`}>
              {readiness.score || readiness.readinessScore || 85}%
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">Phase 6 Production Readiness</span>
                <span className="px-2 py-0.2 rounded bg-slate-950 text-primary-300 font-mono text-[10px] border border-slate-800 font-bold">
                  {safeText(readiness.level || readiness.derivedLevel, 'Ready for Development')}
                </span>
              </div>
              <h4 className="text-base font-extrabold text-white mt-0.5">
                {qualityGates.length > 0 ? `${passedGates} of ${qualityGates.length} Quality Gates Passed` : 'Quality & Delivery Verified'}
              </h4>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('quality')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-950/80 text-primary-300 border border-primary-800 font-mono text-xs font-bold hover:bg-primary-900 transition-colors"
          >
            <span>Inspect Quality Gates & Risks</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Readiness Breakdown Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-slate-500 font-bold uppercase text-[10px]">Quality Gates</span>
            <div className="flex items-center justify-between font-bold text-white">
              <span>{passedGates} passed</span>
              <span className="text-primary-400">{qualityGates.length - passedGates} pending</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-slate-500 font-bold uppercase text-[10px]">Blockers</span>
            <div className="flex items-center justify-between font-bold">
              <span className={safeArray(readiness.blockers).length > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                {safeArray(readiness.blockers).length} active
              </span>
              <span className="text-slate-500">0 critical</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-slate-500 font-bold uppercase text-[10px]">Warnings</span>
            <div className="flex items-center justify-between font-bold text-amber-400">
              <span>{safeArray(readiness.warnings).length} warnings</span>
              <span className="text-slate-500 text-[10px]">Actionable</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-slate-500 font-bold uppercase text-[10px]">Execution Status</span>
            <div className="flex items-center justify-between font-bold text-emerald-400">
              <span>{completedTasksCount}/{tasksCount} Done</span>
              <span className="text-primary-400">{syncedTasksCount} synced</span>
            </div>
          </div>
        </div>
      </Card>

      {/* 3. EXECUTION SNAPSHOT (6 Interactive Metric Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Requirements */}
        <div
          onClick={() => onNavigateTab('requirements')}
          className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-primary-600/60 cursor-pointer transition-all space-y-3 group shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-950 text-blue-300 border border-blue-800 group-hover:border-blue-600">
              <FileText className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-mono text-blue-400 font-bold bg-blue-950/80 px-2 py-0.5 rounded border border-blue-900">
              {criticalReqsCount} Critical
            </span>
          </div>
          <div>
            <span className="text-xs font-mono uppercase text-slate-400 font-bold">Requirements</span>
            <div className="text-2xl font-black text-white mt-0.5">{requirementsCount} Defined</div>
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-2 font-mono">
            <span>Traceable to tasks</span>
            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform text-primary-400" />
          </div>
        </div>

        {/* Features & Workflow */}
        <div
          onClick={() => onNavigateTab('execution')}
          className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-primary-600/60 cursor-pointer transition-all space-y-3 group shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-950 text-primary-300 border border-primary-800 group-hover:border-primary-600">
              <Workflow className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-mono text-primary-400 font-bold bg-primary-950/80 px-2 py-0.5 rounded border border-primary-900">
              {safeArray(v2.execution?.workflow).length} Steps
            </span>
          </div>
          <div>
            <span className="text-xs font-mono uppercase text-slate-400 font-bold">Features & Flow</span>
            <div className="text-2xl font-black text-white mt-0.5">{featuresCount} Core Modules</div>
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-2 font-mono">
            <span>Workflow pipeline</span>
            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform text-primary-400" />
          </div>
        </div>

        {/* Tasks & Effort */}
        <div
          onClick={() => onNavigateTab('execution')}
          className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-primary-600/60 cursor-pointer transition-all space-y-3 group shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-950 text-emerald-300 border border-emerald-800 group-hover:border-emerald-600">
              <CheckSquare className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-900">
              {completedTasksCount > 0 ? `${completedTasksCount}/${tasksCount} Done` : `${totalEffortHours} Hours`}
            </span>
          </div>
          <div>
            <span className="text-xs font-mono uppercase text-slate-400 font-bold">Execution Tasks</span>
            <div className="text-2xl font-black text-white mt-0.5">{tasksCount} Tasks</div>
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-2 font-mono">
            <span>{inProgressTasksCount > 0 ? `${inProgressTasksCount} active in progress` : 'Critical path mapped'}</span>
            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform text-primary-400" />
          </div>
        </div>

        {/* Decisions */}
        <div
          onClick={() => onNavigateTab('decisions')}
          className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-primary-600/60 cursor-pointer transition-all space-y-3 group shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-950 text-amber-300 border border-amber-800 group-hover:border-amber-600">
              <MessageSquare className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-900">
              {approvedDecisionsCount} Approved
            </span>
          </div>
          <div>
            <span className="text-xs font-mono uppercase text-slate-400 font-bold">Decisions</span>
            <div className="text-2xl font-black text-white mt-0.5">{decisionsList.length} Traceable</div>
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-2 font-mono">
            <span>Cross-entity links</span>
            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform text-primary-400" />
          </div>
        </div>

        {/* Risks */}
        <div
          onClick={() => onNavigateTab('quality')}
          className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-primary-600/60 cursor-pointer transition-all space-y-3 group shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-950 text-rose-300 border border-rose-800 group-hover:border-rose-600">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-mono text-rose-400 font-bold bg-rose-950/80 px-2 py-0.5 rounded border border-rose-900">
              {highRisksCount} High/Critical
            </span>
          </div>
          <div>
            <span className="text-xs font-mono uppercase text-slate-400 font-bold">Risks & Mitigations</span>
            <div className="text-2xl font-black text-white mt-0.5">{risksList.length} Identified</div>
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-2 font-mono">
            <span>Mitigation matrix</span>
            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform text-primary-400" />
          </div>
        </div>

        {/* Open Questions */}
        <div
          onClick={() => onNavigateTab('decisions')}
          className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-primary-600/60 cursor-pointer transition-all space-y-3 group shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-950 text-primary-300 border border-primary-800 group-hover:border-primary-600">
              <Zap className="h-5 w-5" />
            </div>
            {blockingQuestionsCount > 0 ? (
              <span className="text-[10px] font-mono text-rose-300 font-bold bg-rose-950 px-2 py-0.5 rounded border border-rose-800 animate-pulse">
                {blockingQuestionsCount} Blocking
              </span>
            ) : (
              <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                0 Blocking
              </span>
            )}
          </div>
          <div>
            <span className="text-xs font-mono uppercase text-slate-400 font-bold">Open Questions</span>
            <div className="text-2xl font-black text-white mt-0.5">
              {questionsList.filter((q) => q.status === 'open').length} Open
            </div>
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-2 font-mono">
            <span>Next action items</span>
            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform text-primary-400" />
          </div>
        </div>
      </div>

      {/* 4. EXECUTIVE SUMMARY & VISION (Expandable / Editable) */}
      <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
        <h3 className="text-sm font-extrabold text-white flex items-center justify-between border-b border-slate-800 pb-3">
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary-400" /> Executive Overview & Vision
          </span>
          {isEditing && (
            <span className="text-xs font-mono font-bold text-amber-400">Editing Section</span>
          )}
        </h3>

        {isEditing ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1 font-mono">Executive Summary</label>
              <textarea
                value={editForm?.projectOverview?.summary || ''}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    projectOverview: { ...(prev.projectOverview || {}), summary: e.target.value },
                  }))
                }
                rows={4}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-primary-500 font-medium leading-relaxed"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 leading-relaxed font-medium">
              {rawSummary}
            </div>

            {rawVision && (
              <div className="p-3.5 rounded-xl bg-primary-950/40 border border-primary-900/60 text-xs text-primary-200 font-medium">
                <span className="font-bold font-mono text-primary-300">Target Vision: </span>
                {rawVision}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* 5. MVP SCOPE (IN SCOPE vs OUT OF SCOPE) */}
      {(inScopeItems.length > 0 || outOfScopeItems.length > 0) && (
        <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-sm font-extrabold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
            <Layers className="h-4 w-4 text-emerald-400" /> MVP Scope Boundary
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* In Scope */}
            <div className="p-4 rounded-xl bg-slate-950 border border-emerald-950/60 space-y-2.5">
              <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> In Scope for MVP
              </span>
              <ul className="space-y-1.5 text-xs text-slate-300">
                {inScopeItems.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-emerald-500 font-bold">•</span>
                    <span>{safeText(item)}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Out of Scope */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
              <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Out of Scope (Post-MVP)
              </span>
              <ul className="space-y-1.5 text-xs text-slate-400">
                {outOfScopeItems.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-slate-600 font-bold">•</span>
                    <span>{safeText(item)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
