import React from 'react';
import {
  Sparkles,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Clock,
  Cpu,
  Workflow,
  ShieldCheck,
  MessageSquare,
  Wand2,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

export const BLUEPRINT_GENERATION_STAGES = [
  { id: 'context_preparing', label: 'Analyzing Project & Context Assembly', shortLabel: '1. Context', icon: Wand2 },
  { id: 'ai_synthesis', label: 'AI Synthesis (Google Gemini 2.0)', shortLabel: '2. Synthesis', icon: Cpu },
  { id: 'validating_schema', label: 'Validating Schema 2 & Dependency Graph', shortLabel: '3. Validation', icon: ShieldCheck },
  { id: 'persisting', label: 'Persisting Version & Archiving History', shortLabel: '4. Persistence', icon: CheckCircle2 },
];

export function BlueprintGenerationProgress({
  isGenerating,
  generationStage = null,
  generationStageIndex = 0,
  failedStage = null,
  isFailed,
  isStale,
  errorMessage,
  onRetry,
  onRecover,
  isRecovering = false,
}) {
  // Resolve stage index from stage ID or numeric index
  const activeIndex = React.useMemo(() => {
    if (generationStage) {
      const idx = BLUEPRINT_GENERATION_STAGES.findIndex((s) => s.id === generationStage);
      if (idx !== -1) return idx;
    }
    return Math.min(Math.max(0, generationStageIndex), BLUEPRINT_GENERATION_STAGES.length - 1);
  }, [generationStage, generationStageIndex]);

  const userFriendlyError = React.useMemo(() => {
    if (!errorMessage) return 'The AI generation request was interrupted or timed out. You can safely retry.';
    if (
      errorMessage.includes('set failed') ||
      errorMessage.includes('undefined in property') ||
      errorMessage.includes('blueprints.') ||
      errorMessage.includes('databaseURL')
    ) {
      return 'Blueprint generation could not be saved to workspace database. Your previous Blueprint is safe. Click Retry Generation to try again.';
    }
    return errorMessage;
  }, [errorMessage]);

  const failedStageLabel = React.useMemo(() => {
    if (!failedStage) return null;
    const stage = BLUEPRINT_GENERATION_STAGES.find((s) => s.id === failedStage);
    return stage ? stage.label : failedStage;
  }, [failedStage]);

  if (isFailed) {
    return (
      <Card className="p-6 bg-rose-950/40 border border-rose-800 text-rose-200 space-y-4 shadow-xl animate-fadeIn">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-900/60 border border-rose-700 shrink-0">
              <AlertTriangle className="h-5 w-5 text-rose-300" />
            </div>
            <div className="space-y-0.5">
              <h4 className="text-sm font-extrabold text-white">
                {failedStageLabel ? `Generation Failed at: ${failedStageLabel}` : 'Blueprint Generation Did Not Complete'}
              </h4>
              <p className="text-xs text-rose-300 leading-relaxed font-medium">
                {userFriendlyError}
              </p>
            </div>
          </div>

          <Button
            variant="primary"
            size="sm"
            icon={<RotateCcw className="h-4 w-4" />}
            onClick={onRetry}
            className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2 px-4 shadow-md shrink-0"
          >
            Retry Generation
          </Button>
        </div>
      </Card>
    );
  }

  if (isStale) {
    return (
      <Card className="p-6 bg-amber-950/40 border border-amber-800 text-amber-200 space-y-4 shadow-xl animate-fadeIn">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-900/60 border border-amber-700 shrink-0">
              <Clock className="h-5 w-5 text-amber-300" />
            </div>
            <div className="space-y-0.5">
              <h4 className="text-sm font-extrabold text-white">Previous Generation Stalled</h4>
              <p className="text-xs text-amber-300 leading-relaxed font-medium">
                A previous generation attempt appears to have taken longer than expected. You can rescue the Blueprint state.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={onRecover}
              isLoading={isRecovering}
              className="border-amber-700 bg-amber-900/50 hover:bg-amber-800 text-white text-xs font-bold py-2 px-3"
            >
              Rescue State
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={onRetry}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-2 px-4 shadow-md"
            >
              Fresh Generation
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  if (isGenerating) {
    const currentStage = BLUEPRINT_GENERATION_STAGES[activeIndex] || BLUEPRINT_GENERATION_STAGES[0];
    const Icon = currentStage.icon;

    return (
      <Card className="p-8 bg-slate-900 border border-primary-800 shadow-2xl space-y-6 animate-fadeIn">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-950 border border-primary-700 text-primary-300 animate-pulse">
              <Icon className="h-6 w-6" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase text-primary-400">
                  Stage {activeIndex + 1} of {BLUEPRINT_GENERATION_STAGES.length}
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-primary-400 animate-ping" />
              </div>
              <h3 className="text-base font-black text-white">
                {currentStage.label}
              </h3>
            </div>
          </div>

          <div className="text-right font-mono text-xs text-primary-300">
            <span>Executing Generation Stage...</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
            <div
              className="h-full bg-gradient-to-r from-primary-600 to-primary-500 rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${Math.min(100, Math.max(15, ((activeIndex + 1) / BLUEPRINT_GENERATION_STAGES.length) * 100))}%`,
              }}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
            {BLUEPRINT_GENERATION_STAGES.map((stage, idx) => (
              <div
                key={stage.id || idx}
                className={`p-2.5 rounded-xl border text-xs font-mono transition-all flex items-center gap-2 ${
                  idx < activeIndex
                    ? 'bg-emerald-950/30 text-emerald-300 border-emerald-800/60 font-bold'
                    : idx === activeIndex
                    ? 'bg-primary-950 text-primary-200 border-primary-700 font-bold shadow-md'
                    : 'bg-slate-950/40 text-slate-500 border-slate-900'
                }`}
              >
                {idx < activeIndex ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                ) : idx === activeIndex ? (
                  <span className="h-2 w-2 rounded-full bg-primary-400 animate-ping shrink-0" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-slate-700 shrink-0" />
                )}
                <span className="truncate">{stage.shortLabel}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  return null;
}
