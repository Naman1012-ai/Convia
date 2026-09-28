import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  MessageCircle,
  MoreVertical,
  Pencil,
  Trash2,
  Copy,
  Check,
  Sparkles,
  SmilePlus,
  Loader2,
  X,
  Lightbulb,
  Bookmark,
  BookmarkCheck,
  Pin,
} from 'lucide-react';
import { ChatReactionPicker } from '../chat/ChatReactionPicker';
import { ChatReactionParticipantsModal } from '../chat/ChatReactionParticipantsModal';
import {
  COMMUNITY_POST_TYPES,
  COMMUNITY_POST_TYPE_CONFIG,
} from '../../constants/chatSchema';
import {
  formatMessageTime,
  formatFullDateTime,
  formatReplyCountLabel,
} from '../../utils/chatFeedHelpers';
import { useToast } from '../../hooks/useToast';
import { useUserProfile } from '../../hooks/useUserProfile';
import { ContextMenuPortal } from '../../components/ui/ContextMenuPortal';
import {
  resolveMemberDisplayName,
  isMessageAuthoredByUser,
  getMessageAuthorUid,
} from '../../utils/memberIdentity';

export function CommunityDiscussionCard({
  message,
  currentUserId = null,
  isAdmin = false,
  reactions = {},
  replyCount = 0,
  isGrouped = false,
  isFirstInGroup = true,
  isLastInGroup = true,
  timeLabel = '',
  fullDateLabel = '',
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
  activeMenuMessageId = null,
  menuAnchorRect = null,
  onOpenMenu = null,
  onCloseMenu = null,
  onSetActiveMenuMessageId = null,
}) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content || '');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isReactionPickerOpen, setIsReactionPickerOpen] = useState(false);
  const [inspectReactionEmoji, setInspectReactionEmoji] = useState(null);

  // Single-active-menu coordination with parent or fallback to local state
  const [localMenuOpen, setLocalMenuOpen] = useState(false);
  const [localAnchorRect, setLocalAnchorRect] = useState(null);

  const isMenuOpen = onOpenMenu
    ? activeMenuMessageId === message.messageId
    : onSetActiveMenuMessageId
    ? activeMenuMessageId === message.messageId
    : localMenuOpen;

  const currentAnchorRect = onOpenMenu
    ? (activeMenuMessageId === message.messageId ? menuAnchorRect : null)
    : localAnchorRect;

  const handleCloseThisMenu = () => {
    if (onCloseMenu) onCloseMenu();
    else if (onSetActiveMenuMessageId) onSetActiveMenuMessageId(null);
    else setLocalMenuOpen(false);
  };

  const handleToggleMenu = (e) => {
    e.stopPropagation();
    if (isMenuOpen) {
      handleCloseThisMenu();
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const buttonRect = {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
      };
      if (onOpenMenu) {
        onOpenMenu(message.messageId, buttonRect);
      } else {
        if (onSetActiveMenuMessageId) onSetActiveMenuMessageId(message.messageId);
        setLocalAnchorRect(buttonRect);
        setLocalMenuOpen(true);
      }
    }
  };

  const setIsMenuOpen = (open) => {
    if (open) {
      if (menuButtonRef.current) {
        const rect = menuButtonRef.current.getBoundingClientRect();
        const buttonRect = {
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height,
        };
        if (onOpenMenu) onOpenMenu(message.messageId, buttonRect);
        else {
          if (onSetActiveMenuMessageId) onSetActiveMenuMessageId(message.messageId);
          setLocalAnchorRect(buttonRect);
          setLocalMenuOpen(true);
        }
      }
    } else {
      handleCloseThisMenu();
    }
  };

  const menuButtonRef = useRef(null);
  const editTextareaRef = useRef(null);

  // Real-time user profile resolution using canonical author UID
  const messageAuthorUid = getMessageAuthorUid(message) || message.senderId;
  const { displayName: resolvedName, avatar: resolvedAvatar } = useUserProfile(
    messageAuthorUid,
    {
      subscribe: false,
      fallbackName: resolveMemberDisplayName(message.senderName || message.authorName || 'Community Member'),
      fallbackAvatar: message.senderAvatar || message.authorAvatar || '',
    }
  );

  // Message ownership strictly verified by authenticated canonical UID
  const isOwnMessage = Boolean(
    currentUserId && isMessageAuthoredByUser(message, currentUserId)
  );

  const canEdit = isOwnMessage && !message.deleted;
  const canDelete = !message.deleted && (isOwnMessage || isAdmin);
  const canReply = !message.deleted;
  const canReact = !message.deleted;

  const postType = message.postType || null;
  const typeConfig = postType ? COMMUNITY_POST_TYPE_CONFIG[postType] : null;

  const displayTime = timeLabel || formatMessageTime(message.createdAt);
  const displayFullDate = fullDateLabel || formatFullDateTime(message.createdAt);

  const handleCopyText = async () => {
    try {
      const textToCopy = (message.content || '').trim();
      if (!textToCopy) return;
      await navigator.clipboard.writeText(textToCopy);
      setCopiedText(true);
      toast.success('Text copied to clipboard.');
      setTimeout(() => setCopiedText(false), 2000);
      setIsMenuOpen(false);
    } catch {
      toast.error('Failed to copy text.');
    }
  };

  const handleCopyLink = async () => {
    try {
      const targetId = message.messageId;
      const url = `${window.location.origin}/community?messageId=${encodeURIComponent(targetId)}`;
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      toast.success('Link copied to clipboard.');
      setTimeout(() => setCopiedLink(false), 2000);
      setIsMenuOpen(false);
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

  const renderContentWithLinks = (text, isOwn) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={`${
              isOwn
                ? 'text-indigo-200 underline font-semibold hover:text-white'
                : 'text-indigo-600 underline font-semibold hover:text-indigo-800'
            } break-all`}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  // 1. Soft-Deleted Message Tombstone
  if (message.deleted) {
    return (
      <div
        id={`msg_${message.messageId}`}
        className={`flex w-full px-2 sm:px-4 ${isGrouped ? 'my-0.5' : 'my-1.5'} ${
          isOwnMessage ? 'justify-end' : 'justify-start'
        }`}
      >
        <div
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-2xl text-xs italic ${
            isOwnMessage
              ? 'bg-slate-100/90 text-slate-400 border border-slate-200/80 rounded-tr-xs'
              : 'bg-slate-100/90 text-slate-400 border border-slate-200/80 rounded-tl-xs'
          }`}
        >
          <Trash2 className="h-3 w-3 opacity-60" />
          <span>This discussion was deleted</span>
          <span className="text-[10px] font-mono opacity-60" title={displayFullDate}>
            • {displayTime}
          </span>
          {isSaved && (
            <button
              type="button"
              onClick={() => onToggleSave(message)}
              className="ml-2 not-italic text-[10px] text-amber-700 hover:text-amber-900 font-semibold underline cursor-pointer"
            >
              Remove from Saved
            </button>
          )}
        </div>
      </div>
    );
  }

  // Helper: Action Toolbar on Hover & Mobile
  const renderActionToolbar = (isOwn) => {
    if (isEditing) return null;

    return (
      <div
        className={`absolute -top-3.5 z-20 items-center justify-center transition-all ${
          isOwn ? 'right-1 sm:right-2' : 'left-1 sm:left-2'
        } ${isMenuOpen ? 'flex' : 'hidden sm:group-hover:flex sm:group-focus-within:flex max-sm:flex'}`}
      >
        <button
          ref={menuButtonRef}
          type="button"
          onClick={handleToggleMenu}
          className={`h-6 w-6 rounded-full bg-white/95 backdrop-blur-xs border border-slate-200 shadow-xs flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer ${
            isMenuOpen ? 'ring-2 ring-indigo-500 text-indigo-600 bg-white shadow-sm' : ''
          }`}
          title="More actions"
          aria-label="More actions"
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </button>

        {/* Portal-based Floating Context Menu */}
        <ContextMenuPortal
          isOpen={isMenuOpen}
          onClose={handleCloseThisMenu}
          anchorRect={currentAnchorRect}
          triggerRef={menuButtonRef}
          align={isOwn ? 'right' : 'left'}
          title="Discussion Actions"
        >
          {/* Copy Link */}
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex w-full items-center gap-2.5 rounded-xl sm:rounded-lg px-3 sm:px-2.5 py-2.5 sm:py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
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
              className="flex w-full items-center gap-2.5 rounded-xl sm:rounded-lg px-3 sm:px-2.5 py-2.5 sm:py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
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
              setIsMenuOpen(false);
              onTurnIntoIdea(message);
            }}
            className="flex w-full items-center gap-2.5 rounded-xl sm:rounded-lg px-3 sm:px-2.5 py-2.5 sm:py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 transition-colors cursor-pointer"
            role="menuitem"
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
            <span>Turn into Idea</span>
          </button>

          {/* Save / Bookmark Discussion */}
          {currentUserId && (
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                onToggleSave(message);
              }}
              className="flex w-full items-center gap-2.5 rounded-xl sm:rounded-lg px-3 sm:px-2.5 py-2.5 sm:py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
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
                setIsMenuOpen(false);
                onTogglePin(message);
              }}
              className="flex w-full items-center gap-2.5 rounded-xl sm:rounded-lg px-3 sm:px-2.5 py-2.5 sm:py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer"
              role="menuitem"
            >
              <Pin className={`h-3.5 w-3.5 text-amber-600 shrink-0 ${isPinned ? 'rotate-0' : 'rotate-45'}`} />
              <span>{isPinned ? 'Unpin Discussion' : 'Pin to Top'}</span>
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
              className="flex w-full items-center gap-2.5 rounded-xl sm:rounded-lg px-3 sm:px-2.5 py-2.5 sm:py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-indigo-600 transition-colors cursor-pointer"
              role="menuitem"
            >
              <Pencil className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>Edit</span>
            </button>
          )}

          {/* Delete Message (Author or Admin) */}
          {canDelete && (
            <>
              <div className="my-1 border-t border-slate-100" />
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onDeleteMessage(message);
                }}
                className="flex w-full items-center gap-2.5 rounded-xl sm:rounded-lg px-3 sm:px-2.5 py-2.5 sm:py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                role="menuitem"
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                <span>Delete</span>
              </button>
            </>
          )}
        </ContextMenuPortal>
      </div>
    );
  };

  // Helper: Reaction Chips, Reply Button & Contextual Actions
  const renderReactionsAndReplies = (isOwn) => {
    const hasReactions = Object.keys(reactions).some(
      (k) => reactions[k]?.count > 0
    );
    const hasReplies = replyCount > 0;
    if (!hasReactions && !hasReplies && !canReact && !canReply) return null;

    return (
      <div
        className={`flex flex-wrap items-center gap-1.5 pt-1 ${
          isOwn ? 'justify-end' : 'justify-start'
        }`}
      >
        {/* Reaction Chips */}
        {Object.entries(reactions).map(([emoji, data]) => {
          if (!data || !data.count || data.count <= 0) return null;
          const hasUserReacted =
            currentUserId &&
            Array.isArray(data.users) &&
            data.users.includes(currentUserId);

          return (
            <button
              key={emoji}
              type="button"
              onClick={() => onToggleReaction(message.messageId, emoji)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all cursor-pointer select-none ${
                hasUserReacted
                  ? 'bg-indigo-100 border border-indigo-300 text-indigo-800 font-bold shadow-2xs hover:bg-indigo-200/70'
                  : 'bg-slate-100/90 hover:bg-slate-200/90 border border-slate-200/70 text-slate-700 font-medium'
              }`}
              title={`React with ${emoji} (${data.count})`}
              aria-label={`${emoji} reaction, ${data.count} count`}
            >
              <span>{emoji}</span>
              <span className="text-[11px] font-mono">{data.count}</span>
            </button>
          );
        })}

        {/* Quick Add Reaction Button */}
        {canReact && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsReactionPickerOpen((prev) => !prev)}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
              title="Add reaction"
              aria-label="Add emoji reaction"
            >
              <SmilePlus className="h-3.5 w-3.5" />
            </button>

            {isReactionPickerOpen && (
              <ChatReactionPicker
                isOpen={true}
                align={isOwn ? 'right' : 'left'}
                onSelectReaction={(emoji) => {
                  onToggleReaction(message.messageId, emoji);
                  setIsReactionPickerOpen(false);
                }}
                onClose={() => setIsReactionPickerOpen(false)}
              />
            )}
          </div>
        )}

        {/* Thread Reply Button */}
        {canReply && (
          <button
            type="button"
            onClick={() => onOpenThread(message)}
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all ${
              replyCount > 0
                ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200/80 shadow-2xs hover:bg-indigo-100 hover:text-indigo-800'
                : 'bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200/60 text-slate-600'
            }`}
            title={
              replyCount > 0
                ? `${formatReplyCountLabel(replyCount)} - Click to open discussion thread`
                : 'Reply in thread'
            }
            aria-label={`Reply in thread, ${formatReplyCountLabel(replyCount)}`}
          >
            <MessageCircle className="h-3 w-3" />
            <span>{formatReplyCountLabel(replyCount)}</span>
          </button>
        )}

        {/* Contextual Idea indicator/action for idea post types */}
        {postType === 'idea' && (
          <button
            type="button"
            onClick={() => onTurnIntoIdea(message)}
            className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/60 transition-colors"
            title="Create an official proposal from this idea"
          >
            <Lightbulb className="h-2.5 w-2.5 text-amber-600" />
            <span>Propose</span>
          </button>
        )}
      </div>
    );
  };

  // Main Render: Own Message (Right) vs Other User Message (Left)
  return (
    <div
      id={`msg_${message.messageId}`}
      tabIndex={0}
      className={`group relative flex w-full px-2 sm:px-4 transition-all duration-200 ${
        isGrouped ? 'my-0.5' : 'mt-3 mb-1'
      } ${isOwnMessage ? 'justify-end' : 'justify-start'} ${
        isHighlighted
          ? 'bg-indigo-50/70 ring-2 ring-indigo-500 rounded-2xl py-1.5'
          : isPinned
          ? 'bg-amber-50/40 rounded-2xl py-1 border border-amber-200/50'
          : ''
      }`}
    >
      {isOwnMessage ? (
        /* ======================================================== */
        /* CURRENT USER (OWN MESSAGE) — RIGHT-ALIGNED              */
        /* ======================================================== */
        <div className="relative flex flex-col items-end max-w-[88%] sm:max-w-[78%] lg:max-w-[70%]">
          {/* Header above bubble (only shown on first message of a group) */}
          {!isGrouped && (
            <div className="flex items-center justify-end gap-1.5 mb-1 px-1 flex-wrap">
              {isPinned && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100/90 border border-amber-300 text-[10px] font-bold uppercase tracking-wider text-amber-900 shadow-2xs">
                  <Pin className="h-2.5 w-2.5 text-amber-700 rotate-45" />
                  Featured
                </span>
              )}
              <span className="text-xs font-bold text-indigo-700">You</span>
              {typeConfig && (
                <>
                  <span className="text-slate-300 text-xs font-mono">•</span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                    <span>{typeConfig.icon}</span>
                    <span>{typeConfig.label}</span>
                  </span>
                </>
              )}
              <span className="text-slate-300 text-xs font-mono">•</span>
              <span
                className="text-[10px] text-slate-400 font-mono"
                title={displayFullDate}
              >
                {displayTime}
              </span>
            </div>
          )}

          {/* Main Bubble Wrapper with relative anchor */}
          <div className="relative group/bubble flex flex-col items-end">
            {renderActionToolbar(true)}

            {/* Bubble */}
            <div
              className={`relative rounded-2xl rounded-tr-xs bg-indigo-600 text-white shadow-xs px-3.5 py-2.5 space-y-1 ${
                isHighlighted ? 'ring-2 ring-indigo-300' : ''
              }`}
            >
              {isEditing ? (
                <form
                  onSubmit={handleSaveEdit}
                  className="space-y-2 min-w-[240px] max-w-md"
                >
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
                      className="w-full rounded-xl border border-indigo-300 bg-white p-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 shadow-inner resize-none leading-relaxed"
                      aria-label="Edit discussion content"
                    />
                    <span className="absolute bottom-2 right-2.5 text-[10px] font-mono text-slate-400">
                      {editContent.length}/2000
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="submit"
                      disabled={isSavingEdit || !editContent.trim()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-indigo-700 hover:bg-indigo-50 disabled:bg-indigo-300 font-bold text-xs transition-colors shadow-2xs"
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
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-700/60 hover:bg-indigo-700 text-indigo-100 font-medium text-xs transition-colors"
                    >
                      Cancel
                    </button>
                    <span className="text-[10px] text-indigo-200/80 font-mono hidden sm:inline">
                      Enter to save, Esc to cancel
                    </span>
                  </div>
                </form>
              ) : (
                <>
                  {message.content && (
                    <div className="text-xs sm:text-sm text-white leading-relaxed font-normal whitespace-pre-wrap break-words">
                      {renderContentWithLinks(message.content, true)}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-1 text-[10px] text-indigo-200/90 font-mono select-none pt-0.5">
                    {isSaved && (
                      <span title="Saved discussion" className="inline-flex items-center">
                        <Bookmark className="h-3 w-3 text-amber-300 fill-amber-300 shrink-0 mr-0.5" />
                      </span>
                    )}
                    <span title={displayFullDate}>{displayTime}</span>
                    {message.editedAt && (
                      <span
                        className="italic hover:underline cursor-help"
                        title={`Edited at ${formatFullDateTime(message.editedAt)}`}
                      >
                        (edited)
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Reactions & Thread Replies */}
          {renderReactionsAndReplies(true)}
        </div>
      ) : (
        /* ======================================================== */
        /* OTHER COMMUNITY MEMBER — LEFT-ALIGNED                   */
        /* ======================================================== */
        <div className="relative flex flex-row items-start gap-2 max-w-[88%] sm:max-w-[78%] lg:max-w-[70%]">
          {/* Avatar on Left (or Spacer when grouped) */}
          {!isGrouped ? (
            <div className="relative shrink-0 pt-0.5">
              {resolvedAvatar ? (
                <img
                  src={resolvedAvatar}
                  alt={resolvedName}
                  className="h-8 w-8 rounded-full object-cover border border-slate-200 shadow-2xs"
                />
              ) : (
                <div className="h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs bg-slate-700 text-white shadow-2xs">
                  {(resolvedName || 'M').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          ) : (
            <div className="w-8 shrink-0" />
          )}

          {/* Bubble Column */}
          <div className="flex flex-col items-start min-w-0">
            {/* Header above bubble (only shown on first message of a group) */}
            {!isGrouped && (
              <div className="flex items-center gap-1.5 mb-1 px-1 flex-wrap">
                {isPinned && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100/90 border border-amber-300 text-[10px] font-bold uppercase tracking-wider text-amber-900 shadow-2xs">
                    <Pin className="h-2.5 w-2.5 text-amber-700 rotate-45" />
                    Featured
                  </span>
                )}
                <span className="text-xs font-bold text-slate-800 truncate">
                  {resolvedName}
                </span>
                {typeConfig && (
                  <>
                    <span className="text-slate-300 text-xs font-mono">•</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                      <span>{typeConfig.icon}</span>
                      <span>{typeConfig.label}</span>
                    </span>
                  </>
                )}
                <span className="text-slate-300 text-xs font-mono">•</span>
                <span
                  className="text-[10px] text-slate-400 font-mono"
                  title={displayFullDate}
                >
                  {displayTime}
                </span>
              </div>
            )}

            {/* Main Bubble Wrapper with relative anchor */}
            <div className="relative group/bubble flex flex-col items-start">
              {renderActionToolbar(false)}

              {/* Bubble */}
              <div
                className={`relative rounded-2xl rounded-tl-xs bg-white border border-slate-200 text-slate-900 shadow-2xs px-3.5 py-2.5 space-y-1 ${
                  isHighlighted ? 'ring-2 ring-indigo-500 border-indigo-400' : ''
                }`}
              >
                {message.content && (
                  <div className="text-xs sm:text-sm text-slate-900 leading-relaxed font-normal whitespace-pre-wrap break-words">
                    {renderContentWithLinks(message.content, false)}
                  </div>
                )}

                <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 font-mono select-none pt-0.5">
                  {isSaved && (
                    <span title="Saved discussion" className="inline-flex items-center">
                      <Bookmark className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0 mr-0.5" />
                    </span>
                  )}
                  <span title={displayFullDate}>{displayTime}</span>
                  {message.editedAt && (
                    <span
                      className="italic hover:underline cursor-help"
                      title={`Edited at ${formatFullDateTime(message.editedAt)}`}
                    >
                      (edited)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Reactions & Thread Replies */}
            {renderReactionsAndReplies(false)}
          </div>
        </div>
      )}

      {/* Reaction Participants Inspection Modal */}
      {inspectReactionEmoji && (
        <ChatReactionParticipantsModal
          isOpen={Boolean(inspectReactionEmoji)}
          initialEmoji={inspectReactionEmoji || 'all'}
          reactions={reactions}
          members={[]}
          currentUserId={currentUserId}
          onClose={() => setInspectReactionEmoji(null)}
          onToggleReaction={(emoji) => onToggleReaction(message.messageId, emoji)}
        />
      )}
    </div>
  );
}

CommunityDiscussionCard.propTypes = {
  message: PropTypes.shape({
    messageId: PropTypes.string.isRequired,
    senderId: PropTypes.string,
    authorId: PropTypes.string,
    senderName: PropTypes.string,
    senderAvatar: PropTypes.string,
    content: PropTypes.string,
    createdAt: PropTypes.number,
    editedAt: PropTypes.number,
    deleted: PropTypes.bool,
    postType: PropTypes.string,
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
  activeMenuMessageId: PropTypes.string,
  menuAnchorRect: PropTypes.object,
  onOpenMenu: PropTypes.func,
  onCloseMenu: PropTypes.func,
  onSetActiveMenuMessageId: PropTypes.func,
};

