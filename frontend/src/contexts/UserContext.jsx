import React, { createContext, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../hooks/useAuth';
import { profileService } from '../services/profileService';

export const UserContext = createContext({
  userProfile: null,
  loadingProfile: true,
  updateProfile: async () => {},
});

export function UserProvider({ children }) {
  const { user, loading: authLoading, updateCurrentUserProfile } = useAuth();
  const [userProfile, setUserProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setUserProfile(null);
      setLoadingProfile(false);
      return;
    }

    let unsubscribeProfile = () => {};
    let unsubscribePresence = () => {};

    const initProfile = async () => {
      try {
        // Ensure profile node exists in RTDB
        await profileService.createUserProfile(user);

        // Setup presence tracking
        unsubscribePresence = profileService.setupPresence(user.uid);

        // Subscribe to real-time profile node updates
        unsubscribeProfile = profileService.subscribeToProfile(user.uid, (profileData) => {
          setUserProfile(profileData);
          setLoadingProfile(false);
        });
      } catch (err) {
        console.error('[UserContext] Error initializing profile:', err);
        setLoadingProfile(false);
      }
    };

    initProfile();

    return () => {
      unsubscribeProfile();
      unsubscribePresence();
    };
  }, [user, authLoading]);

  const updateProfile = useCallback(
    async (data) => {
      if (!user) return;
      // 1. Update RTDB profile node
      await profileService.updateUserProfile(user.uid, data);

      // 2. Sync to Firebase Auth if displayName or photoURL is modified
      if (data.displayName !== undefined || data.photoURL !== undefined) {
        if (typeof updateCurrentUserProfile === 'function') {
          await updateCurrentUserProfile({
            displayName: data.displayName,
            photoURL: data.photoURL,
          }).catch((err) => console.warn('[UserContext] auth update error:', err));
        }
      }

      // 3. Update local state immediately for zero-lag reactivity
      setUserProfile((prev) => (prev ? { ...prev, ...data } : data));
    },
    [user, updateCurrentUserProfile]
  );

  return (
    <UserContext.Provider value={{ userProfile, loadingProfile, updateProfile }}>
      {children}
    </UserContext.Provider>
  );
}

UserProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
