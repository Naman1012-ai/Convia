import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { adminService } from '../../services/adminService';
import { NotificationService } from '../../services/notificationService';
import { NOTIFICATION_MESSAGES } from '../../utils/notificationMessages';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { formatTimestamp } from '../../utils/formatting';
import {
  Megaphone,
  Plus,
  Pin,
  Trash2,
  CheckCircle2,
  Globe,
  Bell,
  Send,
  AlertTriangle,
} from 'lucide-react';

export default function AdminAnnouncementsPage() {
  const { user: currentUser } = useAuth();

  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Platform Update');
  const [priority, setPriority] = useState('Normal');
  const [targetAudience, setTargetAudience] = useState('Entire Platform');
  const [expireHours, setExpireHours] = useState('0');
  const [isPinned, setIsPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = adminService.subscribeToAnnouncements((data) => {
      setAnnouncements(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setSubmitting(true);
    try {
      await adminService.createAnnouncement(
        currentUser.uid,
        currentUser.displayName || currentUser.email,
        { title, description, category, priority, targetAudience, expireHours, isPinned }
      );
      NotificationService.success(NOTIFICATION_MESSAGES.ANNOUNCEMENT.PUBLISHED);
      setShowCreateModal(false);
      setTitle('');
      setDescription('');
    } catch (err) {
      NotificationService.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await adminService.deleteAnnouncement(
        currentUser.uid,
        currentUser.displayName || currentUser.email,
        id
      );
      NotificationService.success(NOTIFICATION_MESSAGES.ANNOUNCEMENT.DELETED);
    } catch (err) {
      NotificationService.error(err);
    }
  };

  const handleTogglePin = async (id) => {
    try {
      await adminService.toggleAnnouncementPin(
        currentUser.uid,
        currentUser.displayName || currentUser.email,
        id
      );
      NotificationService.success('Updated announcement pinned status.');
    } catch (err) {
      NotificationService.error(err);
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
            <Megaphone className="h-6 w-6 text-purple-400" /> Global Announcements & Platform Notices
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Publish platform-wide announcements, emergency banners, and feature updates visible across all user dashboards.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => setShowCreateModal(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs self-start md:self-auto"
        >
          Create Announcement
        </Button>
      </div>

      {/* Announcements List */}
      <div className="space-y-4">
        {announcements.length === 0 ? (
          <Card className="p-12 text-center bg-slate-900 border border-slate-800 space-y-2">
            <Megaphone className="h-10 w-10 text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-slate-300">No Global Announcements Active</h3>
            <p className="text-xs text-slate-500">Click "Create Announcement" above to publish a platform notice.</p>
          </Card>
        ) : (
          announcements.map((anc) => (
            <Card key={anc.id} className="p-5 bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-850 pb-2.5">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    anc.priority === 'Critical' ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-purple-950 text-purple-300 border border-purple-800'
                  }`}>
                    {anc.category}
                  </span>
                  <span className="text-xs font-bold text-white">{anc.title}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTogglePin(anc.id)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      anc.isPinned ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-slate-600 hover:text-slate-400'
                    }`}
                    title={anc.isPinned ? 'Pinned announcement' : 'Pin to top of dashboards'}
                  >
                    <Pin className={`h-4 w-4 ${anc.isPinned ? 'fill-current' : ''}`} />
                  </button>

                  <button
                    onClick={() => handleDelete(anc.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                    title="Delete Announcement"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed font-medium">{anc.description}</p>

              <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-1">
                <span>Published by <strong className="text-slate-300">{anc.createdBy}</strong></span>
                <span>{formatTimestamp(anc.createdAt)}</span>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <Card className="max-w-lg w-full p-6 bg-slate-900 border border-slate-800 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-purple-400" /> Create Global Announcement
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white text-xs font-bold">
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs font-medium">
              <div className="space-y-1">
                <label className="text-slate-300 font-bold">Announcement Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Convia v1.0 Production Launch!"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-purple-500 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-bold">Category & Priority</label>
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-purple-500 font-bold"
                  >
                    <option value="Platform Update">Platform Update</option>
                    <option value="Maintenance">Maintenance Alert</option>
                    <option value="Security Alert">Security Notice</option>
                    <option value="Hackathon Event">Hackathon Event</option>
                  </select>

                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-purple-500 font-bold"
                  >
                    <option value="Normal">Normal Priority</option>
                    <option value="High">High Priority</option>
                    <option value="Critical">Critical Emergency</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-bold">Target Audience & Expiration</label>
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-purple-500 font-bold"
                  >
                    <option value="Entire Platform">Entire Platform</option>
                    <option value="Workspace Owners">Workspace Owners</option>
                    <option value="Workspace Members">Workspace Members</option>
                    <option value="Verified Users">Verified Users</option>
                    <option value="Administrators">Administrators</option>
                  </select>

                  <select
                    value={expireHours}
                    onChange={(e) => setExpireHours(e.target.value)}
                    className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-purple-500 font-bold"
                  >
                    <option value="0">Never Expire</option>
                    <option value="1">Expire in 1 Hour</option>
                    <option value="24">Expire in 24 Hours</option>
                    <option value="72">Expire in 3 Days</option>
                    <option value="168">Expire in 7 Days</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-bold">Announcement Content & Details</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Detailed announcement explanation..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-purple-500 font-medium"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="pinCheck"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="h-4 w-4 rounded bg-slate-950 border-slate-700 text-purple-600 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="pinCheck" className="text-slate-300 font-bold cursor-pointer">
                  Pin to top of user dashboards
                </label>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={submitting}
                icon={<Send className="h-4 w-4" />}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold"
              >
                Publish Global Announcement
              </Button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
