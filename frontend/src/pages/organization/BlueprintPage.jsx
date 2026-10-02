import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useOrg } from '../../hooks/useOrg';
import { usePlatformSettings } from '../../hooks/usePlatformSettings';
import { orgService } from '../../services/orgService';
import { ideaService } from '../../services/ideaService';
import { blueprintService } from '../../services/blueprintService';
import { aiBlueprintService } from '../../services/aiBlueprintService';
import { taskService } from '../../services/taskService';
import { rtdbService } from '../../services/rtdbService';
import { NotificationService } from '../../services/notificationService';
import { NOTIFICATION_MESSAGES } from '../../utils/notificationMessages';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/feedback/Spinner';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { normalizeBlueprintForDisplay } from '../../utils/blueprintCompatibility';

// Blueprint 2.0 Modular Subcomponents (Phase 8)
import { BlueprintHeader } from '../../components/blueprint/BlueprintHeader';
import { BlueprintSearchModal } from '../../components/blueprint/BlueprintSearchModal';
import { BlueprintEntityDetailDrawer } from '../../components/blueprint/BlueprintEntityDetailDrawer';
import { BlueprintGenerationProgress } from '../../components/blueprint/BlueprintGenerationProgress';
import { BlueprintOverviewTab } from '../../components/blueprint/BlueprintOverviewTab';
import { BlueprintRequirementsTab } from '../../components/blueprint/BlueprintRequirementsTab';
import { BlueprintArchitectureTab } from '../../components/blueprint/BlueprintArchitectureTab';
import { BlueprintExecutionTab } from '../../components/blueprint/BlueprintExecutionTab';
import { BlueprintTeamTab } from '../../components/blueprint/BlueprintTeamTab';
import { BlueprintRisksAndQualityTab } from '../../components/blueprint/BlueprintRisksAndQualityTab';
import { BlueprintDecisionsTab } from '../../components/blueprint/BlueprintDecisionsTab';
import { BlueprintVersionHistoryTab } from '../../components/blueprint/BlueprintVersionHistoryTab';
import { BlueprintApprovalModal } from '../../components/blueprint/BlueprintApprovalModal';

import {
  Sparkles,
  AlertTriangle,
  Wand2,
} from 'lucide-react';

export default function BlueprintPage() {
  const { orgId, ideaId } = useParams();
  const { user } = useAuth();
  const { isLeader } = useOrg();
  const { canUseBlueprint } = usePlatformSettings();
  const blueprintCheck = canUseBlueprint();

  const [org, setOrg] = useState(null);
  const [activeMvpId, setActiveMvpId] = useState(ideaId || null);
  const [mvpIdea, setMvpIdea] = useState(null);
  const [blueprint, setBlueprint] = useState(null);
  const [blueprintVersions, setBlueprintVersions] = useState([]);
  const [selectedVersionKey, setSelectedVersionKey] = useState(null);
  const [orgMembers, setOrgMembers] = useState([]);

  // UI & Tab State
  const [activeTab, setActiveTab] = useState('overview');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedEntityForDrawer, setSelectedEntityForDrawer] = useState(null);

  // Loading States
  const [loadingOrg, setLoadingOrg] = useState(true);
  const [loadingIdea, setLoadingIdea] = useState(true);
  const [loadingBlueprint, setLoadingBlueprint] = useState(true);

  // Synchronize activeMvpId when route ideaId changes
  useEffect(() => {
    if (ideaId) {
      setActiveMvpId(ideaId);
    }
  }, [ideaId]);

  // Generation & Operation States
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStageIndex, setGenerationStageIndex] = useState(0);
  const [assigningTaskId, setAssigningTaskId] = useState(null);
  const [processingDecisionId, setProcessingDecisionId] = useState(null);
  const [processingRecommendationId, setProcessingRecommendationId] = useState(null);
  const [isSyncingTasks, setIsSyncingTasks] = useState(false);
  const [liveExecutionTasks, setLiveExecutionTasks] = useState([]);
  const [isActivatingVersion, setIsActivatingVersion] = useState(false);
  const [stalenessInfo, setStalenessInfo] = useState(null);
  const [dismissedStale, setDismissedStale] = useState(false);

  // Phase 11: Approval Gate States
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [readinessData, setReadinessData] = useState(null);
  const [isApproving, setIsApproving] = useState(false);

  // Editing States
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showRegenWarningModal, setShowRegenWarningModal] = useState(false);

  // Export States
  const [isExportingJson, setIsExportingJson] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // 1. Subscribe to Organization & Active MVP Resolution
  useEffect(() => {
    // Reset workspace-scoped blueprint state on orgId transition
    setOrg(null);
    setBlueprint(null);
    setMvpIdea(null);
    setActiveMvpId(null);
    setBlueprintVersions([]);
    setLiveExecutionTasks([]);
    setOrgMembers([]);
    setEditForm(null);
    setSelectedVersionKey(null);
    setSelectedEntityForDrawer(null);

    if (!orgId) return;
    setLoadingOrg(true);

    const unsubOrg = orgService.subscribeToOrganization(orgId, (orgData) => {
      setOrg(orgData);
      setLoadingOrg(false);
      const orgMvpId = orgData?.activeProjectId || orgData?.selectedIdeaId || orgData?.activeMvpId;
      if (orgMvpId) {
        setActiveMvpId((prev) => prev || orgMvpId);
      }
    });

    const unsubMeta = rtdbService.subscribe(`workspaces/${orgId}/metadata`, (meta) => {
      const liveMvpId = meta?.selectedIdeaId || meta?.activeMvpId || meta?.activeProjectId;
      if (liveMvpId) {
        setActiveMvpId((prev) => prev || liveMvpId);
      }
    });

    const unsubMembers = orgService.subscribeToOrgMembers(orgId, (membersData) => {
      setOrgMembers(Array.isArray(membersData) ? membersData : Object.values(membersData || {}));
    });

    // Realtime live execution task listener from Task Board
    const unsubTasks = taskService.subscribeToTasks(orgId, (tasks) => {
      setLiveExecutionTasks(Array.isArray(tasks) ? tasks : []);
    });

    return () => {
      if (unsubOrg) unsubOrg();
      if (unsubMeta) unsubMeta();
      if (unsubMembers) unsubMembers();
      if (unsubTasks) unsubTasks();
    };
  }, [orgId]);

  // Fallback MVP resolution from ideas collection if metadata is not populated
  useEffect(() => {
    if (!orgId) return;
    const unsubIdeas = ideaService.subscribeToIdeas(orgId, (ideas) => {
      if (!Array.isArray(ideas) || ideas.length === 0) return;
      const selected =
        ideas.find(
          (i) =>
            i &&
            !i.isDeleted &&
            (i.isSelected ||
              i.status === 'selected' ||
              i.status === 'Selected MVP' ||
              i.projectStatus === 'Selected MVP')
        ) || (ideaId ? ideas.find((i) => i && (i.ideaId === ideaId || i.id === ideaId)) : null);

      if (selected) {
        const foundId = selected.ideaId || selected.id;
        setActiveMvpId((prev) => prev || foundId);
        setMvpIdea((prev) => prev || selected);
      }
    });
    return () => {
      if (unsubIdeas) unsubIdeas();
    };
  }, [orgId, ideaId]);

  // 2. Fetch Selected MVP Idea Record
  useEffect(() => {
    const targetId = activeMvpId || ideaId || org?.activeProjectId || org?.selectedIdeaId;
    if (!orgId || !targetId) {
      setLoadingIdea(false);
      return;
    }
    setLoadingIdea(true);
    const unsubIdea = ideaService.subscribeToIdea(orgId, targetId, (ideaData) => {
      if (ideaData) {
        setMvpIdea({ ...ideaData, ideaId: targetId });
        setActiveMvpId(targetId);
      }
      setLoadingIdea(false);
    });
    return () => {
      if (unsubIdea) unsubIdea();
    };
  }, [orgId, ideaId, activeMvpId, org?.activeProjectId, org?.selectedIdeaId]);

  // 3. Subscribe to Real-Time Blueprint Document
  useEffect(() => {
    const targetId = activeMvpId || ideaId || org?.activeProjectId;
    if (!orgId) {
      setLoadingBlueprint(false);
      return;
    }
    setLoadingBlueprint(true);
    const unsubBp = blueprintService.subscribeToBlueprint(orgId, targetId, (bpData) => {
      setBlueprint(bpData);
      setLoadingBlueprint(false);
    });
    return () => {
      if (unsubBp) unsubBp();
    };
  }, [orgId, ideaId, activeMvpId, org?.activeProjectId]);

  // 4. Subscribe to Real-Time Blueprint Versions for History Tab
  useEffect(() => {
    const targetId = activeMvpId || ideaId || org?.activeProjectId;
    if (!orgId) return;
    const unsubVersions = blueprintService.subscribeToBlueprintVersions(orgId, targetId, (versionsList) => {
      setBlueprintVersions(Array.isArray(versionsList) ? versionsList : []);
    });
    return () => {
      if (unsubVersions) unsubVersions();
    };
  }, [orgId, ideaId, activeMvpId, org?.activeProjectId]);

  // 5. Immediate Authoritative Hydration Fallback on Mount
  useEffect(() => {
    if (!orgId || !user?.uid) return;
    let isMounted = true;

    aiBlueprintService
      .fetchActiveBlueprint(orgId, user.uid)
      .then((res) => {
        if (!isMounted) return;
        const fetchedDoc = res?.data?.blueprint || res?.blueprint;
        if (fetchedDoc && (fetchedDoc.content || fetchedDoc.projectOverview)) {
          setBlueprint((prev) => prev || fetchedDoc);
        }
      })
      .catch((err) => {
        // Silently ignore on mount since RTDB subscription is primary
      });

    return () => {
      isMounted = false;
    };
  }, [orgId, user?.uid]);

  // Merge current live blueprint with historical versions
  const effectiveBlueprintVersions = useMemo(() => {
    const list = [...blueprintVersions];

    if (blueprint?.versions && typeof blueprint.versions === 'object') {
      Object.entries(blueprint.versions).forEach(([key, vDoc]) => {
        if (vDoc && (vDoc.content || vDoc.projectOverview || vDoc.schemaVersion)) {
          const vNum = String(vDoc.version || vDoc.versionId || key.replace(/^v/, '').replace(/_/g, '.') || '1.0');
          if (!list.some((existing) => String(existing.version) === vNum)) {
            list.push({
              key,
              versionId: vDoc.versionId || vNum,
              version: vNum,
              createdAt: vDoc.createdAt || vDoc.generatedAt || Date.now(),
              updatedAt: vDoc.updatedAt || Date.now(),
              lastModifiedSource: vDoc.lastModifiedSource || 'ai_generation',
              content: vDoc.content || (vDoc.projectOverview ? vDoc : null),
              summary: vDoc.summary || `Version ${vNum}`,
              status: vDoc.status || 'completed',
            });
          }
        }
      });
    }

    if (blueprint && blueprint.content && !list.some((v) => String(v.version) === String(blueprint.version))) {
      list.unshift({
        key: 'current',
        versionId: blueprint.version || '1.0',
        version: String(blueprint.version || '1.0'),
        createdAt: blueprint.createdAt || Date.now(),
        updatedAt: blueprint.updatedAt || Date.now(),
        lastModifiedSource: blueprint.lastModifiedSource || 'ai_generation',
        content: blueprint.content,
        summary: blueprint.summary || 'Active Canonical Blueprint',
        status: blueprint.status || 'completed',
      });
    }
    return list.sort((a, b) => (parseFloat(b.version) || 0) - (parseFloat(a.version) || 0));
  }, [blueprintVersions, blueprint]);

  // 1. Authoritative Active Version of the workspace
  const activeVersion = useMemo(() => {
    if (blueprint?.activeVersionId || blueprint?.activeVersionNumber) {
      return String(blueprint.activeVersionId || blueprint.activeVersionNumber);
    }
    if (blueprint?.version && (blueprint.approvalStatus === 'approved' || blueprint.lifecycleState === 'active')) {
      return String(blueprint.version);
    }
    if (effectiveBlueprintVersions && effectiveBlueprintVersions.length > 0) {
      const approvedEntry = effectiveBlueprintVersions.find(
        (v) => v.approvalStatus === 'approved' || v.lifecycleState === 'active' || v.status === 'approved'
      );
      if (approvedEntry) return String(approvedEntry.version);
      return String(effectiveBlueprintVersions[0].version || '1.0');
    }
    return blueprint?.version ? String(blueprint.version) : '1.0';
  }, [effectiveBlueprintVersions, blueprint]);

  // 2. Resolve Currently Displayed Blueprint Document (Active vs Historical Preview)
  const displayedBlueprint = useMemo(() => {
    let raw = null;

    // Case A: User explicitly selected a specific historical version
    if (selectedVersionKey && effectiveBlueprintVersions.length > 0) {
      const match = effectiveBlueprintVersions.find(
        (v) => v.key === selectedVersionKey || String(v.version) === String(selectedVersionKey)
      );
      if (match && (match.content || match.projectOverview)) {
        raw = {
          ...match,
          version: String(match.version || selectedVersionKey),
          status: 'completed',
          content: match.content,
        };
      }
    }

    // Case B: Live active blueprint has valid content
    if (!raw && blueprint && (blueprint.content || blueprint.projectOverview)) {
      const contentObj = blueprint.content || (blueprint.projectOverview ? blueprint : null);
      raw = {
        ...blueprint,
        version: String(blueprint.version || activeVersion),
        status: isGenerating ? 'generating' : (blueprint.status || 'completed'),
        content: contentObj,
      };
    }

    // Case C: Live active blueprint root has no content / stale state, but version history exists
    if (!raw && effectiveBlueprintVersions.length > 0) {
      const latestValidSnapshot = effectiveBlueprintVersions.find((v) => v && (v.content || v.projectOverview));
      if (latestValidSnapshot) {
        raw = {
          ...latestValidSnapshot,
          version: String(latestValidSnapshot.version || activeVersion),
          status: isGenerating ? 'generating' : 'completed',
          content: latestValidSnapshot.content,
        };
      }
    }

    // Case D: Fallback to whatever blueprint draft/placeholder exists
    if (!raw && blueprint) {
      raw = {
        ...blueprint,
        version: String(blueprint.version || activeVersion),
        status: isGenerating ? 'generating' : (blueprint.status || 'draft'),
        content: blueprint.content || null,
      };
    }

    return normalizeBlueprintForDisplay(raw);
  }, [selectedVersionKey, effectiveBlueprintVersions, blueprint, activeVersion, isGenerating]);

  // 3. The version currently being viewed
  const viewedVersion = useMemo(() => {
    if (selectedVersionKey && selectedVersionKey !== 'current') {
      return String(selectedVersionKey);
    }
    return String(displayedBlueprint?.version || activeVersion);
  }, [selectedVersionKey, displayedBlueprint?.version, activeVersion]);

  // 4. Whether user is viewing a read-only historical version
  const isViewingHistorical = useMemo(() => {
    if (!selectedVersionKey || selectedVersionKey === 'current') return false;
    return String(selectedVersionKey) !== String(activeVersion);
  }, [selectedVersionKey, activeVersion]);

  // 5. Live Task Status Reflection & Dynamic Overlay into Blueprint
  const enrichedBlueprint = useMemo(() => {
    if (!displayedBlueprint || !displayedBlueprint.content) return displayedBlueprint;

    const rawV2 = displayedBlueprint.rawV2Content || displayedBlueprint.__v2Content || displayedBlueprint.content || {};
    const execution = rawV2.execution || {};
    const plannedTasks = execution.tasks || [];

    if (!Array.isArray(plannedTasks) || plannedTasks.length === 0 || !Array.isArray(liveExecutionTasks)) {
      return displayedBlueprint;
    }

    const liveByTaskId = new Map();
    const liveBySourceKey = new Map();
    const liveByBpTaskId = new Map();

    liveExecutionTasks.forEach((t) => {
      if (!t) return;
      if (t.taskId) liveByTaskId.set(t.taskId, t);
      
      const bpId = t.sourceBlueprintTaskId || t.blueprintTaskId;
      const bpVer = String(t.sourceBlueprintVersionId || t.blueprintVersion || '');
      if (bpId && bpVer) {
        liveBySourceKey.set(`${bpId}__v${bpVer}`, t);
      }
      if (bpId) {
        liveByBpTaskId.set(bpId, t);
      }
    });

    const currentViewVer = String(viewedVersion || displayedBlueprint.version || '1.0');

    const enrichedTasks = plannedTasks.map((pt) => {
      const bpTaskId = pt.id;
      
      // Match candidate 1: Direct link via convertedTaskId
      let match = pt.convertedTaskId ? liveByTaskId.get(pt.convertedTaskId) : null;

      // Match candidate 2: Exact matching source blueprint version + task ID
      if (!match && bpTaskId) {
        match = liveBySourceKey.get(`${bpTaskId}__v${currentViewVer}`);
      }

      // Match candidate 3: Matching blueprintTaskId on active project if viewing active version
      if (!match && bpTaskId && !isViewingHistorical) {
        match = liveByBpTaskId.get(bpTaskId);
      }

      if (match) {
        if (match.isDeleted) {
          return {
            ...pt,
            executionTaskId: match.taskId,
            isExecutionLinked: false,
            isExecutionDeleted: true,
            executionStatus: 'Unlinked',
            status: 'Unlinked',
            sourceBlueprintVersionId: match.sourceBlueprintVersionId || currentViewVer,
          };
        }

        const liveStatus = match.status || 'Todo';
        return {
          ...pt,
          executionTaskId: match.taskId,
          isExecutionLinked: true,
          isExecutionDeleted: false,
          executionStatus: liveStatus,
          status: liveStatus,
          assignedUserId: match.assignedTo || pt.assignedUserId,
          assignedUserName: match.assignedToName || pt.assignedUserName,
          sourceBlueprintVersionId: match.sourceBlueprintVersionId || currentViewVer,
        };
      }

      return {
        ...pt,
        isExecutionLinked: false,
        isExecutionDeleted: false,
        status: pt.status || 'Todo',
        executionStatus: pt.status || 'Todo',
      };
    });

    const newContent = {
      ...displayedBlueprint.content,
      execution: {
        ...execution,
        tasks: enrichedTasks,
      },
    };

    return {
      ...displayedBlueprint,
      content: newContent,
      rawV2Content: {
        ...rawV2,
        execution: {
          ...execution,
          tasks: enrichedTasks,
        },
      },
    };
  }, [displayedBlueprint, liveExecutionTasks, viewedVersion, isViewingHistorical]);

  // Handlers for Operations
  const handleStartEdit = () => {
    if (!blueprint?.content) return;
    setEditForm(JSON.parse(JSON.stringify(blueprint.content)));
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm(null);
  };

  // Phase 9: Staleness & Context-Shift Auto-Detection
  useEffect(() => {
    if (!orgId || !user?.uid || !blueprint?.content) return;
    aiBlueprintService.checkBlueprintStaleness(orgId, user.uid)
      .then((res) => {
        if (res && res.isStale) {
          setStalenessInfo(res);
        } else {
          setStalenessInfo(null);
        }
      })
      .catch(() => {});
  }, [orgId, user?.uid, blueprint?.updatedAt, blueprint?.version]);

  const handleSaveEdit = async () => {
    if (!orgId || !user?.uid || !editForm) return;

    setIsSaving(true);
    try {
      await aiBlueprintService.updateBlueprint(orgId, user.uid, {
        content: editForm,
        expectedUpdatedAt: blueprint?.updatedAt,
        expectedVersion: blueprint?.version,
      });
      NotificationService.success('Blueprint changes saved successfully.');
      setIsEditing(false);
      setEditForm(null);
    } catch (err) {
      console.error('[BlueprintPage] handleSaveEdit error:', err);
      NotificationService.error(err.message || 'Failed to save Blueprint changes.');
    } finally {
      setIsSaving(false);
    }
  };

  // Phase 9: Handle Explicit Version Activation
  const handleActivateVersion = async (targetVersionKey) => {
    if (!orgId || !user?.uid || !targetVersionKey) return;

    setIsActivatingVersion(true);
    try {
      await aiBlueprintService.activateBlueprintVersion(orgId, user.uid, targetVersionKey);
      NotificationService.success(`Version ${targetVersionKey} is now the active authoritative Blueprint.`);
      setSelectedVersionKey(null);
    } catch (err) {
      console.error('[BlueprintPage] handleActivateVersion error:', err);
      NotificationService.error(err.message || 'Failed to activate Blueprint version.');
    } finally {
      setIsActivatingVersion(false);
    }
  };

  // Phase 11: Handle Formal Approval Gate
  const handleOpenApprovalModal = async () => {
    if (!orgId || !user?.uid) return;
    setIsApprovalModalOpen(true);
    try {
      const res = await aiBlueprintService.checkApprovalReadiness(
        orgId,
        user.uid,
        selectedVersionKey || activeVersion
      );
      setReadinessData(res);
    } catch (err) {
      console.warn('[BlueprintPage] checkApprovalReadiness error:', err);
    }
  };

  const handleApproveBlueprint = async () => {
    if (!orgId || !user?.uid) return;
    const targetVer = selectedVersionKey || activeVersion;
    setIsApproving(true);
    try {
      await aiBlueprintService.approveBlueprintVersion(orgId, user.uid, targetVer);
      NotificationService.success(`Blueprint Version ${targetVer} approved & activated for execution.`);
      setIsApprovalModalOpen(false);
      setSelectedVersionKey(null);
    } catch (err) {
      console.error('[BlueprintPage] handleApproveBlueprint error:', err);
      NotificationService.error(err.message || 'Failed to approve Blueprint version.');
    } finally {
      setIsApproving(false);
    }
  };

  const handleAssignTask = async (taskId, targetUserId, targetUserName) => {
    if (!orgId || !user?.uid || !taskId) return;

    setAssigningTaskId(taskId);
    try {
      await aiBlueprintService.assignBlueprintTask(orgId, user.uid, taskId, targetUserId);
      NotificationService.success(targetUserId ? `Assigned task ${taskId} to ${targetUserName}.` : 'Task unassigned.');
    } catch (err) {
      console.error('[BlueprintPage] handleAssignTask error:', err);
      NotificationService.error(err.message || 'Failed to update task assignment.');
    } finally {
      setAssigningTaskId(null);
    }
  };

  const handleApproveDecision = async (decisionId) => {
    if (!orgId || !user?.uid || !decisionId) return;
    setProcessingDecisionId(decisionId);
    try {
      await aiBlueprintService.approveDecision(orgId, user.uid, decisionId);
      NotificationService.success(`Decision ${decisionId} approved.`);
    } catch (err) {
      console.error('[BlueprintPage] handleApproveDecision error:', err);
      NotificationService.error(err.message || 'Failed to approve decision.');
    } finally {
      setProcessingDecisionId(null);
    }
  };

  const handleRejectDecision = async (decisionId) => {
    if (!orgId || !user?.uid || !decisionId) return;
    setProcessingDecisionId(decisionId);
    try {
      await aiBlueprintService.rejectDecision(orgId, user.uid, decisionId);
      NotificationService.success(`Decision ${decisionId} marked as rejected.`);
    } catch (err) {
      console.error('[BlueprintPage] handleRejectDecision error:', err);
      NotificationService.error(err.message || 'Failed to reject decision.');
    } finally {
      setProcessingDecisionId(null);
    }
  };

  const handleApproveChangeRecommendation = async (recommendationId) => {
    if (!orgId || !user?.uid || !recommendationId) return;
    setProcessingRecommendationId(recommendationId);
    try {
      await aiBlueprintService.approveChangeRecommendation(orgId, user.uid, recommendationId);
      NotificationService.success(`Change recommendation ${recommendationId} approved.`);
    } catch (err) {
      console.error('[BlueprintPage] handleApproveChangeRecommendation error:', err);
      NotificationService.error(err.message || 'Failed to approve change recommendation.');
    } finally {
      setProcessingRecommendationId(null);
    }
  };

  const handleRejectChangeRecommendation = async (recommendationId) => {
    if (!orgId || !user?.uid || !recommendationId) return;
    setProcessingRecommendationId(recommendationId);
    try {
      await aiBlueprintService.rejectChangeRecommendation(orgId, user.uid, recommendationId);
      NotificationService.success(`Change recommendation ${recommendationId} rejected.`);
    } catch (err) {
      console.error('[BlueprintPage] handleRejectChangeRecommendation error:', err);
      NotificationService.error(err.message || 'Failed to reject change recommendation.');
    } finally {
      setProcessingRecommendationId(null);
    }
  };

  const handleSyncBlueprintTasks = async () => {
    if (!orgId || !user?.uid) return;
    setIsSyncingTasks(true);
    try {
      const targetVer = selectedVersionKey || activeVersion;
      const res = await aiBlueprintService.syncBlueprintTasks(orgId, user.uid, targetVer);
      const msg = res?.data?.message || res?.message || 'Blueprint planned tasks synchronized to Task Board.';
      NotificationService.success(msg);
    } catch (err) {
      console.error('[BlueprintPage] handleSyncBlueprintTasks error:', err);
      NotificationService.error(err.message || 'Failed to sync Blueprint tasks.');
    } finally {
      setIsSyncingTasks(false);
    }
  };

  const handleExportJson = async () => {
    if (isEditing) {
      NotificationService.warning('Save your changes before exporting.');
      return;
    }
    if (!orgId || !user?.uid) return;

    setIsExportingJson(true);
    setShowExportMenu(false);

    try {
      await aiBlueprintService.exportBlueprintJson(orgId, user.uid, displayedBlueprint?.version, displayedBlueprint);
      NotificationService.success('Blueprint exported successfully as JSON.');
    } catch (err) {
      console.error('[BlueprintPage] handleExportJson error:', err);
      NotificationService.error(err.message || 'Failed to export Blueprint JSON.');
    } finally {
      setIsExportingJson(false);
    }
  };

  const handleExportPdf = async () => {
    if (isEditing) {
      NotificationService.warning('Save your changes before exporting.');
      return;
    }
    if (!orgId || !user?.uid) return;

    setIsExportingPdf(true);
    setShowExportMenu(false);

    try {
      await aiBlueprintService.exportBlueprintPdf(orgId, user.uid, org?.name || 'Workspace', displayedBlueprint?.version, displayedBlueprint);
      NotificationService.success('Blueprint exported successfully as PDF.');
    } catch (err) {
      console.error('[BlueprintPage] handleExportPdf error:', err);
      NotificationService.error(err.message || 'Failed to export Blueprint PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleGenerateBlueprint = async () => {
    if (!orgId || !user?.uid) return;

    setShowRegenWarningModal(false);
    setIsGenerating(true);
    setGenerationStageIndex(0);

    try {
      const res = await aiBlueprintService.generateBlueprint(orgId, user.uid);
      const generatedDoc = res?.data?.blueprint || res?.blueprint;

      setSelectedVersionKey(null);
      if (generatedDoc) {
        setBlueprint(generatedDoc);
      }
      NotificationService.success(NOTIFICATION_MESSAGES.ADMIN.BLUEPRINT_SAVED || 'AI Blueprint generated successfully.');
    } catch (err) {
      console.error('[BlueprintPage] handleGenerateBlueprint error:', err);
      NotificationService.error('Blueprint generation failed. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenButtonClick = () => {
    if (blueprint?.lastModifiedSource === 'manual' || isEditing) {
      setShowRegenWarningModal(true);
    } else {
      handleGenerateBlueprint();
    }
  };

  // Inspect entity helper (opens drawer)
  const handleInspectEntity = (entity) => {
    setSelectedEntityForDrawer(entity);
  };

  // Select entity by ID (e.g. from cross-entity link clicks)
  const handleSelectEntityById = (targetId, targetType) => {
    const activeDoc = enrichedBlueprint || displayedBlueprint;
    const v2 = activeDoc?.rawV2Content || activeDoc?.__v2Content || activeDoc?.content || {};

    if (targetType === 'requirement') {
      const req = (v2.requirements || []).find((r) => r.id === targetId);
      if (req) {
        handleInspectEntity({
          id: req.id,
          type: 'requirement',
          title: req.title,
          description: req.description,
          priority: req.priority,
          status: req.status,
          raw: req,
        });
        return;
      }
    }

    if (targetType === 'task') {
      const task = (v2.execution?.tasks || []).find((t) => t.id === targetId);
      if (task) {
        handleInspectEntity({
          id: task.id,
          type: 'task',
          title: task.title,
          description: task.description,
          priority: task.priority,
          status: task.status,
          raw: task,
        });
        return;
      }
    }

    if (targetType === 'feature') {
      const feat = (v2.execution?.features || []).find((f) => f.id === targetId);
      if (feat) {
        handleInspectEntity({
          id: feat.id,
          type: 'feature',
          title: feat.name,
          description: feat.description,
          priority: feat.priority,
          status: feat.status,
          raw: feat,
        });
        return;
      }
    }

    if (targetType === 'decision') {
      const dec = (v2.intelligence?.discussionIntelligence?.decisions || []).find((d) => d.id === targetId);
      if (dec) {
        handleInspectEntity({
          id: dec.id,
          type: 'decision',
          title: dec.title || dec.decision,
          description: dec.rationale,
          status: dec.status,
          raw: dec,
        });
        return;
      }
    }

    if (targetType === 'risk') {
      const rk = (v2.quality?.risks || []).find((r) => r.id === targetId);
      if (rk) {
        handleInspectEntity({
          id: rk.id,
          type: 'risk',
          title: rk.title,
          description: rk.description,
          priority: rk.severity,
          raw: rk,
        });
        return;
      }
    }
  };

  if (!blueprintCheck.allowed) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center space-y-4">
        <Card className="p-8 border border-amber-200 bg-amber-50 rounded-2xl text-amber-900 space-y-3 shadow-md">
          <AlertTriangle className="h-10 w-10 text-amber-600 mx-auto" />
          <h3 className="text-lg font-extrabold">Feature Disabled</h3>
          <p className="text-sm font-medium">{blueprintCheck.reason}</p>
        </Card>
      </div>
    );
  }

  if (loadingOrg || loadingIdea || loadingBlueprint) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <LoadingSkeleton className="h-28 w-full rounded-3xl" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <LoadingSkeleton className="h-32 rounded-2xl" />
          <LoadingSkeleton className="h-32 rounded-2xl" />
          <LoadingSkeleton className="h-32 rounded-2xl" />
          <LoadingSkeleton className="h-32 rounded-2xl" />
        </div>
        <LoadingSkeleton className="h-96 rounded-3xl" />
      </div>
    );
  }

  const targetMvpId = activeMvpId || ideaId || org?.activeProjectId || org?.selectedIdeaId;

  if (!targetMvpId && !mvpIdea) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center space-y-6">
        <EmptyState
          icon={<Sparkles className="h-8 w-8 text-primary-500" />}
          title="No MVP Idea Selected Yet"
          description="A project proposal must be voted on and marked as the Workspace MVP before generating an AI Blueprint."
          action={
            <Link to={`/workspaces/${orgId}/ideas`}>
              <Button variant="primary">Explore Workspace Ideas</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const activeDoc = enrichedBlueprint || displayedBlueprint;
  const isBlueprintCompleted = activeDoc?.status === 'completed';
  const isBlueprintFailed = blueprint?.status === 'failed';
  const isBlueprintStale = blueprint?.status === 'stale';
  const content = isEditing ? editForm : activeDoc?.content;
  const v2 = activeDoc?.rawV2Content || activeDoc?.__v2Content || content || {};

  // Compute navigation badge counts
  const stats = {
    requirementsCount: v2.requirements?.length || 0,
    tasksCount: v2.execution?.tasks?.length || 0,
    decisionsCount: v2.intelligence?.discussionIntelligence?.decisions?.length || 0,
    versionsCount: effectiveBlueprintVersions.length,
    criticalRisksCount: (v2.quality?.risks || []).filter((r) => r.severity === 'Critical' || r.severity === 'High').length,
    blockingQuestionsCount: (v2.intelligence?.discussionIntelligence?.unresolvedQuestions || []).filter((q) => q.isBlocking && q.status === 'open').length,
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fadeIn pb-24">
      {/* PHASE 9: PROJECT STATE SHIFT & STALENESS NOTICE */}
      {stalenessInfo?.isStale && !dismissedStale && (
        <div className="p-4 rounded-2xl bg-amber-950/60 border border-amber-800/80 text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg animate-fadeIn">
          <div className="flex items-start sm:items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <span className="font-bold text-xs text-white block sm:inline">Project State Changed: </span>
              <span className="text-xs text-amber-300">{stalenessInfo.staleReason}</span>
              <span className="text-[11px] text-amber-400/80 block sm:inline sm:ml-2">
                (Current Blueprint v{activeVersion} was generated from an earlier state)
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDismissedStale(true)}
              className="text-xs border-amber-800 text-amber-300 hover:text-white h-7 py-0.5 px-2.5"
            >
              Dismiss
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Sparkles className="h-3.5 w-3.5" />}
              onClick={handleRegenButtonClick}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold h-7 py-0.5 px-3 shadow-sm"
            >
              Regenerate
            </Button>
          </div>
        </div>
      )}

      {/* 1. BLUEPRINT HEADER & TOOLBAR */}
      <BlueprintHeader
        ideaTitle={mvpIdea?.title}
        version={viewedVersion}
        status={isGenerating ? 'generating' : (displayedBlueprint?.status || 'completed')}
        updatedAt={displayedBlueprint?.updatedAt || blueprint?.updatedAt}
        isEditing={isEditing}
        isSaving={isSaving}
        isGenerating={isGenerating}
        onStartEdit={handleStartEdit}
        onSaveEdit={handleSaveEdit}
        onCancelEdit={handleCancelEdit}
        onRegenerateClick={handleRegenButtonClick}
        onExportJson={handleExportJson}
        onExportPdf={handleExportPdf}
        isExportingJson={isExportingJson}
        isExportingPdf={isExportingPdf}
        showExportMenu={showExportMenu}
        setShowExportMenu={setShowExportMenu}
        onOpenSearch={() => setIsSearchOpen(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        stats={stats}
        isReadOnlyVersion={isViewingHistorical}
        onReturnToCurrentVersion={() => setSelectedVersionKey(null)}
        versions={effectiveBlueprintVersions}
        latestVersion={activeVersion}
        selectedVersionKey={selectedVersionKey}
        onSelectVersion={(verKey) => setSelectedVersionKey(verKey)}
        onOpenApprovalModal={handleOpenApprovalModal}
        approvalStatus={displayedBlueprint?.approvalStatus || blueprint?.approvalStatus || 'pending_approval'}
        lifecycleState={displayedBlueprint?.lifecycleState || blueprint?.lifecycleState || 'ready_for_review'}
      />

      {/* 2. GENERATION PROGRESS / ERROR RECOVERY */}
      <BlueprintGenerationProgress
        isGenerating={isGenerating}
        generationStage={blueprint?.generationStage}
        generationStageIndex={generationStageIndex}
        failedStage={blueprint?.failedStage}
        isFailed={isBlueprintFailed && !isGenerating}
        isStale={isBlueprintStale && !isGenerating}
        errorMessage={blueprint?.lastError}
        onRetry={handleGenerateBlueprint}
        onRecover={() => {
          setSelectedVersionKey(null);
          handleGenerateBlueprint();
        }}
      />

      {/* 3. NOT GENERATED YET PLACEHOLDER CARD */}
      {!isBlueprintCompleted && !isGenerating && !isBlueprintFailed && !isBlueprintStale && (
        <Card className="p-8 bg-slate-900 border border-primary-900/60 shadow-xl space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-950 text-primary-400 border border-primary-800 shadow-inner">
            <Wand2 className="h-8 w-8 text-primary-400" />
          </div>

          <div className="space-y-2 max-w-lg mx-auto">
            <h3 className="text-xl font-black text-white">AI Blueprint Not Generated Yet</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              This proposal has been selected as the Workspace MVP. Click below to trigger Google Gemini AI analysis and compile a complete technical project control center.
            </p>
          </div>

          <Button
            variant="primary"
            size="lg"
            icon={<Sparkles className="h-5 w-5 text-primary-200" />}
            onClick={handleGenerateBlueprint}
            className="bg-primary-600 hover:bg-primary-700 text-white font-extrabold text-sm shadow-lg px-8 mx-auto"
          >
            Generate AI Blueprint
          </Button>
        </Card>
      )}

      {/* 4. ACTIVE TAB VIEWS (When Blueprint is Completed or Viewing Version) */}
      {(isBlueprintCompleted || isViewingHistorical) && content && (
        <div className="space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <BlueprintOverviewTab
              content={content}
              isEditing={isEditing}
              editForm={editForm}
              setEditForm={setEditForm}
              problemStatement={mvpIdea?.problemStatement || mvpIdea?.description}
              onNavigateTab={(tabKey) => setActiveTab(tabKey)}
              onInspectEntity={handleInspectEntity}
            />
          )}

          {/* TAB 2: REQUIREMENTS */}
          {activeTab === 'requirements' && (
            <BlueprintRequirementsTab
              requirements={v2.requirements || []}
              features={v2.execution?.features || []}
              tasks={v2.execution?.tasks || []}
              decisions={v2.intelligence?.discussionIntelligence?.decisions || []}
              onInspectEntity={handleInspectEntity}
            />
          )}

          {/* TAB 3: ARCHITECTURE */}
          {activeTab === 'architecture' && (
            <BlueprintArchitectureTab
              content={content}
              isEditing={isEditing}
              editForm={editForm}
              setEditForm={setEditForm}
              onInspectEntity={handleInspectEntity}
            />
          )}

          {/* TAB 4: EXECUTION */}
          {activeTab === 'execution' && (
            <BlueprintExecutionTab
              content={content}
              orgId={orgId}
              ideaId={targetMvpId}
              onInspectEntity={handleInspectEntity}
              onSyncTasks={handleSyncBlueprintTasks}
              isSyncingTasks={isSyncingTasks}
            />
          )}

          {/* TAB 5: TEAM */}
          {activeTab === 'team' && (
            <BlueprintTeamTab
              content={content}
              orgMembers={orgMembers}
              onAssignTask={handleAssignTask}
              assigningTaskId={assigningTaskId}
              onInspectEntity={handleInspectEntity}
            />
          )}

          {/* TAB 6: RISKS & QUALITY */}
          {activeTab === 'quality' && (
            <BlueprintRisksAndQualityTab
              content={content}
              onInspectEntity={handleInspectEntity}
            />
          )}

          {/* TAB 7: DECISIONS */}
          {activeTab === 'decisions' && (
            <BlueprintDecisionsTab
              content={content}
              onApproveDecision={handleApproveDecision}
              onRejectDecision={handleRejectDecision}
              processingDecisionId={processingDecisionId}
              onApproveRecommendation={handleApproveChangeRecommendation}
              onRejectRecommendation={handleRejectChangeRecommendation}
              processingRecommendationId={processingRecommendationId}
              onInspectEntity={handleInspectEntity}
            />
          )}

          {/* TAB 8: VERSION HISTORY */}
          {activeTab === 'versions' && (
            <BlueprintVersionHistoryTab
              versions={effectiveBlueprintVersions}
              currentVersion={activeVersion}
              selectedVersionKey={selectedVersionKey}
              onSelectVersion={(versionKey) => setSelectedVersionKey(versionKey)}
              onReturnToCurrentVersion={() => setSelectedVersionKey(null)}
              onActivateVersion={handleActivateVersion}
              isActivatingVersion={isActivatingVersion}
              currentBlueprint={blueprint}
            />
          )}
        </div>
      )}

      {/* 5. GLOBAL SEARCH MODAL */}
      <BlueprintSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        blueprintContent={activeDoc || displayedBlueprint}
        onSelectEntity={handleInspectEntity}
      />

      {/* 6. UNIFIED ENTITY DETAIL DRAWER */}
      <BlueprintEntityDetailDrawer
        isOpen={Boolean(selectedEntityForDrawer)}
        onClose={() => setSelectedEntityForDrawer(null)}
        entity={selectedEntityForDrawer}
        orgId={orgId}
        ideaId={targetMvpId}
        onSelectEntityById={handleSelectEntityById}
      />

      {/* 7. REGENERATION WARNING CONFIRM MODAL */}
      <ConfirmDialog
        isOpen={showRegenWarningModal}
        onClose={() => setShowRegenWarningModal(false)}
        onConfirm={handleGenerateBlueprint}
        title="Regenerate AI Blueprint?"
        message="This Blueprint has been manually edited or customized. Regenerating will generate a fresh AI specification based on the current MVP context and approved decisions. A new version will be created."
        confirmText="Regenerate"
        cancelText="Cancel"
        variant="warning"
      />

      {/* 8. PHASE 11: APPROVAL READINESS & ACTIVATION MODAL */}
      <BlueprintApprovalModal
        isOpen={isApprovalModalOpen}
        onClose={() => setIsApprovalModalOpen(false)}
        version={viewedVersion}
        readinessData={readinessData}
        onApprove={handleApproveBlueprint}
        isApproving={isApproving}
      />
    </div>
  );
}
