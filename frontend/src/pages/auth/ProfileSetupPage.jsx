import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useUser } from '../../hooks/useUser';
import { useToast } from '../../hooks/useToast';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { PRIMARY_ROLES, EXPERIENCE_LEVELS } from '../../config/constants';
import { validateUsername, validateProjectUrl } from '../../utils/validation';
import { resolveUserDisplayName } from '../../utils/memberIdentity';
import { Sparkles, UserCheck, ArrowRight, ShieldCheck, Image as ImageIcon } from 'lucide-react';

export default function ProfileSetupPage() {
  const { user } = useAuth();
  const { userProfile, updateProfile } = useUser();
  const { toast } = useToast();
  const navigate = useNavigate();

  // If already completed profile, redirect away
  useEffect(() => {
    if (userProfile?.profileCompleted === true) {
      navigate('/dashboard', { replace: true });
      return;
    }
    if (userProfile) {
      if (!username) {
        const u = (userProfile.username || userProfile.displayName || (user?.displayName && user.displayName !== 'User' ? user.displayName : '')).trim().toLowerCase().replace(/^@/, '');
        if (u && u !== 'user') setUsername(u);
      }
      if (!fullName && userProfile.fullName) {
        setFullName(userProfile.fullName);
      }
    }
  }, [userProfile, navigate, user?.displayName]);

  // Form states
  const initialUsername = (userProfile?.username || userProfile?.displayName || (user?.displayName && user.displayName !== 'User' ? user.displayName : '')).trim().toLowerCase().replace(/^@/, '');
  const [username, setUsername] = useState(initialUsername);
  const [fullName, setFullName] = useState(userProfile?.fullName || '');
  const [primaryRole, setPrimaryRole] = useState(userProfile?.primaryRole || 'Developer');
  const [photoURL, setPhotoURL] = useState(userProfile?.photoURL || user?.photoURL || '');
  const [experienceLevel, setExperienceLevel] = useState(userProfile?.experienceLevel || '');
  const [bio, setBio] = useState(userProfile?.bio || '');
  const [skills, setSkills] = useState(userProfile?.skills || '');
  const [techStack, setTechStack] = useState(userProfile?.techStack || '');
  const [interests, setInterests] = useState(userProfile?.interests || '');
  const [github, setGithub] = useState(userProfile?.github || '');
  const [linkedin, setLinkedin] = useState(userProfile?.linkedin || '');
  const [portfolio, setPortfolio] = useState(userProfile?.portfolio || '');

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = (isSkippingOptional = false) => {
    const errs = {};

    const userVal = validateUsername(username, true);
    if (!userVal.valid) {
      errs.username = userVal.error;
    }

    if (!primaryRole || !PRIMARY_ROLES.includes(primaryRole)) {
      errs.primaryRole = 'Please select your primary role.';
    }

    if (fullName.trim().length > 100) {
      errs.fullName = 'Full Name must be at most 100 characters.';
    }

    if (!isSkippingOptional) {
      if (github) {
        const ghVal = validateProjectUrl(github, 'GitHub URL');
        if (!ghVal.valid) errs.github = ghVal.error;
      }
      if (linkedin) {
        const liVal = validateProjectUrl(linkedin, 'LinkedIn URL');
        if (!liVal.valid) errs.linkedin = liVal.error;
      }
      if (portfolio) {
        const pfVal = validateProjectUrl(portfolio, 'Portfolio URL');
        if (!pfVal.valid) errs.portfolio = pfVal.error;
      }
      if (photoURL) {
        const photoVal = validateProjectUrl(photoURL, 'Photo URL');
        if (!photoVal.valid) errs.photoURL = photoVal.error;
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async (isSkippingOptional = false) => {
    setServerError('');
    if (!validateForm(isSkippingOptional)) {
      toast.error('Please fix the errors before continuing.');
      return;
    }

    setIsSubmitting(true);
    try {
      const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
      const profilePayload = {
        username: cleanUsername,
        displayName: cleanUsername,
        fullName: fullName.trim() || null,
        primaryRole,
        profileCompleted: true,
      };

      if (!isSkippingOptional) {
        if (photoURL.trim()) profilePayload.photoURL = photoURL.trim();
        if (experienceLevel) profilePayload.experienceLevel = experienceLevel;
        if (bio.trim()) profilePayload.bio = bio.trim();
        if (skills.trim()) profilePayload.skills = skills.trim();
        if (techStack.trim()) profilePayload.techStack = techStack.trim();
        if (interests.trim()) profilePayload.interests = interests.trim();
        if (github.trim()) profilePayload.github = github.trim();
        if (linkedin.trim()) profilePayload.linkedin = linkedin.trim();
        if (portfolio.trim()) profilePayload.portfolio = portfolio.trim();
      }

      await updateProfile(profilePayload);
      toast.success('🎉 Profile setup complete! Welcome to Convia.');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error('[ProfileSetupPage] Save error:', err);
      const msg = err.message || 'Failed to complete profile setup.';
      setServerError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const roleOptions = [
    { value: '', label: 'Select your primary role...' },
    ...PRIMARY_ROLES.map((r) => ({ value: r, label: r })),
  ];

  const experienceOptions = [
    { value: '', label: 'Select experience level (optional)...' },
    ...EXPERIENCE_LEVELS.map((lvl) => ({ value: lvl, label: lvl })),
  ];

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 flex flex-col justify-center">
      <div className="max-w-2xl mx-auto w-full space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-primary-100 text-primary-700 shadow-sm mb-1">
            <Sparkles className="h-7 w-7 text-primary-600" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Complete your Convia profile
          </h1>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Set up your public identity to collaborate on projects, discover teammates, and contribute across workspaces.
          </p>
        </div>

        {serverError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 font-medium">
            {serverError}
          </div>
        )}

        <Card className="p-8 bg-white border border-slate-200 shadow-xl rounded-2xl space-y-8">
          {/* Section 1: Required Identity */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <UserCheck className="h-5 w-5 text-primary-600" />
              <h2 className="text-base font-extrabold text-slate-900">
                Core Identity <span className="text-xs font-semibold text-rose-500 uppercase tracking-wider ml-1">(Required)</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Input
                  label="Username"
                  placeholder="e.g. alexj"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  error={errors.username}
                  required
                  maxLength={30}
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Your public identity on Convia.
                </p>
              </div>

              <div>
                <Select
                  label="Primary Role"
                  options={roleOptions}
                  value={primaryRole}
                  onChange={(e) => setPrimaryRole(e.target.value)}
                  error={errors.primaryRole}
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Your main discipline on project teams.
                </p>
              </div>

              <div className="sm:col-span-2">
                <Input
                  label="Full Name"
                  placeholder="e.g. Alex Johnson"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  error={errors.fullName}
                  maxLength={100}
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Only visible to you.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Visual & Background */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <ImageIcon className="h-5 w-5 text-primary-600" />
              <h2 className="text-base font-extrabold text-slate-900">
                Profile Photo & Experience <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">(Optional)</span>
              </h2>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
              <Avatar
                src={photoURL}
                name={resolveUserDisplayName(userProfile, user)}
                size="lg"
                className="h-16 w-16 text-xl shrink-0 border-2 border-primary-300 shadow-sm"
              />
              <div className="w-full">
                <Input
                  label="Profile Photo URL"
                  placeholder="https://example.com/avatar.jpg or GitHub avatar URL"
                  value={photoURL}
                  onChange={(e) => setPhotoURL(e.target.value)}
                  error={errors.photoURL}
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Paste a direct image link from GitHub, Gravatar, or Imgur.
                </p>
              </div>
            </div>

            <div className="w-full">
              <Select
                label="Experience Level"
                options={experienceOptions}
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value)}
              />
            </div>

            <div>
              <Textarea
                label="Bio"
                placeholder="Briefly describe what you build, your passions, and what drives your projects..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={300}
                rows={3}
              />
              <div className="flex justify-between items-center text-[11px] text-slate-400 mt-1">
                <span>Keep it under 300 characters.</span>
                <span>{bio.length} / 300</span>
              </div>
            </div>
          </div>

          {/* Section 3: Technical Skills & Interests */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <ShieldCheck className="h-5 w-5 text-primary-600" />
              <h2 className="text-base font-extrabold text-slate-900">
                Skills & Interests <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">(Optional)</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Input
                  label="Skills"
                  placeholder="React, TypeScript, Python, UI/UX"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  maxLength={150}
                />
                <p className="text-[11px] text-slate-400 mt-1">Comma-separated skills</p>
              </div>

              <div>
                <Input
                  label="Preferred Tech Stack"
                  placeholder="Next.js, Tailwind, Firebase, PostgreSQL"
                  value={techStack}
                  onChange={(e) => setTechStack(e.target.value)}
                  maxLength={150}
                />
                <p className="text-[11px] text-slate-400 mt-1">Comma-separated tools</p>
              </div>
            </div>

            <div>
              <Input
                label="Project Interests"
                placeholder="AI/ML, Open Source, Developer Tools, Mobile Apps"
                value={interests}
                onChange={(e) => setInterests(e.target.value)}
                maxLength={100}
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Topics and domains you love collaborating on.
              </p>
            </div>
          </div>

          {/* Section 4: Social & Links */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <h2 className="text-base font-extrabold text-slate-900">
                Online Presence <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">(Optional)</span>
              </h2>
            </div>

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

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={isSubmitting}
              className="text-xs font-bold text-slate-500 hover:text-slate-700 underline underline-offset-4 cursor-pointer"
            >
              Skip optional fields & finish
            </button>

            <Button
              type="button"
              variant="primary"
              size="md"
              isLoading={isSubmitting}
              onClick={() => handleSave(false)}
              icon={<ArrowRight className="h-4 w-4" />}
              className="w-full sm:w-auto bg-primary-600 hover:bg-primary-700 font-extrabold text-sm px-6 shadow-md shadow-primary-600/25"
            >
              Complete Setup
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
