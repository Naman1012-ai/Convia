import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { useUser } from '../../hooks/useUser';
import { useToast } from '../../hooks/useToast';
import { PRIMARY_ROLES, EXPERIENCE_LEVELS } from '../../config/constants';
import { validateUsername, validateProjectUrl } from '../../utils/validation';

export function EditProfileModal({ isOpen, onClose, onSuccess }) {
  const { userProfile, updateProfile } = useUser();
  const { toast } = useToast();

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [primaryRole, setPrimaryRole] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState('');
  const [techStack, setTechStack] = useState('');
  const [interests, setInterests] = useState('');
  const [github, setGithub] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [portfolio, setPortfolio] = useState('');

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (userProfile && isOpen) {
      setUsername(userProfile.username || userProfile.displayName || '');
      setFullName(userProfile.fullName || '');
      setPhotoURL(userProfile.photoURL || '');
      setPrimaryRole(userProfile.primaryRole || '');
      setExperienceLevel(userProfile.experienceLevel || '');
      setBio(userProfile.bio || '');
      setSkills(userProfile.skills || '');
      setTechStack(userProfile.techStack || '');
      setInterests(userProfile.interests || '');
      setGithub(userProfile.github || '');
      setLinkedin(userProfile.linkedin || '');
      setPortfolio(userProfile.portfolio || '');
      setErrors({});
      setServerError('');
    }
  }, [userProfile, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    const formErrors = {};

    const userVal = validateUsername(username, true);
    if (!userVal.valid) {
      formErrors.username = userVal.error;
    }

    if (fullName.trim().length > 100) {
      formErrors.fullName = 'Full Name must be at most 100 characters.';
    }

    if (photoURL.trim()) {
      const pVal = validateProjectUrl(photoURL, 'Photo URL');
      if (!pVal.valid) formErrors.photoURL = pVal.error;
    }

    if (github.trim()) {
      const gVal = validateProjectUrl(github, 'GitHub URL');
      if (!gVal.valid) formErrors.github = gVal.error;
    }

    if (linkedin.trim()) {
      const lVal = validateProjectUrl(linkedin, 'LinkedIn URL');
      if (!lVal.valid) formErrors.linkedin = lVal.error;
    }

    if (portfolio.trim()) {
      const pfVal = validateProjectUrl(portfolio, 'Portfolio URL');
      if (!pfVal.valid) formErrors.portfolio = pfVal.error;
    }

    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
      await updateProfile({
        username: cleanUsername,
        displayName: cleanUsername,
        fullName: fullName.trim() || null,
        photoURL: photoURL.trim() || null,
        primaryRole: primaryRole || null,
        experienceLevel: experienceLevel || null,
        bio: bio.trim(),
        skills: skills.trim(),
        techStack: techStack.trim(),
        interests: interests.trim(),
        github: github.trim(),
        linkedin: linkedin.trim(),
        portfolio: portfolio.trim(),
      });

      toast.success('Profile updated successfully!');
      if (onSuccess) {
        onSuccess('Profile updated successfully!');
      }
      onClose();
    } catch (err) {
      console.error('[EditProfileModal] Error:', err);
      const msg = err.message || 'Failed to update profile.';
      setServerError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const roleOptions = [
    { value: '', label: 'Select role...' },
    ...PRIMARY_ROLES.map((r) => ({ value: r, label: r })),
  ];

  const experienceOptions = [
    { value: '', label: 'Select experience...' },
    ...EXPERIENCE_LEVELS.map((lvl) => ({ value: lvl, label: lvl })),
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit User Profile" size="lg">
      <form onSubmit={handleSubmit} className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
        {serverError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 font-medium">
            {serverError}
          </div>
        )}

        {/* 1. Identity & Avatar */}
        <div className="space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Identity & Avatar
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Input
                label="Username"
                placeholder="e.g. alexj"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                error={errors.username}
                maxLength={30}
                required
              />
              <p className="text-[11px] text-slate-500 mt-1">Your public identity on Convia.</p>
            </div>

            <div>
              <Input
                label="Full Name"
                placeholder="e.g. Alex Johnson"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                error={errors.fullName}
                maxLength={100}
              />
              <p className="text-[11px] text-slate-500 mt-1">Only visible to you.</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <Avatar
              src={photoURL}
              name={username || 'User'}
              size="md"
              className="h-12 w-12 text-base shrink-0 border border-primary-200"
            />
            <div className="flex-1">
              <Input
                label="Profile Photo URL"
                placeholder="https://example.com/avatar.jpg"
                value={photoURL}
                onChange={(e) => setPhotoURL(e.target.value)}
                error={errors.photoURL}
              />
            </div>
          </div>
        </div>

        {/* 2. Professional Details */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Role & Background
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Primary Role"
              options={roleOptions}
              value={primaryRole}
              onChange={(e) => setPrimaryRole(e.target.value)}
            />

            <Select
              label="Experience Level"
              options={experienceOptions}
              value={experienceLevel}
              onChange={(e) => setExperienceLevel(e.target.value)}
            />
          </div>
        </div>

        {/* 3. Biography */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Biography
          </span>
          <Textarea
            placeholder="Tell the community about yourself, what you build, and your engineering interests..."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={300}
            rows={3}
          />
          <div className="flex justify-end text-[11px] text-slate-400 -mt-1">
            <span>{bio.length} / 300</span>
          </div>
        </div>

        {/* 4. Skills, Stack & Interests */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Skills & Interests
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Skills (Comma-separated)"
              placeholder="React, TypeScript, Python, UI/UX"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              maxLength={150}
            />

            <Input
              label="Preferred Tech Stack"
              placeholder="Next.js, Firebase, Tailwind CSS"
              value={techStack}
              onChange={(e) => setTechStack(e.target.value)}
              maxLength={150}
            />
          </div>

          <Input
            label="Project Interests"
            placeholder="AI/ML, Web3, Developer Tools, Mobile Apps"
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
            maxLength={100}
          />
        </div>

        {/* 5. Social & External Links */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Social & External Links
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="GitHub URL"
              placeholder="https://github.com/..."
              value={github}
              onChange={(e) => setGithub(e.target.value)}
              error={errors.github}
            />

            <Input
              label="LinkedIn URL"
              placeholder="https://linkedin.com/in/..."
              value={linkedin}
              onChange={(e) => setLinkedin(e.target.value)}
              error={errors.linkedin}
            />

            <Input
              label="Portfolio Website"
              placeholder="https://mywebsite.com"
              value={portfolio}
              onChange={(e) => setPortfolio(e.target.value)}
              error={errors.portfolio}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}

EditProfileModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
};
