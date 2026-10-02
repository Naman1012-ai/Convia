import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useSearchParams } from 'react-router-dom';
import {
  X,
  Send,
  Loader2,
  MessageCircle,
  Clock,
  Sparkles,
  ArrowLeft,
  Check,
  Copy,
  Pencil,
  Trash2,
  SmilePlus,
} from 'lucide-react';
import { Avatar } from '../../components/ui/Avatar';
import { chatService } from '../../services/chatService';
import { formatMessageTime, formatFullDateTime } from '../../utils/chatFeedHelpers';
import { useUserProfile } from '../../hooks/useUserProfile';
import { resolveMemberDisplayName } from '../../utils/memberIdentity';
import { COMMUNITY_POST_TYPE_CONFIG } from '../../constants/chatSchema';
import { useToast } from '../../hooks/useToast';

export function CommunityThreadDrawer({
  isOpen = false,
  parentMessage = null,
  currentUserId = null,
  currentUser = null,
  isAdmin = false,
  onClose = () => {},
  onToggleReaction = () => {},
  parentReactions = {},
}) {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [replies, setReplies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const repliesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Parent author identity
  const { displayName: parentAuthorName, avatar: parentAuthorAvatar } = useUserProfile(
    parentMessage?.senderId,
    {
      subscribe: false,
      fallbackName: resolveMemberDisplayName(parentMessage?.senderName || 'Community Member'),
      fallbackAvatar: parentMessage?.senderAvatar || '',
    }
  );

  const scrollToBottom = () => {
    repliesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load replies and subscribe to live thread updates
  useEffect(() => {
    if (!isOpen || !parentMessage?.messageId) return;

    setIsLoading(true);
    setError(null);

    // Initial load
    chatService.loadPublicIdeaReplies(parentMessage.messageId)
      .then((res) => {
        setReplies(res.replies || []);
        setIsLoading(false);
        setTimeout(scrollToBottom, 150);
      })
      .catch((err) => {
        console.error('[CommunityThreadDrawer] Load replies error:', err);
        setError('Failed to load discussion replies.');
        setIsLoading(false);
      });

    // Real-time live replies subscription
    const unsubscribe = chatService.subscribeToPublicIdeaThread(parentMessage.messageId, {
      onReplyAdded: (newReply) => {
        setReplies((prev) => {
          if (prev.some((r) => r.replyId === newReply.replyId)) return prev;
          return [...prev, newReply].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        });
        setTimeout(scrollToBottom, 100);
      },
      onReplyChanged: (updatedReply) => {
        setReplies((prev) =>
          prev.map((r) => (r.replyId === updatedReply.replyId ? updatedReply : r))
        );
      },
      onReplyRemoved: (removedReplyId) => {
        setReplies((prev) => prev.filter((r) => r.replyId !== removedReplyId));
      },
      onError: (err) => {
        console.warn('[CommunityThreadDrawer] Live thread warning:', err);
      },
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [isOpen, parentMessage?.messageId]);

  // Handle deep-linked reply highlight
  useEffect(() => {
    const targetReplyId = searchParams.get('replyId');
    if (!targetReplyId || replies.length === 0) return;

    const timer = setTimeout(() => {
      const el = document.getElementById(`reply_${targetReplyId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-emerald-500', 'bg-emerald-50/50');
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-emerald-500', 'bg-emerald-50/50');
        }, 3500);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchParams, replies]);

  // Auto-resize reply textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 120);
      textareaRef.current.style.height = `${Math.max(newHeight, 38)}px`;
    }
  }, [replyText]);

  const handleSendReply = async (e) => {
    if (e) e.preventDefault();
    const trimmed = replyText.trim();
    if (!trimmed || isSending || !currentUser) return;

    setIsSending(true);
    setError(null);

    try {
      await chatService.sendPublicIdeaReply(
        parentMessage.messageId,
        trimmed,
        currentUser,
        parentMessage
      );
      setReplyText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = '38px';
      }
      setTimeout(scrollToBottom, 100);
    } catch (err) {
      setError(err?.message || 'Failed to post reply.');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  if (!isOpen || !parentMessage) return null;

  const parentPostType = parentMessage.postType || 'discussion';
  const typeConfig = COMMUNITY_POST_TYPE_CONFIG[parentPostType] || COMMUNITY_POST_TYPE_CONFIG.discussion;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <aside className="w-screen max-w-lg bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200 border-l border-slate-200">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/70">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors sm:hidden"
                aria-label="Back to feed"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-2 min-w-0">
                <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
                  <MessageCircle className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 truncate">
                    Discussion Thread
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors hidden sm:block"
              aria-label="Close thread"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Main Scrollable Stream */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/40">
            {/* Parent Message Card */}
            <div className="p-4 rounded-2xl bg-white border border-emerald-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar
                    src={parentAuthorAvatar}
                    name={parentAuthorName}
                    size="sm"
                    className="shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {parentAuthorName}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {formatMessageTime(parentMessage.createdAt)}
                    </p>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${typeConfig.color}`}
                >
                  <span>{typeConfig.icon}</span>
                  <span>{typeConfig.label}</span>
                </span>
              </div>

              <div className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap break-words">
                {parentMessage.content}
              </div>

              {/* Reactions summary on parent */}
              {Object.keys(parentReactions).length > 0 && (
                <div className="flex flex-wrap items-center gap-1 pt-2 border-t border-slate-100">
                  {Object.entries(parentReactions).map(([emoji, data]) => {
                    if (!data || !data.count) return null;
                    const hasReacted = currentUserId && Array.isArray(data.users) && data.users.includes(currentUserId);
                    return (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => onToggleReaction(parentMessage.messageId, emoji)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs ${
                          hasReacted
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold'
                            : 'bg-slate-50 text-slate-600 border border-slate-200'
                        }`}
                      >
                        <span>{emoji}</span>
                        <span className="font-mono text-[10px]">{data.count}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Replies Divider */}
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Replies ({replies.length})
              </span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {/* Replies List */}
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-10 space-y-2 text-slate-400">
                <Loader2 className="animate-spin h-5 w-5 text-emerald-600" />
                <span className="text-xs">Loading replies...</span>
              </div>
            ) : replies.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <p className="text-xs font-semibold text-slate-700">
                  No replies to this discussion yet.
                </p>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                  Be the first to share feedback, suggestions, or insights.
                </p>
              </div>
            ) : (
              replies.map((reply) => {
                const isOwnReply = currentUserId && reply.senderId === currentUserId;
                return (
                  <ThreadReplyItem
                    key={reply.replyId}
                    reply={reply}
                    isOwn={isOwnReply}
                  />
                );
              })
            )}

            <div ref={repliesEndRef} className="h-1" />
          </div>

          {/* Composer Footer */}
          <div className="p-3.5 bg-white border-t border-slate-200">
            {error && (
              <p className="mb-2 text-xs text-rose-600 font-medium px-1 bg-rose-50 p-1.5 rounded-lg border border-rose-100">
                {error}
              </p>
            )}

            {currentUser ? (
              <form onSubmit={handleSendReply} className="flex items-end gap-2">
                <textarea
                  ref={textareaRef}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Reply to ${parentAuthorName}...`}
                  maxLength={2000}
                  rows={1}
                  className="flex-1 resize-none px-3.5 py-2 text-xs font-medium text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition-all placeholder:text-slate-400 max-h-[120px]"
                />

                <button
                  type="submit"
                  disabled={!replyText.trim() || isSending}
                  className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-xs shrink-0 cursor-pointer"
                  aria-label="Send reply"
                >
                  {isSending ? (
                    <Loader2 className="animate-spin h-4 w-4" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </form>
            ) : (
              <div className="p-3 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
                Please sign in to reply to this discussion.
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function ThreadReplyItem({ reply, isOwn = false }) {
  const { displayName, avatar } = useUserProfile(reply.senderId, {
    subscribe: false,
    fallbackName: resolveMemberDisplayName(reply.senderName || 'Member'),
    fallbackAvatar: reply.senderAvatar || '',
  });

  const displayTime = formatMessageTime(reply.createdAt);

  return (
    <div
      id={`reply_${reply.replyId}`}
      className={`flex w-full my-1.5 transition-all duration-300 ${
        isOwn ? 'justify-end' : 'justify-start'
      }`}
    >
      {isOwn ? (
        <div className="flex flex-col items-end max-w-[85%]">
          <div className="flex items-center justify-end gap-1.5 mb-1 px-1 text-[10px] text-slate-400 font-mono">
            <span className="font-bold text-primary-700">You</span>
            <span>•</span>
            <span>{displayTime}</span>
          </div>
          <div className="rounded-2xl rounded-tr-xs bg-primary-600 text-white shadow-xs p-3 space-y-1 min-w-0">
            <p className="text-xs text-white leading-relaxed font-normal whitespace-pre-wrap break-words">
              {reply.content}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-row items-start gap-2 max-w-[85%]">
          <div className="shrink-0 pt-0.5">
            <Avatar src={avatar} name={displayName} size="xs" />
          </div>
          <div className="flex flex-col items-start min-w-0">
            <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-slate-400 font-mono">
              <span className="font-bold text-slate-800 text-xs truncate max-w-[120px]">
                {displayName}
              </span>
              <span>•</span>
              <span>{displayTime}</span>
            </div>
            <div className="rounded-2xl rounded-tl-xs bg-white border border-slate-200 text-slate-900 shadow-2xs p-3 space-y-1 min-w-0">
              <p className="text-xs text-slate-900 leading-relaxed font-normal whitespace-pre-wrap break-words">
                {reply.content}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

CommunityThreadDrawer.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  parentMessage: PropTypes.object,
  currentUserId: PropTypes.string,
  currentUser: PropTypes.object,
  isAdmin: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  onToggleReaction: PropTypes.func,
  parentReactions: PropTypes.object,
};

ThreadReplyItem.propTypes = {
  reply: PropTypes.object.isRequired,
  isOwn: PropTypes.bool,
};
