import { rtdbService } from '../services/rtdbService.js';
import { requireWorkspaceMember } from '../utils/workspaceAuthHelper.js';

/**
 * Convia Phase 10: Centralized Workspace Dashboard Controller.
 * Aggregates real Convia subsystems with strict workspace-level authorization
 * and zero fabricated statistics.
 */
export const workspaceDashboardController = {
  /**
   * Derives deterministic, rule-based attention and collaboration insight items.
   *
   * @param {Object} data - Aggregated workspace metrics
   * @param {boolean} isLeader - Whether user is workspace lead
   * @param {string} workspaceId - Workspace ID
   * @returns {Array<Object>}
   */
  deriveAttentionItems: (data, isLeader = false, workspaceId = '') => {
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
        message: bp.lastError || 'AI Blueprint synthesis encountered an issue. Inspect details and retry.',
        actionLabel: 'Inspect Blueprint',
        actionUrl: selectedMvp?.ideaId
          ? `/workspaces/${workspaceId}/ideas/${selectedMvp.ideaId}/blueprint`
          : `/workspaces/${workspaceId}/ideas`,
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
          ? `/workspaces/${workspaceId}/ideas/${selectedMvp.ideaId}/blueprint`
          : `/workspaces/${workspaceId}/ideas`,
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
          ? `/workspaces/${workspaceId}/ideas/${selectedMvp.ideaId}/blueprint`
          : `/workspaces/${workspaceId}/ideas`,
      });
    }

    // 4. Ideation: Empty Workspace
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
        actionUrl: `/workspaces/${workspaceId}/ideas`,
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
        actionUrl: `/workspaces/${workspaceId}/ideas`,
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
        actionUrl: `/workspaces/${workspaceId}/ideas`,
      });
    }

    return items;
  },

  /**
   * Retrieves authorized workspace dashboard overview.
   *
   * @param {string} workspaceId - Workspace / Org ID
   * @param {string} userUid - Authenticated user UID
   * @returns {Promise<Object>} Dashboard overview response
   */
  getWorkspaceDashboardHandler: async (workspaceId, userUid) => {
    if (!workspaceId || !userUid) {
      const err = new Error('Workspace ID and User UID are required.');
      err.statusCode = 400;
      throw err;
    }

    // 1. Strict Workspace Membership & Existence Authorization Check
    const { org: orgRecord, memberRecord, isOwner } = await requireWorkspaceMember(
      workspaceId,
      userUid,
      'Unauthorized: You are not a member of this workspace.'
    );

    // 2. Fetch Workspace Subsystems in Parallel
    const [rawIdeas, rawBlueprint, rawMembers, rawActivity] = await Promise.all([
      rtdbService.getData(`ideas/${workspaceId}`).catch(() => ({})),
      rtdbService.getData(`blueprints/${workspaceId}`).catch(() => null),
      rtdbService.getData(`organization_members/${workspaceId}`)
        .then((res) => res || rtdbService.getData(`workspace_members/${workspaceId}`))
        .catch(() => ({})),
      rtdbService.getData(`workspace_activity/${workspaceId}`).catch(() => ({})),
    ]);

    // Filter active (non-deleted) ideas
    const ideasList = Object.values(rawIdeas || {})
      .filter((i) => i && typeof i === 'object' && !i.isDeleted);

    // Resolve Selected MVP
    const explicitMvpId = orgRecord.activeProjectId || orgRecord.selectedIdeaId || orgRecord.activeMvpId;
    const selectedMvp = ideasList.find((i) => i.isSelected === true || (explicitMvpId && (i.ideaId === explicitMvpId || i.id === explicitMvpId))) || null;

    // Fetch discussions per active idea within authorized scope
    const flattenedDiscussions = [];
    if (ideasList.length > 0) {
      const ideaDiscussionsResults = await Promise.all(
        ideasList.slice(0, 20).map(async (idea) => {
          const id = idea.ideaId || idea.id;
          try {
            const res = await rtdbService.getData(`discussions/${workspaceId}/${id}`);
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

    flattenedDiscussions.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));

    const questionsList = flattenedDiscussions.filter((d) => d.type === 'question');
    const suggestionsList = flattenedDiscussions.filter((d) => d.type === 'suggestion');

    const totalVotes = ideasList.reduce((sum, i) => sum + (Number(i.voteCount) || 0), 0);
    const membersList = Object.values(rawMembers || {}).filter((m) => m && (m.uid || m.id));

    // Normalize Blueprint
    let normalizedBlueprint = null;
    if (rawBlueprint) {
      // In RTDB, blueprints are either directly stored or keyed by ideaId
      const bp = rawBlueprint.content
        ? rawBlueprint
        : (selectedMvp && rawBlueprint[selectedMvp.ideaId]) || Object.values(rawBlueprint)[0] || rawBlueprint;

      if (bp && (bp.content || bp.status || bp.blueprintId)) {
        normalizedBlueprint = {
          blueprintId: bp.blueprintId || `bp_${workspaceId}`,
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
    }

    // Sort ideas: selected MVP first, then vote count desc, then newest
    const sortedIdeas = [...ideasList].sort((a, b) => {
      if (a.isSelected && !b.isSelected) return -1;
      if (!a.isSelected && b.isSelected) return 1;
      const voteDiff = (Number(b.voteCount) || 0) - (Number(a.voteCount) || 0);
      if (voteDiff !== 0) return voteDiff;
      return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0);
    });

    // Normalize activity
    const activityList = Object.values(rawActivity || {})
      .filter((a) => a && typeof a === 'object')
      .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0))
      .slice(0, 6);

    const payload = {
      workspaceId,
      org: {
        id: orgRecord.id || workspaceId,
        name: orgRecord.name || 'Workspace',
        description: orgRecord.description || '',
        status: orgRecord.status || 'ideation',
        ownerId: orgRecord.ownerId,
      },
      totalIdeas: ideasList.length,
      selectedMvp,
      totalVotes,
      totalMembers: membersList.length || 1,
      openQuestions: questionsList.length,
      totalSuggestions: suggestionsList.length,
      acceptedSuggestions: suggestionsList.filter((s) => s.isAccepted === true).length,
      blueprint: normalizedBlueprint,
      recentIdeas: sortedIdeas.slice(0, 4),
      recentQuestions: questionsList.slice(0, 4),
      recentSuggestions: suggestionsList.slice(0, 4),
      recentActivity: activityList,
      timestamp: Date.now(),
    };

    payload.attentionItems = workspaceDashboardController.deriveAttentionItems(payload, isOwner, workspaceId);

    return payload;
  },
};
