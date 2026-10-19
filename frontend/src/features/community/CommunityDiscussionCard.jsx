import React, { useState, useRef, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  MessageCircle,
  MoreVertical,
  Pencil,
  Trash2,
  Bookmark,
  BookmarkCheck,
  Copy,
  Check,
  SmilePlus,
  Sparkles,
  Lightbulb,
  Pin,
  PinOff,
  Loader2,
  Shield,
  Crown,
  CornerDownRight,
} from 'lucide-react';
import {
  COMMUNITY_POST_TYPE_CONFIG,
  COMMUNITY_SUPPORTED_REACTIONS,
} from '../../constants/chatSchema';
import {
  formatMessageTime,
  formatFullDateTime,
  formatReplyCountLabel,
} from '../../utils/chatFeedHelpers';
import {
  resolveMemberDisplayName,
  isMessageAuthoredByUser,
  getMessageAuthorUid,
} from '../../utils/memberIdentity';
import { renderDiscordMarkdown } from '../../utils/discordMarkdown';
import { useUserProfile } from '../../hooks/useUserProfile';
import { useToast } from '../../hooks/useToast';
import { ChatReactionPicker } from '../chat/ChatReactionPicker';
import { ChatReactionParticipantsModal } from '../chat/ChatReactionParticipantsModal';
import { ChatFileCard } from '../chat/ChatFileCard';
import { VoiceMessagePlayer } from '../chat/VoiceMessagePlayer';

/**
 * Discord-style Community Discussion Card for Convia.
 * Features full-width linear layout, Discord markdown AST engine (syntax-highlighted code blocks,
 * spoilers, blockquotes, mentions), hover action bar, thread count badges, and role indicators.
 */
export function CommunityDiscussionCard({
  message,
  currentUserId,
  isAdmin = false,
  reactions = {},
  replyCount = 0,
  isGrouped = false,
  isFirstInGroup = true,
  isLastInGroup = true,
  timeLabel = null,
  fullDateLabel = null,
  onOpenThread = () => {},
  onToggleReaction = () => {},
  onEditMessage = async () => {},
  onDeleteMessage = () => {},
  onTurnIntoIdea = () => {},
  isHighlighted = false,
  isSaved = false,
  onToggleSave = () => {},
  isPinned = false,
  onTogglePin = () => {},
  onOpenProfile = null,
  activeMenuMessageId = null,
  onSetActiveMenuMessageId = null,
  menuAnchorRect = null,
  onOpenMenu = null,
  onCloseMenu = null,
  onOpenPreview = null,
}) {
  const { toast } = useToast();
  const [localMenuOpen, setLocalMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content || '');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [reactionPickerSource, setReactionPickerSource] = useState(null); // 'floating' | 'footer' | null
  const [inspectReactionEmoji, setInspectReactionEmoji] = useState(null);

  const currentUserReactions = useMemo(() => {
    if (!currentUserId || !reactions || typeof reactions !== 'object') return [];
    return Object.entries(reactions)
      .filter(([_, data]) => Array.isArray(data?.users) && data.users.includes(currentUserId))
      .map(([emoji]) => emoji);
  }, [reactions, currentUserId]);

  const menuButtonRef = useRef(null);
  const menuRef = useRef(null);
  const editTextareaRef = useRef(null);

  const isMenuOpen = onSetActiveMenuMessageId
    ? activeMenuMessageId === message.messageId
    : localMenuOpen;

  const setIsMenuOpen = (open) => {
    if (onSetActiveMenuMessageId) {
      onSetActiveMenuMessageId(open ? message.messageId : null);
    } else {
      setLocalMenuOpen(open);
    }
  };

  const handleCloseMenu = () => {
    setIsMenuOpen(false);
    if (typeof onCloseMenu === 'function') {
      onCloseMenu();
    }
  };

  const handleToggleMenu = (e) => {
    e.stopPropagation();
    const nextState = !isMenuOpen;
    setIsMenuOpen(nextState);
    if (nextState && typeof onOpenMenu === 'function' && menuButtonRef.current) {
      const rect = menuButtonRef.current.getBoundingClientRect();
      onOpenMenu(message.messageId, rect);
    } else if (!nextState && typeof onCloseMenu === 'function') {
      onCloseMenu();
    }
  };

  // Close context menu on outside click or Escape
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        handleCloseMenu();
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') handleCloseMenu();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  // Author resolution
  const messageAuthorUid = getMessageAuthorUid(message) || message.senderId;
  const { displayName: resolvedName, avatar: resolvedAvatar, profile: liveProfile } = useUserProfile(
    messageAuthorUid,
    {
      subscribe: false,
      fallbackName: resolveMemberDisplayName(message.senderName || message.authorName || 'Community Member'),
      fallbackAvatar: message.senderAvatar || message.authorAvatar || '',
    }
  );

  const memberProfile = liveProfile || {
    uid: messageAuthorUid,
    displayName: resolvedName,
    avatar: resolvedAvatar,
    username: message.authorUsername || message.senderUsername || (resolvedName.toLowerCase().replace(/[^a-z0-9_]/g, '')),
  };

  // Ownership comparison
  const isOwnMessage = Boolean(
    currentUserId && isMessageAuthoredByUser(message, currentUserId)
  );

  const isAuthorAdmin = Boolean(
    liveProfile?.isAdmin ||
    liveProfile?.role === 'superadmin' ||
    liveProfile?.role === 'admin'
  );

  const canEdit = isOwnMessage && !message.deleted;
  const canDelete = !message.deleted && (isOwnMessage || isAdmin);
  const canReply = !message.deleted;
  const canReact = !message.deleted;

  const postType = (message.postType || message.type || '').toLowerCase();
  const typeConfig = postType ? COMMUNITY_POST_TYPE_CONFIG[postType] : null;

  const displayTime = timeLabel || formatMessageTime(message.createdAt);
  const displayFullDate = fullDateLabel || formatFullDateTime(message.createdAt);

  // Auto-focus and resize textarea when entering edit mode
  useEffect(() => {
    if (isEditing && editTextareaRef.current) {
      editTextareaRef.current.focus();
      editTextareaRef.current.style.height = 'auto';
      editTextareaRef.current.style.height = `${editTextareaRef.current.scrollHeight}px`;
    }
  }, [isEditing]);

  const handleCopyText = async () => {
    try {
      const textToCopy = (message.content || '').trim();
      if (!textToCopy) return;
      await navigator.clipboard.writeText(textToCopy);
      setCopiedText(true);
      toast.success('Text copied to clipboard.');
      setTimeout(() => setCopiedText(false), 2000);
      handleCloseMenu();
    } catch {
      toast.error('Failed to copy text.');
    }
  };

  const handleCopyLink = async () => {
    try {
      const targetId = message.messageId || message.id;
      const url = `${window.location.origin}/community?messageId=${encodeURIComponent(targetId)}`;
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      toast.success('Link copied to clipboard.');
      setTimeout(() => setCopiedLink(false), 2000);
      handleCloseMenu();
    } catch {
      toast.error('Failed to copy link.');
    }
  };

  const handleSaveEdit = async (e) => {
    if (e) e.preventDefault();
    const cleanContent = editContent.trim();
    if (!cleanContent) return;

    if (cleanContent === message.content) {
      setIsEditing(false);
      return;
    }

    try {
      setIsSavingEdit(true);
      await onEditMessage(message.messageId, cleanContent);
      setIsEditing(false);
    } catch {
      // Handled by parent
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsEditing(false);
      setEditContent(message.content || '');
    }
  };

  const handleAuthorClick = (e) => {
    e.stopPropagation();
    if (typeof onOpenProfile === 'function') {
      onOpenProfile(memberProfile);
    }
  };

  // Discord Floating Action Bar on hover
  const renderFloatingActionBar = () => {
    if (message.deleted) return null;

    return (
      <aside
        className={`absolute -top-3.5 right-4 z-20 items-center bg-white border border-slate-200/90 rounded-lg shadow-sm px-1 py-0.5 gap-0.5 select-none transition-opacity ${
          isMenuOpen
            ? 'flex opacity-100'
            : 'hidden group-hover:flex group-focus-within:flex opacity-100'
        }`}
        aria-label="Discussion quick actions"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Quick Add Reaction (WhatsApp-Style Bar) */}
        {canReact && (
          <div className="relative">
            <button
              type="button"
              onClick={() =>
                setReactionPickerSource((prev) => (prev === 'floating' ? null : 'floating'))
              }
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                reactionPickerSource === 'floating'
                  ? 'bg-slate-200 text-slate-900'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
              title="Add reaction"
              aria-label="Add reaction"
            >
              <SmilePlus className="h-3.5 w-3.5" />
            </button>

            {reactionPickerSource === 'floating' && (
              <ChatReactionPicker
                isOpen={true}
                align="right"
                userReactions={currentUserReactions}
                onSelectReaction={(emoji) => {
                  onToggleReaction(message.messageId, emoji);
                  setReactionPickerSource(null);
                }}
                onClose={() => setReactionPickerSource(null)}
              />
            )}
          </div>
        )}

        <div className="h-3.5 w-px bg-slate-200 mx-0.5" />

        {/* Reply in Thread Button */}
        {canReply && (
          <button
            type="button"
            onClick={() => onOpenThread(message)}
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Reply in thread"
            aria-label="Reply in thread"
          >
            <MessageCircle className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Turn into Idea Button */}
        <button
          type="button"
          onClick={() => onTurnIntoIdea(message)}
          className="p-1.5 rounded-md text-slate-500 hover:text-primary-700 hover:bg-primary-50 transition-colors cursor-pointer"
          title="Turn into Proposal / Idea"
          aria-label="Turn into Proposal / Idea"
        >
          <Sparkles className="h-3.5 w-3.5" />
        </button>

        {/* Save / Bookmark Button */}
        {currentUserId && (
          <button
            type="button"
            onClick={() => onToggleSave(message)}
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
              isSaved
                ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
            title={isSaved ? 'Remove from saved' : 'Save discussion'}
            aria-label={isSaved ? 'Remove from saved' : 'Save discussion'}
          >
            {isSaved ? (
              <BookmarkCheck className="h-3.5 w-3.5 fill-current" />
            ) : (
              <Bookmark className="h-3.5 w-3.5" />
            )}
          </button>
        )}

        {/* Pin to Top Button (Admin only) */}
        {isAdmin && (
          <button
            type="button"
            onClick={() => onTogglePin(message)}
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
              isPinned
                ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
            title={isPinned ? 'Unpin discussion' : 'Pin to top as featured'}
            aria-label={isPinned ? 'Unpin discussion' : 'Pin to top as featured'}
          >
            {isPinned ? (
              <PinOff className="h-3.5 w-3.5 text-amber-600" />
            ) : (
              <Pin className="h-3.5 w-3.5 rotate-45" />
            )}
          </button>
        )}

        {/* More Actions Trigger & Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            ref={menuButtonRef}
            type="button"
            onClick={handleToggleMenu}
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
              isMenuOpen
                ? 'bg-slate-100 text-slate-900'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
            title="More actions"
            aria-label="More actions"
            aria-haspopup="true"
            aria-expanded={isMenuOpen}
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </button>

          {isMenuOpen && (
            <div
              className="absolute right-0 top-full mt-1.5 z-50 min-w-[180px] rounded-xl border border-slate-200 bg-white p-1 shadow-xl transition-all"
              role="menu"
              aria-label="Discussion actions"
            >
              {/* Copy Link */}
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                role="menuitem"
              >
                {copiedLink ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span className="text-emerald-700 font-semibold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>Copy link</span>
                  </>
                )}
              </button>

              {/* Copy Text */}
              {message.content && (
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                  role="menuitem"
                >
                  {copiedText ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span className="text-emerald-700 font-semibold">Text copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>Copy text</span>
                    </>
                  )}
                </button>
              )}

              {/* Turn into Idea */}
              <button
                type="button"
                onClick={() => {
                  handleCloseMenu();
                  onTurnIntoIdea(message);
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-50 transition-colors cursor-pointer"
                role="menuitem"
              >
                <Sparkles className="h-3.5 w-3.5 text-primary-600 shrink-0" />
                <span>Turn into Idea</span>
              </button>

              {/* Save / Bookmark Discussion */}
              {currentUserId && (
                <button
                  type="button"
                  onClick={() => {
                    handleCloseMenu();
                    onToggleSave(message);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                  role="menuitem"
                >
                  {isSaved ? (
                    <>
                      <BookmarkCheck className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      <span className="text-amber-800 font-semibold">Remove from Saved</span>
                    </>
                  ) : (
                    <>
                      <Bookmark className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>Save Discussion</span>
                    </>
                  )}
                </button>
              )}

              {/* Pin / Featured Discussion (Admin only) */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    handleCloseMenu();
                    onTogglePin(message);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer"
                  role="menuitem"
                >
                  {isPinned ? (
                    <PinOff className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  ) : (
                    <Pin className="h-3.5 w-3.5 text-amber-600 shrink-0 rotate-45" />
                  )}
                  <span>{isPinned ? 'Unpin Discussion' : 'Pin to Top'}</span>
                </button>
              )}

              {/* Edit Message (Author only) */}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    handleCloseMenu();
                    setIsEditing(true);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                  role="menuitem"
                >
                  <Pencil className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>Edit Discussion</span>
                </button>
              )}

              {/* Delete Message (Author or Admin) */}
              {canDelete && (
                <button
                  type="button"
                  onClick={() => {
                    handleCloseMenu();
                    onDeleteMessage(message);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  role="menuitem"
                >
                  <Trash2 className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                  <span>Delete Discussion</span>
                </button>
              )}
            </div>
          )}
        </div>
      </aside>
    );
  };

  // Reactions summary pill bar
  const renderReactionsSummary = () => {
    const reactionEntries = Object.entries(reactions).filter(
      ([, data]) => data && data.count > 0
    );

    if (reactionEntries.length === 0 && !replyCount) return null;

    return (
      <div className="flex flex-wrap items-center gap-1.5 mt-1.5 pt-0.5 select-none">
        {reactionEntries.map(([emoji, data]) => {
          const hasReacted = currentUserId && Array.isArray(data.users) && data.users.includes(currentUserId);
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => onToggleReaction(message.messageId, emoji)}
              onContextMenu={(e) => {
                e.preventDefault();
                setInspectReactionEmoji(emoji);
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs transition-all cursor-pointer ${
                hasReacted
                  ? 'bg-primary-50 border border-primary-300 text-primary-900 font-bold shadow-2xs'
                  : 'bg-slate-100/80 hover:bg-slate-200/80 border border-slate-200/80 text-slate-700'
              }`}
              title={`${hasReacted ? 'Click to remove reaction' : 'Click to react'} • Right-click or click count to view participants (${data.count})`}
            >
              <span className="text-sm leading-none">{emoji}</span>
              <span
                className="font-mono text-[11px] font-semibold hover:underline cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setInspectReactionEmoji(emoji);
                }}
                title="View who reacted"
              >
                {data.count}
              </span>
            </button>
          );
        })}

        {/* Add reaction mini-pill in Footer */}
        {canReact && (
          <div className="relative">
            <button
              type="button"
              onClick={() =>
                setReactionPickerSource((prev) => (prev === 'footer' ? null : 'footer'))
              }
              className={`inline-flex items-center justify-center h-6 w-6 rounded-full transition-colors text-xs cursor-pointer ${
                reactionPickerSource === 'footer'
                  ? 'bg-slate-200 text-slate-800'
                  : 'bg-slate-100/70 hover:bg-slate-200/80 text-slate-500 hover:text-slate-800'
              }`}
              title="Add reaction"
              aria-label="Add emoji reaction"
            >
              <SmilePlus className="h-3.5 w-3.5" />
            </button>

            {reactionPickerSource === 'footer' && (
              <ChatReactionPicker
                isOpen={true}
                align="left"
                userReactions={currentUserReactions}
                onSelectReaction={(emoji) => {
                  onToggleReaction(message.messageId, emoji);
                  setReactionPickerSource(null);
                }}
                onClose={() => setReactionPickerSource(null)}
              />
            )}
          </div>
        )}

        {/* Thread reply count pill */}
        {replyCount > 0 && (
          <button
            type="button"
            onClick={() => onOpenThread(message)}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-800 font-bold border border-emerald-200/80 shadow-2xs hover:bg-emerald-100 transition-all cursor-pointer ml-1"
            title={`${formatReplyCountLabel(replyCount)} - Click to open discussion thread`}
          >
            <MessageCircle className="h-3 w-3" />
            <span>{formatReplyCountLabel(replyCount)}</span>
          </button>
        )}
      </div>
    );
  };

  return (
    <div
      id={`msg_${message.messageId}`}
      tabIndex={0}
      className={`group relative flex w-full transition-all duration-700 ease-out px-3 sm:px-4 ${
        isGrouped ? 'py-0.5' : 'pt-2.5 pb-1 mt-1'
      } hover:bg-slate-50/80 rounded-xl ${
        isHighlighted
          ? 'bg-emerald-500/15 ring-2 ring-emerald-500/50 shadow-sm'
          : isPinned
          ? 'bg-amber-50/40 border-l-2 border-amber-500'
          : ''
      }`}
    >
      {/* Discord Floating Action Bar */}
      {renderFloatingActionBar()}

      {/* Left Column: Avatar or Grouped Timestamp Gutter */}
      <div className="w-10 shrink-0 flex items-start justify-center pt-0.5 mr-3 select-none">
        {!isGrouped ? (
          <button
            type="button"
            onClick={handleAuthorClick}
            className="relative cursor-pointer rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500"
            title={isOwnMessage ? 'View your profile' : `View ${resolvedName}'s profile`}
          >
            {resolvedAvatar ? (
              <img
                src={resolvedAvatar}
                alt={isOwnMessage ? 'You' : resolvedName}
                className="h-10 w-10 rounded-full object-cover border border-slate-200/80 shadow-2xs hover:opacity-90 transition-opacity"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center font-bold text-sm shadow-2xs">
                {(isOwnMessage ? 'Y' : (resolvedName || 'C')).charAt(0).toUpperCase()}
              </div>
            )}
          </button>
        ) : (
          <span
            className="hidden group-hover:inline-block text-[10px] text-slate-400 font-mono tracking-tighter"
            title={displayFullDate}
          >
            {displayTime.replace(/\s?[AP]M/, '')}
          </span>
        )}
      </div>

      {/* Right Column: Author Header, Post Type, Markdown Content, Reactions */}
      <div className="flex-1 min-w-0 pr-2">
        {!isGrouped && (
          <div className="flex items-center gap-2 mb-1 leading-none flex-wrap">
            {/* Author Display Name */}
            <button
              type="button"
              onClick={handleAuthorClick}
              className="text-xs font-bold text-slate-900 hover:underline cursor-pointer truncate"
            >
              {isOwnMessage ? 'You' : resolvedName}
            </button>

            {/* Admin Badge — Only visible when an admin pins a message */}
            {isAuthorAdmin && isPinned && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 border border-purple-200 text-[10px] font-bold uppercase tracking-wider">
                <Shield className="h-2.5 w-2.5" />
                Admin
              </span>
            )}

            {/* Community Post Type Badge */}
            {typeConfig && (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider ${
                  typeConfig.bgColor || 'bg-slate-100'
                } ${typeConfig.textColor || 'text-slate-700'} border ${
                  typeConfig.borderColor || 'border-slate-200'
                }`}
              >
                <span>{typeConfig.icon}</span>
                <span>{typeConfig.label}</span>
              </span>
            )}

            {/* Featured / Pinned Badge */}
            {isPinned && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold uppercase tracking-wider shadow-2xs">
                <Pin className="h-2.5 w-2.5 text-amber-700 rotate-45" />
                Featured
              </span>
            )}

            {/* Timestamp */}
            <span
              className="text-[11px] text-slate-400 font-mono select-none"
              title={displayFullDate}
            >
              {displayTime}
            </span>
          </div>
        )}

        {/* Content Body: In-place edit or Discord Markdown */}
        {isEditing ? (
          <div className="mt-1 space-y-1.5">
            <textarea
              ref={editTextareaRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={handleEditKeyDown}
              className="w-full resize-none rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white leading-relaxed font-sans"
              rows={2}
            />
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span>
                escape to{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setEditContent(message.content || '');
                  }}
                  className="text-emerald-600 hover:underline cursor-pointer"
                >
                  cancel
                </button>
              </span>
              <span>•</span>
              <span>
                enter to{' '}
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={isSavingEdit || !editContent.trim()}
                  className="font-semibold text-emerald-600 hover:underline disabled:opacity-50 cursor-pointer"
                >
                  {isSavingEdit ? 'saving...' : 'save'}
                </button>
              </span>
            </div>
          </div>
        ) : (
          <div className="text-[13px] sm:text-sm text-slate-800 leading-relaxed break-words space-y-1">
            {message.deleted ? (
              <span className="inline-flex items-center gap-1.5 italic text-slate-400 text-xs bg-slate-50 border border-slate-200/60 rounded-md px-2 py-0.5 text-slate-500 font-medium select-none">
                <Trash2 className="h-3 w-3 opacity-60 text-slate-400" />
                <span>
                  {isOwnMessage
                    ? 'You deleted this discussion'
                    : message.deletedBy && message.deletedBy !== messageAuthorUid
                    ? 'Discussion deleted by Admin'
                    : `${resolvedName || 'Member'} deleted this discussion`}
                </span>
              </span>
            ) : (
              renderDiscordMarkdown(message.content)
            )}
          </div>
        )}

        {/* File Attachments & Voice Notes */}
        {!message.deleted && message.attachment && (
          <div className="pt-1.5 w-full max-w-md overflow-hidden">
            {message.attachment.isVoiceNote ||
            message.attachment.category === 'audio' ||
            message.attachment.mimeType?.startsWith('audio/') ? (
              <VoiceMessagePlayer
                audioUrl={message.attachment.url}
                duration={message.attachment.duration}
                waveform={message.attachment.waveform}
                isOwnMessage={isOwnMessage}
              />
            ) : (
              <ChatFileCard
                attachment={message.attachment}
                onOpenPreview={onOpenPreview || ((att) => att?.url && window.open(att.url, '_blank'))}
              />
            )}
          </div>
        )}

        {/* Reactions & Replies Summary Bar */}
        {renderReactionsSummary()}
      </div>

      {/* Reaction Participants Inspection Modal */}
      <ChatReactionParticipantsModal
        isOpen={Boolean(inspectReactionEmoji)}
        initialEmoji={inspectReactionEmoji || 'all'}
        reactions={reactions}
        currentUserId={currentUserId}
        onClose={() => setInspectReactionEmoji(null)}
        onToggleReaction={(emoji) => onToggleReaction(message.messageId, emoji)}
      />
    </div>
  );
}

CommunityDiscussionCard.propTypes = {
  message: PropTypes.shape({
    messageId: PropTypes.string,
    id: PropTypes.string,
    content: PropTypes.string,
    createdAt: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    senderId: PropTypes.string,
    authorId: PropTypes.string,
    senderName: PropTypes.string,
    authorName: PropTypes.string,
    senderAvatar: PropTypes.string,
    authorAvatar: PropTypes.string,
    senderUsername: PropTypes.string,
    authorUsername: PropTypes.string,
    postType: PropTypes.string,
    type: PropTypes.string,
    deleted: PropTypes.bool,
  }).isRequired,
  currentUserId: PropTypes.string,
  isAdmin: PropTypes.bool,
  reactions: PropTypes.object,
  replyCount: PropTypes.number,
  isGrouped: PropTypes.bool,
  isFirstInGroup: PropTypes.bool,
  isLastInGroup: PropTypes.bool,
  timeLabel: PropTypes.string,
  fullDateLabel: PropTypes.string,
  onOpenThread: PropTypes.func,
  onToggleReaction: PropTypes.func,
  onEditMessage: PropTypes.func,
  onDeleteMessage: PropTypes.func,
  onTurnIntoIdea: PropTypes.func,
  isHighlighted: PropTypes.bool,
  isSaved: PropTypes.bool,
  onToggleSave: PropTypes.func,
  isPinned: PropTypes.bool,
  onTogglePin: PropTypes.func,
  onOpenProfile: PropTypes.func,
  activeMenuMessageId: PropTypes.string,
  onSetActiveMenuMessageId: PropTypes.func,
  menuAnchorRect: PropTypes.object,
  onOpenMenu: PropTypes.func,
  onCloseMenu: PropTypes.func,
  onOpenPreview: PropTypes.func,
};
