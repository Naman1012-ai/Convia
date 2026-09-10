import React, { createContext, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { authService } from '../services/authService';
import { dashboardService } from '../services/dashboardService';

export const AuthContext = createContext({
  user: null,
  loading: true,
  signUp: async () => {},
  signIn: async () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
  resetPassword: async () => {},
  updateCurrentUserProfile: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = authService.onAuthChange((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signUp = useCallback(async (email, password, displayName) => {
    const newUser = await authService.signUp(email, password, displayName);
    setUser(newUser);
    return newUser;
  }, []);

  const signIn = useCallback(async (email, password) => {
    const signedInUser = await authService.signIn(email, password);
    setUser(signedInUser);
    return signedInUser;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const googleUser = await authService.signInWithGoogle();
    if (googleUser) {
      setUser(googleUser);
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
