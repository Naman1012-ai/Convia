import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { formatTimestamp } from '../../utils/formatting';
import { Users, Calendar, Lightbulb, User } from 'lucide-react';
import { getProjectTypeLabel } from '../../constants/workspaceConstants';

export function OrgCard({ org, currentUid, onJoinClick = null }) {
  const navigate = useNavigate();
  const [isOpening, setIsOpening] = useState(false);
  const [loadingText, setLoadingText] = useState('');

  const isOwner = org.ownerId === currentUid;
  const isMember = org.isMember;
  const isProjectPhase = org.status === 'project';

  const handleEnterIdeaBoard = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setIsOpening(true);
    setLoadingText('Opening your workspace...');
    
    // Safety timer to clear loading if transition is cancelled
    setTimeout(() => {
      setIsOpening(false);
      setLoadingText('');
    }, 3000);

    navigate(`/workspaces/${org.orgId}/ideas`);
  };

  // Resolve role badge variant & label
  let roleLabel = 'Visitor';
  let roleVariant = 'default';

  if (isOwner) {
    roleLabel = 'Leader';
    roleVariant = 'info';
  } else if (org.userRole === 'admin') {
    roleLabel = 'Admin';
    roleVariant = 'primary';
  } else if (org.userRole === 'member') {
    roleLabel = 'Member';
    roleVariant = 'success';
  }

  return (
    <Card hover className="h-full flex flex-col justify-between p-6 bg-white border border-slate-200 shadow-sm rounded-2xl relative overflow-hidden transition-all duration-300 hover:shadow-md hover:border-slate-300/80">
      <div className="space-y-4">
        {/* Header Title & Role */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <h3 className="text-lg font-black text-slate-900 tracking-tight leading-tight truncate" title={org.name}>
              {org.name}
            </h3>
            <p className="text-xs font-bold text-slate-400 truncate">
              {org.projectType ? getProjectTypeLabel(org.projectType) : (org.hackathonName || 'General Project')}
            </p>
          </div>
          <Badge variant={roleVariant} className="shrink-0 font-extrabold uppercase text-[10px] tracking-wider">
            {roleLabel}
          </Badge>
        </div>

        {/* Phase stage indicator */}
        <div className="flex items-center justify-between py-1.5 px-3 bg-slate-50 border border-slate-100 rounded-xl">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Workspace Phase</span>
          <Badge variant={isProjectPhase ? 'success' : 'warning'} className="font-extrabold uppercase text-[9px] tracking-widest shrink-0">
            {isProjectPhase ? 'Project / Sprint' : 'Ideation / Voting'}
          </Badge>
        </div>

        {/* Team stats and details */}
        <div className="grid grid-cols-2 gap-3 py-1 text-slate-500 text-xs font-semibold">
          <div className="flex items-center gap-1.5">
            <Users className="h-4 w-4 text-slate-400 shrink-0" />
            <span>{typeof org.memberCount === 'number' ? org.memberCount : 1} / {org.maxMembers || org.teamSizeLimit || 5} members</span>
          </div>
          <div className="flex items-center gap-1.5 justify-end">
            <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span>{formatTimestamp(org.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Primary Action Button Section */}
      <div className="pt-6 border-t border-slate-100 mt-6">
        {isMember ? (
          <Button
            variant="primary"
            fullWidth
            icon={<Lightbulb className="h-4 w-4" />}
            onClick={handleEnterIdeaBoard}
            isLoading={isOpening}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] w-full"
          >
            {isOpening ? loadingText : '🚀 Enter Idea Board'}
          </Button>
        ) : (
          <Button
            variant="secondary"
            fullWidth
            icon={<User className="h-4 w-4" />}
            onClick={onJoinClick}
            className="border-slate-200 text-slate-700 bg-white hover:bg-slate-50 font-bold py-2.5 rounded-xl shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] w-full"
          >
            Join Workspace
          </Button>
        )}
      </div>
    </Card>
  );
}

OrgCard.propTypes = {
  org: PropTypes.shape({
    orgId: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    projectType: PropTypes.string,
    description: PropTypes.string,
    hackathonName: PropTypes.string,
    status: PropTypes.string,
    ownerId: PropTypes.string.isRequired,
    memberCount: PropTypes.number,
    maxMembers: PropTypes.number,
    teamSizeLimit: PropTypes.number,
    createdAt: PropTypes.number,
    isMember: PropTypes.bool,
    userRole: PropTypes.string,
  }).isRequired,
  currentUid: PropTypes.string.isRequired,
  onJoinClick: PropTypes.func,
};
