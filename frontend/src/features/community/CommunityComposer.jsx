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
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  }, [initialIdeaContext]);

  // Auto-resize textarea to fit multiline content up to 140px
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 140);
      textareaRef.current.style.height = `${Math.max(newHeight, 38)}px`;
    }
  }, [content]);

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
      if (textareaRef.current) {
        textareaRef.current.style.height = '38px';
      }
    } catch {
      // Error handled by parent
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
      <div className={`p-4 rounded-2xl bg-white border border-slate-200 text-center shadow-xs ${className}`}>
        <p className="text-xs text-slate-600 font-medium">
          Please sign in to participate in Convia Community discussions.
        </p>
      </div>
    );
  }

  const currentUserDisplayName = userProfile?.displayName || user?.displayName || 'You';
  const placeholderText = COMPOSER_PLACEHOLDERS[selectedType] || COMPOSER_PLACEHOLDERS[COMMUNITY_POST_TYPES.DISCUSSION];
  const buttonLabel = COMPOSER_BUTTON_LABELS[selectedType] || 'Post Discussion';
  const canSubmit = Boolean(content.trim() && !isSending);
  const charCount = content.length;
  const isNearLimit = charCount >= 1800;
  const isAtLimit = charCount >= 2000;

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 bg-white shadow-xs ${
        isFocused
          ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-md'
          : 'border-slate-200/90 hover:border-slate-300'
      } ${className}`}
    >
      <form onSubmit={handleSubmit} className="flex flex-col">
        {/* ============================================================ */}
        {/* 1. MESSAGE INPUT AREA (Visual Primary Focus)                 */}
        {/* ============================================================ */}
        <div className="flex items-start gap-3 p-3 sm:p-3.5">
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
              onBlur={() => setIsFocused(false)}
              placeholder={placeholderText}
              rows={isFocused || content ? 2 : 1}
              maxLength={2000}
              aria-label="Write a community message"
              className="w-full resize-none text-sm font-normal text-slate-900 placeholder:text-slate-400 bg-transparent focus:outline-none border-0 p-0 leading-relaxed min-h-[38px] max-h-[140px] transition-all"
            />
          </div>
        </div>

        {/* Error notification banner if present */}
        {error && (
          <div className="mx-3.5 mb-2 px-2.5 py-1.5 rounded-lg bg-rose-50 border border-rose-100 text-xs text-rose-600 flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />
            <span className="flex-1">{error}</span>
            {onClearError && (
              <button
                type="button"
                onClick={onClearError}
                className="p-0.5 text-rose-400 hover:text-rose-700"
                aria-label="Dismiss error"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* 2. POST TYPE SELECTOR (BELOW the Message Input)             */}
        {/* ============================================================ */}
        <div className="px-3 sm:px-3.5 py-2 border-t border-slate-100 flex items-center justify-between gap-2 bg-slate-50/50">
          <div
            role="radiogroup"
            aria-label="Post topic"
            className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 w-full sm:w-auto"
          >
            {postTypes.map(({ type, label }) => {
              const isSelected = selectedType === type;
              const config = COMMUNITY_POST_TYPE_CONFIG[type];

              return (
                <button
                  key={type}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => handleSelectType(type)}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all select-none cursor-pointer ${
                    isSelected
                      ? `${config.color} ring-1 ring-inset ring-current/25 font-bold shadow-2xs scale-[1.02]`
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/90 bg-white border border-slate-200/80'
                  }`}
                  title={config?.description || label}
                >
                  <span className="text-xs">{config?.icon}</span>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ============================================================ */}
        {/* 3. ACTION TOOLBAR & DYNAMIC POST SUBMISSION                  */}
        {/* ============================================================ */}
        <div className="px-3 sm:px-3.5 py-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs bg-white rounded-b-2xl">
          {/* Left: Keyboard Shortcuts & Secondary Character Counter */}
          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium select-none">
            <span className="hidden sm:inline">Press</span>
            <kbd className="hidden sm:inline px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono text-slate-500">
              Enter ↵
            </kbd>
            <span className="hidden sm:inline">to post,</span>
            <kbd className="hidden sm:inline px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono text-slate-500">
              Shift+Enter
            </kbd>
            <span className="hidden sm:inline">for newline</span>

            <span
              className={`font-mono text-[10px] sm:ml-1.5 ${
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

          {/* Right: Dynamic Submission Action Button */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 sm:py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold transition-all shadow-xs disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0"
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
                <Send className="h-3.5 w-3.5" />
              </>
            )}
          </button>
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
