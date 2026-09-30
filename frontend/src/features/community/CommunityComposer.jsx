import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Send,
  Loader2,
  AlertCircle,
  X,
  MessageCircle,
  Lightbulb,
  HelpCircle,
  Users2,
} from 'lucide-react';
import {
  COMMUNITY_POST_TYPES,
  COMMUNITY_POST_TYPE_CONFIG,
  COMPOSER_PLACEHOLDERS,
  COMPOSER_BUTTON_LABELS,
} from '../../constants/chatSchema';
import { useAuth } from '../../hooks/useAuth';
import { useUser } from '../../hooks/useUser';
import { Avatar } from '../../components/ui/Avatar';

export { COMPOSER_PLACEHOLDERS, COMPOSER_BUTTON_LABELS };

export function CommunityComposer({
  onSendMessage = async () => {},
  isSending = false,
  error = null,
  onClearError = () => {},
  initialIdeaContext = null,
  onTyping = () => {},
  className = '',
}) {
  const { user } = useAuth();
  const { userProfile } = useUser();
  const [content, setContent] = useState('');
  const [selectedType, setSelectedType] = useState(COMMUNITY_POST_TYPES.DISCUSSION);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef(null);

  // Auto-fill idea reference if opened with context
  useEffect(() => {
    if (initialIdeaContext?.title && !content) {
      setContent(`Re: "${initialIdeaContext.title}" — `);
      setSelectedType(COMMUNITY_POST_TYPES.IDEA);
      setIsFocused(true);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  }, [initialIdeaContext]);

  // Dynamic textarea height management
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 160);
      textareaRef.current.style.height = `${Math.max(newHeight, isFocused || content ? 52 : 36)}px`;
    }
  }, [content, isFocused]);

  const handleTextChange = (e) => {
    const val = e.target.value.substring(0, 2000);
    setContent(val);
    if (error && onClearError) onClearError();
    if (val.trim()) onTyping();
  };

  const handleSelectType = (type) => {
    // Only update type state; existing typed text is NEVER overwritten
    setSelectedType(type);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || isSending || !user) return;

    try {
      await onSendMessage(trimmed, selectedType);
      setContent('');
      setIsFocused(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = '36px';
      }
    } catch {
      // Handled by parent
    }
  };

  const handleKeyDown = (e) => {
    if (e.nativeEvent?.isComposing) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const postTypes = [
    { type: COMMUNITY_POST_TYPES.DISCUSSION, label: 'Discussion', icon: MessageCircle },
    { type: COMMUNITY_POST_TYPES.IDEA, label: 'Idea', icon: Lightbulb },
    { type: COMMUNITY_POST_TYPES.QUESTION, label: 'Question', icon: HelpCircle },
    { type: COMMUNITY_POST_TYPES.COLLABORATION, label: 'Collaboration', icon: Users2 },
  ];

  if (!user) {
    return (
      <div className={`p-4 rounded-xl bg-white border border-slate-200 text-center shadow-xs ${className}`}>
        <p className="text-xs text-slate-600 font-medium">
          Please sign in to participate in Convia Community discussions.
        </p>
      </div>
    );
  }

  const currentUserDisplayName = userProfile?.displayName || user?.displayName || 'You';
  const placeholderText = isFocused
    ? COMPOSER_PLACEHOLDERS[selectedType] || COMPOSER_PLACEHOLDERS[COMMUNITY_POST_TYPES.DISCUSSION]
    : 'Share something with the community...';
  const buttonLabel = COMPOSER_BUTTON_LABELS[selectedType] || 'Post Discussion';
  const canSubmit = Boolean(content.trim() && !isSending);
  const charCount = content.length;
  const isNearLimit = charCount >= 1800;
  const isAtLimit = charCount >= 2000;
  const isExpanded = isFocused || Boolean(content.trim());

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 bg-white/95 backdrop-blur-md shadow-sm ${
        isFocused
          ? 'border-emerald-500/80 ring-2 ring-emerald-500/15 shadow-md'
          : 'border-slate-200/90 hover:border-slate-300'
      } ${className}`}
    >
      <form onSubmit={handleSubmit} className="flex flex-col">
        {/* Input Area */}
        <div className="flex items-start gap-2.5 p-3">
          <Avatar
            name={currentUserDisplayName}
            src={userProfile?.avatar || user?.photoURL}
            size="sm"
            className="shrink-0 mt-0.5 ring-1 ring-slate-100"
          />

          <div className="flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => {
                if (!content.trim()) {
                  setIsFocused(false);
                }
              }}
              placeholder={placeholderText}
              rows={isExpanded ? 2 : 1}
              maxLength={2000}
              aria-label="Write a community message"
              className="w-full resize-none text-xs sm:text-sm font-normal text-slate-900 placeholder:text-slate-400 bg-transparent focus:outline-none border-0 p-0 leading-relaxed min-h-[36px] max-h-[160px] transition-all"
            />
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mx-3 mb-2 px-2.5 py-1.5 rounded-lg bg-rose-50 border border-rose-100 text-xs text-rose-600 flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />
            <span className="flex-1">{error}</span>
            {onClearError && (
              <button
                type="button"
                onClick={onClearError}
                className="p-0.5 text-rose-400 hover:text-rose-700 cursor-pointer"
                aria-label="Dismiss error"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        {/* Expandable Controls: Topic Selector + Post Action */}
        <div
          className={`overflow-hidden transition-all duration-200 ${
            isExpanded ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
          }`}
        >
          {/* Segmented Topic Selector & Action Row */}
          <div className="px-3 py-2 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-slate-50/60 rounded-b-2xl">
            {/* Topic Segmented Control */}
            <div
              role="radiogroup"
              aria-label="Post topic"
              className="inline-flex items-center gap-1 p-0.5 bg-slate-200/60 rounded-xl overflow-x-auto no-scrollbar"
            >
              {postTypes.map(({ type, label, icon: Icon }) => {
                const isSelected = selectedType === type;
                const config = COMMUNITY_POST_TYPE_CONFIG[type];

                return (
                  <button
                    key={type}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handleSelectType(type)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all select-none cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                    }`}
                    title={config?.description || label}
                  >
                    <Icon className={`h-3 w-3 ${isSelected ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Counter, Shortcuts & Submit Button */}
            <div className="flex items-center justify-between sm:justify-end gap-3 pt-1 sm:pt-0">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 select-none">
                <span className="hidden md:inline font-mono">Enter ↵ to post</span>
                <span className="hidden md:inline text-slate-300">•</span>
                <span
                  className={`font-mono ${
                    isAtLimit
                      ? 'text-rose-600 font-bold'
                      : isNearLimit
                      ? 'text-amber-600 font-bold'
                      : 'text-slate-400'
                  }`}
                >
                  {charCount}/2000
                </span>
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold transition-all shadow-xs disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 shrink-0"
                aria-label={buttonLabel}
              >
                {isSending ? (
                  <>
                    <Loader2 className="animate-spin h-3.5 w-3.5" />
                    <span>Posting...</span>
                  </>
                ) : (
                  <>
                    <span>{buttonLabel}</span>
                    <Send className="h-3 w-3" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

CommunityComposer.propTypes = {
  onSendMessage: PropTypes.func.isRequired,
  isSending: PropTypes.bool,
  error: PropTypes.string,
  onClearError: PropTypes.func,
  initialIdeaContext: PropTypes.object,
  onTyping: PropTypes.func,
  className: PropTypes.string,
};
