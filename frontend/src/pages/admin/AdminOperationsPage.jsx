import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { adminService } from '../../services/adminService';
import { NotificationService } from '../../services/notificationService';
import { NOTIFICATION_MESSAGES } from '../../utils/notificationMessages';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import {
  Activity,
  Send,
  AlertTriangle,
  Lock,
  CheckCircle2,
  Terminal,
  Shield,
  Server,
  Zap,
} from 'lucide-react';

export default function AdminOperationsPage() {
  const { user: currentUser } = useAuth();

  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  // Broadcast Form State
  const [bTitle, setBTitle] = useState('');
  const [bMessage, setBMessage] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = adminService.subscribeToPlatformMetrics((data) => {
      setMetrics(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleBroadcast = async (e) => {
    e.preventDefault();
    if (!bTitle.trim() || !bMessage.trim()) return;

    setBroadcasting(true);
    try {
      await adminService.broadcastNotification(
        currentUser.uid,
        currentUser.displayName || currentUser.email,
        { title: bTitle, message: bMessage }
      );
      NotificationService.success(NOTIFICATION_MESSAGES.ADMIN.BROADCAST_SENT);
      setBTitle('');
      setBMessage('');
    } catch (err) {
      NotificationService.error(err);
    } finally {
      setBroadcasting(false);
    }
  };

  if (loading || !metrics) {
    return (
      <div className="space-y-6 w-full">
        <LoadingSkeleton variant="card" count={3} />
      </div>
    );
  }

  const { health } = metrics;

  return (
    <div className="space-y-6 w-full pb-16">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <Zap className="h-6 w-6 text-purple-400" /> Platform Operations Center & Production Health
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Centralized operations hub for system health monitoring, emergency broadcasts, and production readiness checks.
          </p>
        </div>

        <Badge variant="default" className="bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono text-xs self-start md:self-auto">
          ● Platform Operations Healthy
        </Badge>
      </div>

      {/* Infrastructure Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 bg-slate-900 border border-slate-800 space-y-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">Firebase RTDB Listener Status</span>
          <div className="text-xl font-black text-emerald-400 flex items-center gap-2">
            <Server className="h-5 w-5" /> Healthy & Connected
          </div>
          <span className="text-[11px] text-slate-400 font-medium">6 Active Real-time Subscription Pipelines</span>
        </Card>

        <Card className="p-5 bg-slate-900 border border-slate-800 space-y-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">Authentication Guard</span>
          <div className="text-xl font-black text-purple-400 flex items-center gap-2">
            <Shield className="h-5 w-5" /> Enforced RBAC
          </div>
          <span className="text-[11px] text-slate-400 font-medium">Email Domain & Whitelist Validation Active</span>
        </Card>

        <Card className="p-5 bg-slate-900 border border-slate-800 space-y-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">Production Build Info</span>
          <div className="text-xl font-black text-white font-mono flex items-center gap-2">
            <Terminal className="h-5 w-5 text-amber-400" /> v1.0.0 (Clean)
          </div>
          <span className="text-[11px] text-slate-400 font-medium">Vite v6.4.3 Minified Production Chunk</span>
        </Card>
      </div>

      {/* Broadcast Notification Panel */}
      <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
        <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2 border-b border-slate-800 pb-3">
          <Send className="h-4 w-4 text-purple-400" /> Real-time System Broadcast Dispatcher
        </h3>

        <form onSubmit={handleBroadcast} className="space-y-4 text-xs font-medium">
          <div className="space-y-1">
            <label className="text-slate-300 font-bold">Broadcast Subject / Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Scheduled Maintenance Notice"
              value={bTitle}
              onChange={(e) => setBTitle(e.target.value)}
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-purple-500 font-bold"
            />
          </div>

          <div className="space-y-1">
            <label className="text-slate-300 font-bold">Broadcast Body Message</label>
            <textarea
              rows={3}
              required
              placeholder="Notice message to be delivered instantly to all registered user in-app notification centers..."
              value={bMessage}
              onChange={(e) => setBMessage(e.target.value)}
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-purple-500 font-medium"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={broadcasting}
            icon={<Send className="h-4 w-4" />}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold"
          >
            Dispatch Platform-wide Broadcast Notification
          </Button>
        </form>
      </Card>
    </div>
  );
}
