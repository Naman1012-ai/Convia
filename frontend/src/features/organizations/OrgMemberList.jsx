import React from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../../hooks/useAuth';
import { useOrg } from '../../hooks/useOrg';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { getWorkspaceMemberHistory } from '../../utils/workspaceMemberHistory';

export function OrgMemberList({ onToast = () => {} }) {
  const { user } = useAuth();
  const { org, members } = useOrg();

  return (
    <div className="space-y-4">
      {/* Read-Only Members Roster List */}
      <div className="divide-y divide-slate-100">
        {members.map((member) => {
          const memberUid = member.uid || member.id;
          const history = getWorkspaceMemberHistory(member, org);
          const isSelf = memberUid === user?.uid;
          const isOnline = member.onlineStatus === 'online';

          return (
            <div key={memberUid} className="flex items-center justify-between py-3.5 gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar name={member.displayName || member.name} size="md" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900 truncate">
                      {member.displayName || member.name} {isSelf && '(You)'}
                    </span>
                    <span
                      title={isOnline ? 'Online' : 'Offline'}
                      className={`h-2 w-2 rounded-full shrink-0 ${
                        isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    />
                  </div>
                  <p className="text-xs text-slate-500 truncate">{member.email}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {history.dateText}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                {/* Authoritative Role Badges (Owner, Captain, Member + Original Creator if applicable) */}
                {history.badges.map((b, idx) => (
                  <Badge key={idx} variant={b.variant} className="font-bold flex items-center gap-1">
                    {b.label}
                  </Badge>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

OrgMemberList.propTypes = {
  onToast: PropTypes.func,
};
