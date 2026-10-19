import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Crown,
  Shield,
  Briefcase,
  Sparkles,
  Calendar,
  AtSign,
  ExternalLink,
  Github,
  X,
  Copy,
  Check,
  MessageSquare,
} from 'lucide-react';
import { resolveMemberDisplayName } from '../../utils/memberIdentity';
import { useUserProfile } from '../../hooks/useUserProfile';
import { useToast } from '../../hooks/useToast';

/**
 * Discord-style Interactive User Profile Popover for Convia Chat & Community.
 * Fetches live user profile data and displays banner, avatar with online indicator,
 * role hierarchy badges, About Me / Bio, Member Since timestamp, Skills & Tech Stack,
 * social links, and quick action buttons.
 */
export function ChatUserProfilePopover({
  member,
  isOpen,
  onClose,
  onMentionUser,
  currentUserId,
}) {
  const popoverRef = useRef(null);
  const { toast } = useToast();
  const [copiedHandle, setCopiedHandle] = useState(false);

  // Fetch full live profile data to ensure bio, roles, joinedAt, and skills are populated
  const memberUid = member?.uid || member?.id;
  const {
    displayName: liveDisplayName,
    avatar: liveAvatar,
    profile: liveProfile,
    loading: profileLoading,
  } = useUserProfile(memberUid, {
    subscribe: true,
    fallbackName: resolveMemberDisplayName(member),
    fallbackAvatar: member?.avatar || member?.photoURL || '',
  });

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !member) return null;

  // Resolve consolidated profile details
  const displayName = liveDisplayName || resolveMemberDisplayName(member);
  const avatar = liveAvatar || member.avatar || member.photoURL || '';
  const username = liveProfile?.username || member.username || '';
  const isOnline = memberUid === currentUserId || liveProfile?.onlineStatus === 'online' || member.onlineStatus === 'online';
  const isOwner = member.role === 'leader' || member.isLeader || member.role === 'owner' || liveProfile?.role === 'owner';
  const isAdmin = liveProfile?.isAdmin || liveProfile?.role === 'admin' || liveProfile?.role === 'superadmin' || member.role === 'admin' || member.isAdmin;
  const primaryRole = liveProfile?.primaryRole || member.primaryRole || null;
  const experienceLevel = liveProfile?.experienceLevel || member.experienceLevel || null;
  const bio = (liveProfile?.bio || member.bio || '').trim();
  const skills = (liveProfile?.skills || member.skills || '').trim();
  const techStack = (liveProfile?.techStack || member.techStack || '').trim();
  const github = (liveProfile?.github || member.github || '').trim();

  // Joined timestamp formatting
  const joinedTimestamp = liveProfile?.firstSignedInAt || liveProfile?.createdAt || liveProfile?.joinedAt || member.joinedAt || member.createdAt;
  const formattedJoinedDate = joinedTimestamp
    ? new Date(Number(joinedTimestamp)).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Recently';

  const handleCopyHandle = async () => {
    if (!username) return;
    try {
      await navigator.clipboard.writeText(`@${username}`);
      setCopiedHandle(true);
      toast.success('Username copied to clipboard.');
      setTimeout(() => setCopiedHandle(false), 2000);
    } catch {
      // Ignored
    }
  };

  // Split skills/tech stack into tag array
  const skillTags = [
    ...skills.split(',').map((s) => s.trim()).filter(Boolean),
    ...techStack.split(',').map((s) => s.trim()).filter(Boolean),
  ];
  // Deduplicate tags
  const uniqueSkillTags = Array.from(new Set(skillTags)).slice(0, 6);

  // Gradient themes based on role hierarchy
  const bannerGradient = isAdmin
    ? 'from-purple-600 via-indigo-600 to-indigo-900'
    : isOwner
    ? 'from-amber-500 via-rose-500 to-amber-700'
    : 'from-emerald-600 via-teal-600 to-slate-900';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        ref={popoverRef}
        className="w-full max-w-sm rounded-3xl bg-white border border-slate-200/90 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-label={`${displayName}'s Profile`}
      >
        {/* Banner with Role Gradient */}
        <div className={`h-24 bg-gradient-to-r ${bannerGradient} relative shrink-0`}>
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors cursor-pointer"
            title="Close"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Profile Card Body (Scrollable if content is extensive) */}
        <div className="relative px-6 pb-6 pt-0 overflow-y-auto">
          {/* Avatar with White Border & Real-Time Presence Ring */}
          <div className="relative -mt-12 mb-3 inline-block">
            {avatar ? (
              <img
                src={avatar}
                alt={displayName}
                className="h-24 w-24 rounded-full object-cover border-4 border-white shadow-lg bg-white"
              />
            ) : (
              <div className="h-24 w-24 rounded-full border-4 border-white shadow-lg bg-gradient-to-br from-primary-600 to-indigo-700 text-white flex items-center justify-center font-bold text-3xl">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <span
              className={`absolute bottom-1.5 right-1.5 h-5 w-5 rounded-full border-3 border-white ${
                isOnline ? 'bg-emerald-500 shadow-md ring-1 ring-emerald-300' : 'bg-slate-400'
              }`}
              title={isOnline ? 'Online' : 'Offline'}
            />
          </div>

          {/* Primary Identity Section */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-black text-slate-900 tracking-tight">{displayName}</h3>

              {/* Roles & Badges */}
              {isOwner && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                  <Crown className="h-3 w-3 text-amber-700" />
                  Owner
                </span>
              )}
              {isAdmin && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-900 border border-purple-300 shadow-2xs">
                  <Shield className="h-3 w-3 text-purple-700" />
                  Admin
                </span>
              )}
            </div>

            {/* Handle with Click-to-Copy */}
            {username && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopyHandle}
                  className="group inline-flex items-center gap-1 text-xs font-mono font-semibold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                  title="Click to copy handle"
                >
                  <span>@{username}</span>
                  {copiedHandle ? (
                    <Check className="h-3 w-3 text-emerald-600" />
                  ) : (
                    <Copy className="h-3 w-3 text-slate-400 group-hover:text-slate-600 opacity-60 group-hover:opacity-100 transition-opacity" />
                  )}
                </button>
              </div>
            )}

            {/* Professional Role & Experience Pills */}
            {(primaryRole || experienceLevel) && (
              <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                {primaryRole && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary-50 text-primary-800 border border-primary-200/80">
                    <Briefcase className="h-3 w-3 text-primary-600" />
                    <span>{primaryRole}</span>
                  </span>
                )}
                {experienceLevel && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                    <Sparkles className="h-3 w-3 text-amber-500" />
                    <span>{experienceLevel}</span>
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="my-3.5 border-t border-slate-100" />

          {/* Discord-style "ABOUT ME" Section */}
          <div className="space-y-1">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 select-none">
              About Me
            </h4>
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/60 text-xs text-slate-700 leading-relaxed break-words">
              {bio ? (
                <p className="whitespace-pre-wrap">{bio}</p>
              ) : (
                <p className="italic text-slate-400">No bio provided yet.</p>
              )}
            </div>
          </div>

          {/* "CONVIA MEMBER SINCE" Section */}
          <div className="mt-3.5 space-y-1">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 select-none">
              Convia Member Since
            </h4>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-700 px-1 py-0.5">
              <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>{formattedJoinedDate}</span>
            </div>
          </div>

          {/* "SKILLS & TECH STACK" Section (if populated) */}
          {uniqueSkillTags.length > 0 && (
            <div className="mt-3.5 space-y-1.5">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 select-none">
                Skills & Tech Stack
              </h4>
              <div className="flex flex-wrap gap-1">
                {uniqueSkillTags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200/80 text-[11px] font-medium text-slate-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Socials / GitHub Link (if populated) */}
          {github && (
            <div className="mt-3.5 space-y-1">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 select-none">
                Links
              </h4>
              <a
                href={github.startsWith('http') ? github : `https://github.com/${github}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:underline px-1 py-0.5"
              >
                <Github className="h-3.5 w-3.5 text-slate-800" />
                <span className="truncate">{github.replace(/^https?:\/\/github\.com\//, '')}</span>
                <ExternalLink className="h-3 w-3 text-slate-400" />
              </a>
            </div>
          )}

          {/* Interactive Action Bar */}
          <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center gap-2">
            {onMentionUser && (
              <button
                type="button"
                onClick={() => {
                  onMentionUser(member);
                  onClose();
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-primary-50 hover:bg-primary-100 active:bg-primary-200 text-primary-800 font-bold text-xs transition-colors cursor-pointer shadow-2xs"
              >
                <AtSign className="h-3.5 w-3.5" />
                <span>Mention</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className={`${onMentionUser ? 'flex-1' : 'w-full'} inline-flex items-center justify-center px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-medium text-xs transition-colors cursor-pointer`}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

ChatUserProfilePopover.propTypes = {
  member: PropTypes.shape({
    uid: PropTypes.string,
    id: PropTypes.string,
    displayName: PropTypes.string,
    avatar: PropTypes.string,
    photoURL: PropTypes.string,
    username: PropTypes.string,
    role: PropTypes.string,
    isAdmin: PropTypes.bool,
    isLeader: PropTypes.bool,
    primaryRole: PropTypes.string,
    experienceLevel: PropTypes.string,
    bio: PropTypes.string,
    skills: PropTypes.string,
    techStack: PropTypes.string,
    github: PropTypes.string,
    joinedAt: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    createdAt: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    onlineStatus: PropTypes.string,
  }),
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onMentionUser: PropTypes.func,
  currentUserId: PropTypes.string,
};
