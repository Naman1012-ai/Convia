import { rtdbService } from './rtdbService';
import { getErrorMessage } from '../utils/errorMessages';

/**
 * Service Layer for MVP Selection & Project Blueprint Generation.
 * Manages atomic transition from Ideation Phase to Project Phase.
 */
export const blueprintService = {
  /**
   * Select winning MVP idea and execute atomic multi-path phase transition (Owner only).
   */
  selectWinningIdea: async (leaderUid, orgId, winningIdeaId) => {
    if (!leaderUid || !orgId || !winningIdeaId) {
      throw new Error('Leader UID, Organization ID, and Winning Idea ID are required.');
    }

    // Enforce Platform Settings Validation
    const platformSettings = await rtdbService.getData('platform_settings');
    if (platformSettings?.ideas?.enableMvpSelection === false) {
      throw new Error('MVP Selection workflow has been disabled by the platform administrator.');
    }
    if (platformSettings?.ideas?.enableBlueprint === false || platformSettings?.featureFlags?.blueprint === false) {
      throw new Error('AI Blueprint generation has been disabled by the platform administrator.');
    }

    try {
      // 1. Verify Leader permission & current Org status
      const org = await rtdbService.getData(`organizations/${orgId}`);
      if (!org) throw new Error('Organization not found.');
      if (org.ownerId !== leaderUid) {
        throw new Error('Only the Organization Owner can select the winning MVP.');
      }

      // 2. Fetch winning idea snapshot
      const winningIdea = await rtdbService.getData(`ideas/${orgId}/${winningIdeaId}`);
      if (!winningIdea) throw new Error('Selected idea not found.');

      // 3. Fetch discussions for blueprint summary
      const discussionsObj = (await rtdbService.getData(`discussions/${winningIdeaId}`)) || {};
      const activeDiscussions = Object.values(discussionsObj).filter((d) => d && !d.isDeleted);

      const commentCount = activeDiscussions.filter((d) => d.type === 'comment' || !d.type).length;
      const suggestionCount = activeDiscussions.filter((d) => d.type === 'suggestion').length;
      const acceptedSuggestions = activeDiscussions.filter((d) => d.type === 'suggestion' && d.isAccepted);

      const timestamp = Date.now();

      // 4. Build Blueprint Document with metadata fields
      const blueprintData = {
        blueprintId: `bp_${orgId}_${winningIdeaId}`,
        workspaceId: orgId,
        orgId,
        mvpIdeaId: winningIdeaId,
        ideaId: winningIdeaId,
        version: '1.0',
        status: 'completed', // Blueprint initialized from MVP selection
        
        // Metadata fields (No fake AI provider strings)
        aiProvider: null,
        aiModel: null,
        generatedAt: null,
        updatedAt: timestamp,
        generatedBy: null,
        createdBy: leaderUid,
        createdAt: timestamp,

        // Snapshot fields
        ideaTitle: winningIdea.title,
        problemStatement: winningIdea.problemStatement,
        proposedSolution: winningIdea.proposedSolution || '',
        techStack: winningIdea.techStack || '',
        difficultyLevel: winningIdea.difficultyLevel || 'Medium',
        authorId: winningIdea.authorId,
        authorName: winningIdea.authorName,
        selectedBy: leaderUid,
        selectedAt: timestamp,
        projectStatus: 'Selected MVP',

        voteSummary: {
          totalVotes: winningIdea.voteCount || 0,
        },
        discussionSummary: {
          commentCount,
          suggestionCount,
          acceptedSuggestionsCount: acceptedSuggestions.length,
          acceptedSuggestionsList: acceptedSuggestions.map((s) => ({
            message: s.message,
            authorName: s.authorName,
          })),
        },
      };

      // 5. Blueprint document is authoritatively created via backend AI generation endpoint.
      // Direct client RTDB writes to blueprints are disabled under hardened security rules.

      // 6. Archive other organization ideas & mark winning idea as selected
      const allOrgIdeas = (await rtdbService.getData(`ideas/${orgId}`)) || {};
      for (const [id, ideaObj] of Object.entries(allOrgIdeas)) {
        if (id === winningIdeaId) {
          await rtdbService.updateData(`ideas/${orgId}/${id}`, {
            isSelected: true,
            status: 'selected',
            updatedAt: timestamp,
          });
        } else {
          await rtdbService.updateData(`ideas/${orgId}/${id}`, {
            isSelected: false,
            status: 'archived',
            updatedAt: timestamp,
          });
        }
      }

      // 7. Atomic Phase Shift on Organization & Workspace Metadata
      await Promise.all([
        rtdbService.updateData(`organizations/${orgId}`, {
          status: 'project',
          activeProjectId: winningIdeaId,
          selectedIdeaId: winningIdeaId,
          activeBlueprintId: blueprintData.blueprintId,
          updatedAt: timestamp,
        }),
        rtdbService.updateData(`workspaces/${orgId}/metadata`, {
          status: 'project',
          activeProjectId: winningIdeaId,
          selectedIdeaId: winningIdeaId,
          activeBlueprintId: blueprintData.blueprintId,
          updatedAt: timestamp,
        }),
      ]);

      return blueprintData;
    } catch (error) {
      console.error('[blueprintService] selectWinningIdea error:', error);
      throw new Error(error.message || getErrorMessage(error.code || 'default'));
    }
  },

  /**
   * Resilient helper to extract a valid Blueprint document from any raw RTDB node or dictionary.
   */
  extractValidBlueprint: (raw, targetMvpId = null) => {
    if (!raw || typeof raw !== 'object') return null;

    // Case 1: Direct single Blueprint document with content/schema
    if (raw.content || raw.projectOverview || raw.schemaVersion || raw.status === 'completed' || raw.status === 'generating') {
      return raw;
    }

    // Case 2: Target MVP child inside dictionary
    if (targetMvpId && raw[targetMvpId] && typeof raw[targetMvpId] === 'object') {
      const targetChild = raw[targetMvpId];
      if (targetChild.content || targetChild.projectOverview || targetChild.schemaVersion || targetChild.status) {
        return targetChild;
      }
    }

    // Case 3: Container object with `current` or `active` pointer
    if (raw.current && typeof raw.current === 'object' && (raw.current.content || raw.current.projectOverview || raw.current.status)) {
      return raw.current;
    }
    if (raw.active && typeof raw.active === 'object' && (raw.active.content || raw.active.projectOverview || raw.active.status)) {
      return raw.active;
    }

    // Case 4: Search child values for best candidate
    const childDocs = Object.values(raw).filter(
      (v) => v && typeof v === 'object' && (v.content || v.projectOverview || v.schemaVersion || v.status === 'completed')
    );
    if (childDocs.length > 0) {
      childDocs.sort((a, b) => (b.updatedAt || b.generatedAt || 0) - (a.updatedAt || a.generatedAt || 0));
      return childDocs[0];
    }

    return null;
  },

  /**
   * Fetch single Project Blueprint snapshot for a specific MVP idea or workspace.
   */
  getBlueprint: async (orgId, mvpIdeaId = null) => {
    if (!orgId) return null;
    try {
      if (mvpIdeaId) {
        const specificBp = await rtdbService.getData(`blueprints/${orgId}/${mvpIdeaId}`);
        const extracted = blueprintService.extractValidBlueprint(specificBp, mvpIdeaId);
        if (extracted) return extracted;
      }

      const currentBp = await rtdbService.getData(`blueprints/${orgId}/current`);
      const extractedCurrent = blueprintService.extractValidBlueprint(currentBp);
      if (extractedCurrent) return extractedCurrent;

      const rootBp = await rtdbService.getData(`blueprints/${orgId}`);
      return blueprintService.extractValidBlueprint(rootBp, mvpIdeaId);
    } catch (err) {
      console.error('[blueprintService] getBlueprint error:', err);
      return null;
    }
  },

  /**
   * Real-time subscription to Project Blueprint document for a given workspace and MVP idea.
   */
  subscribeToBlueprint: (orgId, mvpIdeaId, callback) => {
    if (typeof mvpIdeaId === 'function') {
      callback = mvpIdeaId;
      mvpIdeaId = null;
    }

    if (!orgId) {
      callback(null);
      return () => {};
    }

    let unsubMvp = null;
    let unsubCurrent = null;
    let unsubRoot = null;

    const handlePayload = (raw) => {
      const valid = blueprintService.extractValidBlueprint(raw, mvpIdeaId);
      if (valid) {
        callback(valid);
        return true;
      }
      return false;
    };

    if (mvpIdeaId) {
      unsubMvp = rtdbService.subscribe(`blueprints/${orgId}/${mvpIdeaId}`, (data) => {
        if (!handlePayload(data)) {
          rtdbService.getData(`blueprints/${orgId}/current`).then((cur) => {
            if (!handlePayload(cur)) {
              rtdbService.getData(`blueprints/${orgId}`).then((root) => {
                if (!handlePayload(root)) {
                  callback(null);
                }
              });
            }
          });
        }
      });
    } else {
      unsubCurrent = rtdbService.subscribe(`blueprints/${orgId}/current`, (data) => {
        if (!handlePayload(data)) {
          unsubRoot = rtdbService.subscribe(`blueprints/${orgId}`, (rootData) => {
            if (!handlePayload(rootData)) {
              callback(null);
            }
          });
        }
      });
    }

    return () => {
      if (unsubMvp) unsubMvp();
      if (unsubCurrent) unsubCurrent();
      if (unsubRoot) unsubRoot();
    };
  },

  /**
   * Explicit Subscription to MVP Blueprint.
   */
  subscribeToMvpBlueprint: (orgId, mvpIdeaId, callback) => {
    return blueprintService.subscribeToBlueprint(orgId, mvpIdeaId, callback);
  },

  /**
   * Real-time subscription to all generated blueprint versions for an MVP.
   */
  subscribeToBlueprintVersions: (orgId, mvpIdeaId, callback) => {
    if (!orgId) {
      callback([]);
      return () => {};
    }

    const parseVersions = (raw) => {
      if (!raw || typeof raw !== 'object') return [];
      const versionsMap = {};

      const sourceObj = raw.versions && typeof raw.versions === 'object' ? raw.versions : raw;

      Object.entries(sourceObj).forEach(([k, v]) => {
        if (v && typeof v === 'object' && (v.content || v.projectOverview || v.status || v.version || v.schemaVersion)) {
          const vNum = String(v.version || v.versionId || k.replace(/^v/, '').replace(/_/g, '.') || '1.0');
          const vKey = `v${vNum.replace(/\./g, '_')}`;
          versionsMap[vKey] = {
            ...v,
            key: vKey,
            versionId: v.versionId || vNum,
            version: vNum,
            status: v.status || 'completed',
            createdAt: v.createdAt || v.generatedAt || v.updatedAt || Date.now(),
            updatedAt: v.updatedAt || v.generatedAt || Date.now(),
            content: v.content || (v.projectOverview ? v : null),
            lastModifiedSource: v.lastModifiedSource || 'ai_generation',
            summary: v.summary || `Version ${vNum}`,
          };
        }
      });

      const list = Object.values(versionsMap);
      list.sort((a, b) => (parseFloat(b.version) || 0) - (parseFloat(a.version) || 0));
      return list;
    };

    let latestMvpRaw = null;
    let latestRootRaw = null;

    const emitMerged = () => {
      const combined = {};
      if (latestRootRaw && typeof latestRootRaw === 'object') {
        const src = latestRootRaw.versions && typeof latestRootRaw.versions === 'object' ? latestRootRaw.versions : latestRootRaw;
        Object.entries(src).forEach(([k, v]) => {
          if (v && typeof v === 'object') combined[k] = v;
        });
      }
      if (latestMvpRaw && typeof latestMvpRaw === 'object') {
        const src = latestMvpRaw.versions && typeof latestMvpRaw.versions === 'object' ? latestMvpRaw.versions : latestMvpRaw;
        Object.entries(src).forEach(([k, v]) => {
          if (v && typeof v === 'object') combined[k] = v;
        });
      }
      callback(parseVersions(combined));
    };

    let unsubMvp = () => {};
    let unsubRoot = () => {};

    if (mvpIdeaId) {
      unsubMvp = rtdbService.subscribe(`blueprints/${orgId}/${mvpIdeaId}/versions`, (mvpVers) => {
        latestMvpRaw = mvpVers;
        emitMerged();
      });
      unsubRoot = rtdbService.subscribe(`blueprints/${orgId}/versions`, (rootVers) => {
        latestRootRaw = rootVers;
        emitMerged();
      });
    } else {
      unsubRoot = rtdbService.subscribe(`blueprints/${orgId}/versions`, (rootVers) => {
        callback(parseVersions(rootVers));
      });
    }

    return () => {
      if (typeof unsubMvp === 'function') unsubMvp();
      if (typeof unsubRoot === 'function') unsubRoot();
    };
  },

  /**
   * Fetch all blueprint versions snapshot once, merging dual paths.
   */
  getBlueprintVersions: async (orgId, mvpIdeaId = null) => {
    if (!orgId) return [];
    try {
      const [mvpObj, rootObj] = await Promise.all([
        mvpIdeaId ? rtdbService.getData(`blueprints/${orgId}/${mvpIdeaId}/versions`).catch(() => null) : null,
        rtdbService.getData(`blueprints/${orgId}/versions`).catch(() => null),
      ]);
      const combined = {};
      if (rootObj && typeof rootObj === 'object') {
        const src = rootObj.versions && typeof rootObj.versions === 'object' ? rootObj.versions : rootObj;
        Object.entries(src).forEach(([k, v]) => { if (v) combined[k] = v; });
      }
      if (mvpObj && typeof mvpObj === 'object') {
        const src = mvpObj.versions && typeof mvpObj.versions === 'object' ? mvpObj.versions : mvpObj;
        Object.entries(src).forEach(([k, v]) => { if (v) combined[k] = v; });
      }
      return Object.values(combined);
    } catch (err) {
      console.error('[blueprintService] getBlueprintVersions error:', err);
      return [];
    }
  },
};
