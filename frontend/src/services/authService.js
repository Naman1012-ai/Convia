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
import { apiClient } from './apiClient';

/**
 * Service Layer abstraction for Firebase Authentication.
 * No component should import from 'firebase/auth' directly.
 */
export const authService = {
  /**
   * Register a new user with email, password, and display name.
   */
  signUp: async (email, password, displayName) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) {
        await updateProfile(userCredential.user, { displayName });
      }
      // Send verification email on sign up
      await authService.sendVerificationEmail().catch(() => {});
      return userCredential.user;
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
      return userCredential.user;
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
