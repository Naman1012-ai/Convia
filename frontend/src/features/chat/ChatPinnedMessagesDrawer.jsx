import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Pin, PinOff, X, CornerDownRight, Trash2, ExternalLink, Loader2, Mic } from 'lucide-react';
import { chatService } from '../../services/chatService';
import { formatFullDateTime, formatMessageTime } from '../../utils/chatFeedHelpers';
import { resolveMemberDisplayName } from '../../utils/memberIdentity';
import { renderDiscordMarkdown } from '../../utils/discordMarkdown';
import { useUserProfile } from '../../hooks/useUserProfile';
import { ChatFileCard } from './ChatFileCard';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';
import { useToast } from '../../hooks/useToast';

/**
 * Discord-style Pinned Messages Drawer for Convia.
 * Slides in from the right edge, shows all pinned messages in the active channel,
 * provides jump-to-message smooth navigation, and unpinning capability.
 */
export function ChatPinnedMessagesDrawer({
  isOpen,
  onClose,
  workspaceId,
  channelId,
  channelName = 'channel',
  currentUserId,
  isLeader = false,
  members = [],
  messages = [],
  onJumpToMessage,
  onOpenPreview,
  onSelectChannel,
}) {
  const { toast } = useToast();
  const [pinnedList, setPinnedList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unpinningId, setUnpinningId] = useState(null);

  // Subscribe to canonical pinned messages
  useEffect(() => {
    if (!isOpen || !workspaceId || !channelId) return;

    setLoading(true);
    const unsubscribe = chatService.subscribeToPinnedMessages(
      workspaceId,
      channelId,
      (pinnedMap) => {
        if (!pinnedMap || typeof pinnedMap !== 'object') {
          setPinnedList([]);
        } else {
          // Sort newest pinned first
          const items = Object.values(pinnedMap).sort(
            (a, b) => Number(b.pinnedAt || 0) - Number(a.pinnedAt || 0)
          );
          setPinnedList(items);
        }
        setLoading(false);
      }
    );

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [isOpen, workspaceId, channelId]);

  if (!isOpen) return null;

  const handleUnpin = async (messageId) => {
    try {
      setUnpinningId(messageId);
      await chatService.unpinMessage(workspaceId, channelId, messageId);
      toast.success('Message unpinned.');
    } catch (err) {
      console.error('[ChatPinnedMessagesDrawer] Failed to unpin message:', err);
      toast.error('Failed to unpin message.');
    } finally {
      setUnpinningId(null);
    }
  };

  const handleJump = (messageId) => {
    if (typeof onJumpToMessage === 'function') {
      onJumpToMessage(messageId);
    } else {
      const el = document.getElementById(`msg_${messageId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  return (
    <aside
      className="fixed inset-y-0 right-0 z-40 w-80 sm:w-96 bg-white border-l border-slate-200/90 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
      aria-label="Pinned Messages"
    >
      {/* Drawer Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50/70">
        <div className="flex items-center gap-2">
          <Pin className="h-4 w-4 text-amber-500 fill-amber-500" />
          <h2 className="text-sm font-bold text-slate-800">Pinned Messages</h2>
          <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-600">
            {pinnedList.length}/3
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          title="Close drawer"
          aria-label="Close drawer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Subheader info */}
      <div className="px-4 py-2 bg-slate-50/40 border-b border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
        <span>Channel: #{channelName}</span>
        <span>Jump to view in context</span>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
            <span className="text-xs">Loading pinned messages...</span>
          </div>
        ) : pinnedList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-4 text-slate-400">
            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <Pin className="h-6 w-6 text-slate-400 rotate-45" />
            </div>
            <p className="text-sm font-semibold text-slate-700">No pinned messages yet</p>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Pin important announcements, links, or documents so anyone can easily find them later.
            </p>
          </div>
        ) : (
          pinnedList.map((item) => (
            <ChatPinnedMessageItem
              key={item.messageId}
              item={item}
              currentUserId={currentUserId}
              members={members}
              messages={messages}
              isLeader={isLeader}
              isUnpinning={unpinningId === item.messageId}
              onJump={handleJump}
              onUnpin={handleUnpin}
              onOpenPreview={onOpenPreview}
              onSelectChannel={onSelectChannel}
            />
          ))
        )}
      </div>
    </aside>
  );
}

function ChatPinnedMessageItem({
  item,
  currentUserId,
  members,
  messages = [],
  isLeader,
  isUnpinning,
  onJump,
  onUnpin,
  onOpenPreview,
  onSelectChannel,
}) {
  const matchedMsg = messages.find(
    (m) => m && (m.messageId === item.messageId || m.id === item.messageId)
  );
  const attachment = item.attachment || matchedMsg?.attachment || null;
  const content = item.content || matchedMsg?.content || '';

  const senderMember = members.find((m) => m && m.uid === item.senderId);
  const { displayName: liveDisplayName, avatar: liveAvatar } = useUserProfile(item.senderId, {
    subscribe: true,
    fallbackName: senderMember ? resolveMemberDisplayName(senderMember) : (item.senderName || 'Member'),
    fallbackAvatar: senderMember?.avatar || senderMember?.photoURL || item.senderAvatar || '',
  });

  const isOwn = Boolean(currentUserId && item.senderId === currentUserId);
  const displayName = isOwn ? 'You' : (liveDisplayName || resolveMemberDisplayName(senderMember || item.senderName || 'Member'));
  const avatar = liveAvatar || senderMember?.avatar || senderMember?.photoURL || item.senderAvatar || '';

  return (
    <div
      key={item.messageId}
      className="group relative rounded-xl border border-slate-200/90 bg-white p-3 shadow-xs hover:border-primary-300 hover:shadow-sm transition-all"
    >
      {/* Author Info & Pin Timestamp */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {avatar ? (
            <img
              src={avatar}
              alt={displayName}
              className="h-7 w-7 rounded-full object-cover border border-slate-200 shrink-0"
            />
          ) : (
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
              {(displayName || 'M').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-800 truncate">{displayName}</p>
            <p className="text-[10px] text-slate-400 font-mono" title={formatFullDateTime(item.createdAt || matchedMsg?.createdAt)}>
              {formatMessageTime(item.createdAt || matchedMsg?.createdAt)}
            </p>
          </div>
        </div>

        {/* Jump Action */}
        <button
          type="button"
          onClick={() => onJump(item.messageId)}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-600 hover:text-primary-800 bg-primary-50 hover:bg-primary-100 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
          title="Jump to message in chat"
        >
          <span>Jump</span>
          <ExternalLink className="h-3 w-3" />
        </button>
      </div>

      {/* Message Content */}
      {content && (
        <div className="text-xs text-slate-800 leading-relaxed max-h-36 overflow-y-auto mb-2 select-text">
          {renderDiscordMarkdown(content, {
            members,
            currentUserId,
            onSelectChannel,
          })}
        </div>
      )}

      {/* Attachment / Voice Note */}
      {attachment ? (
        <div className="mb-2 w-full overflow-hidden">
          {attachment.isVoiceNote ||
          attachment.category === 'audio' ||
          attachment.mimeType?.startsWith('audio/') ? (
            <VoiceMessagePlayer
              audioUrl={attachment.url}
              duration={attachment.duration}
              waveform={attachment.waveform}
              isOwnMessage={isOwn}
            />
          ) : (
            <ChatFileCard attachment={attachment} onOpenPreview={onOpenPreview} />
          )}
        </div>
      ) : !content ? (
        <div className="mb-2 flex items-center gap-1.5 py-1.5 px-2 rounded-lg bg-slate-50 border border-slate-200/60 text-xs text-slate-500 italic">
          <Mic className="h-3.5 w-3.5 text-primary-600 shrink-0" />
          <span>Voice note</span>
        </div>
      ) : null}

      {/* Footer: Pinned by & Unpin button */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px] text-slate-400">
        <span className="truncate">
          Pinned {item.pinnedAt ? formatMessageTime(item.pinnedAt) : ''}
        </span>

        {isLeader && (
          <button
            type="button"
            disabled={isUnpinning}
            onClick={() => onUnpin(item.messageId)}
            className="inline-flex items-center gap-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-1.5 py-0.5 rounded transition-colors cursor-pointer disabled:opacity-50"
            title="Unpin message"
          >
            {isUnpinning ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <PinOff className="h-3 w-3" />
            )}
            <span>Unpin</span>
          </button>
        )}
      </div>
    </div>
  );
}

ChatPinnedMessagesDrawer.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  workspaceId: PropTypes.string.isRequired,
  channelId: PropTypes.string.isRequired,
  channelName: PropTypes.string,
  currentUserId: PropTypes.string,
  isLeader: PropTypes.bool,
  members: PropTypes.array,
  onJumpToMessage: PropTypes.func,
  onOpenPreview: PropTypes.func,
  onSelectChannel: PropTypes.func,
};
