import React, { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { profileService } from '../services/profileService';
import { useAuth } from '../hooks/useAuth';
import { resolveMemberDisplayName } from '../utils/memberIdentity';

export const UserProfileSyncContext = createContext({
  profiles: {},
  getProfile: () => null,
  resolveName: () => '',
  resolveAvatar: () => '',
  subscribeUser: () => () => {},
  subscribeUsers: () => () => {},
});

const SUBSCRIPTION_CLEANUP_GRACE_MS = 5000;

export function UserProfileSyncProvider({ children }) {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState({});

  // Registry: uid -> { count: number, callbacks: Set<Function>, unsubscribe: Function, timer: number | null, data: object | null }
  const subscriptionsRef = useRef(new Map());

  // Clean up all active listeners when authenticated session is terminated
  useEffect(() => {
    if (!user) {
      subscriptionsRef.current.forEach((entry) => {
        if (entry.timer) clearTimeout(entry.timer);
        if (typeof entry.unsubscribe === 'function') {
          try {
            entry.unsubscribe();
          } catch (e) {
            console.warn('[UserProfileSync] Cleanup error:', e);
          }
        }
      });
      subscriptionsRef.current.clear();
      setProfiles({});
    }
  }, [user]);

  /**
   * Subscribe to a single user profile with reference counting and deduplication.
   */
  const subscribeUser = useCallback((rawUid, onUpdate) => {
    if (!rawUid || typeof rawUid !== 'string' || !rawUid.trim()) {
      return () => {};
    }

    const uid = rawUid.trim();
    const registry = subscriptionsRef.current;
    let entry = registry.get(uid);

    if (entry) {
      entry.count++;
      if (entry.timer) {
        clearTimeout(entry.timer);
        entry.timer = null;
      }
      if (typeof onUpdate === 'function') {
        entry.callbacks.add(onUpdate);
        if (entry.data !== null && entry.data !== undefined) {
          try {
            onUpdate(entry.data);
          } catch (err) {
            console.warn('[UserProfileSync] onUpdate invocation failed:', err);
          }
        }
      }
    } else {
      const callbacks = new Set();
      if (typeof onUpdate === 'function') {
        callbacks.add(onUpdate);
      }

      entry = {
        count: 1,
        callbacks,
        unsubscribe: null,
        timer: null,
        data: null,
      };
      registry.set(uid, entry);

      // Start authoritative real-time RTDB/Firestore subscription
      try {
        const unsubscribeRtdb = profileService.subscribeToProfile(uid, (profileData) => {
          const currentEntry = registry.get(uid);
          if (!currentEntry) return;

          currentEntry.data = profileData;

          // Update centralized profile state
          setProfiles((prev) => {
            if (prev[uid] === profileData) return prev;
            return {
              ...prev,
              [uid]: profileData,
            };
          });

          // Dispatch to all active callbacks
          currentEntry.callbacks.forEach((cb) => {
            try {
              cb(profileData);
            } catch (err) {
              console.warn('[UserProfileSync] Callback dispatch error:', err);
            }
          });
        });

        entry.unsubscribe = unsubscribeRtdb;
      } catch (subErr) {
        console.error('[UserProfileSync] Error starting profile subscription for UID:', uid, subErr);
      }
    }

    // Return cleanup function
    return () => {
      const current = registry.get(uid);
      if (!current) return;

      if (typeof onUpdate === 'function') {
        current.callbacks.delete(onUpdate);
      }

      current.count--;

      if (current.count <= 0) {
        // Start grace period before tearing down the database listener
        if (current.timer) clearTimeout(current.timer);

        current.timer = setTimeout(() => {
          const target = registry.get(uid);
          if (target && target.count <= 0) {
            if (typeof target.unsubscribe === 'function') {
              try {
                target.unsubscribe();
              } catch (e) {
                console.warn('[UserProfileSync] Unsubscribe error for UID:', uid, e);
              }
            }
            registry.delete(uid);
          }
        }, SUBSCRIPTION_CLEANUP_GRACE_MS);
      }
    };
  }, []);

  /**
   * Batch subscribe to an array of UIDs.
   */
  const subscribeUsers = useCallback(
    (uids = []) => {
      if (!Array.isArray(uids) || uids.length === 0) return () => {};

      const cleanUids = Array.from(new Set(uids.filter((u) => u && typeof u === 'string' && u.trim()).map((u) => u.trim())));
      const unsubs = cleanUids.map((uid) => subscribeUser(uid));

      return () => {
        unsubs.forEach((unsub) => {
          try {
            unsub();
          } catch (e) {
            console.warn('[UserProfileSync] Batch unsub error:', e);
          }
        });
      };
    },
    [subscribeUser]
  );

  /**
   * Synchronous profile getter from cache.
   */
  const getProfile = useCallback(
    (uid) => {
      if (!uid) return null;
      return profiles[uid] || null;
    },
    [profiles]
  );

  /**
   * Helper: Resolves presentation display name.
   */
  const resolveName = useCallback(
    (uid, fallbackName = 'Member') => {
      if (!uid) return fallbackName;
      const profile = profiles[uid];
      if (profile) {
        const resolved = resolveMemberDisplayName(profile);
        if (resolved && resolved.trim()) return resolved.trim();
      }
      return fallbackName || 'Member';
    },
    [profiles]
  );

  /**
   * Helper: Resolves avatar/photoURL.
   */
  const resolveAvatar = useCallback(
    (uid, fallbackAvatar = '') => {
      if (!uid) return fallbackAvatar;
      const profile = profiles[uid];
      if (profile) {
        const photo = profile.photoURL || profile.avatar;
        if (photo && typeof photo === 'string' && photo.trim()) return photo.trim();
      }
      return fallbackAvatar || '';
    },
    [profiles]
  );

  const contextValue = useMemo(
    () => ({
      profiles,
      getProfile,
      resolveName,
      resolveAvatar,
      subscribeUser,
      subscribeUsers,
    }),
    [profiles, getProfile, resolveName, resolveAvatar, subscribeUser, subscribeUsers]
  );

  return (
    <UserProfileSyncContext.Provider value={contextValue}>
      {children}
    </UserProfileSyncContext.Provider>
  );
}

UserProfileSyncProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export function useUserProfileSync() {
  const context = useContext(UserProfileSyncContext);
  if (!context) {
    throw new Error('useUserProfileSync must be used within a UserProfileSyncProvider');
  }
  return context;
}
