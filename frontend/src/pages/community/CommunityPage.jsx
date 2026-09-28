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

  // Aggregated Channel-level Reactions & Reply Counts (Prevents N+1 listeners)
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
    if (loading) return; // Wait until community feed messages load

    const targetThreadId = searchParams.get('threadId');
    const targetMsgId = searchParams.get('messageId');

    if (targetThreadId && messages.length > 0) {
      const found = messages.find((m) => m.messageId === targetThreadId);
      if (found && !found.deleted) {
        setActiveThreadMessage(found);
      } else {
        toast.info('This discussion is no longer available.');
      }
    } else if (targetMsgId && messages.length > 0) {
      const found = messages.find((m) => m.messageId === targetMsgId);
      if (found && !found.deleted) {
        // Switch to 'all' if active filter would otherwise hide the targeted discussion
        if (activeFilter !== 'all' && activeFilter !== (found.postType || 'discussion')) {
          setActiveFilter('all');
        }
        setHighlightedMessageId(targetMsgId);
        setTimeout(() => {
          const el = document.getElementById(`msg_${targetMsgId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 250);
        const timer = setTimeout(() => setHighlightedMessageId(null), 4000);
        return () => clearTimeout(timer);
      } else {
        toast.info('This discussion is no longer available.');
      }
    }
  }, [searchParams, messages, loading]);

  // Sync activeFilter with URL parameter
  const handleSelectFilter = (filterId) => {
    setActiveFilter(filterId);
    handleCloseMenu();
    setIsMobileNavOpen(false);
    const newParams = new URLSearchParams(searchParams);
    if (filterId === 'all') {
      newParams.delete('type');
    } else {
      newParams.set('type', filterId);
    }
    setSearchParams(newParams, { replace: true });
  };

  // Sync sortBy with URL parameter
  const handleSortChange = (newSort) => {
    setSortBy(newSort);
    handleCloseMenu();
    const newParams = new URLSearchParams(searchParams);
    if (newSort === 'recent') {
      newParams.delete('sort');
    } else {
      newParams.set('sort', newSort);
    }
    setSearchParams(newParams, { replace: true });
  };

  // Sync searchQuery with URL parameter
  const handleSearchChange = (query) => {
    setSearchQuery(query);
    handleCloseMenu();
    const newParams = new URLSearchParams(searchParams);
    if (query.trim()) {
      newParams.set('q', query.trim());
    } else {
      newParams.delete('q');
    }
    setSearchParams(newParams, { replace: true });
  };

  // Open thread drawer
  const handleOpenThread = (msg) => {
    setActiveThreadMessage(msg);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('threadId', msg.messageId);
    setSearchParams(newParams, { replace: true });
  };

  // Close thread drawer
  const handleCloseThread = () => {
    setActiveThreadMessage(null);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('threadId');
    newParams.delete('replyId');
    setSearchParams(newParams, { replace: true });
  };

  // Typing publisher
  const handleUserTyping = () => {
    if (!effectiveUser) return;
    chatService.setPublicIdeaChatTypingState(effectiveUser, true).catch(() => {});
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      chatService.setPublicIdeaChatTypingState(effectiveUser, false).catch(() => {});
    }, 2500);
  };

  // Send message
  const handleSendMessage = async (content, postType) => {
    if (!effectiveUser) return;
    try {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      await chatService.setPublicIdeaChatTypingState(effectiveUser, false);

      const messageId = await chatService.sendPublicIdeaChatMessage(
        content,
        effectiveUser,
        null,
        postType
      );

      toast.success('Discussion posted to community!');
      setHighlightedMessageId(messageId);
      setTimeout(() => setHighlightedMessageId(null), 3000);
    } catch (err) {
      toast.error(err?.message || 'Failed to post message.');
      throw err;
    }
  };

  // Edit message
  const handleEditMessage = async (messageId, newContent) => {
    if (!effectiveUser) return;
    try {
      await chatService.editPublicIdeaChatMessage(messageId, newContent, effectiveUser.uid);
      toast.success('Discussion updated.');
    } catch (err) {
      toast.error(err?.message || 'Failed to edit message.');
      throw err;
    }
  };

  // Delete message confirmation
  const handleConfirmDelete = async () => {
    if (!messageToDelete || !effectiveUser) return;
    setIsDeleting(true);
    try {
      await chatService.deletePublicIdeaChatMessage(
        messageToDelete.messageId,
        effectiveUser.uid,
        userProfile?.isAdmin || userProfile?.role === 'admin'
      );
      toast.success('Discussion deleted.');
      setMessageToDelete(null);
      if (activeThreadMessage?.messageId === messageToDelete.messageId) {
        handleCloseThread();
      }
    } catch (err) {
      toast.error(err?.message || 'Failed to delete discussion.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Toggle reaction
  const handleToggleReaction = async (messageId, emoji) => {
    if (!effectiveUser) {
      toast.info('Please sign in to react to discussions.');
      return;
    }
    try {
      await chatService.togglePublicIdeaReaction(messageId, emoji, effectiveUser);
    } catch (err) {
      toast.error('Unable to update reaction.');
    }
  };

  // Turn into Idea action
  const handleTurnIntoIdea = (msg) => {
    const rawContent = msg.content || '';
    const firstSentence = rawContent.split(/[.\n]/)[0].substring(0, 80);

    setTurnIntoIdeaInitialValues({
      title: firstSentence.trim() || 'New Proposal Concept',
      problemStatement: rawContent.trim(),
      proposedSolution: '',
      category: msg.postType === COMMUNITY_POST_TYPES.IDEA ? 'Technical' : 'General',
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

  // Process message feed to compute chronological grouping and date dividers
  const currentAuthUid = user?.uid || effectiveUser?.uid;
  const decoratedFeed = useMemo(() => {
    if (sortBy !== 'recent') {
      return filteredMessages.map((msg, index) => ({
        type: 'message',
        id: msg.messageId || `msg_${index}`,
        message: msg,
        isGrouped: false,
        isFirstInGroup: true,
        isLastInGroup: true,
        isOwn: Boolean(currentAuthUid && isMessageAuthoredByUser(msg, currentAuthUid)),
        timeLabel: formatMessageTime(msg.createdAt),
        fullDateLabel: formatFullDateTime(msg.createdAt),
      }));
    }
    return processMessageFeed(filteredMessages, currentAuthUid);
  }, [filteredMessages, sortBy, currentAuthUid]);

  // Discussion counts per type
  const discussionCounts = useMemo(() => {
    const counts = { all: 0 };
    messages.forEach((m) => {
      if (m && !m.deleted) {
        counts.all = (counts.all || 0) + 1;
        const type = m.postType || 'discussion';
        counts[type] = (counts[type] || 0) + 1;
      }
    });
    return counts;
  }, [messages]);

  // Activity counts for current user strictly using canonical author UID
  const activityCounts = useMemo(() => {
    const myDiscussions = currentAuthUid
      ? messages.filter((m) => m && !m.deleted && isMessageAuthoredByUser(m, currentAuthUid)).length
      : 0;

    const myReplies = currentAuthUid
      ? (userRepliedDiscussions[currentAuthUid] || []).length
      : 0;

    const saved = Object.keys(savedDiscussionsMap).length;

    return { myDiscussions, myReplies, saved };
  }, [messages, currentAuthUid, userRepliedDiscussions, savedDiscussionsMap]);

  // Active filter label
  const activeFilterLabel = useMemo(() => {
    if (activeFilter === 'all') return 'All Discussions';
    if (activeFilter === 'my_discussions') return 'My Discussions';
    if (activeFilter === 'my_replies') return 'My Replies';
    if (activeFilter === 'saved') return 'Saved Discussions';
    return COMMUNITY_POST_TYPE_CONFIG[activeFilter]?.label || activeFilter;
  }, [activeFilter]);

  // Real unique contributors count
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-6 sm:py-8">
      {/* Community Hub Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-700 text-white shadow-xs">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Convia Community Hub
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider">
                  Open Discussions
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Share ideas, ask questions, discover what peers are building, and collaborate.
              </p>
            </div>
          </div>
        </div>

        {/* Real Live Metadata & Global Actions */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Members / Creators Modal Trigger */}
          <button
            type="button"
            onClick={() => setIsMembersModalOpen(true)}
            className="flex items-center gap-2 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs text-xs font-semibold text-slate-700 transition-colors cursor-pointer group"
            title="View community members roster"
          >
            <Users className="h-3.5 w-3.5 text-emerald-600 group-hover:scale-110 transition-transform" />
            <span>{uniqueCreatorsCount} {uniqueCreatorsCount === 1 ? 'creator' : 'creators'}</span>
            <span className="text-slate-300">•</span>
            <span>{discussionCounts.all || 0} discussions</span>
          </button>

          {/* Search Toggle Button */}
          <button
            type="button"
            onClick={() => setIsSearchVisible((prev) => !prev)}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              isSearchVisible || searchQuery
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            aria-label="Toggle search filter"
            title="Search discussions"
          >
            <Search className="h-4 w-4" />
          </button>

          {/* Mobile Navigation Toggle */}
          <button
            type="button"
            onClick={() => setIsMobileNavOpen(true)}
            className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <Filter className="h-3.5 w-3.5 text-slate-500" />
            <span>Channels</span>
          </button>

          {/* Mobile Discovery Toggle */}
          <button
            type="button"
            onClick={() => setIsMobileDiscoveryOpen(true)}
            className="xl:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <Flame className="h-3.5 w-3.5 text-amber-500" />
            <span>Trending</span>
          </button>
        </div>
      </div>

      {/* Expandable Scoped Search Bar */}
      {isSearchVisible && (
        <div className="relative animate-in fade-in slide-in-from-top-2 duration-150">
          <Input
            placeholder="Search discussions by topic, question, or creator name..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 pr-9 bg-white shadow-2xs"
            autoFocus
          />
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => handleSearchChange('')}
              className="absolute right-3 top-2.5 p-1 rounded-lg text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Three-Zone Layout Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ======================================================== */}
        {/* ZONE 1 (LEFT): Community Navigation (Desktop: 3 cols)     */}
        {/* ======================================================== */}
        <aside className="hidden lg:block lg:col-span-3 sticky top-24">
          <CommunityNav
            activeFilter={activeFilter}
            onSelectFilter={handleSelectFilter}
            onOpenCreate={() => {
              if (composerRef.current) {
                composerRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
                const textarea = composerRef.current.querySelector('textarea');
                if (textarea) textarea.focus();
              }
            }}
            discussionCounts={discussionCounts}
            activityCounts={activityCounts}
            isAuthenticated={Boolean(effectiveUser)}
          />
        </aside>

        {/* ======================================================== */}
        {/* ZONE 2 (CENTER): Main Discussion Stream (Desktop: 6/9 cols) */}
        {/* ======================================================== */}
        <main className="lg:col-span-9 xl:col-span-6 space-y-5">
          {/* Welcome / Zero State */}
          <CommunityWelcomeCard
            onStartDiscussion={() => {
              if (composerRef.current) {
                composerRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
                const textarea = composerRef.current.querySelector('textarea');
                if (textarea) textarea.focus();
              }
            }}
            isDismissed={isWelcomeDismissed}
            onDismiss={() => setIsWelcomeDismissed(true)}
            hasExistingMessages={messages.length > 0}
            totalDiscussions={discussionCounts.all || 0}
          />

          {/* Active Filter Pill & Sorting Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Viewing:
              </span>
              <span className="text-xs font-bold text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                {activeFilterLabel}
              </span>
              {searchQuery && (
                <span className="text-xs text-slate-500">
                  matching &quot;<strong>{searchQuery}</strong>&quot;
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Sort Selector */}
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs text-xs font-semibold text-slate-700">
                <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-[10px] text-slate-400 uppercase font-bold">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="bg-transparent font-bold text-slate-800 text-xs focus:outline-none cursor-pointer"
                  aria-label="Sort discussions"
                >
                  <option value="recent">Recent</option>
                  <option value="most_discussed">Most Discussed</option>
                  <option value="most_reacted">Most Reacted</option>
                </select>
              </div>

              <span className="text-xs font-mono text-slate-400">
                {filteredMessages.length} {filteredMessages.length === 1 ? 'post' : 'posts'}
              </span>
            </div>
          </div>

          {/* Discussion Feed */}
          {loading || (activeFilter === 'saved' && savedLoading) || (activeFilter === 'my_replies' && repliesLoading) ? (
            <div className="space-y-4">
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
                className="border-rose-300 text-rose-800 hover:bg-rose-100"
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
                  ? 'No saved discussions yet'
                  : activeFilter === 'my_discussions'
                  ? "You haven't started any discussions yet"
                  : activeFilter === 'my_replies'
                  ? "You haven't replied to any discussions yet"
                  : activeFilter !== 'all'
                  ? `No ${COMMUNITY_POST_TYPE_CONFIG[activeFilter]?.label || activeFilter} discussions yet`
                  : 'No community discussions yet'
              }
              description={
                searchQuery
                  ? 'Try refining your search keyword or clearing the search query.'
                  : activeFilter === 'saved'
                  ? 'Bookmark interesting discussions using the three-dot menu on any post.'
                  : activeFilter === 'my_discussions'
                  ? 'Use the composer below to share your first idea, question, or discussion!'
                  : activeFilter === 'my_replies'
                  ? 'Join an ongoing discussion from the community feed to see your threads here.'
                  : 'Be the first innovator to start a discussion in this channel!'
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
                    Explore Community
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      if (composerRef.current) {
                        composerRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
                        const textarea = composerRef.current.querySelector('textarea');
                        if (textarea) textarea.focus();
                      }
                    }}
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
            {/* Typing Indicator right above input */}
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
        {/* ZONE 3 (RIGHT): Community Discovery Panel (Desktop: 3 cols) */}
        {/* ======================================================== */}
        <aside className="hidden xl:block xl:col-span-3 sticky top-24 space-y-6">
          <CommunityDiscoveryPanel
            messages={messages}
            replyCounts={channelReplyCounts}
            reactionsMap={channelReactions}
            onSelectDiscussion={(msg) => handleOpenThread(msg)}
          />
        </aside>
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
                onSelectFilter={handleSelectFilter}
                onOpenCreate={() => {
                  setIsMobileNavOpen(false);
                  if (composerRef.current) {
                    composerRef.current.scrollIntoView({ behavior: 'smooth' });
                  }
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

