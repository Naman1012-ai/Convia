import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { usePlatformSettings } from '../../hooks/usePlatformSettings';
import { orgService } from '../../services/orgService';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { Button } from '../../components/ui/Button';
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
} from '../../constants/workspaceConstants';
import { Plus } from 'lucide-react';

export function CreateOrgForm({ onSuccess = null, onCancel = null }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { canCreateWorkspace } = usePlatformSettings();
  const navigate = useNavigate();

  // Form State
  const [name, setName] = useState('');
  const [projectType, setProjectType] = useState('');
  const [description, setDescription] = useState('');
  const [projectGoal, setProjectGoal] = useState('');
  const [visibility, setVisibility] = useState('private');
  const [maxMembers, setMaxMembers] = useState(WORKSPACE_LIMITS.MEMBERS_DEFAULT);
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [projectUrl, setProjectUrl] = useState('');
  const [documentationUrl, setDocumentationUrl] = useState('');

  // Validation & Submission States
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clearError = (field) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const validateForm = () => {
    const newErrors = {};

    const nameVal = validateWorkspaceName(name);
    if (!nameVal.valid) newErrors.name = nameVal.error;

    const typeVal = validateProjectType(projectType);
    if (!typeVal.valid) newErrors.projectType = typeVal.error;

    const descVal = validateWorkspaceDescription(description);
    if (!descVal.valid) newErrors.description = descVal.error;

    const goalVal = validateProjectGoal(projectGoal);
    if (!goalVal.valid) newErrors.projectGoal = goalVal.error;

    const membersVal = validateWorkspaceMembersLimit(maxMembers, 2, WORKSPACE_LIMITS.MEMBERS_MAX);
    if (!membersVal.valid) newErrors.maxMembers = membersVal.error;

    const repoVal = validateProjectUrl(repositoryUrl, 'Repository URL');
    if (!repoVal.valid) newErrors.repositoryUrl = repoVal.error;

    const projVal = validateProjectUrl(projectUrl, 'Project URL');
    if (!projVal.valid) newErrors.projectUrl = projVal.error;

    const docVal = validateProjectUrl(documentationUrl, 'Documentation URL');
    if (!docVal.valid) newErrors.documentationUrl = docVal.error;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    if (!user || !user.uid) {
      const authErr = 'You must be signed in to create a workspace.';
      setServerError(authErr);
      toast.error(authErr);
      return;
    }

    const check = canCreateWorkspace();
    if (!check.allowed) {
      setServerError(check.reason);
      toast.error(check.reason);
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        name: name.trim(),
        projectType,
        description: description.trim(),
        projectGoal: projectGoal.trim(),
        visibility,
        maxMembers: Number(maxMembers),
        teamSizeLimit: Number(maxMembers),
        repositoryUrl: repositoryUrl.trim(),
        projectUrl: projectUrl.trim(),
        documentationUrl: documentationUrl.trim(),
      };

      const newOrg = await orgService.createOrganization(user.uid, payload);

      toast.success('Workspace created successfully!');

      if (onSuccess) {
        onSuccess(newOrg);
      } else {
        navigate(`/workspaces/${newOrg.orgId}/ideas`);
      }
    } catch (err) {
      const msg = err.message || 'Failed to create workspace.';
      setServerError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {serverError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 font-medium">
          {serverError}
        </div>
      )}

      {/* SECTION 1: WORKSPACE DETAILS */}
      <div className="space-y-4">
        <div className="border-b border-slate-100 pb-1.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Workspace Details
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Workspace Name"
            placeholder="e.g., Acme Cloud Platform"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              clearError('name');
            }}
            error={errors.name}
            maxLength={WORKSPACE_LIMITS.NAME_MAX}
            required
          />

          <Select
            label="Project Type"
            value={projectType}
            onChange={(e) => {
              setProjectType(e.target.value);
              clearError('projectType');
            }}
            options={[
              { value: '', label: 'Select project type...' },
              ...PROJECT_TYPES,
            ]}
            error={errors.projectType}
            required
          />
        </div>

        <Textarea
          label="Description"
          placeholder="Describe what this workspace is for and what the team is building..."
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            clearError('description');
          }}
          error={errors.description}
          maxLength={WORKSPACE_LIMITS.DESCRIPTION_MAX}
          rows={3}
          required
        />

        <Input
          label="Project Goal (Optional)"
          placeholder="What do you want this project to accomplish?"
          value={projectGoal}
          onChange={(e) => {
            setProjectGoal(e.target.value);
            clearError('projectGoal');
          }}
          error={errors.projectGoal}
          maxLength={WORKSPACE_LIMITS.PROJECT_GOAL_MAX}
        />
      </div>

      {/* SECTION 2: WORKSPACE CONFIGURATION */}
      <div className="space-y-4">
        <div className="border-b border-slate-100 pb-1.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Workspace Configuration
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
          <div>
            <Select
              label="Visibility"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              options={WORKSPACE_VISIBILITY_OPTIONS}
              disabled
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Only invited members can access. Community visibility coming in future phase.
            </p>
          </div>

          <Input
            label="Maximum Members"
            type="number"
            min={2}
            max={WORKSPACE_LIMITS.MEMBERS_MAX}
            value={maxMembers}
            onChange={(e) => {
              setMaxMembers(e.target.value);
              clearError('maxMembers');
            }}
            error={errors.maxMembers}
            required
          />
        </div>
      </div>

      {/* SECTION 3: PROJECT LINKS */}
      <div className="space-y-4">
        <div className="border-b border-slate-100 pb-1.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Project Links (Optional)
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Repository URL"
            placeholder="https://github.com/..."
            value={repositoryUrl}
            onChange={(e) => {
              setRepositoryUrl(e.target.value);
              clearError('repositoryUrl');
            }}
            error={errors.repositoryUrl}
          />

          <Input
            label="Project URL"
            placeholder="https://myproject.com"
            value={projectUrl}
            onChange={(e) => {
              setProjectUrl(e.target.value);
              clearError('projectUrl');
            }}
            error={errors.projectUrl}
          />

          <Input
            label="Documentation URL"
            placeholder="https://docs..."
            value={documentationUrl}
            onChange={(e) => {
              setDocumentationUrl(e.target.value);
              clearError('documentationUrl');
            }}
            error={errors.documentationUrl}
          />
        </div>
      </div>

      {/* ACTION BUTTONS */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          isLoading={isSubmitting}
          icon={<Plus className="h-4 w-4" />}
          className="font-bold"
        >
          Create Workspace
        </Button>
      </div>
    </form>
  );
}

CreateOrgForm.propTypes = {
  onSuccess: PropTypes.func,
  onCancel: PropTypes.func,
};
