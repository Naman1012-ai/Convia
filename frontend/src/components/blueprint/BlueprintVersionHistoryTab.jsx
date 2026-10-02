import React, { useState } from 'react';
import {
  History,
  Clock,
  Sparkles,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Layers,
  FileText,
  Workflow,
  CheckSquare,
  MessageSquare,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { formatTimestamp } from '../../utils/formatting';
import { safeText, safeArray } from '../../utils/safeRender';

export function BlueprintVersionHistoryTab({
  versions = [],
  currentVersion,
  selectedVersionKey,
  onSelectVersion,
  onReturnToCurrentVersion,
  onActivateVersion,
  isActivatingVersion,
  currentBlueprint,
}) {
  const [comparingVersionKey, setComparingVersionKey] = useState(null);

  const versionsList = safeArray(versions);
  const selectedVersionDoc = versionsList.find((v) => v.key === (comparingVersionKey || selectedVersionKey));
  const activeVerStr = safeText(currentVersion, '1.0');

  return (
    <div className="space-y-6">
      {/* 1. VERSION TIMELINE */}
      <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <History className="h-4 w-4 text-primary-400" /> Blueprint Version History ({versionsList.length})
            </h3>
            <p className="text-xs text-slate-400">Immutable snapshots of previous AI generations, manual edits, and active versions</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-primary-300 font-bold bg-primary-950 px-2.5 py-1 rounded-lg border border-primary-800">
              Active: Version {activeVerStr}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {versionsList.map((ver, idx) => {
            const verNumber = safeText(ver.version, '1.0');
            const isCurrent = verNumber === activeVerStr && !selectedVersionKey;
            const isSelected = selectedVersionKey === ver.key;
            const parentVer = ver.parentVersion || ver.lineage?.parentVersion;

            return (
              <div
                key={ver.key || idx}
                className={`p-4 rounded-xl border transition-all space-y-2.5 ${
                  isSelected
                    ? 'bg-primary-950/40 border-primary-600 shadow-md shadow-primary-950/50'
                    : isCurrent
                    ? 'bg-slate-950 border-emerald-800/80'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-lg bg-primary-950 text-primary-300 font-mono text-xs font-black border border-primary-800">
                      v{verNumber}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                      ver.lastModifiedSource === 'manual'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : 'bg-primary-950 text-primary-300 border border-primary-800'
                    }`}>
                      {ver.lastModifiedSource === 'manual' ? 'Manual Edit' : 'AI Generation'}
                    </span>
                    {parentVer && (
                      <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-400 font-mono text-[10px] border border-slate-800">
                        Parent: v{parentVer}
                      </span>
                    )}
                    {isCurrent && (
                      <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono text-[10px] font-bold border border-emerald-800">
                        Current Active
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-slate-400">
                      {formatTimestamp(ver.updatedAt || ver.createdAt)}
                    </span>

                    {!isCurrent && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onSelectVersion && onSelectVersion(ver.key)}
                        className={`text-xs font-bold py-1 px-2.5 h-7 ${
                          isSelected ? 'border-primary-600 bg-primary-900/60 text-white' : 'border-slate-800 text-slate-300'
                        }`}
                      >
                        {isSelected ? 'Viewing' : 'Preview Snapshot'}
                      </Button>
                    )}

                    {isSelected && !isCurrent && onActivateVersion && (
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                        isLoading={isActivatingVersion}
                        onClick={() => onActivateVersion(ver.key)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-1 px-3 h-7 shadow-sm"
                      >
                        Set as Active
                      </Button>
                    )}
                  </div>
                </div>

                {ver.summary && (
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    {safeText(ver.summary)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* 2. VERSION COMPARISON DIFF SUMMARY */}
      {selectedVersionDoc && (
        <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Layers className="h-4 w-4 text-emerald-400" /> Comparison: Version {safeText(selectedVersionDoc.version)} vs Active (v{activeVerStr})
            </h3>

            {onActivateVersion && safeText(selectedVersionDoc.version) !== activeVerStr && (
              <Button
                variant="primary"
                size="sm"
                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                isLoading={isActivatingVersion}
                onClick={() => onActivateVersion(selectedVersionDoc.key)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
              >
                Promote to Active Blueprint
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-500 font-bold uppercase text-[10px]">Requirements</span>
              <div className="text-white font-bold">
                {safeArray(selectedVersionDoc.content?.requirements).length} Defined
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-500 font-bold uppercase text-[10px]">Features</span>
              <div className="text-white font-bold">
                {safeArray(selectedVersionDoc.content?.execution?.features || selectedVersionDoc.content?.coreFeatures).length} Modules
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-500 font-bold uppercase text-[10px]">Tasks</span>
              <div className="text-white font-bold">
                {safeArray(selectedVersionDoc.content?.execution?.tasks).length} Tasks
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-500 font-bold uppercase text-[10px]">Decisions</span>
              <div className="text-white font-bold">
                {safeArray(selectedVersionDoc.content?.intelligence?.discussionIntelligence?.decisions).length} Traceable
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
