import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  X,
  Lightbulb,
  Sparkles,
  HelpCircle,
  CheckCircle,
  MessageSquare,
  Activity,
  ExternalLink,
  Clock,
  ArrowRight,
  Command,
  AlertTriangle,
} from 'lucide-react';
import { searchService } from '../../services/searchService';
import {
  SEARCH_RESOURCE_TYPES,
  SEARCH_RESOURCE_LABELS,
} from '../../constants/searchConstants';
import { formatTimestamp } from '../../utils/formatting';

export function WorkspaceSearchModal({ isOpen, onClose, workspaceId }) {
  const [queryText, setQueryText] = useState('');
  const [activeFilter, setActiveFilter] = useState(SEARCH_RESOURCE_TYPES.ALL);
  const [results, setResults] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const navigate = useNavigate();

  // Focus input upon open & fetch initial suggestions
  useEffect(() => {
    if (isOpen) {
      setQueryText('');
      setResults([]);
      setSearchError(null);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);

      // Load initial quick suggestions
      if (workspaceId) {
        searchService.getSearchSuggestions(workspaceId).then((suggs) => {
          setSuggestions(Array.isArray(suggs) ? suggs : []);
        });
      }
    }
  }, [isOpen, workspaceId]);

  // Debounced search trigger
  const executeSearch = useCallback(
    (text, filter) => {
      if (!text || text.trim().length < 2) {
        setResults([]);
        setSearchError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setSearchError(null);
      searchService
        .searchWorkspace(workspaceId, text, { filter, limit: 30 })
        .then((res) => {
          if (!res.isStale) {
            if (res.isUnauthorized || (res.success === false && res.error)) {
              setSearchError(res.error || 'Access Denied: You do not have permission to search this workspace.');
              setResults([]);
            } else {
              setSearchError(null);
              setResults(res.results || []);
            }
            setSelectedIndex(0);
            setIsLoading(false);
          }
        })
        .catch((err) => {
          console.error('[WorkspaceSearchModal] search failed:', err);
          setSearchError('Search failed. Please try again.');
          setIsLoading(false);
        });
    },
    [workspaceId]
  );

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQueryText(val);
    setSearchError(null);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      executeSearch(val, activeFilter);
    }, 250);
  };

  const handleFilterChange = (newFilter) => {
    setActiveFilter(newFilter);
    executeSearch(queryText, newFilter);
  };

  const handleSelectResult = (result) => {
    if (!result || !result.actionUrl) return;
    onClose();
    navigate(result.actionUrl);
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const activeList = queryText.trim().length >= 2 ? results : suggestions;
        if (activeList.length > 0) {
          setSelectedIndex((prev) => (prev + 1) % activeList.length);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const activeList = queryText.trim().length >= 2 ? results : suggestions;
        if (activeList.length > 0) {
          setSelectedIndex((prev) => (prev - 1 + activeList.length) % activeList.length);
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const activeList = queryText.trim().length >= 2 ? results : suggestions;
        if (activeList.length > 0 && activeList[selectedIndex]) {
          handleSelectResult(activeList[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, suggestions, queryText, selectedIndex, onClose]);

  if (!isOpen) return null;

  const displayList = queryText.trim().length >= 2 ? results : suggestions;
  const isZeroState = queryText.trim().length < 2;

  const getResourceIcon = (type) => {
    switch (type) {
      case SEARCH_RESOURCE_TYPES.IDEA:
        return <Lightbulb className="h-4 w-4 text-amber-500" />;
      case SEARCH_RESOURCE_TYPES.BLUEPRINT:
        return <Sparkles className="h-4 w-4 text-purple-500" />;
      case SEARCH_RESOURCE_TYPES.QUESTION:
        return <HelpCircle className="h-4 w-4 text-sky-500" />;
      case SEARCH_RESOURCE_TYPES.SUGGESTION:
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case SEARCH_RESOURCE_TYPES.COMMENT:
        return <MessageSquare className="h-4 w-4 text-slate-400" />;
      case SEARCH_RESOURCE_TYPES.CHAT:
        return <MessageSquare className="h-4 w-4 text-indigo-500" />;
      case SEARCH_RESOURCE_TYPES.ACTIVITY:
        return <Activity className="h-4 w-4 text-teal-500" />;
      default:
        return <Search className="h-4 w-4 text-slate-400" />;
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-950/70 backdrop-blur-sm transition-opacity">
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl transition-all"
        role="dialog"
        aria-modal="true"
      >
        {/* Top Search Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <Search className="h-5 w-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={queryText}
            onChange={handleInputChange}
            placeholder="Search proposals, blueprints, questions, tasks, chat..."
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none font-medium"
          />

          {isLoading && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          )}

          {queryText && (
            <button
              onClick={() => {
                setQueryText('');
                setResults([]);
                inputRef.current?.focus();
              }}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-mono font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-700">
            ESC
          </kbd>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 px-4 py-2 overflow-x-auto border-b border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900 scrollbar-none text-xs">
          {Object.entries(SEARCH_RESOURCE_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => handleFilterChange(key)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeFilter === key
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Results / Suggestions Container */}
        <div className="max-h-[380px] overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-slate-800/50">
          {isZeroState && (
            <div className="px-3 py-2 text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
              Recent Workspace Proposals
            </div>
          )}

          {!isLoading && searchError && (
            <div className="py-10 px-4 text-center space-y-2">
              <div className="inline-flex p-3 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-500 mb-1">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <p className="text-sm font-bold text-rose-600 dark:text-rose-400">
                {searchError}
              </p>
              <p className="text-xs text-slate-500">
                You must be an authorized member of this workspace to search its content.
              </p>
            </div>
          )}

          {!isLoading && !searchError && queryText.trim().length >= 2 && results.length === 0 && (
            <div className="py-12 text-center space-y-2">
              <Search className="h-8 w-8 text-slate-400 mx-auto" />
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                No results found for &ldquo;{queryText}&rdquo;
              </p>
              <p className="text-xs text-slate-500">
                Try searching for keywords in proposal titles, blueprint requirements (REQ-01), or discussions.
              </p>
            </div>
          )}

          {displayList.map((res, index) => {
            const isSelected = index === selectedIndex;
            return (
              <div
                key={res.id || index}
                onClick={() => handleSelectResult(res)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-indigo-50/80 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0 mt-0.5">
                  {getResourceIcon(res.resourceType)}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                      {res.title}
                    </h4>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {res.badgeLabel}
                    </span>
                  </div>

                  {res.excerpt && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed font-medium">
                      {res.excerpt}
                    </p>
                  )}

                  <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400 pt-0.5">
                    {res.authorName && <span>By {res.authorName}</span>}
                    {res.createdAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTimestamp(res.createdAt)}
                      </span>
                    )}
                  </div>
                </div>

                <ArrowRight
                  className={`h-4 w-4 shrink-0 mt-2 transition-transform ${
                    isSelected
                      ? 'text-indigo-600 dark:text-indigo-400 translate-x-0.5'
                      : 'text-slate-300 dark:text-slate-600'
                  }`}
                />
              </div>
            );
          })}
        </div>

        {/* Modal Footer with Keyboard Shortcuts */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-700">
                ↑
              </kbd>
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-700">
                ↓
              </kbd>{' '}
              to navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-700">
                ↵
              </kbd>{' '}
              to open
            </span>
          </div>

          <div className="flex items-center gap-1 text-slate-400">
            <Command className="h-3 w-3" />
            <span>Workspace Discovery</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

WorkspaceSearchModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  workspaceId: PropTypes.string,
};
