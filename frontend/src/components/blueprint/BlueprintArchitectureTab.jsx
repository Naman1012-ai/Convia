import React from 'react';
import {
  Cpu,
  Database,
  Layers,
  Code,
  Shield,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  GitBranch,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { safeText, safeArray } from '../../utils/safeRender';

export function BlueprintArchitectureTab({
  content,
  isEditing,
  editForm,
  setEditForm,
  onInspectEntity,
}) {
  const v2 = content?.rawV2Content || content?.__v2Content || content || {};
  const arch = v2.architecture || {};
  const techStack = arch.technologyStack || content?.recommendedTechStack || {};
  const dataArch = arch.dataArchitecture || {};
  const entities = safeArray(dataArch.entities || content?.databaseDesign?.entities);
  const decisions = safeArray(arch.decisions);

  const rawPattern =
    safeText(arch.architecturePattern) ||
    safeText(content?.technicalArchitecture?.architecturePattern) ||
    safeText(content?.technicalArchitecture) ||
    'Modular Client-Server Architecture';

  const rawDataFlow =
    safeText(arch.dataFlowDescription) ||
    safeText(content?.technicalArchitecture?.dataFlowDescription) ||
    safeText(content?.technicalArchitecture) ||
    'Client triggers authenticated API operations, state updates broadcast over real-time database nodes.';

  return (
    <div className="space-y-6">
      {/* 1. TECHNICAL ARCHITECTURE PATTERN & DATA FLOW */}
      <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4 shadow-lg">
        <h3 className="text-sm font-extrabold text-white flex items-center justify-between border-b border-slate-800 pb-3">
          <span className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary-400" /> System Architecture & Data Flow
          </span>
          {isEditing && (
            <span className="text-xs font-mono font-bold text-amber-400">Editing Architecture</span>
          )}
        </h3>

        {isEditing ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1 font-mono">Architecture Pattern</label>
              <input
                type="text"
                value={editForm?.technicalArchitecture?.architecturePattern || ''}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    technicalArchitecture: { ...(prev.technicalArchitecture || {}), architecturePattern: e.target.value },
                  }))
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1 font-mono">Data Flow Description</label>
              <textarea
                value={editForm?.technicalArchitecture?.dataFlowDescription || ''}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    technicalArchitecture: { ...(prev.technicalArchitecture || {}), dataFlowDescription: e.target.value },
                  }))
                }
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-400 uppercase tracking-wider font-mono">Pattern: </span>
              <span className="px-3 py-1 rounded-lg bg-primary-950 text-primary-200 border border-primary-800 font-mono font-bold">
                {rawPattern}
              </span>
            </div>

            {safeArray(arch.components).length > 0 && (
              <div className="space-y-2 pt-2">
                <span className="font-bold text-slate-400 uppercase tracking-wider font-mono text-[10px]">
                  Core System Components:
                </span>
                <div className="flex flex-wrap gap-2">
                  {safeArray(arch.components).map((comp, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-slate-950 text-slate-200 border border-slate-800 font-mono text-xs font-medium"
                    >
                      {safeText(comp)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1 pt-2">
              <span className="font-bold text-slate-400 uppercase tracking-wider font-mono text-[10px]">
                Data Flow & Execution Flow:
              </span>
              <p className="text-slate-300 leading-relaxed font-medium bg-slate-950 p-4 rounded-xl border border-slate-800">
                {rawDataFlow}
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* 2. RECOMMENDED TECHNOLOGY STACK */}
      <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4 shadow-lg">
        <h3 className="text-sm font-extrabold text-white flex items-center justify-between border-b border-slate-800 pb-3">
          <span className="flex items-center gap-2">
            <Code className="h-4 w-4 text-emerald-400" /> Technology Stack Specification
          </span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {/* Frontend */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <span className="text-[10px] font-mono font-bold uppercase text-primary-400">Frontend Layer</span>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {safeArray(techStack.frontend || ['React', 'Tailwind CSS', 'Vite']).map((t, idx) => (
                <span key={idx} className="px-2 py-0.5 rounded bg-slate-900 text-slate-200 font-mono text-xs border border-slate-800 font-bold">
                  {safeText(t)}
                </span>
              ))}
            </div>
          </div>

          {/* Backend */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <span className="text-[10px] font-mono font-bold uppercase text-emerald-400">Backend Layer</span>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {safeArray(techStack.backend || ['Node.js', 'Express']).map((t, idx) => (
                <span key={idx} className="px-2 py-0.5 rounded bg-slate-900 text-slate-200 font-mono text-xs border border-slate-800 font-bold">
                  {safeText(t)}
                </span>
              ))}
            </div>
          </div>

          {/* Database */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <span className="text-[10px] font-mono font-bold uppercase text-blue-400">Database Layer</span>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {safeArray(techStack.database || ['Firebase Realtime Database']).map((t, idx) => (
                <span key={idx} className="px-2 py-0.5 rounded bg-slate-900 text-slate-200 font-mono text-xs border border-slate-800 font-bold">
                  {safeText(t)}
                </span>
              ))}
            </div>
          </div>

          {/* Hosting */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <span className="text-[10px] font-mono font-bold uppercase text-amber-400">Hosting & DevOps</span>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {safeArray(techStack.hosting || ['Vercel', 'Firebase Hosting']).map((t, idx) => (
                <span key={idx} className="px-2 py-0.5 rounded bg-slate-900 text-slate-200 font-mono text-xs border border-slate-800 font-bold">
                  {safeText(t)}
                </span>
              ))}
            </div>
          </div>

          {/* Third Party APIs */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 sm:col-span-2">
            <span className="text-[10px] font-mono font-bold uppercase text-rose-400">Third-Party APIs & AI</span>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {safeArray(techStack.thirdPartyApis || ['Google Gemini AI', 'Firebase Auth']).map((t, idx) => (
                <span key={idx} className="px-2 py-0.5 rounded bg-slate-900 text-slate-200 font-mono text-xs border border-slate-800 font-bold">
                  {safeText(t)}
                </span>
              ))}
            </div>
          </div>
        </div>

        {techStack.evaluationReason && (
          <div className="p-3.5 rounded-xl bg-primary-950/30 border border-primary-900/50 text-xs text-primary-200 font-medium">
            <span className="font-bold font-mono text-primary-300">Stack Rationale: </span>
            {safeText(techStack.evaluationReason)}
          </div>
        )}
      </Card>

      {/* 3. DATA ARCHITECTURE ENTITIES */}
      <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4 shadow-lg">
        <h3 className="text-sm font-extrabold text-white flex items-center justify-between border-b border-slate-800 pb-3">
          <span className="flex items-center gap-2">
            <Database className="h-4 w-4 text-blue-400" /> Data Architecture & Database Models ({entities.length})
          </span>
          <span className="text-[11px] font-mono text-slate-400 font-bold">
            Primary DB: {safeText(dataArch.primaryDatabase) || safeText(content?.databaseDesign?.primaryDatabase) || 'Firebase RTDB'}
          </span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {entities.map((entity, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-black text-white flex items-center gap-1.5">
                  <Database className="h-3.5 w-3.5 text-primary-400" />
                  {safeText(entity.entityName || entity.name, `Entity ${idx + 1}`)}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                  entity.entityType === 'Necessary Entity' || !entity.isOptional
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}>
                  {safeText(entity.entityType || (entity.isOptional ? 'Optional' : 'Core Entity'))}
                </span>
              </div>

              {entity.description && (
                <p className="text-xs text-slate-400 leading-relaxed font-medium">
                  {safeText(entity.description)}
                </p>
              )}

              {/* Fields */}
              <div className="space-y-1.5 pt-1 border-t border-slate-900">
                <span className="text-[10px] font-mono uppercase text-slate-500 font-bold">Core Schema Fields:</span>
                <div className="flex flex-wrap gap-1.5">
                  {safeArray(entity.fields).map((f, fIdx) => (
                    <span key={fIdx} className="px-1.5 py-0.5 rounded bg-slate-900 text-primary-200 font-mono text-[11px] border border-slate-800">
                      {safeText(f)}
                    </span>
                  ))}
                </div>
              </div>

              {/* Optional Fields if present */}
              {safeArray(entity.optionalFields).length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-mono uppercase text-slate-500 font-bold">Optional Fields:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {safeArray(entity.optionalFields).map((f, fIdx) => (
                      <span key={fIdx} className="px-1.5 py-0.5 rounded bg-slate-900/60 text-slate-400 font-mono text-[10px] border border-slate-800">
                        {safeText(f)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* 4. ARCHITECTURE DECISION RECORDS (ADRs) */}
      {decisions.length > 0 && (
        <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4 shadow-lg">
          <h3 className="text-sm font-extrabold text-white flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-400" /> Architecture Decision Records (ADRs) ({decisions.length})
            </span>
          </h3>

          <div className="space-y-3">
            {decisions.map((adr, idx) => (
              <div
                key={adr.id || idx}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 font-mono text-xs font-black border border-amber-800">
                      {safeText(adr.id, `ADR-0${idx + 1}`)}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 font-mono text-[10px] uppercase font-bold border border-slate-800">
                      {safeText(adr.category, 'architecture')}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono text-[10px] font-bold border border-emerald-800">
                    {safeText(adr.status, 'Accepted')}
                  </span>
                </div>

                <h4 className="text-xs font-bold text-white">{safeText(adr.decision || adr.title)}</h4>
                <p className="text-xs text-slate-400 leading-relaxed font-medium">
                  <span className="font-bold text-slate-300 font-mono">Why: </span>
                  {safeText(adr.rationale)}
                </p>

                {adr.tradeOffs && (
                  <div className="p-2.5 rounded-lg bg-slate-900 text-[11px] font-mono text-slate-300 border border-slate-800">
                    <span className="font-bold text-amber-400">Trade-Offs: </span>
                    {safeText(adr.tradeOffs)}
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
