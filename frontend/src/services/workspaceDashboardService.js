import { rtdbService } from './rtdbService';
import { ideaService } from './ideaService';
import { blueprintService } from './blueprintService';
import { activityService } from './activityService';

/**
 * Convia Phase 10: Authoritative Workspace Dashboard Service.
 * Aggregates existing Convia workspace subsystems (Ideas, Blueprint, Discussions, Activity, Members)
 * into a single unified overview without fabricating statistics or duplicating business logic.
 */
export const workspaceDashboardService = {
  /**
   * Derives deterministic, rule-based attention and collaboration insight items.
   *
   * @param {Object} data - Aggregated workspace metrics
   * @param {boolean} isLeader - Whether current user is the workspace owner/leader
   * @param {string} orgId - Current workspace ID
   * @returns {Array<Object>} List of attention items ordered by priority
   */
  deriveAttentionItems: (data, isLeader = false, orgId = '') => {
    if (!data) return [];
    const items = [];

    const bp = data.blueprint;
    const selectedMvp = data.selectedMvp;
    const totalIdeas = data.totalIdeas || 0;
    const openQuestions = data.openQuestions || 0;
    const totalVotes = data.totalVotes || 0;

    // 1. Critical: Blueprint Generation Failure
    if (bp && bp.status === 'failed') {
      items.push({
        id: 'bp_failed',
        severity: 'danger',
        title: 'Blueprint Generation Interrupted',
        message: bp.lastError || 'AI Blueprint synthesis encountered an issue. Click to inspect error details and retry.',
        actionLabel: 'Inspect Blueprint',
        actionUrl: selectedMvp?.ideaId
          ? `/workspaces/${orgId}/ideas/${selectedMvp.ideaId}/blueprint`
          : `/workspaces/${orgId}/ideas`,
      });
    }

    // 2. High Priority: Blueprint Currently Generating
    if (bp && bp.status === 'generating') {
      const stageMap = {
        context_preparing: 'Preparing project context',
        ai_synthesis: 'Synthesizing specification with Gemini',
        validating_schema: 'Validating dependency graph',
        persisting: 'Saving version history',
      };
      const stageDesc = stageMap[bp.generationStage] || 'Synthesizing build specification';

      items.push({
        id: 'bp_generating',
        severity: 'info',
        title: 'AI Blueprint Generation in Progress',
        message: `${stageDesc}... Real-time progress updates are streaming.`,
        actionLabel: 'Track Progress',
        actionUrl: selectedMvp?.ideaId
          ? `/workspaces/${orgId}/ideas/${selectedMvp.ideaId}/blueprint`
          : `/workspaces/${orgId}/ideas`,
      });
    }

    // 3. High Priority: Completed Blueprint Pending Formal Approval
    if (bp && bp.status === 'completed' && bp.approvalStatus === 'pending_approval') {
      items.push({
        id: 'bp_approval',
        severity: 'warning',
        title: `Blueprint v${bp.version || '1.0'} Pending Review`,
        message: 'The canonical build specification is compiled and requires formal team approval to unlock sprint task execution.',
        actionLabel: 'Review & Approve',
        actionUrl: selectedMvp?.ideaId
          ? `/workspaces/${orgId}/ideas/${selectedMvp.ideaId}/blueprint`
          : `/workspaces/${orgId}/ideas`,
      });
    }

    // 4. Ideation: Empty Workspace (No Proposals)
    if (totalIdeas === 0) {
      items.push({
        id: 'no_ideas',
        severity: 'primary',
        title: 'Welcome! Start Brainstorming',
        message: 'No project proposals have been created yet. Submit your team’s first idea to kick off the ideation phase.',
        actionLabel: 'Propose Idea',
        actionKey: 'create_idea',
      });
    }

    // 5. Ideation: Proposals exist with zero votes
    if (totalIdeas > 0 && totalVotes === 0 && !selectedMvp) {
      items.push({
        id: 'vote_ideas',
        severity: 'info',
        title: 'Proposals Open for Voting',
        message: 'Team members have submitted proposals. Vote on your favorite ideas to help establish the winning MVP candidate.',
        actionLabel: 'Vote on Ideas',
        actionUrl: `/workspaces/${orgId}/ideas`,
      });
    }

    // 6. Ideation: Leader action to select MVP when ideas have votes
    if (totalIdeas > 0 && !selectedMvp && isLeader && totalVotes > 0) {
      items.push({
        id: 'select_mvp_leader',
        severity: 'warning',
        title: 'Select Winning MVP',
        message: 'Proposals have received community feedback. As the team lead, select the winning MVP on the Idea Board to transition to Sprint phase.',
        actionLabel: 'Select MVP',
        actionUrl: `/workspaces/${orgId}/ideas`,
      });
    }

    // 7. Active Discussion: Open Questions needing resolution
    if (openQuestions > 0) {
      items.push({
        id: 'open_questions',
        severity: 'neutral',
        title: `${openQuestions} Open Question${openQuestions === 1 ? '' : 's'} on Proposals`,
        message: 'Team members and collaborators have asked questions that may need clarification or technical answers.',
        actionLabel: 'View Discussions',
        actionUrl: `/workspaces/${orgId}/ideas`,
      });
    }

    return items;
  },

  /**
   * Fetches an authoritative single snapshot of workspace dashboard metrics.
   *
   * @param {string} orgId - Workspace / Organization identifier
   * @param {Object} user - Authenticated user context
   * @returns {Promise<Object>}
   */
  getWorkspaceDashboardData: async (orgId, user = null) => {
    if (!orgId) return null;

    try {
      // Fetch core subsystems in parallel
      const [org, ideas, bp, rawActivity, membersObj] = await Promise.all([
        (await rtdbService.getData(`organizations/${orgId}`)) || (await rtdbService.getData(`workspaces/${orgId}`)),
        ideaService.getIdeas(orgId).catch(() => []),
        blueprintService.getBlueprint(orgId).catch(() => null),
        activityService.getWorkspaceActivity(orgId, { limit: 10 }).catch(() => []),
        (await rtdbService.getData(`organization_members/${orgId}`)) || (await rtdbService.getData(`workspace_members/${orgId}`)) || {},
      ]);

      const activeIdeas = (ideas || []).filter((i) => i && !i.isDeleted);
      const membersList = Object.values(membersObj || {}).filter((m) => m && (m.uid || m.id));

      // Resolve Selected MVP
      const explicitMvpId = org?.activeProjectId || org?.selectedIdeaId || org?.activeMvpId;
      const selectedMvp = activeIdeas.find((i) => i.isSelected === true || (explicitMvpId && (i.ideaId === explicitMvpId || i.id === explicitMvpId))) || null;

      // Extract and normalize discussions across workspace ideas using compliant paths discussions/{orgId}/{ideaId}
      const flattenedDiscussions = [];
      if (activeIdeas.length > 0) {
        const ideaDiscussionsResults = await Promise.all(
          activeIdeas.slice(0, 20).map(async (idea) => {
            const id = idea.ideaId || idea.id;
            try {
              const res = await rtdbService.getData(`discussions/${orgId}/${id}`);
              return { idea, discussions: res || {} };
            } catch {
              return { idea, discussions: {} };
            }
          })
        );

        ideaDiscussionsResults.forEach(({ idea, discussions }) => {
          if (discussions && typeof discussions === 'object') {
            const id = idea.ideaId || idea.id;
            Object.values(discussions).forEach((disc) => {
              if (disc && typeof disc === 'object' && !disc.isDeleted && !disc.parentId) {
                flattenedDiscussions.push({
                  ...disc,
                  ideaId: id,
                  ideaTitle: idea.title || 'Project Proposal',
                });
              }
            });
          }
        });
      }

      // Sort discussions newest first
      flattenedDiscussions.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));

      const questionsList = flattenedDiscussions.filter((d) => d.type === 'question');
      const suggestionsList = flattenedDiscussions.filter((d) => d.type === 'suggestion');

      const totalVotes = activeIdeas.reduce((sum, i) => sum + (Number(i.voteCount) || 0), 0);
      const openQuestions = questionsList.length;
      const totalSuggestions = suggestionsList.length;
      const acceptedSuggestions = suggestionsList.filter((s) => s.isAccepted === true).length;

      // Normalize Blueprint Status
      let normalizedBlueprint = null;
      if (bp) {
        normalizedBlueprint = {
          blueprintId: bp.blueprintId || `bp_${orgId}`,
          status: bp.status || 'completed',
          version: String(bp.version || bp.versionId || '1.0'),
          schemaVersion: bp.schemaVersion || 2,
          lifecycleState: bp.lifecycleState || (bp.status === 'completed' ? 'active' : 'draft'),
          approvalStatus: bp.approvalStatus || (bp.status === 'completed' ? 'approved' : 'pending_approval'),
          generationStage: bp.generationStage || null,
          lastError: bp.lastError || null,
          ideaId: bp.mvpIdeaId || bp.ideaId || selectedMvp?.ideaId || null,
          ideaTitle: bp.ideaTitle || selectedMvp?.title || 'Winning MVP',
          taskCount: bp.content?.execution?.tasks?.length || 0,
          wavesCount: bp.content?.execution?.executionWaves?.length || 0,
          criticalPathLength: bp.content?.execution?.criticalPathTaskIds?.length || 0,
          updatedAt: bp.updatedAt || bp.generatedAt || Date.now(),
        };
      }

      // Sort ideas: selected MVP first, then by votes descending, then newest
      const sortedIdeas = [...activeIdeas].sort((a, b) => {
        if (a.isSelected && !b.isSelected) return -1;
        if (!a.isSelected && b.isSelected) return 1;
        const voteDiff = (Number(b.voteCount) || 0) - (Number(a.voteCount) || 0);
        if (voteDiff !== 0) return voteDiff;
        return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0);
      });

      const isLeader = Boolean(user && org && (org.ownerId === user.uid || org.createdBy === user.uid || org.ownerUid === user.uid));

      const dataPayload = {
        orgId,
        org: org || { id: orgId, name: 'Workspace', status: 'ideation' },
        totalIdeas: activeIdeas.length,
        selectedMvp,
        totalVotes,
        totalMembers: membersList.length || 1,
        openQuestions,
        totalSuggestions,
        acceptedSuggestions,
        blueprint: normalizedBlueprint,
        recentIdeas: sortedIdeas.slice(0, 4),
        recentQuestions: questionsList.slice(0, 4),
        recentSuggestions: suggestionsList.slice(0, 4),
        recentActivity: Array.isArray(rawActivity) ? rawActivity.slice(0, 6) : [],
        timestamp: Date.now(),
      };

      dataPayload.attentionItems = workspaceDashboardService.deriveAttentionItems(dataPayload, isLeader, orgId);

      return dataPayload;
    } catch (err) {
      console.error(`[workspaceDashboardService] Failed to load dashboard for workspace '${orgId}':`, err);
      throw err;
    }
  },

  /**
   * Real-time Multi-Subsystem Subscription for the Workspace Dashboard.
   * Debounces updates across ideas, blueprint, and activity feeds to prevent re-render thrashing.
   * Returns a unified unsubscription cleaner to prevent memory leaks during workspace switching.
   *
   * @param {string} orgId - Workspace / Organization ID
   * @param {Function} callback - Invoked with updated dashboard data
   * @param {Object} user - Current authenticated user
   * @returns {Function} Unsubscribe handler
   */
  subscribeToWorkspaceDashboard: (orgId, callback, user = null) => {
    if (!orgId || typeof callback !== 'function') {
      if (typeof callback === 'function') callback(null);
      return () => {};
    }

    let isDisposed = false;
    let debounceTimeout = null;

    const triggerUpdate = () => {
      if (isDisposed) return;
      if (debounceTimeout) clearTimeout(debounceTimeout);

      debounceTimeout = setTimeout(async () => {
        if (isDisposed) return;
        try {
          const fresh = await workspaceDashboardService.getWorkspaceDashboardData(orgId, user);
          if (!isDisposed && fresh) {
            callback(fresh);
          }
        } catch (err) {
          if (!isDisposed) {
            console.warn('[workspaceDashboardService] Real-time revalidation warning:', err.message);
          }
        }
      }, 75);
    };

    // 1. Initial snapshot trigger
    triggerUpdate();

    // 2. Real-time subscription to Ideas
    const unsubIdeas = ideaService.subscribeToIdeas(orgId, () => {
      triggerUpdate();
    });

    // 3. Real-time subscription to Blueprint
    const unsubBlueprint = blueprintService.subscribeToBlueprint(orgId, () => {
      triggerUpdate();
    });

    // 4. Real-time subscription to Activity Audit Trail
    const unsubActivity = activityService.subscribeToWorkspaceActivity(
      orgId,
      () => {
        triggerUpdate();
      },
      { limit: 10 }
    );

    return () => {
      isDisposed = true;
      if (debounceTimeout) clearTimeout(debounceTimeout);
      if (typeof unsubIdeas === 'function') unsubIdeas();
      if (typeof unsubBlueprint === 'function') unsubBlueprint();
      if (typeof unsubActivity === 'function') unsubActivity();
    };
  },
};

export default workspaceDashboardService;
