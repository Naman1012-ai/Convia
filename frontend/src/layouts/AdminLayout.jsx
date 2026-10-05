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
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useSidebarCollapse } from '../hooks/useSidebarCollapse';
import { cn } from '../utils/cn';

export function AdminLayout() {
  const { user } = useAuth();
  const { userProfile } = useUser();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Persistent desktop sidebar collapse state
  const [isCollapsed, toggleCollapse] = useSidebarCollapse(
    'convia_sidebar_admin_collapsed',
    false
  );

  const navigation = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard, current: location.pathname === '/admin/dashboard' || location.pathname === '/admin' },
    { name: 'Users', href: '/admin/users', icon: Users, current: location.pathname.startsWith('/admin/users') },
    { name: 'Workspaces', href: '/admin/workspaces', icon: Briefcase, current: location.pathname.startsWith('/admin/workspaces') },
    { name: 'Ideas & MVPs', href: '/admin/ideas', icon: Lightbulb, current: location.pathname.startsWith('/admin/ideas') || location.pathname === '/admin/mvp' },
    { name: 'Moderation & Reports', href: '/admin/reports', icon: Flag, current: location.pathname.startsWith('/admin/reports') || location.pathname.startsWith('/admin/moderation') },
    { name: 'Platform Analytics', href: '/admin/analytics', icon: BarChart3, current: location.pathname.startsWith('/admin/analytics') },
    { name: 'Platform Settings', href: '/admin/settings', icon: Settings, current: location.pathname.startsWith('/admin/settings') },
    { name: 'Audit Logs', href: '/admin/audit', icon: FileText, current: location.pathname.startsWith('/admin/audit') },
    { name: 'Security & Auth', href: '/admin/security', icon: ShieldCheck, current: location.pathname.startsWith('/admin/security') },
    { name: 'Ops & Health', href: '/admin/operations', icon: Zap, current: location.pathname.startsWith('/admin/operations') || location.pathname.startsWith('/admin/system-health') },
  ];

  const currentPage = navigation.find((item) => item.current)?.name || 'Admin Console';

  const renderNavContent = (collapsed = false) => (
    <div className={`flex h-full flex-col justify-between transition-all duration-200 select-none ${collapsed ? 'p-2' : 'p-4'}`}>
      <div className="space-y-4">
        {/* Mobile Header */}
        <div className="flex items-center justify-between lg:hidden border-b border-slate-800 pb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Admin Navigation</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsMobileSidebarOpen(false);
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer flex items-center justify-center w-8 h-8"
            title="Collapse admin sidebar"
            aria-label="Collapse admin sidebar"
            aria-expanded="true"
          >
            <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Desktop Header & Toggle */}
        <div className={`hidden lg:flex items-center pb-3 border-b border-slate-800 transition-all ${
          collapsed ? 'justify-center' : 'justify-between px-1'
        }`}>
          {!collapsed && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Admin
            </span>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleCollapse();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-primary-500 relative flex items-center justify-center shrink-0 w-8 h-8"
            title={collapsed ? 'Expand admin sidebar' : 'Collapse admin sidebar'}
            aria-label={collapsed ? 'Expand admin sidebar' : 'Collapse admin sidebar'}
            aria-expanded={!collapsed}
          >
            <span className="relative w-4 h-4 flex items-center justify-center overflow-hidden">
              <PanelLeftClose
                className={cn(
                  'h-4 w-4 absolute transition-all duration-200 ease-in-out motion-reduce:transition-none',
                  collapsed
                    ? 'opacity-0 scale-75 rotate-90 pointer-events-none'
                    : 'opacity-100 scale-100 rotate-0'
                )}
                aria-hidden="true"
              />
              <PanelLeftOpen
                className={cn(
                  'h-4 w-4 absolute transition-all duration-200 ease-in-out motion-reduce:transition-none',
                  collapsed
                    ? 'opacity-100 scale-100 rotate-0'
                    : 'opacity-0 scale-75 -rotate-90 pointer-events-none'
                )}
                aria-hidden="true"
              />
            </span>
          </button>
        </div>

        {/* Nav Items */}
        <nav className="space-y-1" aria-label="Admin Navigation Links">
          {navigation.map((item) => {
            const Icon = item.icon;

            if (item.disabled) {
              if (collapsed) {
                return (
                  <div key={item.name} className="relative group flex justify-center">
                    <div
                      className="flex items-center justify-center p-2.5 rounded-xl text-slate-600 opacity-60 cursor-not-allowed"
                      title={item.name}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                );
              }
              return (
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
              );
            }

            if (collapsed) {
              return (
                <div key={item.name} className="relative group flex justify-center">
                  <Link
                    to={item.href}
                    onClick={() => setIsMobileSidebarOpen(false)}
                    title={item.name}
                    aria-label={item.name}
                    className={`flex items-center justify-center p-2.5 rounded-xl text-xs font-bold transition-all relative ${
                      item.current
                        ? 'bg-primary-600 text-white shadow-md shadow-primary-900/40'
                        : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </Link>
                  {/* Floating tooltip on hover */}
                  <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center z-50 pointer-events-none">
                    <div className="bg-slate-800 text-white text-xs font-medium px-2.5 py-1 rounded-md shadow-lg whitespace-nowrap border border-slate-700">
                      {item.name}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setIsMobileSidebarOpen(false)}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  item.current
                    ? 'bg-primary-600 text-white shadow-md shadow-primary-900/40'
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
        </nav>
      </div>

      {/* Footer Info Box */}
      {!collapsed ? (
        <div className="border-t border-slate-800 pt-4 space-y-2">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 space-y-1 font-mono">
            <div className="text-primary-400 font-bold flex items-center gap-1">
              <Radio className="h-3 w-3 animate-pulse" /> RTDB Realtime Node
            </div>
            <p>Status: Healthy</p>
            <p>Version: 1.0.0 (Production)</p>
          </div>
        </div>
      ) : (
        <div className="border-t border-slate-800 pt-2 flex justify-center" title="RTDB Realtime Node: Healthy">
          <Radio className="h-3.5 w-3.5 text-primary-400 animate-pulse" />
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Admin Header Bar */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsMobileSidebarOpen((prev) => !prev);
            }}
            className="p-1.5 -ml-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden focus:outline-none focus:ring-2 focus:ring-primary-500 relative flex items-center justify-center shrink-0 w-9 h-9 cursor-pointer"
            title={isMobileSidebarOpen ? 'Collapse admin sidebar' : 'Expand admin sidebar'}
            aria-label={isMobileSidebarOpen ? 'Collapse admin sidebar' : 'Expand admin sidebar'}
            aria-expanded={isMobileSidebarOpen}
          >
            <span className="relative w-5 h-5 flex items-center justify-center overflow-hidden">
              <PanelLeftClose
                className={cn(
                  'h-5 w-5 absolute transition-all duration-200 ease-in-out motion-reduce:transition-none',
                  isMobileSidebarOpen
                    ? 'opacity-100 scale-100 rotate-0'
                    : 'opacity-0 scale-75 rotate-90 pointer-events-none'
                )}
                aria-hidden="true"
              />
              <PanelLeftOpen
                className={cn(
                  'h-5 w-5 absolute transition-all duration-200 ease-in-out motion-reduce:transition-none',
                  isMobileSidebarOpen
                    ? 'opacity-0 scale-75 -rotate-90 pointer-events-none'
                    : 'opacity-100 scale-100 rotate-0'
                )}
                aria-hidden="true"
              />
            </span>
          </button>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary-600 flex items-center justify-center font-bold text-white shadow-lg shadow-primary-900/50">
              C
            </div>
            <div>
              <span className="font-black text-sm tracking-tight text-white flex items-center gap-2">
                Convia <Badge variant="primary" className="text-[10px] px-1.5 py-0">ADMIN</Badge>
              </span>
            </div>
          </div>
        </div>

        {/* Global Controls & User Actions */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 border-l border-slate-800 pl-4">
            <Avatar
              name={userProfile?.displayName || user?.displayName || 'Admin'}
              src={userProfile?.photoURL || user?.photoURL}
              size="sm"
            />
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold text-slate-200 leading-tight">
                {userProfile?.displayName || user?.displayName || 'System Admin'}
              </p>
              <p className="text-[10px] text-slate-500 font-mono">
                {user?.email}
              </p>
            </div>
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={() => navigate('/dashboard')}
                title="Exit to User Dashboard"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-xs font-semibold px-2.5"
              >
                <LayoutDashboard className="h-3.5 w-3.5 text-primary-400" />
                <span>User Dashboard</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Collapsible Admin Sidebar */}
        <aside
          className={`hidden lg:block shrink-0 bg-slate-900 border-r border-slate-800 transition-all duration-200 ease-in-out ${
            isCollapsed ? 'w-16' : 'w-64'
          }`}
        >
          {renderNavContent(isCollapsed)}
        </aside>

        {/* Mobile Overlay Admin Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 transition-transform duration-200 lg:hidden ${
            isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {renderNavContent(false)}
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-8 max-w-7xl mx-auto w-full space-y-6 transition-all duration-200">
          {/* Admin Breadcrumb Bar */}
          <nav className="flex items-center gap-1.5 text-xs font-mono text-slate-500">
            <Link to="/admin/dashboard" className="hover:text-primary-400 transition-colors">Admin Portal</Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-700" />
            <span className="text-slate-200 font-bold">{currentPage}</span>
          </nav>

          <Outlet />
        </main>
      </div>
    </div>
  );
}
