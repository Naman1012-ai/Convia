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
        await profileService.createUserProfile(user, {
          displayName: user.displayName || undefined,
          photoURL: user.photoURL || undefined,
        });

        // Setup presence tracking
        unsubscribePresence = profileService.setupPresence(user.uid);

        // Subscribe to real-time profile node updates
        unsubscribeProfile = profileService.subscribeToProfile(user.uid, (profileData) => {
          if (profileData) {
            // Safely synchronize RTDB email with canonical Firebase Auth email if they diverge
            if (user.email && profileData.email !== user.email) {
              profileService.updateUserProfile(user.uid, { email: user.email }).catch((err) => {
                console.warn('[UserContext] Failed to sync canonical email to RTDB:', err);
              });
            }

            // Safely synchronize RTDB username / displayName if missing or 'User' but Auth has valid name
            const authDisplayName = user.displayName?.trim();
            if (
              authDisplayName &&
              authDisplayName !== 'User' &&
              ((!profileData.username || profileData.username === 'User') || (!profileData.displayName || profileData.displayName === 'User'))
            ) {
              const syncUpdates = {};
              if (!profileData.username || profileData.username === 'User') {
                syncUpdates.username = authDisplayName;
              }
              if (!profileData.displayName || profileData.displayName === 'User') {
                syncUpdates.displayName = authDisplayName;
              }
              profileService.updateUserProfile(user.uid, syncUpdates).catch((err) => {
                console.warn('[UserContext] Failed to sync canonical name to RTDB:', err);
              });
            }

            const resolvedUsername =
              (profileData.username && profileData.username !== 'User')
                ? profileData.username
                : (profileData.displayName && profileData.displayName !== 'User')
                ? profileData.displayName
                : (authDisplayName && authDisplayName !== 'User')
                ? authDisplayName
                : (profileData.username || profileData.displayName || authDisplayName || (user.email ? user.email.split('@')[0] : 'User'));

            const resolvedDisplayName =
              (profileData.displayName && profileData.displayName !== 'User')
                ? profileData.displayName
                : (resolvedUsername && resolvedUsername !== 'User')
                ? resolvedUsername
                : (authDisplayName && authDisplayName !== 'User')
                ? authDisplayName
                : (profileData.displayName || authDisplayName || (user.email ? user.email.split('@')[0] : 'User'));

            setUserProfile({
              ...profileData,
              username: resolvedUsername,
              displayName: resolvedDisplayName,
              email: user.email || profileData.email,
            });
          } else {
            setUserProfile(null);
          }
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
      // 1. Maintain username & displayName lockstep
      const syncData = { ...data };
      if (syncData.username !== undefined && syncData.displayName === undefined) {
        syncData.displayName = syncData.username;
      } else if (syncData.displayName !== undefined && syncData.username === undefined) {
        syncData.username = syncData.displayName;
      }

      // 2. Update RTDB profile node
      await profileService.updateUserProfile(user.uid, syncData);

      // 3. Sync to Firebase Auth if displayName or photoURL is modified
      const authDisplayName = syncData.displayName || syncData.username;
      if (authDisplayName !== undefined || syncData.photoURL !== undefined) {
        if (typeof updateCurrentUserProfile === 'function') {
          await updateCurrentUserProfile({
            ...(authDisplayName !== undefined ? { displayName: authDisplayName } : {}),
            ...(syncData.photoURL !== undefined ? { photoURL: syncData.photoURL } : {}),
          }).catch((err) => console.warn('[UserContext] auth update error:', err));
        }
      }

      // 4. Update local state immediately for zero-lag reactivity
      setUserProfile((prev) => (prev ? { ...prev, ...syncData } : syncData));
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
