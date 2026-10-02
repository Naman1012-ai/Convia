import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  X,
  FileText,
  Workflow,
  CheckSquare,
  Cpu,
  ShieldAlert,
  MessageSquare,
  HelpCircle,
  RotateCcw,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { safeText, safeArray } from '../../utils/safeRender';

/**
 * Global Blueprint 2.0 Search Modal.
 * Allows searching across Requirements, Features, Tasks, Decisions, Questions, Risks, and Milestones.
 */
export function BlueprintSearchModal({
  isOpen,
  onClose,
  blueprintContent,
  onSelectEntity,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const allEntities = useMemo(() => {
    if (!blueprintContent) return [];
    const v2 = blueprintContent.rawV2Content || blueprintContent.__v2Content || blueprintContent;
    const items = [];

    // 1. Requirements
    safeArray(v2.requirements).forEach((r, idx) => {
      items.push({
        id: safeText(r.id, `REQ-0${idx + 1}`),
        type: 'requirement',
        title: safeText(r.title),
        description: safeText(r.description),
        priority: safeText(r.priority, 'Must Have'),
        status: safeText(r.status),
        badgeColor: 'blue',
        icon: FileText,
        raw: r,
      });
    });

    // 2. Features
    safeArray(v2.execution?.features || v2.features).forEach((f, idx) => {
      items.push({
        id: safeText(f.id, `FEAT-0${idx + 1}`),
        type: 'feature',
        title: safeText(f.name || f.featureName || f.title),
        description: safeText(f.description),
        priority: safeText(f.priority, 'Must Have'),
        status: safeText(f.status),
        badgeColor: 'primary',
        icon: Workflow,
        raw: f,
      });
    });

    // 3. Tasks
    safeArray(v2.execution?.tasks || v2.tasks).forEach((t, idx) => {
      items.push({
        id: safeText(t.id, `TASK-0${idx + 1}`),
        type: 'task',
        title: safeText(t.title),
        description: safeText(t.description),
        priority: safeText(t.priority, 'Medium'),
        status: safeText(t.status, 'Todo'),
        badgeColor: 'emerald',
        icon: CheckSquare,
        raw: t,
      });
    });

    // 4. Decisions
    safeArray(v2.intelligence?.discussionIntelligence?.decisions || v2.decisions).forEach((d, idx) => {
      items.push({
        id: safeText(d.id, `DEC-0${idx + 1}`),
        type: 'decision',
        title: safeText(d.title || d.decision),
        description: safeText(d.rationale || d.decision),
        priority: safeText(d.category, 'architecture'),
        status: safeText(d.status, 'proposed'),
        badgeColor: 'amber',
        icon: MessageSquare,
        raw: d,
      });
    });

    // 5. Questions
    safeArray(v2.intelligence?.discussionIntelligence?.unresolvedQuestions || v2.questions).forEach((q, idx) => {
      items.push({
        id: safeText(q.id, `Q-0${idx + 1}`),
        type: 'question',
        title: safeText(q.question || q.content),
        description: safeText(q.recommendedNextAction || q.suggestedResolution),
        priority: q.isBlocking ? 'Blocking' : safeText(q.category, 'general'),
        status: safeText(q.status, 'open'),
        badgeColor: q.isBlocking ? 'rose' : 'primary',
        icon: HelpCircle,
        raw: q,
      });
    });

    // 6. Risks
    safeArray(v2.quality?.risks || v2.risks).forEach((rk, idx) => {
      items.push({
        id: safeText(rk.id, `RISK-0${idx + 1}`),
        type: 'risk',
        title: safeText(rk.title || rk.challenge),
        description: safeText(rk.mitigation || rk.description),
        priority: safeText(rk.severity || rk.impact, 'Medium'),
        status: safeText(rk.status, 'identified'),
        badgeColor: 'rose',
        icon: ShieldAlert,
        raw: rk,
      });
    });

    // 7. Change Recommendations
    safeArray(v2.intelligence?.discussionIntelligence?.changeRecommendations || v2.changeRecommendations).forEach((cr, idx) => {
      items.push({
        id: safeText(cr.id, `CR-0${idx + 1}`),
        type: 'change_recommendation',
        title: `${safeText(cr.changeType).toUpperCase()} ${safeText(cr.targetType)} ${safeText(cr.targetId)}`,
        description: safeText(cr.proposedChange || cr.reason),
        priority: safeText(cr.impactSeverity, 'Medium'),
        status: safeText(cr.status, 'proposed'),
        badgeColor: 'primary',
        icon: RotateCcw,
        raw: cr,
      });
    });

    return items;
  }, [blueprintContent]);

  const filteredResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allEntities.filter((item) => {
      if (selectedCategory !== 'all' && item.type !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      return (
        item.id.toLowerCase().includes(q) ||
        item.title?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.type?.toLowerCase().includes(q) ||
        item.priority?.toLowerCase().includes(q) ||
        item.status?.toLowerCase().includes(q)
      );
    });
  }, [allEntities, searchQuery, selectedCategory]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Header */}
        <div className="p-4 border-b border-slate-800 flex items-center gap-3 bg-slate-950/60">
          <Search className="h-5 w-5 text-primary-400 shrink-0" />
          <input
            type="text"
            placeholder="Search requirements, features, tasks, decisions, questions, risks... (Type ID or keyword)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            className="w-full bg-transparent border-none text-sm text-white placeholder-slate-500 focus:outline-none font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="px-2.5 py-1 text-xs font-mono rounded-lg bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
          >
            ESC
          </button>
        </div>

        {/* Filter Pills */}
        <div className="px-4 py-2.5 border-b border-slate-800/80 bg-slate-900/90 flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: 'all', label: 'All Entities' },
            { id: 'requirement', label: 'Requirements' },
            { id: 'feature', label: 'Features' },
            { id: 'task', label: 'Tasks' },
            { id: 'decision', label: 'Decisions' },
            { id: 'question', label: 'Questions' },
            { id: 'risk', label: 'Risks' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold font-mono transition-all whitespace-nowrap ${
                selectedCategory === cat.id
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              {cat.label}
            </button>
          ))}
          <span className="ml-auto text-[11px] font-mono text-slate-500 shrink-0">
            {filteredResults.length} matches
          </span>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 divide-y divide-slate-800/40">
          {filteredResults.length > 0 ? (
            filteredResults.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={`${item.type}-${item.id}`}
                  onClick={() => {
                    onSelectEntity(item);
                    onClose();
                  }}
                  className="pt-2.5 first:pt-0 group flex items-start justify-between gap-3 p-3 rounded-xl hover:bg-slate-800/60 cursor-pointer transition-all border border-transparent hover:border-slate-700/80"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-950 border border-slate-800 text-primary-400 group-hover:text-primary-300 group-hover:border-primary-800 shrink-0">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-black text-primary-300">
                          {item.id}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 font-mono text-[10px] uppercase font-bold border border-slate-800">
                          {item.type.replace('_', ' ')}
                        </span>
                        {item.priority && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                            item.priority === 'Critical' || item.priority === 'Blocking' || item.priority === 'High'
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : 'bg-slate-950 text-slate-300 border border-slate-800'
                          }`}>
                            {item.priority}
                          </span>
                        )}
                        {item.status && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 font-mono text-[10px] uppercase border border-slate-800">
                            {item.status}
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-white group-hover:text-primary-200 transition-colors">
                        {item.title}
                      </h4>
                      {item.description && (
                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-primary-400 text-xs font-mono font-bold shrink-0 self-center">
                    <span>Inspect</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center space-y-2">
              <Search className="h-8 w-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400 font-medium">
                No entities found matching "{searchQuery}"
              </p>
              <p className="text-[11px] text-slate-500">
                Try searching for specific IDs like REQ-01, TASK-02, DEC-01, or general keywords.
              </p>
            </div>
          )}
        </div>

        {/* Footer Hint */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-500">
          <span>Navigate with ⬆⬇ and click to inspect details</span>
          <span>Convia Blueprint Control Center</span>
        </div>
      </div>
    </div>
  );
}
