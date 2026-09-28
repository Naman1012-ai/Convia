import React from 'react';
import PropTypes from 'prop-types';
import {
  Globe,
  Lightbulb,
  HelpCircle,
  MessageCircle,
  Users2,
  Sparkles,
  ArrowRight,
  Plus,
  Bookmark,
  User,
  CornerDownRight,
} from 'lucide-react';
import { COMMUNITY_POST_TYPES } from '../../constants/chatSchema';
import { Button } from '../../components/ui/Button';

export function CommunityNav({
  activeFilter = 'all',
  onSelectFilter = () => {},
  onOpenCreate = () => {},
  discussionCounts = {},
  activityCounts = {},
  isAuthenticated = true,
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
      color: 'text-indigo-500',
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
    <div className={`flex flex-col h-full space-y-6 ${className}`}>
      {/* Primary Action Button */}
      <div>
        <Button
          variant="primary"
          size="md"
          icon={<Plus className="h-4 w-4" />}
          onClick={onOpenCreate}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-semibold justify-center py-2.5 rounded-xl transition-all hover:shadow"
        >
          Start a Discussion
        </Button>
      </div>

      {/* Functional Community Channels Navigation */}
      <div className="space-y-1">
        <div className="px-3 pb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
          <span>Channels</span>
          <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
            Live
          </span>
        </div>

        <nav className="space-y-1" aria-label="Community Channels">
          {channels.map((chan) => {
            const Icon = chan.icon;
            const isActive = activeFilter === chan.id;

            return (
              <button
                key={chan.id}
                type="button"
                onClick={() => onSelectFilter(chan.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group text-left ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-900 font-bold border border-emerald-200/80 shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`p-1.5 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="truncate">{chan.label}</span>
                </div>

                {chan.count > 0 && (
                  <span
                    className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${
                      isActive
                        ? 'bg-emerald-200 text-emerald-900 font-bold'
                        : 'bg-slate-200/70 text-slate-600'
                    }`}
                  >
                    {chan.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Real User Activity Navigation (Zero Fake Data) */}
      {isAuthenticated && (
        <div className="space-y-1 pt-2 border-t border-slate-100">
          <div className="px-3 pb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <span>Your Activity</span>
          </div>

          <nav className="space-y-1" aria-label="User Community Activity">
            {activityFilters.map((act) => {
              const Icon = act.icon;
              const isActive = activeFilter === act.id;

              return (
                <button
                  key={act.id}
                  type="button"
                  onClick={() => onSelectFilter(act.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all group text-left ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-900 font-bold border border-emerald-200/80 shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 border border-transparent'
                  }`}
                  title={act.description}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`p-1.5 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="truncate">{act.label}</span>
                  </div>

                  {act.count > 0 && (
                    <span
                      className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-emerald-200 text-emerald-900 font-bold'
                          : 'bg-slate-200/70 text-slate-600'
                      }`}
                    >
                      {act.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      )}

      {/* Convia Philosophy Reminder Card */}
      <div className="mt-auto p-4 rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50/60 to-indigo-50/40 border border-emerald-100/80 shadow-2xs space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
          <Sparkles className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
          <span>The Convia Pipeline</span>
        </div>
        <p className="text-[11px] text-slate-600 leading-relaxed">
          Ideas ignite in community discussions, mature through suggestions, and evolve into structured blueprints and actions.
        </p>
        <div className="pt-1 flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
          <span>Idea</span>
          <ArrowRight className="h-2.5 w-2.5" />
          <span>Discuss</span>
          <ArrowRight className="h-2.5 w-2.5" />
          <span>Blueprint</span>
          <ArrowRight className="h-2.5 w-2.5" />
          <span>Action</span>
        </div>
      </div>
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
  className: PropTypes.string,
};
