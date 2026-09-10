import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  Globe,
  X,
  Send,
  Loader2,
  Sparkles,
  MessageSquare,
  Users,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useUser } from '../../hooks/useUser';
import { useUserProfiles } from '../../hooks/useUserProfile';
import { chatService } from '../../services/chatService';
import { Avatar } from '../../components/ui/Avatar';
import { formatTimestamp } from '../../utils/formatting';

export function PublicIdeaChatDrawer({
  isOpen,
  onClose,
  initialIdeaContext = null,
}) {
  const { user } = useAuth();
  const { userProfile } = useUser();

  const effectiveUser = React.useMemo(() => {
    if (!user) return null;
    return {
      ...user,
      displayName: userProfile?.displayName || user.displayName,
      photoURL: userProfile?.avatar || userProfile?.photoURL || user.photoURL,
    };
  }, [user, userProfile]);

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [error, setError] = useState(null);

  const messageUserIds = React.useMemo(() => {
    return Array.from(new Set(messages.map((m) => m.senderId).filter(Boolean)));
  }, [messages]);

  const { resolveName, resolveAvatar } = useUserProfiles(messageUserIds);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Auto-scroll to bottom on new messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Prefill idea reference if opened with context
  useEffect(() => {
    if (isOpen && initialIdeaContext?.title && !content) {
      setContent(`Re: "${initialIdeaContext.title}" — `);
    }
  }, [isOpen, initialIdeaContext]);

  // Subscribe to public idea chat messages
  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    const unsubscribeMessages = chatService.subscribeToPublicIdeaChatMessages({
      onInitialLoaded: (loadedMsgs) => {
        setMessages(loadedMsgs);
        setLoading(false);
        setTimeout(scrollToBottom, 100);
      },
      onError: (err) => {
        console.error('[PublicIdeaChatDrawer] Error loading messages:', err);
        setError('Failed to load public discussion messages.');
        setLoading(false);
      },
    });

    const unsubscribeTyping = chatService.subscribeToPublicIdeaChatTyping(
      user?.uid,
      (typers) => setTypingUsers(typers)
    );

    return () => {
      if (typeof unsubscribeMessages === 'function') unsubscribeMessages();
      if (typeof unsubscribeTyping === 'function') unsubscribeTyping();
    };
  }, [isOpen, user?.uid]);

  // Handle typing indicator trigger
  const handleInputChange = (e) => {
    setContent(e.target.value);
    if (!effectiveUser) return;

    chatService.setPublicIdeaChatTypingState(effectiveUser, true).catch(() => {});

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      chatService.setPublicIdeaChatTypingState(effectiveUser, false).catch(() => {});
    }, 2500);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!content.trim() || isSending || !effectiveUser) return;

    setIsSending(true);
    setError(null);

    try {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      await chatService.setPublicIdeaChatTypingState(effectiveUser, false);

      await chatService.sendPublicIdeaChatMessage(content.trim(), effectiveUser);
      setContent('');
      scrollToBottom();
    } catch (err) {
      setError(err?.message || 'Failed to send message.');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <aside className="w-screen max-w-md bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200">
          {/* Drawer Header */}
          <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between shrink-0 shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-white/15 text-white backdrop-blur-sm">
                <Globe className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold truncate">Public Ideas Channel</h2>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/30 border border-white/20 text-[10px] font-bold uppercase tracking-wider">
                    Community
                  </span>
                </div>
                <p className="text-[11px] text-emerald-100 truncate">
                  Open discussion for all Convia creators
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-emerald-100 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close drawer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Context Banner if opened with specific idea reference */}
          {initialIdeaContext && (
            <div className="bg-emerald-50 px-4 py-2 border-b border-emerald-100 text-xs text-emerald-900 flex items-center gap-2 shrink-0">
              <Sparkles className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span className="truncate">
                Discussing: <strong>{initialIdeaContext.title}</strong>
              </span>
            </div>
          )}

          {/* Message Stream Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full space-y-2 text-slate-400">
                <Loader2 className="animate-spin h-6 w-6 text-emerald-600" />
                <span className="text-xs font-medium">Connecting to community chat...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-3 my-auto">
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 shadow-xs">
                  <MessageSquare className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Welcome to the Public Ideas Channel!
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                    Connect with creators across Convia, discuss public ideas, suggest tech stacks, and find collaborators.
                  </p>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-[11px] font-medium text-slate-600">
                  <Users className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Open to all Convia users</span>
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const isOwn = (effectiveUser?.uid || user?.uid) && msg.senderId === (effectiveUser?.uid || user?.uid);
                const senderName = isOwn ? 'You' : resolveName(msg.senderId, msg.senderName);
                const senderAvatar = resolveAvatar(msg.senderId, msg.senderAvatar);

                return (
                  <div
                    key={msg.messageId}
                    className={`flex items-start gap-2.5 ${isOwn ? 'flex-row-reverse' : ''}`}
                  >
                    {!isOwn && (
                      <Avatar
                        src={senderAvatar}
                        name={senderName}
                        size="xs"
                        className="shrink-0 mt-1"
                      />
                    )}

                    <div className={`max-w-[80%] space-y-0.5 ${isOwn ? 'items-end' : ''}`}>
                      <div className={`flex items-center gap-2 text-[10px] text-slate-400 ${isOwn ? 'justify-end' : ''}`}>
                        <span className="font-semibold text-slate-700">
                          {senderName}
                        </span>
                        <span>{formatTimestamp(msg.createdAt)}</span>
                      </div>

                      <div
                        className={`p-3 rounded-2xl text-xs leading-relaxed break-words shadow-xs ${
                          isOwn
                            ? 'bg-emerald-600 text-white font-medium rounded-tr-xs'
                            : 'bg-white border border-slate-200 text-slate-900 font-medium rounded-tl-xs'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            <div ref={messagesEndRef} className="h-1" />
          </div>

          {/* Typing indicator */}
          {typingUsers.length > 0 && (
            <div className="px-4 py-1.5 text-[11px] text-slate-500 bg-white border-t border-slate-100 italic flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                {typingUsers.map((u) => u.displayName).join(', ')}{' '}
                {typingUsers.length === 1 ? 'is' : 'are'} typing...
              </span>
            </div>
          )}

          {/* Drawer Footer / Composer */}
          <div className="p-3 bg-white border-t border-slate-200">
            {error && (
              <p className="mb-2 text-xs text-rose-600 font-medium px-1">
                {error}
              </p>
            )}

            {user ? (
              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <input
                  type="text"
                  value={content}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Share your thoughts on public ideas..."
                  maxLength={2000}
                  className="flex-1 px-3.5 py-2.5 text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition-all placeholder:text-slate-400 shadow-2xs"
                />

                <button
                  type="submit"
                  disabled={!content.trim() || isSending}
                  className="p-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-xs"
                  aria-label="Send message"
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
                Please sign in to participate in the public community discussion.
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

PublicIdeaChatDrawer.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  initialIdeaContext: PropTypes.shape({
    title: PropTypes.string,
    ideaId: PropTypes.string,
  }),
};
