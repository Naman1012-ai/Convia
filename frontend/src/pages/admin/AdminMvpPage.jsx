import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { adminService } from '../../services/adminService';
import { NotificationService } from '../../services/notificationService';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { formatTimestamp } from '../../utils/formatting';
import { Trophy, Layers, CheckSquare, Briefcase, Eye, CheckCircle2, AlertCircle } from 'lucide-react';

export default function AdminMvpPage() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  const [mvps, setMvps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = adminService.subscribeToAllMvps((list) => {
      setMvps(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleStatusChange = async (mvp, newStatus) => {
    setUpdatingId(mvp.ideaId);
    try {
      await adminService.updateAdminIdeaStatus(
        currentUser.uid,
        currentUser.displayName || currentUser.email,
        mvp.ideaId,
        mvp.orgId,
        newStatus
      );
      NotificationService.success(`Status for "${mvp.title}" updated to "${newStatus}".`);
    } catch (err) {
      NotificationService.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 w-full">
        <LoadingSkeleton variant="card" count={3} />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <Trophy className="h-6 w-6 text-amber-400" /> Dedicated Workspace MVP & Blueprint Oversight
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Monitor active selected workspace MVPs, technical blueprint specifications, and sprint execution status.
          </p>
        </div>

        <Badge variant="default" className="bg-amber-950 text-amber-300 border border-amber-800 font-mono text-xs self-start sm:self-auto">
          {mvps.length} Active Selected MVPs
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {mvps.length === 0 ? (
          <Card className="col-span-full p-12 text-center bg-slate-900 border border-slate-800 space-y-2">
            <Trophy className="h-10 w-10 text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-slate-300">No Active Selected MVPs</h3>
            <p className="text-xs text-slate-500">Currently no workspaces have promoted a proposal to active Selected MVP status.</p>
          </Card>
        ) : (
          mvps.map((mvp) => (
            <Card key={mvp.ideaId} className="p-6 bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-extrabold flex items-center gap-1">
                    <Briefcase className="h-3 w-3" /> {mvp.workspaceName}
                  </span>
                  <h3 className="text-base font-extrabold text-white">{mvp.title}</h3>
                </div>

                <select
                  value={mvp.projectStatus || 'Selected MVP'}
                  disabled={updatingId === mvp.ideaId}
                  onChange={(e) => handleStatusChange(mvp, e.target.value)}
                  className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-bold rounded-lg px-3 py-1.5 focus:outline-none cursor-pointer"
                >
                  <option value="Selected MVP">Selected MVP</option>
                  <option value="Project">Project Phase</option>
                  <option value="Completed">Completed</option>
                  <option value="Archived">Archived</option>
                </select>
              </div>

              <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-850 font-medium">
                {mvp.problemStatement || mvp.description}
              </p>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-slate-400 font-medium">Authored by <strong className="text-slate-200">{mvp.authorName}</strong></span>
                <span className="font-mono text-amber-300 font-bold">👍 {mvp.voteCount || 0} Votes</span>
              </div>

              <div className="pt-2 border-t border-slate-850 flex items-center justify-between">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Eye className="h-3.5 w-3.5 text-purple-400" />}
                  onClick={() => navigate(`/admin/ideas/${mvp.ideaId}`)}
                  className="bg-slate-800 text-xs text-white font-bold"
                >
                  Inspect Idea
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Briefcase className="h-3.5 w-3.5 text-purple-400" />}
                  onClick={() => navigate(`/admin/workspaces/${mvp.orgId}`)}
                  className="bg-slate-800 text-xs text-white font-bold"
                >
                  Open Workspace
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
