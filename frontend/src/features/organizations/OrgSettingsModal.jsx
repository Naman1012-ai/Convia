import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useOrg } from '../../hooks/useOrg';
import { orgService } from '../../services/orgService';
import { Modal } from '../../components/ui/Modal';
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
  WORKSPACE_LIMITS,
  resolveWorkspaceProjectType,
} from '../../constants/workspaceConstants';

export function OrgSettingsModal({ isOpen, onClose, onSuccess = () => {} }) {
  const { org } = useOrg();

  const [name, setName] = useState('');
  const [projectType, setProjectType] = useState('software');
  const [description, setDescription] = useState('');
  const [projectGoal, setProjectGoal] = useState('');
  const [maxMembers, setMaxMembers] = useState(5);
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [projectUrl, setProjectUrl] = useState('');
  const [documentationUrl, setDocumentationUrl] = useState('');

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (org && isOpen) {
      setName(org.name || '');
      setProjectType(resolveWorkspaceProjectType(org));
      setDescription(org.description || org.hackathonDescription || '');
      setProjectGoal(org.projectGoal || '');
      setMaxMembers(org.maxMembers || org.teamSizeLimit || 5);
      setRepositoryUrl(org.repositoryUrl || '');
      setProjectUrl(org.projectUrl || '');
      setDocumentationUrl(org.documentationUrl || '');
      setErrors({});
      setServerError('');
    }
  }, [org, isOpen]);

  const validate = () => {
    const errs = {};
    const nameVal = validateWorkspaceName(name);
    if (!nameVal.valid) errs.name = nameVal.error;

    const typeVal = validateProjectType(projectType);
    if (!typeVal.valid) errs.projectType = typeVal.error;

    const descVal = validateWorkspaceDescription(description);
    if (!descVal.valid) errs.description = descVal.error;

    const goalVal = validateProjectGoal(projectGoal);
    if (!goalVal.valid) errs.projectGoal = goalVal.error;

    const memVal = validateWorkspaceMembersLimit(maxMembers, 1, WORKSPACE_LIMITS.MEMBERS_MAX);
    if (!memVal.valid) errs.maxMembers = memVal.error;

    const repoVal = validateProjectUrl(repositoryUrl, 'Repository URL');
    if (!repoVal.valid) errs.repositoryUrl = repoVal.error;

    const projVal = validateProjectUrl(projectUrl, 'Project URL');
    if (!projVal.valid) errs.projectUrl = projVal.error;

    const docVal = validateProjectUrl(documentationUrl, 'Documentation URL');
    if (!docVal.valid) errs.documentationUrl = docVal.error;

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    if (!validate()) return;

    setIsSubmitting(true);

    try {
      const payload = {
        name: name.trim(),
        projectType,
        description: description.trim(),
        projectGoal: projectGoal.trim(),
        maxMembers: Number(maxMembers),
        teamSizeLimit: Number(maxMembers),
        repositoryUrl: repositoryUrl.trim(),
        projectUrl: projectUrl.trim(),
        documentationUrl: documentationUrl.trim(),
      };

      // Preserve legacy fields if previously present
      if (org?.hackathonName) payload.hackathonName = org.hackathonName;
      if (org?.hackathonTheme) payload.hackathonTheme = org.hackathonTheme;
      if (org?.hackathonLocation) payload.hackathonLocation = org.hackathonLocation;
      if (org?.hackathonDate) payload.hackathonDate = org.hackathonDate;
      if (org?.startDate) payload.startDate = org.startDate;
      if (org?.endDate) payload.endDate = org.endDate;

      await orgService.updateOrganizationGeneralSettings(org.orgId, payload);

      onSuccess('Workspace settings updated successfully!');
      onClose();
    } catch (err) {
      setServerError(err.message || 'Failed to update workspace settings.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Workspace Settings" size="lg">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {serverError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 font-medium">
            {serverError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Workspace Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
            maxLength={WORKSPACE_LIMITS.NAME_MAX}
            required
          />

          <Select
            label="Project Type"
            value={projectType}
            onChange={(e) => setProjectType(e.target.value)}
            options={PROJECT_TYPES}
            error={errors.projectType}
            required
          />
        </div>

        <Textarea
          label="Description"
          placeholder="Describe what this workspace is for and what the team is building..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          error={errors.description}
          rows={3}
          maxLength={WORKSPACE_LIMITS.DESCRIPTION_MAX}
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Project Goal (Optional)"
            placeholder="What do you want this project to accomplish?"
            value={projectGoal}
            onChange={(e) => setProjectGoal(e.target.value)}
            error={errors.projectGoal}
            maxLength={WORKSPACE_LIMITS.PROJECT_GOAL_MAX}
          />

          <Input
            label="Maximum Members"
            type="number"
            min={1}
            max={WORKSPACE_LIMITS.MEMBERS_MAX}
            value={maxMembers}
            onChange={(e) => setMaxMembers(e.target.value)}
            error={errors.maxMembers}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Repository URL"
            placeholder="https://github.com/..."
            value={repositoryUrl}
            onChange={(e) => setRepositoryUrl(e.target.value)}
            error={errors.repositoryUrl}
          />
          <Input
            label="Project URL"
            placeholder="https://..."
            value={projectUrl}
            onChange={(e) => setProjectUrl(e.target.value)}
            error={errors.projectUrl}
          />
          <Input
            label="Documentation URL"
            placeholder="https://docs..."
            value={documentationUrl}
            onChange={(e) => setDocumentationUrl(e.target.value)}
            error={errors.documentationUrl}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            Save Settings
          </Button>
        </div>
      </form>
    </Modal>
  );
}

OrgSettingsModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
};
