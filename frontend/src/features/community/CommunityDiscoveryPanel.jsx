import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  TrendingUp,
  Activity,
  Users,
  MessageCircle,
  ThumbsUp,
  Sparkles,
  ArrowRight,
  Flame,
  Clock,
} from 'lucide-react';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { COMMUNITY_POST_TYPE_CONFIG } from '../../constants/chatSchema';
import { formatMessageTime } from '../../utils/chatFeedHelpers';
import { useUserProfiles } from '../../hooks/useUserProfile';
import { resolveMemberDisplayName } from '../../utils/memberIdentity';

export function CommunityDiscoveryPanel({
  messages = [],
  replyCounts = {},
  reactionsMap = {},
  onSelectDiscussion = () => {},
  className = '',
}) {
  // 1. Calculate REAL trending discussions based on reply count, reaction count, and recency
  const trendingDiscussions = useMemo(() => {
    if (!Array.isArray(messages) || messages.length === 0) return [];

    const now = Date.now();
    const scored = messages
      .filter((m) => m && !m.deleted && m.content)
      .map((msg) => {
        const replies = replyCounts[msg.messageId] || 0;
        const msgReactions = reactionsMap[msg.messageId] || {};
        const reactionCount = Object.values(msgReactions).reduce(
          (sum, r) => sum + (r?.count || 0),
          0
        );

        // Recency decay bonus (posts in last 24h get small activity boost)
        const ageHours = Math.max(0.1, (now - (msg.createdAt || now)) / (1000 * 60 * 60));
        const recencyScore = Math.max(0, 10 - Math.min(10, ageHours * 0.5));

        const score = replies * 3 + reactionCount * 2 + recencyScore;
        return {
          ...msg,
          replies,
          reactionCount,
          score,
        };
      })
      // Only consider discussions with at least some activity or replies
      .filter((m) => m.replies > 0 || m.reactionCount > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return scored;
  }, [messages, replyCounts, reactionsMap]);

  // 2. Derive Recent Real Activity
  const recentActivities = useMemo(() => {
    if (!Array.isArray(messages) || messages.length === 0) return [];

    return [...messages]
      .filter((m) => m && !m.deleted)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 5);
  }, [messages]);

  // 3. Extract unique active creators from community discussions
  const activeAuthorIds = useMemo(() => {
    if (!Array.isArray(messages)) return [];
    return Array.from(new Set(messages.map((m) => m.senderId).filter((id) => id && id !== 'system'))).slice(0, 8);
  }, [messages]);

  const { resolveName, resolveAvatar } = useUserProfiles(activeAuthorIds);

  if (!Array.isArray(messages) || messages.length === 0) {
    return null;
  }

  const hasAnyDiscoveryContent =
    trendingDiscussions.length > 0 || recentActivities.length > 0 || activeAuthorIds.length > 0;

  if (!hasAnyDiscoveryContent) {
    return null;
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Section 1: Trending Discussions (Only shown if trending discussions exist or active discussions present) */}
      {trendingDiscussions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1 text-xs font-bold text-slate-900 uppercase tracking-wider">
            <Flame className="h-4 w-4 text-amber-500" />
            <span>Trending Discussions</span>
          </div>

          <div className="space-y-2">
            {trendingDiscussions.map((item) => {
              const typeConfig = COMMUNITY_POST_TYPE_CONFIG[item.postType] || COMMUNITY_POST_TYPE_CONFIG.discussion;

              return (
                <div
                  key={item.messageId}
                  onClick={() => onSelectDiscussion(item)}
                  className="p-3.5 rounded-xl bg-white border border-slate-200/90 hover:border-emerald-300 hover:shadow-xs transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs">{typeConfig.icon}</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {typeConfig.label}
                    </span>
                    <span className="text-[11px] text-slate-400 ml-auto">
                      {formatMessageTime(item.createdAt)}
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-slate-900 group-hover:text-emerald-700 line-clamp-2 leading-relaxed transition-colors">
                    {item.content}
                  </p>

                  <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
                    <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                      <MessageCircle className="h-3 w-3" />
                      <span>{item.replies}</span>
                    </span>

                    {item.reactionCount > 0 && (
                      <span className="flex items-center gap-1 text-amber-600 font-semibold">
                        <ThumbsUp className="h-3 w-3" />
                        <span>{item.reactionCount}</span>
                      </span>
                    )}

                    <span className="ml-auto text-[10px] text-slate-400 group-hover:text-emerald-600 flex items-center gap-0.5">
                      View <ArrowRight className="h-2.5 w-2.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section 2: Recent Activity */}
      {recentActivities.length > 0 && (
        <div className={`space-y-3 ${trendingDiscussions.length > 0 ? 'pt-2 border-t border-slate-100' : ''}`}>
          <div className="flex items-center gap-2 px-1 text-xs font-bold text-slate-900 uppercase tracking-wider">
            <Activity className="h-4 w-4 text-emerald-600" />
            <span>Recent Activity</span>
          </div>

          <div className="space-y-2">
            {recentActivities.map((act) => {
              const authorName = resolveName(act.senderId, act.senderName || 'Member');
              const authorAvatar = resolveAvatar(act.senderId, act.senderAvatar || '');
              const typeConfig = COMMUNITY_POST_TYPE_CONFIG[act.postType] || COMMUNITY_POST_TYPE_CONFIG.discussion;

              return (
                <div
                  key={act.messageId}
                  onClick={() => onSelectDiscussion(act)}
                  className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-slate-100/70 transition-colors cursor-pointer group"
                >
                  <Avatar
                    src={authorAvatar}
                    name={authorName}
                    size="xs"
                    className="shrink-0 mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-700 leading-snug line-clamp-1">
                      <strong className="text-slate-900 group-hover:text-emerald-700">{authorName}</strong>{' '}
                      posted a {typeConfig.label.toLowerCase()}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {formatMessageTime(act.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section 3: Active Community Creators */}
      {activeAuthorIds.length > 0 && (
        <div className={`space-y-3 pt-2 border-t border-slate-100`}>
          <div className="flex items-center justify-between px-1 text-xs font-bold text-slate-900 uppercase tracking-wider">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-600" />
              <span>Active Creators</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 font-normal">
              {activeAuthorIds.length} contributors
            </span>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {activeAuthorIds.map((uid) => {
              const name = resolveName(uid, 'Member');
              const avatar = resolveAvatar(uid, '');

              return (
                <div
                  key={uid}
                  className="flex items-center gap-1.5 p-1 pr-2.5 rounded-full bg-white border border-slate-200 text-xs shadow-2xs hover:border-slate-300 transition-colors"
                  title={name}
                >
                  <Avatar src={avatar} name={name} size="xs" />
                  <span className="font-semibold text-[11px] text-slate-700 truncate max-w-[90px]">
                    {name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

CommunityDiscoveryPanel.propTypes = {
  messages: PropTypes.array,
  replyCounts: PropTypes.object,
  reactionsMap: PropTypes.object,
  onSelectDiscussion: PropTypes.func,
  className: PropTypes.string,
};
