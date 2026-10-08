import React from 'react';
import { MessageSquare, FileText, Zap, Check, AlertCircle, Sparkles } from 'lucide-react';

export function ToolComparisonSection() {
  return (
    <section className="py-24 bg-slate-950 border-b border-slate-800/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Section Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-primary-500/30 text-primary-300 text-xs font-mono font-bold">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Factual Tool Comparison</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Right Tool for the Right Purpose
          </h2>

          <p className="text-base text-slate-400 font-medium">
            We love Discord and Notion. But when 36 hours start ticking down, you need a purpose-built decision engine.
          </p>
        </div>

        {/* 3 Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Discord Card */}
          <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 shadow-xl space-y-6 flex flex-col justify-between transition-all duration-300">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-2xl bg-primary-500/10 text-primary-400 border border-primary-500/20">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-slate-950 text-slate-400 border border-slate-800">
                  COMMUNICATION
                </span>
              </div>

              <h3 className="text-2xl font-extrabold text-white">Discord</h3>
              <p className="text-xs font-mono text-primary-400 font-bold">Best at real-time audio & team chat</p>

              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                Great for casual conversation, but unstructured chat threads make proposal prioritization difficult.
              </p>

              <div className="space-y-2.5 pt-2 border-t border-slate-800/80 text-xs font-medium text-slate-400">
                <div className="flex items-start gap-2 text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Ideas disappear inside long chat streams</span>
                </div>
                <div className="flex items-start gap-2 text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Technical discussions mix with casual banter</span>
                </div>
                <div className="flex items-start gap-2 text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Final decisions are difficult to locate</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notion Card */}
          <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 shadow-xl space-y-6 flex flex-col justify-between transition-all duration-300">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <FileText className="h-6 w-6" />
                </div>
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-slate-950 text-slate-400 border border-slate-800">
                  DOCUMENTATION
                </span>
              </div>

              <h3 className="text-2xl font-extrabold text-white">Notion</h3>
              <p className="text-xs font-mono text-amber-400 font-bold">Excellent at wiki docs & database notes</p>

              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                Powerful for long-term wikis, but blank pages force teams to spend time building templates.
              </p>

              <div className="space-y-2.5 pt-2 border-t border-slate-800/80 text-xs font-medium text-slate-400">
                <div className="flex items-start gap-2 text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Requires extensive manual database setup</span>
                </div>
                <div className="flex items-start gap-2 text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Blank page syndrome slows initial momentum</span>
                </div>
                <div className="flex items-start gap-2 text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Waste precious hours organizing structure</span>
                </div>
              </div>
            </div>
          </div>

          {/* Convia Card */}
          <div className="p-8 rounded-3xl bg-gradient-to-b from-primary-950/80 via-slate-900 to-primary-900/60 border border-primary-500/50 shadow-2xl shadow-primary-950/40 space-y-6 flex flex-col justify-between transform hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-primary-500/20 text-primary-300 border border-primary-500/40">
                Purpose-Built
              </span>
            </div>

            <div className="space-y-4">
              <div className="p-3 rounded-2xl bg-primary-600 text-white shadow-lg shadow-primary-500/30 w-fit">
                <Zap className="h-6 w-6 fill-current" />
              </div>

              <h3 className="text-2xl font-extrabold text-white">Convia</h3>
              <p className="text-xs font-mono text-primary-300 font-bold">Purpose-built for engineering decision speed</p>

              <p className="text-xs text-slate-200 leading-relaxed font-medium">
                Structured ideation, peer refinement, upvoting, AI blueprints, and Kanban task breakdown—in one seamless flow.
              </p>

              <div className="space-y-2.5 pt-2 border-t border-primary-800/60 text-xs font-semibold text-slate-100">
                <div className="flex items-start gap-2 text-emerald-400">
                  <Check className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Structured proposal submission & upvoting</span>
                </div>
                <div className="flex items-start gap-2 text-emerald-400">
                  <Check className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Instant AI Technical PRD & schema generation</span>
                </div>
                <div className="flex items-start gap-2 text-emerald-400">
                  <Check className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Auto-populated Kanban tasks ready for sprint</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
