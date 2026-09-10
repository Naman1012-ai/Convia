import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useSearchParams, useLocation } from 'react-router-dom';
import { useOrg } from '../../hooks/useOrg';
import { useAuth } from '../../hooks/useAuth';
import { useUser } from '../../hooks/useUser';
import { useToast } from '../../hooks/useToast';
import { chatService } from '../../services/chatService';
import { uploadthingService } from '../../services/uploadthingService';
import {
  CHAT_PAGE_SIZE,
  DEFAULT_CHAT_CHANNEL_ID,
  CHANNEL_TYPES,
} from '../../constants/chatSchema';
import {
  upsertMessage,
  prependOlderMessages,
  removeMessageById,
} from '../../utils/chatPagination';
import { processMessageFeed } from '../../utils/chatFeedHelpers';
import { ChatMessageItem } from '../../features/chat/ChatMessageItem';
import { ChatMessageInput } from '../../features/chat/ChatMessageInput';
import { ChatMemberList } from '../../features/chat/ChatMemberList';
import { ChatEmptyState } from '../../features/chat/ChatEmptyState';
import { ChatDateDivider } from '../../features/chat/ChatDateDivider';
import { ChatThreadDrawer } from '../../features/chat/ChatThreadDrawer';
import { ChatSearchModal } from '../../features/chat/ChatSearchModal';
import { FilePreviewModal } from '../../features/chat/FilePreviewModal';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { ChatChannelSidebar } from '../../features/chat/ChatChannelSidebar';
import { CreateChannelModal } from '../../features/chat/CreateChannelModal';
import { ChannelSettingsModal } from '../../features/chat/ChannelSettingsModal';
import {
  Hash,
  Users,
  Loader2,
  ArrowDown,
  AlertTriangle,
  RotateCcw,
  ShieldAlert,
  Search,
  WifiOff,
  Lock,
  Settings,
  Menu,
  X,
} from 'lucide-react';

export default function WorkspaceChatPage() {
  const { orgId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const { org, members, isLeader, loading: orgLoading, error: orgError } = useOrg();
  const { user } = useAuth();
  const { userProfile } = useUser();
  const { toast } = useToast();

  const effectiveUser = useMemo(() => {
    if (!user) return null;
    return {
      ...user,
      displayName: userProfile?.displayName || user.displayName,
      photoURL: userProfile?.avatar || userProfile?.photoURL || user.photoURL,
    };
  }, [user, userProfile]);

  // Phase 9: Multi-Channel State & Navigation
  const rawChannelParam = searchParams.get('channel');
  const activeChannelId = (rawChannelParam || DEFAULT_CHAT_CHANNEL_ID).toLowerCase().trim();
  const [channels, setChannels] = useState([]);
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [channelToConfigure, setChannelToConfigure] = useState(null);
  const [mobileChannelSidebarOpen, setMobileChannelSidebarOpen] = useState(false);

  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [hasUnreadBelow, setHasUnreadBelow] = useState(false);

  // Phase 8: Connection and Typing States
  const [isConnected, setIsConnected] = useState(true);
  const [typingUsers, setTypingUsers] = useState([]);

  // P1-04: Channel-level aggregated Reactions and Reply Counts
  const [channelReactions, setChannelReactions] = useState({});
  const [channelReplyCounts, setChannelReplyCounts] = useState({});

  // Modal & Active Menu States
  const [deleteMsgId, setDeleteMsgId] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [mobileRosterOpen, setMobileRosterOpen] = useState(false);
  const [activeThreadMessage, setActiveThreadMessage] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [targetHighlightedMessageId, setTargetHighlightedMessageId] = useState(null);
  const [activeMenuMessageId, setActiveMenuMessageId] = useState(null);

  // Close any open message action menu on channel switch or route transition
  useEffect(() => {
    setActiveMenuMessageId(null);
  }, [activeChannelId, location.pathname]);

  const messagesEndRef = useRef(null);
  const messageListContainerRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const activeSessionIdRef = useRef(null);
  const isInitialLoadCompleteRef = useRef(false);
  const scrollAdjustmentRef = useRef(null);

  // Preserve scroll position seamlessly when older messages are prepended
  useLayoutEffect(() => {
    if (scrollAdjustmentRef.current && messageListContainerRef.current) {
      const container = messageListContainerRef.current;
      const { prevScrollHeight, prevScrollTop } = scrollAdjustmentRef.current;
      const newScrollHeight = container.scrollHeight;
      container.scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight);
      scrollAdjustmentRef.current = null;
    }
  }, [messages]);

  // Phase 9: Subscribe to real-time Channels list & reset workspace chat state on orgId transition
  useEffect(() => {
    setChannels([]);
    setActiveThreadMessage(null);
    setTargetHighlightedMessageId(null);
    setActiveMenuMessageId(null);

    if (!orgId) return;
    const unsubChannels = chatService.subscribeToWorkspaceChannels(orgId, (channelList) => {
      setChannels(channelList || []);
    });
    return () => unsubChannels();
  }, [orgId]);

  // Derive current active channel object
  const activeChannel = useMemo(() => {
    return (
      channels.find((c) => c.channelId === activeChannelId) || {
        channelId: activeChannelId,
        name: activeChannelId,
        topic: '',
        isDefault: activeChannelId === DEFAULT_CHAT_CHANNEL_ID,
        archived: false,
      }
    );
  }, [channels, activeChannelId]);

  // Phase 8: Subscribe to RTDB connection status
  useEffect(() => {
    const unsubConnection = chatService.subscribeToConnectionState((connected) => {
      setIsConnected(connected);
    });
    return () => unsubConnection();
  }, []);

  // Ensure workspace chat never navigates to a public channel
  useEffect(() => {
    if (activeChannelId === 'public' || activeChannel?.type === 'public') {
      setSearchParams({ channel: DEFAULT_CHAT_CHANNEL_ID }, { replace: true });
    }
  }, [activeChannelId, activeChannel, setSearchParams]);

  // Phase 8: Subscribe to real-time channel typing indicators (scoped to active channel)
  useEffect(() => {
    if (!orgId) return;
    const unsubTyping = chatService.subscribeToTypingState(orgId, activeChannelId, (typers) => {
      setTypingUsers(typers);
    });
    return () => unsubTyping();
  }, [orgId, activeChannelId]);

  // P1-04: Channel-level Reaction Subscription (1 listener replaces N individual message listeners)
  useEffect(() => {
    if (!orgId || !activeChannelId) return;
    setChannelReactions({});

    const unsubReactions = chatService.subscribeToChannelReactions(orgId, activeChannelId, (reactionsMap) => {
      setChannelReactions(reactionsMap || {});
    });

    return () => {
      unsubReactions();
    };
  }, [orgId, activeChannelId]);

  // P1-04: Channel-level Reply Count Subscription (1 listener replaces N individual message listeners)
  useEffect(() => {
    if (!orgId || !activeChannelId) return;
    setChannelReplyCounts({});

    const unsubReplies = chatService.subscribeToChannelReplyCounts(orgId, activeChannelId, (replyCountsMap) => {
      setChannelReplyCounts(replyCountsMap || {});
    });

    return () => {
      unsubReplies();
    };
  }, [orgId, activeChannelId]);

  // Keyboard shortcut for search modal (Ctrl+K / Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Update read cursor checkpoint when viewing chat
  useEffect(() => {
    if (!orgId || !user?.uid || messages.length === 0) return;
    const newest = messages[messages.length - 1];
    if (newest?.messageId && newest?.createdAt) {
      chatService.updateReadState(orgId, activeChannelId, user.uid, newest.messageId, newest.createdAt);
    }
  }, [orgId, activeChannelId, user?.uid, messages]);

  // Deep-linking from notification or URL search params
  useEffect(() => {
    const targetMsgId = searchParams.get('messageId');
    const targetThreadId = searchParams.get('threadId');

    if (targetThreadId) {
      if (messages.length > 0) {
        const parent = messages.find((m) => m.messageId === targetThreadId);
        if (parent) {
          setActiveThreadMessage(parent);
          return;
        }
      }
      // If parent is not in initial batch and not loading, attempt direct lookup
      if (!loadingMessages && orgId) {
        chatService.getMessage(orgId, activeChannelId, targetThreadId).then((fetched) => {
          if (fetched && !fetched.deleted) {
            setActiveThreadMessage(fetched);
          }
        }).catch(() => {});
      }
    } else if (targetMsgId && messages.length > 0) {
      setTargetHighlightedMessageId(targetMsgId);
      setTimeout(() => {
        const el = document.getElementById(`msg_${targetMsgId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 200);
      const timer = setTimeout(() => setTargetHighlightedMessageId(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [searchParams, messages, loadingMessages, orgId, activeChannelId]);

  // Load older messages (bounded cursor pagination)
  const handleLoadOlder = useCallback(async () => {
    if (isLoadingOlder || loadingMessages || !hasMoreOlder || messages.length === 0 || !orgId) {
      return;
    }

    const container = messageListContainerRef.current;
    if (!container) return;

    const oldestKey = messages[0]?.messageId;
    if (!oldestKey) return;

    setIsLoadingOlder(true);
    const currentSession = activeSessionIdRef.current;

    // Snapshot scroll geometry before DOM update
    scrollAdjustmentRef.current = {
      prevScrollHeight: container.scrollHeight,
      prevScrollTop: container.scrollTop,
    };

    try {
      const result = await chatService.loadOlderMessages(orgId, activeChannelId, oldestKey, CHAT_PAGE_SIZE);

      if (activeSessionIdRef.current !== currentSession) return;

      if (!result.messages || result.messages.length === 0) {
        setHasMoreOlder(false);
      } else {
        setMessages((prev) => prependOlderMessages(prev, result.messages));
        setHasMoreOlder(result.hasMore);
      }
    } catch (err) {
      console.error('[WorkspaceChatPage] Error loading older messages:', err);
      toast.error('Failed to load older messages.');
    } finally {
      if (activeSessionIdRef.current === currentSession) {
        setIsLoadingOlder(false);
      }
    }
  }, [isLoadingOlder, loadingMessages, hasMoreOlder, messages, orgId, activeChannelId, toast]);

  // Initial message fetch and real-time subscription setup
  const initializeChat = useCallback(() => {
    if (!orgId) return;

    const currentSession = Symbol(`${orgId}_${activeChannelId}`);
    activeSessionIdRef.current = currentSession;
    isInitialLoadCompleteRef.current = false;
    setLoadingMessages(true);
    setLoadError(null);
    setIsLoadingOlder(false);
    setHasMoreOlder(true);
    setHasUnreadBelow(false);
    setMessages([]);

    // 1. Attach live incremental listeners immediately
    const unsubscribeLive = chatService.subscribeToLiveMessages(orgId, activeChannelId, {
      onMessageAdded: (newMsg) => {
        if (activeSessionIdRef.current !== currentSession) return;
        setMessages((prev) => {
          const updated = upsertMessage(prev, newMsg);
          if (isNearBottomRef.current || !isInitialLoadCompleteRef.current) {
            requestAnimationFrame(() => {
              if (messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
              }
            });
            setHasUnreadBelow(false);
          } else {
            if (newMsg.senderId !== user?.uid) {
              setHasUnreadBelow(true);
            }
          }
          return updated;
        });
      },
      onMessageChanged: (changedMsg) => {
        if (activeSessionIdRef.current !== currentSession) return;
        setMessages((prev) => upsertMessage(prev, changedMsg));
      },
      onMessageRemoved: (removedId) => {
        if (activeSessionIdRef.current !== currentSession) return;
        setMessages((prev) => removeMessageById(prev, removedId));
      },
      onError: (err) => {
        if (activeSessionIdRef.current !== currentSession) return;
        if (err && err.code === 'PERMISSION_DENIED') {
          console.warn('[WorkspaceChatPage] Chat subscription permission warning:', err);
          setLoadError('You do not have permission to view this channel.');
        }
      },
    });

    // 2. Fetch the initial bounded recent message batch (limitToLast 50)
    chatService
      .loadRecentMessages(orgId, activeChannelId, CHAT_PAGE_SIZE)
      .then(({ messages: initialBatch, hasMore }) => {
        if (activeSessionIdRef.current !== currentSession) return;
        setMessages((prev) => prependOlderMessages(prev, initialBatch));
        setHasMoreOlder(hasMore);
        setLoadingMessages(false);
        isInitialLoadCompleteRef.current = true;

        requestAnimationFrame(() => {
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
          }
        });
      })
      .catch((err) => {
        if (activeSessionIdRef.current !== currentSession) return;
        console.error('[WorkspaceChatPage] Failed to load initial messages:', err);
        setLoadError(err.message || 'Failed to load messages.');
        setLoadingMessages(false);
        isInitialLoadCompleteRef.current = true;
      });

    return unsubscribeLive;
  }, [orgId, activeChannelId, user?.uid]);

  useEffect(() => {
    const unsubscribe = initializeChat();
    return () => {
      activeSessionIdRef.current = null;
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [initializeChat]);

  // Scroll event handler
  const handleScroll = (e) => {
    const container = e.currentTarget;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);

    isNearBottomRef.current = distanceFromBottom < 100;
    if (isNearBottomRef.current && hasUnreadBelow) {
      setHasUnreadBelow(false);
    }

    if (scrollTop < 80 && !isLoadingOlder && hasMoreOlder && !loadingMessages) {
      handleLoadOlder();
    }
  };

  // Scroll smoothly to bottom
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      setHasUnreadBelow(false);
    }
  };

  // Channel Selection Handler
  const handleSelectChannel = (channelId) => {
    if (channelId === activeChannelId) {
      setMobileChannelSidebarOpen(false);
      return;
    }
    setSearchParams({ channel: channelId });
    setActiveThreadMessage(null);
    setMobileChannelSidebarOpen(false);
  };

  // Channel Creation Handler
  const handleCreateChannel = async ({ name, topic, type }) => {
    const created = await chatService.createChannel(orgId, { name, topic, type }, user, isLeader);
    toast.success(`Channel #${created.name} created!`);
    setSearchParams({ channel: created.channelId });
  };

  // Channel Topic Update Handler
  const handleUpdateTopic = async (topic) => {
    if (!channelToConfigure) return;
    await chatService.updateChannelTopic(orgId, channelToConfigure.channelId, topic, user, isLeader);
    toast.success('Channel topic updated!');
  };

  // Channel Archival Handler
  const handleArchiveChannel = async (archived) => {
    if (!channelToConfigure) return;
    await chatService.archiveChannel(orgId, channelToConfigure.channelId, archived, user, isLeader);
    toast.success(archived ? 'Channel archived.' : 'Channel unarchived.');
  };

  // Channel Deletion Handler
  const handleDeleteChannel = async () => {
    if (!channelToConfigure) return;
    await chatService.deleteChannel(orgId, channelToConfigure.channelId, user, isLeader);
    toast.success('Channel deleted.');
    if (activeChannelId === channelToConfigure.channelId) {
      setSearchParams({ channel: DEFAULT_CHAT_CHANNEL_ID });
    }
    setChannelToConfigure(null);
  };

  // Send message handler
  const handleSendMessage = async (content, file = null) => {
    if (!orgId || !user) return;
    if (activeChannel.archived) {
      toast.error('This channel is archived. Message sending is disabled.');
      return;
    }
    if (!content.trim() && !file) return;

    try {
      setIsSubmitting(true);
      setUploadProgress(0);
      isNearBottomRef.current = true;

      let attachmentData = null;

      if (file) {
        attachmentData = await uploadthingService.uploadFile(file, {
          workspaceId: orgId,
          userUid: user?.uid,
          onProgress: (progress) => setUploadProgress(progress),
        });
      }

      await chatService.sendMessage(orgId, activeChannelId, content, effectiveUser || user, attachmentData, members);
      toast.success('Message sent.');

      requestAnimationFrame(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      });
    } catch (err) {
      console.error('[WorkspaceChatPage] Send error:', err);
      toast.error(err.message || 'Failed to send message.');
      throw err;
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  // Edit message handler
  const handleEditMessage = async (messageId, newContent) => {
    try {
      await chatService.editMessage(orgId, activeChannelId, messageId, newContent, user.uid);
      toast.success('Message updated.');
    } catch (err) {
      console.error('[WorkspaceChatPage] Edit error:', err);
      toast.error(err.message || 'Failed to update message.');
      throw err;
    }
  };

  // Delete message handlers
  const promptDeleteMessage = (messageId) => {
    setDeleteMsgId(messageId);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteMessage = async () => {
    if (!deleteMsgId) return;

    try {
      await chatService.deleteMessage(orgId, activeChannelId, deleteMsgId, user.uid, isLeader);
      toast.success('Message and attachments deleted.');
    } catch (err) {
      console.error('[WorkspaceChatPage] Delete error:', err);
      toast.error(err.message || 'Failed to delete message.');
    } finally {
      setIsDeleteModalOpen(false);
      setDeleteMsgId(null);
    }
  };

  // Open Preview Modal
  const handleOpenPreview = (attachment) => {
    setPreviewAttachment(attachment);
    setIsPreviewModalOpen(true);
  };

  // Thread Handlers
  const handleOpenThread = (message) => {
    setActiveThreadMessage(message);
  };

  const handleCloseThread = () => {
    setActiveThreadMessage(null);
  };

  // Reaction Handler
  const handleToggleReaction = async (messageId, emoji) => {
    try {
      await chatService.toggleReaction(orgId, activeChannelId, messageId, emoji, effectiveUser || user);
    } catch (err) {
      console.error('[WorkspaceChatPage] Reaction toggle error:', err);
      const friendlyMsg = err?.message?.includes('PERMISSION_DENIED')
        ? 'Unable to update reaction. Please verify your workspace membership and try again.'
        : (err?.message || 'Failed to update reaction.');
      toast.error(friendlyMsg);
    }
  };

  // Search result click handler
  const handleSelectSearchResult = (result) => {
    if (!result) return;
    if (result.type === 'reply' && result.parentMessageId) {
      const parent = messages.find((m) => m.messageId === result.parentMessageId);
      if (parent) {
        setActiveThreadMessage(parent);
      }
    } else {
      setTargetHighlightedMessageId(result.messageId);
      setTimeout(() => {
        const el = document.getElementById(`msg_${result.messageId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 250);
      const timer = setTimeout(() => setTargetHighlightedMessageId(null), 3500);
      return () => clearTimeout(timer);
    }
  };

  // Feed Decoration Pipeline
  const decoratedFeed = useMemo(() => {
    return processMessageFeed(messages, user?.uid);
  }, [messages, user?.uid]);

  // Loading States
  if (orgLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto" />
          <p className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider">
            Loading Workspace Chat...
          </p>
        </div>
      </div>
    );
  }

  if (orgError) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center p-4 bg-slate-50">
        <div className="max-w-md w-full p-6 bg-white border border-rose-200 rounded-2xl shadow-xl text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-600">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Unable to Access Workspace</h3>
          <p className="text-xs text-slate-600">{orgError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-white overflow-hidden relative">
      {/* Phase 8: Connection Offline/Reconnecting Alert Banner */}
      {!isConnected && (
        <div className="bg-rose-600 text-white px-4 py-1.5 text-xs font-semibold flex items-center justify-center gap-2 select-none animate-in fade-in duration-150 z-30 shrink-0 shadow-xs">
          <WifiOff className="h-3.5 w-3.5 animate-pulse shrink-0" />
          <span>Connection lost. Reconnecting to Convia real-time chat...</span>
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Phase 9: Desktop Left Channels Sidebar Rail */}
        <div className="hidden md:block">
          <ChatChannelSidebar
            workspaceId={orgId}
            currentUserId={user?.uid}
            activeChannelId={activeChannelId}
            channels={channels}
            isLeader={isLeader}
            onSelectChannel={handleSelectChannel}
            onOpenCreateChannel={() => setIsCreateChannelOpen(true)}
            onOpenChannelSettings={(ch) => setChannelToConfigure(ch)}
          />
        </div>

        {/* Phase 9: Mobile Channels Drawer */}
        {mobileChannelSidebarOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex bg-slate-950/50 backdrop-blur-xs">
            <div className="w-64 h-full bg-white shadow-2xl relative flex flex-col animate-in slide-in-from-left duration-200">
              <div className="p-3 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <span className="text-xs font-mono font-bold text-slate-900">Channels</span>
                <button
                  onClick={() => setMobileChannelSidebarOpen(false)}
                  className="p-1 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
                  aria-label="Close channels drawer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <ChatChannelSidebar
                  workspaceId={orgId}
                  currentUserId={user?.uid}
                  activeChannelId={activeChannelId}
                  channels={channels}
                  isLeader={isLeader}
                  onSelectChannel={handleSelectChannel}
                  onOpenCreateChannel={() => {
                    setMobileChannelSidebarOpen(false);
                    setIsCreateChannelOpen(true);
                  }}
                  onOpenChannelSettings={(ch) => {
                    setMobileChannelSidebarOpen(false);
                    setChannelToConfigure(ch);
                  }}
                />
              </div>
            </div>
            <div className="flex-1" onClick={() => setMobileChannelSidebarOpen(false)} />
          </div>
        )}

        {/* Central Chat Column */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-50/40 relative">
          {/* Chat Header Bar */}
          <div className="h-14 px-4 sm:px-6 border-b border-slate-200 bg-white flex items-center justify-between shrink-0 z-10">
            <div className="flex items-center gap-2.5 min-w-0">
              {/* Mobile Channel Toggle Button */}
              <button
                type="button"
                onClick={() => setMobileChannelSidebarOpen(true)}
                className="md:hidden p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shrink-0"
                aria-label="Open channels list"
              >
                <Menu className="h-4 w-4" />
              </button>

              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-100 bg-indigo-50 text-indigo-600 shrink-0">
                {activeChannel.isDefault ? (
                  <Hash className="h-4 w-4 stroke-[2.5]" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-black text-slate-900 truncate">
                    {activeChannel.name || activeChannelId}
                  </h2>
                  {activeChannel.isDefault && (
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-mono font-bold shrink-0">
                      Default
                    </span>
                  )}
                  {activeChannel.archived && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider shrink-0">
                      Archived
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 truncate">
                  {activeChannel.topic || (
                    activeChannel.isDefault
                      ? `Real-time team chat for ${org?.name || 'Workspace'}`
                      : 'Internal workspace channel'
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Channel Settings Button (if leader) */}
              {isLeader && (
                <button
                  type="button"
                  onClick={() => setChannelToConfigure(activeChannel)}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 text-xs font-semibold flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                  title="Channel Settings"
                >
                  <Settings className="h-4 w-4 text-slate-600" />
                  <span className="hidden sm:inline">Settings</span>
                </button>
              )}

              {/* Message Discovery Search Button */}
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 text-xs font-semibold flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                title="Search messages (Ctrl+K)"
                aria-label="Search messages"
              >
                <Search className="h-4 w-4 text-indigo-600" />
                <span className="hidden sm:inline">Search</span>
                <kbd className="hidden sm:inline px-1 py-0.2 rounded bg-white text-[9px] font-mono border border-slate-200 text-slate-400">
                  ⌘K
                </kbd>
              </button>

              {/* Mobile Roster Toggle */}
              <button
                onClick={() => setMobileRosterOpen(!mobileRosterOpen)}
                className="lg:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-label="Toggle team roster"
              >
                <Users className="h-4 w-4 text-indigo-600" />
                <span>({members.length})</span>
              </button>
            </div>
          </div>

          {/* Phase 9: Archived Channel Warning Banner */}
          {activeChannel.archived && (
            <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-semibold flex items-center gap-2 select-none shrink-0 shadow-xs">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>This channel is archived and read-only. Message sending is disabled.</span>
            </div>
          )}

          {/* Message Stream Area */}
          <div
            ref={messageListContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-4 space-y-0.5 relative"
          >
            {/* Older Messages Loading Indicator */}
            {isLoadingOlder && (
              <div className="flex items-center justify-center py-2 text-xs text-indigo-600 font-medium animate-in fade-in">
                <Loader2 className="animate-spin h-3.5 w-3.5 mr-1.5" />
                <span>Loading older messages...</span>
              </div>
            )}

            {/* Empty State */}
            {!loadingMessages && messages.length === 0 && !loadError && (
              <ChatEmptyState
                channelName={activeChannel.name || activeChannelId}
              />
            )}

            {/* Error Banner */}
            {loadError && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{loadError}</span>
                </div>
                <button
                  onClick={initializeChat}
                  className="flex items-center gap-1 font-bold underline hover:no-underline"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Retry</span>
                </button>
              </div>
            )}

            {/* Render Decorated Feed Items */}
            {decoratedFeed.map((item) => {
              if (item?.type === 'date_divider' || item?.isDivider) {
                return (
                  <ChatDateDivider
                    key={item.id}
                    label={item.label || item.dateLabel}
                    date={item.date || item.timestamp}
                  />
                );
              }

              if (!item || !item.message) return null;

              return (
                <ChatMessageItem
                  key={item.message.messageId || item.id}
                  workspaceId={orgId}
                  channelId={activeChannelId}
                  message={item.message}
                  reactions={channelReactions[item.message.messageId] || {}}
                  replyCount={channelReplyCounts[item.message.messageId] || 0}
                  currentUserId={user?.uid}
                  isWorkspaceAdmin={isLeader}
                  isGrouped={item.isGrouped}
                  isFirstInGroup={item.isFirstInGroup}
                  isLastInGroup={item.isLastInGroup}
                  members={members}
                  isHighlighted={item.message.messageId === targetHighlightedMessageId}
                  activeMenuMessageId={activeMenuMessageId}
                  onSetActiveMenuMessageId={setActiveMenuMessageId}
                  onDeleteMessage={promptDeleteMessage}
                  onEditMessage={handleEditMessage}
                  onOpenPreview={handleOpenPreview}
                  onOpenThread={handleOpenThread}
                  onToggleReaction={handleToggleReaction}
                />
              );
            })}

            <div ref={messagesEndRef} className="h-2" />
          </div>

          {/* Floating Unread Scroll-To-Bottom Pill */}
          {hasUnreadBelow && (
            <div className="absolute bottom-20 right-6 z-20 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <button
                onClick={scrollToBottom}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-600 text-white font-semibold text-xs shadow-lg hover:bg-indigo-700 transition-all transform hover:scale-105"
              >
                <ArrowDown className="h-3.5 w-3.5 animate-bounce" />
                <span>New messages below</span>
              </button>
            </div>
          )}

          {/* Message Input Box with Typing Indicators */}
          <ChatMessageInput
            workspaceId={orgId}
            user={effectiveUser || user}
            onSendMessage={handleSendMessage}
            isSubmitting={isSubmitting}
            uploadProgress={uploadProgress}
            channelId={activeChannelId}
            channelName={activeChannel.name || activeChannelId}
            disabled={Boolean(loadError) || !isConnected || activeChannel.archived}
            placeholder={activeChannel.archived ? 'This channel is archived.' : undefined}
            members={members}
            typingUsers={typingUsers}
          />
        </div>

        {/* Phase 6: Thread Drawer */}
        {activeThreadMessage && (
          <ChatThreadDrawer
            workspaceId={orgId}
            channelId={activeChannelId}
            parentMessage={activeThreadMessage}
            currentUserId={user?.uid}
            currentUser={effectiveUser || user}
            members={members}
            isWorkspaceAdmin={isLeader}
            onClose={handleCloseThread}
            onOpenPreview={handleOpenPreview}
          />
        )}

        {/* Desktop Right Member Roster */}
        {!activeThreadMessage && (
          <div className="hidden lg:block">
            <ChatMemberList members={members} currentUserId={user?.uid} />
          </div>
        )}

        {/* Mobile Drawer Member Roster */}
        {mobileRosterOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex justify-end bg-slate-950/50 backdrop-blur-xs">
            <div className="w-72 h-full bg-white shadow-2xl relative flex flex-col animate-in slide-in-from-right duration-200">
              <div className="p-3 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <span className="text-xs font-mono font-bold text-slate-900">Workspace Roster</span>
                <button
                  onClick={() => setMobileRosterOpen(false)}
                  className="px-2 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-colors"
                  aria-label="Close roster"
                >
                  Close
                </button>
              </div>
              <ChatMemberList members={members} currentUserId={user?.uid} />
            </div>
          </div>
        )}

        {/* Message Discovery Search Modal */}
        <ChatSearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          workspaceId={orgId}
          channelId={activeChannelId}
          members={members}
          onSelectResult={handleSelectSearchResult}
        />

        {/* File Lightbox / PDF Preview Modal */}
        <FilePreviewModal
          isOpen={isPreviewModalOpen}
          onClose={() => setIsPreviewModalOpen(false)}
          attachment={previewAttachment}
        />

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={confirmDeleteMessage}
          title="Delete Message & Attachment"
          message="Are you sure you want to delete this message? Attached files will also be permanently deleted from workspace storage."
          confirmText="Delete Message"
          variant="danger"
        />

        {/* Phase 9: Create Channel Modal */}
        <CreateChannelModal
          isOpen={isCreateChannelOpen}
          onClose={() => setIsCreateChannelOpen(false)}
          onCreateChannel={handleCreateChannel}
        />

        {/* Phase 9: Channel Settings Modal */}
        <ChannelSettingsModal
          isOpen={Boolean(channelToConfigure)}
          onClose={() => setChannelToConfigure(null)}
          channel={channelToConfigure}
          isLeader={isLeader}
          onUpdateTopic={handleUpdateTopic}
          onArchiveChannel={handleArchiveChannel}
          onDeleteChannel={handleDeleteChannel}
        />
      </div>
    </div>
  );
}
