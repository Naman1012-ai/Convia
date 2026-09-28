import { rtdbService } from '../services/rtdbService.js';
import { requireWorkspaceMember } from '../utils/workspaceAuthHelper.js';
import { aiBlueprintService } from '../services/aiBlueprintService.js';
import { geminiService } from '../services/ai/geminiService.js';
import { validateBlueprintOutput } from '../services/ai/blueprintValidator.js';
import { taskSyncService } from '../services/ai/taskSyncService.js';
import { blueprintStalenessEngine } from '../services/ai/blueprintStalenessEngine.js';
import { blueprintComparisonEngine } from '../services/ai/blueprintComparisonEngine.js';
import { blueprintApprovalEngine } from '../services/ai/blueprintApprovalEngine.js';
import { aiConcurrencyGuard } from '../services/aiConcurrencyGuard.js';
import {
  extractCanonicalVersionKey,
  extractCanonicalVersionNumber,
  validatePathSegment,
} from '../utils/blueprintPathBuilder.js';
import { notificationService } from '../services/notificationService.js';
import { NOTIFICATION_TYPES } from '../constants/notificationConstants.js';
import { activityService } from '../services/activityService.js';
import { ACTIVITY_EVENT_TYPES } from '../constants/activityConstants.js';

/**
 * Helper function to sanitize project title for safe filesystem download naming.
 */
function sanitizeFilename(title = 'Project', version = '1.0', ext = 'json') {
  const safeTitle = String(title)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'project';
  const safeVersion = String(version).replace(/[^a-zA-Z0-9.-]/g, '');
  return `convia-blueprint-${safeTitle}-v${safeVersion}.${ext}`;
}

/**
 * Helper function to create a clean version snapshot for RTDB version history.
 * Strips the nested `.versions` dictionary to prevent recursive exponential document bloat.
 */
function cleanVersionSnapshot(doc) {
  if (!doc || typeof doc !== 'object') return doc;
  const snapshot = { ...doc };
  delete snapshot.versions;
  return snapshot;
}

/**
 * Backend Controller for Blueprint & Community Intelligence Operations.
 * Manages server-side verification, dynamic MVP source-of-truth validation,
 * duplicate generation locks, stale generation recovery, versioning, manual editing persistence,
 * export validation, fail-safe error handling, and server logging.
 */
export const blueprintController = {
  /**
   * Authoritatively verify user membership and retrieve workspace metadata.
   * Checks both organizations and workspaces paths and member collections.
   */
  verifyWorkspaceMembership: async (
    workspaceId,
    userUid,
    unauthorizedMsg = 'Unauthorized. You must be a member of this workspace to perform this action.',
    options = {}
  ) => {
    if (!workspaceId || !userUid) {
      const err = new Error('Workspace ID and User UID are required.');
      err.statusCode = 400;
      err.code = 'INVALID_PARAMETERS';
      throw err;
    }

    const { org, isOwner, role, memberRecord } = await requireWorkspaceMember(
      workspaceId,
      userUid,
      unauthorizedMsg
    );

    const userRecord = await rtdbService.getData(`users/${userUid}`);
    const userName = userRecord?.displayName || userRecord?.name || userRecord?.email?.split('@')[0] || 'Team Member';

    return {
      org,
      isOwner,
      role,
      memberRecord,
      userRecord,
      userName,
    };
  },

  /**
   * Enforce that mutating Blueprint operations are forbidden for users with 'viewer' role.
   */
  assertMutationAllowed: (role, operationName = 'modify the Blueprint') => {
    if (role === 'viewer') {
      const err = new Error(`Unauthorized. Viewers have read-only access and cannot ${operationName}.`);
      err.statusCode = 403;
      err.code = 'FORBIDDEN_VIEWER';
      throw err;
    }
  },

  /**
   * Authoritatively resolve the active MVP idea ID for a workspace.
   */
  resolveActiveMvpId: async (workspaceId, org = {}, wsMeta = null) => {
    let activeMvpId = org?.activeProjectId || org?.selectedIdeaId || org?.activeMvpId;

    if (!activeMvpId && wsMeta) {
      activeMvpId = wsMeta.selectedIdeaId || wsMeta.activeProjectId || wsMeta.activeMvpId;
    }

    if (!activeMvpId) {
      const meta = await rtdbService.getData(`workspaces/${workspaceId}/metadata`);
      activeMvpId = meta?.selectedIdeaId || meta?.activeProjectId || meta?.activeMvpId;
    }

    if (!activeMvpId) {
      const ideasObj = (await rtdbService.getData(`ideas/${workspaceId}`)) || {};
      const selectedIdea = Object.values(ideasObj).find(
        (i) => i && !i.isDeleted && (
          i.isSelected === true ||
          i.status === 'selected' ||
          i.status === 'Selected MVP' ||
          i.projectStatus === 'Selected MVP' ||
          i.isMvp === true
        )
      );
      if (selectedIdea) {
        activeMvpId = selectedIdea.ideaId || selectedIdea.id;
      }
    }

    return activeMvpId || null;
  },

  /**
   * Authoritatively resolve the active workspace, active MVP idea ID, and active Blueprint document.
   */
  resolveActiveBlueprintRecord: async (workspaceId, userUid) => {
    if (!workspaceId || !userUid) {
      throw new Error('Workspace ID and User UID are required.');
    }

    const { org, isOwner, role, memberRecord, userRecord, userName } = await blueprintController.verifyWorkspaceMembership(
      workspaceId,
      userUid,
      'Unauthorized. You must be a member of this workspace to perform this action.'
    );

    const wsMeta = await rtdbService.getData(`workspaces/${workspaceId}/metadata`).catch(() => null);
    let activeMvpId = await blueprintController.resolveActiveMvpId(workspaceId, org, wsMeta);

    // Fetch Blueprint candidate from all authoritative locations
    let bp = null;
    if (activeMvpId) {
      bp = await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}`);
    }
    if (!bp || !bp.content) {
      const curBp = (await rtdbService.getData(`blueprints/${workspaceId}/current`)) ||
                    (await rtdbService.getData(`blueprints/${workspaceId}/active`));
      if (curBp && curBp.content) {
        bp = curBp;
      }
    }
    if (!bp || !bp.content) {
      const rawRoot = await rtdbService.getData(`blueprints/${workspaceId}`);
      if (rawRoot && typeof rawRoot === 'object') {
        if (rawRoot.content || rawRoot.projectOverview) {
          bp = rawRoot;
        } else if (activeMvpId && rawRoot[activeMvpId] && (rawRoot[activeMvpId].content || rawRoot[activeMvpId].projectOverview)) {
          bp = rawRoot[activeMvpId];
        } else if (rawRoot.current && (rawRoot.current.content || rawRoot.current.projectOverview)) {
          bp = rawRoot.current;
        }
      }
    }

    // Fallback: If retrieved document has no content or is in a stale lock, recover latest completed version snapshot
    if (!bp || !bp.content) {
      const [allMvpVersions, allRootVersions] = await Promise.all([
        activeMvpId ? rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}/versions`).catch(() => null) : null,
        rtdbService.getData(`blueprints/${workspaceId}/versions`).catch(() => null),
      ]);
      const allVersions = {
        ...(bp?.versions || {}),
        ...(allRootVersions || {}),
        ...(allMvpVersions || {}),
      };
      const validVersions = Object.values(allVersions).filter((v) => v && (v.content || v.projectOverview));
      if (validVersions.length > 0) {
        validVersions.sort((a, b) => (parseFloat(b.version) || 0) - (parseFloat(a.version) || 0));
        bp = {
          ...validVersions[0],
          status: 'completed',
          versions: allVersions,
        };
      }
    }

    if (!bp || !bp.content) {
      const err = new Error('No active Blueprint found for this workspace. Please generate a Blueprint first.');
      err.statusCode = 404;
      err.code = 'BLUEPRINT_NOT_FOUND';
      throw err;
    }

    return {
      bp,
      activeMvpId: activeMvpId || bp.mvpIdeaId || bp.ideaId || 'mvp',
      org,
      userRecord,
      userName,
      isOwner,
      role,
      memberRecord,
    };
  },

  /**
   * Authoritatively persist updated Blueprint document across all authoritative paths.
   * Cleans version snapshot before writing to historical collections to prevent recursive nesting.
   */
  persistBlueprintUpdate: async (workspaceId, activeMvpId, updatedBp) => {
    const versionKey = extractCanonicalVersionKey(updatedBp.version) || `v${String(updatedBp.version || '1.0').replace(/\./g, '_')}`;
    const cleanSnapshot = cleanVersionSnapshot(updatedBp);
    const timestamp = updatedBp.updatedAt || Date.now();

    // Check if target version snapshot is already formally approved (approved versions are immutable)
    const existingVersion = (activeMvpId ? await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}/versions/${versionKey}`).catch(() => null) : null) ||
                            (await rtdbService.getData(`blueprints/${workspaceId}/versions/${versionKey}`).catch(() => null));
    const isTargetApproved = existingVersion && existingVersion.approvalStatus === 'approved';

    const savePromises = [
      activeMvpId ? rtdbService.setData(`blueprints/${workspaceId}/${activeMvpId}`, updatedBp) : Promise.resolve(),
      rtdbService.setData(`blueprints/${workspaceId}/current`, updatedBp),
      rtdbService.setData(`blueprints/${workspaceId}/active`, updatedBp),
      rtdbService.updateData(`organizations/${workspaceId}`, {
        activeProjectId: activeMvpId,
        activeBlueprintId: updatedBp.blueprintId,
        updatedAt: timestamp,
      }),
      rtdbService.updateData(`workspaces/${workspaceId}/metadata`, {
        activeProjectId: activeMvpId,
        selectedIdeaId: activeMvpId,
        activeBlueprintId: updatedBp.blueprintId,
        updatedAt: timestamp,
      }),
    ];

    // Preserve version immutability: do not overwrite approved version with unapproved draft edits
    if (!isTargetApproved || updatedBp.approvalStatus === 'approved') {
      if (activeMvpId) {
        savePromises.push(rtdbService.setData(`blueprints/${workspaceId}/${activeMvpId}/versions/${versionKey}`, cleanSnapshot));
      }
      savePromises.push(rtdbService.setData(`blueprints/${workspaceId}/versions/${versionKey}`, cleanSnapshot));
    }

    await Promise.all(savePromises);
  },

  /**
   * Phase 7: Stale Generation Recovery Handler.
   * Auto-detects and rescues generation attempts stuck in 'generating' state longer than 300s.
   */
  recoverStaleGenerationHandler: async (workspaceId, userUid) => {
    if (!workspaceId || !userUid) {
      throw new Error('Workspace ID and User UID are required.');
    }

    const { org, role } = await blueprintController.verifyWorkspaceMembership(
      workspaceId,
      userUid,
      'Unauthorized. You must be a member of this workspace to recover a Blueprint.'
    );
    blueprintController.assertMutationAllowed(role, 'recover a Blueprint');

    const activeMvpId = await blueprintController.resolveActiveMvpId(workspaceId, org);
    if (!activeMvpId) return { recovered: false, reason: 'No active MVP' };

    const existingBp = (await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}`)) || 
                       (await rtdbService.getData(`blueprints/${workspaceId}`));

    if (!existingBp) return { recovered: false, reason: 'No blueprint record found' };

    // Check if stuck in 'generating' state for > 300 seconds (5 minutes)
    const STALE_THRESHOLD_MS = 300000;
    const isStale = existingBp.status === 'generating' && (Date.now() - (existingBp.updatedAt || existingBp.generationStartedAt || 0)) > STALE_THRESHOLD_MS;

    if (isStale) {
      console.warn(`🩹 [Stale Generation Recovery] Rescuing stuck Blueprint generation for workspace ${workspaceId} (MVP: ${activeMvpId})`);

      const timestamp = Date.now();
      const hasPriorValidContent = Boolean(existingBp.content);
      const recoveredStatus = hasPriorValidContent ? 'completed' : 'failed';
      const recoveryMessage = 'Previous generation timed out or was interrupted. Click Regenerate to try again.';

      const recoveryPayload = {
        ...existingBp,
        status: recoveredStatus,
        updatedAt: timestamp,
        generationFailedAt: timestamp,
        lastError: recoveryMessage,
      };

      await Promise.all([
        rtdbService.setData(`blueprints/${workspaceId}/${activeMvpId}`, recoveryPayload),
        rtdbService.setData(`blueprints/${workspaceId}/current`, recoveryPayload),
        rtdbService.setData(`blueprints/${workspaceId}/active`, recoveryPayload),
        rtdbService.setData(`blueprints/${workspaceId}`, recoveryPayload),
      ]);

      console.log(`✅ [Stale Generation Rescued] Workspace ${workspaceId} Blueprint state transitioned to '${recoveredStatus}'.`);
      return { recovered: true, newStatus: recoveredStatus, blueprint: recoveryPayload };
    }

    return { recovered: false, status: existingBp.status };
  },

  /**
   * Protected endpoint handler for generating/regenerating AI Blueprints (Phase 3 & Phase 7).
   */
  generateBlueprintHandler: async (workspaceId, userUid) => {
    if (!workspaceId || !userUid) {
      console.warn('⚠️ [Blueprint Generation Failed] Missing workspaceId or userUid context');
      throw new Error('Workspace ID and User context are required.');
    }

    console.log(`🚀 [Blueprint Generation Started] Workspace: ${workspaceId} | Triggered By User: ${userUid}`);

    // 1. Verify User Membership in Workspace (with 3-attempt polling retry)
    const { org, role } = await blueprintController.verifyWorkspaceMembership(
      workspaceId,
      userUid,
      'Unauthorized. You must be a member of this workspace to generate a Blueprint.',
      { maxRetries: 3, delayMs: 500 }
    );
    blueprintController.assertMutationAllowed(role, 'generate a Blueprint');

    // 2. Resolve Source of Truth Active MVP Idea from RTDB
    const activeMvpId = await blueprintController.resolveActiveMvpId(workspaceId, org);

    if (!activeMvpId) {
      console.warn(`⚠️ [Blueprint Generation Stopped] No selected MVP found for workspace ${workspaceId}`);
      throw new Error('No MVP selected for this workspace. Please select an idea as MVP on the Idea Board.');
    }

    let mvpIdea = await rtdbService.getData(`ideas/${workspaceId}/${activeMvpId}`);
    if (!mvpIdea) {
      const ideasObj = (await rtdbService.getData(`ideas/${workspaceId}`)) || {};
      mvpIdea = ideasObj[activeMvpId] || Object.values(ideasObj).find((i) => i && (i.ideaId === activeMvpId || i.id === activeMvpId));
    }

    if (!mvpIdea || mvpIdea.isDeleted) {
      console.warn(`❌ [Blueprint Generation Stopped] Selected MVP ${activeMvpId} missing or deleted in workspace ${workspaceId}`);
      throw new Error('The selected MVP idea could not be found or has been deleted.');
    }

    console.log(`📌 [Selected MVP Identified] Idea ID: ${activeMvpId} | Title: "${mvpIdea.title}" | Workspace: ${workspaceId}`);

    // Authoritative In-Flight Mutex Lock Acquisition (Prevents duplicate parallel requests)
    const activeLock = aiConcurrencyGuard.acquireLock(workspaceId, userUid, 'generate');
    let currentStage = 'context_preparing';

    try {
      // Record Blueprint Generation Started activity event
      activityService.recordWorkspaceActivity(workspaceId, {
        eventType: ACTIVITY_EVENT_TYPES.BLUEPRINT_GENERATION_STARTED,
        actorId: userUid,
        actorType: 'user',
        actorName: org.members?.[userUid]?.name || 'Team Member',
        resourceType: 'blueprint',
        resourceId: `bp_${workspaceId}_${activeMvpId}`,
        resourceTitle: mvpIdea?.title || 'Workspace MVP',
        summary: `AI Blueprint generation started for "${mvpIdea?.title || 'Workspace MVP'}"`,
        metadata: { ideaId: activeMvpId },
      }).catch((actErr) => console.warn('⚠️ [Blueprint Started Activity Warning]', actErr.message));

      const existingBp = (await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}`)) || 
                         (await rtdbService.getData(`blueprints/${workspaceId}`));

      // Multi-source version recovery: merge both MVP-specific and root version collections
      const [mvpVersionsRaw, rootVersionsRaw] = await Promise.all([
        activeMvpId ? rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}/versions`).catch(() => null) : null,
        rtdbService.getData(`blueprints/${workspaceId}/versions`).catch(() => null),
      ]);

      const rawVersions = {};
      const mergeVersionsIntoMap = (src) => {
        if (!src || typeof src !== 'object') return;
        const dict = src.versions && typeof src.versions === 'object' ? src.versions : src;
        Object.entries(dict).forEach(([k, v]) => {
          if (v && typeof v === 'object' && (v.content || v.projectOverview || v.status || v.version)) {
            rawVersions[k] = cleanVersionSnapshot(v);
          }
        });
      };
      mergeVersionsIntoMap(rootVersionsRaw);
      mergeVersionsIntoMap(mvpVersionsRaw);
      if (existingBp?.versions) mergeVersionsIntoMap(existingBp.versions);

      const versionNumbers = [];
      if (existingBp?.version && existingBp?.content) {
        const v = parseFloat(existingBp.version);
        if (!isNaN(v)) versionNumbers.push(v);
      }
      Object.keys(rawVersions || {}).forEach((k) => {
        const verObj = rawVersions[k];
        if (verObj && (verObj.content || verObj.projectOverview)) {
          const verStr = verObj?.version || k.replace(/^v/, '').replace(/_/g, '.');
          const v = parseFloat(verStr);
          if (!isNaN(v)) versionNumbers.push(v);
        }
      });

      const maxVersion = versionNumbers.length > 0 ? Math.max(...versionNumbers) : 0;
      const nextVersion = maxVersion > 0 ? (maxVersion + 1.0).toFixed(1) : '1.0';
      const parentVersion = maxVersion > 0 ? maxVersion.toFixed(1) : null;
      const isRegeneration = maxVersion >= 1.0;

      if (existingBp?.status === 'generating') {
        const isStaleLock = Date.now() - (existingBp.updatedAt || existingBp.generationStartedAt || 0) > 300000;
        if (!isStaleLock) {
          console.warn(`🔒 [Duplicate Generation Prevented] Generation already in progress for workspace ${workspaceId}`);
          const err = new Error('Blueprint generation is already in progress for this workspace.');
          err.statusCode = 409;
          err.code = 'AI_OPERATION_IN_PROGRESS';
          throw err;
        }
      }

      const timestamp = Date.now();
      const attemptId = activeLock.attemptId;

      await Promise.all([
        rtdbService.updateData(`blueprints/${workspaceId}/${activeMvpId}`, {
          status: 'generating',
          generationStage: 'context_preparing',
          version: nextVersion,
          activeVersionId: nextVersion,
          updatedAt: timestamp,
          generationStartedAt: timestamp,
          generationAttemptId: attemptId,
        }),
        rtdbService.updateData(`blueprints/${workspaceId}/current`, {
          status: 'generating',
          generationStage: 'context_preparing',
          version: nextVersion,
          activeVersionId: nextVersion,
          updatedAt: timestamp,
          generationStartedAt: timestamp,
          generationAttemptId: attemptId,
        }),
        rtdbService.updateData(`blueprints/${workspaceId}/active`, {
          status: 'generating',
          generationStage: 'context_preparing',
          version: nextVersion,
          activeVersionId: nextVersion,
          updatedAt: timestamp,
          generationStartedAt: timestamp,
          generationAttemptId: attemptId,
        }),
      ]);

      // Stage 1: Context Preparation & Intelligence Assembly
      const aiInputPayload = await aiBlueprintService.prepareAiInputContext(workspaceId, mvpIdea);
      aiInputPayload.isRegeneration = isRegeneration;
      aiInputPayload.nextVersion = nextVersion;

      // Transition to Stage 2: AI Synthesis (Google Gemini)
      currentStage = 'ai_synthesis';
      await Promise.all([
        rtdbService.updateData(`blueprints/${workspaceId}/${activeMvpId}`, {
          generationStage: 'ai_synthesis',
          updatedAt: Date.now(),
        }),
        rtdbService.updateData(`blueprints/${workspaceId}/current`, {
          generationStage: 'ai_synthesis',
          updatedAt: Date.now(),
        }),
      ]);

      console.log(`🤖 [AI Generation Requested] Model: ${process.env.GEMINI_MODEL || 'gemini-2.0-flash'} | Version: ${nextVersion} (Regeneration: ${isRegeneration}) | Workspace: ${workspaceId}`);

      const geminiResult = await geminiService.generateBlueprintFromContext(aiInputPayload);

      // Transition to Stage 3: Schema 2 & Dependency Graph Validation
      currentStage = 'validating_schema';
      await Promise.all([
        rtdbService.updateData(`blueprints/${workspaceId}/${activeMvpId}`, {
          generationStage: 'validating_schema',
          updatedAt: Date.now(),
        }),
        rtdbService.updateData(`blueprints/${workspaceId}/current`, {
          generationStage: 'validating_schema',
          updatedAt: Date.now(),
        }),
      ]);

      console.log(`✨ [AI Response Received & Schema Validated] Canonical Blueprint 2.0 (8 Components) confirmed for workspace ${workspaceId} (v${nextVersion})`);

      // Phase 9: Pre-commit compare-and-set to guarantee generation lock ownership and prevent race overwrite
      const currentLock = (await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}`)) || {};
      if (currentLock.generationAttemptId && currentLock.generationAttemptId !== attemptId) {
        console.warn(`⚠️ [Generation Race Prevented] Attempt ${attemptId} superseded by ${currentLock.generationAttemptId}. Discarding stale result.`);
        return {
          success: false,
          reason: 'superseded',
          message: 'A newer Blueprint generation attempt was started. Stale generation result safely discarded.',
        };
      }

      // Transition to Stage 4: Version Snapshotting & Database Persistence
      currentStage = 'persisting';
      await Promise.all([
        rtdbService.updateData(`blueprints/${workspaceId}/${activeMvpId}`, {
          generationStage: 'persisting',
          updatedAt: Date.now(),
        }),
        rtdbService.updateData(`blueprints/${workspaceId}/current`, {
          generationStage: 'persisting',
          updatedAt: Date.now(),
        }),
      ]);

      const sourceContextHash = blueprintStalenessEngine.computeSourceContextHash(aiInputPayload);
      const versionKey = `v${nextVersion.replace(/\./g, '_')}`;

      const completeBlueprintDocument = {
        blueprintId: `bp_${workspaceId}_${activeMvpId}`,
        workspaceId,
        orgId: workspaceId,
        mvpIdeaId: activeMvpId,
        ideaId: activeMvpId,
        versionId: nextVersion,
        activeVersionId: nextVersion,
        activeVersionKey: versionKey,
        version: nextVersion,
        parentVersion,
        generationId: attemptId,
        sourceContextHash,
        lineage: {
          parentVersion,
          generationId: attemptId,
          generatedBy: userUid,
          generatedAt: timestamp,
        },
        schemaVersion: geminiResult.blueprintContent?.schemaVersion || 2,
        status: 'completed',
        lifecycleState: 'ready_for_review',
        approvalStatus: 'pending_approval',
        approvedAt: null,
        approvedBy: null,
        generationStage: 'completed',
        timestamp: Date.now(),
        generatedAt: timestamp,
        updatedAt: Date.now(),
        lastModifiedSource: 'ai_generation',
        aiProvider: 'google_gemini',
        aiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',

        ideaTitle: mvpIdea.title,
        problemStatement: mvpIdea.problemStatement || '',
        description: mvpIdea.description || '',

        content: geminiResult.blueprintContent,
        communityIntelligenceStatus: geminiResult.communityIntelligence ? 'completed' : 'not_available',
        executionTimeline: {
          totalTasks: geminiResult.blueprintContent?.execution?.tasks?.length || 0,
          criticalPathLength: geminiResult.blueprintContent?.execution?.criticalPathTaskIds?.length || 0,
          wavesCount: geminiResult.blueprintContent?.execution?.executionWaves?.length || 0,
          waves: (geminiResult.blueprintContent?.execution?.executionWaves || []).map((w) => ({
            waveIndex: w.waveIndex,
            waveName: w.waveName,
            taskCount: w.taskIds?.length || 0,
            estimatedHours: w.estimatedHours || 0,
          })),
        },
      };

      // Only attach optional communityIntelligence if explicitly provided by intelligence engine
      if (geminiResult.communityIntelligence) {
        completeBlueprintDocument.communityIntelligence = geminiResult.communityIntelligence;
      }

      // Validate required Canonical Blueprint 2.0 fields before initiating persistence
      const requiredFields = ['blueprintId', 'workspaceId', 'mvpIdeaId', 'version', 'status', 'content', 'schemaVersion'];
      for (const field of requiredFields) {
        if (!completeBlueprintDocument[field]) {
          console.error(`🚨 [Blueprint Persistence Validation Failed] Missing required field '${field}' for workspace ${workspaceId} (v${nextVersion})`);
          throw new Error(`Missing required Blueprint field: '${field}' for workspace ${workspaceId} (v${nextVersion}) at persistence stage.`);
        }
      }
      console.log(`✅ [Blueprint Persistence Validation] Canonical object validated for workspace ${workspaceId} (v${nextVersion})`);

      console.log(`💾 [Blueprint Persistence Started] Saving Version ${nextVersion} to RTDB version history...`);

      const existingVersions = { ...rawVersions };

      if (existingBp && existingBp.version && existingBp.content) {
        const prevVersionKey = `v${String(existingBp.version).replace(/\./g, '_')}`;
        existingVersions[prevVersionKey] = cleanVersionSnapshot(existingBp);
      }

      const newSnapshot = cleanVersionSnapshot(completeBlueprintDocument);
      existingVersions[versionKey] = newSnapshot;

      completeBlueprintDocument.versions = existingVersions;

      const savePromises = [
        rtdbService.setData(`blueprints/${workspaceId}/${activeMvpId}`, completeBlueprintDocument),
        rtdbService.setData(`blueprints/${workspaceId}/current`, completeBlueprintDocument),
        rtdbService.setData(`blueprints/${workspaceId}/active`, completeBlueprintDocument),
        rtdbService.updateData(`organizations/${workspaceId}`, {
          activeProjectId: activeMvpId,
          activeBlueprintId: completeBlueprintDocument.blueprintId,
          updatedAt: Date.now(),
        }),
        rtdbService.updateData(`workspaces/${workspaceId}/metadata`, {
          activeProjectId: activeMvpId,
          selectedIdeaId: activeMvpId,
          activeBlueprintId: completeBlueprintDocument.blueprintId,
          updatedAt: Date.now(),
        }),
      ];

      for (const [vKey, vSnap] of Object.entries(existingVersions)) {
        const cleanSnap = cleanVersionSnapshot(vSnap);
        savePromises.push(rtdbService.setData(`blueprints/${workspaceId}/${activeMvpId}/versions/${vKey}`, cleanSnap));
        savePromises.push(rtdbService.setData(`blueprints/${workspaceId}/versions/${vKey}`, cleanSnap));
      }

      await Promise.all(savePromises);

      console.log(`🎉 [Blueprint Generation Completed] Version ${nextVersion} successfully saved to version history for workspace ${workspaceId}`);

      // Phase 11 / Post-Phase-11: Automatically synchronize Blueprint planned tasks to Task Board
      await taskSyncService.synchronizeBlueprintTasks(workspaceId, completeBlueprintDocument, userUid).catch((syncErr) => {
        console.warn('⚠️ [TaskSync Auto-trigger Warning]', syncErr.message);
      });

      // Phase 7: Dispatch Blueprint Completed notification to initiator
      notificationService.dispatchNotificationEvent(
        NOTIFICATION_TYPES.BLUEPRINT_COMPLETED,
        {
          workspaceId,
          mvpIdeaId: activeMvpId,
          resourceId: completeBlueprintDocument.blueprintId || `bp_${workspaceId}_${activeMvpId}`,
          version: nextVersion,
          secondaryEntityId: String(nextVersion),
          ideaTitle: mvpIdea?.title || 'Workspace MVP',
          initiatorUid: userUid,
          attemptId,
        },
        { uid: userUid, displayName: memberRecord?.displayName || 'Team Member' }
      ).catch((notifErr) => {
        console.warn('⚠️ [Blueprint Completed Notification Warning]', notifErr.message);
      });

      // Phase 8: Record Blueprint Generation Completed activity event
      activityService.recordWorkspaceActivity(workspaceId, {
        eventType: ACTIVITY_EVENT_TYPES.BLUEPRINT_GENERATION_COMPLETED,
        actorId: 'system',
        actorType: 'system',
        actorName: 'Convia AI Engine',
        resourceType: 'blueprint',
        resourceId: `bp_${workspaceId}_${activeMvpId}`,
        resourceTitle: mvpIdea?.title || 'Workspace MVP',
        summary: `AI Blueprint generation completed for "${mvpIdea?.title || 'Workspace MVP'}" (v${nextVersion})`,
        metadata: { version: nextVersion, ideaId: activeMvpId },
      }).catch((actErr) => console.warn('⚠️ [Blueprint Completed Activity Warning]', actErr.message));

      return {
        success: true,
        blueprint: completeBlueprintDocument,
      };
    } catch (error) {
      console.error(`💥 [Blueprint Generation Failed] Workspace: ${workspaceId} | Reason:`, error.message);

      const errTimestamp = Date.now();
      const friendlyError = error.message?.includes('set failed') || error.message?.includes('undefined in property')
        ? 'Blueprint generation could not be saved to workspace database. Previous version preserved.'
        : (error.message || 'Blueprint generation failed. Previous version preserved.');

      const existingBp = (await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}`).catch(() => null)) || 
                         (await rtdbService.getData(`blueprints/${workspaceId}`).catch(() => null));

      if (existingBp && existingBp.status === 'completed' && existingBp.content) {
        await Promise.all([
          rtdbService.updateData(`blueprints/${workspaceId}/${activeMvpId}`, {
            status: 'completed',
            generationStage: 'failed',
            failedStage: currentStage,
            version: existingBp.version,
            activeVersionId: existingBp.version,
            updatedAt: errTimestamp,
            generationFailedAt: errTimestamp,
            lastError: friendlyError,
          }),
          rtdbService.updateData(`blueprints/${workspaceId}/current`, {
            status: 'completed',
            generationStage: 'failed',
            failedStage: currentStage,
            version: existingBp.version,
            activeVersionId: existingBp.version,
            updatedAt: errTimestamp,
            generationFailedAt: errTimestamp,
            lastError: friendlyError,
          }),
          rtdbService.updateData(`blueprints/${workspaceId}/active`, {
            status: 'completed',
            generationStage: 'failed',
            failedStage: currentStage,
            version: existingBp.version,
            activeVersionId: existingBp.version,
            updatedAt: errTimestamp,
            generationFailedAt: errTimestamp,
            lastError: friendlyError,
          }),
        ]);
        console.log(`🛡️ [Fail-Safe Preservation] Preserved existing Version ${existingBp.version} for workspace ${workspaceId}`);
      } else {
        await Promise.all([
          rtdbService.updateData(`blueprints/${workspaceId}/${activeMvpId}`, {
            status: 'failed',
            generationStage: 'failed',
            failedStage: currentStage,
            updatedAt: errTimestamp,
            generationFailedAt: errTimestamp,
            lastError: friendlyError,
          }),
          rtdbService.updateData(`blueprints/${workspaceId}/current`, {
            status: 'failed',
            generationStage: 'failed',
            failedStage: currentStage,
            updatedAt: errTimestamp,
            generationFailedAt: errTimestamp,
            lastError: friendlyError,
          }),
          rtdbService.updateData(`blueprints/${workspaceId}/active`, {
            status: 'failed',
            generationStage: 'failed',
            failedStage: currentStage,
            updatedAt: errTimestamp,
            generationFailedAt: errTimestamp,
            lastError: friendlyError,
          }),
        ]);
      }

      // Phase 7: Dispatch Blueprint Failed notification to initiator
      notificationService.dispatchNotificationEvent(
        NOTIFICATION_TYPES.BLUEPRINT_FAILED,
        {
          workspaceId,
          mvpIdeaId: activeMvpId,
          resourceId: `bp_${workspaceId}_${activeMvpId}`,
          ideaTitle: existingBp?.ideaTitle || 'Workspace MVP',
          errorReason: friendlyError,
          initiatorUid: userUid,
          attemptId,
        },
        { uid: userUid }
      ).catch((notifErr) => {
        console.warn('⚠️ [Blueprint Failed Notification Warning]', notifErr.message);
      });

      // Phase 8: Record Blueprint Generation Failed activity event
      activityService.recordWorkspaceActivity(workspaceId, {
        eventType: ACTIVITY_EVENT_TYPES.BLUEPRINT_GENERATION_FAILED,
        actorId: 'system',
        actorType: 'system',
        actorName: 'Convia AI Engine',
        resourceType: 'blueprint',
        resourceId: `bp_${workspaceId}_${activeMvpId}`,
        resourceTitle: 'Workspace MVP',
        summary: `AI Blueprint generation failed for "${existingBp?.ideaTitle || 'Workspace MVP'}"`,
        metadata: { error: friendlyError, ideaId: activeMvpId },
      }).catch((actErr) => console.warn('⚠️ [Blueprint Failed Activity Warning]', actErr.message));

      throw new Error(`Blueprint generation failed: ${friendlyError}`);
    } finally {
      if (activeLock) {
        aiConcurrencyGuard.releaseLock(activeLock.lockKey, activeLock.attemptId);
      }
    }
  },

  /**
   * Phase 5 & Phase 9: Protected Endpoint Handler for Saving Manual Blueprint Edits with Optimistic Concurrency.
   */
  updateBlueprintHandler: async (workspaceId, userUid, payload) => {
    if (!workspaceId || !userUid || !payload) {
      throw new Error('Workspace ID, User UID, and Updated Content payload are required.');
    }

    console.log(`✏️ [Blueprint Manual Update Started] Workspace: ${workspaceId} | User: ${userUid}`);

    const { bp: existingBp, activeMvpId, role } = await blueprintController.resolveActiveBlueprintRecord(workspaceId, userUid);
    blueprintController.assertMutationAllowed(role, 'update the Blueprint');

    let rawContent = payload;
    let expectedUpdatedAt = null;
    let expectedVersion = null;

    if (payload && typeof payload === 'object' && payload.content) {
      rawContent = payload.content;
      expectedUpdatedAt = payload.expectedUpdatedAt;
      expectedVersion = payload.expectedVersion;
    }

    // Phase 9: Optimistic Concurrency Validation
    if (expectedUpdatedAt && existingBp.updatedAt && existingBp.updatedAt > expectedUpdatedAt) {
      console.warn(`⚠️ [Concurrency Conflict] Blueprint was modified at ${existingBp.updatedAt}, but client expected ${expectedUpdatedAt}`);
      const err = new Error('Blueprint has been modified by another collaborator or a newer version was generated since you opened it. Please review latest changes before saving.');
      err.statusCode = 409;
      err.code = 'VERSION_CONFLICT';
      throw err;
    }
    if (expectedVersion && existingBp.version && String(existingBp.version) !== String(expectedVersion)) {
      console.warn(`⚠️ [Concurrency Conflict] Active version is ${existingBp.version}, but client expected ${expectedVersion}`);
      const err = new Error('Active Blueprint version changed since you opened it. Please reload the latest version.');
      err.statusCode = 409;
      err.code = 'VERSION_CONFLICT';
      throw err;
    }

    const validatedContent = validateBlueprintOutput(rawContent);
    const timestamp = Date.now();

    const updatedBlueprintDocument = {
      ...existingBp,
      updatedAt: timestamp,
      updatedBy: userUid,
      schemaVersion: validatedContent.schemaVersion || existingBp.schemaVersion || 2,
      lastModifiedSource: 'manual',
      content: validatedContent,
    };

    console.log(`💾 [Blueprint Manual Update Persistence] Saving edits for MVP ${activeMvpId}...`);

    await blueprintController.persistBlueprintUpdate(workspaceId, activeMvpId, updatedBlueprintDocument);

    console.log(`✅ [Blueprint Manual Update Completed] Changes saved successfully for workspace ${workspaceId}`);

    // Automatically synchronize updated Blueprint tasks to Task Board
    await taskSyncService.synchronizeBlueprintTasks(workspaceId, updatedBlueprintDocument, userUid).catch((syncErr) => {
      console.warn('⚠️ [TaskSync Auto-trigger Warning]', syncErr.message);
    });

    return {
      success: true,
      blueprint: updatedBlueprintDocument,
    };
  },

  /**
   * Phase 11 / Post-Phase-11: Authoritative Endpoint for Retrieving the Active or Snapshot Blueprint Document.
   */
  getActiveBlueprintHandler: async (workspaceId, userUid, targetVersion = null) => {
    if (!workspaceId || !userUid) throw new Error('Workspace ID and User UID are required.');

    const { org } = await blueprintController.verifyWorkspaceMembership(
      workspaceId,
      userUid,
      'Unauthorized. You must be a member of this workspace to view the Blueprint.'
    );

    const activeMvpId = await blueprintController.resolveActiveMvpId(workspaceId, org);

    let bp = null;
    if (activeMvpId) {
      bp = await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}`);
    }
    if (!bp) {
      bp = (await rtdbService.getData(`blueprints/${workspaceId}/current`)) ||
           (await rtdbService.getData(`blueprints/${workspaceId}/active`));
    }
    if (!bp) {
      const rawRoot = await rtdbService.getData(`blueprints/${workspaceId}`);
      if (rawRoot && (rawRoot.content || rawRoot.projectOverview || rawRoot.schemaVersion)) {
        bp = rawRoot;
      }
    }

    if (!bp) return { blueprint: null };

    // Safely extract canonical target version key and number to prevent [object Object] coercion
    const targetVerKey = extractCanonicalVersionKey(targetVersion);
    const targetVerNum = extractCanonicalVersionNumber(targetVersion);
    const hasSpecificTarget = Boolean(targetVerKey && targetVerKey !== 'current');

    // Fallback: If root document has no content or status is stale generating, recover latest completed version
    if ((!bp.content || bp.status === 'generating') && !hasSpecificTarget) {
      const [allMvpVersions, allRootVersions] = await Promise.all([
        activeMvpId ? rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}/versions`).catch(() => null) : null,
        rtdbService.getData(`blueprints/${workspaceId}/versions`).catch(() => null),
      ]);
      const allVersions = {
        ...(bp.versions || {}),
        ...(allRootVersions || {}),
        ...(allMvpVersions || {}),
      };
      const validVersions = Object.values(allVersions).filter((v) => v && (v.content || v.projectOverview));
      if (validVersions.length > 0) {
        validVersions.sort((a, b) => (parseFloat(b.version) || 0) - (parseFloat(a.version) || 0));
        const latestValid = validVersions[0];
        bp = {
          ...latestValid,
          status: 'completed',
          versions: allVersions,
        };
      }
    }

    // If targetVersion requested, look up specific version snapshot
    if (hasSpecificTarget && String(targetVerNum) !== String(bp.version)) {
      const vSnap = (activeMvpId ? await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}/versions/${targetVerKey}`) : null) ||
                    (await rtdbService.getData(`blueprints/${workspaceId}/versions/${targetVerKey}`)) ||
                    bp.versions?.[targetVerKey];
      if (vSnap) {
        return { blueprint: vSnap, isVersionSnapshot: true };
      }
    }

    return { blueprint: bp, isVersionSnapshot: false };
  },

  /**
   * Phase 11 / Post-Phase-11: Authoritative Endpoint for Retrieving all Persisted Blueprint Versions.
   */
  getBlueprintVersionsHandler: async (workspaceId, userUid) => {
    if (!workspaceId || !userUid) throw new Error('Workspace ID and User UID are required.');

    const { org } = await blueprintController.verifyWorkspaceMembership(
      workspaceId,
      userUid,
      'Unauthorized. You must be a member of this workspace to view versions.'
    );

    const activeMvpId = await blueprintController.resolveActiveMvpId(workspaceId, org);

    const [mvpVersionsRaw, rootVersionsRaw, curBp] = await Promise.all([
      activeMvpId ? rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}/versions`).catch(() => null) : null,
      rtdbService.getData(`blueprints/${workspaceId}/versions`).catch(() => null),
      activeMvpId ? rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}`).catch(() => null) : null,
    ]);

    const mergedVersionsMap = {};

    const mergeSource = (src) => {
      if (!src || typeof src !== 'object') return;
      const map = src.versions && typeof src.versions === 'object' ? src.versions : src;
      Object.entries(map).forEach(([k, v]) => {
        if (v && typeof v === 'object' && (v.content || v.projectOverview || v.version || v.status)) {
          mergedVersionsMap[k] = { ...(mergedVersionsMap[k] || {}), ...v };
        }
      });
    };

    mergeSource(rootVersionsRaw);
    mergeSource(mvpVersionsRaw);
    if (curBp?.versions) mergeSource(curBp.versions);

    // If current active blueprint has valid content and version, ensure it exists in the map
    if (curBp && curBp.version && (curBp.content || curBp.projectOverview)) {
      const activeKey = extractCanonicalVersionKey(curBp.version) || `v${String(curBp.version).replace(/\./g, '_')}`;
      if (!mergedVersionsMap[activeKey]) {
        mergedVersionsMap[activeKey] = cleanVersionSnapshot(curBp);
      }
    }

    const list = Object.entries(mergedVersionsMap).map(([k, v]) => ({
      key: k,
      version: String(v.version || v.versionId || k.replace(/^v/, '').replace(/_/g, '.') || '1.0'),
      versionId: v.versionId || v.version || k,
      status: v.status || 'completed',
      approvalStatus: v.approvalStatus || (v.status === 'completed' ? 'approved' : 'pending_approval'),
      createdAt: v.createdAt || v.generatedAt || Date.now(),
      updatedAt: v.updatedAt || Date.now(),
      lastModifiedSource: v.lastModifiedSource || 'ai_generation',
      summary: v.summary || `Version ${v.version || '1.0'}`,
    }));

    list.sort((a, b) => (parseFloat(b.version) || 0) - (parseFloat(a.version) || 0));
    return { versions: list };
  },

  /**
   * Phase 9: Explicit Blueprint Version Activation Handler.
   * Authoritatively promotes a historical version snapshot to become the active approved Blueprint.
   */
  activateBlueprintVersionHandler: async (workspaceId, userUid, payload = {}) => {
    const cleanVerKey = extractCanonicalVersionKey(payload);
    if (!workspaceId || !userUid || !cleanVerKey) {
      throw new Error('Workspace ID, User UID, and a valid Target Version Key (e.g. "1.0" or "v1_0") are required.');
    }

    console.log(`⭐ [Blueprint Version Activation Requested] Workspace: ${workspaceId} | Target: ${cleanVerKey} | Caller: ${userUid}`);

    const { org, role } = await blueprintController.verifyWorkspaceMembership(
      workspaceId,
      userUid,
      'Unauthorized. You must be a member of this workspace to activate a Blueprint version.'
    );
    blueprintController.assertMutationAllowed(role, 'activate a Blueprint version');

    const activeMvpId = await blueprintController.resolveActiveMvpId(workspaceId, org);

    const currentBp = (activeMvpId ? await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}`) : null) ||
                      (await rtdbService.getData(`blueprints/${workspaceId}/current`)) ||
                      {};

    const targetVersionDoc = (activeMvpId ? await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}/versions/${cleanVerKey}`) : null) ||
                             (await rtdbService.getData(`blueprints/${workspaceId}/versions/${cleanVerKey}`)) ||
                             currentBp.versions?.[cleanVerKey];

    if (!targetVersionDoc || (!targetVersionDoc.content && !targetVersionDoc.projectOverview)) {
      throw new Error(`Target Blueprint version '${cleanVerKey}' was not found or is invalid.`);
    }

    const timestamp = Date.now();
    const verNumber = String(targetVersionDoc.version || targetVersionDoc.versionId || cleanVerKey.replace(/^v/, '').replace(/_/g, '.') || '1.0');

    // Build activated document
    const activatedDocument = {
      ...targetVersionDoc,
      status: 'completed',
      activeVersionId: verNumber,
      version: verNumber,
      updatedAt: timestamp,
      activatedAt: timestamp,
      activatedBy: userUid,
      lastModifiedSource: targetVersionDoc.lastModifiedSource || 'version_activation',
    };

    const cleanActivatedSnapshot = cleanVersionSnapshot(activatedDocument);

    // If current was a different version, record superseded metadata on old version snapshot
    if (currentBp.version && String(currentBp.version) !== verNumber) {
      const oldVerKey = extractCanonicalVersionKey(currentBp.version) || `v${String(currentBp.version).replace(/\./g, '_')}`;
      const oldSnapshot = cleanVersionSnapshot({
        ...currentBp,
        status: 'superseded',
        supersededAt: timestamp,
        supersededBy: userUid,
      });
      await Promise.all([
        activeMvpId ? rtdbService.setData(`blueprints/${workspaceId}/${activeMvpId}/versions/${oldVerKey}`, oldSnapshot) : Promise.resolve(),
        rtdbService.setData(`blueprints/${workspaceId}/versions/${oldVerKey}`, oldSnapshot),
      ]).catch((e) => console.warn('[Version Superseded Stamp Warning]', e.message));
    }

    // Persist activated snapshot to all authoritative active locations
    await Promise.all([
      activeMvpId ? rtdbService.setData(`blueprints/${workspaceId}/${activeMvpId}`, activatedDocument) : Promise.resolve(),
      rtdbService.setData(`blueprints/${workspaceId}/current`, activatedDocument),
      rtdbService.setData(`blueprints/${workspaceId}/active`, activatedDocument),
      activeMvpId ? rtdbService.setData(`blueprints/${workspaceId}/${activeMvpId}/versions/${cleanVerKey}`, cleanActivatedSnapshot) : Promise.resolve(),
      rtdbService.setData(`blueprints/${workspaceId}/versions/${cleanVerKey}`, cleanActivatedSnapshot),
      rtdbService.updateData(`organizations/${workspaceId}`, {
        activeProjectId: activeMvpId,
        activeBlueprintId: activatedDocument.blueprintId,
        updatedAt: timestamp,
      }),
      rtdbService.updateData(`workspaces/${workspaceId}/metadata`, {
        activeProjectId: activeMvpId,
        selectedIdeaId: activeMvpId,
        activeBlueprintId: activatedDocument.blueprintId,
        updatedAt: timestamp,
      }),
    ]);

    console.log(`✅ [Blueprint Version Activated] Version ${verNumber} is now the active authoritative Blueprint for workspace ${workspaceId}`);

    return {
      success: true,
      activatedVersion: verNumber,
      blueprint: activatedDocument,
    };
  },

  /**
   * Phase 9: Check Blueprint Staleness & Change Impact Handler.
   */
  checkBlueprintStalenessHandler: async (workspaceId, userUid) => {
    if (!workspaceId || !userUid) {
      throw new Error('Workspace ID and User UID are required.');
    }

    const { bp: existingBp, activeMvpId } = await blueprintController.resolveActiveBlueprintRecord(workspaceId, userUid);
    const mvpIdea = (await rtdbService.getData(`ideas/${workspaceId}/${activeMvpId}`)) || {};

    const aiInputPayload = await aiBlueprintService.prepareAiInputContext(workspaceId, mvpIdea);
    const stalenessResult = blueprintStalenessEngine.evaluateProjectChanges(aiInputPayload, existingBp);

    return {
      success: true,
      ...stalenessResult,
    };
  },

  /**
   * Phase 9: Compare Two Blueprint Versions Handler.
   */
  compareBlueprintVersionsHandler: async (workspaceId, userUid, payload = {}, paramB = null) => {
    let verAInput = payload?.versionA || payload?.versionKeyA || payload?.verAKey || payload?.verA;
    let verBInput = payload?.versionB || payload?.versionKeyB || payload?.verBKey || payload?.verB || paramB;

    if (typeof payload === 'string') {
      verAInput = payload;
      verBInput = paramB;
    }

    const cleanKeyA = extractCanonicalVersionKey(verAInput);
    const cleanKeyB = extractCanonicalVersionKey(verBInput);

    if (!workspaceId || !userUid || !cleanKeyA || !cleanKeyB) {
      throw new Error('Workspace ID, User UID, versionA, and versionB keys are required.');
    }

    const { activeMvpId, bp: currentBp } = await blueprintController.resolveActiveBlueprintRecord(workspaceId, userUid);

    const [docA, docB] = await Promise.all([
      (activeMvpId ? await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}/versions/${cleanKeyA}`) : null) ||
      (await rtdbService.getData(`blueprints/${workspaceId}/versions/${cleanKeyA}`)) ||
      currentBp?.versions?.[cleanKeyA],
      (activeMvpId ? await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}/versions/${cleanKeyB}`) : null) ||
      (await rtdbService.getData(`blueprints/${workspaceId}/versions/${cleanKeyB}`)) ||
      currentBp?.versions?.[cleanKeyB],
    ]);

    if (!docA || !docB) {
      throw new Error('One or both specified Blueprint versions could not be found.');
    }

    const comparison = blueprintComparisonEngine.compareVersions(docA, docB);
    return {
      success: true,
      comparison,
    };
  },

  /**
   * Phase 11: Formal Blueprint Version Approval Handler.
   * Enforces readiness checklist verification, blocking precondition evaluation,
   * stamps approval metadata, promotes target version to active, marks previous version superseded,
   * and automatically synchronizes tasks into the Task Board.
   */
  approveBlueprintVersionHandler: async (workspaceId, userUid, payload = {}) => {
    const cleanVerKey = extractCanonicalVersionKey(payload);
    if (!workspaceId || !userUid || !cleanVerKey) {
      throw new Error('Workspace ID, User UID, and a valid Target Version Key (e.g. "1.0" or "v1_0") are required.');
    }

    console.log(`⭐ [Blueprint Approval Requested] Workspace: ${workspaceId} | Target: ${cleanVerKey} | Caller: ${userUid}`);

    const { org, memberRecord, role } = await blueprintController.verifyWorkspaceMembership(
      workspaceId,
      userUid,
      'Unauthorized. You must be a member of this workspace to approve a Blueprint.'
    );
    blueprintController.assertMutationAllowed(role, 'approve a Blueprint');

    const activeMvpId = await blueprintController.resolveActiveMvpId(workspaceId, org);

    const currentBp = (activeMvpId ? await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}`) : null) ||
                      (await rtdbService.getData(`blueprints/${workspaceId}/current`)) ||
                      {};

    const targetVersionDoc = (activeMvpId ? await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}/versions/${cleanVerKey}`) : null) ||
                             (await rtdbService.getData(`blueprints/${workspaceId}/versions/${cleanVerKey}`)) ||
                             currentBp.versions?.[cleanVerKey];

    if (!targetVersionDoc || (!targetVersionDoc.content && !targetVersionDoc.projectOverview)) {
      throw new Error(`Target Blueprint version '${cleanVerKey}' was not found or is invalid.`);
    }

    // Prepare realtime project context for staleness & approval readiness verification
    const mvpIdea = (activeMvpId ? await rtdbService.getData(`ideas/${workspaceId}/${activeMvpId}`) : null) || {};
    const projectContext = await aiBlueprintService.prepareAiInputContext(workspaceId, mvpIdea);

    // Evaluate approval preconditions
    const readiness = blueprintApprovalEngine.evaluateApprovalReadiness(targetVersionDoc, projectContext);
    if (!readiness.canApprove) {
      const errorMsg = `Approval Preconditions Failed: ${readiness.blockingErrors.join('; ')}`;
      console.warn(`❌ [Blueprint Approval Blocked] ${errorMsg}`);
      const err = new Error(errorMsg);
      err.statusCode = 422;
      err.blockingErrors = readiness.blockingErrors;
      err.checklist = readiness.checklist;
      throw err;
    }

    const timestamp = Date.now();
    const verNumber = String(targetVersionDoc.version || targetVersionDoc.versionId || cleanVerKey.replace(/^v/, '').replace(/_/g, '.') || '1.0');

    // Idempotency check: if version is already approved and active, return safely
    if (targetVersionDoc.approvalStatus === 'approved' && currentBp.version === verNumber && currentBp.approvalStatus === 'approved') {
      console.log(`ℹ️ [Blueprint Approval Idempotent] Version ${verNumber} is already approved and active for workspace ${workspaceId}`);
      return {
        success: true,
        approvedVersion: verNumber,
        blueprint: currentBp,
        readiness,
      };
    }

    // Build approved document
    const approvedDocument = {
      ...targetVersionDoc,
      status: 'completed',
      lifecycleState: 'active',
      approvalStatus: 'approved',
      activeVersionId: verNumber,
      version: verNumber,
      updatedAt: timestamp,
      approvedAt: timestamp,
      approvedBy: userUid,
      activatedAt: timestamp,
      activatedBy: userUid,
      readinessScore: readiness.readinessScore,
      lastModifiedSource: targetVersionDoc.lastModifiedSource || 'human_approval',
    };

    // 1. Gather all existing historical versions across all authoritative locations
    const [mvpVersionsRaw, rootVersionsRaw] = await Promise.all([
      activeMvpId ? rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}/versions`).catch(() => null) : null,
      rtdbService.getData(`blueprints/${workspaceId}/versions`).catch(() => null),
    ]);

    const allVersionsMap = {};

    const mergeVersionMap = (src) => {
      if (!src || typeof src !== 'object') return;
      const dict = src.versions && typeof src.versions === 'object' ? src.versions : src;
      Object.entries(dict).forEach(([k, v]) => {
        if (v && typeof v === 'object' && (v.content || v.projectOverview || v.status || v.version)) {
          allVersionsMap[k] = cleanVersionSnapshot(v);
        }
      });
    };

    mergeVersionMap(rootVersionsRaw);
    mergeVersionMap(mvpVersionsRaw);
    if (currentBp.versions) mergeVersionMap(currentBp.versions);

    // If previous active version was different, mark as superseded in version history
    if (currentBp.version && String(currentBp.version) !== verNumber) {
      const oldVerKey = extractCanonicalVersionKey(currentBp.version) || `v${String(currentBp.version).replace(/\./g, '_')}`;
      const existingOld = allVersionsMap[oldVerKey] || currentBp;
      const oldSnapshot = cleanVersionSnapshot({
        ...existingOld,
        status: 'superseded',
        lifecycleState: 'superseded',
        supersededAt: timestamp,
        supersededBy: userUid,
      });
      allVersionsMap[oldVerKey] = oldSnapshot;
    }

    // Build approved snapshot for version history
    const approvedSnapshot = cleanVersionSnapshot({
      ...approvedDocument,
      key: cleanVerKey,
    });
    allVersionsMap[cleanVerKey] = approvedSnapshot;

    // Attach complete version history map to approved document
    approvedDocument.versions = allVersionsMap;

    // Persist approved document across all active authoritative locations and preserve all historical versions
    const persistPromises = [
      activeMvpId ? rtdbService.setData(`blueprints/${workspaceId}/${activeMvpId}`, approvedDocument) : Promise.resolve(),
      rtdbService.setData(`blueprints/${workspaceId}/current`, approvedDocument),
      rtdbService.setData(`blueprints/${workspaceId}/active`, approvedDocument),
      rtdbService.updateData(`organizations/${workspaceId}`, {
        activeProjectId: activeMvpId,
        activeBlueprintId: approvedDocument.blueprintId,
        updatedAt: timestamp,
      }),
      rtdbService.updateData(`workspaces/${workspaceId}/metadata`, {
        activeProjectId: activeMvpId,
        selectedIdeaId: activeMvpId,
        activeBlueprintId: approvedDocument.blueprintId,
        updatedAt: timestamp,
      }),
    ];

    // Ensure EVERY historical version is preserved cleanly at both collection paths
    for (const [vKey, vSnap] of Object.entries(allVersionsMap)) {
      const cleanSnap = cleanVersionSnapshot(vSnap);
      if (activeMvpId) {
        persistPromises.push(rtdbService.setData(`blueprints/${workspaceId}/${activeMvpId}/versions/${vKey}`, cleanSnap));
      }
      persistPromises.push(rtdbService.setData(`blueprints/${workspaceId}/versions/${vKey}`, cleanSnap));
    }

    await Promise.all(persistPromises);

    console.log(`✅ [Blueprint Approved & Activated] Version ${verNumber} is now the formally approved execution plan for workspace ${workspaceId}`);

    // Automatically synchronize planned tasks into Task Board
    await taskSyncService.synchronizeBlueprintTasks(workspaceId, approvedDocument, userUid).catch((syncErr) => {
      console.warn('⚠️ [TaskSync on Approval Warning]', syncErr.message);
    });

    // Phase 8: Record Blueprint Version Approved activity event
    const actorDisplayName = org?.members?.[userUid]?.name || memberRecord?.displayName || 'Team Member';
    activityService.recordWorkspaceActivity(workspaceId, {
      eventType: ACTIVITY_EVENT_TYPES.BLUEPRINT_VERSION_APPROVED,
      actorId: userUid,
      actorType: 'user',
      actorName: actorDisplayName,
      resourceType: 'blueprint',
      resourceId: approvedDocument.blueprintId || `bp_${workspaceId}_${activeMvpId}`,
      resourceTitle: mvpIdea?.title || 'Workspace MVP',
      summary: `Approved & activated Blueprint v${verNumber} for execution`,
      metadata: { version: verNumber, ideaId: activeMvpId },
    }).catch((actErr) => console.warn('⚠️ [Blueprint Approved Activity Warning]', actErr.message));

    // Convia Phase 7B-2: Resolve original version creator or generation initiator
    const targetCreatorUid = targetVersionDoc?.lineage?.generatedBy ||
      targetVersionDoc?.generatedBy ||
      targetVersionDoc?.createdBy ||
      targetVersionDoc?.userId ||
      currentBp?.lineage?.generatedBy ||
      currentBp?.createdBy ||
      mvpIdea?.createdBy;

    // Dispatch Blueprint Version Approved notification to creator and workspace members
    notificationService.dispatchNotificationEvent(
      NOTIFICATION_TYPES.BLUEPRINT_VERSION_APPROVED,
      {
        workspaceId,
        mvpIdeaId: activeMvpId,
        resourceId: approvedDocument.blueprintId || `bp_${workspaceId}_${activeMvpId}`,
        version: verNumber,
        secondaryEntityId: String(verNumber),
        ideaTitle: mvpIdea?.title || 'Workspace MVP',
        creatorUid: targetCreatorUid,
        actorId: userUid,
        actorName: actorDisplayName,
      },
      { uid: userUid, displayName: actorDisplayName }
    ).catch((notifErr) => console.warn('⚠️ [Blueprint Approved Notification Warning]', notifErr.message));

    return {
      success: true,
      approvedVersion: verNumber,
      blueprint: approvedDocument,
      readiness,
    };
  },

  /**
   * Phase 11: Check Approval Readiness Handler.
   */
  checkApprovalReadinessHandler: async (workspaceId, userUid, payload = {}) => {
    if (!workspaceId || !userUid) {
      throw new Error('Workspace ID and User UID are required.');
    }

    const cleanVerKey = extractCanonicalVersionKey(payload);
    const { bp: existingBp, activeMvpId } = await blueprintController.resolveActiveBlueprintRecord(workspaceId, userUid);
    let targetDoc = existingBp;

    if (cleanVerKey) {
      targetDoc = (activeMvpId ? await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}/versions/${cleanVerKey}`) : null) ||
                  (await rtdbService.getData(`blueprints/${workspaceId}/versions/${cleanVerKey}`)) ||
                  existingBp;
    }

    const mvpIdea = (activeMvpId ? await rtdbService.getData(`ideas/${workspaceId}/${activeMvpId}`) : null) || {};
    const projectContext = await aiBlueprintService.prepareAiInputContext(workspaceId, mvpIdea);

    const readiness = blueprintApprovalEngine.evaluateApprovalReadiness(targetDoc, projectContext);

    return {
      success: true,
      version: targetDoc.version || '1.0',
      ...readiness,
    };
  },

  /**
   * Phase 6: Server Endpoint Handler for Exporting Structured Blueprint JSON.
   */
  exportJsonHandler: async (workspaceId, userUid, targetVersion = null) => {
    if (!workspaceId || !userUid) {
      throw new Error('Workspace ID and User context are required for export.');
    }

    const cleanVerKey = extractCanonicalVersionKey(targetVersion);
    const cleanVerNum = extractCanonicalVersionNumber(targetVersion);
    console.log(`📥 [Blueprint JSON Export Requested] Workspace: ${workspaceId} | User: ${userUid} | Target Version: ${cleanVerKey || 'Latest'}`);

    const { bp, activeMvpId, org } = await blueprintController.resolveActiveBlueprintRecord(workspaceId, userUid);
    let targetDoc = bp;

    // Try loading specific target version if requested
    if (cleanVerKey && cleanVerKey !== 'current' && (!targetDoc.version || String(cleanVerNum) !== String(targetDoc.version))) {
      const versionDoc = (activeMvpId ? await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}/versions/${cleanVerKey}`) : null) ||
                         (await rtdbService.getData(`blueprints/${workspaceId}/versions/${cleanVerKey}`)) ||
                         targetDoc.versions?.[cleanVerKey];
      if (versionDoc && (versionDoc.content || versionDoc.projectOverview)) {
        targetDoc = versionDoc;
      }
    }

    // Fallback: If root document has no content or status is failed, recover latest completed version from history
    if ((!targetDoc.content || targetDoc.status === 'failed') && targetDoc.versions) {
      const validVersions = Object.values(targetDoc.versions).filter((v) => v && (v.content || v.projectOverview));
      if (validVersions.length > 0) {
        validVersions.sort((a, b) => (parseFloat(b.version) || 0) - (parseFloat(a.version) || 0));
        targetDoc = validVersions[0];
      }
    }

    const rawContent = targetDoc.content || (targetDoc.projectOverview ? targetDoc : null);

    if (!targetDoc || !rawContent) {
      throw new Error('Export unavailable: No valid completed Blueprint content found. Please click Regenerate to create a fresh Blueprint.');
    }

    const validatedContent = validateBlueprintOutput(rawContent);

    const exportDocument = {
      blueprintId: targetDoc.blueprintId || `bp_${workspaceId}_${activeMvpId}`,
      workspaceId: targetDoc.workspaceId || workspaceId,
      mvpIdeaId: targetDoc.mvpIdeaId || activeMvpId,
      version: targetDoc.version || '1.0',
      status: 'completed',
      lastModifiedSource: targetDoc.lastModifiedSource || 'ai_generation',
      aiProvider: targetDoc.aiProvider || 'google_gemini',
      aiModel: targetDoc.aiModel || 'gemini-2.0-flash',
      generatedAt: targetDoc.generatedAt || targetDoc.createdAt || Date.now(),
      updatedAt: targetDoc.updatedAt || Date.now(),

      ideaTitle: targetDoc.ideaTitle || org.name || 'Project Blueprint',
      problemStatement: targetDoc.problemStatement || '',
      description: targetDoc.description || '',

      content: validatedContent,
      communityIntelligence: targetDoc.communityIntelligence || null,
      communityIntelligenceStatus: targetDoc.communityIntelligenceStatus || 'not_analyzed',
    };

    const filename = sanitizeFilename(targetDoc.ideaTitle || org.name, targetDoc.version || '1.0', 'json');

    console.log(`✅ [Blueprint JSON Export Ready] Filename: "${filename}"`);

    return {
      success: true,
      filename,
      exportData: exportDocument,
      jsonString: JSON.stringify(exportDocument, null, 2),
    };
  },

  /**
   * Phase 4: Standalone Handler for Analyzing Community Intelligence.
   */
  analyzeCommunityIntelligenceHandler: async (workspaceId, userUid) => {
    if (!workspaceId || !userUid) {
      throw new Error('Workspace ID and User context are required.');
    }

    console.log(`🔍 [Community Analysis Started] Workspace: ${workspaceId} | User: ${userUid}`);

    const { org } = await blueprintController.verifyWorkspaceMembership(
      workspaceId,
      userUid,
      'Unauthorized. You must be a member of this workspace to analyze community feedback.'
    );

    const activeMvpId = await blueprintController.resolveActiveMvpId(workspaceId, org);
    if (!activeMvpId) {
      throw new Error('No MVP selected for this workspace.');
    }

    const mvpIdea = await rtdbService.getData(`ideas/${workspaceId}/${activeMvpId}`);
    if (!mvpIdea || mvpIdea.isDeleted) {
      throw new Error('Selected MVP idea could not be found.');
    }

    // Authoritative In-Flight Mutex Lock Acquisition
    const activeLock = aiConcurrencyGuard.acquireLock(workspaceId, userUid, 'analyze_community');

    try {
      const existingBp = (await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}`)) || {};
      if (existingBp.communityIntelligenceStatus === 'analyzing') {
        const isStale = Date.now() - (existingBp.communityIntelligenceUpdatedAt || 0) > 300000;
        if (!isStale) {
          const err = new Error('Community feedback analysis is already in progress.');
          err.statusCode = 409;
          err.code = 'AI_OPERATION_IN_PROGRESS';
          throw err;
        }
      }

      await Promise.all([
        rtdbService.updateData(`blueprints/${workspaceId}/${activeMvpId}`, {
          communityIntelligenceStatus: 'analyzing',
          communityIntelligenceUpdatedAt: Date.now(),
        }),
        rtdbService.updateData(`blueprints/${workspaceId}`, {
          communityIntelligenceStatus: 'analyzing',
          communityIntelligenceUpdatedAt: Date.now(),
        }),
      ]);

      const aiInputPayload = await aiBlueprintService.prepareAiInputContext(workspaceId, mvpIdea);
      const totalFeedbackCount = (aiInputPayload.suggestions || []).length +
                                 (aiInputPayload.comments || []).length +
                                 (aiInputPayload.questions || []).length;

      let communityIntelligenceData;

      if (totalFeedbackCount === 0) {
        console.log(`ℹ️ [Community Analysis] Zero feedback items found for MVP ${activeMvpId}. Returning empty analysis.`);
        communityIntelligenceData = {
          suggestionsAnalysis: [],
          commentsAnalysis: [],
          questionsAnalysis: [],
          communityInsightsSummary: 'No community discussions or feedback submitted yet for this MVP.',
          communityInsights: {
            statistics: {
              suggestionsAnalyzed: 0, suggestionsRelevant: 0,
              commentsAnalyzed: 0, commentsRelevant: 0,
              questionsAnalyzed: 0, questionsRelevant: 0,
            },
            keyInsights: [
              { insight: 'No community feedback present yet to analyze.', category: 'general', impact: 'low' },
            ],
          },
        };
      } else {
        const sanitizeList = (list) =>
          (list || []).slice(0, 25).map((item) => ({
            id: item.id,
            authorName: item.authorName,
            content: (item.message || '').slice(0, 500),
          }));

        const truncatedPayload = {
          ideaTitle: aiInputPayload.ideaTitle,
          problemStatement: aiInputPayload.problemStatement,
          description: aiInputPayload.description,
          techStack: aiInputPayload.techStack,
          suggestions: sanitizeList(aiInputPayload.suggestions),
          comments: sanitizeList(aiInputPayload.comments),
          questions: sanitizeList(aiInputPayload.questions),
        };

        const result = await geminiService.analyzeCommunityIntelligenceFromContext(truncatedPayload);
        communityIntelligenceData = result.communityIntelligence;
      }

      const timestamp = Date.now();

      await Promise.all([
        rtdbService.updateData(`blueprints/${workspaceId}/${activeMvpId}`, {
          communityIntelligence: communityIntelligenceData,
          communityIntelligenceStatus: 'completed',
          communityIntelligenceUpdatedAt: timestamp,
        }),
        rtdbService.updateData(`blueprints/${workspaceId}/current`, {
          communityIntelligence: communityIntelligenceData,
          communityIntelligenceStatus: 'completed',
          communityIntelligenceUpdatedAt: timestamp,
        }),
        rtdbService.updateData(`blueprints/${workspaceId}`, {
          communityIntelligence: communityIntelligenceData,
          communityIntelligenceStatus: 'completed',
          communityIntelligenceUpdatedAt: timestamp,
        }),
      ]);

      console.log(`✅ [Community Analysis Completed] Analyzed ${totalFeedbackCount} items for workspace ${workspaceId}`);

      return {
        success: true,
        communityIntelligence: communityIntelligenceData,
      };
    } catch (error) {
      console.error(`💥 [Community Analysis Failed] Workspace: ${workspaceId} | Error:`, error.message);

      const existingBp = (await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}`).catch(() => null)) || {};
      const fallbackStatus = existingBp.communityIntelligence ? 'completed' : 'failed';
      await Promise.all([
        rtdbService.updateData(`blueprints/${workspaceId}/${activeMvpId}`, {
          communityIntelligenceStatus: fallbackStatus,
          communityIntelligenceUpdatedAt: Date.now(),
        }),
        rtdbService.updateData(`blueprints/${workspaceId}`, {
          communityIntelligenceStatus: fallbackStatus,
          communityIntelligenceUpdatedAt: Date.now(),
        }),
      ]).catch(() => {});

      if (error.statusCode === 409 || error.code === 'AI_OPERATION_IN_PROGRESS') {
        throw error;
      }
      throw new Error('Community feedback analysis failed. Please try again.');
    } finally {
      if (activeLock) {
        aiConcurrencyGuard.releaseLock(activeLock.lockKey, activeLock.attemptId);
      }
    }
  },

  /**
   * Phase 5: Assign Team Member to Blueprint Execution Task Handler.
   */
  assignBlueprintTaskHandler: async (workspaceId, userUid, assignmentData = {}) => {
    const { taskId, assignedUserId } = assignmentData;
    if (!taskId) {
      throw new Error('Task ID is required for assignment.');
    }

    console.log(`👤 [Task Assignment Requested] Workspace: ${workspaceId} | Task: ${taskId} | Target User: ${assignedUserId || 'Unassigned'} | Caller: ${userUid}`);

    const { bp: existingBp, activeMvpId, org, role } = await blueprintController.resolveActiveBlueprintRecord(workspaceId, userUid);
    blueprintController.assertMutationAllowed(role, 'assign Blueprint tasks');

    let targetUserName = 'Unassigned';
    if (assignedUserId) {
      const [targetMemberOrg, targetUser] = await Promise.all([
        rtdbService.getData(`organization_members/${workspaceId}/${assignedUserId}`),
        rtdbService.getData(`users/${assignedUserId}`),
      ]);

      const isTargetOwner = org.ownerId === assignedUserId || org.createdBy === assignedUserId || org.ownerUid === assignedUserId;
      const isTargetMember = Boolean(targetMemberOrg || isTargetOwner || (org.members && org.members[assignedUserId]));

      if (!isTargetMember) {
        throw new Error('Target user is not a member of this workspace.');
      }

      targetUserName = targetUser?.displayName || targetUser?.name || targetUser?.email?.split('@')[0] || 'Team Member';
    }

    const content = existingBp.content;
    const tasks = content.execution?.tasks || [];
    const targetTask = tasks.find((t) => t.id === taskId);

    if (!targetTask) {
      throw new Error(`Task '${taskId}' not found in Blueprint execution plan.`);
    }

    // Update authoritative assignment fields
    targetTask.assignedUserId = assignedUserId || null;
    targetTask.assignedUserName = assignedUserId ? targetUserName : null;

    // Update connected live task if exists
    if (targetTask.convertedTaskId) {
      await rtdbService.updateData(`tasks/${workspaceId}/${targetTask.convertedTaskId}`, {
        assignedTo: assignedUserId || '',
        assignedToName: assignedUserId ? targetUserName : 'Unassigned',
        updatedAt: Date.now(),
      }).catch((err) => console.warn('[TaskSync Warning]', err.message));
    }

    const timestamp = Date.now();
    const updatedBp = {
      ...existingBp,
      updatedAt: timestamp,
      content,
    };

    await blueprintController.persistBlueprintUpdate(workspaceId, activeMvpId, updatedBp);

    console.log(`✅ [Task Assignment Completed] Task ${taskId} successfully assigned to ${targetUserName} (${assignedUserId || 'null'})`);

    return {
      success: true,
      taskId,
      assignedUserId: assignedUserId || null,
      assignedUserName: assignedUserId ? targetUserName : null,
      blueprint: updatedBp,
    };
  },

  /**
   * Phase 7: Approve Proposed Decision Handler.
   */
  approveDecisionHandler: async (workspaceId, userUid, payload = {}) => {
    const decisionId = payload.decisionId || payload;
    if (!workspaceId || !userUid || !decisionId) {
      throw new Error('Workspace ID, User UID, and Decision ID are required.');
    }

    const { bp: existingBp, activeMvpId, userName, role } = await blueprintController.resolveActiveBlueprintRecord(workspaceId, userUid);
    blueprintController.assertMutationAllowed(role, 'approve decisions');

    const content = existingBp.content;
    const discIntel = content.intelligence?.discussionIntelligence || {};
    const decisions = discIntel.decisions || [];
    const targetDec = decisions.find((d) => d.id === decisionId);

    if (!targetDec) {
      throw new Error(`Decision '${decisionId}' not found in Blueprint.`);
    }

    targetDec.status = 'approved';
    targetDec.approvedBy = userUid;
    targetDec.approvedByName = userName;
    targetDec.approvedAt = Date.now();

    // Auto-resolve any referenced questions
    if (Array.isArray(targetDec.sourceQuestionIds) && discIntel.unresolvedQuestions) {
      discIntel.unresolvedQuestions.forEach((q) => {
        if (targetDec.sourceQuestionIds.includes(q.id)) {
          q.status = 'resolved';
          q.resolvedByDecisionId = targetDec.id;
        }
      });
    }

    const timestamp = Date.now();
    const updatedBp = {
      ...existingBp,
      updatedAt: timestamp,
      content,
    };

    await blueprintController.persistBlueprintUpdate(workspaceId, activeMvpId, updatedBp);

    console.log(`✅ [Decision Approved] ${decisionId} approved by ${userName} in workspace ${workspaceId}`);
    return { success: true, decision: targetDec, blueprint: updatedBp };
  },

  /**
   * Phase 7: Reject Proposed Decision Handler.
   */
  rejectDecisionHandler: async (workspaceId, userUid, payload = {}) => {
    const decisionId = payload.decisionId || payload;
    if (!workspaceId || !userUid || !decisionId) {
      throw new Error('Workspace ID, User UID, and Decision ID are required.');
    }

    const { bp: existingBp, activeMvpId, userName, role } = await blueprintController.resolveActiveBlueprintRecord(workspaceId, userUid);
    blueprintController.assertMutationAllowed(role, 'reject decisions');

    const content = existingBp.content;
    const discIntel = content.intelligence?.discussionIntelligence || {};
    const decisions = discIntel.decisions || [];
    const targetDec = decisions.find((d) => d.id === decisionId);

    if (!targetDec) {
      throw new Error(`Decision '${decisionId}' not found in Blueprint.`);
    }

    targetDec.status = 'rejected';
    targetDec.approvedBy = userUid;
    targetDec.approvedByName = userName;
    targetDec.approvedAt = Date.now();

    const timestamp = Date.now();
    const updatedBp = {
      ...existingBp,
      updatedAt: timestamp,
      content,
    };

    await blueprintController.persistBlueprintUpdate(workspaceId, activeMvpId, updatedBp);

    console.log(`⛔ [Decision Rejected] ${decisionId} rejected by ${userName} in workspace ${workspaceId}`);
    return { success: true, decision: targetDec, blueprint: updatedBp };
  },

  /**
   * Phase 7: Create Authoritative Project Decision Handler.
   */
  createDecisionHandler: async (workspaceId, userUid, decisionData = {}) => {
    if (!workspaceId || !userUid || !decisionData.decision) {
      throw new Error('Workspace ID, User UID, and decision text are required.');
    }

    const { bp: existingBp, activeMvpId, userName, role } = await blueprintController.resolveActiveBlueprintRecord(workspaceId, userUid);
    blueprintController.assertMutationAllowed(role, 'create decisions');

    const content = existingBp.content;
    if (!content.intelligence) content.intelligence = {};
    if (!content.intelligence.discussionIntelligence) content.intelligence.discussionIntelligence = { decisions: [] };

    const discIntel = content.intelligence.discussionIntelligence;
    if (!Array.isArray(discIntel.decisions)) discIntel.decisions = [];

    const newId = `DEC-${String(discIntel.decisions.length + 1).padStart(2, '0')}`;
    const timestamp = Date.now();

    const newDecision = {
      id: newId,
      title: decisionData.title || decisionData.decision.substring(0, 50),
      decision: decisionData.decision.trim(),
      rationale: decisionData.rationale || 'Authoritative decision recorded by project lead.',
      category: decisionData.category || 'technology',
      status: 'approved',
      confidence: 'high',
      sourceDiscussionIds: decisionData.sourceDiscussionIds || [],
      affectedRequirementIds: decisionData.affectedRequirementIds || [],
      affectedFeatureIds: decisionData.affectedFeatureIds || [],
      affectedTaskIds: decisionData.affectedTaskIds || [],
      affectedRiskIds: decisionData.affectedRiskIds || [],
      affectedTestIds: decisionData.affectedTestIds || [],
      createdBy: userUid,
      createdByName: userName,
      approvedBy: userUid,
      approvedByName: userName,
      approvedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
      source: 'user_defined',
    };

    discIntel.decisions.push(newDecision);

    const updatedBp = {
      ...existingBp,
      updatedAt: timestamp,
      content,
    };

    await blueprintController.persistBlueprintUpdate(workspaceId, activeMvpId, updatedBp);

    console.log(`✅ [Decision Created] ${newId} created and approved by ${userName} in workspace ${workspaceId}`);
    return { success: true, decision: newDecision, blueprint: updatedBp };
  },

  /**
   * Phase 7: Approve Change Recommendation Handler.
   */
  approveChangeRecommendationHandler: async (workspaceId, userUid, payload = {}) => {
    const recommendationId = payload.recommendationId || payload;
    if (!workspaceId || !userUid || !recommendationId) {
      throw new Error('Workspace ID, User UID, and recommendation ID are required.');
    }

    const { bp: existingBp, activeMvpId, userName, role } = await blueprintController.resolveActiveBlueprintRecord(workspaceId, userUid);
    blueprintController.assertMutationAllowed(role, 'approve change recommendations');

    const content = existingBp.content;
    const discIntel = content.intelligence?.discussionIntelligence || {};
    const recs = discIntel.changeRecommendations || [];
    const targetRec = recs.find((r) => r.id === recommendationId);

    if (!targetRec) {
      throw new Error(`Change recommendation '${recommendationId}' not found in Blueprint.`);
    }

    targetRec.status = 'approved';
    targetRec.reviewedBy = userUid;
    targetRec.reviewedByName = userName;
    targetRec.reviewedAt = Date.now();

    const timestamp = Date.now();
    const updatedBp = {
      ...existingBp,
      updatedAt: timestamp,
      content,
    };

    await blueprintController.persistBlueprintUpdate(workspaceId, activeMvpId, updatedBp);

    console.log(`✅ [Change Recommendation Approved] ${recommendationId} approved by ${userName}`);
    return { success: true, changeRecommendation: targetRec, blueprint: updatedBp };
  },

  /**
   * Phase 7: Reject Change Recommendation Handler.
   */
  rejectChangeRecommendationHandler: async (workspaceId, userUid, payload = {}) => {
    const recommendationId = payload.recommendationId || payload;
    if (!workspaceId || !userUid || !recommendationId) {
      throw new Error('Workspace ID, User UID, and recommendation ID are required.');
    }

    const { bp: existingBp, activeMvpId, userName, role } = await blueprintController.resolveActiveBlueprintRecord(workspaceId, userUid);
    blueprintController.assertMutationAllowed(role, 'reject change recommendations');

    const content = existingBp.content;
    const discIntel = content.intelligence?.discussionIntelligence || {};
    const recs = discIntel.changeRecommendations || [];
    const targetRec = recs.find((r) => r.id === recommendationId);

    if (!targetRec) {
      throw new Error(`Change recommendation '${recommendationId}' not found in Blueprint.`);
    }

    targetRec.status = 'rejected';
    targetRec.reviewedBy = userUid;
    targetRec.reviewedByName = userName;
    targetRec.reviewedAt = Date.now();

    const timestamp = Date.now();
    const updatedBp = {
      ...existingBp,
      updatedAt: timestamp,
      content,
    };

    await blueprintController.persistBlueprintUpdate(workspaceId, activeMvpId, updatedBp);

    console.log(`⛔ [Change Recommendation Rejected] ${recommendationId} rejected by ${userName}`);
    return { success: true, changeRecommendation: targetRec, blueprint: updatedBp };
  },

  /**
   * Dedicated On-Demand Task Synchronization Handler.
   * Synchronizes Blueprint planned tasks into the Task Board execution layer.
   */
  syncBlueprintTasksHandler: async (workspaceId, userUid, payload = {}) => {
    if (!workspaceId || !userUid) {
      throw new Error('Workspace ID and User UID are required.');
    }

    const { bp: existingBp, activeMvpId, role } = await blueprintController.resolveActiveBlueprintRecord(workspaceId, userUid);
    blueprintController.assertMutationAllowed(role, 'synchronize Blueprint tasks');
    let targetDoc = existingBp;

    const cleanVerKey = extractCanonicalVersionKey(payload);
    if (cleanVerKey) {
      const versionSnapshot =
        (activeMvpId ? await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}/versions/${cleanVerKey}`) : null) ||
        (await rtdbService.getData(`blueprints/${workspaceId}/versions/${cleanVerKey}`));
      if (versionSnapshot && (versionSnapshot.content || versionSnapshot.projectOverview)) {
        targetDoc = versionSnapshot;
      }
    }

    const syncResults = await taskSyncService.synchronizeBlueprintTasks(workspaceId, targetDoc, userUid);
    return syncResults;
  },
};

export default blueprintController;
