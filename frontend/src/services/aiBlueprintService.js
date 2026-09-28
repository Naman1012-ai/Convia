import { rtdbService } from './rtdbService';
import { apiClient } from './apiClient';
import { getErrorMessage } from '../utils/errorMessages';
import { generateBlueprintPdf, getSafeFilename } from './blueprintPdfGenerator.js';

/**
 * Direct browser download utility for exporting Blueprint files.
 * Generates an ObjectURL and triggers a download attribute click.
 * Strictly does NOT trigger Web Share or WhatsApp.
 */
export function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    if (document.body.contains(link)) {
      document.body.removeChild(link);
    }
    URL.revokeObjectURL(url);
  }, 1000);

  return { success: true, method: 'download' };
}

/**
 * Standalone explicit share utility for native device share sheet when specifically requested.
 */
export async function shareFile(blob, filename, mimeType, title = 'Convia Blueprint') {
  if (typeof navigator !== 'undefined' && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: mimeType });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title,
        });
        return { success: true, method: 'share' };
      }
    } catch (err) {
      if (err.name === 'AbortError') return { success: true, method: 'cancelled' };
    }
  }
  return downloadFile(blob, filename);
}

/**
 * Service Layer for AI Blueprint Preparation & Context Formatting.
 * Acts as the boundary between Frontend UI and Backend Express Server.
 */
export const aiBlueprintService = {
  /**
   * Authoritatively fetches the active Blueprint document or specific version snapshot from backend.
   */
  fetchActiveBlueprint: async (workspaceId, userUid, targetVersion = null) => {
    if (!workspaceId || !userUid) {
      throw new Error('Workspace ID and User UID are required.');
    }
    return await apiClient.post('/api/blueprint/active', {
      workspaceId,
      userUid,
      targetVersion: targetVersion || undefined,
    });
  },

  /**
   * Authoritatively fetches all persisted Blueprint version metadata from backend.
   */
  fetchBlueprintVersions: async (workspaceId, userUid) => {
    if (!workspaceId || !userUid) {
      throw new Error('Workspace ID and User UID are required.');
    }
    return await apiClient.post('/api/blueprint/versions', {
      workspaceId,
      userUid,
    });
  },

  /**
   * Synchronizes Blueprint planned tasks into the Task Board execution layer.
   * Authoritatively calls backend endpoint POST /api/blueprint/sync-tasks.
   */
  syncBlueprintTasks: async (workspaceId, userUid, targetVersion = null) => {
    if (!workspaceId || !userUid) {
      throw new Error('Workspace ID and User UID are required.');
    }

    const versionStr = targetVersion && typeof targetVersion === 'object'
      ? (targetVersion.version || targetVersion.versionId || targetVersion.key || targetVersion.id)
      : targetVersion;

    return await apiClient.post('/api/blueprint/sync-tasks', {
      workspaceId,
      userUid,
      targetVersion: versionStr || undefined,
    });
  },


  /**
   * Client-facing method to trigger AI Blueprint Generation via backend endpoint.
   */
  generateBlueprint: async (workspaceId, userUid) => {
    if (!workspaceId || !userUid) {
      throw new Error('Workspace ID and User UID are required.');
    }
    return await apiClient.post('/api/blueprint/generate', { workspaceId, userUid });
  },

  /**
   * Phase 7: Client-facing method to rescue/recover stale generation attempts.
   */
  recoverStaleGeneration: async (workspaceId, userUid) => {
    if (!workspaceId || !userUid) {
      throw new Error('Workspace ID and User UID are required.');
    }
    return await apiClient.post('/api/blueprint/recover', { workspaceId, userUid });
  },

  /**
   * Phase 5 & Phase 9: Client-facing method to save manual Blueprint updates with optimistic concurrency metadata.
   */
  updateBlueprint: async (workspaceId, userUid, payload) => {
    if (!workspaceId || !userUid || !payload) {
      throw new Error('Workspace ID, User UID, and Updated Content payload are required.');
    }
    return await apiClient.put('/api/blueprint/update', { workspaceId, userUid, updatedContent: payload });
  },

  /**
   * Phase 9: Client-facing method to activate a historical Blueprint version.
   */
  activateBlueprintVersion: async (workspaceId, userUid, targetVersionKey) => {
    if (!workspaceId || !userUid || !targetVersionKey) {
      throw new Error('Workspace ID, User UID, and Target Version Key are required.');
    }
    return await apiClient.post('/api/blueprint/version/activate', {
      workspaceId,
      userUid,
      targetVersion: targetVersionKey,
    });
  },

  /**
   * Phase 9: Client-facing method to check project staleness and change impact.
   */
  checkBlueprintStaleness: async (workspaceId, userUid) => {
    if (!workspaceId || !userUid) {
      throw new Error('Workspace ID and User UID are required.');
    }
    return await apiClient.post('/api/blueprint/check-staleness', {
      workspaceId,
      userUid,
    });
  },

  /**
   * Phase 9: Client-facing method to compare two Blueprint versions.
   */
  compareBlueprintVersions: async (workspaceId, userUid, versionA, versionB) => {
    if (!workspaceId || !userUid || !versionA || !versionB) {
      throw new Error('Workspace ID, User UID, versionA, and versionB are required.');
    }
    return await apiClient.post('/api/blueprint/version/compare', {
      workspaceId,
      userUid,
      versionA,
      versionB,
    });
  },

  /**
   * Phase 11: Client-facing method to formally approve and activate a Blueprint version.
   */
  approveBlueprintVersion: async (workspaceId, userUid, targetVersionKey) => {
    if (!workspaceId || !userUid || !targetVersionKey) {
      throw new Error('Workspace ID, User UID, and Target Version Key are required.');
    }
    const versionStr = typeof targetVersionKey === 'object'
      ? (targetVersionKey.version || targetVersionKey.versionId || targetVersionKey.key || targetVersionKey.id)
      : targetVersionKey;

    return await apiClient.post('/api/blueprint/version/approve', {
      workspaceId,
      userUid,
      targetVersion: versionStr,
    });
  },

  /**
   * Phase 11: Client-facing method to check approval readiness checklist and preconditions.
   */
  checkApprovalReadiness: async (workspaceId, userUid, targetVersionKey) => {
    if (!workspaceId || !userUid) {
      throw new Error('Workspace ID and User UID are required.');
    }
    const versionStr = targetVersionKey && typeof targetVersionKey === 'object'
      ? (targetVersionKey.version || targetVersionKey.versionId || targetVersionKey.key || targetVersionKey.id)
      : targetVersionKey;

    return await apiClient.post('/api/blueprint/version/approval-readiness', {
      workspaceId,
      userUid,
      targetVersion: versionStr || null,
    });
  },

  /**
   * Phase 5: Client-facing method to assign a Blueprint task (Accepting recommendation or manual assignment).
   */
  assignBlueprintTask: async (workspaceId, userUid, taskId, assignedUserId) => {
    if (!workspaceId || !userUid || !taskId) {
      throw new Error('Workspace ID, User UID, and Task ID are required.');
    }
    return await apiClient.post('/api/blueprint/assign-task', {
      workspaceId,
      userUid,
      taskId,
      assignedUserId: assignedUserId || null,
    });
  },

  /**
   * Phase 7: Client-facing method to approve a proposed decision.
   */
  approveDecision: async (workspaceId, userUid, decisionId) => {
    if (!workspaceId || !userUid || !decisionId) {
      throw new Error('Workspace ID, User UID, and Decision ID are required.');
    }
    return await apiClient.post('/api/blueprint/decision/approve', {
      workspaceId,
      userUid,
      decisionId,
    });
  },

  /**
   * Phase 7: Client-facing method to reject a proposed decision.
   */
  rejectDecision: async (workspaceId, userUid, decisionId) => {
    if (!workspaceId || !userUid || !decisionId) {
      throw new Error('Workspace ID, User UID, and Decision ID are required.');
    }
    return await apiClient.post('/api/blueprint/decision/reject', {
      workspaceId,
      userUid,
      decisionId,
    });
  },

  /**
   * Phase 7: Client-facing method to create an authoritative decision.
   */
  createDecision: async (workspaceId, userUid, decisionData) => {
    if (!workspaceId || !userUid || !decisionData?.decision) {
      throw new Error('Workspace ID, User UID, and Decision text are required.');
    }
    return await apiClient.post('/api/blueprint/decision/create', {
      workspaceId,
      userUid,
      ...decisionData,
    });
  },

  /**
   * Phase 7: Client-facing method to approve a change recommendation.
   */
  approveChangeRecommendation: async (workspaceId, userUid, recommendationId) => {
    if (!workspaceId || !userUid || !recommendationId) {
      throw new Error('Workspace ID, User UID, and Recommendation ID are required.');
    }
    return await apiClient.post('/api/blueprint/change-recommendation/approve', {
      workspaceId,
      userUid,
      recommendationId,
    });
  },

  /**
   * Phase 7: Client-facing method to reject a change recommendation.
   */
  rejectChangeRecommendation: async (workspaceId, userUid, recommendationId) => {
    if (!workspaceId || !userUid || !recommendationId) {
      throw new Error('Workspace ID, User UID, and Recommendation ID are required.');
    }
    return await apiClient.post('/api/blueprint/change-recommendation/reject', {
      workspaceId,
      userUid,
      recommendationId,
    });
  },

  /**
   * Phase 6: Client-facing method to export validated Blueprint JSON.
   */
  exportBlueprintJson: async (workspaceId, userUid, targetVersion = null, localBlueprint = null) => {
    if (!workspaceId || !userUid) {
      throw new Error('Workspace ID and User UID are required.');
    }
    let jsonString = '';
    let filename = '';

    if (localBlueprint && (localBlueprint.content || localBlueprint.rawV2Content)) {
      const canonicalContent = localBlueprint.rawV2Content || localBlueprint.__v2Content || localBlueprint.content;
      const cleanExportDoc = {
        blueprintId: localBlueprint.blueprintId || `bp_${workspaceId}`,
        workspaceId,
        mvpIdeaId: localBlueprint.mvpIdeaId || localBlueprint.ideaId,
        version: String(localBlueprint.version || '1.0'),
        schemaVersion: canonicalContent?.schemaVersion || 2,
        status: 'completed',
        lastModifiedSource: localBlueprint.lastModifiedSource || 'ai_generation',
        generatedAt: localBlueprint.generatedAt || localBlueprint.createdAt || Date.now(),
        updatedAt: localBlueprint.updatedAt || Date.now(),
        ideaTitle: localBlueprint.ideaTitle || 'Project Blueprint',
        problemStatement: localBlueprint.problemStatement || '',
        content: canonicalContent,
      };

      jsonString = JSON.stringify(cleanExportDoc, null, 2);
      filename = getSafeFilename(localBlueprint.ideaTitle || 'project', localBlueprint.version || '1.0', 'json');
    } else {
      const result = await apiClient.post('/api/blueprint/export-json', { workspaceId, userUid, targetVersion });
      jsonString = result.jsonString || JSON.stringify(result.exportData, null, 2);
      filename = result.filename || 'convia-blueprint.json';
    }

    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
    downloadFile(blob, filename);

    return { success: true, filename };
  },

  /**
   * Phase 6 & Phase 12: Client-facing method to export validated Blueprint PDF.
   */
  exportBlueprintPdf: async (workspaceId, userUid, orgName = 'Workspace', targetVersion = null, localBlueprint = null) => {
    if (!workspaceId || !userUid) {
      throw new Error('Workspace ID and User UID are required.');
    }

    let blueprintDoc = localBlueprint;
    if (!blueprintDoc || (!blueprintDoc.content && !blueprintDoc.rawV2Content)) {
      const jsonResult = await apiClient.post('/api/blueprint/export-json', { workspaceId, userUid, targetVersion });
      blueprintDoc = jsonResult?.data?.exportData || jsonResult?.exportData;
    }

    const pdfResult = generateBlueprintPdf(blueprintDoc, orgName);
    const doc = pdfResult.doc;
    const filename = pdfResult.filename;

    const pdfBlob = doc.output('blob');
    downloadFile(pdfBlob, filename);

    return {
      success: true,
      filename,
    };
  },

  /**
   * Client-facing method to trigger standalone Community Intelligence Analysis.
   */
  analyzeCommunityIntelligence: async (workspaceId, userUid) => {
    if (!workspaceId || !userUid) {
      throw new Error('Workspace ID and User UID are required.');
    }
    return await apiClient.post('/api/blueprint/analyze-community', { workspaceId, userUid });
  },

  /**
   * Extract & sanitize context from workspace, members, and discussions
   * to conform strictly to the AiBlueprintInputContract.
   */
  prepareAiInputContext: async (workspaceId, mvpIdea) => {
    if (!workspaceId || !mvpIdea) {
      throw new Error('Workspace ID and MVP Idea snapshot are required.');
    }

    try {
      const membersObj = (await rtdbService.getData(`organization_members/${workspaceId}`)) || {};
      const memberUids = Object.keys(membersObj);

      const teamMembers = [];
      for (const uid of memberUids) {
        const userProfile = (await rtdbService.getData(`users/${uid}`)) || {};
        const memberMeta = membersObj[uid] || {};
        teamMembers.push({
          id: uid,
          name: userProfile.displayName || userProfile.email || 'Team Member',
          role: memberMeta.role || 'Contributor',
        });
      }

      const discussionsObj = (await rtdbService.getData(`discussions/${mvpIdea.ideaId}`)) || {};
      const allDiscussions = Object.values(discussionsObj).filter((d) => d && !d.isDeleted);

      const suggestions = [];
      const comments = [];
      const questions = [];

      for (const item of allDiscussions) {
        const cleanItem = {
          id: item.discussionId || item.id,
          authorName: item.authorName || 'Collaborator',
          message: (item.message || '').trim(),
          isAccepted: Boolean(item.isAccepted),
          createdAt: item.createdAt || Date.now(),
        };

        if (item.type === 'suggestion') {
          suggestions.push(cleanItem);
        } else if (item.type === 'question') {
          questions.push(cleanItem);
        } else {
          comments.push(cleanItem);
        }
      }

      const inputContractPayload = {
        ideaTitle: (mvpIdea.title || '').trim(),
        problemStatement: (mvpIdea.problemStatement || '').trim(),
        description: (mvpIdea.proposedSolution || mvpIdea.description || mvpIdea.problemStatement || '').trim(),
        techStack: (mvpIdea.techStack || '').trim() || undefined,
        teamMembers,
        suggestions,
        comments,
        questions,
      };

      return inputContractPayload;
    } catch (error) {
      console.error('[aiBlueprintService] prepareAiInputContext error:', error);
      throw new Error(error.message || getErrorMessage(error.code || 'default'));
    }
  },

  /**
   * Create or update initial Blueprint metadata record (state: 'not_created').
   */
  initializeBlueprintRecord: async (workspaceId, mvpIdea, userUid) => {
    if (!workspaceId || !mvpIdea) return null;

    const timestamp = Date.now();
    const blueprintData = {
      blueprintId: `bp_${workspaceId}_${mvpIdea.ideaId}`,
      workspaceId,
      orgId: workspaceId,
      mvpIdeaId: mvpIdea.ideaId,
      ideaId: mvpIdea.ideaId,
      version: '1.0',
      status: 'not_created',
      
      aiProvider: null,
      aiModel: null,
      generatedAt: null,
      updatedAt: timestamp,
      generatedBy: null,
      createdBy: userUid || null,
      createdAt: timestamp,

      ideaTitle: mvpIdea.title || '',
      problemStatement: mvpIdea.problemStatement || '',
      description: mvpIdea.proposedSolution || mvpIdea.description || '',
      techStack: mvpIdea.techStack || '',
      authorId: mvpIdea.authorId || mvpIdea.createdBy || '',
      authorName: mvpIdea.authorName || 'Team Member',

      discussionSummary: {
        commentCount: mvpIdea.commentCount || 0,
        suggestionCount: mvpIdea.suggestionCount || 0,
        acceptedSuggestionsCount: 0,
        acceptedSuggestionsList: [],
      },
    };

    await Promise.all([
      rtdbService.setData(`blueprints/${workspaceId}/${mvpIdea.ideaId}`, blueprintData),
      rtdbService.setData(`blueprints/${workspaceId}/current`, blueprintData),
      rtdbService.setData(`blueprints/${workspaceId}`, blueprintData),
    ]);

    return blueprintData;
  },
};
