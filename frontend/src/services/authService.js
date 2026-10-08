import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  sendEmailVerification as firebaseSendEmailVerification,
  updateEmail as firebaseUpdateEmail,
  verifyBeforeUpdateEmail as firebaseVerifyBeforeUpdateEmail,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updateProfile,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';
import { getErrorMessage } from '../utils/errorMessages';
import { rtdbService } from './rtdbService';
import { orgService } from './orgService';
import { profileService } from './profileService';
import { apiClient } from './apiClient';

/**
 * Service Layer abstraction for Firebase Authentication.
 * No component should import from 'firebase/auth' directly.
 */
export const authService = {
  /**
   * Register a new user with email, password, and public username.
   */
  signUp: async (email, password, username) => {
    try {
      const sanitizedUsername = typeof username === 'string' ? username.trim().toLowerCase().replace(/^@/, '') : '';
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      // 1. Immediately update Firebase Auth displayName with the public username
      if (sanitizedUsername) {
        await updateProfile(userCredential.user, { displayName: sanitizedUsername });
      }

      // 2. Immediately ensure canonical profile is created in RTDB with the exact username
      if (userCredential?.user?.uid) {
        await profileService.createUserProfile(userCredential.user, {
          username: sanitizedUsername,
          displayName: sanitizedUsername,
        }).catch((profileErr) => {
          console.warn('[authService] Error initializing profile in signUp:', profileErr);
        });

        // If profile was provisioned concurrently, ensure RTDB has the exact username and synchronized displayName
        if (sanitizedUsername) {
          await rtdbService.updateData(`users/${userCredential.user.uid}`, {
            username: sanitizedUsername,
            displayName: sanitizedUsername,
            updatedAt: rtdbService.getTimestamp(),
          }).catch(() => {});
        }
      }

      // 3. Send verification email on sign up
      await authService.sendVerificationEmail().catch(() => {});

      // 4. Force reload user so auth.currentUser contains updated displayName
      await userCredential.user.reload().catch(() => {});
      return auth.currentUser || userCredential.user;
    } catch (error) {
      throw new Error(getErrorMessage(error.code));
    }
  },

  /**
   * Sign in an existing user with email and password.
   */
  signIn: async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      if (userCredential?.user?.uid) {
        const now = Date.now();
        await rtdbService.updateData(`users/${userCredential.user.uid}`, {
          lastLoginAt: now,
          updatedAt: now,
        }).catch((err) => console.warn('[authService] Failed to persist lastLoginAt:', err.message));
      }
      return userCredential.user;
    } catch (error) {
      throw new Error(getErrorMessage(error.code));
    }
  },

  /**
   * Sign in or register with Google OAuth Popup.
   */
  signInWithGoogle: async () => {
    try {
      const userCredential = await signInWithPopup(auth, googleProvider);
      if (userCredential?.user?.uid) {
        const now = Date.now();
        const googleUser = userCredential.user;
        const googleDisplayName = (googleUser.displayName || '').trim();
        const googlePhotoURL = googleUser.photoURL || null;

        // Ensure profile exists in RTDB and is synced with Google credentials
        await profileService.createUserProfile(googleUser, {
          ...(googleDisplayName ? { displayName: googleDisplayName } : {}),
          ...(googlePhotoURL ? { photoURL: googlePhotoURL } : {}),
        }).catch((err) => console.warn('[authService] createUserProfile on Google login:', err));

        await rtdbService.updateData(`users/${googleUser.uid}`, {
          lastLoginAt: now,
          updatedAt: now,
          ...(googleDisplayName ? { displayName: googleDisplayName } : {}),
        }).catch((err) => console.warn('[authService] Failed to persist lastLoginAt on Google login:', err.message));
      }
      return userCredential ? userCredential.user : null;
    } catch (error) {
      if (error.code === 'auth/popup-closed-by-user') {
        return null;
      }
      throw new Error(getErrorMessage(error.code));
    }
  },

  /**
   * Send Firebase verification email to current user.
   */
  sendVerificationEmail: async () => {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user found.');
    try {
      await firebaseSendEmailVerification(user);
    } catch (error) {
      console.error('[authService] sendVerificationEmail error:', error);
      throw new Error(getErrorMessage(error.code));
    }
  },

  /**
   * Update Firebase Auth profile attributes (displayName, photoURL) on current user.
   */
  updateUserProfile: async ({ displayName, photoURL }) => {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user found.');
    try {
      const updateData = {};
      if (displayName !== undefined) updateData.displayName = displayName;
      if (photoURL !== undefined) updateData.photoURL = photoURL;
      await updateProfile(user, updateData);
      return auth.currentUser;
    } catch (error) {
      console.error('[authService] updateUserProfile error:', error);
      throw new Error(getErrorMessage(error.code));
    }
  },

  /**
   * Reload current user status from Firebase Auth server.
   */
  reloadUser: async () => {
    const user = auth.currentUser;
    if (!user) return null;
    try {
      await user.reload();
      await user.getIdToken(true).catch(() => {});
      return auth.currentUser;
    } catch (error) {
      console.error('[authService] reloadUser error:', error);
      return user;
    }
  },

  /**
   * Reauthenticate user using current password.
   */
  reauthenticateUser: async (password) => {
    const user = auth.currentUser;
    if (!user || !user.email) throw new Error('No authenticated user found.');
    try {
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
      return true;
    } catch (error) {
      console.error('[authService] reauthenticateUser error:', error);
      throw new Error(getErrorMessage(error.code));
    }
  },

  /**
   * Update user email address safely.
   */
  updateUserEmail: async (newEmail) => {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user found.');
    try {
      if (typeof firebaseVerifyBeforeUpdateEmail === 'function') {
        await firebaseVerifyBeforeUpdateEmail(user, newEmail);
      } else {
        await firebaseUpdateEmail(user, newEmail);
      }
    } catch (error) {
      console.error('[authService] updateUserEmail error:', error);
      throw new Error(getErrorMessage(error.code));
    }
  },

  /**
   * Send a password reset email.
   */
  sendPasswordResetEmail: async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      throw new Error(getErrorMessage(error.code));
    }
  },

  /**
   * Sign out current user.
   */
  signOut: async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      throw new Error(getErrorMessage(error.code));
    }
  },

  /**
   * Subscribe to authentication state changes.
   */
  onAuthChange: (callback) => {
    return onAuthStateChanged(auth, callback);
  },

  /**
   * Delete current user's Firebase Auth account and all associated RTDB data.
   */
  deleteUserAccount: async (password = null) => {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user found.');

    const isPasswordUser = user.providerData?.some((p) => p.providerId === 'password');

    // 1. Re-authenticate user if password user
    if (isPasswordUser) {
      if (!password || !password.trim()) {
        throw new Error('Current password is required to delete your account.');
      }
      await authService.reauthenticateUser(password.trim());
    }

    try {
      // 2. Authoritative backend deletion cascade
      return await apiClient.delete('/api/user/delete');
    } catch (error) {
      console.error('[authService] deleteUserAccount error:', error);
      if (error.code === 'ACCOUNT_DELETION_BLOCKED_BY_WORKSPACE_OWNERSHIP') {
        throw new Error(error.message || 'Account deletion is blocked because you own one or more workspaces with active team members. Please transfer ownership or remove members first.');
      }
      throw new Error(error.message || getErrorMessage(error.code || 'default'));
    }
  },

  /**
   * Get current authenticated user synchronous snapshot.
   */
  getCurrentUser: () => {
    return auth.currentUser;
  },
};
