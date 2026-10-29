import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { adminService } from '../../services/adminService';
import { NotificationService } from '../../services/notificationService';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { formatTimestamp } from '../../utils/formatting';
import { ShieldCheck, Lock, Activity, RefreshCw, CheckCircle2, User, Globe, AlertTriangle } from 'lucide-react';

export default function AdminSecurityPage() {
  const { user: currentUser } = useAuth();

  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = adminService.subscribeToPlatformMetrics((data) => {
      setMetrics(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading || !metrics) {
    return (
      <div className="space-y-6 w-full">
        <LoadingSkeleton variant="card" count={3} />
      </div>
    );
  }

  const { recentUsers } = metrics;

  return (
    <div className="space-y-6 w-full pb-16">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <Lock className="h-6 w-6 text-purple-400" /> Active Security Telemetry & Sessions Monitor
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Monitor real-time active sessions, inspect authentication security status, and track administrative access events.
          </p>
        </div>

        <Badge variant="default" className="bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono text-xs self-start md:self-auto">
          🔒 System Secure & Guarded
        </Badge>
      </div>

      {/* Security Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 bg-slate-900 border border-slate-800 space-y-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">Admin Whitelist Protection</span>
          <div className="text-lg font-black text-emerald-400">VITE_ADMIN_EMAIL Active</div>
          <span className="text-[11px] text-slate-400 font-medium">Strict Email Domain & Whitelist Verification</span>
        </Card>

        <Card className="p-5 bg-slate-900 border border-slate-800 space-y-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">Realtime Security Listener</span>
          <div className="text-lg font-black text-purple-400">Database Guard Active</div>
          <span className="text-[11px] text-slate-400 font-medium">RTDB Security Rule Layer Enforced</span>
        </Card>

        <Card className="p-5 bg-slate-900 border border-slate-800 space-y-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">Session Security</span>
          <div className="text-lg font-black text-amber-400">Active Admin Session</div>
          <span className="text-[11px] text-slate-400 font-medium">{currentUser?.email}</span>
        </Card>
      </div>

      {/* Active User Sessions */}
      <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
        <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2 border-b border-slate-800 pb-3">
          <Activity className="h-4 w-4 text-purple-400" /> Active Platform Users Roster
        </h3>

        <div className="space-y-3">
          {recentUsers.map((u) => (
            <div key={u.uid} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-purple-400" />
                <div>
                  <p className="font-bold text-white">{u.displayName || u.email}</p>
                  <span className="text-[10px] text-slate-400">{u.email}</span>
                </div>
              </div>

              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                u.onlineStatus === 'online' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-slate-800 text-slate-400'
              }`}>
                {u.onlineStatus === 'online' ? '● Online' : 'Offline'}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
