import { getErrorMessage } from '../utils/errorMessages';
import { formatUserFriendlyAiError } from '../utils/aiErrorSanitizer';

/**
 * Centralized Notification Service for BrainSync
 * Single source of truth for triggering, updating, and deduplicating toast notifications.
 */

class NotificationServiceManager {
  constructor() {
    this.listeners = new Set();
    this.recentToasts = new Map(); // Key: message+type -> timestamp
    this.dedupeWindowMs = 2500;
  }

  /**
   * Subscribe to notification events
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Internal notify helper
   */
  _emit(action, payload) {
    this.listeners.forEach((listener) => {
      try {
        listener(action, payload);
      } catch (err) {
        console.error('[NotificationService] listener error:', err);
      }
    });
  }

  /**
   * Sanitize error message to prevent raw JS stacktraces/TypeError/JSON blobs from exposing to users
   */
  _formatErrorMessage(rawError) {
    if (!rawError) return 'Something went wrong. Please try again.';

    // Extract message from Axios error response if present
    const apiErrorMsg =
      rawError?.response?.data?.error?.message ||
      rawError?.response?.data?.error ||
      rawError?.response?.data?.message;

    const candidate = apiErrorMsg || (typeof rawError === 'object' ? rawError.message : rawError);

    if (typeof candidate === 'string') {
      // Check for auth / firebase error codes
      if (candidate.includes('auth/') || candidate.includes('permission-denied')) {
        return getErrorMessage(candidate);
      }
      // Check if it's a raw AI provider JSON blob or Gemini failure
      if (
        candidate.includes('Gemini') ||
        candidate.includes('"error"') ||
        candidate.includes('503') ||
        candidate.includes('429')
      ) {
        return formatUserFriendlyAiError(candidate);
      }
      // If it looks like a JS syntax or runtime error string, fallback
      if (
        candidate.includes('TypeError') ||
        candidate.includes('ReferenceError') ||
        candidate.includes('Undefined') ||
        candidate.includes('Cannot read property')
      ) {
        return 'Something went wrong. Please try again.';
      }
      return candidate;
    }

    if (typeof rawError === 'object') {
      if (rawError.code) {
        return getErrorMessage(rawError.code);
      }
    }

    return 'Something went wrong. Please try again.';
  }

  /**
   * Check deduplication
   */
  _isDuplicate(message, type) {
    const key = `${type}:${message}`;
    const now = Date.now();
    const lastTime = this.recentToasts.get(key);

    if (lastTime && now - lastTime < this.dedupeWindowMs) {
      return true;
    }

    this.recentToasts.set(key, now);
    // Cleanup old keys periodically
    if (this.recentToasts.size > 50) {
      for (const [k, time] of this.recentToasts.entries()) {
        if (now - time > this.dedupeWindowMs * 2) {
          this.recentToasts.delete(k);
        }
      }
    }
    return false;
  }

  /**
   * Show a toast
   */
  show(rawMessage, type = 'info', duration = 4000) {
    let message = rawMessage;
    if (type === 'error') {
      message = this._formatErrorMessage(rawMessage);
    }

    if (!message) return null;

    if (this._isDuplicate(message, type)) {
      return null;
    }

    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const toastItem = { id, message, type, duration };

    this._emit('ADD_TOAST', toastItem);
    return id;
  }

  success(message, duration = 4000) {
    return this.show(message, 'success', duration);
  }

  error(rawError, duration = 4500) {
    return this.show(rawError, 'error', duration);
  }

  warning(message, duration = 4000) {
    return this.show(message, 'warning', duration);
  }

  info(message, duration = 4000) {
    return this.show(message, 'info', duration);
  }

  loading(message = 'Loading...') {
    const id = `toast_loading_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const toastItem = { id, message, type: 'loading', duration: 0 }; // 0 means persistent until updated/dismissed
    this._emit('ADD_TOAST', toastItem);
    return id;
  }

  update(id, { type = 'success', message, duration = 4000 }) {
    if (!id) return;
    let formattedMsg = message;
    if (type === 'error') {
      formattedMsg = this._formatErrorMessage(message);
    }
    this._emit('UPDATE_TOAST', { id, type, message: formattedMsg, duration });
  }

  dismiss(id) {
    if (!id) return;
    this._emit('REMOVE_TOAST', { id });
  }
}

export const NotificationService = new NotificationServiceManager();
export default NotificationService;
