import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Hash,
  Lock,
  Plus,
  Settings,
  Archive,
} from 'lucide-react';
import { DEFAULT_CHAT_CHANNEL_ID } from '../../constants/chatSchema';
import { chatService } from '../../services/chatService';

export function ChatChannelSidebar({
  workspaceId,
  currentUserId,
  activeChannelId = DEFAULT_CHAT_CHANNEL_ID,
  channels = [],
  isLeader = false,
  onSelectChannel,
  onOpenCreateChannel,
  onOpenChannelSettings,
}) {
  const [unreadMap, setUnreadMap] = useState({});

  // Subscribe to readState for each channel to maintain live unread indicators
  useEffect(() => {
    if (!workspaceId || !currentUserId || !Array.isArray(channels)) return;

    const unsubscribers = channels.map((ch) => {
      return chatService.subscribeToReadState(
        workspaceId,
        ch.channelId,
        currentUserId,
        (readState) => {
          const lastReadAt = readState?.lastReadAt || 0;
          const lastMessageAt = ch.lastMessageAt || 0;
          const isUnread = ch.channelId !== activeChannelId && lastMessageAt > lastReadAt;

          setUnreadMap((prev) => ({
            ...prev,
            [ch.channelId]: isUnread,
          }));
        }
      );
    });

    return () => {
      unsubscribers.forEach((unsub) => {
        if (typeof unsub === 'function') unsub();
      });
    };
  }, [workspaceId, currentUserId, channels, activeChannelId]);

  // Strictly workspace-only channels (filter out any public channels)
  const workspaceChannels = channels.filter((ch) => ch && ch.type !== 'public' && ch.channelId !== 'public');

  const renderChannelItem = (ch) => {
    const isActive = ch.channelId === activeChannelId;
    const isUnread = Boolean(unreadMap[ch.channelId]);
    const isGeneral = ch.channelId === DEFAULT_CHAT_CHANNEL_ID;

    return (
      <div
        key={ch.channelId}
        className={`group relative flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer select-none ${
          isActive
            ? 'bg-primary-600 text-white shadow-xs'
            : isUnread
            ? 'text-slate-900 font-bold bg-primary-50/60 hover:bg-primary-100/60'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
        }`}
        onClick={() => onSelectChannel(ch.channelId)}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Channel Icon */}
          <span className={`shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`}>
            {isGeneral ? (
              <Hash className="h-3.5 w-3.5 stroke-[2.5]" />
            ) : (
              <Lock className="h-3.5 w-3.5" />
            )}
          </span>

          {/* Channel Name */}
          <span className="truncate">
            {ch.name || ch.channelId}
          </span>

          {/* Archived indicator */}
          {ch.archived && (
            <Archive
              className={`h-3 w-3 shrink-0 ${isActive ? 'text-primary-200' : 'text-amber-500'}`}
              title="Archived"
            />
          )}

          {/* Live Unread Indicator Dot */}
          {isUnread && !isActive && (
            <span className="h-2 w-2 rounded-full bg-primary-600 ring-2 ring-white shrink-0 ml-auto mr-1" />
          )}
        </div>

        {/* Channel Settings Button (visible on active channel or on hover for leaders) */}
        {isLeader && (
          <button
            type="button"
            title="Channel Settings"
            onClick={(e) => {
              e.stopPropagation();
              onOpenChannelSettings(ch);
            }}
            className={`opacity-0 group-hover:opacity-100 p-1 rounded-md transition-all shrink-0 ml-1 ${
              isActive
                ? 'hover:bg-primary-700 text-white/90'
                : 'hover:bg-slate-200 text-slate-500 hover:text-slate-800'
            }`}
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  };

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-slate-50/80 border-r border-slate-200/80 h-full overflow-hidden select-none">
      {/* Channels Header */}
      <div className="p-3 border-b border-slate-200/80 flex items-center justify-between bg-white/50">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Channels
        </span>
        {isLeader && (
          <button
            type="button"
            onClick={onOpenCreateChannel}
            title="Create New Channel"
            className="p-1 rounded-lg text-slate-500 hover:text-primary-600 hover:bg-primary-50 transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Channels List Body */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {workspaceChannels.map(renderChannelItem)}
      </div>
    </aside>
  );
}

ChatChannelSidebar.propTypes = {
  workspaceId: PropTypes.string.isRequired,
  currentUserId: PropTypes.string.isRequired,
  activeChannelId: PropTypes.string,
  channels: PropTypes.arrayOf(PropTypes.object),
  isLeader: PropTypes.bool,
  onSelectChannel: PropTypes.func.isRequired,
  onOpenCreateChannel: PropTypes.func.isRequired,
  onOpenChannelSettings: PropTypes.func.isRequired,
};
