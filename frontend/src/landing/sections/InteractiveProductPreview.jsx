import React, { useState } from 'react';
import { Briefcase, Trophy, Zap, CheckSquare, Sparkles } from 'lucide-react';
import { WorkspacePreview } from '../components/previews/WorkspacePreview';
import { MvpPreview } from '../components/previews/MvpPreview';
import { BlueprintPreview } from '../components/previews/BlueprintPreview';
import { TasksPreview } from '../components/previews/TasksPreview';

const TABS = [
  { id: 'workspace', label: 'Workspace Hub', icon: Briefcase, component: WorkspacePreview },
  { id: 'mvp', label: 'MVP Selection', icon: Trophy, component: MvpPreview },
  { id: 'blueprint', label: 'AI Blueprint', icon: Zap, component: BlueprintPreview },
  { id: 'tasks', label: 'Tasks Board', icon: CheckSquare, component: TasksPreview },
];

export function InteractiveProductPreview() {
  const [activeTabId, setActiveTabId] = useState('workspace');

  const activeTab = TABS.find((t) => t.id === activeTabId) || TABS[0];
  const ActiveComponent = activeTab.component;

  return (
    <section id="how-it-works" className="py-24 bg-slate-950 border-b border-slate-800/80 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/3 right-1/4 h-96 w-96 rounded-full bg-primary-600/10 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Section Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-primary-500/30 text-primary-300 text-xs font-mono font-bold">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Interactive Product Tour</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Experience Convia Before You Sign In
          </h2>

          <p className="text-base text-slate-400 font-medium">
            Explore the complete workflow—from brainstorming to execution—in one unified platform.
          </p>
        </div>

        {/* Desktop & Mobile Interactive Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Navigation Tabs */}
          <div className="lg:col-span-4 flex flex-row lg:flex-col gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-none">
            {TABS.map((tab) => {
              const isActive = tab.id === activeTabId;
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTabId(tab.id)}
                  className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left text-sm font-bold transition-all duration-200 shrink-0 lg:shrink ${
                    isActive
                      ? 'bg-gradient-to-r from-primary-600/20 to-primary-700/20 border-primary-500 text-white shadow-lg shadow-primary-950/40 ring-1 ring-primary-500/30'
                      : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-900 hover:border-slate-700'
                  }`}
                >
                  <div
                    className={`p-2 rounded-xl border ${
                      isActive
                        ? 'bg-primary-600 text-white border-primary-500'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    <TabIcon className="h-4 w-4" />
                  </div>
                  <span className="whitespace-nowrap">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right: Interactive Product Mockup */}
          <div className="lg:col-span-8">
            <div className="animate-in fade-in zoom-in-95 duration-300">
              <ActiveComponent />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
