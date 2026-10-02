import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useUser } from '../../hooks/useUser';
import { useToast } from '../../hooks/useToast';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import {
  Zap,
  LogOut,
  User,
  Menu,
  X,
  Globe,
  Briefcase,
  LayoutDashboard,
  Flag,
  ShieldCheck,
  MessageSquare,
} from 'lucide-react';
import { ReportIssueModal } from '../../features/reports/ReportIssueModal';
import { NotificationDropdown } from './NotificationDropdown';

const NOOP_TOGGLE = () => {};

export function Navbar({ onMobileMenuToggle = NOOP_TOGGLE }) {
  const { user, signOut } = useAuth();
  const { userProfile } = useUser();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  const adminEnvEmail = (import.meta.env.VITE_ADMIN_EMAIL || 'admin@convia.dev').toLowerCase().trim();
  const userEmail = (user?.email || '').toLowerCase().trim();
  const isAdmin = Boolean(
    userProfile?.role === 'superadmin' ||
    userProfile?.role === 'admin' ||
    userProfile?.isAdmin === true ||
    (adminEnvEmail && userEmail === adminEnvEmail)
  );

  const handleSignOut = async () => {
    try {
      setIsUserMenuOpen(false);
      setIsMobileMenuOpen(false);
      await signOut();
      toast.info('Signed out successfully.');
      navigate('/');
    } catch (err) {
      console.error('[Navbar] Sign out error:', err);
      toast.error('Failed to sign out.');
    }
  };

  const isCurrentPath = (path) => location.pathname === path;

  // Reset all transient UI states immediately whenever the route changes
  useEffect(() => {
    setIsUserMenuOpen(false);
    setIsMobileMenuOpen(false);
    setIsReportModalOpen(false);
  }, [location.pathname]);

  // Click outside and Escape key listeners for User Profile dropdown
  useEffect(() => {
    if (!isUserMenuOpen) return;

    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setIsUserMenuOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isUserMenuOpen]);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  // Track whether a parent layout provided an external mobile toggle handler
  const hasExternalMobileToggle = onMobileMenuToggle !== NOOP_TOGGLE;

  const handleMobileMenuToggle = (e) => {
    if (e) e.stopPropagation();
    // If a parent layout (AppLayout, OrgLayout) provided a sidebar toggle handler, use it
    if (hasExternalMobileToggle) {
      onMobileMenuToggle();
    } else {
      setIsMobileMenuOpen((prev) => !prev);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-lavender-border bg-white/95 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between px-4 sm:px-8 max-w-7xl mx-auto">
        {/* Brand Logo & Mobile Toggle */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleMobileMenuToggle}
            className="rounded-lg p-1.5 text-slate-600 hover:bg-primary-50/70 hover:text-primary-700 sm:hidden focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-label="Toggle Navigation Menu"
          >
            <Menu className="h-6 w-6" />
          </button>

          <Link to="/dashboard" className="flex items-center gap-2.5">
            <img src="/convia-logo.png" alt="Convia Logo" className="h-9 w-9 rounded-xl object-contain shadow-sm" />
            <span className="text-xl font-extrabold tracking-tight text-slate-900">
              Convia
            </span>
          </Link>
        </div>

        {/* Desktop Central Navigation Links */}
        {user && (
          <nav className="hidden md:flex items-center gap-1 font-medium text-sm">
            <Link
              to="/dashboard"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                isCurrentPath('/dashboard')
                  ? 'bg-primary-50 text-primary-800 font-semibold border border-primary-200/60'
                  : 'text-slate-600 hover:bg-primary-50/50 hover:text-primary-900'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Dashboard</span>
            </Link>

            <Link
              to="/explore"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                isCurrentPath('/explore')
                  ? 'bg-primary-50 text-primary-800 font-semibold border border-primary-200/60'
                  : 'text-slate-600 hover:bg-primary-50/50 hover:text-primary-900'
              }`}
            >
              <Globe className="h-4 w-4 text-primary-600" />
              <span>Explore Ideas</span>
            </Link>

            <Link
              to="/community"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                isCurrentPath('/community')
                  ? 'bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200/60'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <MessageSquare className="h-4 w-4 text-emerald-600" />
              <span>Community</span>
            </Link>

            <Link
              to="/workspaces"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                isCurrentPath('/workspaces')
                  ? 'bg-primary-50 text-primary-800 font-semibold border border-primary-200/60'
                  : 'text-slate-600 hover:bg-primary-50/50 hover:text-primary-900'
              }`}
            >
              <Briefcase className="h-4 w-4 text-slate-500" />
              <span>Workspaces</span>
            </Link>
          </nav>
        )}

        {/* User Profile & Action Menu */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-2">
              {/* Admin Portal Toggle Button */}
              {isAdmin && (
                <Link
                  to="/admin/dashboard"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-primary-800 bg-primary-50 hover:bg-primary-100 border border-primary-200/80 transition-all shadow-sm hover:shadow"
                >
                  <ShieldCheck className="h-4 w-4 text-primary-600" />
                  <span>Admin Portal</span>
                </Link>
              )}

              {/* Phase 7: Real-Time In-App Notification Center */}
              <NotificationDropdown />

              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setIsUserMenuOpen((prev) => !prev)}
                  className="flex items-center gap-2.5 rounded-full p-1 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                  aria-label="User profile menu"
                >
                  <Avatar name={userProfile?.displayName || user?.displayName || user?.email} size="sm" />
                  <span className="hidden sm:inline-block text-sm font-semibold text-slate-700 max-w-[120px] truncate">
                    {userProfile?.displayName || user?.displayName || user?.email.split('@')[0]}
                  </span>
                </button>

                {/* User Dropdown Menu */}
                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-52 rounded-xl border border-lavender-border bg-white p-1.5 shadow-xl shadow-primary-950/10 z-50">
                    <div className="px-3 py-2 border-b border-slate-100">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {userProfile?.displayName || user?.displayName || 'User'}
                        </p>
                        {isAdmin && (
                          <span className="text-[9px] font-mono font-bold uppercase bg-primary-100 text-primary-800 px-1.5 py-0.5 rounded">
                            ADMIN
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                    </div>

                    {isAdmin && (
                      <Link
                        to="/admin/dashboard"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-extrabold text-primary-800 bg-primary-50 hover:bg-primary-100 transition-colors my-1 border border-primary-200/60"
                      >
                        <ShieldCheck className="h-4 w-4 text-primary-600" />
                        <span>Switch to Admin Portal</span>
                      </Link>
                    )}

                    <Link
                      to="/profile"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-primary-50/60 hover:text-primary-900 transition-colors"
                    >
                      <User className="h-4 w-4 text-slate-400" />
                      <span>My Profile</span>
                    </Link>

                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setIsReportModalOpen(true);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-primary-800 hover:bg-primary-50/80 hover:text-primary-900 transition-colors"
                    >
                      <Flag className="h-4 w-4 text-primary-600" />
                      <span>Report Issue</span>
                    </button>

                    <div className="my-1 border-t border-slate-100" />

                    <button
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <LogOut className="h-4 w-4 text-rose-500" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/signin">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link to="/signup">
                <Button variant="primary" size="sm">
                  Get Started
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Global Report Issue Modal */}
      <ReportIssueModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
      />

      {/* Mobile Navigation Drawer (only when no parent sidebar exists) */}
      {!hasExternalMobileToggle && isMobileMenuOpen &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex sm:hidden">
            {/* Solid Backdrop overlay */}
            <div
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity"
              onClick={() => setIsMobileMenuOpen(false)}
            />

            {/* Drawer Container - Solid Bold Dark Theme */}
            <div className="relative flex w-72 max-w-[85vw] flex-1 flex-col bg-slate-900 text-slate-100 p-5 shadow-2xl z-[99999] border-r border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <Link
                  to="/dashboard"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-2.5"
                >
                  <img src="/convia-logo.png" alt="Convia Logo" className="h-8 w-8 rounded-xl object-contain shadow-sm" />
                  <span className="text-lg font-extrabold text-white tracking-tight">Convia</span>
                </Link>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white focus:outline-none"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Mobile Navigation Links */}
              <nav className="flex-1 space-y-1.5 py-5 text-sm font-medium">
                <Link
                  to="/dashboard"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isCurrentPath('/dashboard')
                      ? 'bg-primary-600 text-white font-extrabold shadow-md'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <LayoutDashboard className="h-5 w-5 text-primary-300" />
                  <span>Dashboard</span>
                </Link>

                <Link
                  to="/explore"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isCurrentPath('/explore')
                      ? 'bg-primary-600 text-white font-extrabold shadow-md'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Globe className="h-5 w-5 text-primary-300" />
                  <span>Explore Ideas</span>
                </Link>

                <Link
                  to="/community"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isCurrentPath('/community')
                      ? 'bg-emerald-600 text-white font-extrabold shadow-md'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <MessageSquare className="h-5 w-5 text-emerald-400" />
                  <span>Community Hub</span>
                </Link>

                <Link
                  to="/workspaces"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isCurrentPath('/workspaces')
                      ? 'bg-primary-600 text-white font-extrabold shadow-md'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Briefcase className="h-5 w-5 text-sky-400" />
                  <span>Workspaces</span>
                </Link>

                {isAdmin && (
                  <Link
                    to="/admin/dashboard"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-primary-200 bg-primary-950/70 font-bold border border-primary-800/60 hover:bg-primary-900/60 transition-all"
                  >
                    <ShieldCheck className="h-5 w-5 text-primary-400" />
                    <span>Admin Portal</span>
                  </Link>
                )}

                <Link
                  to="/profile"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isCurrentPath('/profile')
                      ? 'bg-primary-600 text-white font-extrabold shadow-md'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <User className="h-5 w-5 text-slate-400" />
                  <span>My Profile</span>
                </Link>

                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsReportModalOpen(true);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 rounded-xl text-primary-300 hover:bg-primary-950/40 font-semibold transition-colors"
                >
                  <Flag className="h-5 w-5 text-primary-400" />
                  <span>Report Issue</span>
                </button>
              </nav>

              {/* Footer Sign Out */}
              {user && (
                <div className="border-t border-slate-800 pt-4">
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      handleSignOut();
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 rounded-xl text-rose-400 hover:bg-rose-950/40 font-semibold transition-colors"
                  >
                    <LogOut className="h-5 w-5 text-rose-500" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </header>
  );
}

Navbar.propTypes = {
  onMobileMenuToggle: PropTypes.func,
};
