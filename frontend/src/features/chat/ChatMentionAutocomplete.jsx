import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { User, AtSign } from 'lucide-react';
import { resolveMemberDisplayName } from '../../utils/memberIdentity';

/**
 * Interactive Mention Autocomplete Dropdown Popover.
 * Renders when the user types `@` in the chat input or thread composer.
 */
export function ChatMentionAutocomplete({
  suggestions = [],
  selectedIndex = 0,
  onSelect = () => {},
  onClose = () => {},
}) {
  const containerRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-4 mb-2 w-64 max-h-56 overflow-y-auto rounded-2xl bg-white border border-slate-200 shadow-xl z-50 p-1.5 space-y-0.5 animate-in fade-in zoom-in-95 duration-100"
      role="listbox"
      aria-label="Member mention suggestions"
    >
      <div className="px-2 py-1 border-b border-slate-100 flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
        <AtSign className="h-3 w-3 text-indigo-500" />
        <span>Mention Member</span>
      </div>

      {suggestions.map((member, index) => {
        const isSelected = index === selectedIndex;
        const displayName = resolveMemberDisplayName(member);
        const avatar = member.avatar || member.photoURL || '';

        return (
          <button
            key={member.uid || member.id || `suggest_${index}`}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelect(member);
            }}
            className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-colors cursor-pointer ${
              isSelected ? 'bg-indigo-50 text-indigo-900 font-semibold' : 'hover:bg-slate-50 text-slate-700'
            }`}
            role="option"
            aria-selected={isSelected}
          >
            <div className="flex items-center gap-2 min-w-0">
              {avatar ? (
                <img
                  src={avatar}
                  alt={displayName}
                  className="h-6 w-6 rounded-full object-cover border border-slate-200 shrink-0"
                />
              ) : (
                <div className="h-6 w-6 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="min-w-0">
                <p className="text-xs font-bold truncate">{displayName}</p>
                {member.username && (
                  <p className="text-[10px] text-slate-400 font-mono truncate">@{member.username}</p>
                )}
              </div>
            </div>

            <span className="text-[10px] font-mono text-indigo-600 font-semibold shrink-0">
              Tab ↵
            </span>
          </button>
        );
      })}
    </div>
  );
}

ChatMentionAutocomplete.propTypes = {
  suggestions: PropTypes.arrayOf(PropTypes.object).isRequired,
  selectedIndex: PropTypes.number,
  onSelect: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};
