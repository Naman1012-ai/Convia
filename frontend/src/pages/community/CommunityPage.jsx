import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import {
  Globe,
  Search,
  Users,
  Flame,
  MessageCircle,
  Menu,
  X,
  Compass,
  Sparkles,
  ArrowRight,
  Filter,
  Loader2,
  RefreshCw,
  AlertCircle,
  SlidersHorizontal,
  Bookmark,
  Pin,
  Plus,
  Activity,
  PanelRight,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useUser } from '../../hooks/useUser';
import { useUserProfiles } from '../../hooks/useUserProfile';
import { useToast } from '../../hooks/useToast';
import { chatService } from '../../services/chatService';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { CreatePublicIdeaModal } from '../../features/ideas/CreatePublicIdeaModal';
import { CommunityNav } from '../../features/community/CommunityNav';
import { CommunityComposer } from '../../features/community/CommunityComposer';
import { CommunityDiscussionCard } from '../../features/community/CommunityDiscussionCard';
import { CommunityDiscoveryPanel } from '../../features/community/CommunityDiscoveryPanel';
import { CommunityThreadDrawer } from '../../features/community/CommunityThreadDrawer';
import { CommunityWelcomeCard } from '../../features/community/CommunityWelcomeCard';
import { CommunityMembersModal } from '../../features/community/CommunityMembersModal';
import { ChatDateDivider } from '../../features/chat/ChatDateDivider';
import { processMessageFeed } from '../../utils/chatFeedHelpers';
import {
  COMMUNITY_POST_TYPES,
  COMMUNITY_POST_TYPE_CONFIG,
} from '../../constants/chatSchema';
import {
  resolveMemberDisplayName,
  isMessageAuthoredByUser,
  getMessageAuthorUid,
} from '../../utils/memberIdentity';

export default function CommunityPage() {
  const { user } = useAuth();
  const { userProfile } = useUser();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Effective user with synchronized display name
  const effectiveUser = useMemo(() => {
    if (!user) return null;
    return {
      ...user,
      displayName: userProfile?.displayName || user.displayName,
      photoURL: userProfile?.avatar || userProfile?.photoURL || user.photoURL,
    };
  }, [user, userProfile]);

  // Data States
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);

  // Aggregated Channel-level Reactions & Reply Counts
  const [channelReactions, setChannelReactions] = useState({});
  const [channelReplyCounts, setChannelReplyCounts] = useState({});
  const [userRepliedDiscussions, setUserRepliedDiscussions] = useState({});
  const [repliesLoading, setRepliesLoading] = useState(true);

  // Filter & Search States
  const rawFilterParam = searchParams.get('type') || 'all';
  const [activeFilter, setActiveFilter] = useState(rawFilterParam);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [isSearchVisible, setIsSearchVisible] = useState(Boolean(searchParams.get('q')));

  // Sorting State
  const rawSortParam = searchParams.get('sort') || 'recent';
  const [sortBy, setSortBy] = useState(rawSortParam);

  // Saved Discussions State
  const [savedDiscussionsMap, setSavedDiscussionsMap] = useState({});
  const [savedLoading, setSavedLoading] = useState(true);

  // Pinned Discussion State
  const [pinnedDiscussion, setPinnedDiscussion] = useState(null);

  // Community Members Modal State
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);

  // Thread Drawer State
  const [activeThreadMessage, setActiveThreadMessage] = useState(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);

  // Turn into Idea Modal State
  const [turnIntoIdeaInitialValues, setTurnIntoIdeaInitialValues] = useState(null);
  const [isCreateIdeaModalOpen, setIsCreateIdeaModalOpen] = useState(false);

  // Deletion Modal State
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Layout & Collapsible Panel States
  const [isLeftNavCollapsed, setIsLeftNavCollapsed] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);

  // Mobile / Responsive Sheets
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isMobileDiscoveryOpen, setIsMobileDiscoveryOpen] = useState(false);

  // Active three-dot menu state tracking { messageId, anchorRect }
  const [activeMenuState, setActiveMenuState] = useState(null);

  const handleOpenMenu = useCallback((messageId, anchorRect) => {
    setActiveMenuState({ messageId, anchorRect });
  }, []);

  const handleCloseMenu = useCallback(() => {
    setActiveMenuState(null);
  }, []);

  // Welcome banner dismiss state
  const [isWelcomeDismissed, setIsWelcomeDismissed] = useState(false);

  const composerRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // 1. Subscribe to Live Community Messages
  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = chatService.subscribeToPublicIdeaChatMessages({
      onInitialLoaded: (loadedMessages) => {
        setMessages(loadedMessages);
        setLoading(false);
      },
      onError: (err) => {
        console.error('[CommunityPage] Error loading messages:', err);
        setError('Unable to load community discussions. Please check your network connection.');
        setLoading(false);
      },
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // 2. Subscribe to Aggregated Reply Counts & User-Replied Threads
  useEffect(() => {
    const unsubReplies = chatService.subscribeToPublicIdeasReplyCounts((countsMap, userRepliesMap) => {
      setChannelReplyCounts(countsMap || {});
      setUserRepliedDiscussions(userRepliesMap || {});
      setRepliesLoading(false);
    });
    return () => unsubReplies();
  }, []);

  // 3. Subscribe to Aggregated Reactions (Single Listener)
  useEffect(() => {
    const unsubReactions = chatService.subscribeToPublicIdeasReactions((reactionsMap) => {
      setChannelReactions(reactionsMap || {});
    });
    return () => unsubReactions();
  }, []);

  // 4. Subscribe to Real-Time Typing Indicators
  useEffect(() => {
    const unsubTyping = chatService.subscribeToPublicIdeaChatTyping(
      user?.uid,
      (typers) => setTypingUsers(typers)
    );
    return () => unsubTyping();
  }, [user?.uid]);

  // 5. Subscribe to User's Saved Discussions
  useEffect(() => {
    if (!user?.uid) {
      setSavedDiscussionsMap({});
      setSavedLoading(false);
      return;
    }
    const unsubSaved = chatService.subscribeToUserSavedDiscussions(user.uid, (savedMap) => {
      setSavedDiscussionsMap(savedMap || {});
      setSavedLoading(false);
    });
    return () => unsubSaved();
  }, [user?.uid]);

  // 6. Subscribe to Featured / Pinned Community Discussion
  useEffect(() => {
    const unsubPinned = chatService.subscribeToPinnedPublicIdeaDiscussion((pinnedData) => {
      setPinnedDiscussion(pinnedData || null);
    });
    return () => unsubPinned();
  }, []);

  // 7. Bidirectional URL Search Parameters Synchronization
  useEffect(() => {
    const urlType = searchParams.get('type') || 'all';
    if (urlType !== activeFilter) {
      setActiveFilter(urlType);
    }
    const urlSort = searchParams.get('sort') || 'recent';
    if (urlSort !== sortBy) {
      setSortBy(urlSort);
    }
    const urlQ = searchParams.get('q') || '';
    if (urlQ !== searchQuery) {
      setSearchQuery(urlQ);
      if (urlQ) setIsSearchVisible(true);
    }
  }, [searchParams]);

  // 8. Deep-Linking: Locate discussion by messageId or open thread by threadId
  useEffect(() => {
    if (loading) return;

    const targetThreadId = searchParams.get('threadId');
    const targetMsgId = searchParams.get('messageId');

    if (targetThreadId && messages.length > 0) {
      const parent = messages.find((m) => m.messageId === targetThreadId);
      if (parent) {
        setActiveThreadMessage(parent);
      }
    }

    if (targetMsgId && messages.length > 0) {
      setHighlightedMessageId(targetMsgId);
      setTimeout(() => {
        const el = document.getElementById(`msg_${targetMsgId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.focus?.();
        }
      }, 300);
    }
  }, [loading, searchParams, messages]);

  // Filter change handler
  const handleSelectFilter = (filterId) => {
    setActiveFilter(filterId);
    handleCloseMenu();
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (filterId === 'all') next.delete('type');
      else next.set('type', filterId);
      return next;
    });
  };

  // Sort change handler
  const handleSortChange = (sortOption) => {
    setSortBy(sortOption);
    handleCloseMenu();
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (sortOption === 'recent') next.delete('sort');
      else next.set('sort', sortOption);
      return next;
    });
  };

  // Search input change handler
  const handleSearchChange = (val) => {
    setSearchQuery(val);
    handleCloseMenu();
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (!val) next.delete('q');
      else next.set('q', val);
      return next;
    });
  };

  // Focus and scroll to composer
  const handleFocusComposer = () => {
    if (composerRef.current) {
      composerRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      const textarea = composerRef.current.querySelector('textarea');
      if (textarea) textarea.focus();
    }
  };

  // Typing debounce emitter
  const handleUserTyping = () => {
    if (!effectiveUser?.uid) return;
    chatService.setPublicIdeaChatTypingState(effectiveUser, true).catch(() => {});

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      chatService.setPublicIdeaChatTypingState(effectiveUser, false).catch(() => {});
    }, 2500);
  };

  // Send new community message
  const handleSendMessage = async (content, postType) => {
    if (!effectiveUser?.uid) {
      toast.info('Please sign in to post a discussion.');
      return;
    }

    try {
      await chatService.sendPublicIdeaChatMessage({
        user: effectiveUser,
        content,
        postType,
      });

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      chatService.setPublicIdeaChatTypingState(effectiveUser, false).catch(() => {});

      toast.success(
        postType === COMMUNITY_POST_TYPES.IDEA
          ? 'Idea posted to community!'
          : postType === COMMUNITY_POST_TYPES.QUESTION
          ? 'Question asked!'
          : 'Discussion posted!'
      );
    } catch (err) {
      console.error('[CommunityPage] Send error:', err);
      toast.error('Unable to send your message. Please try again.');
      throw err;
    }
  };

  // Open thread drawer
  const handleOpenThread = (msg) => {
    setActiveThreadMessage(msg);
    handleCloseMenu();
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('threadId', msg.messageId);
      return next;
    });
  };

  // Close thread drawer
  const handleCloseThread = () => {
    setActiveThreadMessage(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('threadId');
      return next;
    });
  };

  // Toggle reaction on discussion
  const handleToggleReaction = async (messageId, emoji) => {
    if (!effectiveUser?.uid) {
      toast.info('Please sign in to react to discussions.');
      return;
    }

    try {
      await chatService.togglePublicIdeaMessageReaction(messageId, emoji, effectiveUser.uid);
    } catch (err) {
      console.error('[CommunityPage] Reaction error:', err);
      toast.error('Unable to update reaction.');
    }
  };

  // Edit discussion message
  const handleEditMessage = async (messageId, newContent) => {
    if (!effectiveUser?.uid) return;
    try {
      await chatService.editPublicIdeaChatMessage(messageId, newContent, effectiveUser.uid);
      toast.success('Discussion updated.');
    } catch (err) {
      console.error('[CommunityPage] Edit error:', err);
      toast.error(err.message || 'Failed to update discussion.');
      throw err;
    }
  };

  // Delete discussion message
  const handleConfirmDelete = async () => {
    if (!messageToDelete?.messageId || !effectiveUser?.uid) return;
    try {
      setIsDeleting(true);
      await chatService.deletePublicIdeaChatMessage(
        messageToDelete.messageId,
        effectiveUser.uid,
        Boolean(userProfile?.isAdmin || userProfile?.role === 'admin' || userProfile?.role === 'superadmin')
      );
      toast.success('Discussion deleted.');
      setMessageToDelete(null);
    } catch (err) {
      console.error('[CommunityPage] Delete error:', err);
      toast.error('Failed to delete discussion.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Turn Discussion into Proposal Modal
  const handleTurnIntoIdea = (msg) => {
    setTurnIntoIdeaInitialValues({
      title: (msg.content || '').split('\n')[0].substring(0, 80) || 'Community Idea',
      description: msg.content || '',
      category: 'Discussion Proposal',
      authorName: resolveMemberDisplayName(msg.senderName || 'Community Member'),
      sourceMessageId: msg.messageId,
    });
    setIsCreateIdeaModalOpen(true);
  };

  // Save or unsave discussion with optimistic UI and rollback
  const handleToggleSave = async (msg) => {
    const currentAuthUid = user?.uid || effectiveUser?.uid;
    if (!currentAuthUid) {
      toast.info('Please sign in to save discussions.');
      return;
    }
    const msgId = (msg?.messageId || msg?.id || '').trim();
    if (!msgId) {
      console.warn('[CommunityPage] Invalid discussion object for save:', msg);
      toast.error('Unable to save discussion. Invalid discussion ID.');
      return;
    }
    const isCurrentlySaved = Boolean(savedDiscussionsMap[msgId]);
    const previousMap = { ...savedDiscussionsMap };

    // Optimistic UI update
    setSavedDiscussionsMap((prev) => {
      const next = { ...prev };
      if (isCurrentlySaved) {
        delete next[msgId];
      } else {
        next[msgId] = { savedAt: Date.now(), messageId: msgId };
      }
      return next;
    });

    try {
      if (isCurrentlySaved) {
        await chatService.unsavePublicIdeaDiscussion(currentAuthUid, msgId);
        toast.success('Removed from saved discussions.');
      } else {
        await chatService.savePublicIdeaDiscussion(currentAuthUid, msgId);
        toast.success('Discussion saved to your bookmarks.');
      }
    } catch (err) {
      console.error('[CommunityPage] Save/unsave discussion write failure:', {
        code: err?.code,
        message: err?.message,
        discussionId: msgId,
        uid: currentAuthUid,
        targetPath: `user_saved_discussions/${currentAuthUid}/${msgId}`,
      });
      setSavedDiscussionsMap(previousMap);
      toast.error('Unable to update saved discussion. Please try again.');
    }
  };

  // Pin or unpin discussion (Leader / Admin only)
  const handleTogglePin = async (msg) => {
    if (!effectiveUser?.uid) return;
    const isAdmin = Boolean(
      userProfile?.isAdmin || userProfile?.role === 'admin' || userProfile?.role === 'superadmin'
    );
    if (!isAdmin) {
      toast.error('Only workspace leaders and administrators can pin discussions.');
      return;
    }

    const isCurrentlyPinned = pinnedDiscussion?.messageId === msg.messageId;
    try {
      if (isCurrentlyPinned) {
        await chatService.setPinnedPublicIdeaDiscussion(null, effectiveUser, true);
        toast.success('Discussion unpinned from top.');
      } else {
        await chatService.setPinnedPublicIdeaDiscussion(msg.messageId, effectiveUser, true);
        toast.success('Discussion pinned to top as featured.');
      }
    } catch (err) {
      toast.error('Unable to update pinned discussion.');
    }
  };

  // Filtered discussions
  const filteredMessages = useMemo(() => {
    const currentAuthUid = user?.uid || effectiveUser?.uid;
    let result = [];

    // Filter by topic / channel / activity
    if (activeFilter === 'my_discussions') {
      result = messages
        .filter((m) => m && !m.deleted)
        .filter((m) => isMessageAuthoredByUser(m, currentAuthUid));
    } else if (activeFilter === 'my_replies') {
      const myRepliedIds = (currentAuthUid && userRepliedDiscussions[currentAuthUid]) || [];
      result = messages
        .filter((m) => m && !m.deleted)
        .filter((m) => myRepliedIds.includes(m.messageId));
    } else if (activeFilter === 'saved') {
      const savedIds = Object.keys(savedDiscussionsMap);
      const messageMap = new Map(messages.map((m) => [m.messageId, m]));
      result = savedIds.map((savedId) => {
        const existing = messageMap.get(savedId);
        if (existing) return existing;
        const savedMeta = savedDiscussionsMap[savedId];
        return {
          messageId: savedId,
          deleted: true,
          content: 'This discussion was deleted or is no longer available',
          createdAt: savedMeta?.savedAt || Date.now(),
          senderId: 'unknown',
          senderName: 'Member',
          isSystem: false,
        };
      });
    } else if (activeFilter !== 'all') {
      result = messages
        .filter((m) => m && !m.deleted)
        .filter((m) => (m.postType || 'discussion') === activeFilter);
    } else {
      result = messages.filter((m) => m && !m.deleted);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (m) =>
          m.content?.toLowerCase().includes(q) ||
          m.senderName?.toLowerCase().includes(q) ||
          m.postType?.toLowerCase().includes(q)
      );
    }

    // Sorting
    if (sortBy === 'most_discussed') {
      result = [...result].sort((a, b) => {
        const repliesA = channelReplyCounts[a.messageId] || 0;
        const repliesB = channelReplyCounts[b.messageId] || 0;
        if (repliesB !== repliesA) return repliesB - repliesA;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
    } else if (sortBy === 'most_reacted') {
      result = [...result].sort((a, b) => {
        const reactionsA = Object.values(channelReactions[a.messageId] || {}).reduce(
          (sum, r) => sum + (r?.count || 0),
          0
        );
        const reactionsB = Object.values(channelReactions[b.messageId] || {}).reduce(
          (sum, r) => sum + (r?.count || 0),
          0
        );
        if (reactionsB !== reactionsA) return reactionsB - reactionsA;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
    } else {
      // Default: 'recent' chronological
      result = [...result].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    }

    // Float pinned item to the top if present
    if (pinnedDiscussion?.messageId) {
      const pinnedIndex = result.findIndex((m) => m.messageId === pinnedDiscussion.messageId);
      if (pinnedIndex > 0) {
        const [pinnedMsg] = result.splice(pinnedIndex, 1);
        result.unshift(pinnedMsg);
      }
    }

    return result;
  }, [
    messages,
    activeFilter,
    searchQuery,
    sortBy,
    channelReplyCounts,
    channelReactions,
    user?.uid,
    effectiveUser?.uid,
    userRepliedDiscussions,
    savedDiscussionsMap,
    pinnedDiscussion?.messageId,
  ]);

  // Compute feed with chronological date dividers and consecutive message grouping
  const decoratedFeed = useMemo(() => {
    return processMessageFeed(filteredMessages);
  }, [filteredMessages]);

  // Channel discussion counts
  const discussionCounts = useMemo(() => {
    const counts = { all: 0 };
    Object.values(COMMUNITY_POST_TYPES).forEach((type) => {
      counts[type] = 0;
    });

    messages.forEach((msg) => {
      if (!msg || msg.deleted) return;
      counts.all += 1;
      const type = msg.postType || COMMUNITY_POST_TYPES.DISCUSSION;
      if (counts[type] !== undefined) {
        counts[type] += 1;
      }
    });

    return counts;
  }, [messages]);

  // Activity counts
  const activityCounts = useMemo(() => {
    const currentAuthUid = user?.uid || effectiveUser?.uid;
    const myDiscussions = currentAuthUid
      ? messages.filter((m) => m && !m.deleted && isMessageAuthoredByUser(m, currentAuthUid)).length
      : 0;
    const myRepliedIds = (currentAuthUid && userRepliedDiscussions[currentAuthUid]) || [];
    const myReplies = myRepliedIds.length;
    const saved = Object.keys(savedDiscussionsMap).length;

    return {
      myDiscussions,
      myReplies,
      saved,
    };
  }, [messages, user?.uid, effectiveUser?.uid, userRepliedDiscussions, savedDiscussionsMap]);

  // Active filter label
  const activeFilterLabel = useMemo(() => {
    if (activeFilter === 'all') return 'All Discussions';
    if (activeFilter === 'my_discussions') return 'My Discussions';
    if (activeFilter === 'my_replies') return 'My Replies';
    if (activeFilter === 'saved') return 'Saved Discussions';
    return COMMUNITY_POST_TYPE_CONFIG[activeFilter]?.label || activeFilter;
  }, [activeFilter]);

  // Unique creators count
  const uniqueCreatorsCount = useMemo(() => {
    const uids = new Set(messages.map((m) => m.senderId).filter(Boolean));
    return uids.size;
  }, [messages]);

  const activeTypersText = useMemo(() => {
    if (typingUsers.length === 0) return null;
    const names = typingUsers.map((u) => u.displayName || 'Someone');
    if (names.length === 1) return `${names[0]} is typing...`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
    return `${names[0]} and ${names.length - 1} others are typing...`;
  }, [typingUsers]);

  const topicTabs = [
    { id: 'all', label: 'All', icon: Globe },
    { id: COMMUNITY_POST_TYPES.IDEA, label: 'Ideas', icon: Sparkles },
    { id: COMMUNITY_POST_TYPES.QUESTION, label: 'Questions', icon: MessageCircle },
    { id: COMMUNITY_POST_TYPES.DISCUSSION, label: 'Discussions', icon: MessageCircle },
    { id: COMMUNITY_POST_TYPES.COLLABORATION, label: 'Collaboration', icon: Users },
  ];

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-4 space-y-4">
      {/* ============================================================ */}
      {/* TOP HEADER — Clean, focused, non-congested                    */}
      {/* ============================================================ */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-2xs">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                Convia Community
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider border border-emerald-200/60">
                Open Discussions
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium hidden sm:block">
              Share ideas, ask questions, and collaborate with creators.
            </p>
          </div>
        </div>

        {/* Global Quick Actions */}
        <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
          {/* Search Toggle */}
          <button
            type="button"
            onClick={() => setIsSearchVisible((prev) => !prev)}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              isSearchVisible || searchQuery
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="Search discussions"
            aria-label="Toggle search"
          >
            <Search className="h-4 w-4" />
          </button>

          {/* Toggle Community Pulse (Activity Panel) on Desktop */}
          <button
            type="button"
            onClick={() => setIsRightPanelOpen((prev) => !prev)}
            className={`hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
              isRightPanelOpen
                ? 'bg-slate-100 border-slate-300 text-slate-800'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title={isRightPanelOpen ? 'Hide community pulse' : 'Show community pulse'}
          >
            <Activity className="h-3.5 w-3.5 text-emerald-600" />
            <span>Pulse</span>
          </button>

          {/* Mobile Channels Drawer Toggle */}
          <button
            type="button"
            onClick={() => setIsMobileNavOpen(true)}
            className="lg:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <Filter className="h-3.5 w-3.5 text-slate-500" />
            <span>Channels</span>
          </button>

          {/* Mobile Trending Drawer Toggle */}
          <button
            type="button"
            onClick={() => setIsMobileDiscoveryOpen(true)}
            className="xl:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <Flame className="h-3.5 w-3.5 text-amber-500" />
            <span>Trending</span>
          </button>

          {/* Members Modal Trigger */}
          <button
            type="button"
            onClick={() => setIsMembersModalOpen(true)}
            className="hidden sm:flex items-center gap-1.5 bg-white hover:bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
            title="View community creators"
          >
            <Users className="h-3.5 w-3.5 text-emerald-600" />
            <span>{uniqueCreatorsCount}</span>
          </button>

          {/* Primary CTA: Start a Discussion */}
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={handleFocusComposer}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-1.5 rounded-xl shadow-xs transition-all cursor-pointer"
          >
            Start a Discussion
          </Button>
        </div>
      </header>

      {/* Expandable Scoped Search Bar */}
      {isSearchVisible && (
        <div className="relative animate-in fade-in slide-in-from-top-1 duration-150">
          <Input
            placeholder="Search discussions by keyword, idea, or author name..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 pr-9 bg-white shadow-2xs h-9 text-xs sm:text-sm"
            autoFocus
          />
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => handleSearchChange('')}
              className="absolute right-3 top-2 p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* THREE-ZONE RESPONSIVE LAYOUT (Dominant Center Feed)           */}
      {/* ============================================================ */}
      <div className="flex items-start gap-4 lg:gap-6 min-h-[600px]">
        {/* ======================================================== */}
        {/* ZONE 1 (LEFT): Community Navigation                      */}
        {/* ======================================================== */}
        <aside
          className={`hidden lg:block shrink-0 sticky top-20 transition-all duration-200 ${
            isLeftNavCollapsed ? 'w-14' : 'w-56'
          }`}
        >
          <CommunityNav
            activeFilter={activeFilter}
            onSelectFilter={handleSelectFilter}
            discussionCounts={discussionCounts}
            activityCounts={activityCounts}
            isAuthenticated={Boolean(effectiveUser)}
            isCollapsed={isLeftNavCollapsed}
            onToggleCollapse={() => setIsLeftNavCollapsed((prev) => !prev)}
          />
        </aside>

        {/* ======================================================== */}
        {/* ZONE 2 (CENTER): Main Discussion Stream (DOMINANT)       */}
        {/* ======================================================== */}
        <main className="flex-1 min-w-0 max-w-4xl space-y-3 mx-auto">
          {/* Welcome / Intro Card */}
          <CommunityWelcomeCard
            onStartDiscussion={handleFocusComposer}
            isDismissed={isWelcomeDismissed}
            onDismiss={() => setIsWelcomeDismissed(true)}
            hasExistingMessages={messages.length > 0}
            totalDiscussions={discussionCounts.all || 0}
          />

          {/* Sticky Toolbar: Topic Segmented Control + Sort */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 pb-1">
            {/* Quick Topic Chips */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
              {topicTabs.map((tab) => {
                const isActive = activeFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleSelectFilter(tab.id)}
                    className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-2xs font-bold'
                        : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/80'
                    }`}
                  >
                    <span>{tab.label}</span>
                    {tab.id !== 'all' && discussionCounts[tab.id] > 0 && (
                      <span className={`text-[10px] font-mono px-1 rounded-full ${
                        isActive ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {discussionCounts[tab.id]}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Sorter & Item Count */}
            <div className="flex items-center justify-end gap-2 shrink-0">
              <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-slate-200/80 shadow-2xs text-xs font-semibold text-slate-700">
                <SlidersHorizontal className="h-3 w-3 text-slate-400" />
                <select
                  value={sortBy}
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="bg-transparent font-semibold text-slate-700 text-xs focus:outline-none cursor-pointer"
                  aria-label="Sort discussions"
                >
                  <option value="recent">Recent</option>
                  <option value="most_discussed">Most Discussed</option>
                  <option value="most_reacted">Most Reacted</option>
                </select>
              </div>

              <span className="text-[11px] font-mono text-slate-400">
                {filteredMessages.length} {filteredMessages.length === 1 ? 'post' : 'posts'}
              </span>
            </div>
          </div>

          {/* Discussion Feed */}
          {loading || (activeFilter === 'saved' && savedLoading) || (activeFilter === 'my_replies' && repliesLoading) ? (
            <div className="space-y-3 py-2">
              <LoadingSkeleton variant="card" count={3} />
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-3">
              <AlertCircle className="h-8 w-8 text-rose-500 mx-auto" />
              <div>
                <h3 className="text-sm font-bold text-rose-900">Connection Error</h3>
                <p className="text-xs text-rose-700 mt-1">{error}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
                className="border-rose-300 text-rose-800 hover:bg-rose-100 cursor-pointer"
              >
                Retry
              </Button>
            </div>
          ) : filteredMessages.length === 0 ? (
            <EmptyState
              icon={<MessageCircle className="h-8 w-8 text-slate-400" />}
              title={
                searchQuery
                  ? 'No matching discussions found'
                  : activeFilter === 'saved'
                  ? "You haven't saved any discussions yet"
                  : activeFilter === 'my_discussions'
                  ? "You haven't started a discussion yet"
                  : activeFilter === 'my_replies'
                  ? "You haven't replied to any discussions yet"
                  : activeFilter === 'idea'
                  ? 'No ideas shared yet'
                  : activeFilter === 'question'
                  ? 'No questions yet'
                  : 'No discussions yet'
              }
              description={
                searchQuery
                  ? 'Try searching with different keywords or clearing your search filter.'
                  : activeFilter === 'saved'
                  ? 'Bookmark interesting community posts using the three-dot menu to access them quickly here.'
                  : activeFilter === 'my_discussions'
                  ? 'Share your first idea, question, or thought with the community below.'
                  : activeFilter === 'my_replies'
                  ? 'Join ongoing conversations from the community feed to see your threads here.'
                  : 'Be the first creator to start the conversation in this channel.'
              }
              action={
                searchQuery ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSearchChange('')}
                  >
                    Clear Search
                  </Button>
                ) : activeFilter === 'my_replies' || activeFilter === 'saved' ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleSelectFilter('all')}
                  >
                    Explore All Discussions
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleFocusComposer}
                  >
                    Start a Discussion
                  </Button>
                )
              }
            />
          ) : (
            <div className="flex flex-col py-1">
              {decoratedFeed.map((item) => {
                if (item.type === 'date_divider' || item.isDivider) {
                  return (
                    <ChatDateDivider
                      key={item.id}
                      label={item.label || item.dateLabel}
                    />
                  );
                }

                if (!item || !item.message) return null;

                return (
                  <CommunityDiscussionCard
                    key={item.message.messageId || item.id}
                    message={item.message}
                    currentUserId={effectiveUser?.uid}
                    isAdmin={userProfile?.isAdmin || userProfile?.role === 'admin' || userProfile?.role === 'superadmin'}
                    reactions={channelReactions[item.message.messageId] || {}}
                    replyCount={channelReplyCounts[item.message.messageId] || 0}
                    isGrouped={item.isGrouped}
                    isFirstInGroup={item.isFirstInGroup}
                    isLastInGroup={item.isLastInGroup}
                    timeLabel={item.timeLabel}
                    fullDateLabel={item.fullDateLabel}
                    onOpenThread={handleOpenThread}
                    onToggleReaction={handleToggleReaction}
                    onEditMessage={handleEditMessage}
                    onDeleteMessage={(m) => setMessageToDelete(m)}
                    onTurnIntoIdea={handleTurnIntoIdea}
                    isHighlighted={highlightedMessageId === item.message.messageId}
                    isSaved={Boolean(savedDiscussionsMap[item.message.messageId])}
                    onToggleSave={handleToggleSave}
                    isPinned={pinnedDiscussion?.messageId === item.message.messageId}
                    onTogglePin={handleTogglePin}
                    activeMenuMessageId={activeMenuState?.messageId || null}
                    menuAnchorRect={activeMenuState?.messageId === item.message.messageId ? activeMenuState.anchorRect : null}
                    onOpenMenu={handleOpenMenu}
                    onCloseMenu={handleCloseMenu}
                  />
                );
              })}
            </div>
          )}

          {/* Spacer to guarantee the last discussion message is completely visible above the sticky composer */}
          <div className="h-6 sm:h-8 shrink-0" aria-hidden="true" />

          {/* Sticky Bottom Discussion Composer */}
          <div
            ref={composerRef}
            className="sticky bottom-0 z-20 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-slate-50 via-slate-50/95 to-slate-50/0 backdrop-blur-xs"
          >
            {/* Real-time typing indicators */}
            {activeTypersText && (
              <div className="mb-2 px-3 py-1.5 rounded-xl bg-emerald-50/90 border border-emerald-100 text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in shadow-2xs">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="italic">{activeTypersText}</span>
              </div>
            )}

            <CommunityComposer
              onSendMessage={handleSendMessage}
              onTyping={handleUserTyping}
            />
          </div>
        </main>

        {/* ======================================================== */}
        {/* ZONE 3 (RIGHT): Community Discovery Panel (Collapsible)   */}
        {/* ======================================================== */}
        {isRightPanelOpen && (
          <aside className="hidden xl:block shrink-0 w-72 sticky top-20 space-y-4">
            <CommunityDiscoveryPanel
              messages={messages}
              replyCounts={channelReplyCounts}
              reactionsMap={channelReactions}
              onSelectDiscussion={(msg) => handleOpenThread(msg)}
              onClose={() => setIsRightPanelOpen(false)}
            />
          </aside>
        )}
      </div>

      {/* ======================================================== */}
      {/* Thread Drawer (Parent Message + Replies Stream)          */}
      {/* ======================================================== */}
      <CommunityThreadDrawer
        isOpen={Boolean(activeThreadMessage)}
        parentMessage={activeThreadMessage}
        currentUserId={effectiveUser?.uid}
        currentUser={effectiveUser}
        isAdmin={userProfile?.isAdmin || userProfile?.role === 'admin'}
        onClose={handleCloseThread}
        onToggleReaction={handleToggleReaction}
        parentReactions={activeThreadMessage ? channelReactions[activeThreadMessage.messageId] || {} : {}}
      />

      {/* ======================================================== */}
      {/* Turn Discussion into Public Proposal Modal               */}
      {/* ======================================================== */}
      <CreatePublicIdeaModal
        isOpen={isCreateIdeaModalOpen}
        onClose={() => {
          setIsCreateIdeaModalOpen(false);
          setTurnIntoIdeaInitialValues(null);
        }}
        onSuccess={(newIdea) => {
          setIsCreateIdeaModalOpen(false);
          setTurnIntoIdeaInitialValues(null);
          toast.success('Idea proposal created! You can find it on Explore Ideas.');
          navigate('/explore');
        }}
        initialValues={turnIntoIdeaInitialValues}
      />

      {/* ======================================================== */}
      {/* Delete Confirmation Dialog                               */}
      {/* ======================================================== */}
      <ConfirmDialog
        isOpen={Boolean(messageToDelete)}
        title="Delete Discussion?"
        description="Are you sure you want to delete this discussion post? It will be removed from the community feed."
        confirmLabel="Delete"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setMessageToDelete(null)}
      />

      {/* ======================================================== */}
      {/* Mobile Channel Navigation Sheet (Drawer)                 */}
      {/* ======================================================== */}
      {isMobileNavOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileNavOpen(false)}
          />
          <div className="relative flex w-80 max-w-[85vw] flex-1 flex-col bg-white p-5 shadow-2xl z-50 animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">Channels & Filters</h2>
              <button
                type="button"
                onClick={() => setIsMobileNavOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="pt-4 flex-1 overflow-y-auto">
              <CommunityNav
                activeFilter={activeFilter}
                onSelectFilter={(f) => {
                  handleSelectFilter(f);
                  setIsMobileNavOpen(false);
                }}
                discussionCounts={discussionCounts}
                activityCounts={activityCounts}
                isAuthenticated={Boolean(effectiveUser)}
              />
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* Mobile Discovery Sheet (Trending & Activity)             */}
      {/* ======================================================== */}
      {isMobileDiscoveryOpen && (
        <div className="fixed inset-0 z-50 flex xl:hidden">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileDiscoveryOpen(false)}
          />
          <div className="relative ml-auto flex w-80 max-w-[85vw] flex-1 flex-col bg-white p-5 shadow-2xl z-50 animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">Community Discovery</h2>
              <button
                type="button"
                onClick={() => setIsMobileDiscoveryOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="pt-4 flex-1 overflow-y-auto">
              <CommunityDiscoveryPanel
                messages={messages}
                replyCounts={channelReplyCounts}
                reactionsMap={channelReactions}
                onSelectDiscussion={(msg) => {
                  setIsMobileDiscoveryOpen(false);
                  handleOpenThread(msg);
                }}
                onClose={() => setIsMobileDiscoveryOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* Community Members Roster Modal                           */}
      {/* ======================================================== */}
      <CommunityMembersModal
        isOpen={isMembersModalOpen}
        onClose={() => setIsMembersModalOpen(false)}
        messages={messages}
      />
    </div>
  );
}
