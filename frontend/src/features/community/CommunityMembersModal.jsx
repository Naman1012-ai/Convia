import React, { useState, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  X,
  Search,
  Users,
  MessageCircle,
  Sparkles,
  Award,
  Calendar,
} from 'lucide-react';
import { Avatar } from '../../components/ui/Avatar';
import { Input } from '../../components/ui/Input';
import { useUserProfiles } from '../../hooks/useUserProfile';
import { formatMessageTime } from '../../utils/chatFeedHelpers';

export function CommunityMembersModal({
  isOpen = false,
  onClose = () => {},
  messages = [],
}) {
  const [searchQuery, setSearchQuery] = useState('');

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Aggregate genuine community contributors strictly from real RTDB messages
  const aggregatedMembers = useMemo(() => {
    if (!Array.isArray(messages)) return [];

    const statsByUid = {};

    messages.forEach((msg) => {
      if (!msg || msg.deleted || !msg.senderId || msg.senderId === 'system') return;
      const uid = msg.senderId;
      if (!statsByUid[uid]) {
        statsByUid[uid] = {
          uid,
          fallbackName: msg.senderName || 'Community Member',
          fallbackAvatar: msg.senderAvatar || '',
          discussionsCount: 0,
          latestPostAt: msg.createdAt || 0,
        };
      }
      statsByUid[uid].discussionsCount += 1;
      if ((msg.createdAt || 0) > statsByUid[uid].latestPostAt) {
        statsByUid[uid].latestPostAt = msg.createdAt;
      }
    });

    return Object.values(statsByUid);
  }, [messages]);

  const uniqueUids = useMemo(
    () => aggregatedMembers.map((m) => m.uid),
    [aggregatedMembers]
  );

  const { resolveName, resolveAvatar } = useUserProfiles(uniqueUids);

  // Resolved list sorted by discussion count descending
  const resolvedMembers = useMemo(() => {
    return aggregatedMembers
      .map((member) => ({
        ...member,
        displayName: resolveName(member.uid, member.fallbackName),
        avatar: resolveAvatar(member.uid, member.fallbackAvatar),
      }))
      .sort((a, b) => b.discussionsCount - a.discussionsCount);
  }, [aggregatedMembers, resolveName, resolveAvatar]);

  // Filtered by search query
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return resolvedMembers;
    const q = searchQuery.toLowerCase().trim();
    return resolvedMembers.filter((m) =>
      m.displayName.toLowerCase().includes(q)
    );
  }, [resolvedMembers, searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="community-members-title"
    >
      <div
        className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-100/80 text-emerald-700">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="community-members-title"
                className="text-base font-bold text-slate-900"
              >
                Community Members
              </h2>
              <p className="text-xs text-slate-500">
                {resolvedMembers.length}{' '}
                {resolvedMembers.length === 1 ? 'contributor' : 'contributors'} participating in public discussions
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-slate-100 bg-white">
          <div className="relative">
            <Input
              placeholder="Search community members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 text-xs bg-slate-50/70 border-slate-200"
              autoFocus
            />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Member List */}
        <div className="p-4 overflow-y-auto flex-1 divide-y divide-slate-100">
          {filteredMembers.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <Users className="h-8 w-8 text-slate-300 mx-auto" />
              <p className="text-xs font-semibold text-slate-600">
                {searchQuery ? 'No matching members found' : 'No community contributors yet'}
              </p>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                {searchQuery
                  ? 'Try searching with a different name.'
                  : 'Start a discussion or reply to become the first contributor!'}
              </p>
            </div>
          ) : (
            filteredMembers.map((member, index) => {
              const isTopContributor = index === 0 && member.discussionsCount >= 3;

              return (
                <div
                  key={member.uid}
                  className="flex items-center justify-between py-3 px-2 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      src={member.avatar}
                      name={member.displayName}
                      size="sm"
                      className="shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {member.displayName}
                        </span>
                        {isTopContributor && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[9px] font-bold">
                            <Award className="h-2.5 w-2.5 text-amber-600" />
                            Top
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        Active {formatMessageTime(member.latestPostAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                      <MessageCircle className="h-3 w-3 text-slate-400" />
                      <span>{member.discussionsCount}</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {member.discussionsCount === 1 ? 'post' : 'posts'}
                      </span>
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
          <span>Public collaborative network</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 shadow-2xs transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

CommunityMembersModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  messages: PropTypes.array,
};
