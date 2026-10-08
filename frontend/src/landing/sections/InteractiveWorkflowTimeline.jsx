import React, { useState } from 'react';
import {
  FolderPlus,
  UserPlus,
  Lightbulb,
  MessageSquare,
  ThumbsUp,
  Trophy,
  Zap,
  CheckSquare,
  Rocket,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

const TIMELINE_STEPS = [
  {
    num: 1,
    title: 'Create Workspace',
    icon: FolderPlus,
    short: 'Setup team hub',
    detail: 'Initialize your dedicated team workspace in seconds with custom limits and settings.',
  },
  {
    num: 2,
    title: 'Invite Team',
    icon: UserPlus,
    short: 'Join via code',
    detail: 'Share your 6-character Join Code to get all teammates into the live ideation room.',
  },
  {
    num: 3,
    title: 'Brainstorm',
    icon: Lightbulb,
    short: 'Pitch proposals',
    detail: 'Submit raw problem statements, tech stacks, and solution concepts concurrently.',
  },
  {
    num: 4,
    title: 'Suggestions',
    icon: MessageSquare,
    short: 'Peer feedback',
    detail: 'Add technical feedback, architectural suggestions, and refinements directly on proposal cards.',
  },
  {
    num: 5,
    title: 'Vote',
    icon: ThumbsUp,
    short: 'Live upvotes',
    detail: 'Cast upvotes transparently. Live leaderboard surfaces the team’s highest-rated proposals.',
  },
  {
    num: 6,
    title: 'Select MVP',
    icon: Trophy,
    short: 'Lock winner',
    detail: 'Workspace lead locks the winning proposal as the official project MVP.',
  },
  {
    num: 7,
    title: 'AI Blueprint',
    icon: Zap,
    short: 'Instant PRD',
    detail: 'AI Engine generates system architecture, database models, and API endpoints.',
  },
  {
    num: 8,
    title: 'Task Breakdown',
    icon: CheckSquare,
    short: 'Sprint tasks',
    detail: 'Auto-populated Kanban board assigns frontend, backend, and integration task cards to team members.',
  },
  {
    num: 9,
    title: 'Start Building',
    icon: Rocket,
    short: 'Ship MVP',
    detail: 'Write code with 100% architectural alignment and complete your submission on time.',
  },
];

export function InteractiveWorkflowTimeline() {
  const [activeIdx, setActiveIdx] = useState(6); // Default to AI Blueprint

  const activeStep = TIMELINE_STEPS[activeIdx];
  const ActiveIcon = activeStep.icon;

  return (
    <section className="py-24 bg-slate-950/95 border-b border-slate-800/80 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Section Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-primary-500/30 text-primary-300 text-xs font-mono font-bold">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Interactive Process Navigator</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Complete Product Workflow
          </h2>

          <p className="text-base text-slate-400 font-medium">
            Click any step to inspect how Convia guides your team from start to finish.
          </p>
        </div>

        {/* Desktop Horizontal Stepper Bar */}
        <div className="hidden lg:block relative py-4">
          {/* Connecting Line */}
          <div className="absolute top-1/2 left-4 right-4 h-1 bg-slate-800 -translate-y-1/2 -z-10 rounded-full" />
          <div
            className="absolute top-1/2 left-4 h-1 bg-gradient-to-r from-primary-600 to-primary-400 -translate-y-1/2 -z-10 rounded-full transition-all duration-300"
            style={{ width: `${(activeIdx / (TIMELINE_STEPS.length - 1)) * 95}%` }}
          />

          <div className="flex items-center justify-between">
            {TIMELINE_STEPS.map((s, idx) => {
              const isActive = idx === activeIdx;
              const StepIcon = s.icon;
              return (
                <button
                  key={s.num}
                  onClick={() => setActiveIdx(idx)}
                  className={`group flex flex-col items-center gap-2 focus:outline-none transition-all duration-200 ${
                    isActive ? 'scale-110' : 'hover:scale-105'
                  }`}
                >
                  <div
                    className={`h-11 w-11 rounded-2xl flex items-center justify-center border font-bold text-xs shadow-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-tr from-primary-600 to-primary-500 border-primary-400 text-white shadow-primary-500/40 ring-4 ring-primary-500/20'
                        : idx < activeIdx
                        ? 'bg-slate-900 border-primary-500/40 text-primary-400'
                        : 'bg-slate-950 border-slate-800 text-slate-500 group-hover:border-slate-700 group-hover:text-slate-300'
                    }`}
                  >
                    <StepIcon className="h-5 w-5" />
                  </div>
                  <span
                    className={`text-[11px] font-mono font-bold max-w-[80px] text-center leading-tight transition-colors ${
                      isActive ? 'text-white font-extrabold' : 'text-slate-400 group-hover:text-slate-300'
                    }`}
                  >
                    {s.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Mobile / Tablet Vertical Stepper */}
        <div className="lg:hidden grid grid-cols-3 sm:grid-cols-5 gap-2.5">
          {TIMELINE_STEPS.map((s, idx) => {
            const isActive = idx === activeIdx;
            const StepIcon = s.icon;
            return (
              <button
                key={s.num}
                onClick={() => setActiveIdx(idx)}
                className={`p-3 rounded-2xl border text-center flex flex-col items-center gap-1.5 transition-all ${
                  isActive
                    ? 'bg-primary-600/20 border-primary-500/50 text-white font-bold'
                    : 'bg-slate-900/60 border-slate-800/80 text-slate-400'
                }`}
              >
                <StepIcon className="h-4 w-4" />
                <span className="text-[10px] font-mono font-bold truncate w-full">{s.title}</span>
              </button>
            );
          })}
        </div>

        {/* Selected Step Detail Card */}
        <div className="p-8 sm:p-10 rounded-3xl bg-slate-900/90 border border-primary-500/40 shadow-2xl shadow-primary-950/40 max-w-3xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg">
                <ActiveIcon className="h-6 w-6" />
              </div>
              <div>
                <span className="text-xs font-mono font-extrabold text-primary-400">
                  STEP 0{activeStep.num} OF 09
                </span>
                <h3 className="text-2xl font-extrabold text-white">{activeStep.title}</h3>
              </div>
            </div>

            <span className="px-3 py-1 rounded-lg text-xs font-mono font-bold bg-slate-950 text-slate-300 border border-slate-800">
              {activeStep.short}
            </span>
          </div>

          <p className="text-sm text-slate-300 leading-relaxed font-medium pt-2">
            {activeStep.detail}
          </p>

          <div className="flex items-center justify-between pt-4 border-t border-slate-800/80 text-xs font-mono">
            <button
              disabled={activeIdx === 0}
              onClick={() => setActiveIdx((prev) => Math.max(0, prev - 1))}
              className="text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              &larr; Previous Step
            </button>
            <button
              disabled={activeIdx === TIMELINE_STEPS.length - 1}
              onClick={() => setActiveIdx((prev) => Math.min(TIMELINE_STEPS.length - 1, prev + 1))}
              className="text-primary-400 font-bold hover:text-primary-300 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              Next Step &rarr;
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
