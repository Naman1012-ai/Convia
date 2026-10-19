import React, { useState, useEffect, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  Pencil,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  Clock,
  Sparkles,
  Info,
  Loader2,
  X,
  SmilePlus,
  MessageSquare,
  MoreVertical,
  Pin,
  PinOff,
  CornerDownRight,
  Reply,
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { chatService } from '../../services/chatService';
import { ChatFileCard } from './ChatFileCard';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';
import { ChatReactionPicker } from './ChatReactionPicker';
import { ChatReactionParticipantsModal } from './ChatReactionParticipantsModal';
import {
  formatMessageTime,
  formatFullDateTime,
  formatReplyCountLabel,
} from '../../utils/chatFeedHelpers';
import { resolveMemberDisplayName } from '../../utils/memberIdentity';
import { renderDiscordMarkdown } from '../../utils/discordMarkdown';
import { extractMentions } from '../../utils/chatMentions';
import { useUserProfile } from '../../hooks/useUserProfile';

/**
 * Discord-style Community Chat Message Item for Convia.
 * Features full-width linear layout, grouping, role badges, interactive markdown,
 * hover action bar, in-line reply references, and pinned message indicators.
 */
function ChatMessageItemComponent({
  workspaceId,
  channelId = 'general',
  message,
  currentUserId,
  members = [],
  isWorkspaceAdmin = false,
  isGrouped = false,
  isFirstInGroup = false,
  isLastInGroup = false,
  isHighlighted = false,
  isTargetHighlighted = false,
  isPinned = false,
  timeLabel = '',
  fullDateLabel = '',
  activeMenuMessageId = null,
  onSetActiveMenuMessageId = null,
  reactions: reactionsProp,
  replyCount: replyCountProp,
  onEdit = () => {},
  onDelete = () => {},
  onDeleteMessage,
  onEditMessage,
  onPinMessage,
  onOpenPreview = () => {},
  onOpenThread = () => {},
  onToggleReaction = () => {},
  onSelectChannel = null,
  onReplyMessage = null,
  onOpenProfile = null,
}) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message?.content || '');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [reactionPickerSource, setReactionPickerSource] = useState(null); // 'floating' | 'footer' | null
  const [inspectReactionEmoji, setInspectReactionEmoji] = useState(null);

  const reactions = reactionsProp || {};
  const replyCount = replyCountProp || 0;

  const currentUserReactions = useMemo(() => {
    if (!currentUserId || !reactions || typeof reactions !== 'object') return [];
    return Object.entries(reactions)
      .filter(([_, data]) => Array.isArray(data?.users) && data.users.includes(currentUserId))
      .map(([emoji]) => emoji);
  }, [reactions, currentUserId]);

  const editTextareaRef = useRef(null);
  const menuRef = useRef(null);
  const menuButtonRef = useRef(null);

  const resolveDelete = onDeleteMessage || onDelete;
  const resolveEdit = onEditMessage || onEdit;

  // Single-active-menu coordination with parent or fallback to local state
  const [localMenuOpen, setLocalMenuOpen] = useState(false);
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

  // Close menu on click outside or Escape key
  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (e) => {
      if (menuButtonRef.current && menuButtonRef.current.contains(e.target)) return;
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  const isOwnMessage = Boolean(
    currentUserId && (message.senderId === currentUserId || message.authorId === currentUserId)
  );

  // Resolve sender member from workspace member directory
  const senderMember = Array.isArray(members)
    ? members.find((m) => m && (m.uid === message.senderId || m.id === message.senderId))
    : null;

  const canDelete = !message.deleted && (isOwnMessage || isWorkspaceAdmin);
  const canEdit = isOwnMessage && !message.deleted && !message.isSystem;
  const canReply = !message.deleted && !message.isSystem;
  const canReact = !message.deleted && !message.isSystem;
  const canPin = !message.deleted && !message.isSystem;

  // User profile resolution
  const fallbackAvatarCandidate = senderMember
    ? (senderMember.avatar || senderMember.photoURL || '')
    : (message.senderAvatar || '');

  const {
    displayName: liveDisplayName,
    avatar: liveAvatar,
    profile: liveProfile,
  } = useUserProfile(message.senderId, {
    subscribe: false,
    fallbackName: senderMember
      ? resolveMemberDisplayName(senderMember)
      : resolveMemberDisplayName(message.senderName || 'Member'),
    fallbackAvatar: fallbackAvatarCandidate,
  });

  const senderDisplayName = liveDisplayName;
  const isProfileLoaded = Boolean(liveProfile || senderMember);
  const senderAvatar = isProfileLoaded
    ? (liveAvatar || (senderMember ? (senderMember.avatar || senderMember.photoURL || '') : ''))
    : (liveAvatar || message.senderAvatar || '');
  const memberProfile = liveProfile || senderMember;

  // Detect whether current user is mentioned in this message
  const isUserMentioned = useMemo(() => {
    if (!currentUserId || !message?.content || message?.isSystem) return false;
    const mentions = extractMentions(message.content, members);
    return mentions.some((m) => m.uid === currentUserId);
  }, [message?.content, members, currentUserId, message?.isSystem]);

  // Auto-focus and resize textarea when entering edit mode
  useEffect(() => {
    if (isEditing && editTextareaRef.current) {
      editTextareaRef.current.focus();
      editTextareaRef.current.style.height = 'auto';
      editTextareaRef.current.style.height = `${editTextareaRef.current.scrollHeight}px`;
    }
  }, [isEditing]);

  const handleCopy = () => {
    if (message.content) {
      navigator.clipboard?.writeText?.(message.content);
      setCopied(true);
      toast.success('Message copied to clipboard.');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveEdit = async (e) => {
    if (e) e.preventDefault();
    const cleanContent = editContent.trim();
    if (!cleanContent) {
      toast.error('Message content cannot be empty.');
      return;
    }

    if (cleanContent === message.content) {
      setIsEditing(false);
      return;
    }

    try {
      setIsSavingEdit(true);
      await (resolveEdit || onEdit)(message.messageId, cleanContent);
      setIsEditing(false);
    } catch (err) {
      console.error('[ChatMessageItem] Edit failure:', err);
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

  const handlePinToggle = async () => {
    if (onPinMessage) {
      onPinMessage(message);
      return;
    }

    if (!workspaceId || !channelId) return;

    try {
      if (isPinned || message.isPinned) {
        await chatService.unpinMessage(workspaceId, channelId, message.messageId);
        toast.success('Message unpinned.');
      } else {
        await chatService.pinMessage(workspaceId, channelId, message, {
          uid: currentUserId,
          displayName: senderDisplayName || 'Member',
        });
        toast.success('Message pinned to channel.');
      }
    } catch (err) {
      console.error('[ChatMessageItem] Pin toggle error:', err);
      toast.error('Failed to update pinned state.');
    }
  };

  const displayTime = timeLabel || formatMessageTime(message.createdAt);
  const displayFullDate = fullDateLabel || formatFullDateTime(message.createdAt);
  const isMessageHighlighted = Boolean(isHighlighted || isTargetHighlighted);

  // 1. Render System Event Messages
  if (message.isSystem) {
    return (
      <div className="flex items-center justify-center my-2 px-4" role="status">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100/90 border border-slate-200/80 text-xs font-medium text-slate-600 shadow-2xs">
          <Info className="h-3.5 w-3.5 text-primary-500 shrink-0" aria-hidden="true" />
          <span className="font-normal text-slate-700">{message.content}</span>
          <span className="text-[11px] text-slate-400 font-mono" title={displayFullDate}>
            • {displayTime}
          </span>
        </div>
      </div>
    );
  }

  // 2. Render Soft-Deleted Message Tombstone
  if (message.deleted) {
    const isDeletedByAdmin = message.deletedBy && message.deletedBy !== message.senderId;
    const deletedLabel = isOwnMessage
      ? 'You deleted this message'
      : isDeletedByAdmin
      ? 'Message deleted by Admin'
      : `${senderDisplayName || 'Member'} deleted a message`;

    return (
      <div
        id={`msg_${message.messageId}`}
        className="flex w-full py-1 px-4 text-xs italic text-slate-400 gap-3 items-center select-none"
      >
        <div className="w-10 shrink-0 flex justify-center">
          <Trash2 className="h-3.5 w-3.5 opacity-50 text-slate-400" />
        </div>
        <span className="bg-slate-50 border border-slate-200/60 rounded-md px-2 py-0.5 text-slate-500 font-medium">
          {deletedLabel}
        </span>
        <span className="text-[10px] font-mono opacity-60" title={displayFullDate}>
          {displayTime}
        </span>
      </div>
    );
  }

  // Helper: Floating Discord Row Action Bar
  const renderFloatingActionBar = () => {
    if (isEditing) return null;

    return (
      <div
        ref={menuButtonRef}
        className={`absolute -top-3.5 right-4 z-20 items-center bg-white border border-slate-200 rounded-lg shadow-sm px-1 py-0.5 gap-0.5 transition-opacity ${
          isMenuOpen || showMobileActions
            ? 'flex opacity-100'
            : 'hidden group-hover:flex group-focus-within:flex opacity-100'
        }`}
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

        {/* Reply in Thread / Quick Reply */}
        {canReply && (
          <button
            type="button"
            onClick={() => onOpenThread(message)}
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Reply in thread"
            aria-label="Reply in thread"
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Pin / Unpin message */}
        {canPin && (
          <button
            type="button"
            onClick={handlePinToggle}
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
              isPinned || message.isPinned
                ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
            title={isPinned || message.isPinned ? 'Unpin message' : 'Pin message'}
            aria-label={isPinned || message.isPinned ? 'Unpin message' : 'Pin message'}
          >
            {isPinned || message.isPinned ? (
              <PinOff className="h-3.5 w-3.5" />
            ) : (
              <Pin className="h-3.5 w-3.5 fill-current" />
            )}
          </button>
        )}

        {/* Edit Message (Author Only) */}
        {canEdit && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Edit message"
            aria-label="Edit message"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Delete Message (Author or Workspace Admin) */}
        {canDelete && (
          <button
            type="button"
            onClick={() => (resolveDelete || onDelete)(message.messageId)}
            className="p-1.5 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
            title="Delete message"
            aria-label="Delete message"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}

        {/* More Options Trigger */}
        <button
          type="button"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={`p-1.5 rounded-md transition-colors cursor-pointer ${
            isMenuOpen
              ? 'bg-slate-100 text-slate-900'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
          }`}
          title="More options"
          aria-label="More options"
          aria-haspopup="true"
          aria-expanded={isMenuOpen}
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </button>

        {/* Three-Dot Contextual Dropdown */}
        {isMenuOpen && (
          <div
            ref={menuRef}
            className="absolute right-0 top-full mt-1 z-30 min-w-[150px] rounded-xl border border-slate-200 bg-white p-1 shadow-lg transition-all"
            role="menu"
            aria-label="Message context menu"
          >
            {/* Copy Message Text */}
            {message.content && (
              <button
                type="button"
                onClick={() => {
                  handleCopy();
                  setIsMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                role="menuitem"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-slate-500" />
                )}
                <span>{copied ? 'Copied' : 'Copy Text'}</span>
              </button>
            )}

            {/* Quick Reply callback if supported */}
            {onReplyMessage && canReply && (
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onReplyMessage(message);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                role="menuitem"
              >
                <Reply className="h-3.5 w-3.5 text-slate-500" />
                <span>Quote Reply</span>
              </button>
            )}

            {/* Pin Toggle in Menu */}
            {canPin && (
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  handlePinToggle();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                role="menuitem"
              >
                {isPinned || message.isPinned ? (
                  <PinOff className="h-3.5 w-3.5 text-amber-600" />
                ) : (
                  <Pin className="h-3.5 w-3.5 text-slate-500" />
                )}
                <span>{isPinned || message.isPinned ? 'Unpin Message' : 'Pin Message'}</span>
              </button>
            )}

            {/* Edit Message (Author Only) */}
            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsEditing(true);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-primary-600 transition-colors cursor-pointer"
                role="menuitem"
              >
                <Pencil className="h-3.5 w-3.5 text-slate-500" />
                <span>Edit</span>
              </button>
            )}

            {/* Delete Message (Author or Workspace Admin) */}
            {canDelete && (
              <>
                <div className="my-0.5 border-t border-slate-100" />
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    (resolveDelete || onDelete)(message.messageId);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  role="menuitem"
                >
                  <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                  <span>Delete</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  // Helper: Reaction Chips & Thread Replies Row
  const renderReactionsAndReplies = () => {
    if (message.deleted) return null;
    const hasReactions = Object.keys(reactions).length > 0;
    const hasReplies = replyCount > 0;
    if (!hasReactions && !hasReplies && !canReact && !canReply) return null;

    return (
      <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
        {Object.entries(reactions).map(([emoji, reactionData]) => {
          const hasReacted = reactionData.users?.includes(currentUserId);
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => onToggleReaction(message.messageId, emoji)}
              onContextMenu={(e) => {
                e.preventDefault();
                setInspectReactionEmoji(emoji);
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs transition-all cursor-pointer select-none ${
                hasReacted
                  ? 'bg-primary-50 border border-primary-300 text-primary-800 font-bold shadow-2xs hover:bg-primary-100'
                  : 'bg-slate-100 hover:bg-slate-200/80 border border-slate-200/70 text-slate-700 font-medium'
              }`}
              title={`${hasReacted ? 'Click to remove reaction' : 'Click to react'} • Right-click or click count to view participants (${reactionData.count})`}
              aria-label={`${emoji} reaction, ${reactionData.count} count`}
            >
              <span className="text-sm leading-none">{emoji}</span>
              <span
                className="text-[11px] font-mono hover:underline cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setInspectReactionEmoji(emoji);
                }}
                title="View who reacted"
              >
                {reactionData.count}
              </span>
            </button>
          );
        })}

        {/* Quick Add Reaction Button in Footer */}
        {canReact && (
          <div className="relative">
            <button
              type="button"
              onClick={() =>
                setReactionPickerSource((prev) => (prev === 'footer' ? null : 'footer'))
              }
              className={`p-1 rounded-full hover:bg-slate-100 focus:outline-none transition-colors cursor-pointer ${
                reactionPickerSource === 'footer'
                  ? 'bg-slate-200 text-slate-800'
                  : 'text-slate-400 hover:text-slate-600'
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

        {/* Thread Discussion Pill */}
        {hasReplies && (
          <button
            type="button"
            onClick={() => onOpenThread(message)}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-primary-50 text-primary-700 font-bold border border-primary-200/80 shadow-2xs hover:bg-primary-100 transition-all cursor-pointer"
            title={`${formatReplyCountLabel(replyCount)} - Click to open discussion thread`}
            aria-label={`Reply in thread, ${formatReplyCountLabel(replyCount)}`}
          >
            <MessageSquare className="h-3 w-3" />
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
      onFocus={() => setShowMobileActions(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setShowMobileActions(false);
        }
      }}
      className={`group relative flex w-full transition-all duration-700 ease-out ${
        isGrouped ? 'py-0.5' : 'pt-2 pb-1 mt-1'
      } px-4 hover:bg-slate-50/80 ${
        isMessageHighlighted
          ? 'bg-primary-500/15 ring-2 ring-primary-500/50 shadow-sm rounded-lg'
          : isUserMentioned
          ? 'bg-amber-500/5 border-l-2 border-amber-500'
          : ''
      }`}
    >
      {/* Floating Action Bar */}
      {renderFloatingActionBar()}

      {/* In-Line Reply Reference Banner (if message replies to another) */}
      {message.replyTo && !isGrouped && (
        <div className="absolute -top-3.5 left-14 flex items-center gap-1.5 text-[11px] text-slate-500 select-none">
          <CornerDownRight className="h-3 w-3 text-slate-400" />
          <span className="font-semibold text-slate-600">
            @{message.replyTo.senderName || 'Member'}
          </span>
          <span className="truncate max-w-[200px] text-slate-400">
            {message.replyTo.content || 'Attachment'}
          </span>
        </div>
      )}

      {/* Left Column: Avatar or Hover Timestamp Gutter */}
      <div className="w-10 shrink-0 flex items-start justify-center pt-0.5 mr-3 select-none">
        {!isGrouped ? (
          <button
            type="button"
            onClick={() => onOpenProfile?.(memberProfile || senderMember)}
            className="relative cursor-pointer rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500"
            title={isOwnMessage ? 'View your profile' : `View ${senderDisplayName}'s profile`}
          >
            {senderAvatar ? (
              <img
                src={senderAvatar}
                alt={isOwnMessage ? 'You' : senderDisplayName}
                className="h-10 w-10 rounded-full object-cover border border-slate-200/80 shadow-2xs hover:opacity-90 transition-opacity"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary-600 to-indigo-700 text-white flex items-center justify-center font-bold text-sm shadow-2xs">
                {(isOwnMessage ? 'Y' : (senderDisplayName || 'M')).charAt(0).toUpperCase()}
              </div>
            )}
            {senderMember && (
              <span
                className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${
                  senderMember.onlineStatus === 'online' ? 'bg-emerald-500 shadow-2xs' : 'bg-slate-400'
                }`}
                title={senderMember.onlineStatus === 'online' ? 'Online' : 'Offline'}
              />
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

      {/* Right Column: Author Header, Body, Markdown, Files, Reactions */}
      <div className="flex-1 min-w-0 pr-2">
        {!isGrouped && (
          <div className="flex items-center gap-2 mb-1 leading-none">
            <button
              type="button"
              onClick={() => onOpenProfile?.(memberProfile || senderMember)}
              className="text-xs font-bold text-slate-900 hover:underline cursor-pointer truncate"
            >
              {isOwnMessage ? 'You' : senderDisplayName}
            </button>

            {/* Timestamp */}
            <span
              className="text-[11px] text-slate-400 font-mono select-none"
              title={displayFullDate}
            >
              {displayTime}
            </span>

            {/* Pinned Badge */}
            {(isPinned || message.isPinned) && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 select-none bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200/60"
                title="Pinned message"
              >
                <Pin className="h-2.5 w-2.5 fill-current" />
                <span>Pinned</span>
              </span>
            )}
          </div>
        )}

        {/* Message Content or Edit Input */}
        {isEditing ? (
          <form onSubmit={handleSaveEdit} className="space-y-2 mt-1 max-w-2xl">
            <div className="relative">
              <textarea
                ref={editTextareaRef}
                value={editContent}
                onChange={(e) => {
                  setEditContent(e.target.value.substring(0, 2000));
                  e.target.style.height = 'auto';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                onKeyDown={handleEditKeyDown}
                rows={2}
                disabled={isSavingEdit}
                className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-inner resize-none leading-relaxed"
                aria-label="Edit message content"
              />
              <span className="absolute bottom-2 right-2.5 text-[10px] font-mono text-slate-400">
                {editContent.length}/2000
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                type="submit"
                disabled={isSavingEdit || !editContent.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:bg-primary-300 text-white font-bold text-xs transition-colors shadow-2xs"
              >
                {isSavingEdit ? (
                  <>
                    <Loader2 className="animate-spin h-3.5 w-3.5" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setEditContent(message.content || '');
                }}
                disabled={isSavingEdit}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition-colors"
              >
                Cancel
              </button>
              <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                Enter to save, Esc to cancel
              </span>
            </div>
          </form>
        ) : (
          <div className="text-xs text-slate-900 leading-relaxed font-normal">
            {message.content &&
              renderDiscordMarkdown(message.content, {
                members,
                currentUserId,
                onSelectChannel,
              })}

            {message.editedAt && (
              <span
                className="text-[10px] text-slate-400 italic ml-1 cursor-help select-none"
                title={`Edited at ${formatFullDateTime(message.editedAt)}`}
              >
                (edited)
              </span>
            )}
          </div>
        )}

        {/* File Attachments & Voice Notes */}
        {message.attachment && (
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
              <ChatFileCard attachment={message.attachment} onOpenPreview={onOpenPreview} />
            )}
          </div>
        )}

        {/* Reactions and Reply Counts */}
        {renderReactionsAndReplies()}
      </div>

      {/* Reaction Participants Inspection Modal */}
      <ChatReactionParticipantsModal
        isOpen={Boolean(inspectReactionEmoji)}
        initialEmoji={inspectReactionEmoji || 'all'}
        reactions={reactions}
        members={members}
        currentUserId={currentUserId}
        onClose={() => setInspectReactionEmoji(null)}
        onToggleReaction={(emoji) => onToggleReaction(message.messageId, emoji)}
      />
    </div>
  );
}

function areMessagePropsEqual(prev, next) {
  // 1. If message ID differs, must re-render
  if (prev.message?.messageId !== next.message?.messageId) return false;

  // 2. If content, edited timestamp, deleted, pinned, or status changed
  if (prev.message?.content !== next.message?.content) return false;
  if (prev.message?.editedAt !== next.message?.editedAt) return false;
  if (prev.message?.deleted !== next.message?.deleted) return false;
  if (prev.message?.status !== next.message?.status) return false;

  // 3. Layout & Highlight changes
  if (prev.isGrouped !== next.isGrouped) return false;
  if (prev.isHighlighted !== next.isHighlighted) return false;
  if (prev.isTargetHighlighted !== next.isTargetHighlighted) return false;
  if (prev.isPinned !== next.isPinned) return false;
  if (prev.isWorkspaceAdmin !== next.isWorkspaceAdmin) return false;
  if (prev.currentUserId !== next.currentUserId) return false;

  // 4. Active contextual menu state
  const prevWasOpen = prev.activeMenuMessageId === prev.message?.messageId;
  const nextIsOpen = next.activeMenuMessageId === next.message?.messageId;
  if (prevWasOpen !== nextIsOpen) return false;

  // 5. Reply count
  if (prev.replyCount !== next.replyCount) return false;

  // 6. Reactions comparison
  if (prev.reactions !== next.reactions) {
    const prevKeys = Object.keys(prev.reactions || {});
    const nextKeys = Object.keys(next.reactions || {});
    if (prevKeys.length !== nextKeys.length) return false;
    for (const key of prevKeys) {
      if (prev.reactions[key]?.count !== next.reactions[key]?.count) return false;
      const prevHasMe = prev.reactions[key]?.users?.includes(prev.currentUserId);
      const nextHasMe = next.reactions[key]?.users?.includes(next.currentUserId);
      if (prevHasMe !== nextHasMe) return false;
    }
  }

  // 7. Members roster length
  if (prev.members?.length !== next.members?.length) return false;

  // 8. Action handler references
  if (prev.onPinMessage !== next.onPinMessage) return false;

  return true;
}

export const ChatMessageItem = React.memo(ChatMessageItemComponent, areMessagePropsEqual);

ChatMessageItem.propTypes = {
  workspaceId: PropTypes.string,
  channelId: PropTypes.string,
  message: PropTypes.shape({
    messageId: PropTypes.string.isRequired,
    senderId: PropTypes.string,
    senderName: PropTypes.string,
    senderAvatar: PropTypes.string,
    senderRole: PropTypes.string,
    content: PropTypes.string,
    createdAt: PropTypes.number,
    editedAt: PropTypes.number,
    deleted: PropTypes.bool,
    isSystem: PropTypes.bool,
    isPinned: PropTypes.bool,
    replyTo: PropTypes.object,
    attachment: PropTypes.object,
  }).isRequired,
  currentUserId: PropTypes.string,
  members: PropTypes.array,
  isWorkspaceAdmin: PropTypes.bool,
  isGrouped: PropTypes.bool,
  isFirstInGroup: PropTypes.bool,
  isLastInGroup: PropTypes.bool,
  isHighlighted: PropTypes.bool,
  isTargetHighlighted: PropTypes.bool,
  isPinned: PropTypes.bool,
  timeLabel: PropTypes.string,
  fullDateLabel: PropTypes.string,
  activeMenuMessageId: PropTypes.string,
  onSetActiveMenuMessageId: PropTypes.func,
  reactions: PropTypes.object,
  replyCount: PropTypes.number,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  onEditMessage: PropTypes.func,
  onDeleteMessage: PropTypes.func,
  onPinMessage: PropTypes.func,
  onOpenPreview: PropTypes.func,
  onOpenThread: PropTypes.func,
  onToggleReaction: PropTypes.func,
  onSelectChannel: PropTypes.func,
  onReplyMessage: PropTypes.func,
  onOpenProfile: PropTypes.func,
};

