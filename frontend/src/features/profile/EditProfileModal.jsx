import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Button } from '../../components/ui/Button';
import { useUser } from '../../hooks/useUser';
import { useToast } from '../../hooks/useToast';
import { validateDisplayName } from '../../utils/validation';

export function EditProfileModal({ isOpen, onClose, onSuccess }) {
  const { userProfile, updateProfile } = useUser();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [college, setCollege] = useState('');
  const [skills, setSkills] = useState('');
  const [techStack, setTechStack] = useState('');
  const [interests, setInterests] = useState('');
  const [github, setGithub] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [portfolio, setPortfolio] = useState('');

  const [error, setError] = useState('');
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (userProfile && isOpen) {
      setDisplayName(userProfile.displayName || '');
      setUsername(userProfile.username || '');
      setBio(userProfile.bio || '');
      setCollege(userProfile.college || '');
      setSkills(userProfile.skills || '');
      setTechStack(userProfile.techStack || '');
      setInterests(userProfile.interests || '');
      setGithub(userProfile.github || '');
      setLinkedin(userProfile.linkedin || '');
      setPortfolio(userProfile.portfolio || '');
    }
  }, [userProfile, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    const val = validateDisplayName(displayName);
    if (!val.valid) {
      setError(val.error);
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      await updateProfile({
        displayName: displayName.trim(),
        username: username.trim().replace(/^@/, ''),
        bio: bio.trim(),
        college: college.trim(),
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit User Profile" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        {serverError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 font-medium">
            {serverError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Display Name"
            placeholder="e.g. Alex Johnson"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            error={error}
            maxLength={50}
            required
          />

          <Input
            label="Username"
            placeholder="e.g. alexj"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={30}
          />
        </div>

        <Textarea
          label="Bio"
          placeholder="Tell the community about yourself, your background, and what you love building..."
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={300}
          rows={3}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="College / Organization"
            placeholder="e.g. Stanford University"
            value={college}
            onChange={(e) => setCollege(e.target.value)}
            maxLength={80}
          />

          <Input
            label="Interests"
            placeholder="e.g. AI/ML, Web3, Mobile Apps"
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
            maxLength={100}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Skills (Comma-separated)"
            placeholder="e.g. React, Node.js, UI/UX, Python"
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            maxLength={150}
          />

          <Input
            label="Preferred Tech Stack"
            placeholder="e.g. Next.js, Firebase, Tailwind CSS"
            value={techStack}
            onChange={(e) => setTechStack(e.target.value)}
            maxLength={150}
          />
        </div>

        <div className="space-y-3 pt-2 border-t border-slate-100">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Social & External Links
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="GitHub Profile URL"
              placeholder="https://github.com/username"
              value={github}
              onChange={(e) => setGithub(e.target.value)}
            />

            <Input
              label="LinkedIn Profile URL"
              placeholder="https://linkedin.com/in/username"
              value={linkedin}
              onChange={(e) => setLinkedin(e.target.value)}
            />

            <Input
              label="Portfolio Website"
              placeholder="https://myportfolio.com"
              value={portfolio}
              onChange={(e) => setPortfolio(e.target.value)}
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
