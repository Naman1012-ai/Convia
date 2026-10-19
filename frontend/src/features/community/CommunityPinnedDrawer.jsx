import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Pin, PinOff, X, ExternalLink, Loader2, Sparkles, MessageCircle, Users, Mic } from 'lucide-react';
import { renderDiscordMarkdown } from '../../utils/discordMarkdown';
import { formatFullDateTime, formatMessageTime } from '../../utils/chatFeedHelpers';
import { resolveMemberDisplayName, getMessageAuthorUid } from '../../utils/memberIdentity';
import { useUserProfile } from '../../hooks/useUserProfile';
import { COMMUNITY_POST_TYPES } from '../../constants/chatSchema';
import { ChatFileCard } from '../chat/ChatFileCard';
import { VoiceMessagePlayer } from '../chat/VoiceMessagePlayer';

const POST_TYPE_ICONS = {
  [COMMUNITY_POST_TYPES.IDEA]: Sparkles,
  [COMMUNITY_POST_TYPES.QUESTION]: MessageCircle,
  [COMMUNITY_POST_TYPES.DISCUSSION]: MessageCircle,
  [COMMUNITY_POST_TYPES.COLLABORATION]: Users,
};

/**
 * Discord-style Featured / Pinned Discussions Drawer for Convia Community.
 * Slides in from the right edge, displays all active featured discussions,
 * and allows users to jump directly to any discussion in context or unpin it.
 */
export function CommunityPinnedDrawer({
  isOpen,
  onClose,
  pinnedList = [],
  isAdmin = false,
  currentUserId = null,
  onJumpToDiscussion,
  onUnpinDiscussion,
}) {
  const [unpinningId, setUnpinningId] = useState(null);

  if (!isOpen) return null;

  const handleUnpin = async (messageId) => {
    if (!isAdmin || typeof onUnpinDiscussion !== 'function') return;
    try {
      setUnpinningId(messageId);
      await onUnpinDiscussion(messageId);
    } finally {
      setUnpinningId(null);
    }
  };

  const handleJump = (messageId) => {
    if (typeof onJumpToDiscussion === 'function') {
      onJumpToDiscussion(messageId);
    }
  };

  return (
    <aside
      className="fixed inset-y-0 right-0 z-40 w-80 sm:w-96 bg-white border-l border-slate-200/90 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
      aria-label="Featured Community Discussions"
    >
      {/* Drawer Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-amber-50/60">
        <div className="flex items-center gap-2">
          <Pin className="h-4 w-4 text-amber-600 fill-amber-500 rotate-45" />
          <h2 className="text-sm font-bold text-slate-800">Featured Discussions</h2>
          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
            {pinnedList.length}/5
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
      <div className="px-4 py-2 bg-slate-50/60 border-b border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
        <span>Public Community Channel</span>
        <span>Jump to view in feed</span>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {pinnedList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-4 text-slate-400">
            <div className="h-12 w-12 rounded-full bg-amber-50 border border-amber-200/60 flex items-center justify-center mb-3">
              <Pin className="h-6 w-6 text-amber-500 rotate-45" />
            </div>
            <p className="text-sm font-semibold text-slate-700">No featured discussions yet</p>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Administrators can pin up to 5 high-impact announcements, ideas, or discussions to highlight them for the community.
            </p>
          </div>
        ) : (
          pinnedList.map((item) => (
            <CommunityPinnedItem
              key={item.messageId}
              item={item}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              isUnpinning={unpinningId === item.messageId}
              onJump={handleJump}
              onUnpin={handleUnpin}
            />
          ))
        )}
      </div>
    </aside>
  );
}

function CommunityPinnedItem({ item, currentUserId, isAdmin, isUnpinning, onJump, onUnpin }) {
  const authorUid = getMessageAuthorUid(item);
  const { displayName: liveDisplayName, avatar: liveAvatar } = useUserProfile(authorUid, {
    subscribe: true,
    fallbackName: resolveMemberDisplayName(item.senderName || item.authorName || 'Member'),
    fallbackAvatar: item.senderAvatar || item.avatar || '',
  });

  const isOwn = Boolean(currentUserId && authorUid === currentUserId);
  const displayName = isOwn ? 'You' : (liveDisplayName || resolveMemberDisplayName(item.senderName || item.authorName || 'Member'));
  const avatar = liveAvatar || item.senderAvatar || item.avatar || '';
  const PostIcon = POST_TYPE_ICONS[item.postType] || MessageCircle;

  return (
    <div
      key={item.messageId}
      className="group relative rounded-xl border border-amber-200/80 bg-amber-50/20 p-3 shadow-2xs hover:border-amber-300 hover:shadow-xs transition-all"
    >
      {/* Author Info & Post Type */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {avatar ? (
            <img
              src={avatar}
              alt={displayName}
              className="h-7 w-7 rounded-full object-cover border border-slate-200 shrink-0"
            />
          ) : (
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
              {(displayName || 'M').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-xs font-bold text-slate-800 truncate">{displayName}</p>
              {item.postType && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                  <PostIcon className="h-2.5 w-2.5 text-slate-500" />
                  <span>{item.postType}</span>
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 font-mono" title={formatFullDateTime(item.createdAt || item.pinnedAt)}>
              {formatMessageTime(item.createdAt || item.pinnedAt)}
            </p>
          </div>
        </div>

        {/* Jump Action */}
        <button
          type="button"
          onClick={() => onJump(item.messageId)}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
          title="Jump to discussion in feed"
        >
          <span>Jump</span>
          <ExternalLink className="h-3 w-3" />
        </button>
      </div>

      {/* Message Content Preview */}
      <div className="text-xs text-slate-800 leading-relaxed max-h-32 overflow-y-auto mb-2 select-text bg-white/80 p-2 rounded-lg border border-slate-100">
        {item.content ? (
          renderDiscordMarkdown(item.content)
        ) : (
          <span className="italic text-slate-400">No content preview</span>
        )}
      </div>

      {/* Attachment Preview (Voice Note / File) */}
      {item.attachment ? (
        <div className="mb-2 w-full max-w-md overflow-hidden">
          {item.attachment.isVoiceNote ||
          item.attachment.category === 'audio' ||
          item.attachment.mimeType?.startsWith('audio/') ? (
            <VoiceMessagePlayer
              audioUrl={item.attachment.url}
              duration={item.attachment.duration}
              waveform={item.attachment.waveform}
              isOwnMessage={isOwn}
            />
          ) : (
            <ChatFileCard
              attachment={item.attachment}
              onOpenPreview={(att) => att?.url && window.open(att.url, '_blank')}
            />
          )}
        </div>
      ) : !item.content ? (
        <div className="mb-2 flex items-center gap-1.5 py-1.5 px-2 rounded-lg bg-slate-50 border border-slate-200/60 text-xs text-slate-500 italic">
          <Mic className="h-3.5 w-3.5 text-primary-600 shrink-0" />
          <span>Voice note</span>
        </div>
      ) : null}

      {/* Footer: Pinned by & Admin Unpin Action */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-[10px] text-slate-400">
        <span className="truncate">
          Pinned {item.pinnedAt ? formatMessageTime(item.pinnedAt) : ''}
          {item.pinnedByName ? ` by ${item.pinnedByName}` : ''}
        </span>

        {isAdmin && (
          <button
            type="button"
            disabled={isUnpinning}
            onClick={() => onUnpin(item.messageId)}
            className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-1.5 py-0.5 rounded transition-colors cursor-pointer disabled:opacity-50"
            title="Unpin discussion"
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

CommunityPinnedDrawer.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  pinnedList: PropTypes.arrayOf(
    PropTypes.shape({
      messageId: PropTypes.string.isRequired,
      content: PropTypes.string,
      senderId: PropTypes.string,
      senderName: PropTypes.string,
      authorName: PropTypes.string,
      senderAvatar: PropTypes.string,
      postType: PropTypes.string,
      pinnedAt: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      pinnedByName: PropTypes.string,
    })
  ),
  isAdmin: PropTypes.bool,
  currentUserId: PropTypes.string,
  onJumpToDiscussion: PropTypes.func,
  onUnpinDiscussion: PropTypes.func,
};
