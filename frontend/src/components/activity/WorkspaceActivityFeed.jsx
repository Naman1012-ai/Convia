import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import {
  Lightbulb,
  MessageSquare,
  Sparkles,
  Bot,
  Users,
  UserMinus,
  CheckCircle,
  HelpCircle,
  Clock,
  ExternalLink,
  ChevronDown,
  Filter,
  RefreshCw,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { activityService } from '../../services/activityService';
import { getActivityCategory, ACTIVITY_CATEGORIES } from '../../constants/activityConstants';
import { formatTimestamp } from '../../utils/formatting';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { LoadingSkeleton } from '../feedback/LoadingSkeleton';
import { EmptyState } from '../feedback/EmptyState';

export function WorkspaceActivityFeed({ workspaceId, maxItems = 50, showFilters = true, compact = false }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [displayCount, setDisplayCount] = useState(compact ? 8 : 20);

  useEffect(() => {
    // Reset activities and filters on workspaceId change
    setActivities([]);
    setFilterCategory('ALL');

    if (!workspaceId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    let isSubscribed = true;

    const unsubscribe = activityService.subscribeToWorkspaceActivity(
      workspaceId,
      (eventList) => {
        if (!isSubscribed) return;
        setActivities(Array.isArray(eventList) ? eventList : []);
        setLoading(false);
      },
      { limit: maxItems }
    );

    return () => {
      isSubscribed = false;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [workspaceId, maxItems]);

  const categoryCounts = useMemo(() => {
    const counts = {
      ALL: activities.length,
      PROPOSALS: 0,
      BLUEPRINTS: 0,
      DISCUSSIONS: 0,
      TEAM: 0,
    };

    activities.forEach((act) => {
      const cat = getActivityCategory(act.eventType);
      if (cat === ACTIVITY_CATEGORIES.IDEA) {
        counts.PROPOSALS += 1;
      } else if (cat === ACTIVITY_CATEGORIES.BLUEPRINT) {
        counts.BLUEPRINTS += 1;
      } else if (
        cat === ACTIVITY_CATEGORIES.SUGGESTION ||
        cat === ACTIVITY_CATEGORIES.COMMENT ||
        cat === ACTIVITY_CATEGORIES.QUESTION
      ) {
        counts.DISCUSSIONS += 1;
      } else if (cat === ACTIVITY_CATEGORIES.WORKSPACE) {
        counts.TEAM += 1;
      }
    });

    return counts;
  }, [activities]);

  const filteredActivities = useMemo(() => {
    if (filterCategory === 'ALL') return activities;
    if (filterCategory === 'PROPOSALS') {
      return activities.filter((act) => getActivityCategory(act.eventType) === ACTIVITY_CATEGORIES.IDEA);
    }
    if (filterCategory === 'BLUEPRINTS') {
      return activities.filter((act) => getActivityCategory(act.eventType) === ACTIVITY_CATEGORIES.BLUEPRINT);
    }
    if (filterCategory === 'DISCUSSIONS') {
      return activities.filter((act) => {
        const cat = getActivityCategory(act.eventType);
        return (
          cat === ACTIVITY_CATEGORIES.SUGGESTION ||
          cat === ACTIVITY_CATEGORIES.COMMENT ||
          cat === ACTIVITY_CATEGORIES.QUESTION
        );
      });
    }
    if (filterCategory === 'TEAM') {
      return activities.filter((act) => getActivityCategory(act.eventType) === ACTIVITY_CATEGORIES.WORKSPACE);
    }
    return activities;
  }, [activities, filterCategory]);

  const displayedList = useMemo(() => {
    return filteredActivities.slice(0, displayCount);
  }, [filteredActivities, displayCount]);

  const hasMore = filteredActivities.length > displayCount;

  const handleLoadMore = () => {
    setDisplayCount((prev) => prev + (compact ? 8 : 20));
  };

  const getEventBadge = (act) => {
    const category = getActivityCategory(act.eventType);
    const isSystem = act.actorType === 'system';

    if (isSystem) {
      return {
        icon: Bot,
        label: 'System AI',
        color: 'bg-purple-950/80 text-purple-300 border border-purple-800',
        iconColor: 'text-purple-400',
      };
    }

    switch (category) {
      case ACTIVITY_CATEGORIES.IDEA:
        return {
          icon: Lightbulb,
          label: 'Proposal',
          color: 'bg-amber-950/70 text-amber-300 border border-amber-800',
          iconColor: 'text-amber-400',
        };
      case ACTIVITY_CATEGORIES.BLUEPRINT:
        return {
          icon: Sparkles,
          label: 'Blueprint',
          color: 'bg-indigo-950/70 text-indigo-300 border border-indigo-800',
          iconColor: 'text-indigo-400',
        };
      case ACTIVITY_CATEGORIES.SUGGESTION:
        return {
          icon: CheckCircle,
          label: 'Suggestion',
          color: 'bg-emerald-950/70 text-emerald-300 border border-emerald-800',
          iconColor: 'text-emerald-400',
        };
      case ACTIVITY_CATEGORIES.QUESTION:
        return {
          icon: HelpCircle,
          label: 'Question',
          color: 'bg-sky-950/70 text-sky-300 border border-sky-800',
          iconColor: 'text-sky-400',
        };
      case ACTIVITY_CATEGORIES.COMMENT:
        return {
          icon: MessageSquare,
          label: 'Comment',
          color: 'bg-slate-800 text-slate-300 border border-slate-700',
          iconColor: 'text-slate-400',
        };
      case ACTIVITY_CATEGORIES.WORKSPACE:
        return {
          icon: act.eventType.includes('removed') ? UserMinus : Users,
          label: 'Team',
          color: 'bg-teal-950/70 text-teal-300 border border-teal-800',
          iconColor: 'text-teal-400',
        };
      default:
        return {
          icon: Clock,
          label: 'Activity',
          color: 'bg-slate-800 text-slate-300 border border-slate-700',
          iconColor: 'text-slate-400',
        };
    }
  };

  if (loading) {
    return (
      <div className="space-y-3 py-4">
        <LoadingSkeleton variant="card" count={compact ? 3 : 5} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Optional Category Filter Pills */}
      {showFilters && !compact && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none text-xs font-mono">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setFilterCategory('ALL')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
              filterCategory === 'ALL'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            All Activity ({categoryCounts.ALL})
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setFilterCategory('PROPOSALS')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
              filterCategory === 'PROPOSALS'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Proposals ({categoryCounts.PROPOSALS})
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setFilterCategory('BLUEPRINTS')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
              filterCategory === 'BLUEPRINTS'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Blueprints ({categoryCounts.BLUEPRINTS})
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setFilterCategory('DISCUSSIONS')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
              filterCategory === 'DISCUSSIONS'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Discussions ({categoryCounts.DISCUSSIONS})
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setFilterCategory('TEAM')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
              filterCategory === 'TEAM'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Team ({categoryCounts.TEAM})
          </Button>
        </div>
      )}

      {/* Empty State */}
      {displayedList.length === 0 ? (
        <div className="py-8">
          <EmptyState
            icon={<Clock className="h-8 w-8 text-slate-500" />}
            title="No Activity Yet"
            description="Events will automatically appear here as team members propose ideas, collaborate, and build specifications."
          />
        </div>
      ) : (
        <div className="space-y-2.5">
          {displayedList.map((act) => {
            const badge = getEventBadge(act);
            const Icon = badge.icon;
            const isSystem = act.actorType === 'system';

            return (
              <div
                key={act.id}
                className="group relative flex items-start gap-3.5 p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800/80 hover:border-slate-700 transition-all hover:bg-slate-900 shadow-sm"
              >
                {/* Event Type Icon Avatar */}
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${badge.color}`}
                >
                  <Icon className={`h-4 w-4 ${badge.iconColor}`} />
                </div>

                {/* Event Details */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-slate-200">
                        {isSystem ? 'Convia AI Engine' : act.actorName}
                      </span>
                      {isSystem && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-purple-950 text-purple-300 border border-purple-800">
                          AI System
                        </span>
                      )}
                      <span className="text-slate-500 text-xs">•</span>
                      <span className="text-[11px] font-mono text-slate-400">
                        {formatTimestamp(act.createdAt)}
                      </span>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider ${badge.color}`}>
                      {badge.label}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    {act.summary}
                  </p>

                  {/* Resource Context & Deep Link */}
                  {act.actionUrl && act.actionUrl !== '#' && (
                    <div className="pt-1">
                      <Link
                        to={act.actionUrl}
                        className="inline-flex items-center gap-1 text-[11px] font-mono text-indigo-400 hover:text-indigo-300 transition-colors font-bold"
                      >
                        <span>View {act.resourceType || 'Resource'}</span>
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination / Load More */}
      {hasMore && (
        <div className="pt-2 text-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleLoadMore}
            className="w-full sm:w-auto text-xs font-mono font-bold border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-300 py-2 px-6 rounded-xl"
          >
            <ChevronDown className="h-3.5 w-3.5 mr-1 text-slate-400" />
            Load More Activity ({filteredActivities.length - displayCount} remaining)
          </Button>
        </div>
      )}
    </div>
  );
}

WorkspaceActivityFeed.propTypes = {
  workspaceId: PropTypes.string.isRequired,
  maxItems: PropTypes.number,
  showFilters: PropTypes.bool,
  compact: PropTypes.bool,
};
