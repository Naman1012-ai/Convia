import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { SUPPORTED_REACTIONS } from '../../constants/chatSchema';

export function ChatReactionPicker({
  isOpen = false,
  onSelectReaction = () => {},
  onClose = () => {},
  align = 'right',
}) {
  const pickerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
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

  if (!isOpen) return null;

  const alignmentClass = align === 'left' ? 'left-0' : 'right-0';

  return (
    <div
      ref={pickerRef}
      role="menu"
      aria-label="Reaction picker"
      className={`absolute bottom-full mb-1.5 ${alignmentClass} z-30 flex items-center gap-1 p-1.5 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-lg shadow-slate-900/10 animate-in fade-in zoom-in-95 duration-100`}
    >
      {SUPPORTED_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          role="menuitem"
          aria-label={`React with ${emoji}`}
          onClick={(e) => {
            e.stopPropagation();
            onSelectReaction(emoji);
            onClose();
          }}
          className="h-8 w-8 rounded-xl flex items-center justify-center text-base hover:scale-125 hover:bg-slate-100 active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer select-none"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

ChatReactionPicker.propTypes = {
  isOpen: PropTypes.bool,
  onSelectReaction: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  align: PropTypes.oneOf(['left', 'right']),
};
