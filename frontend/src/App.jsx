import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { UserProvider } from './contexts/UserContext';
import { UserProfileSyncProvider } from './contexts/UserProfileSyncContext';
import { ToastProvider } from './contexts/ToastContext';
import { PlatformSettingsProvider } from './contexts/PlatformSettingsContext';
import { AuthLayout } from './layouts/AuthLayout';
import { AppLayout } from './layouts/AppLayout';
import { OrgLayout } from './layouts/OrgLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { AuthGuard } from './features/auth/AuthGuard';
import { PublicOnlyGuard } from './features/auth/PublicOnlyGuard';
import { AdminGuard } from './features/admin/AdminGuard';
import { Spinner } from './components/feedback/Spinner';
import { ErrorBoundary } from './components/feedback/ErrorBoundary';

/**
 * RouteCleanup: Resets body overflow and transient global UI side effects on navigation.
 */
function RouteCleanup() {
  const location = useLocation();

  useEffect(() => {
    document.body.style.overflow = '';
  }, [location.pathname]);

  return null;
}

// Route Code Splitting (Lazy Loading)
const LandingPage = lazy(() => import('./landing/pages/LandingPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/legal/PrivacyPolicyPage'));
const TermsOfServicePage = lazy(() => import('./pages/legal/TermsOfServicePage'));
const ContactEngineeringPage = lazy(() => import('./pages/legal/ContactEngineeringPage'));
const SignUpPage = lazy(() => import('./pages/auth/SignUpPage'));
const SignInPage = lazy(() => import('./pages/auth/SignInPage'));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const ExploreIdeasPage = lazy(() => import('./pages/explore/ExploreIdeasPage'));
const WorkspacesPage = lazy(() => import('./pages/organization/WorkspacesPage'));
const ProfilePage = lazy(() => import('./pages/profile/ProfilePage'));
const OrgDashboardPage = lazy(() => import('./pages/organization/OrgDashboardPage'));
const IdeaBoardPage = lazy(() => import('./pages/organization/IdeaBoardPage'));
const IdeaDetailPage = lazy(() => import('./pages/organization/IdeaDetailPage'));
const BlueprintPage = lazy(() => import('./pages/organization/BlueprintPage'));
const TaskBoardPage = lazy(() => import('./pages/organization/TaskBoardPage'));
const ProgressDashboardPage = lazy(() => import('./pages/organization/ProgressDashboardPage'));
const MembersPage = lazy(() => import('./pages/organization/MembersPage'));
const WorkspaceChatPage = lazy(() => import('./pages/organization/WorkspaceChatPage'));
const WorkspaceActivityPage = lazy(() => import('./pages/organization/WorkspaceActivityPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const SettingsPage = lazy(() => import('./pages/organization/SettingsPage'));

// Admin Pages
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminUserDetailPage = lazy(() => import('./pages/admin/AdminUserDetailPage'));
const AdminWorkspacesPage = lazy(() => import('./pages/admin/AdminWorkspacesPage'));
const AdminWorkspaceDetailPage = lazy(() => import('./pages/admin/AdminWorkspaceDetailPage'));
const AdminIdeasPage = lazy(() => import('./pages/admin/AdminIdeasPage'));
const AdminIdeaDetailPage = lazy(() => import('./pages/admin/AdminIdeaDetailPage'));
const AdminMvpPage = lazy(() => import('./pages/admin/AdminMvpPage'));
const AdminReportsPage = lazy(() => import('./pages/admin/AdminReportsPage'));
const AdminReportDetailPage = lazy(() => import('./pages/admin/AdminReportDetailPage'));
const AdminModerationPage = lazy(() => import('./pages/admin/AdminModerationPage'));
const AdminAnalyticsPage = lazy(() => import('./pages/admin/AdminAnalyticsPage'));
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage'));
const AdminAuditPage = lazy(() => import('./pages/admin/AdminAuditPage'));
const AdminRolesPage = lazy(() => import('./pages/admin/AdminRolesPage'));
const AdminSecurityPage = lazy(() => import('./pages/admin/AdminSecurityPage'));
const AdminOperationsPage = lazy(() => import('./pages/admin/AdminOperationsPage'));
const AdminAnnouncementsPage = lazy(() => import('./pages/admin/AdminAnnouncementsPage'));

export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <UserProvider>
          <UserProfileSyncProvider>
            <PlatformSettingsProvider>
              <BrowserRouter>
                <RouteCleanup />
                <Suspense
            fallback={
              <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
                <Spinner size="lg" />
              </div>
            }
          >
            <Routes>
              {/* Landing Page */}
              <Route path="/" element={<LandingPage />} />

              {/* Public Legal & Support Routes */}
              <Route path="/privacy" element={<PrivacyPolicyPage />} />
              <Route path="/terms" element={<TermsOfServicePage />} />
              <Route path="/contact" element={<ContactEngineeringPage />} />

              {/* Public-Only Auth Routes */}
              <Route element={<PublicOnlyGuard />}>
                <Route element={<AuthLayout />}>
                  <Route path="/signup" element={<SignUpPage />} />
                  <Route path="/signin" element={<SignInPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                </Route>
              </Route>

              {/* Authenticated Protected Routes */}
              <Route element={<AuthGuard />}>
                <Route element={<AppLayout />}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/explore" element={<ExploreIdeasPage />} />
                  <Route path="/workspaces" element={<WorkspacesPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                </Route>

                {/* Organization/Workspace-Scoped Routes */}
                <Route path="/org/:orgId" element={<ErrorBoundary><OrgLayout /></ErrorBoundary>}>
                  <Route index element={<OrgDashboardPage />} />
                  <Route path="ideas" element={<IdeaBoardPage />} />
                  <Route path="ideas/:ideaId">
                    <Route index element={<IdeaDetailPage />} />
                    <Route path="blueprint" element={<BlueprintPage />} />
                    <Route path="tasks" element={<TaskBoardPage />} />
                    <Route path="dashboard" element={<ProgressDashboardPage />} />
                  </Route>
                  <Route path="tasks" element={<TaskBoardPage />} />
                  <Route path="members" element={<MembersPage />} />
                  <Route path="chat" element={<WorkspaceChatPage />} />
                  <Route path="activity" element={<WorkspaceActivityPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>

                <Route path="/workspaces/:orgId" element={<ErrorBoundary><OrgLayout /></ErrorBoundary>}>
                  <Route index element={<OrgDashboardPage />} />
                  <Route path="ideas" element={<IdeaBoardPage />} />
                  <Route path="ideas/:ideaId">
                    <Route index element={<IdeaDetailPage />} />
                    <Route path="blueprint" element={<BlueprintPage />} />
                    <Route path="tasks" element={<TaskBoardPage />} />
                    <Route path="dashboard" element={<ProgressDashboardPage />} />
                  </Route>
                  <Route path="tasks" element={<TaskBoardPage />} />
                  <Route path="members" element={<MembersPage />} />
                  <Route path="chat" element={<WorkspaceChatPage />} />
                  <Route path="activity" element={<WorkspaceActivityPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>

                {/* Admin Portal Protected Routes */}
                <Route path="/admin" element={<ErrorBoundary><AdminGuard /></ErrorBoundary>}>
                  <Route element={<AdminLayout />}>
                    <Route index element={<Navigate to="/admin/dashboard" replace />} />
                    <Route path="dashboard" element={<AdminDashboardPage />} />
                    <Route path="users" element={<AdminUsersPage />} />
                    <Route path="users/:userId" element={<AdminUserDetailPage />} />
                    <Route path="workspaces" element={<AdminWorkspacesPage />} />
                    <Route path="workspaces/:workspaceId" element={<AdminWorkspaceDetailPage />} />
                    <Route path="ideas" element={<AdminIdeasPage />} />
                    <Route path="ideas/:ideaId" element={<AdminIdeaDetailPage />} />
                    <Route path="mvp" element={<AdminMvpPage />} />
                    <Route path="reports" element={<AdminReportsPage />} />
                    <Route path="reports/:reportId" element={<AdminReportDetailPage />} />
                    <Route path="moderation" element={<AdminModerationPage />} />
                    <Route path="moderation/queue" element={<AdminModerationPage />} />
                    <Route path="moderation/history" element={<AdminModerationPage />} />
                    <Route path="analytics" element={<AdminAnalyticsPage />} />
                    <Route path="analytics/*" element={<AdminAnalyticsPage />} />
                    <Route path="settings" element={<AdminSettingsPage />} />
                    <Route path="settings/*" element={<AdminSettingsPage />} />
                    <Route path="audit" element={<AdminAuditPage />} />
                    <Route path="audit/:logId" element={<AdminAuditPage />} />
                    <Route path="roles" element={<AdminRolesPage />} />
                    <Route path="roles/:roleId" element={<AdminRolesPage />} />
                    <Route path="permissions" element={<AdminRolesPage />} />
                    <Route path="security" element={<AdminSecurityPage />} />
                    <Route path="security/*" element={<AdminSecurityPage />} />
                    <Route path="operations" element={<AdminOperationsPage />} />
                    <Route path="announcements" element={<AdminAnnouncementsPage />} />
                    <Route path="notifications" element={<AdminOperationsPage />} />
                    <Route path="system-health" element={<AdminOperationsPage />} />
                    <Route path="releases" element={<AdminOperationsPage />} />
                    <Route path="feature-rollout" element={<AdminOperationsPage />} />
                    <Route path="maintenance" element={<AdminOperationsPage />} />
                    <Route path="production" element={<AdminOperationsPage />} />
                  </Route>
                </Route>
              </Route>

              {/* 404 Fallback */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </PlatformSettingsProvider>
    </UserProfileSyncProvider>
  </UserProvider>
</AuthProvider>
</ToastProvider>
  );
}

export default App;
