import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Hash,
  Lock,
  Plus,
  Settings,
  Archive,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { DEFAULT_CHAT_CHANNEL_ID } from '../../constants/chatSchema';
import { chatService } from '../../services/chatService';
import { useSidebarCollapse } from '../../hooks/useSidebarCollapse';
import { cn } from '../../utils/cn';

export function ChatChannelSidebar({
  workspaceId,
  currentUserId,
  activeChannelId = DEFAULT_CHAT_CHANNEL_ID,
  channels = [],
  isLeader = false,
  onSelectChannel,
  onOpenCreateChannel,
  onOpenChannelSettings,
  isCollapsed: propIsCollapsed,
  onToggleCollapse: propOnToggleCollapse,
  forceExpanded = false,
}) {
  const [unreadMap, setUnreadMap] = useState({});

  // Persistent collapse state
  const [storedIsCollapsed, toggleStoredCollapse] = useSidebarCollapse(
    'convia_sidebar_channels_collapsed',
    false
  );

  const isCollapsed = forceExpanded
    ? false
    : propIsCollapsed !== undefined
    ? propIsCollapsed
    : storedIsCollapsed;

  const handleToggleCollapse = propOnToggleCollapse || toggleStoredCollapse;

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
  const workspaceChannels = channels.filter(
    (ch) => ch && ch.type !== 'public' && ch.channelId !== 'public'
  );

  const renderChannelItem = (ch) => {
    const isActive = ch.channelId === activeChannelId;
    const isUnread = Boolean(unreadMap[ch.channelId]);
    const isGeneral = ch.channelId === DEFAULT_CHAT_CHANNEL_ID;

    if (isCollapsed) {
      return (
        <div key={ch.channelId} className="relative group flex justify-center">
          <button
            type="button"
            onClick={() => onSelectChannel(ch.channelId)}
            title={`#${ch.name || ch.channelId}${isUnread ? ' (Unread)' : ''}`}
            aria-label={`Channel #${ch.name || ch.channelId}${isUnread ? ' (Unread)' : ''}`}
            className={`p-2 rounded-lg transition-all cursor-pointer relative flex items-center justify-center focus:outline-hidden focus:ring-2 focus:ring-primary-500 ${
              isActive
                ? 'bg-primary-600 text-white shadow-xs'
                : isUnread
                ? 'text-slate-900 font-bold bg-primary-50/80 hover:bg-primary-100/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span className={`shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`}>
              {isGeneral ? (
                <Hash className="h-4 w-4 stroke-[2.5]" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
            </span>
            {isUnread && !isActive && (
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary-600 ring-2 ring-white" />
            )}
          </button>
          {/* Floating Tooltip */}
          <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center z-50 pointer-events-none">
            <div className="bg-slate-800 text-white text-xs font-semibold px-2.5 py-1 rounded-md shadow-lg whitespace-nowrap flex items-center gap-1.5 border border-slate-700">
              <span>#{ch.name || ch.channelId}</span>
              {ch.archived && <span className="text-[10px] text-amber-400">(Archived)</span>}
              {isUnread && <span className="h-1.5 w-1.5 rounded-full bg-primary-400" />}
            </div>
          </div>
        </div>
      );
    }

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
          <span className="truncate">{ch.name || ch.channelId}</span>

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
    <aside
      className={`shrink-0 flex flex-col bg-slate-50/80 border-r border-slate-200/80 h-full overflow-hidden select-none transition-all duration-200 ease-in-out ${
        isCollapsed ? 'w-14' : 'w-56'
      }`}
    >
      {/* Channels Header */}
      <div
        className={`p-3 border-b border-slate-200/80 flex items-center bg-white/50 transition-all ${
          isCollapsed ? 'justify-center' : 'justify-between'
        }`}
      >
        {!isCollapsed && (
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Channels
          </span>
        )}
        <div className="flex items-center gap-1">
          {!isCollapsed && isLeader && (
            <button
              type="button"
              onClick={onOpenCreateChannel}
              title="Create New Channel"
              className="p-1 rounded-lg text-slate-500 hover:text-primary-600 hover:bg-primary-50 transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
          {!forceExpanded && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleCollapse();
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-primary-500 relative flex items-center justify-center shrink-0 w-8 h-8"
              title={isCollapsed ? 'Expand channels sidebar' : 'Collapse channels sidebar'}
              aria-label={isCollapsed ? 'Expand channels sidebar' : 'Collapse channels sidebar'}
              aria-expanded={!isCollapsed}
            >
              <span className="relative w-4 h-4 flex items-center justify-center overflow-hidden">
                <PanelLeftClose
                  className={cn(
                    'h-4 w-4 absolute transition-all duration-200 ease-in-out motion-reduce:transition-none',
                    isCollapsed
                      ? 'opacity-0 scale-75 rotate-90 pointer-events-none'
                      : 'opacity-100 scale-100 rotate-0'
                  )}
                  aria-hidden="true"
                />
                <PanelLeftOpen
                  className={cn(
                    'h-4 w-4 absolute transition-all duration-200 ease-in-out motion-reduce:transition-none',
                    isCollapsed
                      ? 'opacity-100 scale-100 rotate-0'
                      : 'opacity-0 scale-75 -rotate-90 pointer-events-none'
                  )}
                  aria-hidden="true"
                />
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Channels List Body */}
      <div className={`flex-1 overflow-y-auto space-y-1 ${isCollapsed ? 'p-1.5' : 'p-2'}`}>
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
  isCollapsed: PropTypes.bool,
  onToggleCollapse: PropTypes.func,
  forceExpanded: PropTypes.bool,
};
