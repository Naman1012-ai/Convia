import React, { useState, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  Send,
  Paperclip,
  X,
  Image as ImageIcon,
  FileText,
  AlertCircle,
  Loader2,
  CornerDownLeft,
} from 'lucide-react';
import { uploadthingService } from '../../services/uploadthingService';
import { chatService } from '../../services/chatService';
import { AttachmentButton } from '../../components/upload/AttachmentButton';
import { ChatMentionAutocomplete } from './ChatMentionAutocomplete';
import { ChatTypingIndicator } from './ChatTypingIndicator';
import { getMentionSuggestions } from '../../utils/chatMentions';
import { resolveMemberDisplayName } from '../../utils/memberIdentity';

export function ChatMessageInput({
  workspaceId,
  user,
  onSendMessage,
  isSubmitting = false,
  uploadProgress = 0,
  disabled = false,
  channelName = 'general',
  members = [],
  typingUsers = [],
}) {
  const [content, setContent] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Mention Autocomplete state
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [mentionIndex, setMentionIndex] = useState(0);

  const textareaRef = useRef(null);
  const lastTypingPublishRef = useRef(0);
  const typingTimeoutRef = useRef(null);

  // Auto-resize textarea to fit multiline content up to 140px
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 140);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [content]);

  // Clean up typing indicator on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (workspaceId && user?.uid) {
        chatService.setTypingState(workspaceId, channelName, user, false).catch(() => {});
      }
    };
  }, [workspaceId, channelName, user?.uid]);

  // Throttled typing publisher (max once per 3s, auto-clears after 3.5s of silence)
  const notifyTyping = useCallback(() => {
    if (!workspaceId || !user?.uid) return;

    const now = Date.now();
    if (now - lastTypingPublishRef.current > 3000) {
      lastTypingPublishRef.current = now;
      chatService.setTypingState(workspaceId, channelName, user, true).catch(() => {});
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      chatService.setTypingState(workspaceId, channelName, user, false).catch(() => {});
    }, 3500);
  }, [workspaceId, channelName, user]);

  // Handle mention detection & typing on text change
  const handleContentChange = (e) => {
    const newText = e.target.value.substring(0, 2000);
    setContent(newText);

    if (newText.trim().length > 0) {
      notifyTyping();
    }

    const cursorPos = e.target.selectionStart || newText.length;
    const textBeforeCursor = newText.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
      const query = textBeforeCursor.substring(lastAtIndex + 1);

      if ((charBeforeAt === ' ' || charBeforeAt === '\n') && !query.includes(' ')) {
        const suggestions = getMentionSuggestions(query, members);
        setMentionQuery(query);
        setMentionSuggestions(suggestions);
        setMentionIndex(0);
        return;
      }
    }

    setMentionQuery(null);
    setMentionSuggestions([]);
  };

  const handleSelectMention = (member) => {
    if (!textareaRef.current || !member) return;
    const cursorPos = textareaRef.current.selectionStart || content.length;
    const textBeforeCursor = content.substring(0, cursorPos);
    const textAfterCursor = content.substring(cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const mentionTag = `@${member.username || resolveMemberDisplayName(member).replace(/\s+/g, '')} `;
      const newContent = textBeforeCursor.substring(0, lastAtIndex) + mentionTag + textAfterCursor;
      setContent(newContent);
      setMentionQuery(null);
      setMentionSuggestions([]);

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const newCursor = lastAtIndex + mentionTag.length;
          textareaRef.current.setSelectionRange(newCursor, newCursor);
        }
      }, 10);
    }
  };

  const handleSelectFile = (file) => {
    if (!file) return;
    setFileError(null);

    const validation = uploadthingService.validateFile(file);
    if (!validation.valid) {
      setFileError(validation.error);
      setPendingFile(null);
      return;
    }

    setPendingFile(file);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Clipboard Paste Image Support
  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          handleSelectFile(file);
          break;
        }
      }
    }
  };

  // Drag & Drop Handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleSelectFile(file);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const trimmedText = content.trim();
    if ((!trimmedText && !pendingFile) || isSubmitting || disabled) return;

    // Instantly clear typing state
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (workspaceId && user?.uid) {
      chatService.setTypingState(workspaceId, channelName, user, false).catch(() => {});
    }

    const fileToUpload = pendingFile;
    const textToSend = trimmedText;

    setContent('');
    setPendingFile(null);
    setFileError(null);
    setMentionQuery(null);
    setMentionSuggestions([]);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      await onSendMessage(textToSend, fileToUpload);
    } catch (err) {
      setContent(textToSend);
      setPendingFile(fileToUpload);
      console.error('[ChatMessageInput] Message send failed, draft restored:', err);
    }
  };

  const handleKeyDown = (e) => {
    if (mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((prev) => (prev + 1) % mentionSuggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((prev) => (prev - 1 + mentionSuggestions.length) % mentionSuggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleSelectMention(mentionSuggestions[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionQuery(null);
        setMentionSuggestions([]);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const charCount = content.length;
  const isNearLimit = charCount > 1800;
  const isAtLimit = charCount >= 2000;
  const canSubmit = (content.trim().length > 0 || pendingFile) && !isSubmitting && !disabled;

  return (
    <form
      onSubmit={handleSubmit}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative bg-white p-3 border-t border-slate-200 transition-colors ${
        isDragging ? 'bg-primary-50/90 border-primary-400' : ''
      }`}
      aria-label="Message Composer"
    >
      {/* Mention Autocomplete Popover */}
      {mentionSuggestions.length > 0 && (
        <ChatMentionAutocomplete
          suggestions={mentionSuggestions}
          selectedIndex={mentionIndex}
          onSelect={handleSelectMention}
          onClose={() => setMentionSuggestions([])}
        />
      )}

      {/* Ephemeral Real-Time Typing Indicator */}
      <ChatTypingIndicator
        typingUsers={typingUsers}
        currentUserId={user?.uid}
        isThread={false}
      />

      {/* Drag & Drop Visual Backdrop */}
      {isDragging && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-primary-600/90 text-white font-extrabold text-xs sm:text-sm rounded-t-2xl backdrop-blur-xs shadow-inner">
          Drop file to attach via UploadThing
        </div>
      )}

      {/* File Validation Error Banner */}
      {fileError && (
        <div className="mb-2 p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between font-mono animate-in fade-in">
          <div className="flex items-center gap-1.5 min-w-0">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span className="truncate">{fileError}</span>
          </div>
          <button
            type="button"
            onClick={() => setFileError(null)}
            className="p-1 hover:text-rose-900 rounded-md focus:outline-none focus:ring-1 focus:ring-rose-400"
            aria-label="Dismiss file error"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Attached File Pill */}
      {pendingFile && (
        <div className="mb-2 p-2 rounded-xl bg-slate-100 border border-slate-300 flex items-center justify-between text-xs font-mono animate-in fade-in">
          <div className="flex items-center gap-2 min-w-0">
            <Paperclip className="h-4 w-4 text-primary-600 shrink-0" />
            <span className="font-bold text-slate-900 truncate max-w-[200px] sm:max-w-xs">
              {pendingFile.name}
            </span>
            <span className="text-slate-500 shrink-0">
              ({uploadthingService.formatFileSize(pendingFile.size)})
            </span>
          </div>

          <button
            type="button"
            onClick={() => setPendingFile(null)}
            className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 transition-colors shrink-0"
            title="Remove attachment"
            aria-label="Remove attachment"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* UploadThing Upload Progress Bar */}
      {isSubmitting && uploadProgress > 0 && uploadProgress < 100 && (
        <div className="mb-2 space-y-1">
          <div className="flex justify-between text-[10px] font-mono text-primary-600 font-bold">
            <span>Uploading attachment to UploadThing CDN...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-600 transition-all duration-150 rounded-full"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Main Composer Box */}
      <div className="flex flex-col gap-1.5 rounded-2xl border border-slate-300/90 bg-slate-50/70 p-2 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20 focus-within:bg-white transition-all shadow-2xs">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={`Message #${channelName}... (Type @ to mention, Enter to send)`}
          disabled={disabled || isSubmitting}
          rows={1}
          className="w-full resize-none bg-transparent p-1.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-50 min-h-[36px] leading-relaxed"
          aria-label={`Message #${channelName}`}
        />

        <div className="flex items-center justify-between border-t border-slate-200/70 pt-2 px-1 text-xs">
          <div className="flex items-center gap-2">
            <AttachmentButton
              onSelectFile={handleSelectFile}
              disabled={disabled || isSubmitting}
            />

            <span
              className={`text-[10px] font-mono font-medium ${
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

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold transition-all shadow-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
              aria-label="Send Message"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin h-3.5 w-3.5" />
                  <span>{uploadProgress > 0 ? 'Uploading...' : 'Sending...'}</span>
                </>
              ) : (
                <>
                  <span>Send</span>
                  <Send className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

ChatMessageInput.propTypes = {
  workspaceId: PropTypes.string,
  user: PropTypes.object,
  onSendMessage: PropTypes.func.isRequired,
  isSubmitting: PropTypes.bool,
  uploadProgress: PropTypes.number,
  disabled: PropTypes.bool,
  channelName: PropTypes.string,
  members: PropTypes.array,
  typingUsers: PropTypes.array,
};
