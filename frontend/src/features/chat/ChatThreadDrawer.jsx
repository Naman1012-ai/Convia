import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import PropTypes from 'prop-types';
import {
  X,
  Send,
  Loader2,
  MessageSquare,
  Clock,
  Pencil,
  Trash2,
  Copy,
  Check,
  Info,
  ChevronUp,
  MoreVertical,
} from 'lucide-react';
import { chatService } from '../../services/chatService';
import { useToast } from '../../hooks/useToast';
import { ChatFileCard } from './ChatFileCard';
import { ChatMentionAutocomplete } from './ChatMentionAutocomplete';
import { ChatTypingIndicator } from './ChatTypingIndicator';
import { formatMessageTime, formatFullDateTime } from '../../utils/chatFeedHelpers';
import { resolveMemberDisplayName } from '../../utils/memberIdentity';
import { renderFormattedContent, getMentionSuggestions } from '../../utils/chatMentions';
import { useUserProfiles } from '../../hooks/useUserProfile';
import { CHAT_PAGE_SIZE } from '../../constants/chatSchema';

export function ChatThreadDrawer({
  workspaceId,
  channelId = 'general',
  parentMessage,
  currentUserId,
  currentUser,
  members = [],
  isWorkspaceAdmin = false,
  memberJoinedAt = null,
  onClose = () => {},
  onOpenPreview = () => {},
}) {
  const { toast } = useToast();
  const [replies, setReplies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [editingReplyId, setEditingReplyId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [activeMenuReplyId, setActiveMenuReplyId] = useState(null);
  const replyMenuRef = useRef(null);
  const [searchParams] = useSearchParams();

  // Reset active menu on thread change
  useEffect(() => {
    setActiveMenuReplyId(null);
  }, [parentMessage?.messageId]);

  // Deep-linking to specific reply from notification URL
  useEffect(() => {
    const targetReplyId = searchParams.get('replyId');
    if (!targetReplyId || replies.length === 0) return;

    const timer = setTimeout(() => {
      const el = document.getElementById(`reply_${targetReplyId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-indigo-500', 'ring-offset-2', 'rounded-2xl');
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-indigo-500', 'ring-offset-2', 'rounded-2xl');
        }, 3500);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchParams, replies]);

  // Click outside and Escape listeners for reply three-dot menu
  useEffect(() => {
    if (!activeMenuReplyId) return;

    const handleClickOutside = (e) => {
      if (replyMenuRef.current && !replyMenuRef.current.contains(e.target)) {
        setActiveMenuReplyId(null);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActiveMenuReplyId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeMenuReplyId]);

  // Mention Autocomplete state
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [mentionIndex, setMentionIndex] = useState(0);

  // Thread Typing State
  const [threadTypingUsers, setThreadTypingUsers] = useState([]);
  const lastTypingPublishRef = useRef(0);
  const typingTimeoutRef = useRef(null);

  const threadEndRef = useRef(null);
  const replyTextareaRef = useRef(null);

  // 1. Initial Load & Real-Time Listeners
  useEffect(() => {
    if (!workspaceId || !parentMessage?.messageId) return;

    let isMounted = true;
    setIsLoading(true);

    chatService
      .loadRecentReplies(workspaceId, channelId, parentMessage.messageId, CHAT_PAGE_SIZE, memberJoinedAt)
      .then(({ replies: loadedReplies, hasMore: moreAvailable }) => {
        if (isMounted) {
          setReplies(loadedReplies);
          setHasMore(moreAvailable);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error('[ChatThreadDrawer] Error loading replies:', err);
        if (isMounted) {
          toast.error('Failed to load thread replies.');
          setIsLoading(false);
        }
      });

    // Real-time live listener for open thread
    const unsubscribe = chatService.subscribeToThread(
      workspaceId,
      channelId,
      parentMessage.messageId,
      {
        onReplyAdded: (newReply) => {
          if (!isMounted) return;
          setReplies((prev) => {
            if (prev.some((r) => r.replyId === newReply.replyId)) {
              return prev.map((r) => (r.replyId === newReply.replyId ? newReply : r));
            }
            return [...prev, newReply];
          });
        },
        onReplyChanged: (updatedReply) => {
          if (!isMounted) return;
          setReplies((prev) =>
            prev.map((r) => (r.replyId === updatedReply.replyId ? updatedReply : r))
          );
        },
        onReplyRemoved: (removedId) => {
          if (!isMounted) return;
          setReplies((prev) => prev.filter((r) => r.replyId !== removedId));
        },
        onError: (err) => {
          console.error('[ChatThreadDrawer] Thread listener error:', err);
        },
      },
      memberJoinedAt
    );

    // Subscribe to thread typing state
    const unsubTyping = chatService.subscribeToThreadTypingState(
      workspaceId,
      channelId,
      parentMessage.messageId,
      (typers) => {
        if (isMounted) setThreadTypingUsers(typers);
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
      unsubTyping();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (workspaceId && parentMessage?.messageId && currentUser?.uid) {
        chatService
          .setThreadTypingState(workspaceId, channelId, parentMessage.messageId, currentUser, false)
          .catch(() => {});
      }
    };
  }, [workspaceId, channelId, parentMessage?.messageId, currentUser, memberJoinedAt]);

  // Auto-scroll on initial load or new replies
  useEffect(() => {
    if (!isLoading && replies.length > 0) {
      threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isLoading, replies.length]);

  // 2. Load Older Replies Pagination
  const handleLoadOlder = async () => {
    if (isLoadingOlder || !hasMore || replies.length === 0) return;
    const oldestReply = replies[0];
    if (!oldestReply?.replyId) return;

    try {
      setIsLoadingOlder(true);
      const { replies: olderBatch, hasMore: moreAvailable } =
        await chatService.loadOlderReplies(
          workspaceId,
          channelId,
          parentMessage.messageId,
          oldestReply.replyId,
          CHAT_PAGE_SIZE,
          memberJoinedAt
        );

      setReplies((prev) => {
        const existingIds = new Set(prev.map((r) => r.replyId));
        const filteredNew = olderBatch.filter((r) => !existingIds.has(r.replyId));
        return [...filteredNew, ...prev];
      });
      setHasMore(moreAvailable);
    } catch (err) {
      console.error('[ChatThreadDrawer] Error loading older replies:', err);
      toast.error('Failed to load older replies.');
    } finally {
      setIsLoadingOlder(false);
    }
  };

  // Throttled Thread Typing Publisher
  const notifyThreadTyping = useCallback(() => {
    if (!workspaceId || !parentMessage?.messageId || !currentUser?.uid) return;

    const now = Date.now();
    if (now - lastTypingPublishRef.current > 3000) {
      lastTypingPublishRef.current = now;
      chatService
        .setThreadTypingState(workspaceId, channelId, parentMessage.messageId, currentUser, true)
        .catch(() => {});
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      chatService
        .setThreadTypingState(workspaceId, channelId, parentMessage.messageId, currentUser, false)
        .catch(() => {});
    }, 3500);
  }, [workspaceId, channelId, parentMessage?.messageId, currentUser]);

  // Mention Change Handler
  const handleReplyTextChange = (e) => {
    const newText = e.target.value.substring(0, 2000);
    setReplyText(newText);

    if (newText.trim().length > 0) {
      notifyThreadTyping();
    }

    const cursorPos = e.target.selectionStart || newText.length;
    const textBeforeCursor = newText.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
      const query = textBeforeCursor.substring(lastAtIndex + 1);

      if ((charBeforeAt === ' ' || charBeforeAt === '\n') && !query.includes(' ')) {
        const suggestions = getMentionSuggestions(query, members);
        setMentionQuery(query);
        setMentionSuggestions(suggestions);
        setMentionIndex(0);
        return;
      }
    }

    setMentionQuery(null);
    setMentionSuggestions([]);
  };

  const handleSelectMention = (member) => {
    if (!replyTextareaRef.current || !member) return;
    const cursorPos = replyTextareaRef.current.selectionStart || replyText.length;
    const textBeforeCursor = replyText.substring(0, cursorPos);
    const textAfterCursor = replyText.substring(cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const mentionTag = `@${member.username || resolveMemberDisplayName(member).replace(/\s+/g, '')} `;
      const newContent = textBeforeCursor.substring(0, lastAtIndex) + mentionTag + textAfterCursor;
      setReplyText(newContent);
      setMentionQuery(null);
      setMentionSuggestions([]);

      setTimeout(() => {
        if (replyTextareaRef.current) {
          replyTextareaRef.current.focus();
          const newCursor = lastAtIndex + mentionTag.length;
          replyTextareaRef.current.setSelectionRange(newCursor, newCursor);
        }
      }, 10);
    }
  };

  // 3. Send Reply
  const handleSendReply = async (e) => {
    if (e) e.preventDefault();
    const cleanContent = replyText.trim();
    if (!cleanContent || isSending) return;

    // Clear typing indicator immediately
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (workspaceId && parentMessage?.messageId && currentUser?.uid) {
      chatService
        .setThreadTypingState(workspaceId, channelId, parentMessage.messageId, currentUser, false)
        .catch(() => {});
    }

    try {
      setIsSending(true);
      await chatService.sendReply(
        workspaceId,
        channelId,
        parentMessage.messageId,
        cleanContent,
        currentUser,
        null,
        parentMessage,
        members
      );
      setReplyText('');
      setMentionQuery(null);
      setMentionSuggestions([]);

      if (replyTextareaRef.current) {
        replyTextareaRef.current.style.height = 'auto';
      }
      setTimeout(() => {
        threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      console.error('[ChatThreadDrawer] Send reply error:', err);
      const friendlyMsg = err?.message?.includes('PERMISSION_DENIED')
        ? 'Unable to send reply. Please verify your workspace membership and try again.'
        : (err?.message || 'Failed to send reply. Please try again.');
      toast.error(friendlyMsg);
    } finally {
      setIsSending(false);
    }
  };

  // 4. Edit Reply
  const handleSaveEdit = async (replyId) => {
    const cleanContent = editContent.trim();
    if (!cleanContent) {
      toast.error('Reply content cannot be empty.');
      return;
    }

    try {
      setIsSavingEdit(true);
      await chatService.editReply(
        workspaceId,
        channelId,
        parentMessage.messageId,
        replyId,
        cleanContent,
        currentUserId
      );
      setEditingReplyId(null);
      setEditContent('');
      toast.success('Reply updated.');
    } catch (err) {
      console.error('[ChatThreadDrawer] Edit reply error:', err);
      toast.error(err?.message || 'Failed to update reply.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // 5. Delete Reply
  const handleDeleteReply = async (replyId) => {
    if (!window.confirm('Are you sure you want to delete this reply?')) return;

    try {
      await chatService.deleteReply(
        workspaceId,
        channelId,
        parentMessage.messageId,
        replyId,
        currentUserId
      );
      toast.info('Reply deleted.');
    } catch (err) {
      console.error('[ChatThreadDrawer] Delete reply error:', err);
      toast.error(err?.message || 'Failed to delete reply.');
    }
  };

  const handleCopy = (text, replyId) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(replyId);
    toast.success('Copied to clipboard.');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Extract all reply sender IDs and parent message sender ID for real-time synchronization
  const threadUserIds = useMemo(() => {
    const ids = new Set();
    if (parentMessage?.senderId) ids.add(parentMessage.senderId);
    replies.forEach((r) => {
      if (r.senderId) ids.add(r.senderId);
    });
    return Array.from(ids);
  }, [parentMessage?.senderId, replies]);

  const { resolveName } = useUserProfiles(threadUserIds);

  if (!parentMessage) return null;

  const parentMember = Array.isArray(members)
    ? members.find((m) => m && (m.uid === parentMessage.senderId || m.id === parentMessage.senderId))
    : null;
  const parentFallback = parentMember
    ? resolveMemberDisplayName(parentMember)
    : resolveMemberDisplayName(parentMessage.senderName || 'Member');
  const parentDisplayName = resolveName(parentMessage.senderId, parentFallback);

  return (
    <aside
      className="fixed inset-y-0 right-0 w-full sm:w-[420px] bg-white border-l border-slate-200 shadow-2xl z-40 flex flex-col animate-in slide-in-from-right duration-200"
      aria-label="Thread Drawer"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 bg-slate-50/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-indigo-600" />
          <div>
            <h2 className="text-sm font-black text-slate-900">Thread Discussion</h2>
            <p className="text-[11px] text-slate-500 font-medium">
              with {parentDisplayName} in #{channelId}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
          aria-label="Close thread"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Thread Content & History */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Parent Message Card */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-indigo-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                {(parentDisplayName || 'M').charAt(0).toUpperCase()}
              </div>
              <span className="text-xs font-bold text-slate-900 truncate">
                {parentDisplayName}
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              {formatMessageTime(parentMessage.createdAt)}
            </span>
          </div>

          <div className="text-xs text-slate-800 leading-relaxed font-normal whitespace-pre-wrap break-words">
            {parentMessage.deleted ? (
              <span className="italic text-slate-400">This message was deleted</span>
            ) : (
              renderFormattedContent(parentMessage.content, members, currentUserId)
            )}
          </div>

          {parentMessage.attachment && !parentMessage.deleted && (
            <div className="pt-1">
              <ChatFileCard
                attachment={parentMessage.attachment}
                onOpenPreview={onOpenPreview}
              />
            </div>
          )}
        </div>

        {/* Separator */}
        <div className="flex items-center gap-2 px-1">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
            {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
          </span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        {/* Older Replies Load Button */}
        {hasMore && (
          <div className="flex justify-center">
            <button
              onClick={handleLoadOlder}
              disabled={isLoadingOlder}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-semibold transition-colors disabled:opacity-50"
            >
              {isLoadingOlder ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <ChevronUp className="h-3 w-3" />
              )}
              <span>Load older replies</span>
            </button>
          </div>
        )}

        {/* Loading Spinner */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 text-indigo-600 animate-spin" />
          </div>
        ) : replies.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400 space-y-1">
            <p className="font-semibold text-slate-500">No replies yet</p>
            <p>Start the conversation below.</p>
          </div>
        ) : (
          /* Replies Feed */
          <div className="space-y-3">
            {replies.map((reply) => {
              const isOwnReply = reply.senderId === currentUserId;
              const canEditReply = isOwnReply && !reply.deleted;
              const canDeleteReply = !reply.deleted && (isOwnReply || isWorkspaceAdmin);

              const replyMember = Array.isArray(members)
                ? members.find((m) => m && (m.uid === reply.senderId || m.id === reply.senderId))
                : null;
              const replyFallback = replyMember
                ? resolveMemberDisplayName(replyMember)
                : resolveMemberDisplayName(reply.senderName || 'Member');
              const replyDisplayName = resolveName(reply.senderId, replyFallback);

              return (
                <div
                  key={reply.replyId}
                  id={`reply_${reply.replyId}`}
                  className={`group relative flex w-full my-1.5 transition-all ${isOwnReply ? 'justify-end' : 'justify-start'}`}
                >
                  {reply.deleted ? (
                    <div
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-2xl text-xs italic ${
                        isOwnReply
                          ? 'bg-slate-100 text-slate-400 border border-slate-200/80 rounded-tr-xs'
                          : 'bg-slate-100 text-slate-400 border border-slate-200/80 rounded-tl-xs'
                      }`}
                    >
                      <Trash2 className="h-3 w-3 opacity-60" />
                      <span>This reply was deleted</span>
                      <span className="text-[10px] font-mono opacity-60">
                        • {formatMessageTime(reply.createdAt)}
                      </span>
                    </div>
                  ) : isOwnReply ? (
                    /* OWN THREAD REPLY (RIGHT-ALIGNED) */
                    <div className="relative flex flex-col items-end max-w-[85%]">
                      {/* Main Bubble Wrapper with relative anchor */}
                      <div className="relative group/bubble flex flex-col items-end">
                        {/* WhatsApp Web-Style Three-Dot Action Trigger & Contextual Menu */}
                        {!editingReplyId && (
                          <div className="absolute -top-3 left-1 z-20 items-center justify-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuReplyId(activeMenuReplyId === reply.replyId ? null : reply.replyId);
                              }}
                              className={`h-6 w-6 rounded-full bg-white/95 backdrop-blur-xs border border-slate-200 shadow-xs flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer ${
                                activeMenuReplyId === reply.replyId
                                  ? 'flex ring-2 ring-indigo-500 text-indigo-600 bg-white shadow-sm'
                                  : 'hidden sm:group-hover:flex sm:group-focus-within:flex max-sm:flex'
                              }`}
                              title="More options"
                              aria-label="More reply options"
                              aria-haspopup="true"
                              aria-expanded={activeMenuReplyId === reply.replyId}
                            >
                              <MoreVertical className="h-3.5 w-3.5" />
                            </button>

                            {activeMenuReplyId === reply.replyId && (
                              <div
                                ref={replyMenuRef}
                                className="absolute z-30 min-w-[120px] rounded-xl border border-slate-200 bg-white p-1 shadow-lg transition-all animate-in fade-in zoom-in-95 top-full left-0 mt-1"
                                role="menu"
                                aria-label="Reply context menu"
                              >
                                {reply.content && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleCopy(reply.content, reply.replyId);
                                      setActiveMenuReplyId(null);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                                    role="menuitem"
                                  >
                                    {copiedId === reply.replyId ? (
                                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5 text-slate-500" />
                                    )}
                                    <span>{copiedId === reply.replyId ? 'Copied' : 'Copy'}</span>
                                  </button>
                                )}

                                {canEditReply && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuReplyId(null);
                                      setEditingReplyId(reply.replyId);
                                      setEditContent(reply.content);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-indigo-600 transition-colors cursor-pointer"
                                    role="menuitem"
                                  >
                                    <Pencil className="h-3.5 w-3.5 text-slate-500" />
                                    <span>Edit</span>
                                  </button>
                                )}

                                {canDeleteReply && (
                                  <>
                                    {(reply.content || canEditReply) && <div className="my-0.5 border-t border-slate-100" />}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveMenuReplyId(null);
                                        handleDeleteReply(reply.replyId);
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
                        )}

                        {/* Main Bubble */}
                        <div className="rounded-2xl rounded-tr-xs bg-indigo-600 text-white shadow-xs p-3 space-y-1 min-w-0">
                        {editingReplyId === reply.replyId ? (
                          <div className="space-y-2 min-w-[220px]">
                            <textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value.substring(0, 2000))}
                              rows={2}
                              className="w-full rounded-lg border border-indigo-300 bg-white p-2 text-xs text-slate-900 focus:outline-none resize-none"
                            />
                            <div className="flex items-center gap-1.5 text-xs">
                              <button
                                onClick={() => handleSaveEdit(reply.replyId)}
                                disabled={isSavingEdit || !editContent.trim()}
                                className="px-2.5 py-1 rounded bg-white text-indigo-700 text-[11px] font-bold hover:bg-indigo-50 disabled:opacity-50"
                              >
                                {isSavingEdit ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                onClick={() => {
                                  setEditingReplyId(null);
                                  setEditContent('');
                                }}
                                className="px-2.5 py-1 rounded bg-indigo-700 text-white text-[11px] font-semibold hover:bg-indigo-800"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="text-xs text-white leading-relaxed font-normal whitespace-pre-wrap break-words">
                              {renderFormattedContent(reply.content, members, currentUserId, true)}
                            </div>
                            <div className="flex items-center justify-end gap-1 text-[10px] text-indigo-200/90 font-mono select-none pt-0.5">
                              <span>{formatMessageTime(reply.createdAt)}</span>
                              {reply.editedAt && (
                                <span className="italic">(edited)</span>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                    /* OTHER MEMBER'S THREAD REPLY (LEFT-ALIGNED) */
                    <div className="relative flex flex-row items-start gap-2 max-w-[85%]">
                      <div className="relative shrink-0 pt-0.5">
                        <div className="h-7 w-7 rounded-full bg-slate-700 text-white font-bold text-[10px] flex items-center justify-center shrink-0 shadow-2xs">
                          {(replyDisplayName || 'M').charAt(0).toUpperCase()}
                        </div>
                      </div>

                      <div className="flex flex-col items-start min-w-0">
                        <div className="flex items-center gap-2 mb-1 px-1">
                          <span className="text-xs font-bold text-slate-800 truncate">
                            {replyDisplayName}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {formatMessageTime(reply.createdAt)}
                          </span>
                        </div>

                        {/* Main Bubble Wrapper with relative anchor */}
                        <div className="relative group/bubble flex flex-col items-start min-w-0">
                          {/* WhatsApp Web-Style Three-Dot Action Trigger & Contextual Menu */}
                          {!editingReplyId && (
                            <div className="absolute -top-3 right-1 z-20 items-center justify-center">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuReplyId(activeMenuReplyId === reply.replyId ? null : reply.replyId);
                                }}
                                className={`h-6 w-6 rounded-full bg-white/95 backdrop-blur-xs border border-slate-200 shadow-xs flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer ${
                                  activeMenuReplyId === reply.replyId
                                    ? 'flex ring-2 ring-indigo-500 text-indigo-600 bg-white shadow-sm'
                                    : 'hidden sm:group-hover:flex sm:group-focus-within:flex max-sm:flex'
                                }`}
                                title="More options"
                                aria-label="More reply options"
                                aria-haspopup="true"
                                aria-expanded={activeMenuReplyId === reply.replyId}
                              >
                                <MoreVertical className="h-3.5 w-3.5" />
                              </button>

                              {activeMenuReplyId === reply.replyId && (
                                <div
                                  ref={replyMenuRef}
                                  className="absolute z-30 min-w-[120px] rounded-xl border border-slate-200 bg-white p-1 shadow-lg transition-all animate-in fade-in zoom-in-95 top-full right-0 mt-1"
                                  role="menu"
                                  aria-label="Reply context menu"
                                >
                                  {reply.content && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleCopy(reply.content, reply.replyId);
                                        setActiveMenuReplyId(null);
                                      }}
                                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                                      role="menuitem"
                                    >
                                      {copiedId === reply.replyId ? (
                                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                                      ) : (
                                        <Copy className="h-3.5 w-3.5 text-slate-500" />
                                      )}
                                      <span>{copiedId === reply.replyId ? 'Copied' : 'Copy'}</span>
                                    </button>
                                  )}

                                  {canEditReply && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveMenuReplyId(null);
                                        setEditingReplyId(reply.replyId);
                                        setEditContent(reply.content);
                                      }}
                                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-indigo-600 transition-colors cursor-pointer"
                                      role="menuitem"
                                    >
                                      <Pencil className="h-3.5 w-3.5 text-slate-500" />
                                      <span>Edit</span>
                                    </button>
                                  )}

                                  {canDeleteReply && (
                                    <>
                                      {(reply.content || canEditReply) && <div className="my-0.5 border-t border-slate-100" />}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveMenuReplyId(null);
                                          handleDeleteReply(reply.replyId);
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
                          )}

                          <div className="rounded-2xl rounded-tl-xs bg-white border border-slate-200 text-slate-900 shadow-2xs p-3 space-y-1">
                            {editingReplyId === reply.replyId ? (
                              <div className="space-y-2 min-w-[220px]">
                                <textarea
                                  value={editContent}
                                  onChange={(e) => setEditContent(e.target.value.substring(0, 2000))}
                                  rows={2}
                                  className="w-full rounded-lg border-2 border-indigo-500 bg-white p-2 text-xs text-slate-900 focus:outline-none resize-none"
                                />
                                <div className="flex items-center gap-1.5 text-xs">
                                  <button
                                    onClick={() => handleSaveEdit(reply.replyId)}
                                    disabled={isSavingEdit || !editContent.trim()}
                                    className="px-2.5 py-1 rounded bg-indigo-600 text-white text-[11px] font-bold hover:bg-indigo-700 disabled:opacity-50"
                                  >
                                    {isSavingEdit ? 'Saving...' : 'Save'}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingReplyId(null);
                                      setEditContent('');
                                    }}
                                    className="px-2.5 py-1 rounded bg-slate-200 text-slate-700 text-[11px] font-semibold hover:bg-slate-300"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="text-xs text-slate-900 leading-relaxed font-medium whitespace-pre-wrap break-words">
                                  {renderFormattedContent(reply.content, members, currentUserId, false)}
                                </div>
                                <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 font-mono select-none pt-0.5">
                                  <span>{formatMessageTime(reply.createdAt)}</span>
                                  {reply.editedAt && (
                                    <span className="italic">(edited)</span>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div ref={threadEndRef} />
      </div>

      {/* Reply Composer */}
      <div className="relative p-3 border-t border-slate-200 bg-white">
        {/* Mention Autocomplete Popover */}
        {mentionSuggestions.length > 0 && (
          <ChatMentionAutocomplete
            suggestions={mentionSuggestions}
            selectedIndex={mentionIndex}
            onSelect={handleSelectMention}
            onClose={() => setMentionSuggestions([])}
          />
        )}

        {/* Real-time Thread Typing Indicator */}
        <ChatTypingIndicator
          typingUsers={threadTypingUsers}
          currentUserId={currentUserId}
          isThread={true}
        />

        <form onSubmit={handleSendReply} className="space-y-2">
          <div className="relative">
            <textarea
              ref={replyTextareaRef}
              value={replyText}
              onChange={handleReplyTextChange}
              onKeyDown={(e) => {
                if (mentionSuggestions.length > 0) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setMentionIndex((prev) => (prev + 1) % mentionSuggestions.length);
                    return;
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setMentionIndex((prev) => (prev - 1 + mentionSuggestions.length) % mentionSuggestions.length);
                    return;
                  }
                  if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault();
                    handleSelectMention(mentionSuggestions[mentionIndex]);
                    return;
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setMentionQuery(null);
                    setMentionSuggestions([]);
                    return;
                  }
                }

                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendReply();
                }
              }}
              placeholder={`Reply to ${parentDisplayName || 'thread'}... (Type @ to mention)`}
              rows={1}
              disabled={isSending}
              className="w-full rounded-xl border border-slate-300 bg-slate-50/80 p-2.5 pr-10 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none transition-all"
              aria-label="Reply to thread"
            />

            <button
              type="submit"
              disabled={isSending || !replyText.trim()}
              className="absolute right-2 top-2 p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white disabled:text-slate-400 transition-colors shadow-2xs"
              aria-label="Send reply"
            >
              {isSending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>Press Enter to send</span>
            <span>{replyText.length}/2000</span>
          </div>
        </form>
      </div>
    </aside>
  );
}

ChatThreadDrawer.propTypes = {
  workspaceId: PropTypes.string.isRequired,
  channelId: PropTypes.string,
  parentMessage: PropTypes.object,
  currentUserId: PropTypes.string,
  currentUser: PropTypes.object,
  members: PropTypes.array,
  isWorkspaceAdmin: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  onOpenPreview: PropTypes.func,
};
