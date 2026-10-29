import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { adminService } from '../../services/adminService';
import { NotificationService } from '../../services/notificationService';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { formatTimestamp } from '../../utils/formatting';
import {
  Lightbulb,
  Search,
  Star,
  Eye,
  Globe,
  Briefcase,
  Trophy,
} from 'lucide-react';

export default function AdminIdeasPage() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters State
  const [search, setSearch] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [featuredFilter, setFeaturedFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('NEWEST');

  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = adminService.subscribeToAllIdeasWithStats((allIdeas) => {
      setIdeas(allIdeas);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const processedIdeas = useMemo(() => {
    let result = [...ideas];

    // Search Query Filter
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (i) =>
          (i.title && i.title.toLowerCase().includes(q)) ||
          (i.authorName && i.authorName.toLowerCase().includes(q)) ||
          (i.workspaceName && i.workspaceName.toLowerCase().includes(q)) ||
          (i.category && i.category.toLowerCase().includes(q))
      );
    }

    // Visibility Filter
    if (visibilityFilter !== 'ALL') {
      const isPublic = visibilityFilter === 'PUBLIC';
      result = result.filter((i) => Boolean(i.isPublic) === isPublic);
    }

    // Status Filter
    if (statusFilter !== 'ALL') {
      result = result.filter((i) => (i.status || 'Ideation') === statusFilter);
    }

    // Featured Filter
    if (featuredFilter !== 'ALL') {
      const isFeat = featuredFilter === 'FEATURED';
      result = result.filter((i) => Boolean(i.isFeatured) === isFeat);
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'NEWEST') return (b.createdAt || 0) - (a.createdAt || 0);
      if (sortBy === 'OLDEST') return (a.createdAt || 0) - (b.createdAt || 0);
      if (sortBy === 'VOTES') return (b.voteCount || 0) - (a.voteCount || 0);
      if (sortBy === 'COMMENTS') return (b.commentsCount || 0) - (a.commentsCount || 0);
      if (sortBy === 'SUGGESTIONS') return (b.suggestionsCount || 0) - (a.suggestionsCount || 0);
      if (sortBy === 'ALPHABETICAL') return a.title.localeCompare(b.title);
      return 0;
    });

    return result;
  }, [ideas, search, visibilityFilter, statusFilter, featuredFilter, sortBy]);

  const handleToggleFeatured = async (idea) => {
    setActionLoading(true);
    try {
      await adminService.toggleIdeaFeatured(
        currentUser.uid,
        currentUser.displayName || currentUser.email,
        idea.ideaId,
        idea.isPublic,
        idea.orgId
      );
      NotificationService.success(`Toggled featured status for "${idea.title}"`);
    } catch (err) {
      NotificationService.error(err.message || 'Failed to toggle featured status.');
    } finally {
      setActionLoading(false);
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
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <Lightbulb className="h-6 w-6 text-amber-400" /> Platform Proposals & Ideas Directory
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Monitor public and workspace proposals, audit vote counts, toggle featured ideas, and oversee MVP promotions.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          <Button
            variant="secondary"
            size="sm"
            icon={<Trophy className="h-4 w-4 text-amber-400" />}
            onClick={() => navigate('/admin/mvp')}
            className="bg-purple-950 hover:bg-purple-900 text-purple-200 border border-purple-800 text-xs font-bold"
          >
            MVP Oversight Dashboard
          </Button>
          <Badge variant="default" className="bg-purple-950 text-purple-300 border border-purple-800 font-mono text-xs">
            {processedIdeas.length} of {ideas.length} Proposals
          </Badge>
        </div>
      </div>

      {/* Controls Bar */}
      <Card className="p-5 bg-slate-900 border border-slate-800 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2 relative">
            <input
              type="text"
              placeholder="Search proposals by title, author, workspace..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-medium"
            />
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
          </div>

          <select
            value={visibilityFilter}
            onChange={(e) => setVisibilityFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-white text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500"
          >
            <option value="ALL">Visibility: All</option>
            <option value="PUBLIC">Public Proposals</option>
            <option value="WORKSPACE">Workspace Proposals</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-white text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500"
          >
            <option value="ALL">Status: All</option>
            <option value="Ideation">Ideation</option>
            <option value="Voting">Voting</option>
            <option value="Selected MVP">Selected MVP</option>
            <option value="Project">Project Phase</option>
            <option value="Completed">Completed</option>
            <option value="Archived">Archived</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-white text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500"
          >
            <option value="NEWEST">Sort: Newest First</option>
            <option value="OLDEST">Sort: Oldest First</option>
            <option value="VOTES">Sort: Most Votes</option>
            <option value="COMMENTS">Sort: Most Comments</option>
            <option value="SUGGESTIONS">Sort: Most Suggestions</option>
            <option value="ALPHABETICAL">Sort: Alphabetical</option>
          </select>
        </div>
      </Card>

      {/* Directory Table */}
      <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
        {processedIdeas.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs italic">
            No proposals match the specified search query or filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-medium text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-mono border-b border-slate-800">
                <tr>
                  <th className="p-3">Proposal Title</th>
                  <th className="p-3">Author & Scope</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Engagement Telemetry</th>
                  <th className="p-3 text-center">Featured</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {processedIdeas.map((i) => (
                  <tr key={i.ideaId} className="hover:bg-slate-850 transition-colors">
                    {/* Proposal Title */}
                    <td className="p-3">
                      <div className="space-y-0.5">
                        <p className="font-extrabold text-white text-xs line-clamp-1">{i.title}</p>
                        <span className="text-[10px] font-mono text-slate-500">Created {formatTimestamp(i.createdAt)}</span>
                      </div>
                    </td>

                    {/* Author & Scope */}
                    <td className="p-3">
                      <p className="font-bold text-slate-200 text-xs">{i.authorName}</p>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold ${
                        i.isPublic ? 'text-indigo-400' : 'text-purple-400'
                      }`}>
                        {i.isPublic ? <Globe className="h-3 w-3" /> : <Briefcase className="h-3 w-3" />}
                        {i.workspaceName}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="p-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        i.isSelected || i.status === 'Selected MVP'
                          ? 'bg-amber-950 text-amber-300 border border-amber-700'
                          : 'bg-slate-800 text-slate-300'
                      }`}>
                        {i.isSelected ? '🏆 Selected MVP' : i.status}
                      </span>
                    </td>

                    {/* Telemetry */}
                    <td className="p-3">
                      <div className="flex items-center gap-2 font-mono text-[11px]">
                        <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-amber-300" title="Votes">
                          👍 {i.voteCount} Votes
                        </span>
                        <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-indigo-300" title="Comments">
                          💬 {i.commentsCount}
                        </span>
                      </div>
                    </td>

                    {/* Featured Star Toggle */}
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleToggleFeatured(i)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          i.isFeatured ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-slate-600 hover:text-slate-400'
                        }`}
                        title={i.isFeatured ? 'Featured on public discovery' : 'Mark as featured'}
                      >
                        <Star className={`h-4 w-4 ${i.isFeatured ? 'fill-current' : ''}`} />
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="p-3 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<Eye className="h-3.5 w-3.5 text-purple-400" />}
                        onClick={() => navigate(`/admin/ideas/${i.ideaId}`)}
                        className="bg-slate-800 text-xs text-white font-bold"
                      >
                        View Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
