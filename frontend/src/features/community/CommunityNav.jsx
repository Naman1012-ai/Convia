import React from 'react';
import PropTypes from 'prop-types';
import {
  Globe,
  Lightbulb,
  HelpCircle,
  MessageCircle,
  Users2,
  Bookmark,
  User,
  CornerDownRight,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { COMMUNITY_POST_TYPES } from '../../constants/chatSchema';
import { cn } from '../../utils/cn';

export function CommunityNav({
  activeFilter = 'all',
  onSelectFilter = () => {},
  discussionCounts = {},
  activityCounts = {},
  isAuthenticated = true,
  isCollapsed = false,
  onToggleCollapse = null,
  className = '',
}) {
  const channels = [
    {
      id: 'all',
      label: 'All Discussions',
      icon: Globe,
      count: discussionCounts.all ?? 0,
      description: 'The entire community stream',
    },
    {
      id: COMMUNITY_POST_TYPES.IDEA,
      label: 'Ideas',
      icon: Lightbulb,
      count: discussionCounts[COMMUNITY_POST_TYPES.IDEA] ?? 0,
      description: 'Concepts & feature proposals',
      color: 'text-amber-500',
    },
    {
      id: COMMUNITY_POST_TYPES.QUESTION,
      label: 'Questions',
      icon: HelpCircle,
      count: discussionCounts[COMMUNITY_POST_TYPES.QUESTION] ?? 0,
      description: 'Ask for guidance or feedback',
      color: 'text-sky-500',
    },
    {
      id: COMMUNITY_POST_TYPES.DISCUSSION,
      label: 'Discussions',
      icon: MessageCircle,
      count: discussionCounts[COMMUNITY_POST_TYPES.DISCUSSION] ?? 0,
      description: 'General conversations & thoughts',
      color: 'text-primary-500',
    },
    {
      id: COMMUNITY_POST_TYPES.COLLABORATION,
      label: 'Collaboration',
      icon: Users2,
      count: discussionCounts[COMMUNITY_POST_TYPES.COLLABORATION] ?? 0,
      description: 'Find teammates & project partners',
      color: 'text-emerald-500',
    },
  ];

  const activityFilters = [
    {
      id: 'my_discussions',
      label: 'My Discussions',
      icon: User,
      count: activityCounts.myDiscussions ?? 0,
      description: 'Discussions started by you',
    },
    {
      id: 'my_replies',
      label: 'My Replies',
      icon: CornerDownRight,
      count: activityCounts.myReplies ?? 0,
      description: 'Threads where you participated',
    },
    {
      id: 'saved',
      label: 'Saved',
      icon: Bookmark,
      count: activityCounts.saved ?? 0,
      description: 'Your bookmarked discussions',
    },
  ];

  return (
    <div
      className={`flex flex-col h-full select-none transition-all duration-200 ${
        isCollapsed ? 'items-center px-1' : 'px-2'
      } ${className}`}
    >
      {/* Sidebar Header & Collapse Toggle */}
      <div className={`flex items-center pb-3 mb-2 border-b border-slate-100 ${
        isCollapsed ? 'justify-center w-full' : 'justify-between px-2'
      }`}>
        {!isCollapsed && (
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Community
          </span>
        )}
        {typeof onToggleCollapse === 'function' && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse(e);
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-primary-500 relative flex items-center justify-center shrink-0 w-8 h-8"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
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

      {/* Section 1: Community Channels */}
      <div className="w-full space-y-0.5">
        {!isCollapsed && (
          <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Channels
          </div>
        )}

        <nav className="space-y-0.5" aria-label="Community Channels">
          {channels.map((chan) => {
            const Icon = chan.icon;
            const isActive = activeFilter === chan.id;

            return (
              <button
                key={chan.id}
                type="button"
                onClick={() => onSelectFilter(chan.id)}
                title={isCollapsed ? `${chan.label} (${chan.count})` : chan.description}
                className={`w-full flex items-center transition-all group cursor-pointer text-left ${
                  isCollapsed
                    ? 'justify-center p-2 rounded-xl'
                    : 'justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium'
                } ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-900 font-bold border-l-2 border-emerald-600 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'
                }`}
              >
                <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5 min-w-0'}`}>
                  <Icon
                    className={`h-4 w-4 shrink-0 transition-colors ${
                      isActive ? 'text-emerald-700' : 'text-slate-400 group-hover:text-slate-600'
                    }`}
                  />
                  {!isCollapsed && (
                    <span className="truncate">{chan.label}</span>
                  )}
                </div>

                {!isCollapsed && chan.count > 0 && (
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                      isActive
                        ? 'bg-emerald-200/80 text-emerald-900 font-bold'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {chan.count}
                  </span>
                )}

                {isCollapsed && chan.count > 0 && (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-emerald-500" />
                )}

                {isCollapsed && (
                  <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center z-50 pointer-events-none">
                    <div className="bg-slate-800 text-white text-xs font-semibold px-2.5 py-1 rounded-md shadow-lg whitespace-nowrap flex items-center gap-1.5 border border-slate-700">
                      <span>{chan.label}</span>
                      {chan.count > 0 && (
                        <span className="text-[10px] font-mono text-emerald-400">({chan.count})</span>
                      )}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Section 2: User Activity (Zero Fake Data) */}
      {isAuthenticated && (
        <div className={`w-full pt-4 mt-3 border-t border-slate-100 space-y-0.5`}>
          {!isCollapsed && (
            <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              My Activity
            </div>
          )}

          <nav className="space-y-0.5" aria-label="User Community Activity">
            {activityFilters.map((act) => {
              const Icon = act.icon;
              const isActive = activeFilter === act.id;

              return (
                <button
                  key={act.id}
                  type="button"
                  onClick={() => onSelectFilter(act.id)}
                  title={isCollapsed ? `${act.label} (${act.count})` : act.description}
                  className={`w-full flex items-center transition-all group cursor-pointer text-left ${
                    isCollapsed
                      ? 'justify-center p-2 rounded-xl relative'
                      : 'justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium'
                  } ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-900 font-bold border-l-2 border-emerald-600 shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'
                  }`}
                >
                  <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5 min-w-0'}`}>
                    <Icon
                      className={`h-4 w-4 shrink-0 transition-colors ${
                        isActive ? 'text-emerald-700' : 'text-slate-400 group-hover:text-slate-600'
                      }`}
                    />
                    {!isCollapsed && (
                      <span className="truncate">{act.label}</span>
                    )}
                  </div>

                  {!isCollapsed && act.count > 0 && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-emerald-200/80 text-emerald-900 font-bold'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {act.count}
                    </span>
                  )}

                  {isCollapsed && (
                    <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center z-50 pointer-events-none">
                      <div className="bg-slate-800 text-white text-xs font-semibold px-2.5 py-1 rounded-md shadow-lg whitespace-nowrap flex items-center gap-1.5 border border-slate-700">
                        <span>{act.label}</span>
                        {act.count > 0 && (
                          <span className="text-[10px] font-mono text-emerald-400">({act.count})</span>
                        )}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      )}
    </div>
  );
}

CommunityNav.propTypes = {
  activeFilter: PropTypes.string,
  onSelectFilter: PropTypes.func,
  onOpenCreate: PropTypes.func,
  discussionCounts: PropTypes.object,
  activityCounts: PropTypes.object,
  isAuthenticated: PropTypes.bool,
  isCollapsed: PropTypes.bool,
  onToggleCollapse: PropTypes.func,
  className: PropTypes.string,
};
