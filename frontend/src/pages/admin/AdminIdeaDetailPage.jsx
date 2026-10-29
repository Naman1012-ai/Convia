import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { adminService } from '../../services/adminService';
import { NotificationService } from '../../services/notificationService';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { Select } from '../../components/ui/Select';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { formatTimestamp } from '../../utils/formatting';
import {
  Lightbulb,
  ArrowLeft,
  Star,
  Lock,
  Unlock,
  Trash2,
  CheckCircle2,
  Clock,
  Globe,
  Briefcase,
  Trophy,
  MessageSquare,
  ThumbsUp,
  Share2,
  Download,
  Activity,
  Layers,
  CheckSquare,
} from 'lucide-react';

export default function AdminIdeaDetailPage() {
  const { ideaId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('timeline');

  const [actionLoading, setActionLoading] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (!ideaId) return;
    setLoading(true);

    const unsubscribe = adminService.subscribeToIdeaDetail(ideaId, (detail) => {
      setData(detail);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [ideaId]);

  if (loading || !data || !data.idea) {
    return (
      <div className="space-y-6 w-full">
        <LoadingSkeleton variant="card" count={3} />
      </div>
    );
  }

  const { idea, comments, suggestions, votes, timeline } = data;
  const isPublic = idea.isPublic;

  const handleToggleFeatured = async () => {
    setActionLoading(true);
    try {
      await adminService.toggleIdeaFeatured(
        currentUser.uid,
        currentUser.displayName || currentUser.email,
        ideaId,
        isPublic,
        idea.orgId
      );
      NotificationService.success(`Updated featured status for "${idea.title}"`);
    } catch (err) {
      NotificationService.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportJson = () => {
    const exportData = JSON.stringify(data, null, 2);
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `idea_export_${ideaId}.json`;
    a.click();
    NotificationService.success('Idea exported as JSON.');
  };

  return (
    <div className="space-y-6 w-full pb-16">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <Button
          variant="secondary"
          size="sm"
          icon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => navigate('/admin/ideas')}
          className="bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
        >
          Back to Proposals Directory
        </Button>

        <Badge variant="default" className="bg-purple-950 text-purple-300 border border-purple-800 font-mono text-xs">
          Idea ID: {ideaId}
        </Badge>
      </div>

      {/* Header Profile Card */}
      <Card className="p-6 bg-slate-900 border border-slate-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-black text-white">{idea.title}</h1>
              <span className={`px-3 py-0.5 rounded-full text-xs font-bold ${
                idea.isSelected
                  ? 'bg-amber-950 text-amber-300 border border-amber-700'
                  : 'bg-slate-800 text-slate-300'
              }`}>
                {idea.isSelected ? '🏆 Selected MVP' : (idea.projectStatus || idea.status || 'Ideation')}
              </span>
              <span className={`inline-flex items-center gap-1 text-xs font-mono font-bold ${
                isPublic ? 'text-indigo-400' : 'text-purple-400'
              }`}>
                {isPublic ? <Globe className="h-3.5 w-3.5" /> : <Briefcase className="h-3.5 w-3.5" />}
                {isPublic ? 'Public Explorer' : 'Workspace Proposal'}
              </span>
            </div>

            <p className="text-xs text-slate-300 font-medium leading-relaxed max-w-3xl">
              {idea.description || idea.problemStatement}
            </p>

            <div className="flex items-center gap-3 text-[11px] font-mono text-slate-500 pt-1">
              <span>Authored by <strong className="text-slate-200">{idea.authorName || 'Member'}</strong></span>
              <span>·</span>
              <span>Posted {formatTimestamp(idea.createdAt)}</span>
            </div>
          </div>

          {/* Quick Action Controls */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            <Button
              variant="secondary"
              size="sm"
              icon={<Star className={`h-4 w-4 ${idea.isFeatured ? 'fill-current text-amber-400' : 'text-slate-400'}`} />}
              onClick={handleToggleFeatured}
              isLoading={actionLoading}
              className="bg-slate-800 text-slate-200 border border-slate-700 font-bold text-xs"
            >
              {idea.isFeatured ? 'Featured' : 'Mark Featured'}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              icon={<Download className="h-4 w-4 text-purple-400" />}
              onClick={handleExportJson}
              className="bg-slate-800 text-slate-200 border border-slate-700 font-bold text-xs"
            >
              Export JSON
            </Button>
          </div>
        </div>
      </Card>

      {/* Telemetry Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Total Votes</span>
          <div className="text-2xl font-black text-amber-400">{votes.length || idea.voteCount || 0}</div>
          <span className="text-[11px] text-slate-400 font-medium">Community Endorsements</span>
        </Card>

        <Card className="p-4 bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Comments</span>
          <div className="text-2xl font-black text-indigo-400">{comments.length}</div>
          <span className="text-[11px] text-slate-400 font-medium">Discussion Entries</span>
        </Card>

        <Card className="p-4 bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Suggestions</span>
          <div className="text-2xl font-black text-purple-400">{suggestions.length}</div>
          <span className="text-[11px] text-slate-400 font-medium">Feature Suggestions</span>
        </Card>

        <Card className="p-4 bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">MVP Status</span>
          <div className="text-xl font-black text-white">{idea.isSelected ? 'Active MVP' : 'Proposal'}</div>
          <span className="text-[11px] text-emerald-400 font-medium">{idea.isSelected ? 'Selected' : 'Ideation'}</span>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        {[
          { id: 'timeline', label: 'Lifecycle Timeline', icon: Activity },
          { id: 'comments', label: `Comments (${comments.length})`, icon: MessageSquare },
          { id: 'suggestions', label: `Suggestions (${suggestions.length})`, icon: Lightbulb },
          { id: 'votes', label: `Voting Roster (${votes.length})`, icon: ThumbsUp },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-900/40'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Lifecycle Timeline */}
      {activeTab === 'timeline' && (
        <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Activity className="h-4 w-4 text-purple-400" /> Proposal Lifecycle Stream
          </h3>

          <div className="space-y-3">
            {timeline.map((item) => (
              <div key={item.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-slate-200">{item.title}</p>
                  <span className="text-[11px] text-slate-400">by {item.user}</span>
                </div>
                <span className="font-mono text-slate-400 text-[11px]">{formatTimestamp(item.timestamp)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tab 2: Comments */}
      {activeTab === 'comments' && (
        <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <MessageSquare className="h-4 w-4 text-indigo-400" /> Comments & Discussion Entries
          </h3>

          {comments.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500 italic">No comments posted yet.</div>
          ) : (
            <div className="space-y-3">
              {comments.map((c) => (
                <div key={c.commentId || c.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1 text-xs">
                  <div className="flex items-center justify-between font-mono text-[11px] text-indigo-300">
                    <span>{c.authorName || 'User'}</span>
                    <span>{formatTimestamp(c.createdAt)}</span>
                  </div>
                  <p className="text-slate-300 font-medium">{c.content || c.text}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Tab 3: Suggestions */}
      {activeTab === 'suggestions' && (
        <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Lightbulb className="h-4 w-4 text-purple-400" /> Community Feature Suggestions
          </h3>

          {suggestions.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500 italic">No feature suggestions submitted yet.</div>
          ) : (
            <div className="space-y-3">
              {suggestions.map((s) => (
                <div key={s.suggestionId || s.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1 text-xs">
                  <div className="flex items-center justify-between font-mono text-[11px] text-purple-300">
                    <span>{s.authorName || 'Contributor'}</span>
                    <span>{formatTimestamp(s.createdAt)}</span>
                  </div>
                  <p className="text-slate-300 font-medium">{s.content || s.text}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Tab 4: Voting Roster */}
      {activeTab === 'votes' && (
        <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <ThumbsUp className="h-4 w-4 text-amber-400" /> Voters Roster
          </h3>

          {votes.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500 italic">No individual vote records found.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {votes.map((v, i) => (
                <div key={i} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2 text-xs font-mono text-slate-300">
                  <ThumbsUp className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">{v.voterName || v.uid || `Voter #${i + 1}`}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
