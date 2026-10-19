import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { Plus } from 'lucide-react';
import { WHATSAPP_QUICK_REACTIONS } from '../../constants/chatSchema';

/**
 * WhatsApp-Style Emoji Reaction Bar with Expandable Full Picker.
 * - Displays WhatsApp 6 canonical quick reactions: 👍 ❤️ 😂 😮 😢 🙏
 * - Provides '+' button to open the full EmojiPicker (Option B) for any Unicode emoji
 * - Discord-style multi-reactions supported
 */
export function ChatReactionPicker({
  isOpen = false,
  onSelectReaction = () => {},
  onClose = () => {},
  align = 'right',
  userReactions = [],
  quickReactions = WHATSAPP_QUICK_REACTIONS,
}) {
  const [showFullPicker, setShowFullPicker] = useState(false);
  const pickerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setShowFullPicker(false);
      return;
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (showFullPicker) {
          setShowFullPicker(false);
        } else {
          onClose();
        }
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
  }, [isOpen, showFullPicker, onClose]);

  if (!isOpen) return null;

  const alignmentClass = align === 'left' ? 'left-0' : 'right-0';

  return (
    <div
      ref={pickerRef}
      className={`absolute bottom-full mb-1.5 ${alignmentClass} z-40 select-none`}
    >
      {/* Full Emoji Picker Popover */}
      {showFullPicker && (
        <div
          className={`absolute bottom-full mb-2 ${alignmentClass} z-50 shadow-2xl rounded-2xl overflow-hidden border border-slate-200/90 bg-white animate-in fade-in zoom-in-95 duration-150`}
          onClick={(e) => e.stopPropagation()}
        >
          <EmojiPicker
            onEmojiClick={(emojiData) => {
              if (emojiData && emojiData.emoji) {
                onSelectReaction(emojiData.emoji);
                setShowFullPicker(false);
                onClose();
              }
            }}
            autoFocusSearch={false}
            theme={Theme.LIGHT}
            lazyLoadEmojis={true}
            searchPlaceHolder="Search emoji..."
            width={320}
            height={380}
            previewConfig={{ showPreview: false }}
          />
        </div>
      )}

      {/* WhatsApp Quick Reaction Capsule */}
      <div
        role="menu"
        aria-label="Reaction picker"
        className="flex items-center gap-1 px-2 py-1.5 rounded-full bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-xl shadow-slate-900/10 animate-in fade-in zoom-in-95 duration-100"
      >
        {quickReactions.map((emoji) => {
          const hasReacted = userReactions.includes(emoji);
          return (
            <button
              key={emoji}
              type="button"
              role="menuitem"
              aria-label={`React with ${emoji}`}
              title={`React with ${emoji}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelectReaction(emoji);
                onClose();
              }}
              className={`h-9 w-9 rounded-full flex items-center justify-center text-lg hover:scale-130 active:scale-95 transition-all duration-150 cursor-pointer ${
                hasReacted
                  ? 'bg-primary-50 ring-2 ring-primary-400'
                  : 'hover:bg-slate-100'
              }`}
            >
              {emoji}
            </button>
          );
        })}

        {/* Divider */}
        <div className="h-5 w-px bg-slate-200 mx-0.5" />

        {/* '+' Expand to Full Emoji Picker */}
        <button
          type="button"
          role="menuitem"
          aria-label="More emoji reactions"
          title="More reactions"
          onClick={(e) => {
            e.stopPropagation();
            setShowFullPicker((prev) => !prev);
          }}
          className={`h-8 w-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
            showFullPicker
              ? 'bg-slate-200 text-slate-900'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

ChatReactionPicker.propTypes = {
  isOpen: PropTypes.bool,
  onSelectReaction: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  align: PropTypes.oneOf(['left', 'right']),
  userReactions: PropTypes.arrayOf(PropTypes.string),
  quickReactions: PropTypes.arrayOf(PropTypes.string),
};
