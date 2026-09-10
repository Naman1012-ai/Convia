import React, { useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useUserProfileSync } from '../contexts/UserProfileSyncContext';
import { useAuth } from './useAuth';
import { useUser } from './useUser';
import { resolveMemberDisplayName } from '../utils/memberIdentity';
import { Avatar } from '../components/ui/Avatar';

/**
 * Hook to resolve and subscribe to a single user profile in real-time.
 * Automatically deduplicates listeners across components.
 */
export function useUserProfile(uid, options = {}) {
  const { fallbackName = 'Member', fallbackAvatar = '', subscribe = true } = options;
  const { user } = useAuth();
  const { userProfile: currentUserProfile } = useUser();
  const { getProfile, subscribeUser } = useUserProfileSync();

  const isCurrentUser = Boolean(user && uid && user.uid === uid);
  const cachedProfile = getProfile(uid);

  // If this is the current user, use the live UserContext profile directly
  const profile = isCurrentUser
    ? (currentUserProfile || cachedProfile)
    : cachedProfile;

  useEffect(() => {
    if (!uid || typeof uid !== 'string' || !uid.trim()) return;
    // Current user already has an active listener in UserContext
    if (isCurrentUser) return;
    // When subscribe is explicitly false, do not create an RTDB subscription (use in-memory cache only)
    if (subscribe === false) return;

    const unsub = subscribeUser(uid);
    return unsub;
  }, [uid, isCurrentUser, subscribe, subscribeUser]);

  const displayName = useMemo(() => {
    if (profile) {
      const resolved = resolveMemberDisplayName(profile);
      if (resolved && resolved.trim()) return resolved.trim();
    }
    return fallbackName || 'Member';
  }, [profile, fallbackName]);

  const avatar = useMemo(() => {
    if (profile) {
      const photo = profile.photoURL || profile.avatar;
      if (photo && typeof photo === 'string' && photo.trim()) return photo.trim();
    }
    return fallbackAvatar || '';
  }, [profile, fallbackAvatar]);

  return {
    profile,
    displayName,
    avatar,
    photoURL: avatar,
    isLoaded: Boolean(profile || isCurrentUser),
  };
}

/**
 * Hook to batch subscribe to a list of UIDs in real-time.
 */
export function useUserProfiles(uids = []) {
  const { profiles, getProfile, resolveName, resolveAvatar, subscribeUsers } = useUserProfileSync();

  const validUids = useMemo(() => {
    if (!Array.isArray(uids)) return [];
    return Array.from(new Set(uids.filter((u) => u && typeof u === 'string' && u.trim()).map((u) => u.trim())));
  }, [uids]);

  useEffect(() => {
    if (validUids.length === 0) return;
    const unsub = subscribeUsers(validUids);
    return unsub;
  }, [validUids, subscribeUsers]);

  return {
    profiles,
    getProfile,
    resolveName,
    resolveAvatar,
  };
}

/**
 * Reusable UserIdentity Component for live display name rendering.
 */
export function UserIdentity({ uid, fallback = 'Member', className = '' }) {
  const { displayName } = useUserProfile(uid, { fallbackName: fallback });
  return React.createElement('span', { className }, displayName);
}

UserIdentity.propTypes = {
  uid: PropTypes.string,
  fallback: PropTypes.string,
  className: PropTypes.string,
};

/**
 * Reusable UserAvatar Component for live avatar rendering.
 */
export function UserAvatar({ uid, fallbackName = 'Member', fallbackAvatar = '', size = 'sm', className = '' }) {
  const { displayName } = useUserProfile(uid, { fallbackName, fallbackAvatar });
  return React.createElement(Avatar, { name: displayName, size, className });
}

UserAvatar.propTypes = {
  uid: PropTypes.string,
  fallbackName: PropTypes.string,
  fallbackAvatar: PropTypes.string,
  size: PropTypes.string,
  className: PropTypes.string,
};
