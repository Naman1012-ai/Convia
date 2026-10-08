import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { ideaService } from '../../services/ideaService';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import {
  FolderPlus,
  ArrowRight,
  ShieldCheck,
  Users,
  Trophy,
  Plus,
  LogIn,
  AlertTriangle,
} from 'lucide-react';

export function ImportToWorkspaceModal({
  isOpen,
  idea,
  workspaces = [],
  onClose,
  onToast = () => {},
  onCreateWorkspaceClick = null,
  onJoinWorkspaceClick = null,
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [importingWorkspaceId, setImportingWorkspaceId] = useState(null);

  if (!idea) return null;

  const handleImport = async (workspace) => {
    if (!user || !idea || importingWorkspaceId) return;

    setImportingWorkspaceId(workspace.orgId);

    try {
      await ideaService.importPublicIdeaToWorkspace(workspace.orgId, user, idea.ideaId);

      const successMsg = `Successfully imported "${idea.title}" into ${workspace.name}!`;
      onToast(successMsg);

      toast.success(
        <div className="flex items-center justify-between gap-3 w-full">
          <span>{successMsg}</span>
          <button
            onClick={() => navigate(`/workspaces/${workspace.orgId}/ideas`)}
            className="font-bold underline text-xs text-primary-700 hover:text-primary-900 shrink-0"
          >
            Go to Workspace →
          </button>
        </div>
      );

      onClose();
    } catch (err) {
      console.error('[ImportToWorkspaceModal] Error:', err);
      const errorMsg = err.message || 'Unable to import idea. Please try again.';
      onToast(errorMsg);
      toast.error(errorMsg);
    } finally {
      setImportingWorkspaceId(null);
    }
  };

  const isSingleWorkspace = workspaces.length === 1;
  const isZeroWorkspaces = workspaces.length === 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import Public Idea into Workspace" size="md">
      <div className="space-y-6">
        {/* Source Idea Summary Card */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="info">{idea.category || 'Public Proposal'}</Badge>
            <span className="text-xs text-slate-400 font-medium">Original by {idea.authorName}</span>
          </div>
          <h4 className="font-extrabold text-slate-900 text-base">{idea.title}</h4>
          <p className="text-xs text-slate-600 line-clamp-2">{idea.problemStatement}</p>
        </div>

        {/* Case 1: Zero Workspaces */}
        {isZeroWorkspaces && (
          <div className="text-center py-6 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-300 space-y-4">
            <div className="flex justify-center text-slate-400">
              <Users className="h-10 w-10 text-indigo-500" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">You are not a member of any workspace.</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Create a new private team workspace or join an existing workspace to start importing public ideas.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  onClose();
                  if (onJoinWorkspaceClick) onJoinWorkspaceClick();
                  else navigate('/workspaces');
                }}
                icon={<LogIn className="h-3.5 w-3.5" />}
              >
                Join Workspace
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  onClose();
                  if (onCreateWorkspaceClick) onCreateWorkspaceClick();
                  else navigate('/workspaces');
                }}
                icon={<Plus className="h-3.5 w-3.5" />}
              >
                Create Workspace
              </Button>
            </div>
          </div>
        )}

        {/* Case 2: Single Workspace (Direct Confirmation Screen) */}
        {isSingleWorkspace && (
          <div className="space-y-4 bg-primary-50/50 p-4 rounded-xl border border-primary-200/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-primary-900 uppercase tracking-wider">
                Destination Workspace
              </span>
              <Badge variant="info">1 Active Membership</Badge>
            </div>

            <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-2">
              <h5 className="font-bold text-slate-900 text-base">{workspaces[0].name}</h5>
              <p className="text-xs text-slate-500">{workspaces[0].hackathonName || 'Team Workspace'}</p>
              <div className="flex items-center gap-4 pt-1 text-xs text-slate-600">
                <span className="flex items-center gap-1 font-medium">
                  <Users className="h-3.5 w-3.5 text-primary-500" /> {workspaces[0].memberCount || 1} Members
                </span>
                {workspaces[0].activeMvpTitle && (
                  <span className="flex items-center gap-1 font-medium truncate max-w-[180px]">
                    <Trophy className="h-3.5 w-3.5 text-amber-500" /> MVP: {workspaces[0].activeMvpTitle}
                  </span>
                )}
              </div>
            </div>

            <Button
              variant="primary"
              fullWidth
              isLoading={Boolean(importingWorkspaceId)}
              onClick={() => handleImport(workspaces[0])}
              icon={<FolderPlus className="h-4 w-4" />}
              className="bg-primary-600 hover:bg-primary-700 text-white font-bold shadow-sm shadow-primary-500/20"
            >
              {importingWorkspaceId ? 'Importing...' : `Confirm Import to ${workspaces[0].name}`}
            </Button>
          </div>
        )}

        {/* Case 3: Multiple Workspaces Selection Roster */}
        {!isZeroWorkspaces && !isSingleWorkspace && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                My Workspaces
              </span>
              <span className="text-xs text-slate-400 font-medium">{workspaces.length} Workspaces</span>
            </div>

            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {workspaces.map((ws) => {
                const isImportingThis = importingWorkspaceId === ws.orgId;

                return (
                  <Card
                    key={ws.orgId}
                    className="p-4 flex items-center justify-between gap-4 hover:border-primary-300 transition-colors bg-white border border-slate-200"
                  >
                    <div className="min-w-0 space-y-1">
                      <h5 className="font-bold text-slate-900 text-sm truncate">{ws.name}</h5>
                      <p className="text-xs text-slate-500 truncate">{ws.hackathonName || 'Workspace'}</p>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-0.5">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-slate-400" /> {ws.memberCount || 1} Members
                        </span>
                        {ws.activeMvpTitle && (
                          <span className="flex items-center gap-1 text-amber-600 font-semibold truncate max-w-[140px]">
                            <Trophy className="h-3 w-3 text-amber-500" /> {ws.activeMvpTitle}
                          </span>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="secondary"
                      size="sm"
                      isLoading={isImportingThis}
                      disabled={Boolean(importingWorkspaceId)}
                      onClick={() => handleImport(ws)}
                      icon={<FolderPlus className="h-4 w-4 text-indigo-600" />}
                      className="shrink-0 font-bold border-slate-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100"
                    >
                      {isImportingThis ? 'Importing...' : 'Import'}
                    </Button>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Independent Copy Attribution Notice */}
        {!isZeroWorkspaces && (
          <div className="flex items-start gap-2 text-[11px] text-slate-500 bg-amber-50/60 p-3 rounded-lg border border-amber-200">
            <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Importing creates an independent private copy in your workspace. Original author attribution is preserved, while workspace voting and team discussions start fresh.
            </span>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose} disabled={Boolean(importingWorkspaceId)}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

ImportToWorkspaceModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  idea: PropTypes.object,
  workspaces: PropTypes.array,
  onClose: PropTypes.func.isRequired,
  onToast: PropTypes.func,
  onCreateWorkspaceClick: PropTypes.func,
  onJoinWorkspaceClick: PropTypes.func,
};

