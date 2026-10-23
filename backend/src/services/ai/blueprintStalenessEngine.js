import crypto from 'node:crypto';
import { STALENESS_IMPACT_LEVELS } from '../../constants/blueprintSchema.js';

/**
 * Phase 9: Blueprint Staleness & Change-Impact Engine.
 * Detects material project state shifts and calculates deterministic source hashes.
 */
export const blueprintStalenessEngine = {
  /**
   * Generates a deterministic hash from authoritative project inputs.
   * Strips out volatile fields (timestamps, transient counters, random IDs).
   */
  computeSourceContextHash: (context = {}) => {
    const normalized = {
      ideaId: String(context.ideaId || context.mvpIdeaId || '').trim(),
      ideaTitle: String(context.ideaTitle || context.title || '').trim().toLowerCase(),
      problemStatement: String(context.problemStatement || '').trim().toLowerCase().replace(/\s+/g, ' '),
      description: String(context.description || context.proposedSolution || '').trim().toLowerCase().replace(/\s+/g, ' '),
      techStack: String(context.techStack || '').trim().toLowerCase(),
      category: String(context.category || '').trim().toLowerCase(),

      // Normalized Accepted Decisions (sorted for determinism)
      decisions: (context.discussions?.acceptedSuggestions || context.acceptedDecisions || [])
        .map((d) => ({
          text: String(d.decision || d.message || '').trim().toLowerCase(),
          isAccepted: true,
        }))
        .sort((a, b) => a.text.localeCompare(b.text)),

      // Normalized Team Composition (sorted by ID: identity and workspace role)
      team: (context.teamMembers || [])
        .map((m) => ({
          id: String(m.id || m.uid || '').trim(),
          role: String(m.workspaceRole || m.role || 'Contributor').trim().toLowerCase(),
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    };

    const serialized = JSON.stringify(normalized);
    return crypto.createHash('sha256').update(serialized).digest('hex').substring(0, 16);
  },

  /**
   * Evaluates current project context against a persisted Blueprint document.
   * Returns impact level, changed source dimensions, and actionable recommendation.
   */
  evaluateProjectChanges: (currentContext = {}, existingBlueprint = {}) => {
    if (!existingBlueprint || !existingBlueprint.content) {
      return {
        isStale: false,
        impactLevel: STALENESS_IMPACT_LEVELS.NO_IMPACT,
        changedSources: [],
        staleReason: null,
        recommendation: 'NONE',
        sourceContextHash: null,
        currentContextHash: null,
      };
    }

    const currentHash = blueprintStalenessEngine.computeSourceContextHash(currentContext);
    const originalHash = existingBlueprint.sourceContextHash;

    // If sourceContextHash was never stamped (legacy), we compute base hash or treat as clean
    if (!originalHash) {
      return {
        isStale: false,
        impactLevel: STALENESS_IMPACT_LEVELS.NO_IMPACT,
        changedSources: [],
        staleReason: null,
        recommendation: 'NONE',
        sourceContextHash: currentHash,
        currentContextHash: currentHash,
      };
    }

    if (currentHash === originalHash) {
      return {
        isStale: false,
        impactLevel: STALENESS_IMPACT_LEVELS.NO_IMPACT,
        changedSources: [],
        staleReason: null,
        recommendation: 'NONE',
        sourceContextHash: originalHash,
        currentContextHash: currentHash,
      };
    }

    // Identify specific source dimensions that changed
    const changedSources = [];
    let highestImpact = STALENESS_IMPACT_LEVELS.LOW_IMPACT;

    // Check 1: Core Idea Definition
    const oldTitle = String(existingBlueprint.ideaTitle || '').trim().toLowerCase();
    const newTitle = String(currentContext.ideaTitle || currentContext.title || '').trim().toLowerCase();
    const oldProblem = String(existingBlueprint.problemStatement || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const newProblem = String(currentContext.problemStatement || '').trim().toLowerCase().replace(/\s+/g, ' ');

    if (oldTitle && newTitle && oldTitle !== newTitle) {
      changedSources.push('idea_title');
      highestImpact = STALENESS_IMPACT_LEVELS.HIGH_IMPACT;
    }
    if (oldProblem && newProblem && oldProblem !== newProblem) {
      changedSources.push('problem_statement');
      highestImpact = STALENESS_IMPACT_LEVELS.HIGH_IMPACT;
    }

    // Check 2: MVP Idea ID Mismatch (Critical)
    const oldIdeaId = String(existingBlueprint.mvpIdeaId || existingBlueprint.ideaId || '').trim();
    const newIdeaId = String(currentContext.ideaId || currentContext.mvpIdeaId || '').trim();
    if (oldIdeaId && newIdeaId && oldIdeaId !== newIdeaId) {
      changedSources.push('mvp_identity');
      highestImpact = STALENESS_IMPACT_LEVELS.CRITICAL;
    }

    // Check 3: Accepted Decisions
    const currentAcceptedDecisions = currentContext.discussions?.acceptedSuggestions || currentContext.acceptedDecisions || [];
    const bpDecisions = existingBlueprint.content?.intelligence?.discussionIntelligence?.decisions || [];
    const approvedBpDecisions = bpDecisions.filter((d) => d.status === 'approved');

    if (currentAcceptedDecisions.length !== approvedBpDecisions.length) {
      changedSources.push('accepted_decisions');
      if (highestImpact !== STALENESS_IMPACT_LEVELS.CRITICAL) {
        highestImpact = STALENESS_IMPACT_LEVELS.HIGH_IMPACT;
      }
    }

    // Check 4: Team Composition (Structural: member added/removed or workspace role modified)
    const currentTeam = (currentContext.teamMembers || [])
      .map((m) => ({
        id: String(m.id || m.uid || '').trim(),
        role: String(m.workspaceRole || m.role || 'Contributor').trim().toLowerCase(),
      }))
      .filter((m) => m.id);

    const bpTeamSnapshot = Array.isArray(existingBlueprint.teamSnapshot)
      ? existingBlueprint.teamSnapshot
      : Array.isArray(existingBlueprint.teamMembers)
      ? existingBlueprint.teamMembers
      : null;

    let teamHasChanged = false;

    if (bpTeamSnapshot && bpTeamSnapshot.length > 0) {
      if (currentTeam.length !== bpTeamSnapshot.length) {
        teamHasChanged = true;
      } else {
        const bpTeamMap = new Map(
          bpTeamSnapshot.map((m) => [
            String(m.id || m.uid || '').trim(),
            String(m.role || m.workspaceRole || 'contributor').trim().toLowerCase(),
          ])
        );
        for (const member of currentTeam) {
          const bpRole = bpTeamMap.get(member.id);
          if (bpRole === undefined || bpRole !== member.role) {
            teamHasChanged = true;
            break;
          }
        }
      }
    } else {
      // Legacy blueprint without teamSnapshot: team is considered unchanged.
      // Do NOT guess against capabilityRequirements (which are abstract AI requirements).
      teamHasChanged = false;
    }

    if (teamHasChanged) {
      changedSources.push('team_composition');
      if (highestImpact === STALENESS_IMPACT_LEVELS.LOW_IMPACT) {
        highestImpact = STALENESS_IMPACT_LEVELS.MEDIUM_IMPACT;
      }
    }

    // If no meaningful project state dimensions shifted (e.g. minor whitespace or volatile attribute shift)
    if (changedSources.length === 0) {
      return {
        isStale: false,
        impactLevel: STALENESS_IMPACT_LEVELS.NO_IMPACT,
        changedSources: [],
        staleReason: null,
        recommendation: 'NONE',
        sourceContextHash: originalHash,
        currentContextHash: currentHash,
      };
    }

    // Generate human-readable reason
    const reasonParts = [];
    if (changedSources.includes('mvp_identity')) reasonParts.push('Selected Workspace MVP changed');
    if (changedSources.includes('problem_statement')) reasonParts.push('Problem statement modified');
    if (changedSources.includes('idea_title')) reasonParts.push('Project title updated');
    if (changedSources.includes('accepted_decisions')) reasonParts.push('New accepted discussion decisions');
    if (changedSources.includes('team_composition')) reasonParts.push('Team structure changed');
    if (reasonParts.length === 0) reasonParts.push('Project context updated');

    const staleReason = reasonParts.join(' · ');

    const recommendation =
      highestImpact === STALENESS_IMPACT_LEVELS.CRITICAL || highestImpact === STALENESS_IMPACT_LEVELS.HIGH_IMPACT
        ? 'REGENERATE'
        : highestImpact === STALENESS_IMPACT_LEVELS.MEDIUM_IMPACT
        ? 'REVIEW'
        : 'NONE';

    return {
      isStale: true,
      impactLevel: highestImpact,
      changedSources,
      staleReason,
      staleSince: Date.now(),
      recommendation,
      sourceContextHash: originalHash,
      currentContextHash: currentHash,
    };
  },
};
