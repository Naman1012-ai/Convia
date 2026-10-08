import React, { useState, useEffect } from 'react';
import {
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

const STAGES = [
  {
    id: 'idea',
    step: '01',
    title: 'Idea Proposal',
    icon: Lightbulb,
    badge: 'Ideation',
    color: 'from-amber-500 to-orange-500',
    borderColor: 'border-amber-500/30',
    bgGlow: 'shadow-amber-500/20',
    description: 'Team members submit raw problem statements and innovative solution proposals.',
    cardContent: {
      title: 'AI Code Reviewer & Auto Synthesizer',
      author: 'Alex Chen',
      tags: ['AI Agent', 'Python', 'FastAPI'],
      metrics: '3 Initial Submissions',
    },
  },
  {
    id: 'suggestions',
    step: '02',
    title: 'Peer Refinement',
    icon: MessageSquare,
    badge: 'Discussions',
    color: 'from-sky-500 to-blue-500',
    borderColor: 'border-sky-500/30',
    bgGlow: 'shadow-sky-500/20',
    description: 'Teammates add feedback, technical suggestions, and architectural refinements.',
    cardContent: {
      title: 'Add support for WebSockets streaming',
      author: 'Sarah Jenkins',
      comment: 'We can connect this directly to the Firebase Realtime listener for low-latency diffs.',
      metrics: '14 Active Threads',
    },
  },
  {
    id: 'voting',
    step: '03',
    title: 'Consensus Voting',
    icon: ThumbsUp,
    badge: 'Democratic',
    color: 'from-primary-600 to-primary-500',
    borderColor: 'border-primary-500/30',
    bgGlow: 'shadow-primary-500/20',
    description: 'Real-time upvoting surface elevates high-impact proposals with transparent community metrics.',
    cardContent: {
      title: 'Upvote Count',
      votes: '+28 Upvotes',
      topRank: '#1 Trending Proposal',
      metrics: '100% Team Participation',
    },
  },
  {
    id: 'mvp',
    step: '04',
    title: 'Selected MVP',
    icon: Trophy,
    badge: 'Winner Selected',
    color: 'from-emerald-500 to-teal-500',
    borderColor: 'border-emerald-500/30',
    bgGlow: 'shadow-emerald-500/20',
    description: 'Workspace lead locks the selected proposal as the official team MVP project.',
    cardContent: {
      title: 'Convia AI Blueprint Generator',
      status: 'MVP Locked',
      lead: 'Project Lead Approved',
      metrics: 'Sprint Roadmap Locked',
    },
  },
  {
    id: 'blueprint',
    step: '05',
    title: 'AI Blueprint',
    icon: Zap,
    badge: 'AI Engine',
    color: 'from-primary-500 to-pink-500',
    borderColor: 'border-primary-500/30',
    bgGlow: 'shadow-primary-500/20',
    description: 'AI instantly generates architectural specs, database models, API endpoints, and PRD.',
    cardContent: {
      techStack: 'React 19 + Tailwind v4 + Firebase RTDB',
      endpoints: 'API Endpoints & Schemas',
      dbSchema: 'Structured Database Models',
      metrics: 'Automated AI Spec',
    },
  },
  {
    id: 'tasks',
    step: '06',
    title: 'Task Breakdown',
    icon: CheckSquare,
    badge: 'Sprint Ready',
    color: 'from-rose-500 to-pink-500',
    borderColor: 'border-rose-500/30',
    bgGlow: 'shadow-rose-500/20',
    description: 'Auto-populated Kanban board assigns frontend, backend, and integration tasks to members.',
    cardContent: {
      task1: '✓ Setup Auth & Security Rules',
      task2: '⚡ Build Real-Time Discussion Panel',
      task3: '📋 Implement Dashboard KPI Telemetry',
      metrics: '8 Sprint Cards Assigned',
    },
  },
  {
    id: 'build',
    step: '07',
    title: 'Ship & Launch',
    icon: Rocket,
    badge: 'Production Launch',
    color: 'from-amber-400 via-orange-500 to-rose-500',
    borderColor: 'border-amber-400/40',
    bgGlow: 'shadow-amber-500/30',
    description: 'Track live progress, run quality checks, and deploy a polished production MVP on schedule.',
    cardContent: {
      title: 'Production MVP Ready',
      completion: '100% Sprint Complete',
      verdict: '🚀 Ready for Production Deployment',
      metrics: 'Target Achieved',
    },
  },
];

export function WorkflowVisualizer() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % STAGES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const activeStage = STAGES[activeIdx];
  const IconComp = activeStage.icon;

  return (
    <div
      className="relative rounded-3xl border border-slate-800 bg-slate-950/90 p-6 sm:p-8 shadow-2xl shadow-primary-950/40 backdrop-blur-xl overflow-hidden"
      onMouseEnter={() => setIsAutoPlaying(false)}
      onMouseLeave={() => setIsAutoPlaying(true)}
    >
      {/* Background Glow */}
      <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary-600/15 blur-3xl pointer-events-none" />
      <div className="absolute -left-20 -bottom-20 h-72 w-72 rounded-full bg-primary-700/15 blur-3xl pointer-events-none" />

      {/* Header & Stage Stepper */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-primary-400 uppercase tracking-widest mb-1">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Interactive Workflow Engine</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-extrabold text-white">
            From Idea to Shipped Product
          </h3>
        </div>

        {/* Stage Indicator Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {STAGES.map((stg, idx) => {
            const isActive = idx === activeIdx;
            const StgIcon = stg.icon;
            return (
              <button
                key={stg.id}
                onClick={() => {
                  setActiveIdx(idx);
                  setIsAutoPlaying(false);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-md shadow-primary-500/25 scale-105'
                    : 'bg-slate-900/90 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800/80'
                }`}
              >
                <StgIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{stg.title}</span>
                <span className="sm:hidden">{stg.step}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Dynamic Main Visualization Display */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-8">
        {/* Left: Stage Description */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-extrabold bg-slate-900 text-primary-400 border border-slate-800">
              STAGE {activeStage.step}
            </span>
            <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold uppercase bg-slate-900 border ${activeStage.borderColor} text-slate-200`}>
              {activeStage.badge}
            </span>
          </div>

          <h4 className="text-2xl font-extrabold text-white flex items-center gap-3">
            <div className={`p-2 rounded-xl bg-gradient-to-r ${activeStage.color} text-white shadow-lg`}>
              <IconComp className="h-5 w-5" />
            </div>
            <span>{activeStage.title}</span>
          </h4>

          <p className="text-sm text-slate-300 leading-relaxed font-medium">
            {activeStage.description}
          </p>

          <div className="pt-2 flex items-center gap-2 text-xs font-mono text-slate-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{activeStage.cardContent.metrics}</span>
          </div>
        </div>

        {/* Right: Floating Animated Mockup Card */}
        <div className="lg:col-span-7">
          <div className={`relative p-6 sm:p-7 rounded-2xl bg-slate-900/90 border ${activeStage.borderColor} shadow-2xl ${activeStage.bgGlow} transition-all duration-300 transform`}>
            {/* Stage-specific Interactive Card Layout */}
            {activeStage.id === 'idea' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span>Author: {activeStage.cardContent.author}</span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">Proposal</span>
                </div>
                <h5 className="text-base font-extrabold text-white">{activeStage.cardContent.title}</h5>
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  {activeStage.cardContent.tags.map((t) => (
                    <span key={t} className="px-2.5 py-0.5 rounded-md text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {activeStage.id === 'suggestions' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span>Peer Refinement</span>
                  <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">Active Thread</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
                    <span>{activeStage.cardContent.author}</span>
                    <span className="text-[10px]">Just now</span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed font-medium">
                    &ldquo;{activeStage.cardContent.comment}&rdquo;
                  </p>
                </div>
              </div>
            )}

            {activeStage.id === 'voting' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-400">{activeStage.cardContent.topRank}</span>
                  <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-primary-500/20 text-primary-300 border border-primary-500/30">
                    {activeStage.cardContent.votes}
                  </span>
                </div>
                <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800 p-0.5">
                  <div className="bg-gradient-to-r from-primary-600 to-primary-400 h-full rounded-full w-[85%] transition-all duration-500" />
                </div>
              </div>
            )}

            {activeStage.id === 'mvp' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-emerald-400 font-bold">{activeStage.cardContent.status}</span>
                  <span className="text-slate-400">{activeStage.cardContent.lead}</span>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/60 to-slate-950 border border-emerald-500/30 text-white font-extrabold text-sm flex items-center justify-between">
                  <span>{activeStage.cardContent.title}</span>
                  <Trophy className="h-5 w-5 text-emerald-400" />
                </div>
              </div>
            )}

            {activeStage.id === 'blueprint' && (
              <div className="space-y-3 font-mono text-xs">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-slate-500 font-bold">TECH STACK:</span>
                  <p className="text-primary-300 font-semibold">{activeStage.cardContent.techStack}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
                    {activeStage.cardContent.endpoints}
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
                    {activeStage.cardContent.dbSchema}
                  </div>
                </div>
              </div>
            )}

            {activeStage.id === 'tasks' && (
              <div className="space-y-2.5 text-xs font-medium">
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-emerald-400 font-bold">
                  {activeStage.cardContent.task1}
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-amber-300 font-bold">
                  {activeStage.cardContent.task2}
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-bold">
                  {activeStage.cardContent.task3}
                </div>
              </div>
            )}

            {activeStage.id === 'build' && (
              <div className="space-y-4 text-center py-2">
                <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-1">
                  <Rocket className="h-8 w-8 animate-bounce" />
                </div>
                <h5 className="text-base font-extrabold text-white">{activeStage.cardContent.title}</h5>
                <p className="text-xs text-emerald-400 font-mono font-bold">{activeStage.cardContent.verdict}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
