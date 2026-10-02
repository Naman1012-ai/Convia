import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  Flame,
  Activity,
  Users,
  MessageCircle,
  ThumbsUp,
  ArrowRight,
  X,
} from 'lucide-react';
import { Avatar } from '../../components/ui/Avatar';
import { COMMUNITY_POST_TYPE_CONFIG } from '../../constants/chatSchema';
import { formatMessageTime } from '../../utils/chatFeedHelpers';
import { useUserProfiles } from '../../hooks/useUserProfile';

export function CommunityDiscoveryPanel({
  messages = [],
  replyCounts = {},
  reactionsMap = {},
  onSelectDiscussion = () => {},
  onClose = null,
  className = '',
}) {
  // 1. Calculate Trending discussions
  const trendingDiscussions = useMemo(() => {
    if (!Array.isArray(messages) || messages.length === 0) return [];

    const now = Date.now();
    return messages
      .filter((m) => m && !m.deleted && m.content)
      .map((msg) => {
        const replies = replyCounts[msg.messageId] || 0;
        const msgReactions = reactionsMap[msg.messageId] || {};
        const reactionCount = Object.values(msgReactions).reduce(
          (sum, r) => sum + (r?.count || 0),
          0
        );

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
      .filter((m) => m.replies > 0 || m.reactionCount > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
  }, [messages, replyCounts, reactionsMap]);

  // 2. Recent Activity (compact stream)
  const recentActivities = useMemo(() => {
    if (!Array.isArray(messages) || messages.length === 0) return [];

    return [...messages]
      .filter((m) => m && !m.deleted)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 5);
  }, [messages]);

  // 3. Active Creators
  const activeAuthorIds = useMemo(() => {
    if (!Array.isArray(messages)) return [];
    return Array.from(new Set(messages.map((m) => m.senderId).filter((id) => id && id !== 'system'))).slice(0, 6);
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
    <div className={`space-y-5 select-none ${className}`}>
      {/* Panel Header */}
      <div className="flex items-center justify-between px-1 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider">
          <Activity className="h-3.5 w-3.5 text-emerald-600" />
          <span>Community Pulse</span>
        </div>
        {typeof onClose === 'function' && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Hide panel"
            aria-label="Hide activity panel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Section 1: Trending Discussions */}
      {trendingDiscussions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 px-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <Flame className="h-3.5 w-3.5 text-amber-500" />
            <span>Trending</span>
          </div>

          <div className="space-y-1.5">
            {trendingDiscussions.map((item) => {
              const typeConfig = COMMUNITY_POST_TYPE_CONFIG[item.postType] || COMMUNITY_POST_TYPE_CONFIG.discussion;

              return (
                <div
                  key={item.messageId}
                  onClick={() => onSelectDiscussion(item)}
                  className="p-2.5 rounded-xl bg-white border border-slate-200/80 hover:border-emerald-300 hover:shadow-2xs transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-400">
                    <span className="text-xs">{typeConfig.icon}</span>
                    <span className="font-semibold text-slate-600 truncate">{typeConfig.label}</span>
                    <span className="ml-auto font-mono">{formatMessageTime(item.createdAt)}</span>
                  </div>

                  <p className="text-xs font-medium text-slate-900 group-hover:text-emerald-700 line-clamp-1 leading-snug transition-colors">
                    {item.content}
                  </p>

                  <div className="flex items-center gap-2.5 mt-1.5 text-[10px] text-slate-400">
                    <span className="flex items-center gap-0.5 text-emerald-600 font-semibold">
                      <MessageCircle className="h-2.5 w-2.5" />
                      <span>{item.replies}</span>
                    </span>
                    {item.reactionCount > 0 && (
                      <span className="flex items-center gap-0.5 text-amber-600 font-semibold">
                        <ThumbsUp className="h-2.5 w-2.5" />
                        <span>{item.reactionCount}</span>
                      </span>
                    )}
                    <span className="ml-auto text-slate-400 group-hover:text-emerald-600 flex items-center gap-0.5">
                      View <ArrowRight className="h-2 w-2" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section 2: Recent Activity (Compact List) */}
      {recentActivities.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 px-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <Activity className="h-3.5 w-3.5 text-emerald-600" />
            <span>Recent Activity</span>
          </div>

          <div className="space-y-1">
            {recentActivities.map((act) => {
              const authorName = resolveName(act.senderId, act.senderName || 'Member');
              const authorAvatar = resolveAvatar(act.senderId, act.senderAvatar || '');
              const typeConfig = COMMUNITY_POST_TYPE_CONFIG[act.postType] || COMMUNITY_POST_TYPE_CONFIG.discussion;

              return (
                <div
                  key={act.messageId}
                  onClick={() => onSelectDiscussion(act)}
                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100/70 transition-colors cursor-pointer group text-left"
                >
                  <Avatar
                    src={authorAvatar}
                    name={authorName}
                    size="xs"
                    className="shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-slate-700 truncate leading-tight">
                      <strong className="text-slate-900 group-hover:text-emerald-700">{authorName}</strong>{' '}
                      posted a {typeConfig.label.toLowerCase()}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {formatMessageTime(act.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section 3: Active Contributors (Compact row) */}
      {activeAuthorIds.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between px-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-primary-600" />
              <span>Active Creators</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 font-normal">
              {activeAuthorIds.length}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {activeAuthorIds.map((uid) => {
              const name = resolveName(uid, 'Member');
              const avatar = resolveAvatar(uid, '');

              return (
                <div
                  key={uid}
                  className="inline-flex items-center gap-1.5 py-0.5 px-2 rounded-full bg-slate-100/90 text-slate-700 text-[11px] font-medium hover:bg-slate-200 transition-colors"
                  title={name}
                >
                  <Avatar src={avatar} name={name} size="xs" />
                  <span className="truncate max-w-[80px] font-semibold">{name}</span>
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
  onClose: PropTypes.func,
  className: PropTypes.string,
};
