import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { chatService } from '../../services/chatService';
import { ChatFileCard } from './ChatFileCard';
import { ChatReactionPicker } from './ChatReactionPicker';
import { ChatReactionParticipantsModal } from './ChatReactionParticipantsModal';
import {
  formatMessageTime,
  formatFullDateTime,
  formatReplyCountLabel,
} from '../../utils/chatFeedHelpers';
import { resolveMemberDisplayName } from '../../utils/memberIdentity';
import { renderFormattedContent } from '../../utils/chatMentions';
import { useUserProfile } from '../../hooks/useUserProfile';

export function ChatMessageItem({
  workspaceId,
  channelId = 'general',
  message,
  currentUserId,
  members = [],
  isWorkspaceAdmin = false,
  isGrouped = false,
  isTargetHighlighted = false,
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
  onOpenPreview = () => {},
  onOpenThread = () => {},
  onToggleReaction = () => {},
}) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content || '');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [reactionPickerAnchor, setReactionPickerAnchor] = useState(null); // 'chips' | null
  const [localReactions, setLocalReactions] = useState(message.reactions || {});
  const [localReplyCount, setLocalReplyCount] = useState(message.replyCount || 0);
  const reactions = reactionsProp !== undefined ? (reactionsProp || {}) : localReactions;
  const replyCount = replyCountProp !== undefined ? (replyCountProp || 0) : localReplyCount;
  const [inspectReactionEmoji, setInspectReactionEmoji] = useState(null); // null | 'all' | emoji string

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

  const isOwnMessage = Boolean(currentUserId && (message.senderId === currentUserId || message.authorId === currentUserId));
  const canDelete = !message.deleted && (isOwnMessage || isWorkspaceAdmin);
  const canEdit = isOwnMessage && !message.deleted && !message.isSystem;
  const canReply = !message.deleted && !message.isSystem;
  const canReact = !message.deleted && !message.isSystem;

  // Resolve sender display name and profile from member roster, or fallback to snapshot
  const senderMember = Array.isArray(members)
    ? members.find((m) => m && (m.uid === message.senderId || m.id === message.senderId))
    : null;

  // Real-time user profile resolution from canonical users/{uid}
  // Note: Workspace roster is live-synced at the workspace level (OrgContext).
  // Passing subscribe: false eliminates the N+1 listener explosion per rendered chat message.
  const { displayName: liveDisplayName, avatar: liveAvatar, profile: liveProfile } = useUserProfile(
    message.senderId,
    {
      subscribe: false,
      fallbackName: senderMember ? resolveMemberDisplayName(senderMember) : resolveMemberDisplayName(message.senderName || 'Member'),
      fallbackAvatar: senderMember?.avatar || senderMember?.photoURL || message.senderAvatar || '',
    }
  );

  const senderDisplayName = liveDisplayName;
  const senderAvatar = liveAvatar || message.senderAvatar || '';
  const memberProfile = liveProfile || senderMember;

  // Real-time Reactions subscription for this message (ONLY when reactionsProp is not provided by parent)
  useEffect(() => {
    if (reactionsProp !== undefined) return;
    if (!workspaceId || !message?.messageId || message.deleted || message.isSystem) return;

    const unsubscribe = chatService.subscribeToMessageReactions(
      workspaceId,
      channelId,
      message.messageId,
      (newReactions) => {
        setLocalReactions(newReactions || {});
      }
    );

    return () => {
      unsubscribe();
    };
  }, [reactionsProp, workspaceId, channelId, message?.messageId, message?.deleted, message?.isSystem]);

  // Real-time Reply Count subscription for this message (ONLY when replyCountProp is not provided by parent)
  useEffect(() => {
    if (replyCountProp !== undefined) return;
    if (!workspaceId || !message?.messageId || message.deleted || message.isSystem) return;

    const unsubscribe = chatService.subscribeToMessageReplyCount(
      workspaceId,
      channelId,
      message.messageId,
      (count) => {
        setLocalReplyCount(count);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [replyCountProp, workspaceId, channelId, message?.messageId, message?.deleted, message?.isSystem]);

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
      navigator.clipboard.writeText(message.content);
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

  const displayTime = timeLabel || formatMessageTime(message.createdAt);
  const displayFullDate = fullDateLabel || formatFullDateTime(message.createdAt);

  // 1. Render System Event Messages
  if (message.isSystem) {
    return (
      <div className="flex items-center justify-center my-3 px-4" role="status">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100/90 border border-slate-200 text-xs font-medium text-slate-600 shadow-2xs">
          <Info className="h-3.5 w-3.5 text-indigo-500 shrink-0" aria-hidden="true" />
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
    return (
      <div
        id={`msg_${message.messageId}`}
        className={`flex w-full my-1 px-2 sm:px-4 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
      >
        <div
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-2xl text-xs italic ${
            isOwnMessage
              ? 'bg-slate-100/90 text-slate-400 border border-slate-200/80 rounded-tr-xs'
              : 'bg-slate-100/90 text-slate-400 border border-slate-200/80 rounded-tl-xs'
          }`}
        >
          <Trash2 className="h-3 w-3 opacity-60" />
          <span>This message was deleted</span>
          <span className="text-[10px] font-mono opacity-60" title={displayFullDate}>
            • {displayTime}
          </span>
        </div>
      </div>
    );
  }

  // Helper: WhatsApp Web-Style Three-Dot Action Trigger & Contextual Menu
  const renderActionToolbar = (isOwn) => {
    if (isEditing) return null;

    return (
      <div
        ref={menuButtonRef}
        className={`absolute -top-3 z-20 items-center justify-center transition-all ${
          isOwn ? 'left-1' : 'right-1'
        } ${isMenuOpen ? 'flex' : 'hidden sm:group-hover:flex sm:group-focus-within:flex max-sm:flex'}`}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsMenuOpen(!isMenuOpen);
          }}
          className={`h-6 w-6 rounded-full bg-white/95 backdrop-blur-xs border border-slate-200 shadow-xs flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer ${
            isMenuOpen ? 'ring-2 ring-indigo-500 text-indigo-600 bg-white shadow-sm' : ''
          }`}
          title="More options"
          aria-label="More message options"
          aria-haspopup="true"
          aria-expanded={isMenuOpen}
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </button>

        {/* Three-Dot Contextual Menu */}
        {isMenuOpen && (
          <div
            ref={menuRef}
            className={`absolute z-30 min-w-[130px] rounded-xl border border-slate-200 bg-white p-1 shadow-lg transition-all animate-in fade-in zoom-in-95 ${
              isOwn ? 'top-full left-0 mt-1' : 'top-full right-0 mt-1'
            }`}
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
                <span>{copied ? 'Copied' : 'Copy'}</span>
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
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-indigo-600 transition-colors cursor-pointer"
                role="menuitem"
              >
                <Pencil className="h-3.5 w-3.5 text-slate-500" />
                <span>Edit</span>
              </button>
            )}

            {/* Delete Message (Author or Workspace Admin) */}
            {canDelete && (
              <>
                {(message.content || canEdit) && <div className="my-0.5 border-t border-slate-100" />}
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
  const renderReactionsAndReplies = (isOwn) => {
    if (message.deleted) return null;
    const hasReactions = Object.keys(reactions).length > 0;
    const hasReplies = replyCount > 0;
    if (!hasReactions && !hasReplies && !canReact && !canReply) return null;

    return (
      <div className={`flex flex-wrap items-center gap-1.5 pt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
        {Object.entries(reactions).map(([emoji, reactionData]) => {
          const hasReacted = reactionData.users?.includes(currentUserId);
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => setInspectReactionEmoji(emoji)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all cursor-pointer select-none ${
                hasReacted
                  ? 'bg-indigo-100 border border-indigo-300 text-indigo-800 font-bold shadow-2xs hover:bg-indigo-200/70'
                  : 'bg-slate-100/90 hover:bg-slate-200/90 border border-slate-200/70 text-slate-700 font-medium'
              }`}
              title={`View who reacted with ${emoji} (${reactionData.count})`}
              aria-label={`${emoji} reaction, ${reactionData.count} count. Click to view participants`}
            >
              <span>{emoji}</span>
              <span className="text-[11px] font-mono">{reactionData.count}</span>
            </button>
          );
        })}

        {/* Quick Add Reaction Button */}
        {canReact && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setReactionPickerAnchor((prev) => (prev === 'chips' ? null : 'chips'))}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
              title="Add reaction"
              aria-label="Add emoji reaction"
            >
              <SmilePlus className="h-3.5 w-3.5" />
            </button>

            {reactionPickerAnchor === 'chips' && (
              <ChatReactionPicker
                isOpen={true}
                align={isOwn ? 'right' : 'left'}
                onSelectReaction={(emoji) => {
                  onToggleReaction(message.messageId, emoji);
                  setReactionPickerAnchor(null);
                }}
                onClose={() => setReactionPickerAnchor(null)}
              />
            )}
          </div>
        )}

        {/* Reply in Thread Button */}
        {canReply && (
          <button
            type="button"
            onClick={() => onOpenThread(message)}
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all ${
              replyCount > 0
                ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200/80 shadow-2xs hover:bg-indigo-100 hover:text-indigo-800'
                : 'bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200/60 text-slate-600'
            }`}
            title={replyCount > 0 ? `${formatReplyCountLabel(replyCount)} - Click to open discussion thread` : 'Reply in thread'}
            aria-label={`Reply in thread, ${formatReplyCountLabel(replyCount)}`}
          >
            <MessageSquare className="h-3 w-3" />
            <span>{formatReplyCountLabel(replyCount)}</span>
          </button>
        )}
      </div>
    );
  };

  // 3. Render Normal User Message (WhatsApp-Style Two-Sided Bubbles)
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
      className={`group relative flex w-full my-1 px-2 sm:px-4 transition-all duration-200 ${
        isOwnMessage ? 'justify-end' : 'justify-start'
      } ${isTargetHighlighted ? 'bg-indigo-50/70 ring-2 ring-indigo-500 rounded-2xl py-1' : ''}`}
    >
      {isOwnMessage ? (
        /* OWN MESSAGE (RIGHT-ALIGNED) */
        <div className="relative flex flex-col items-end max-w-[85%] sm:max-w-[75%] lg:max-w-[65%]">
          {/* Main Bubble Wrapper with relative anchor */}
          <div className="relative group/bubble flex flex-col items-end">
            {renderActionToolbar(true)}

            {/* Main Bubble */}
            <div
              className={`relative rounded-2xl rounded-tr-xs bg-indigo-600 text-white shadow-xs px-3.5 py-2 space-y-1 ${
                isTargetHighlighted ? 'ring-2 ring-indigo-300' : ''
              }`}
            >
              {isEditing ? (
                <form onSubmit={handleSaveEdit} className="space-y-2 min-w-[240px] max-w-md">
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-indigo-700 hover:bg-indigo-50 disabled:bg-indigo-300 text-white font-bold text-xs transition-colors shadow-2xs"
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
                    <div className="text-xs text-white leading-relaxed font-medium whitespace-pre-wrap break-words">
                      {renderFormattedContent(message.content, members, currentUserId, true)}
                    </div>
                  )}

                  {message.attachment && (
                    <div className="pt-0.5">
                      <ChatFileCard attachment={message.attachment} onOpenPreview={onOpenPreview} />
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-1 text-[10px] text-indigo-200/90 font-mono select-none pt-0.5">
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
        /* OTHER MEMBER'S MESSAGE (LEFT-ALIGNED) */
        <div className="relative flex flex-row items-start gap-2 max-w-[85%] sm:max-w-[75%] lg:max-w-[65%]">
          {/* Avatar with Presence Dot */}
          {!isGrouped ? (
            <div className="relative shrink-0 pt-0.5">
              {senderAvatar ? (
                <img
                  src={senderAvatar}
                  alt={senderDisplayName}
                  className="h-8 w-8 rounded-full object-cover border border-slate-200 shadow-2xs"
                />
              ) : (
                <div className="h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs bg-slate-700 text-white shadow-2xs">
                  {(senderDisplayName || 'M').charAt(0).toUpperCase()}
                </div>
              )}
              {senderMember && (
                <span
                  className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white ${
                    senderMember.onlineStatus === 'online' ? 'bg-emerald-500 shadow-2xs' : 'bg-slate-400'
                  }`}
                  title={senderMember.onlineStatus === 'online' ? 'Online' : 'Offline'}
                />
              )}
            </div>
          ) : (
            <div className="w-8 shrink-0" />
          )}

          {/* Bubble Column */}
          <div className="flex flex-col items-start min-w-0">
            {!isGrouped && (
              <div className="flex items-center gap-2 mb-1 px-1">
                <span className="text-xs font-bold text-slate-800 truncate">
                  {senderDisplayName}
                </span>
                <span className="text-[10px] text-slate-400 font-mono" title={displayFullDate}>
                  {displayTime}
                </span>
              </div>
            )}

            {/* Main Bubble Wrapper with relative anchor */}
            <div className="relative group/bubble flex flex-col items-start">
              {renderActionToolbar(false)}

              {/* Main Bubble */}
              <div className="relative rounded-2xl rounded-tl-xs bg-white border border-slate-200 text-slate-900 shadow-2xs px-3.5 py-2 space-y-1">
                {message.content && (
                  <div className="text-xs text-slate-900 leading-relaxed font-medium whitespace-pre-wrap break-words">
                    {renderFormattedContent(message.content, members, currentUserId, false)}
                  </div>
                )}

                {message.attachment && (
                  <div className="pt-0.5">
                    <ChatFileCard attachment={message.attachment} onOpenPreview={onOpenPreview} />
                  </div>
                )}

                <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 font-mono select-none pt-0.5">
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

      {/* WhatsApp-Style Reaction Participants Modal */}
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

ChatMessageItem.propTypes = {
  workspaceId: PropTypes.string,
  channelId: PropTypes.string,
  message: PropTypes.shape({
    messageId: PropTypes.string.isRequired,
    senderId: PropTypes.string,
    senderName: PropTypes.string,
    senderAvatar: PropTypes.string,
    content: PropTypes.string,
    createdAt: PropTypes.number,
    editedAt: PropTypes.number,
    deleted: PropTypes.bool,
    isSystem: PropTypes.bool,
    attachment: PropTypes.object,
  }).isRequired,
  currentUserId: PropTypes.string,
  members: PropTypes.array,
  isWorkspaceAdmin: PropTypes.bool,
  isGrouped: PropTypes.bool,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  onEditMessage: PropTypes.func,
  onDeleteMessage: PropTypes.func,
  activeMenuMessageId: PropTypes.string,
  onSetActiveMenuMessageId: PropTypes.func,
  reactions: PropTypes.object,
  replyCount: PropTypes.number,
  onOpenPreview: PropTypes.func,
  onOpenThread: PropTypes.func,
  onToggleReaction: PropTypes.func,
};
