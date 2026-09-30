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
import { PageHeader } from '../../components/layout/PageHeader';
import { NotificationService } from '../../services/notificationService';
import { NOTIFICATION_MESSAGES } from '../../utils/notificationMessages';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { formatTimestamp } from '../../utils/formatting';
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
  Sliders,
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
} from 'lucide-react';

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

  const [preferences, setPreferences] = useState({
    enableRealtime: true,
    enableNotifications: false,
    defaultIdeaSort: 'Most Votes',
    defaultTaskView: 'Board',
    autoArchiveMvps: false,
  });

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
  const [savingPreferences, setSavingPreferences] = useState(false);

  // Dialog Confirmations
  const [confirmLeave, setConfirmLeave] = useState(false);

  // Delete Workspace Confirmation steps
  const [deleteStep, setDeleteStep] = useState(0); // 0 = closed, 1 = warning, 2 = type name, 3 = final
  const [typedOrgName, setTypedOrgName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

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
        const [prefs, ideas, tasks] = await Promise.all([
          orgService.getWorkspacePreferences(orgId),
          rtdbService.getData(`ideas/${orgId}`),
          rtdbService.getData(`tasks/${orgId}`),
        ]);

        if (!active) return;

        if (prefs) {
          setPreferences({
            enableRealtime: prefs.enableRealtime ?? true,
            enableNotifications: prefs.enableNotifications ?? false,
            defaultIdeaSort: prefs.defaultIdeaSort || 'Most Votes',
            defaultTaskView: prefs.defaultTaskView || 'Board',
            autoArchiveMvps: prefs.autoArchiveMvps ?? false,
          });
        }

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
  };

  const handlePreferencesSave = async (e) => {
    e.preventDefault();
    if (currentUserRole !== 'owner' && currentUserRole !== 'admin') {
      NotificationService.error("You don't have permission to modify this workspace.");
      return;
    }

    setSavingPreferences(true);
    try {
      await orgService.updateWorkspacePreferences(orgId, preferences);
      NotificationService.success(NOTIFICATION_MESSAGES.WORKSPACE.PREFERENCES_UPDATED);
    } catch (err) {
      const errMsg = (err.code === 'PERMISSION_DENIED' || err.message?.includes('PERMISSION_DENIED') || err.message?.includes('permission'))
        ? "You don't have permission to modify this workspace."
        : (err.message || 'Failed to update workspace preferences.');
      NotificationService.error(errMsg);
    } finally {
      setSavingPreferences(false);
    }
  };

  // Member Management Actions
  const handleRoleChange = async (targetUid, currentRole, action) => {
    if (currentUserRole !== 'owner') {
      NotificationService.warning('Only the Owner can promote or demote members.');
      return;
    }

    try {
      let nextRole = 'member';
      if (action === 'promote') nextRole = 'admin';

      await orgService.updateMemberRole(orgId, targetUid, nextRole);

      setMembers((prev) =>
        prev.map((m) => (m.uid === targetUid ? { ...m, role: nextRole } : m))
      );
      NotificationService.success(NOTIFICATION_MESSAGES.MEMBER.ROLE_UPDATED);
    } catch (err) {
      NotificationService.error(err);
    }
  };

  const handleRemoveMember = async (targetUid, memberName) => {
    const isOwner = currentUserRole === 'owner';
    const isAdmin = currentUserRole === 'admin';

    if (!isOwner && !isAdmin) {
      NotificationService.warning('Unauthorized role.');
      return;
    }

    try {
      await orgService.removeMemberFromWorkspace(orgId, targetUid);
      setMembers((prev) => prev.filter((m) => m.uid !== targetUid));
      NotificationService.success(NOTIFICATION_MESSAGES.MEMBER.REMOVED);
    } catch (err) {
      NotificationService.error(err);
    }
  };

  const handleTransferOwnership = async (newOwnerUid, newOwnerName) => {
    if (currentUserRole !== 'owner') return;

    try {
      await orgService.transferWorkspaceOwnership(orgId, user.uid, newOwnerUid);
      setCurrentUserRole('admin');

      setMembers((prev) =>
        prev.map((m) => {
          if (m.uid === user.uid) return { ...m, role: 'admin' };
          if (m.uid === newOwnerUid) return { ...m, role: 'owner' };
          return m;
        })
      );
      NotificationService.success(NOTIFICATION_MESSAGES.MEMBER.OWNERSHIP_TRANSFERRED);
    } catch (err) {
      NotificationService.error(err);
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
      setDeleteStep(0);
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
  const isReadOnly = currentUserRole === 'member';
  const isLegacy = isLegacyHackathonWorkspace(org);

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-16">
      {/* Page Title Header */}
      <PageHeader
        title="Workspace Settings"
        subtitle="Manage workspace profile, project resources, membership capacity, and operational preferences"
      />

      {/* Main Settings Form */}
      <form onSubmit={handleGeneralSave} className="space-y-8">
        {/* SECTION 1: GENERAL */}
        <Card className="p-6 bg-white border border-slate-200/80 shadow-sm relative">
          <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
            <Settings className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-900">General Information</h2>
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
                disabled={isReadOnly}
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
                disabled={isReadOnly}
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
              disabled={isReadOnly}
              placeholder="Describe what this workspace is for and what the team is building..."
              maxLength={WORKSPACE_LIMITS.DESCRIPTION_MAX}
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
              disabled={isReadOnly}
              placeholder="What do you want this project to accomplish?"
              maxLength={WORKSPACE_LIMITS.PROJECT_GOAL_MAX}
              error={validationErrors.projectGoal}
            />
          </div>
        </Card>

        {/* SECTION 2: PROJECT LINKS */}
        <Card className="p-6 bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
            <FolderGit2 className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-900">Project Links</h2>
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
              disabled={isReadOnly}
              error={validationErrors.repositoryUrl}
            />

            <Input
              label="Project URL"
              placeholder="https://myproject.com"
              value={generalSettings.projectUrl}
              onChange={(e) => {
                setGeneralSettings({ ...generalSettings, projectUrl: e.target.value });
                setValidationErrors((prev) => ({ ...prev, projectUrl: undefined }));
              }}
              disabled={isReadOnly}
              error={validationErrors.projectUrl}
            />

            <Input
              label="Documentation URL"
              placeholder="https://docs..."
              value={generalSettings.documentationUrl}
              onChange={(e) => {
                setGeneralSettings({ ...generalSettings, documentationUrl: e.target.value });
                setValidationErrors((prev) => ({ ...prev, documentationUrl: undefined }));
              }}
              disabled={isReadOnly}
              error={validationErrors.documentationUrl}
            />
          </div>
        </Card>

        {/* SECTION 3: ACCESS & TEAM */}
        <Card className="p-6 bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
            <Shield className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-900">Access &amp; Team</h2>
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
              disabled={isReadOnly}
              error={validationErrors.maxMembers}
            />
          </div>
        </Card>

        {/* SECTION 4 (CONDITIONAL): LEGACY HACKATHON DETAILS */}
        {isLegacy && (
          <Card className="p-6 bg-slate-50/70 border border-slate-200/80 shadow-sm rounded-2xl space-y-4">
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => setLegacyExpanded((prev) => !prev)}
            >
              <div className="flex items-center gap-3">
                <Archive className="h-5 w-5 text-amber-600 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">
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
                    disabled={isReadOnly}
                    placeholder="e.g., Global AI Hackathon"
                  />
                  <Input
                    label="Hackathon Theme"
                    value={generalSettings.hackathonTheme}
                    onChange={(e) =>
                      setGeneralSettings({ ...generalSettings, hackathonTheme: e.target.value })
                    }
                    disabled={isReadOnly}
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
                    disabled={isReadOnly}
                    placeholder="e.g., San Francisco / Hybrid"
                  />
                  <Input
                    label="Start Date"
                    type="date"
                    value={generalSettings.startDate}
                    onChange={(e) =>
                      setGeneralSettings({ ...generalSettings, startDate: e.target.value })
                    }
                    disabled={isReadOnly}
                  />
                  <Input
                    label="End Date"
                    type="date"
                    value={generalSettings.endDate}
                    onChange={(e) =>
                      setGeneralSettings({ ...generalSettings, endDate: e.target.value })
                    }
                    disabled={isReadOnly}
                  />
                </div>
              </div>
            )}
          </Card>
        )}

        {/* SETTINGS FORM ACTIONS */}
        {!isReadOnly && (
          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="primary"
              type="submit"
              isLoading={savingGeneral}
              icon={<Save className="h-4 w-4" />}
            >
              Save Changes
            </Button>
            <Button
              variant="ghost"
              type="button"
              onClick={handleGeneralReset}
              icon={<RotateCcw className="h-4 w-4" />}
            >
              Cancel
            </Button>
          </div>
        )}
      </form>

      {/* SECTION 5: WORKSPACE INFORMATION */}
      <Card className="p-6 bg-white border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
          <Info className="h-5 w-5 text-slate-500" />
          <h2 className="text-lg font-bold text-slate-900">Workspace Information</h2>
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
                  className="h-full bg-indigo-500 rounded-full transition-all duration-300"
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
      <Card className="p-6 bg-white border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
          <Users className="h-5 w-5 text-slate-500" />
          <h2 className="text-lg font-bold text-slate-900">Members &amp; Roles</h2>
          <span className="ml-auto text-xs text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded">
            {members.length} / {generalSettings.maxMembers} Members
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {members.map((member) => {
            const isSelf = member.uid === user.uid;

            return (
              <div
                key={member.uid}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={member.displayName} size="md" />
                  <div>
                    <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                      {member.displayName}
                      {isSelf && (
                        <span className="text-[10px] bg-indigo-50 text-indigo-600 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
                          You
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">{member.email}</p>
                    {member.joinedAt && (
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Joined {formatTimestamp(member.joinedAt)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Badge
                    variant={
                      member.role === 'owner'
                        ? 'success'
                        : member.role === 'admin'
                          ? 'info'
                          : 'default'
                    }
                  >
                    {member.role.toUpperCase()}
                  </Badge>

                  {/* Actions depending on Role rules */}
                  {!isSelf && !isReadOnly && (
                    <div className="flex items-center gap-1.5">
                      {/* Owner permissions */}
                      {isOwner && (
                        <>
                          {member.role === 'member' && (
                            <button
                              onClick={() => handleRoleChange(member.uid, member.role, 'promote')}
                              className="rounded-lg p-1.5 text-indigo-600 hover:bg-indigo-50 transition-colors text-xs flex items-center gap-1 font-bold"
                              title="Promote to Admin"
                            >
                              <Shield className="h-3.5 w-3.5" /> Promote
                            </button>
                          )}
                          {member.role === 'admin' && (
                            <button
                              onClick={() => handleRoleChange(member.uid, member.role, 'demote')}
                              className="rounded-lg p-1.5 text-amber-600 hover:bg-amber-50 transition-colors text-xs flex items-center gap-1 font-bold"
                              title="Demote to Member"
                            >
                              <UserX className="h-3.5 w-3.5" /> Demote
                            </button>
                          )}
                          <button
                            onClick={() =>
                              handleTransferOwnership(member.uid, member.displayName)
                            }
                            className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 transition-colors text-xs flex items-center gap-1 font-bold"
                            title="Transfer Ownership"
                          >
                            <UserCheck className="h-3.5 w-3.5" /> Transfer
                          </button>
                        </>
                      )}

                      {/* Owner or Admin can remove member (Admins cannot remove owners/admins) */}
                      {(isOwner || (isAdmin && member.role === 'member')) && (
                        <button
                          onClick={() => handleRemoveMember(member.uid, member.displayName)}
                          className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors text-xs flex items-center gap-1 font-bold"
                          title="Remove Member"
                        >
                          <UserX className="h-3.5 w-3.5" /> Remove
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* SECTION 7: WORKSPACE PREFERENCES */}
      <Card className="p-6 bg-white border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
          <Sliders className="h-5 w-5 text-slate-500" />
          <h2 className="text-lg font-bold text-slate-900">Workspace Preferences</h2>
          {isReadOnly && (
            <Badge
              variant="default"
              className="ml-auto bg-slate-100 text-slate-500 flex items-center gap-1 border-none font-bold"
            >
              <Lock className="h-3 w-3" /> Read Only
            </Badge>
          )}
        </div>

        <form onSubmit={handlePreferencesSave} className="space-y-6">
          <div className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.enableRealtime}
                onChange={(e) =>
                  setPreferences({ ...preferences, enableRealtime: e.target.checked })
                }
                disabled={isReadOnly}
                className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="text-sm font-bold text-slate-900 block">
                  Realtime synchronization
                </span>
                <span className="text-xs text-slate-500">
                  Instantly update cards and board actions as they occur.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.enableNotifications}
                onChange={(e) =>
                  setPreferences({ ...preferences, enableNotifications: e.target.checked })
                }
                disabled={isReadOnly}
                className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="text-sm font-bold text-slate-900 block">Email Notifications</span>
                <span className="text-xs text-slate-500">
                  Notify me about task deadlines, blueprint updates, and discussion activities.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.autoArchiveMvps}
                onChange={(e) =>
                  setPreferences({ ...preferences, autoArchiveMvps: e.target.checked })
                }
                disabled={isReadOnly}
                className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="text-sm font-bold text-slate-900 block">
                  Auto-Archive Completed MVP Projects
                </span>
                <span className="text-xs text-slate-500">
                  Move task boards and proposals into records immediately when marked Done.
                </span>
              </div>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
            <Select
              label="Idea Board Default Sorting"
              value={preferences.defaultIdeaSort}
              onChange={(e) => setPreferences({ ...preferences, defaultIdeaSort: e.target.value })}
              disabled={isReadOnly}
              options={[
                { value: 'Latest', label: 'Latest' },
                { value: 'Most Votes', label: 'Most Votes' },
                { value: 'Most Active', label: 'Most Active' },
              ]}
            />
            <Select
              label="Task Board Default View"
              value={preferences.defaultTaskView}
              onChange={(e) => setPreferences({ ...preferences, defaultTaskView: e.target.value })}
              disabled={isReadOnly}
              options={[
                { value: 'Board', label: 'Board (Kanban)' },
                { value: 'List', label: 'List (Backlog)' },
              ]}
            />
          </div>

          {!isReadOnly && (
            <div className="pt-2">
              <Button
                variant="primary"
                type="submit"
                isLoading={savingPreferences}
                icon={<Save className="h-4 w-4" />}
              >
                Save Preferences
              </Button>
            </div>
          )}
        </form>
      </Card>

      {/* SECTION 8: DANGER ZONE */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-rose-100 pb-2">
          <AlertTriangle className="h-5 w-5 text-rose-500" />
          <h2 className="text-lg font-bold text-rose-600">Danger Zone</h2>
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
              <div className="space-y-1 max-w-xl">
                <h4 className="text-sm font-extrabold text-slate-900">Delete Workspace</h4>
                <p className="text-xs text-slate-500">
                  Permanently delete this workspace. This will destroy:
                </p>
                <ul className="text-xs text-slate-500 list-disc list-inside mt-1 space-y-0.5">
                  <li>Workspace metadata &amp; settings</li>
                  <li>All proposed ideas</li>
                  <li>Discussions &amp; suggestions</li>
                  <li>Votes &amp; vote history</li>
                  <li>Project blueprint</li>
                  <li>Sprint tasks &amp; assignments</li>
                  <li>Activity history</li>
                  <li>Member relationships</li>
                </ul>
                <p className="text-xs font-bold text-rose-600 mt-1.5">
                  This action CANNOT be undone.
                </p>
              </div>
              <Button
                variant="primary"
                onClick={() => setDeleteStep(1)}
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

      {/* Delete Workspace Step 1: Warning Dialog */}
      <ConfirmDialog
        isOpen={deleteStep === 1}
        onCancel={() => setDeleteStep(0)}
        onConfirm={() => setDeleteStep(2)}
        title="⚠️ Delete Workspace permanently?"
        description={`You are about to delete "${org.name}". This will wipe out all ideas, blueprint boards, tasks, comments, and members. Are you sure you want to proceed?`}
        confirmLabel="Yes, Proceed"
        cancelLabel="No, Cancel"
      />

      {/* Delete Workspace Step 2: Name Verification Dialog */}
      {deleteStep === 2 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <Card className="max-w-md w-full bg-white p-6 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-black text-rose-600 mb-2 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Verification Required
            </h3>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              To confirm deletion, please type the exact workspace name below:
              <strong className="block mt-1 font-mono text-slate-800 bg-slate-50 px-2 py-1 rounded border border-slate-100 text-center select-all">
                {org.name}
              </strong>
            </p>
            <Input
              value={typedOrgName}
              onChange={(e) => setTypedOrgName(e.target.value)}
              placeholder="Type workspace name..."
              className="mb-6 font-semibold"
            />
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <Button variant="ghost" onClick={() => setDeleteStep(0)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => setDeleteStep(3)}
                disabled={typedOrgName !== org.name}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                Continue Deletion
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Delete Workspace Step 3: Final confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteStep === 3}
        onCancel={() => setDeleteStep(0)}
        onConfirm={handleDeleteWorkspace}
        isLoading={isDeleting}
        title="🚨 Final Confirmation"
        description={`Last warning: there is no undo. Clicking confirm will destroy the workspace "${org.name}" permanently. Proceed?`}
        confirmLabel="Confirm Permanent Delete"
        cancelLabel="No, Keep Workspace"
      />
    </div>
  );
}
