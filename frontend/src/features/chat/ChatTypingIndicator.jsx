import React from 'react';
import PropTypes from 'prop-types';
import { formatTypingIndicatorText } from '../../constants/chatSchema';

/**
 * Convia Chat Phase 8: Ephemeral Real-Time Typing Indicator Component.
 * Displays animated pulsing dots and grammar-accurate typing actor names.
 */
export function ChatTypingIndicator({
  typingUsers = [],
  currentUserId = null,
  isThread = false,
}) {
  const text = formatTypingIndicatorText(typingUsers, currentUserId, isThread);

  if (!text) return null;

  return (
    <div
      className="flex items-center gap-2 px-3 py-1 text-[11px] text-slate-500 font-medium animate-in fade-in slide-in-from-bottom-1 duration-150 select-none"
      role="status"
      aria-live="polite"
    >
      {/* Animated 3-dot wave */}
      <div className="flex items-center gap-0.5">
        <span className="h-1.5 w-1.5 rounded-full bg-primary-500 animate-bounce [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 rounded-full bg-primary-500 animate-bounce [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 rounded-full bg-primary-500 animate-bounce" />
      </div>

      <span className="truncate italic text-slate-600 font-semibold">{text}</span>
    </div>
  );
}

ChatTypingIndicator.propTypes = {
  typingUsers: PropTypes.arrayOf(PropTypes.object),
  currentUserId: PropTypes.string,
  isThread: PropTypes.bool,
};
