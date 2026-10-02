import React, { useState, useMemo } from 'react';
import {
  FileText,
  Filter,
  Workflow,
  CheckSquare,
  MessageSquare,
  ArrowRight,
  ShieldCheck,
  Search,
  CheckCircle2,
  AlertCircle,
  Tag,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { safeText, safeArray } from '../../utils/safeRender';

export function BlueprintRequirementsTab({
  requirements = [],
  features = [],
  tasks = [],
  decisions = [],
  onInspectEntity,
}) {
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const reqsList = safeArray(requirements);
  const featsList = safeArray(features);
  const tasksList = safeArray(tasks);
  const decisionsList = safeArray(decisions);

  // Build lookup maps for traceability
  const featMap = useMemo(() => new Map(featsList.map((f) => [f.id, f])), [featsList]);
  const taskMap = useMemo(() => new Map(tasksList.map((t) => [t.id, t])), [tasksList]);

  const filteredRequirements = useMemo(() => {
    return reqsList.filter((req) => {
      const priority = safeText(req.priority, 'Must Have');
      const type = safeText(req.type, 'functional');
      if (priorityFilter !== 'all' && priority !== priorityFilter) return false;
      if (typeFilter !== 'all' && type !== typeFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const reqId = safeText(req.id).toLowerCase();
        const reqTitle = safeText(req.title).toLowerCase();
        const reqDesc = safeText(req.description).toLowerCase();
        return reqId.includes(q) || reqTitle.includes(q) || reqDesc.includes(q);
      }
      return true;
    });
  }, [reqsList, priorityFilter, typeFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Filter & Search Bar */}
      <Card className="p-5 bg-slate-900 border border-slate-800 space-y-4 shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary-400" /> Canonical Project Requirements ({reqsList.length})
            </h3>
            <p className="text-xs text-slate-400">Functional, technical, security, and performance specifications with full traceability</p>
          </div>

          <div className="w-full sm:w-64 relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Filter requirements..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary-500 font-medium"
            />
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[10px] font-mono uppercase text-slate-500 font-bold mr-1">Priority:</span>
            {['all', 'Critical', 'Must Have', 'Should Have', 'Nice to Have'].map((p) => (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono transition-all whitespace-nowrap ${
                  priorityFilter === p
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                {p === 'all' ? 'All Priorities' : p}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs sm:ml-auto">
            <span className="text-[10px] font-mono uppercase text-slate-500 font-bold mr-1">Type:</span>
            {['all', 'functional', 'technical', 'security', 'performance'].map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono transition-all whitespace-nowrap uppercase ${
                  typeFilter === t
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Requirements List */}
      <div className="space-y-3.5">
        {filteredRequirements.length > 0 ? (
          filteredRequirements.map((req, reqIdx) => {
            const reqId = safeText(req.id, `REQ-0${reqIdx + 1}`);
            // Find linked features
            const linkedFeatures = featsList.filter((f) => safeArray(f.requirementIds).includes(reqId));
            // Find linked tasks
            const linkedTasks = tasksList.filter((t) => safeArray(t.requirementIds).includes(reqId) || linkedFeatures.some((f) => f.id === t.featureId));
            // Find linked decisions
            const linkedDecisions = decisionsList.filter((d) => safeArray(d.affectedRequirementIds).includes(reqId));

            const priority = safeText(req.priority, 'Must Have');
            const type = safeText(req.type, 'functional');

            return (
              <Card
                key={reqId}
                className="p-5 bg-slate-900 border border-slate-800 hover:border-primary-600/60 transition-all space-y-3.5 shadow-md group"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-lg bg-blue-950 text-blue-300 font-mono text-xs font-black border border-blue-800">
                      {reqId}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                      priority === 'Critical' || priority === 'Must Have'
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : priority === 'Should Have'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : 'bg-slate-950 text-slate-300 border border-slate-800'
                    }`}>
                      {priority}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-950 text-slate-400 font-mono text-[10px] uppercase font-bold border border-slate-800">
                      {type}
                    </span>
                    {req.source && (
                      <span className="px-2 py-0.5 rounded bg-slate-950 text-slate-500 font-mono text-[10px] border border-slate-800">
                        {safeText(req.source)}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() =>
                      onInspectEntity({
                        id: reqId,
                        type: 'requirement',
                        title: safeText(req.title),
                        description: safeText(req.description),
                        priority,
                        status: safeText(req.status),
                        raw: {
                          ...req,
                          linkedFeatureIds: linkedFeatures.map((f) => f.id),
                          linkedTaskIds: linkedTasks.map((t) => t.id),
                        },
                      })
                    }
                    className="flex items-center gap-1 text-primary-400 hover:text-primary-300 text-xs font-mono font-bold transition-colors opacity-90 group-hover:opacity-100"
                  >
                    <span>Inspect Traceability</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white group-hover:text-primary-200 transition-colors">
                    {safeText(req.title)}
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    {safeText(req.description)}
                  </p>
                </div>

                {/* Cross-Entity Traceability Row */}
                <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-800/80 text-[11px] font-mono">
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Traceability:</span>

                  {linkedFeatures.map((f) => (
                    <span
                      key={f.id}
                      onClick={() => onInspectEntity({ id: f.id, type: 'feature', title: safeText(f.name || f.title), description: safeText(f.description), priority: safeText(f.priority), raw: f })}
                      className="px-2 py-0.5 rounded bg-primary-950/80 text-primary-300 border border-primary-800 font-bold hover:bg-primary-900 cursor-pointer flex items-center gap-1"
                    >
                      <Workflow className="h-3 w-3" />
                      <span>{f.id}</span>
                    </span>
                  ))}

                  {linkedTasks.map((t) => (
                    <span
                      key={t.id}
                      onClick={() => onInspectEntity({ id: t.id, type: 'task', title: safeText(t.title), description: safeText(t.description), priority: safeText(t.priority), status: safeText(t.status), raw: t })}
                      className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800 font-bold hover:bg-emerald-900 cursor-pointer flex items-center gap-1"
                    >
                      <CheckSquare className="h-3 w-3" />
                      <span>{t.id}</span>
                    </span>
                  ))}

                  {linkedDecisions.map((d) => (
                    <span
                      key={d.id}
                      onClick={() => onInspectEntity({ id: d.id, type: 'decision', title: safeText(d.title || d.decision), description: safeText(d.rationale), status: safeText(d.status), raw: d })}
                      className="px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800 font-bold hover:bg-amber-900 cursor-pointer flex items-center gap-1"
                    >
                      <MessageSquare className="h-3 w-3" />
                      <span>{d.id}</span>
                    </span>
                  ))}

                  {(!linkedFeatures.length && !linkedTasks.length) && (
                    <span className="text-slate-500 italic text-[10px]">Baseline architectural requirement</span>
                  )}
                </div>
              </Card>
            );
          })
        ) : (
          <div className="py-12 text-center space-y-2 bg-slate-900 rounded-2xl border border-slate-800">
            <FileText className="h-8 w-8 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-400 font-medium">No requirements match the selected filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
