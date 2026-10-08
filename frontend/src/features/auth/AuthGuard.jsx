import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useUser } from '../../hooks/useUser';
import { Spinner } from '../../components/feedback/Spinner';

/**
 * Route Guard for protected pages. Redirects unauthenticated users to /signin,
 * and redirects users with incomplete profiles to /setup-profile.
 */
export function AuthGuard({ children }) {
  const { user, loading } = useAuth();
  const { userProfile, loadingProfile } = useUser();
  const location = useLocation();

  if (loading || (user && loadingProfile)) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/signin?returnUrl=${returnUrl}`} replace />;
  }

  // If new user profile is not completed, redirect to /setup-profile
  if (
    userProfile &&
    userProfile.profileCompleted === false &&
    location.pathname !== '/setup-profile' &&
    location.pathname !== '/join'
  ) {
    return <Navigate to="/setup-profile" replace />;
  }

  return children ? children : <Outlet />;
}
