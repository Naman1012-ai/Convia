import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Search, X, MessageSquare, Loader2, User, Clock, ArrowRight } from 'lucide-react';
import { chatService } from '../../services/chatService';
import { formatMessageTime, formatFullDateTime } from '../../utils/chatFeedHelpers';
import { resolveMemberDisplayName } from '../../utils/memberIdentity';
import { useUserProfiles } from '../../hooks/useUserProfile';

/**
 * Convia Chat Phase 7: Message Discovery & In-Channel Search Modal.
 * Enables quick discovery of messages and discussions within a workspace.
 */
export function ChatSearchModal({
  isOpen = false,
  onClose = () => {},
  workspaceId,
  channelId = 'general',
  members = [],
  memberJoinedAt = null,
  onSelectResult = () => {},
}) {
  const [queryText, setQueryText] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const resultSenderIds = React.useMemo(() => {
    return Array.from(new Set(results.map((r) => r.senderId).filter(Boolean)));
  }, [results]);

  const { resolveName } = useUserProfiles(resultSenderIds);
  const inputRef = useRef(null);
  const modalRef = useRef(null);

  // Auto-focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQueryText('');
      setResults([]);
      setIsSearching(false);
    }
  }, [isOpen]);

  // Keyboard accessibility: Escape closes modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Debounced search trigger
  useEffect(() => {
    const cleanQuery = queryText.trim();
    if (!cleanQuery) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timeoutId = setTimeout(async () => {
      try {
        const found = await chatService.searchMessages(workspaceId, channelId, cleanQuery, 30, memberJoinedAt);
        setResults(found);
      } catch (err) {
        console.error('[ChatSearchModal] search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [queryText, workspaceId, channelId, memberJoinedAt]);

  const highlightMatch = (text, query) => {
    if (!query || !text) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-amber-200 text-amber-900 rounded-xs px-0.5 font-bold">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="search-modal-title"
    >
      <div
        ref={modalRef}
        className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-150"
      >
        {/* Search Input Bar */}
        <div className="p-3 border-b border-slate-100 flex items-center gap-2.5 bg-slate-50/80">
          <Search className="h-5 w-5 text-primary-600 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Search messages, replies, and members in #general..."
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
            aria-label="Search messages"
          />
          {queryText && (
            <button
              type="button"
              onClick={() => setQueryText('')}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 rounded-lg bg-slate-200/60 hover:bg-slate-200 text-xs font-semibold text-slate-600 transition-colors"
          >
            Esc
          </button>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-slate-50">
          {isSearching ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-slate-400">
              <Loader2 className="h-6 w-6 text-primary-600 animate-spin" />
              <span>Searching messages...</span>
            </div>
          ) : queryText.trim() && results.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 space-y-1">
              <p className="font-semibold text-slate-600">No matching messages found</p>
              <p>Try searching for a different keyword or member name.</p>
            </div>
          ) : !queryText.trim() ? (
            <div className="py-12 text-center text-xs text-slate-400 space-y-1">
              <Search className="h-7 w-7 text-slate-300 mx-auto mb-1" />
              <p className="font-semibold text-slate-600">Message Discovery</p>
              <p>Type to search through conversations, decisions, and files.</p>
            </div>
          ) : (
            results.map((result) => {
              const member = members.find((m) => m && (m.uid === result.senderId || m.id === result.senderId));
              const fallback = member ? resolveMemberDisplayName(member) : result.senderName || 'Member';
              const displayName = resolveName(result.senderId, fallback);

              return (
                <button
                  key={result.messageId}
                  type="button"
                  onClick={() => {
                    onSelectResult(result);
                    onClose();
                  }}
                  className="w-full text-left p-3 rounded-xl hover:bg-primary-50/50 transition-colors flex items-start gap-3 group cursor-pointer"
                >
                  <div className="h-7 w-7 rounded-full bg-primary-50 text-primary-600 border border-primary-100 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    {(displayName || 'M').charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {displayName}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 shrink-0">
                        {formatMessageTime(result.createdAt)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed line-clamp-2">
                      {highlightMatch(result.content, queryText.trim())}
                    </p>
                  </div>

                  <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-primary-600 transition-colors shrink-0 self-center" />
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>{results.length} results found</span>
          <span>Press Esc to close</span>
        </div>
      </div>
    </div>
  );
}

ChatSearchModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  workspaceId: PropTypes.string,
  channelId: PropTypes.string,
  members: PropTypes.array,
  onSelectResult: PropTypes.func,
};
