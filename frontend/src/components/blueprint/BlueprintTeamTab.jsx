import React, { useState } from 'react';
import {
  Users,
  UserCheck,
  UserPlus,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Zap,
  CheckSquare,
  Award,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import {
  calculateTeamWorkloadSummary,
  analyzeTeamCapabilityGaps,
  generateTaskAssignmentRecommendations,
  WORKLOAD_LEVELS,
} from '../../utils/teamMatchingEngine';
import { safeText, safeArray } from '../../utils/safeRender';

export function BlueprintTeamTab({
  content,
  orgMembers = [],
  onAssignTask,
  assigningTaskId,
  onInspectEntity,
}) {
  const [selectedTaskForAssignment, setSelectedTaskForAssignment] = useState(null);

  const v2 = content?.rawV2Content || content?.__v2Content || content || {};
  const execution = v2.execution || {};
  const tasks = safeArray(execution.tasks);
  const roles = safeArray(execution.roles || content?.teamAllocation);
  const techStack = v2.architecture?.technologyStack || content?.recommendedTechStack || null;

  // Derived Phase 5 team intelligence calculations with safe fallbacks
  const teamWorkload = calculateTeamWorkloadSummary(tasks, orgMembers);
  const capabilityGaps = analyzeTeamCapabilityGaps(tasks, roles, orgMembers, techStack);
  const assignmentRecommendations = generateTaskAssignmentRecommendations(tasks, roles, orgMembers, teamWorkload);

  const membersList = safeArray(teamWorkload.membersWorkload || teamWorkload.members);
  const unassignedCount = teamWorkload.unassignedTaskCount ?? teamWorkload.unassignedTasksCount ?? 0;
  const totalHours = teamWorkload.totalProjectHours ?? teamWorkload.totalActiveHours ?? 0;
  const unestimatedCount = teamWorkload.unestimatedTaskCount ?? 0;

  const coveredSkillsList = safeArray(capabilityGaps?.coveredSkills);
  const uncoveredSkillsList = safeArray(capabilityGaps?.uncoveredSkills);
  const strategicAdviceList = safeArray(capabilityGaps?.strategicAdvice);

  return (
    <div className="space-y-6">
      {/* 1. TEAM WORKLOAD & EXECUTION CAPACITY SUMMARY */}
      <Card className="p-6 bg-slate-900 border border-slate-800 space-y-5 shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Users className="h-4 w-4 text-primary-400" /> Team Workload & Allocation Summary
            </h3>
            <p className="text-xs text-slate-400">Capacity breakdown and workload balancing across workspace members</p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono flex-wrap">
            <span className="px-2.5 py-1 rounded-lg bg-slate-950 text-slate-300 border border-slate-800 font-bold">
              Total Effort: {totalHours}h
            </span>
            {unestimatedCount > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-slate-950 text-slate-400 border border-slate-800">
                {unestimatedCount} Unestimated Tasks
              </span>
            )}
            <span className="px-2.5 py-1 rounded-lg bg-primary-950 text-primary-300 border border-primary-800 font-bold">
              Unassigned: {unassignedCount} Tasks
            </span>
          </div>
        </div>

        {/* Member Workload Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {membersList.length > 0 ? (
            membersList.map((m, idx) => {
              const memberId = safeText(m.memberId || m.userId || m.uid || m.id, `mem-${idx}`);
              const memberName = safeText(m.memberName || m.displayName || m.name || m.email, 'Team Member');
              const taskCount = m.activeTaskCount ?? m.taskCount ?? 0;
              const memberHours = m.totalEstimatedHours ?? m.totalHours ?? 0;
              const workloadLevel = safeText(m.workloadLevel, 'low');
              const workloadShare = m.workloadPercentage ?? 0;

              return (
                <div
                  key={memberId}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={memberName} size="sm" />
                      <div>
                        <h5 className="text-xs font-bold text-white">{memberName}</h5>
                        <span className="text-[10px] font-mono text-slate-400">{safeText(m.workspaceRole || m.role, 'Member')}</span>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                      workloadLevel === WORKLOAD_LEVELS.OVERLOADED
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : workloadLevel === WORKLOAD_LEVELS.HIGH || workloadLevel === WORKLOAD_LEVELS.HEAVY
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    }`}>
                      {workloadLevel}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1 border-t border-slate-900">
                    <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-500 text-[10px] block">Active Tasks</span>
                      <span className="text-white font-bold">{taskCount} tasks</span>
                    </div>
                    <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-500 text-[10px] block">Effort / Share</span>
                      <span className="text-white font-bold">{memberHours}h ({workloadShare}%)</span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-3 py-6 text-center text-xs text-slate-500 font-mono">
              No workspace members loaded yet.
            </div>
          )}
        </div>
      </Card>

      {/* 2. CAPABILITY GAP ANALYSIS & STRATEGIC ADVICE */}
      <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4 shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-400" /> Team Capability Gaps & Skills Coverage
            </h3>
            <p className="text-xs text-slate-400">Analysis of required project skills vs verified team member capabilities</p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            {capabilityGaps.hasRequirements ? (
              <span className={`px-2.5 py-1 rounded-lg font-bold border ${
                capabilityGaps.coveragePercentage === 100
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                  : 'bg-amber-950 text-amber-300 border-amber-800'
              }`}>
                Skill Coverage: {capabilityGaps.coveragePercentage}%
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-lg bg-slate-950 text-slate-400 border border-slate-800 font-bold">
                Skill Coverage: <strong className="text-slate-300">N/A</strong> (No requirements detected)
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Covered Skills */}
          <div className="p-4 rounded-xl bg-slate-950 border border-emerald-950/60 space-y-2.5">
            <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Covered Technologies ({coveredSkillsList.length})
            </span>
            <div className="flex flex-wrap gap-1.5">
              {coveredSkillsList.length > 0 ? (
                coveredSkillsList.map((s, idx) => (
                  <span key={idx} className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 font-mono text-xs border border-emerald-900 font-bold">
                    {safeText(s)}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-500 font-mono italic">
                  No verified skills covered yet.
                </span>
              )}
            </div>
          </div>

          {/* Uncovered Skills / Gaps */}
          <div className="p-4 rounded-xl bg-slate-950 border border-amber-950/60 space-y-2.5">
            <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Uncovered Technology Gaps ({uncoveredSkillsList.length})
            </span>
            <div className="flex flex-wrap gap-1.5">
              {uncoveredSkillsList.length > 0 ? (
                uncoveredSkillsList.map((s, idx) => (
                  <span key={idx} className="px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 font-mono text-xs border border-amber-900 font-bold">
                    {safeText(s)}
                  </span>
                ))
              ) : capabilityGaps.hasRequirements ? (
                <span className="text-xs text-emerald-400 font-mono font-medium">
                  All required skills are covered by team members.
                </span>
              ) : (
                <span className="text-xs text-slate-500 font-mono italic">
                  No required skills have been identified for this project yet.
                </span>
              )}
            </div>
          </div>
        </div>

        {strategicAdviceList.length > 0 && (
          <div className="p-4 rounded-xl bg-primary-950/30 border border-primary-900/50 space-y-2">
            <span className="text-xs font-mono font-bold uppercase text-primary-300">Strategic Allocation Advice:</span>
            <ul className="space-y-1 text-xs text-primary-200">
              {strategicAdviceList.map((adv, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-primary-400 font-bold">•</span>
                  <span>{safeText(adv)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* 3. TASK ASSIGNMENT RECOMMENDATIONS */}
      <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4 shadow-lg">
        <h3 className="text-sm font-extrabold text-white flex items-center justify-between border-b border-slate-800 pb-3">
          <span className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-emerald-400" /> AI Task Capability Matching & Assignment Recommendations
          </span>
          <span className="text-[11px] font-mono text-slate-400 font-bold">
            Matches based on technical skills & workload
          </span>
        </h3>

        <div className="space-y-3">
          {safeArray(assignmentRecommendations).length > 0 ? (
            safeArray(assignmentRecommendations).map((rec, idx) => {
              const taskId = safeText(rec.taskId || rec.task?.id, `TASK-0${idx + 1}`);
              const task = rec.task || tasks.find((t) => t.id === taskId) || {
                id: taskId,
                title: rec.taskTitle || 'Task',
                priority: rec.priority || 'Medium',
                isCriticalPath: rec.isCriticalPath,
                assignedUserName: rec.currentAssignedUserName || rec.currentAssigneeName,
              };

              const topCandidate =
                rec.recommendedCandidate ||
                (rec.recommendedUserId
                  ? {
                      userId: rec.recommendedUserId,
                      displayName: rec.recommendedUserName || 'Recommended Member',
                      matchScore: rec.matchScore ? rec.matchScore / 100 : 0.85,
                      reasons: rec.reasons || [],
                    }
                  : null);

              const currentAssigneeName = safeText(task.assignedUserName || rec.currentAssignedUserName || task.assignedToName, 'Unassigned');

              return (
                <div
                  key={taskId}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-black text-primary-300">
                        {taskId}
                      </span>
                      <span className="font-mono text-xs font-bold text-white">{safeText(task.title)}</span>
                      {task.isCriticalPath && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 font-mono text-[9px] font-bold border border-amber-800">
                          🔥 Critical Path
                        </span>
                      )}
                    </div>

                    <span className="text-xs font-mono text-slate-400">
                      Current Assignee: <strong className="text-white">{currentAssigneeName}</strong>
                    </span>
                  </div>

                  {topCandidate && (
                    <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={safeText(topCandidate.displayName || topCandidate.email, 'Member')} size="sm" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-bold">{safeText(topCandidate.displayName || topCandidate.email)}</span>
                            <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 text-[10px] font-bold border border-emerald-800">
                              {Math.round((topCandidate.matchScore || 0.85) * (topCandidate.matchScore <= 1 ? 100 : 1))}% Match
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {Array.isArray(topCandidate.reasons) && topCandidate.reasons.length > 0
                              ? topCandidate.reasons[0]
                              : 'Recommended for technical capability & available capacity'}
                          </span>
                        </div>
                      </div>

                      {onAssignTask && (
                        <Button
                          variant="outline"
                          size="sm"
                          icon={<UserCheck className="h-3.5 w-3.5 text-emerald-400" />}
                          onClick={() => onAssignTask(taskId, topCandidate.userId, safeText(topCandidate.displayName || topCandidate.email))}
                          isLoading={assigningTaskId === taskId}
                          className="border-emerald-800/80 bg-emerald-950/40 hover:bg-emerald-900 text-emerald-200 text-xs font-bold py-1 px-3 h-7 shrink-0"
                        >
                          Confirm Assignment
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center text-xs text-slate-500 font-mono">
              No execution tasks present to recommend assignments for.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
