import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useUser } from '../hooks/useUser';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Lightbulb,
  Flag,
  BarChart3,
  Settings,
  FileText,
  LogOut,
  Zap,
  ChevronRight,
  Menu,
  X,
  ShieldCheck,
  Radio,
} from 'lucide-react';

export function AdminLayout() {
  const { user } = useAuth();
  const { userProfile } = useUser();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard, current: location.pathname === '/admin/dashboard' || location.pathname === '/admin' },
    { name: 'Users', href: '/admin/users', icon: Users, current: location.pathname.startsWith('/admin/users') },
    { name: 'Workspaces', href: '/admin/workspaces', icon: Briefcase, current: location.pathname.startsWith('/admin/workspaces') },
    { name: 'Ideas & MVPs', href: '/admin/ideas', icon: Lightbulb, current: location.pathname.startsWith('/admin/ideas') || location.pathname === '/admin/mvp' },
    { name: 'Moderation & Reports', href: '/admin/reports', icon: Flag, current: location.pathname.startsWith('/admin/reports') || location.pathname.startsWith('/admin/moderation') },
    { name: 'Platform Analytics', href: '/admin/analytics', icon: BarChart3, current: location.pathname.startsWith('/admin/analytics') },
    { name: 'Platform Settings', href: '/admin/settings', icon: Settings, current: location.pathname.startsWith('/admin/settings') },
    { name: 'Audit Logs', href: '/admin/audit', icon: FileText, current: location.pathname.startsWith('/admin/audit') },
    { name: 'Roles & Security', href: '/admin/roles', icon: ShieldCheck, current: location.pathname.startsWith('/admin/roles') || location.pathname.startsWith('/admin/security') },
    { name: 'Announcements', href: '/admin/announcements', icon: Radio, current: location.pathname.startsWith('/admin/announcements') },
    { name: 'Operations Center', href: '/admin/operations', icon: Zap, current: location.pathname.startsWith('/admin/operations') },
  ];

  const currentPage = navigation.find((n) => n.current)?.name || 'Dashboard';

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans">
      {/* Admin Top Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between px-4 sm:px-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMobileSidebarOpen((prev) => !prev)}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 lg:hidden"
            >
              <Menu className="h-6 w-6" />
            </button>

            <Link to="/admin/dashboard" className="flex items-center gap-2.5">
              <img
                src="/convia-logo.png"
                alt="Convia Logo"
                className="h-9 w-9 rounded-xl object-contain shadow-lg shadow-purple-900/50"
              />
              <div>
                <span className="text-base font-black tracking-tight text-white flex items-center gap-2">
                  Convia <span className="text-purple-400 text-xs px-2 py-0.5 rounded-full bg-purple-950 border border-purple-800 font-mono uppercase">Admin Portal</span>
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            {/* Live Listener Pulse Indicator */}
            <div className="hidden sm:flex items-center gap-2 bg-emerald-950/60 border border-emerald-800/60 px-3 py-1 rounded-full text-xs font-mono font-bold text-emerald-400 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>⚡ LIVE RTDB SYNC</span>
            </div>

            <Badge variant="success" className="bg-purple-900/80 text-purple-200 border border-purple-700/60 font-mono text-[10px] uppercase font-bold flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> SUPER ADMIN
            </Badge>

            <div className="flex items-center gap-3 border-l border-slate-800 pl-4">
              <Avatar name={userProfile?.displayName || user?.displayName || user?.email} size="sm" />
              <button
                onClick={() => navigate('/dashboard')}
                className="inline-flex items-center gap-1.5 text-xs font-extrabold text-indigo-200 hover:text-white transition-all bg-indigo-950/80 hover:bg-indigo-900 px-3.5 py-1.5 rounded-xl border border-indigo-700/60 shadow-sm"
                title="Transfer to normal user platform dashboard"
              >
                <LayoutDashboard className="h-3.5 w-3.5 text-indigo-400" />
                <span>User Dashboard</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Admin Sidebar Navigation */}
        <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 transition-transform duration-200 lg:static lg:translate-x-0 ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex h-full flex-col justify-between p-4">
            <div className="space-y-6">
              <div className="flex items-center justify-between lg:hidden border-b border-slate-800 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Admin Navigation</span>
                <button onClick={() => setIsMobileSidebarOpen(false)} className="p-1 text-slate-400">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-1">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  return item.disabled ? (
                    <div
                      key={item.name}
                      className="flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-600 opacity-60 cursor-not-allowed"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-4 w-4" />
                        <span>{item.name}</span>
                      </div>
                      {item.tag && (
                        <span className="text-[9px] font-mono uppercase bg-slate-800 text-slate-500 px-2 py-0.5 rounded-md">
                          {item.tag}
                        </span>
                      )}
                    </div>
                  ) : (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => setIsMobileSidebarOpen(false)}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        item.current
                          ? 'bg-purple-600 text-white shadow-md shadow-purple-900/40'
                          : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-4 w-4" />
                        <span>{item.name}</span>
                      </div>
                      {item.current && <ChevronRight className="h-3.5 w-3.5" />}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-slate-800 pt-4 space-y-2">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 space-y-1 font-mono">
                <div className="text-purple-400 font-bold flex items-center gap-1">
                  <Radio className="h-3 w-3 animate-pulse" /> RTDB Realtime Node
                </div>
                <p>Status: Healthy</p>
                <p>Version: 1.0.0 (Production)</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 max-w-7xl mx-auto w-full space-y-6">
          {/* Admin Breadcrumb Bar */}
          <nav className="flex items-center gap-1.5 text-xs font-mono text-slate-500">
            <Link to="/admin/dashboard" className="hover:text-purple-400 transition-colors">Admin Portal</Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-700" />
            <span className="text-slate-200 font-bold">{currentPage}</span>
          </nav>

          <Outlet />
        </main>
      </div>
    </div>
  );
}
