import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Users, Crown, Shield, UserCheck, Search, Circle } from 'lucide-react';
import { resolveMemberDisplayName } from '../../utils/memberIdentity';
import { ChatUserProfilePopover } from './ChatUserProfilePopover';

/**
 * Discord-style Role Hierarchy Member Roster for Convia.
 * Partitions workspace members into Owners/Leaders, Admins, Online, and Offline,
 * with presence indicators and interactive profile popovers.
 */
export function ChatMemberList({ members = [], currentUserId, onMentionUser }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const name = resolveMemberDisplayName(m);
      const username = m.username || '';
      return (
        name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        username.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [members, searchTerm]);

  // Partition members into Discord Role Hierarchy
  const { leaders, admins, onlineMembers, offlineMembers } = useMemo(() => {
    const l = [];
    const a = [];
    const on = [];
    const off = [];

    filteredMembers.forEach((m) => {
      const isOnline = m.uid === currentUserId || m.onlineStatus === 'online';
      const isLeader = m.role === 'leader' || m.isLeader || m.role === 'owner';
      const isAdmin = m.role === 'admin' || m.isAdmin;

      if (!isOnline) {
        off.push(m);
      } else if (isLeader) {
        l.push(m);
      } else if (isAdmin) {
        a.push(m);
      } else {
        on.push(m);
      }
    });

    return {
      leaders: l,
      admins: a,
      onlineMembers: on,
      offlineMembers: off,
    };
  }, [filteredMembers, currentUserId]);

  const renderMemberRow = (member, isOnline) => {
    const isMe = member.uid === currentUserId;
    const isLeader = member.role === 'leader' || member.isLeader || member.role === 'owner';
    const isAdmin = member.role === 'admin' || member.isAdmin;
    const name = resolveMemberDisplayName(member);
    const avatar = member.avatar || member.photoURL || '';
    const hasUsername = member.username && member.username !== name;

    return (
      <div
        key={member.uid || member.id}
        onClick={() => setSelectedMember(member)}
        className={`flex items-center justify-between p-2 rounded-xl transition-colors cursor-pointer select-none ${
          isOnline ? 'hover:bg-slate-100/80' : 'opacity-70 hover:opacity-100 hover:bg-slate-50'
        }`}
        title={`Click to view ${name}'s profile`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Avatar with Presence Indicator Dot */}
          <div className="relative shrink-0">
            {avatar ? (
              <img
                src={avatar}
                alt={name}
                className="h-8 w-8 rounded-full object-cover border border-slate-200"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                {name.charAt(0).toUpperCase()}
              </div>
            )}
            <span
              className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white ${
                isOnline ? 'bg-emerald-500 shadow-2xs' : 'bg-slate-400'
              }`}
              title={isOnline ? 'Online' : 'Offline'}
            />
          </div>

          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-900 truncate flex items-center gap-1">
              <span>{name}</span>
              {isMe && <span className="text-[10px] text-slate-400 font-normal">(You)</span>}
            </p>
            {hasUsername ? (
              <p className="text-[10px] text-slate-400 font-mono truncate">
                @{member.username}
              </p>
            ) : (
              <p className="text-[10px] text-slate-500 font-mono capitalize">
                {isLeader ? 'Owner' : isAdmin ? 'Admin' : member.role || 'Member'}
              </p>
            )}
          </div>
        </div>

        {/* Role Icon */}
        {isLeader ? (
          <Crown className="h-4 w-4 text-amber-500 shrink-0" title="Workspace Owner" />
        ) : isAdmin ? (
          <Shield className="h-3.5 w-3.5 text-purple-500 shrink-0" title="Workspace Admin" />
        ) : (
          <UserCheck className="h-3.5 w-3.5 text-slate-300 shrink-0" />
        )}
      </div>
    );
  };

  return (
    <div className="w-64 h-full border-l border-slate-200 bg-white flex flex-col shrink-0 font-sans">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary-600" />
            <h3 className="text-xs font-mono font-bold text-slate-900 uppercase tracking-wider">
              Workspace Team ({members.length})
            </h3>
          </div>
        </div>

        {/* Quick Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search members..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Member Roster List partitioned by role hierarchy and presence */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Leaders Section */}
        {leaders.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-700 uppercase tracking-wider">
              <Crown className="h-3 w-3 text-amber-500" />
              <span>Leaders — {leaders.length}</span>
            </div>
            {leaders.map((member) => renderMemberRow(member, true))}
          </div>
        )}

        {/* Admins Section */}
        {admins.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono font-bold text-purple-700 uppercase tracking-wider">
              <Shield className="h-3 w-3 text-purple-500" />
              <span>Admins — {admins.length}</span>
            </div>
            {admins.map((member) => renderMemberRow(member, true))}
          </div>
        )}

        {/* Online Members Section */}
        {onlineMembers.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-700 uppercase tracking-wider">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>Online — {onlineMembers.length}</span>
            </div>
            {onlineMembers.map((member) => renderMemberRow(member, true))}
          </div>
        )}

        {/* Offline Section */}
        {offlineMembers.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
              <span className="h-2 w-2 rounded-full bg-slate-300" />
              <span>Offline — {offlineMembers.length}</span>
            </div>
            {offlineMembers.map((member) => renderMemberRow(member, false))}
          </div>
        )}

        {filteredMembers.length === 0 && (
          <p className="text-center py-6 text-xs text-slate-400 italic">No members found.</p>
        )}
      </div>

      {/* User Profile Popover Modal */}
      <ChatUserProfilePopover
        member={selectedMember}
        isOpen={Boolean(selectedMember)}
        onClose={() => setSelectedMember(null)}
        onMentionUser={onMentionUser}
        currentUserId={currentUserId}
      />
    </div>
  );
}

ChatMemberList.propTypes = {
  members: PropTypes.array,
  currentUserId: PropTypes.string,
  onMentionUser: PropTypes.func,
};
