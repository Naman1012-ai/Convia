import React, { createContext, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { authService } from '../services/authService';
import { dashboardService } from '../services/dashboardService';
import { cleanupFcmOnLogout, syncWebPushToken } from '../services/fcmService';

export const AuthContext = createContext({
  user: null,
  loading: true,
  signUp: async () => {},
  signIn: async () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
  resetPassword: async () => {},
  updateCurrentUserProfile: async () => {},
  reloadUser: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = authService.onAuthChange((currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser?.uid) {
        syncWebPushToken(currentUser.uid).catch((err) => {
          console.warn('[AuthContext] Silent push token sync warning:', err?.message || err);
        });
      }
    });

    return () => unsubscribe();
  }, []);

  const signUp = useCallback(async (email, password, displayName) => {
    const newUser = await authService.signUp(email, password, displayName);
    const currentUser = authService.getCurrentUser();
    setUser(currentUser ? { ...currentUser } : newUser);
    return currentUser || newUser;
  }, []);

  const signIn = useCallback(async (email, password) => {
    const signedInUser = await authService.signIn(email, password);
    setUser(signedInUser);
    return signedInUser;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const googleUser = await authService.signInWithGoogle();
    if (googleUser) {
      const currentUser = authService.getCurrentUser();
      setUser(currentUser ? { ...currentUser } : googleUser);
    }
    return googleUser;
  }, []);

  const signOut = useCallback(async () => {
    try {
      if (user?.uid) {
        dashboardService.clearCachedDashboardData(user.uid);
      }
    } catch (e) {
      console.warn('[AuthContext] Error clearing dashboard cache on signOut:', e);
    }
    try {
      await cleanupFcmOnLogout();
    } catch (fcmErr) {
      console.warn('[AuthContext] Error cleaning up FCM on signOut:', fcmErr);
    }
    await authService.signOut();
    setUser(null);
  }, [user]);

  const resetPassword = useCallback(async (email) => {
    await authService.resetPassword(email);
  }, []);

  const updateCurrentUserProfile = useCallback(async (profileData) => {
    const updated = await authService.updateUserProfile(profileData);
    if (updated) {
      setUser({ ...updated });
    }
    return updated;
  }, []);

  const reloadUser = useCallback(async () => {
    const reloaded = await authService.reloadUser();
    if (reloaded) {
      const clone = Object.assign(Object.create(Object.getPrototypeOf(reloaded)), reloaded);
      Object.defineProperty(clone, 'emailVerified', {
        value: Boolean(reloaded.emailVerified),
        writable: true,
        configurable: true,
        enumerable: true,
      });
      setUser(clone);
      return clone;
    }
    return null;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
        resetPassword,
        updateCurrentUserProfile,
        reloadUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
