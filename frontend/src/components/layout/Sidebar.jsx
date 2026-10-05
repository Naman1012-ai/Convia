import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useParams, useLocation } from 'react-router-dom';
import PropTypes from 'prop-types';
import {
  Lightbulb,
  FileText,
  CheckSquare,
  Users,
  ArrowLeft,
  Settings,
  Home,
  LayoutDashboard,
  MessageSquare,
  Activity,
  Compass,
  Globe,
  Briefcase,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { useAuth } from '../../hooks/useAuth';
import { chatService } from '../../services/chatService';
import { useSidebarCollapse } from '../../hooks/useSidebarCollapse';

/**
 * Context-aware sidebar navigation for Convia.
 *
 * Two modes:
 * 1. Global mode (mode="global") — Dashboard, Explore Ideas, Community Hub, Workspaces.
 * 2. Workspace mode (mode="workspace", default) — Return to Home, Dashboard, Idea Board,
 *    Activity, Chat, Members, Settings.
 *
 * When inside a specific idea, shows idea-specific navigation with "Back to Workspace".
 * Supports smooth desktop rail collapse/expand with accessible tooltips and persisted state.
 */
export function Sidebar({
  mode = 'workspace',
  status: _status = 'ideation',
  isMobileOpen = false,
  onCloseMobile = () => {},
  isCollapsed: propIsCollapsed,
  onToggleCollapse: propOnToggleCollapse,
}) {
  const { orgId, ideaId } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const [hasUnreadChat, setHasUnreadChat] = useState(false);

  // Persistent collapse state
  const [storedIsCollapsed, toggleStoredCollapse] = useSidebarCollapse(
    'convia_sidebar_main_collapsed',
    false
  );

  const isCollapsed = propIsCollapsed !== undefined ? propIsCollapsed : storedIsCollapsed;
  const handleToggleCollapse = propOnToggleCollapse || toggleStoredCollapse;

  // Auto-close mobile drawer on route transition
  useEffect(() => {
    if (isMobileOpen) {
      onCloseMobile();
    }
  }, [location.pathname]);

  const isIdeaActive = Boolean(ideaId) && Boolean(orgId);
  const isWorkspaceMode = mode === 'workspace' && Boolean(orgId);

  // Subscribe to channel unread state (workspace mode only)
  useEffect(() => {
    if (!isWorkspaceMode || !orgId || !user?.uid) {
      setHasUnreadChat(false);
      return;
    }

    let lastMessageAt = 0;
    let lastReadAt = 0;

    const checkUnread = () => {
      setHasUnreadChat(Boolean(lastMessageAt > 0 && lastMessageAt > lastReadAt));
    };

    const unsubMeta = chatService.subscribeToChannelMetadata(orgId, 'general', (meta) => {
      lastMessageAt = meta?.lastMessageAt || 0;
      checkUnread();
    });

    const unsubRead = chatService.subscribeToReadState(orgId, 'general', user.uid, (state) => {
      lastReadAt = state?.lastReadAt || 0;
      checkUnread();
    });

    return () => {
      unsubMeta();
      unsubRead();
    };
  }, [isWorkspaceMode, orgId, user?.uid]);

  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileOpen]);

  // --- Navigation Items ---
  let navItems = [];
  let backLink = null;

  if (!isWorkspaceMode) {
    // Global navigation mode
    navItems = [
      {
        to: '/dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        end: true,
      },
      {
        to: '/explore',
        label: 'Explore Ideas',
        icon: Compass,
      },
      {
        to: '/community',
        label: 'Community Hub',
        icon: Globe,
      },
      {
        to: '/workspaces',
        label: 'Workspaces',
        icon: Briefcase,
      },
    ];
  } else if (isIdeaActive) {
    // Idea-specific navigation within a workspace
    navItems = [
      {
        to: `/workspaces/${orgId}/ideas/${ideaId}`,
        label: 'Idea Overview',
        icon: Home,
      },
      {
        to: `/workspaces/${orgId}/ideas/${ideaId}/blueprint`,
        label: 'Blueprint',
        icon: FileText,
      },
      {
        to: `/workspaces/${orgId}/ideas/${ideaId}/tasks`,
        label: 'Tasks',
        icon: CheckSquare,
      },
      {
        to: `/workspaces/${orgId}/ideas/${ideaId}/dashboard`,
        label: 'Progress',
        icon: LayoutDashboard,
      },
      {
        to: `/workspaces/${orgId}/chat`,
        label: 'Team Chat',
        icon: MessageSquare,
        hasBadge: hasUnreadChat,
      },
      {
        to: `/workspaces/${orgId}/activity`,
        label: 'Activity',
        icon: Activity,
      },
    ];
    backLink = {
      to: `/workspaces/${orgId}`,
      label: 'Back to Workspace',
    };
  } else {
    // Workspace navigation mode
    navItems = [
      {
        to: `/workspaces/${orgId}`,
        end: true,
        label: 'Dashboard',
        icon: LayoutDashboard,
      },
      {
        to: `/workspaces/${orgId}/ideas`,
        label: 'Idea Board',
        icon: Lightbulb,
      },
      {
        to: `/workspaces/${orgId}/activity`,
        label: 'Activity',
        icon: Activity,
      },
      {
        to: `/workspaces/${orgId}/chat`,
        label: 'Chat',
        icon: MessageSquare,
        hasBadge: hasUnreadChat,
      },
      {
        to: `/workspaces/${orgId}/members`,
        label: 'Members',
        icon: Users,
      },
      {
        to: `/workspaces/${orgId}/settings`,
        label: 'Settings',
        icon: Settings,
      },
    ];
    backLink = {
      to: '/dashboard',
      label: 'Return to Home',
    };
  }

  const renderContent = (collapsed = false) => (
    <div
      className={cn(
        'flex h-full flex-col justify-between bg-slate-900 text-slate-300 transition-all duration-200 select-none',
        collapsed ? 'p-2' : 'p-4'
      )}
    >
      <div className="space-y-4">
        {/* Sidebar Header & Toggle */}
        <div
          className={cn(
            'flex items-center pb-3 border-b border-slate-800 transition-all',
            collapsed ? 'justify-center' : 'justify-between px-1'
          )}
        >
          {!collapsed && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 truncate">
              {isWorkspaceMode ? (isIdeaActive ? 'Idea' : 'Workspace') : 'Navigation'}
            </span>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (isMobileOpen) {
                onCloseMobile();
              } else {
                handleToggleCollapse();
              }
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-primary-500 relative flex items-center justify-center shrink-0 w-8 h-8"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
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

        {/* Back / Return link (workspace and idea modes only) */}
        {backLink && (
          <div>
            {!collapsed ? (
              <NavLink
                to={backLink.to}
                onClick={onCloseMobile}
                className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-slate-800"
                title={backLink.label}
              >
                <ArrowLeft className="h-4 w-4 shrink-0" />
                <span className="truncate">{backLink.label}</span>
              </NavLink>
            ) : (
              <div className="relative group flex justify-center">
                <NavLink
                  to={backLink.to}
                  onClick={onCloseMobile}
                  className="flex items-center justify-center p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  title={backLink.label}
                  aria-label={backLink.label}
                >
                  <ArrowLeft className="h-4 w-4 shrink-0" />
                </NavLink>
                {/* Floating tooltip on hover */}
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center z-50 pointer-events-none">
                  <div className="bg-slate-800 text-white text-xs font-medium px-2.5 py-1 rounded-md shadow-lg whitespace-nowrap border border-slate-700">
                    {backLink.label}
                  </div>
                </div>
              </div>
            )}
            <div className="h-px bg-slate-800 my-2" />
          </div>
        )}

        {/* Nav Links */}
        <nav className="space-y-1" aria-label="Main Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;

            if (item.isPlaceholder) {
              if (collapsed) {
                return (
                  <div key={item.to} className="relative group flex justify-center">
                    <div
                      className="flex items-center justify-center rounded-lg p-2.5 text-sm font-medium text-slate-600 cursor-not-allowed"
                      title={`${item.label} (Coming Soon)`}
                      aria-label={`${item.label} (Coming Soon)`}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                    </div>
                    <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center z-50 pointer-events-none">
                      <div className="bg-slate-800 text-slate-400 text-xs font-medium px-2.5 py-1 rounded-md shadow-lg whitespace-nowrap border border-slate-700">
                        {item.label} (Soon)
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={item.to}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 cursor-not-allowed group transition-colors hover:bg-slate-800/40"
                  title={`${item.label} (Coming Soon)`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 shrink-0 text-slate-500" />
                    <span>{item.label}</span>
                  </div>
                  <span className="text-[9px] font-extrabold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded uppercase tracking-widest">
                    Soon
                  </span>
                </div>
              );
            }

            if (collapsed) {
              return (
                <div key={item.to} className="relative group flex justify-center">
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onCloseMobile}
                    title={item.label}
                    aria-label={item.label}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center justify-center rounded-lg p-2.5 text-sm font-medium transition-colors relative',
                        isActive
                          ? 'bg-primary-600 text-white shadow-sm font-semibold'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      )
                    }
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {item.hasBadge && (
                      <span
                        className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-slate-900"
                        title="Unread messages"
                      />
                    )}
                  </NavLink>
                  {/* Floating tooltip on hover */}
                  <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center z-50 pointer-events-none">
                    <div className="bg-slate-800 text-white text-xs font-medium px-2.5 py-1 rounded-md shadow-lg whitespace-nowrap border border-slate-700 flex items-center gap-1.5">
                      <span>{item.label}</span>
                      {item.hasBadge && (
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  cn(
                    'flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary-600 text-white shadow-sm font-semibold'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  )
                }
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.hasBadge && (
                  <span
                    className="h-2 w-2 rounded-full bg-rose-500 ring-2 ring-slate-900 shrink-0"
                    title="Unread messages"
                  />
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {!collapsed ? (
        <div className="text-[10px] text-slate-500 text-center font-mono">
          Convia &copy; {new Date().getFullYear()}
        </div>
      ) : (
        <div
          className="text-[10px] text-slate-600 text-center font-mono select-none"
          title={`Convia © ${new Date().getFullYear()}`}
        >
          &copy;
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Collapsible Sidebar */}
      <aside
        id="convia-sidebar"
        className={cn(
          'hidden shrink-0 border-r border-slate-800 sm:block transition-all duration-200 ease-in-out',
          isCollapsed ? 'w-16' : 'w-64'
        )}
      >
        {renderContent(isCollapsed)}
      </aside>

      {/* Mobile Drawer Sidebar - Portaled to document.body (Always expanded overlay) */}
      {isMobileOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex sm:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation drawer"
          >
            <div
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity duration-200 ease-in-out motion-reduce:transition-none"
              onClick={(e) => {
                e.stopPropagation();
                onCloseMobile();
              }}
              aria-hidden="true"
            />
            <div className="relative flex w-64 max-w-xs flex-1 flex-col bg-slate-900 border-r border-slate-800 pt-5 pb-4 shadow-2xl z-[99999] transition-transform duration-200 ease-in-out motion-reduce:transition-none">
              {renderContent(false)}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

Sidebar.propTypes = {
  mode: PropTypes.string,
  status: PropTypes.string,
  isMobileOpen: PropTypes.bool,
  onCloseMobile: PropTypes.func,
  isCollapsed: PropTypes.bool,
  onToggleCollapse: PropTypes.func,
};
