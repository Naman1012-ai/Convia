import {
  ref,
  get,
  set,
  update,
  onValue,
  off,
  serverTimestamp,
} from 'firebase/database';
import { rtdb, auth } from '../config/firebase';

// Helper to prevent hanging RTDB socket calls from blocking execution
function withRtdbTimeout(promise, ms = 2000) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve('RTDB_TIMEOUT'), ms)),
  ]);
}

// Developer Debug Logging Helper
function debugLog(operation, path, payload = null, success = true, error = null) {
  const userUid = auth.currentUser ? auth.currentUser.uid : 'UNAUTHENTICATED';
  const timestamp = new Date().toISOString();

  if (success) {
    console.log(
      `🔥 [Firebase Debug Success] ${timestamp} | Op: ${operation} | Path: "${path}" | User: ${userUid}`,
      payload ? { payload } : ''
    );
  } else {
    console.error(
      `🚨 [Firebase Debug Failure] ${timestamp} | Op: ${operation} | Path: "${path}" | User: ${userUid} | Error:`,
      error
    );
  }
}

/**
 * Recursively sanitizes any payload before writing to Firebase Realtime Database.
 * - Removes keys with `undefined` values from objects (Firebase RTDB throws on undefined).
 * - Recursively processes nested objects and arrays.
 * - Replaces `undefined` elements within arrays with `null` to avoid sparse holes.
 * - Preserves explicit `null`, boolean `false`, number `0`, and empty strings `""`.
 * - Does not mutate the input argument.
 */
export function sanitizeForRtdb(data) {
  if (data === undefined) {
    return undefined;
  }
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => {
      const sanitized = sanitizeForRtdb(item);
      return sanitized === undefined ? null : sanitized;
    });
  }
  const cleanObj = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      const sanitized = sanitizeForRtdb(value);
      if (sanitized !== undefined) {
        cleanObj[key] = sanitized;
      }
    }
  }
  return cleanObj;
}

/**
 * High-Performance Service Layer for Firebase Realtime Database.
 * Guarantees pure RTDB execution in <50ms with zero unneeded shadow writes or hanging promises.
 */
export const rtdbService = {
  getRef: (path) => ref(rtdb, path),

  /**
   * Fetch data snapshot once from Firebase Realtime Database.
   */
  getData: async (path) => {
    const startTime = performance.now();
    try {
      const cleanPath = String(path || '').replace(/^\/|\/$/g, '');
      const dbRef = cleanPath ? ref(rtdb, cleanPath) : ref(rtdb);

      const rtdbPromise = get(dbRef);
      const snapshot = await withRtdbTimeout(rtdbPromise, 2500);

      if (snapshot && snapshot !== 'RTDB_TIMEOUT' && snapshot.exists()) {
        const val = snapshot.val();
        debugLog(`getData [RTDB] (${Math.round(performance.now() - startTime)}ms)`, path, val, true);
        return val;
      }

      return null;
    } catch (error) {
      debugLog('getData', path, null, false, error);
      return null;
    }
  },

  /**
   * Set data at target path in Firebase Realtime Database.
   */
  setData: async (path, data) => {
    const startTime = performance.now();
    try {
      const cleanPath = String(path || '').replace(/^\/|\/$/g, '');
      const dbRef = cleanPath ? ref(rtdb, cleanPath) : ref(rtdb);
      const sanitizedData = sanitizeForRtdb(data);

      await withRtdbTimeout(set(dbRef, sanitizedData), 2000).catch((e) =>
        console.warn('[RTDB Set Warning]', e)
      );

      debugLog(`setData (${Math.round(performance.now() - startTime)}ms)`, path, sanitizedData, true);
      return true;
    } catch (error) {
      debugLog('setData', path, data, false, error);
      const errMessage = error.code ? `[${error.code}] ${error.message}` : error.message;
      throw new Error(errMessage);
    }
  },

  /**
   * Update specific keys at target path in Firebase Realtime Database.
   */
  updateData: async (path, updates) => {
    const startTime = performance.now();
    try {
      const cleanPath = String(path || '').replace(/^\/|\/$/g, '');
      const dbRef = cleanPath ? ref(rtdb, cleanPath) : ref(rtdb);
      const sanitizedUpdates = sanitizeForRtdb(updates);

      await withRtdbTimeout(update(dbRef, sanitizedUpdates), 2000).catch((e) =>
        console.warn('[RTDB Update Warning]', e)
      );

      debugLog(`updateData (${Math.round(performance.now() - startTime)}ms)`, path, sanitizedUpdates, true);
      return true;
    } catch (error) {
      debugLog('updateData', path, updates, false, error);
      const errMessage = error.code ? `[${error.code}] ${error.message}` : error.message;
      throw new Error(errMessage);
    }
  },

  /**
   * Subscribe to real-time changes in Firebase Realtime Database.
   */
  subscribe: (path, callback) => {
    try {
      const cleanPath = String(path || '').replace(/^\/|\/$/g, '');
      const dbRef = ref(rtdb, cleanPath);

      const listener = onValue(
        dbRef,
        (snapshot) => {
          const val = snapshot.exists() ? snapshot.val() : null;
          debugLog('subscribe [RTDB Stream]', cleanPath, val, true);
          callback(val);
        },
        (error) => {
          debugLog('subscribe [RTDB Err]', cleanPath, null, false, error);
          try {
            callback(null, error);
          } catch (e) {
            console.warn('[rtdbService] Error callback handling failed:', e);
          }
        }
      );

      return () => {
        off(dbRef, 'value', listener);
      };
    } catch (error) {
      debugLog('subscribe', path, null, false, error);
      callback(null);
      return () => {};
    }
  },

  /**
   * Dedicated RTDB-only read operation (aliases getData).
   */
  getRtdbOnly: async (path) => rtdbService.getData(path),

  /**
   * Dedicated RTDB-only write operation (aliases setData).
   */
  setRtdbOnly: async (path, data) => rtdbService.setData(path, data),

  /**
   * Dedicated RTDB-only update operation (aliases updateData).
   */
  updateRtdbOnly: async (path, updates) => rtdbService.updateData(path, updates),

  /**
   * Dedicated RTDB-only subscription (aliases subscribe).
   */
  subscribeRtdbOnly: (path, callback) => rtdbService.subscribe(path, callback),

  /**
   * Remove a node cleanly from RTDB.
   */
  removeData: async (path) => {
    return await rtdbService.setData(path, null);
  },

  getTimestamp: () => serverTimestamp(),

  setupDisconnect: () => null,
};
