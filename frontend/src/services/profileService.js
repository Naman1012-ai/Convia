import { rtdbService } from './rtdbService';
import { getErrorMessage } from '../utils/errorMessages';

/**
 * Service Layer abstraction for User Profile management in Firebase Realtime Database.
 */
export const profileService = {
  /**
   * Check if a user profile document exists in RTDB.
   */
  profileExists: async (uid) => {
    try {
      const data = await rtdbService.getData(`users/${uid}`);
      return data !== null;
    } catch (error) {
      console.error('[profileService] profileExists error:', error);
      return false;
    }
  },

  /**
   * Automatically create a user profile in RTDB if it doesn't already exist.
   */
  createUserProfile: async (user, additionalData = {}) => {
    if (!user || !user.uid) return null;

    try {
      const adminEmail = (import.meta.env.VITE_ADMIN_EMAIL || 'admin@convia.dev').toLowerCase().trim();
      const userEmail = (user.email || '').toLowerCase().trim();
      const isAdminEmail = Boolean(adminEmail && userEmail === adminEmail);

      const exists = await profileService.profileExists(user.uid);
      if (exists) {
        // Profile already exists; update role if email matches admin email
        const existingProfile = await profileService.getUserProfile(user.uid);

        // If existing profile has missing username/displayName or has premature 'User' fallback, update it
        const incomingUsername = (additionalData?.username || '').trim().toLowerCase().replace(/^@/, '');
        const incomingName = (additionalData?.displayName || user?.displayName || incomingUsername || '').trim();
        const updates = {};

        if (
          incomingUsername &&
          incomingUsername !== 'user' &&
          (!existingProfile?.username || existingProfile.username === 'User')
        ) {
          updates.username = incomingUsername;
          existingProfile.username = incomingUsername;
        } else if (!existingProfile?.username && existingProfile?.displayName && existingProfile.displayName !== 'User') {
          // Migration: populate username from existing displayName
          updates.username = existingProfile.displayName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
          existingProfile.username = updates.username;
        }

        if (
          incomingName &&
          incomingName !== 'User' &&
          (!existingProfile?.displayName || existingProfile.displayName === 'User')
        ) {
          updates.displayName = incomingName;
          existingProfile.displayName = incomingName;
        }

        if (additionalData?.fullName && !existingProfile?.fullName) {
          updates.fullName = additionalData.fullName.trim();
          existingProfile.fullName = updates.fullName;
        }

        // If additional photoURL is provided and existing profile lacks photoURL, update it
        const incomingPhoto = (additionalData?.photoURL || user?.photoURL || '').trim();
        if (incomingPhoto && !existingProfile?.photoURL) {
          updates.photoURL = incomingPhoto;
          existingProfile.photoURL = incomingPhoto;
        }

        if (Object.keys(updates).length > 0) {
          updates.updatedAt = rtdbService.getTimestamp();
          await rtdbService.updateData(`users/${user.uid}`, updates);
        }

        // Ensure firstSignedInAt exists and is immutable
        if (!existingProfile?.firstSignedInAt) {
          const authCreatedTime = user.metadata?.creationTime ? new Date(user.metadata.creationTime).getTime() : null;
          const fallbackSignedTime = existingProfile?.firstSignedInAt || existingProfile?.createdAt || existingProfile?.joinedAt || authCreatedTime || rtdbService.getTimestamp();
          await rtdbService.updateData(`users/${user.uid}`, { firstSignedInAt: fallbackSignedTime });
          existingProfile.firstSignedInAt = fallbackSignedTime;
        }

        if (!existingProfile?.lastLoginAt) {
          const now = Date.now();
          await rtdbService.updateData(`users/${user.uid}`, { lastLoginAt: now });
          existingProfile.lastLoginAt = now;
        }

        if (isAdminEmail && (!existingProfile?.isAdmin || existingProfile?.role !== 'superadmin')) {
          await rtdbService.updateData(`users/${user.uid}`, {
            role: 'superadmin',
            isAdmin: true,
            updatedAt: rtdbService.getTimestamp(),
          });
          return { ...existingProfile, role: 'superadmin', isAdmin: true };
        }
        return existingProfile;
      }

      const platformFirstSignIn = user.metadata?.creationTime
        ? new Date(user.metadata.creationTime).getTime()
        : rtdbService.getTimestamp();

      const explicitUsername = (additionalData?.username || '').trim().toLowerCase().replace(/^@/, '');
      const explicitName = (additionalData?.displayName || user?.displayName || '').trim();
      const resolvedUsername =
        explicitUsername ||
        (explicitName && explicitName !== 'User' ? explicitName.toLowerCase().replace(/[^a-z0-9_]/g, '') : '') ||
        (isAdminEmail ? 'admin' : (user?.email ? user.email.split('@')[0] : 'user'));
      const resolvedDisplayName = explicitName || resolvedUsername;

      const profileData = {
        uid: user.uid,
        username: resolvedUsername,
        displayName: resolvedDisplayName,
        fullName: (additionalData?.fullName || '').trim() || null,
        email: user.email || '',
        photoURL: user.photoURL || additionalData.photoURL || null,
        firstSignedInAt: platformFirstSignIn,
        joinedAt: platformFirstSignIn,
        lastLoginAt: Date.now(),
        createdAt: rtdbService.getTimestamp(),
        updatedAt: rtdbService.getTimestamp(),
        organizationId: null,
        profileCompleted: false,
        primaryRole: additionalData.primaryRole || null,
        experienceLevel: additionalData.experienceLevel || null,
        onlineStatus: 'online',
        role: isAdminEmail ? 'superadmin' : 'user',
        isAdmin: isAdminEmail,
      };

      await rtdbService.setData(`users/${user.uid}`, profileData);
      return profileData;
    } catch (error) {
      console.error('[profileService] createUserProfile error:', error);
      throw new Error(getErrorMessage(error.code || 'default'));
    }
  },

  /**
   * Fetch single user profile by UID.
   */
  getUserProfile: async (uid) => {
    try {
      return await rtdbService.getData(`users/${uid}`);
    } catch (error) {
      console.error('[profileService] getUserProfile error:', error);
      throw new Error(getErrorMessage(error.code || 'default'));
    }
  },

  /**
   * Update specific user profile fields.
   */
  updateUserProfile: async (uid, data) => {
    try {
      // Strip immutable timestamps so caller cannot overwrite them
      const { firstSignedInAt, joinedAt, createdAt, ...safeData } = data || {};
      const updates = {
        ...safeData,
        updatedAt: rtdbService.getTimestamp(),
      };
      await rtdbService.updateData(`users/${uid}`, updates);

      // Real-time cascade to organization member roster:
      // If the user belongs to an organization, touch their member record
      // so all team members in that workspace receive the updated details in real-time
      const profile = await rtdbService.getData(`users/${uid}`);
      if (profile?.organizationId) {
        await rtdbService.updateData(
          `organization_members/${profile.organizationId}/${uid}`,
          {
            updatedAt: rtdbService.getTimestamp(),
          }
        ).catch(() => {});
      }
    } catch (error) {
      console.error('[profileService] updateUserProfile error:', error);
      throw new Error(getErrorMessage(error.code || 'default'));
    }
  },

  /**
   * Subscribe to real-time updates of a user's profile.
   */
  subscribeToProfile: (uid, callback) => {
    return rtdbService.subscribe(`users/${uid}`, callback);
  },

  /**
   * Setup presence tracking (`onlineStatus`) using RTDB .info/connected and onDisconnect hooks.
   */
  setupPresence: (uid) => {
    if (!uid) return () => {};

    // Setup onDisconnect hook to set onlineStatus: 'offline' when client disconnects
    rtdbService.setupDisconnect(`users/${uid}`, {
      onlineStatus: 'offline',
      updatedAt: rtdbService.getTimestamp(),
    });

    // Subscribe to connection status
    const unsubscribeConnected = rtdbService.subscribe('.info/connected', (connected) => {
      if (connected === true) {
        rtdbService.updateData(`users/${uid}`, {
          onlineStatus: 'online',
          updatedAt: rtdbService.getTimestamp(),
        });
      }
    });

    return unsubscribeConnected;
  },
};

/**
 * Helper to resolve organization with backward compatibility for legacy college field.
 */
export function resolveOrganization(profile) {
  return (profile?.organization || profile?.college || '').trim();
}
