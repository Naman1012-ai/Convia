import React, { useState, useEffect, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import { X, Smile, User } from 'lucide-react';
import { resolveReactionParticipant } from '../../utils/chatFeedHelpers';
import { useUserProfiles } from '../../hooks/useUserProfile';

/**
 * WhatsApp-Style Reaction Participant Inspector Modal / Popover.
 * Allows members to inspect exactly who reacted with each emoji in real-time.
 */
export function ChatReactionParticipantsModal({
  isOpen = false,
  onClose = () => {},
  reactions = {},
  members = [],
  currentUserId = null,
  initialEmoji = 'all',
  onToggleReaction = () => {},
}) {
  const [selectedTab, setSelectedTab] = useState(initialEmoji || 'all');
  const modalRef = useRef(null);

  // Sync selected tab with initialEmoji when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedTab(initialEmoji || 'all');
    }
  }, [isOpen, initialEmoji]);

  // Keyboard accessibility: Escape key dismisses modal
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

  // Extract all distinct emoji tabs and calculate total reaction count
  const { emojiTabs, totalCount, allParticipants } = useMemo(() => {
    const tabs = [];
    let total = 0;
    const participantsList = [];

    Object.entries(reactions || {}).forEach(([emoji, reactionData]) => {
      const uids = reactionData?.users || (reactionData === true ? [] : Object.keys(reactionData || {}));
      if (uids.length > 0) {
        tabs.push({
          emoji,
          count: uids.length,
          users: uids,
        });
        total += uids.length;

        uids.forEach((uid) => {
          participantsList.push({
            uid,
            emoji,
          });
        });
      }
    });

    return {
      emojiTabs: tabs,
      totalCount: total,
      allParticipants: participantsList,
    };
  }, [reactions]);

  // Filter participants by active tab
  const activeParticipants = useMemo(() => {
    if (selectedTab === 'all') {
      return allParticipants;
    }
    return allParticipants.filter((p) => p.emoji === selectedTab);
  }, [selectedTab, allParticipants]);

  const participantUids = useMemo(() => {
    return Array.from(new Set(allParticipants.map((p) => p.uid).filter(Boolean)));
  }, [allParticipants]);

  const { resolveName, resolveAvatar } = useUserProfiles(participantUids);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reaction-modal-title"
    >
      <div
        ref={modalRef}
        className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <Smile className="h-4 w-4 text-indigo-600" />
            <h3 id="reaction-modal-title" className="text-sm font-bold text-slate-800">
              Reactions ({totalCount})
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Close reactions view"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Emoji Filter Tabs */}
        {emojiTabs.length > 0 && (
          <div className="px-3 pt-2 pb-1 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedTab('all')}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 transition-all ${
                selectedTab === 'all'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              All {totalCount}
            </button>

            {emojiTabs.map((tab) => (
              <button
                key={tab.emoji}
                type="button"
                onClick={() => setSelectedTab(tab.emoji)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 transition-all ${
                  selectedTab === tab.emoji
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                <span>{tab.emoji}</span>
                <span>{tab.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Participant List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-slate-50">
          {activeParticipants.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No reactions found.
            </div>
          ) : (
            activeParticipants.map((item, idx) => {
              const rawParticipant = resolveReactionParticipant(item.uid, members, currentUserId);
              const liveName = resolveName(item.uid, rawParticipant.name);
              const liveAvatar = resolveAvatar(item.uid, rawParticipant.avatar);
              const participant = {
                ...rawParticipant,
                name: liveName,
                avatar: liveAvatar,
              };
              const isSelf = participant.isCurrentUser;

              return (
                <div
                  key={`${item.uid}_${item.emoji}_${idx}`}
                  className="pt-1.5 first:pt-0 flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-slate-50/80 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Avatar / Initials */}
                    {participant.avatar ? (
                      <img
                        src={participant.avatar}
                        alt={participant.name}
                        className="h-7 w-7 rounded-full object-cover border border-slate-200 shrink-0"
                      />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center text-xs font-bold shrink-0">
                        {participant.name.charAt(0).toUpperCase() || <User className="h-3.5 w-3.5" />}
                      </div>
                    )}

                    {/* Name & Role */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-xs truncate ${
                            isSelf ? 'font-bold text-indigo-700' : 'font-medium text-slate-800'
                          }`}
                        >
                          {participant.name}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 capitalize">
                        {participant.role || 'Member'}
                      </span>
                    </div>
                  </div>

                  {/* Emoji Badge & Action */}
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-base select-none" title={`Reacted with ${item.emoji}`}>
                      {item.emoji}
                    </span>

                    {/* Quick remove button if self */}
                    {isSelf && (
                      <button
                        type="button"
                        onClick={() => {
                          onToggleReaction(item.emoji);
                          onClose();
                        }}
                        className="text-[10px] text-slate-400 hover:text-rose-600 px-1 py-0.5 rounded hover:bg-rose-50 transition-colors"
                        title="Remove your reaction"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50 text-right">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

ChatReactionParticipantsModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  reactions: PropTypes.object,
  members: PropTypes.array,
  currentUserId: PropTypes.string,
  initialEmoji: PropTypes.string,
  onToggleReaction: PropTypes.func,
};
