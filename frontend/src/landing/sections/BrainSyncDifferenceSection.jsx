import React from 'react';
import { MessageSquare, Zap, FileText, GitBranch, ArrowRight, Sparkles } from 'lucide-react';

const PIPELINE_NODES = [
  {
    tool: 'Discord',
    action: 'COMMUNICATES',
    role: 'Real-time team chat & voice sync',
    icon: MessageSquare,
    color: 'border-primary-500/30 text-primary-400 bg-primary-500/10',
  },
  {
    tool: 'Convia',
    action: 'DECIDES',
    role: 'Ideation, voting & AI technical blueprint',
    icon: Zap,
    highlight: true,
    color: 'border-primary-500/50 text-primary-300 bg-primary-600 shadow-xl shadow-primary-500/30',
  },
  {
    tool: 'Notion',
    action: 'DOCUMENTS',
    role: 'Wiki docs & long-term knowledge base',
    icon: FileText,
    color: 'border-amber-500/30 text-amber-400 bg-amber-500/10',
  },
  {
    tool: 'GitHub',
    action: 'BUILDS',
    role: 'Source code, PRs & CI/CD deployment',
    icon: GitBranch,
    color: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10',
  },
];

export function ConviaDifferenceSection() {
  return (
    <section className="py-24 bg-slate-950 border-b border-slate-800/80 relative overflow-hidden">
      {/* Background Radial Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-6xl h-96 bg-primary-600/10 blur-3xl pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Section Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 font-mono text-xs font-bold uppercase tracking-wider">
            <span>Workflow Position</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Convia Doesn&apos;t Replace Your Tools. <br />
            <span className="bg-gradient-to-r from-primary-300 via-primary-200 to-primary-400 bg-clip-text text-transparent">
              It Decides What Deserves To Be Built.
            </span>
          </h2>

          <p className="text-base sm:text-lg text-slate-300 font-medium">
            Convia bridges the critical gap between team communication and source code execution.
          </p>
        </div>

        {/* Comparison Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PIPELINE_NODES.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className={`p-6 rounded-3xl border transition-all duration-200 ${
                  item.highlight
                    ? 'bg-slate-900/90 border-primary-500/50 shadow-xl shadow-primary-950/40 ring-1 ring-primary-500/30'
                    : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${item.color}`}>
                      {item.action}
                    </span>
                    <Icon className="h-5 w-5 text-slate-400" />
                  </div>

                  <div>
                    <h3 className="text-xl font-extrabold text-white">{item.tool}</h3>
                    <p className="text-xs text-slate-400 font-medium mt-1">{item.role}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Explanation Banner */}
        <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800/80 text-center max-w-2xl mx-auto space-y-2">
          <p className="text-sm text-slate-200 font-semibold">
            <strong className="text-primary-300">Discord</strong> communicates &bull; <strong className="text-primary-400">Convia</strong> decides &bull; <strong className="text-amber-400">Notion</strong> documents &bull; <strong className="text-emerald-400">GitHub</strong> builds.
          </p>
        </div>
      </div>
    </section>
  );
}

export function BrainSyncDifferenceSection() {
  return <ConviaDifferenceSection />;
}
