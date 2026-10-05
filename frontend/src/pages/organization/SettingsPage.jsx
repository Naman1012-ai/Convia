import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useOrg } from '../../hooks/useOrg';
import { useAuth } from '../../hooks/useAuth';
import { orgService } from '../../services/orgService';
import { rtdbService } from '../../services/rtdbService';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { NotificationService } from '../../services/notificationService';
import { NOTIFICATION_MESSAGES } from '../../utils/notificationMessages';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { formatTimestamp, formatWorkspaceJoinDate } from '../../utils/formatting';
import { getWorkspaceMemberHistory } from '../../utils/workspaceMemberHistory';
import {
  validateWorkspaceName,
  validateProjectType,
  validateWorkspaceDescription,
  validateProjectGoal,
  validateWorkspaceMembersLimit,
  validateProjectUrl,
} from '../../utils/validation';
import {
  PROJECT_TYPES,
  WORKSPACE_VISIBILITY_OPTIONS,
  WORKSPACE_LIMITS,
  resolveWorkspaceProjectType,
  isLegacyHackathonWorkspace,
} from '../../constants/workspaceConstants';
import {
  Settings,
  Users,
  Shield,
  Info,
  AlertTriangle,
  Save,
  RotateCcw,
  UserCheck,
  UserX,
  LogOut,
  Trash2,
  Lock,
  Globe,
  Link2,
  FolderGit2,
  Archive,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Clock,
  Crown,
  Edit3,
  ExternalLink,
  Zap,
  Loader2,
} from 'lucide-react';
import { TransferOwnershipModal } from '../../features/organizations/TransferOwnershipModal';

export default function SettingsPage() {
  const { orgId } = useParams();
  const navigate = useNavigate();
  const { org, members: contextMembers, loading: orgLoading } = useOrg();
  const { user } = useAuth();

  // Generalized Settings State
  const [generalSettings, setGeneralSettings] = useState({
    name: '',
    projectType: 'software',
    description: '',
    projectGoal: '',
    repositoryUrl: '',
    projectUrl: '',
    documentationUrl: '',
    visibility: 'private',
    maxMembers: 5,
    // Historical metadata preserved for legacy hackathon workspaces
    hackathonName: '',
    hackathonTheme: '',
    hackathonLocation: '',
    hackathonDate: '',
    startDate: '',
    endDate: '',
  });

  const [legacyExpanded, setLegacyExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [members, setMembers] = useState([]);
  const [currentUserRole, setCurrentUserRole] = useState('member');

  // Stats — loaded progressively in background
  const [workspaceStats, setWorkspaceStats] = useState({
    ideasCount: 0,
    tasksCount: 0,
    completedTasksCount: 0,
    activeMvpTitle: 'None',
  });

  // Validation
  const [validationErrors, setValidationErrors] = useState({});

  // UI States — split into primary (instant) and stats (background)
  const [primaryReady, setPrimaryReady] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Dialog Confirmations
  const [confirmLeave, setConfirmLeave] = useState(false);

  // Delete Workspace Confirmation Modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [typedOrgName, setTypedOrgName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Member Role Management & Modal States
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState(null);
  const [isRemovingMember, setIsRemovingMember] = useState(false);
  const [updatingRoleMemberUid, setUpdatingRoleMemberUid] = useState(null);

  // Field focus states
  const [isDescriptionFocused, setIsDescriptionFocused] = useState(false);

  // Phase 1: Hydrate from OrgContext (instant — zero network calls)
  useEffect(() => {
    if (!org || !user || !contextMembers) return;

    const resolvedType = resolveWorkspaceProjectType(org);
    const resolvedDesc = org.description || org.hackathonDescription || '';
    const resolvedMembers = org.maxMembers || org.teamSizeLimit || 5;

    setGeneralSettings({
      name: org.name || '',
      projectType: resolvedType,
      description: resolvedDesc,
      projectGoal: org.projectGoal || '',
      repositoryUrl: org.repositoryUrl || '',
      projectUrl: org.projectUrl || '',
      documentationUrl: org.documentationUrl || '',
      visibility: org.visibility || 'private',
      maxMembers: resolvedMembers,
      // Legacy fields preserved from org
      hackathonName: org.hackathonName || '',
      hackathonTheme: org.hackathonTheme || '',
      hackathonLocation: org.hackathonLocation || '',
      hackathonDate: org.hackathonDate || '',
      startDate: org.startDate || '',
      endDate: org.endDate || '',
    });

    setMembers(contextMembers);
    const currentMember = contextMembers.find((m) => m.uid === user.uid);
    setCurrentUserRole(currentMember?.role || 'member');
    setPrimaryReady(true);
  }, [org, user, contextMembers]);

  // Phase 2: Load preferences + stats in parallel (background)
  useEffect(() => {
    if (!orgId || !org) return;

    let active = true;

    async function loadSecondary() {
      setStatsLoading(true);
      try {
        const [ideas, tasks] = await Promise.all([
          rtdbService.getData(`ideas/${orgId}`),
          rtdbService.getData(`tasks/${orgId}`),
        ]);

        if (!active) return;

        const ideasObj = ideas || {};
        const tasksObj = tasks || {};
        const activeTasks = Object.values(tasksObj).filter((t) => t && !t.isDeleted);
        const completedTasks = activeTasks.filter(
          (t) => t.status === 'done' || t.status === 'completed'
        );

        let mvpTitle = 'None';
        if (org.activeProjectId && ideasObj[org.activeProjectId]) {
          mvpTitle = ideasObj[org.activeProjectId].title || 'Untitled';
        }

        if (active) {
          setWorkspaceStats({
            ideasCount: Object.keys(ideasObj).filter((k) => ideasObj[k] && !ideasObj[k].isDeleted)
              .length,
            tasksCount: activeTasks.length,
            completedTasksCount: completedTasks.length,
            activeMvpTitle: mvpTitle,
          });
        }
      } catch (err) {
        console.error('[SettingsPage] error loading secondary data:', err);
      } finally {
        if (active) setStatsLoading(false);
      }
    }

    loadSecondary();

    return () => {
      active = false;
    };
  }, [orgId, org]);

  // Validation helper
  const validateGeneralSettings = () => {
    const errors = {};

    const nameVal = validateWorkspaceName(generalSettings.name);
    if (!nameVal.valid) errors.name = nameVal.error;

    const typeVal = validateProjectType(generalSettings.projectType);
    if (!typeVal.valid) errors.projectType = typeVal.error;

    const descVal = validateWorkspaceDescription(generalSettings.description);
    if (!descVal.valid) errors.description = descVal.error;

    const goalVal = validateProjectGoal(generalSettings.projectGoal);
    if (!goalVal.valid) errors.projectGoal = goalVal.error;

    const membersVal = validateWorkspaceMembersLimit(
      generalSettings.maxMembers,
      1,
      WORKSPACE_LIMITS.MEMBERS_MAX
    );
    if (!membersVal.valid) errors.maxMembers = membersVal.error;

    const repoVal = validateProjectUrl(generalSettings.repositoryUrl, 'Repository URL');
    if (!repoVal.valid) errors.repositoryUrl = repoVal.error;

    const projVal = validateProjectUrl(generalSettings.projectUrl, 'Project URL');
    if (!projVal.valid) errors.projectUrl = projVal.error;

    const docVal = validateProjectUrl(generalSettings.documentationUrl, 'Documentation URL');
    if (!docVal.valid) errors.documentationUrl = docVal.error;

    return errors;
  };

  const handleGeneralSave = async (e) => {
    e.preventDefault();
    if (currentUserRole !== 'owner' && currentUserRole !== 'admin') {
      NotificationService.error("You don't have permission to modify this workspace.");
      return;
    }

    const errors = validateGeneralSettings();
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) {
      NotificationService.error('Please fix validation errors before saving.');
      return;
    }

    setSavingGeneral(true);
    try {
      const payload = {
        name: generalSettings.name.trim(),
        projectType: generalSettings.projectType,
        description: generalSettings.description.trim(),
        projectGoal: generalSettings.projectGoal.trim(),
        repositoryUrl: generalSettings.repositoryUrl.trim(),
        projectUrl: generalSettings.projectUrl.trim(),
        documentationUrl: generalSettings.documentationUrl.trim(),
        visibility: generalSettings.visibility || 'private',
        maxMembers: Number(generalSettings.maxMembers),
        teamSizeLimit: Number(generalSettings.maxMembers),
      };

      // Preserve legacy hackathon fields if existing workspace has them
      if (org.hackathonName !== undefined || generalSettings.hackathonName) {
        payload.hackathonName = generalSettings.hackathonName || org.hackathonName || '';
      }
      if (org.hackathonTheme !== undefined || generalSettings.hackathonTheme) {
        payload.hackathonTheme = generalSettings.hackathonTheme || org.hackathonTheme || '';
      }
      if (org.hackathonLocation !== undefined || generalSettings.hackathonLocation) {
        payload.hackathonLocation = generalSettings.hackathonLocation || org.hackathonLocation || '';
      }
      if (org.hackathonDate !== undefined || generalSettings.hackathonDate) {
        payload.hackathonDate = generalSettings.hackathonDate || org.hackathonDate || '';
      }
      if (org.startDate !== undefined || generalSettings.startDate) {
        payload.startDate = generalSettings.startDate || org.startDate || '';
      }
      if (org.endDate !== undefined || generalSettings.endDate) {
        payload.endDate = generalSettings.endDate || org.endDate || '';
      }

      await orgService.updateOrganizationGeneralSettings(orgId, payload);
      NotificationService.success(NOTIFICATION_MESSAGES.WORKSPACE.UPDATED);
      setIsEditing(false);
    } catch (err) {
      const errMsg = (err.code === 'PERMISSION_DENIED' || err.message?.includes('PERMISSION_DENIED') || err.message?.includes('permission'))
        ? "You don't have permission to modify this workspace."
        : (err.message || 'Failed to update workspace settings.');
      NotificationService.error(errMsg);
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleGeneralReset = () => {
    if (!org) return;
    setGeneralSettings({
      name: org.name || '',
      projectType: resolveWorkspaceProjectType(org),
      description: org.description || org.hackathonDescription || '',
      projectGoal: org.projectGoal || '',
      repositoryUrl: org.repositoryUrl || '',
      projectUrl: org.projectUrl || '',
      documentationUrl: org.documentationUrl || '',
      visibility: org.visibility || 'private',
      maxMembers: org.maxMembers || org.teamSizeLimit || 5,
      hackathonName: org.hackathonName || '',
      hackathonTheme: org.hackathonTheme || '',
      hackathonLocation: org.hackathonLocation || '',
      hackathonDate: org.hackathonDate || '',
      startDate: org.startDate || '',
      endDate: org.endDate || '',
    });
    setValidationErrors({});
    setIsEditing(false);
  };

  // Member Role Management Actions
  const handleRoleSelectChange = async (targetMember, newRoleValue) => {
    if (!orgId || !targetMember) return;
    const targetUid = targetMember.uid || targetMember.id;
    const currentIsCaptain = Boolean(
      targetMember.isTeamCaptain ||
        targetMember.role === 'team_captain' ||
        targetMember.isSecondOwner ||
        targetMember.role === 'second_owner'
    );

    const targetIsCaptain = newRoleValue === 'team_captain';
    if (currentIsCaptain === targetIsCaptain) return;

    setUpdatingRoleMemberUid(targetUid);
    try {
      const action = targetIsCaptain ? 'assign' : 'remove';
      const res = await orgService.updateTeamCaptain(orgId, targetUid, action);
      NotificationService.success(
        res?.message ||
          `Updated ${targetMember.displayName || targetMember.name || 'Member'}'s role to ${
            targetIsCaptain ? 'Team Captain ⚡' : 'Member'
          }.`
      );
    } catch (err) {
      NotificationService.error(err.message || 'Failed to update member role.');
    } finally {
      setUpdatingRoleMemberUid(null);
    }
  };

  const handleConfirmRemoveMember = async () => {
    if (!memberToRemove || !orgId) return;
    setIsRemovingMember(true);
    try {
      await orgService.removeMemberFromWorkspace(orgId, memberToRemove.uid || memberToRemove.id);
      NotificationService.success(
        `Removed ${memberToRemove.displayName || memberToRemove.name} from workspace.`
      );
      setMemberToRemove(null);
    } catch (err) {
      NotificationService.error(err.message || 'Failed to remove member.');
    } finally {
      setIsRemovingMember(false);
    }
  };

  // Danger Zone Handlers
  const handleLeaveWorkspace = async () => {
    try {
      await orgService.leaveWorkspace(orgId, user.uid);
      NotificationService.success(NOTIFICATION_MESSAGES.WORKSPACE.LEFT);
      navigate('/dashboard');
    } catch (err) {
      NotificationService.error(err);
    }
  };

  const handleDeleteWorkspace = async () => {
    setIsDeleting(true);
    try {
      await orgService.markWorkspaceForDeletion(orgId);
      NotificationService.success(NOTIFICATION_MESSAGES.WORKSPACE.MARKED_DELETION);
      navigate('/dashboard');
    } catch (err) {
      NotificationService.error(err);
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
    }
  };

  const handleCopyOrgId = () => {
    if (org?.orgId) {
      navigator.clipboard.writeText(org.orgId);
      setCopiedId(true);
      NotificationService.info('Workspace ID copied to clipboard');
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  // Compute progress percentage memoized at top level
  const progressPercentage = useMemo(() => {
    if (workspaceStats.tasksCount === 0) return 0;
    return Math.round(
      (workspaceStats.completedTasksCount / workspaceStats.tasksCount) * 100
    );
  }, [workspaceStats.tasksCount, workspaceStats.completedTasksCount]);

  const ownerDisplayName = useMemo(() => {
    const ownerMember = members.find((m) => m.uid === org?.ownerId);
    return ownerMember?.displayName || ownerMember?.name || (org?.ownerId ? 'Owner' : 'Unknown');
  }, [members, org?.ownerId]);

  if (orgLoading || !primaryReady) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <LoadingSkeleton variant="profile" />
      </div>
    );
  }

  const isOwner = currentUserRole === 'owner';
  const isAdmin = currentUserRole === 'admin';
  const canEdit = isOwner || isAdmin;
  const isReadOnly = !canEdit;
  const isFormDisabled = !isEditing || isReadOnly;
  const isLegacy = isLegacyHackathonWorkspace(org);

  const initialDescription = org?.description || org?.hackathonDescription || '';
  const isDescriptionChanged = generalSettings.description !== initialDescription;
  const isChangingDescription = isEditing && (isDescriptionFocused || isDescriptionChanged);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-16">
      {/* Context Quick-Bar & Section Navigation */}
      <div className="space-y-4">
        {/* Workspace Context Summary Card */}
        <Card className="p-5 bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-xs rounded-2xl sticky top-4 z-20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary-600 to-primary-700 text-white flex items-center justify-center font-black text-lg shadow-sm shadow-primary-100 shrink-0">
                {org.name ? org.name.charAt(0).toUpperCase() : 'W'}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-slate-900">{org.name}</h2>
                  {isOwner ? (
                    <Badge variant="warning" className="text-[10px] uppercase font-bold tracking-wider flex items-center gap-1">
                      <Crown className="h-3 w-3 text-amber-600" /> Owner
                    </Badge>
                  ) : isAdmin ? (
                    <Badge variant="primary" className="text-[10px] uppercase font-bold tracking-wider flex items-center gap-1">
                      <Shield className="h-3 w-3 text-primary-600" /> Admin
                    </Badge>
                  ) : (
                    <Badge variant="default" className="text-[10px] uppercase font-bold tracking-wider flex items-center gap-1">
                      <Lock className="h-3 w-3 text-slate-400" /> Member (Read-Only)
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 font-medium flex-wrap">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-slate-400" />
                    {members.length} / {generalSettings.maxMembers || 5} Members
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Lock className="h-3.5 w-3.5 text-slate-400" />
                    Private Workspace
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
              {canEdit && !isEditing && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  icon={<Edit3 className="h-3.5 w-3.5 text-primary-600" />}
                  className="text-xs font-semibold text-primary-700 bg-primary-50/60 hover:bg-primary-100/70 border-primary-200/80 shadow-2xs"
                >
                  Edit Settings
                </Button>
              )}
              {canEdit && isEditing && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleGeneralReset}
                    icon={<RotateCcw className="h-3.5 w-3.5" />}
                    className="text-xs font-semibold text-slate-600"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    form="workspace-settings-form"
                    variant="primary"
                    size="sm"
                    isLoading={savingGeneral}
                    icon={<Save className="h-3.5 w-3.5" />}
                    className="text-xs font-semibold"
                  >
                    Save Changes
                  </Button>
                </div>
              )}
              <div className="text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${isReadOnly ? 'bg-slate-400' : isEditing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                <span className="font-semibold text-slate-700">
                  {isReadOnly ? 'Read-only Access' : isEditing ? 'Editing Mode' : 'View Mode'}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Quick-Jump Section Anchor Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs font-semibold">
          <button
            type="button"
            onClick={() => scrollToSection('settings-general')}
            className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/80 shadow-2xs transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
          >
            <Settings className="h-3.5 w-3.5 text-primary-600" /> General
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('settings-links')}
            className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/80 shadow-2xs transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
          >
            <FolderGit2 className="h-3.5 w-3.5 text-primary-600" /> Project Links
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('settings-access')}
            className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/80 shadow-2xs transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
          >
            <Shield className="h-3.5 w-3.5 text-primary-600" /> Access & Team
          </button>
          {isLegacy && (
            <button
              type="button"
              onClick={() => scrollToSection('settings-legacy')}
              className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/80 shadow-2xs transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
            >
              <Archive className="h-3.5 w-3.5 text-amber-600" /> Legacy Archive
            </button>
          )}
          <button
            type="button"
            onClick={() => scrollToSection('settings-info')}
            className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/80 shadow-2xs transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
          >
            <Info className="h-3.5 w-3.5 text-slate-500" /> Details
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('settings-danger')}
            className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-rose-200/80 shadow-2xs transition-all whitespace-nowrap flex items-center gap-1.5 ml-auto cursor-pointer"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-rose-500" /> Danger Zone
          </button>
        </div>
      </div>

      {/* Main Settings Form */}
      <form id="workspace-settings-form" onSubmit={handleGeneralSave} className="space-y-8">
        {/* SECTION 1: GENERAL */}
        <Card id="settings-general" className="p-6 bg-white border border-slate-200/80 shadow-sm relative rounded-2xl scroll-mt-6">
          <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-3">
            <div className="h-8 w-8 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
              <Settings className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">General Information</h2>
              <p className="text-xs text-slate-500">Workspace name, project type, and core objectives</p>
            </div>
            {isReadOnly && (
              <Badge
                variant="default"
                className="ml-auto bg-slate-100 text-slate-500 flex items-center gap-1 border-none font-bold text-xs"
              >
                <Lock className="h-3 w-3" /> Read Only
              </Badge>
            )}
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Workspace Name"
                value={generalSettings.name}
                onChange={(e) => {
                  setGeneralSettings({ ...generalSettings, name: e.target.value });
                  setValidationErrors((prev) => ({ ...prev, name: undefined }));
                }}
                required
                disabled={isFormDisabled}
                maxLength={WORKSPACE_LIMITS.NAME_MAX}
                error={validationErrors.name}
              />

              <Select
                label="Project Type"
                value={generalSettings.projectType}
                onChange={(e) => {
                  setGeneralSettings({ ...generalSettings, projectType: e.target.value });
                  setValidationErrors((prev) => ({ ...prev, projectType: undefined }));
                }}
                options={PROJECT_TYPES}
                required
                disabled={isFormDisabled}
                error={validationErrors.projectType}
              />
            </div>

            <Textarea
              label="Description"
              rows={3}
              value={generalSettings.description}
              onChange={(e) => {
                setGeneralSettings({ ...generalSettings, description: e.target.value });
                setValidationErrors((prev) => ({ ...prev, description: undefined }));
              }}
              onFocus={() => setIsDescriptionFocused(true)}
              onBlur={() => setIsDescriptionFocused(false)}
              disabled={isFormDisabled}
              placeholder="Describe what this workspace is for and what the team is building..."
              maxLength={WORKSPACE_LIMITS.DESCRIPTION_MAX}
              showCount={isChangingDescription}
              error={validationErrors.description}
              required
            />

            <Input
              label="Project Goal (Optional)"
              value={generalSettings.projectGoal}
              onChange={(e) => {
                setGeneralSettings({ ...generalSettings, projectGoal: e.target.value });
                setValidationErrors((prev) => ({ ...prev, projectGoal: undefined }));
              }}
              disabled={isFormDisabled}
              placeholder="What do you want this project to accomplish?"
              maxLength={WORKSPACE_LIMITS.PROJECT_GOAL_MAX}
              error={validationErrors.projectGoal}
            />
          </div>
        </Card>

        {/* SECTION 2: PROJECT LINKS */}
        <Card id="settings-links" className="p-6 bg-white border border-slate-200/80 shadow-sm rounded-2xl scroll-mt-6">
          <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-3">
            <div className="h-8 w-8 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
              <FolderGit2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Project Links</h2>
              <p className="text-xs text-slate-500">Repository, deployment, and documentation links</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Input
              label="Repository URL"
              placeholder="https://github.com/..."
              value={generalSettings.repositoryUrl}
              onChange={(e) => {
                setGeneralSettings({ ...generalSettings, repositoryUrl: e.target.value });
                setValidationErrors((prev) => ({ ...prev, repositoryUrl: undefined }));
              }}
              disabled={isFormDisabled}
              error={validationErrors.repositoryUrl}
              action={
                generalSettings.repositoryUrl ? (
                  <a
                    href={generalSettings.repositoryUrl.startsWith('http') ? generalSettings.repositoryUrl : `https://${generalSettings.repositoryUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1 hover:underline"
                  >
                    Open <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null
              }
            />

            <Input
              label="Project URL"
              placeholder="https://myproject.com"
              value={generalSettings.projectUrl}
              onChange={(e) => {
                setGeneralSettings({ ...generalSettings, projectUrl: e.target.value });
                setValidationErrors((prev) => ({ ...prev, projectUrl: undefined }));
              }}
              disabled={isFormDisabled}
              error={validationErrors.projectUrl}
              action={
                generalSettings.projectUrl ? (
                  <a
                    href={generalSettings.projectUrl.startsWith('http') ? generalSettings.projectUrl : `https://${generalSettings.projectUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1 hover:underline"
                  >
                    Open <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null
              }
            />

            <Input
              label="Documentation URL"
              placeholder="https://docs..."
              value={generalSettings.documentationUrl}
              onChange={(e) => {
                setGeneralSettings({ ...generalSettings, documentationUrl: e.target.value });
                setValidationErrors((prev) => ({ ...prev, documentationUrl: undefined }));
              }}
              disabled={isFormDisabled}
              error={validationErrors.documentationUrl}
              action={
                generalSettings.documentationUrl ? (
                  <a
                    href={generalSettings.documentationUrl.startsWith('http') ? generalSettings.documentationUrl : `https://${generalSettings.documentationUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1 hover:underline"
                  >
                    Open <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null
              }
            />
          </div>
        </Card>

        {/* SECTION 3: ACCESS & TEAM */}
        <Card id="settings-access" className="p-6 bg-white border border-slate-200/80 shadow-sm rounded-2xl scroll-mt-6">
          <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-3">
            <div className="h-8 w-8 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Access &amp; Team</h2>
              <p className="text-xs text-slate-500">Workspace visibility and maximum membership capacity</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div>
              <Select
                label="Visibility"
                value={generalSettings.visibility}
                onChange={(e) => setGeneralSettings({ ...generalSettings, visibility: e.target.value })}
                options={WORKSPACE_VISIBILITY_OPTIONS}
                disabled
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Workspace access is private to authenticated team members.
              </p>
            </div>

            <Input
              label="Maximum Members"
              type="number"
              min={1}
              max={WORKSPACE_LIMITS.MEMBERS_MAX}
              value={generalSettings.maxMembers}
              onChange={(e) => {
                setGeneralSettings({ ...generalSettings, maxMembers: e.target.value });
                setValidationErrors((prev) => ({ ...prev, maxMembers: undefined }));
              }}
              required
              disabled={isFormDisabled}
              error={validationErrors.maxMembers}
            />
          </div>
        </Card>

        {/* SECTION 4 (CONDITIONAL): LEGACY HACKATHON DETAILS */}
        {isLegacy && (
          <Card id="settings-legacy" className="p-6 bg-slate-50/70 border border-slate-200/80 shadow-sm rounded-2xl space-y-4 scroll-mt-6">
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => setLegacyExpanded((prev) => !prev)}
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Archive className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      Legacy Hackathon Archive
                    </h3>
                    <Badge variant="warning" className="text-[9px] uppercase tracking-wider font-extrabold">
                      Preserved
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Historical hackathon details preserved from prior Convia versions.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors"
                aria-label={legacyExpanded ? 'Collapse legacy details' : 'Expand legacy details'}
              >
                {legacyExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>

            {legacyExpanded && (
              <div className="pt-4 border-t border-slate-200/60 space-y-4 animate-in fade-in duration-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Hackathon Name"
                    value={generalSettings.hackathonName}
                    onChange={(e) =>
                      setGeneralSettings({ ...generalSettings, hackathonName: e.target.value })
                    }
                    disabled={isFormDisabled}
                    placeholder="e.g., Global AI Hackathon"
                  />
                  <Input
                    label="Hackathon Theme"
                    value={generalSettings.hackathonTheme}
                    onChange={(e) =>
                      setGeneralSettings({ ...generalSettings, hackathonTheme: e.target.value })
                    }
                    disabled={isFormDisabled}
                    placeholder="e.g., Sustainable Tech"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Input
                    label="Hackathon Location"
                    value={generalSettings.hackathonLocation}
                    onChange={(e) =>
                      setGeneralSettings({ ...generalSettings, hackathonLocation: e.target.value })
                    }
                    disabled={isFormDisabled}
                    placeholder="e.g., San Francisco / Hybrid"
                  />
                  <Input
                    label="Start Date"
                    type="date"
                    value={generalSettings.startDate}
                    onChange={(e) =>
                      setGeneralSettings({ ...generalSettings, startDate: e.target.value })
                    }
                    disabled={isFormDisabled}
                  />
                  <Input
                    label="End Date"
                    type="date"
                    value={generalSettings.endDate}
                    onChange={(e) =>
                      setGeneralSettings({ ...generalSettings, endDate: e.target.value })
                    }
                    disabled={isFormDisabled}
                  />
                </div>
              </div>
            )}
          </Card>
        )}

      </form>

      {/* SECTION 5: WORKSPACE INFORMATION */}
      <Card id="settings-info" className="p-6 bg-white border border-slate-200/80 shadow-sm rounded-2xl scroll-mt-6">
        <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-3">
          <div className="h-8 w-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
            <Info className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Workspace Information</h2>
            <p className="text-xs text-slate-500">Metadata, system IDs, and ownership details</p>
          </div>
          {statsLoading && (
            <span className="ml-auto text-[10px] text-slate-400 font-semibold animate-pulse">
              Loading stats...
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-xs">
          <div>
            <span className="text-slate-400 block font-semibold mb-1">Workspace ID</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-slate-800 font-bold">{org.orgId}</span>
              <button
                type="button"
                onClick={handleCopyOrgId}
                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors"
                title="Copy Workspace ID"
              >
                {copiedId ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>

          <div>
            <span className="text-slate-400 block font-semibold mb-1">Created By</span>
            <span className="font-bold text-slate-900 truncate block max-w-[200px]">
              {ownerDisplayName}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block font-semibold mb-1">Created On</span>
            <span className="text-slate-700 font-medium">
              {org.createdAt ? formatTimestamp(org.createdAt) : 'Unknown'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block font-semibold mb-1">Last Updated</span>
            <span className="text-slate-700 font-medium">
              {org.updatedAt ? formatTimestamp(org.updatedAt) : 'Never'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block font-semibold mb-1">Current Stage</span>
            <span
              className={`inline-flex px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                org.status === 'project'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-700'
              }`}
            >
              {org.status === 'project' ? 'Sprint Phase' : 'Ideation Phase'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block font-semibold mb-1">Active MVP</span>
            <span
              className="font-bold text-slate-900 truncate block max-w-[200px]"
              title={workspaceStats.activeMvpTitle}
            >
              {workspaceStats.activeMvpTitle}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block font-semibold mb-1">Progress</span>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-600 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <span className="text-xs font-black text-slate-900">{progressPercentage}%</span>
            </div>
          </div>

          <div>
            <span className="text-slate-400 block font-semibold mb-1">Ideas</span>
            <span className="text-sm font-black text-slate-900">
              {workspaceStats.ideasCount} Proposed
            </span>
          </div>

          <div>
            <span className="text-slate-400 block font-semibold mb-1">Tasks</span>
            <span className="text-sm font-black text-slate-900">
              {workspaceStats.completedTasksCount}/{workspaceStats.tasksCount} Done
            </span>
          </div>

          <div>
            <span className="text-slate-400 block font-semibold mb-1">Team Capacity</span>
            <span className="text-sm font-black text-slate-900">
              {members.length} / {generalSettings.maxMembers} Members
            </span>
          </div>
        </div>
      </Card>

      {/* SECTION 6: MEMBERS & ROLES */}
      <Card id="settings-access" className="p-6 bg-white border border-slate-200/80 shadow-sm rounded-2xl scroll-mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">Members &amp; Roles</h2>
                <span className="text-xs text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded">
                  {members.length} / {generalSettings.maxMembers || 5} Members
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Manage workspace roles, team privileges, and ownership</p>
            </div>
          </div>

          {isOwner && (
            <Button
              type="button"
              variant="warning"
              size="sm"
              onClick={() => setIsTransferModalOpen(true)}
              className="font-bold flex items-center gap-1.5 shrink-0 shadow-xs"
            >
              <Crown className="h-3.5 w-3.5" />
              <span>Transfer Ownership</span>
            </Button>
          )}
        </div>

        <div className="divide-y divide-slate-100">
          {members.map((member) => {
            const memberUid = member.uid || member.id;
            const history = getWorkspaceMemberHistory(member, org);
            const isMemberOwner = history.isOwner;
            const isCaptain = history.isCaptain;
            const isSelf = memberUid === user?.uid;
            const isUpdatingThisMember = updatingRoleMemberUid === memberUid;

            const currentRoleValue = isMemberOwner ? 'owner' : isCaptain ? 'team_captain' : 'member';

            return (
              <div
                key={memberUid}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={member.displayName || member.name} size="md" />
                  <div className="min-w-0">
                    <h4 className="font-bold text-slate-900 flex items-center gap-1.5 truncate">
                      {member.displayName || member.name}
                      {isSelf && (
                        <span className="text-[10px] bg-primary-50 text-primary-700 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
                          You
                        </span>
                      )}
                      {history.isOriginalCreator && !history.isOwner && (
                        <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded border border-slate-200">
                          Original Creator
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{member.email}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {history.dateText}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* Role Display & Role Management Selector */}
                  {isMemberOwner ? (
                    <Badge variant="warning" className="font-bold flex items-center gap-1">
                      👑 Owner
                    </Badge>
                  ) : canEdit && !isSelf ? (
                    <div className="flex items-center gap-2">
                      {isUpdatingThisMember && <Loader2 className="h-3.5 w-3.5 text-primary-600 animate-spin" />}
                      <Select
                        value={currentRoleValue}
                        onChange={(e) => handleRoleSelectChange(member, e.target.value)}
                        disabled={isUpdatingThisMember}
                        options={[
                          { value: 'member', label: 'Member' },
                          { value: 'team_captain', label: '⚡ Team Captain' },
                        ]}
                        className="text-xs py-1 px-2.5 font-medium rounded-lg h-8 border-slate-200"
                      />
                    </div>
                  ) : isCaptain ? (
                    <Badge variant="primary" className="font-bold flex items-center gap-1">
                      ⚡ Team Captain
                    </Badge>
                  ) : (
                    <Badge variant="default" className="font-semibold">
                      Member
                    </Badge>
                  )}

                  {/* Remove Member Action */}
                  {canEdit && !isMemberOwner && !isSelf && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-rose-600 hover:bg-rose-50"
                      icon={<UserX className="h-4 w-4" />}
                      onClick={() => setMemberToRemove(member)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* SECTION 6: DANGER ZONE */}
      <div id="settings-danger" className="space-y-4 scroll-mt-6">
        <div className="flex items-center gap-3 border-b border-rose-100 pb-3">
          <div className="h-8 w-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-rose-600">Danger Zone</h2>
            <p className="text-xs text-slate-500">Irreversible actions and workspace lifecycle management</p>
          </div>
        </div>

        <Card className="p-6 bg-rose-50/30 border border-rose-200 rounded-2xl space-y-6">
          {/* Leave Workspace Option */}
          {!isOwner && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-rose-100/50 pb-6">
              <div className="space-y-1 max-w-xl">
                <h4 className="text-sm font-extrabold text-slate-900">Leave Workspace</h4>
                <p className="text-xs text-slate-500">
                  You will lose access to this workspace&apos;s blueprints, ideas, and tasks. All comments, ideas, and tasks created by you will remain intact.
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={() => setConfirmLeave(true)}
                icon={<LogOut className="h-4 w-4" />}
                className="bg-white border-slate-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 shrink-0 font-bold"
              >
                Leave Workspace
              </Button>
            </div>
          )}

          {/* Delete Workspace Option */}
          {isOwner && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1.5 max-w-xl">
                <h4 className="text-sm font-extrabold text-slate-900">Schedule Workspace Deletion</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Schedule this workspace for permanent deletion:
                </p>
                <ul className="text-xs text-slate-500 list-disc list-inside space-y-1">
                  <li>The workspace will enter a <strong>7-day recovery grace period</strong>.</li>
                  <li>During this period, the workspace is hidden from regular navigation and search, but can be restored anytime by the owner from the Workspaces page.</li>
                  <li>After 7 days, all ideas, blueprint boards, tasks, comments, and member associations will be permanently removed.</li>
                </ul>
              </div>
              <Button
                variant="primary"
                onClick={() => {
                  setTypedOrgName('');
                  setIsDeleteModalOpen(true);
                }}
                icon={<Trash2 className="h-4 w-4" />}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold border-none shadow-sm shadow-rose-200 shrink-0"
              >
                Delete Workspace
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Confirm Leave Workspace Dialog */}
      <ConfirmDialog
        isOpen={confirmLeave}
        onCancel={() => setConfirmLeave(false)}
        onConfirm={handleLeaveWorkspace}
        title="Leave Workspace?"
        description="Are you sure you want to leave this workspace? You will need an invite code to rejoin."
        confirmLabel="Leave Workspace"
        cancelLabel="Cancel"
      />

      {/* Delete Workspace Single Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <Card className="max-w-md w-full bg-white p-6 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-black text-rose-600 mb-2 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 shrink-0" /> Schedule Workspace Deletion
            </h3>
            <p className="text-xs text-slate-600 mb-3 leading-relaxed">
              You are scheduling <strong className="text-slate-900 font-bold">{org.name}</strong> for deletion.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 mb-4 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-amber-800">
                <Clock className="h-3.5 w-3.5 shrink-0 text-amber-600" /> 7-Day Recovery Grace Period
              </p>
              <p className="text-amber-700 leading-normal">
                This workspace will enter a 7-day grace period before permanent removal. You can restore it anytime within the next 7 days from the Workspaces page.
              </p>
            </div>
            <p className="text-xs text-slate-600 mb-2">
              To confirm, please type the exact workspace name below:
              <strong className="block mt-1 font-mono text-slate-800 bg-slate-50 px-2 py-1.5 rounded border border-slate-200 text-center select-all">
                {org.name}
              </strong>
            </p>
            <Input
              value={typedOrgName}
              onChange={(e) => setTypedOrgName(e.target.value)}
              placeholder="Type workspace name..."
              className="mb-5 font-semibold"
              autoFocus
            />
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <Button
                variant="ghost"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleDeleteWorkspace}
                isLoading={isDeleting}
                disabled={typedOrgName.trim() !== org.name || isDeleting}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                Schedule Deletion
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Confirm Member Removal Dialog */}
      <ConfirmDialog
        isOpen={Boolean(memberToRemove)}
        title="Remove Team Member"
        description={`Are you sure you want to remove ${memberToRemove?.displayName || memberToRemove?.name} from this workspace?`}
        confirmLabel="Remove Member"
        variant="danger"
        isLoading={isRemovingMember}
        onConfirm={handleConfirmRemoveMember}
        onCancel={() => setMemberToRemove(null)}
      />

      {/* Transfer Ownership Modal */}
      {org && (
        <TransferOwnershipModal
          isOpen={isTransferModalOpen}
          onClose={() => setIsTransferModalOpen(false)}
          onSuccess={(msg) => {
            NotificationService.success(msg);
            setIsTransferModalOpen(false);
          }}
          workspaceId={orgId}
          workspaceName={org.name}
          members={members}
          currentOwnerUid={org.ownerId || org.ownerUid || user?.uid}
        />
      )}
    </div>
  );
}
