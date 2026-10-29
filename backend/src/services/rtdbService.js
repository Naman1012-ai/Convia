import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { getAuth } from 'firebase-admin/auth';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure dotenv environment variables are loaded prior to reading process.env at import time
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const firebaseProjectId = process.env.FIREBASE_PROJECT_ID || 'brainsync-07';
const firebaseClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
const databaseURL = process.env.VITE_FIREBASE_DATABASE_URL || 'https://brainsync-07-default-rtdb.asia-southeast1.firebasedatabase.app';

let db = null;

function getDbInstance() {
  if (db) return db;

  try {
    const existingApps = getApps();
    if (existingApps.length) {
      db = getDatabase(existingApps[0]);
      return db;
    }

    // 1. Check for JSON service account file (e.g. fFIREBASE_PRIVATE_KEY.json)
    const candidatePaths = [
      path.resolve(__dirname, '../../fFIREBASE_PRIVATE_KEY.json'),
      path.resolve(__dirname, '../../../fFIREBASE_PRIVATE_KEY.json'),
      path.resolve(__dirname, '../../serviceAccountKey.json'),
      path.resolve(__dirname, '../../../serviceAccountKey.json'),
    ];

    let fileCredential = null;
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        try {
          const jsonContent = JSON.parse(fs.readFileSync(p, 'utf8'));
          fileCredential = cert(jsonContent);
          console.log(`✅ [rtdbService] Loaded Service Account JSON credentials from: ${p}`);
          break;
        } catch (e) {
          console.warn(`⚠️ [rtdbService] Failed to parse key file at ${p}:`, e.message);
        }
      }
    }

    if (fileCredential) {
      const app = initializeApp({ credential: fileCredential, databaseURL });
      db = getDatabase(app);
      return db;
    }

    // 2. Check for environment variables
    if (firebaseClientEmail && rawPrivateKey) {
      const privateKey = String(rawPrivateKey).trim().replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
      const app = initializeApp({
        credential: cert({
          projectId: firebaseProjectId,
          clientEmail: firebaseClientEmail,
          privateKey,
        }),
        databaseURL,
      });
      db = getDatabase(app);
      console.log('✅ [rtdbService] Initialized Firebase Admin SDK with env credentials');
      return db;
    }

    // Fallback default app
    const app = initializeApp({ projectId: firebaseProjectId, databaseURL });
    db = getDatabase(app);
    console.log('⚠️ [rtdbService] Initialized Firebase Admin SDK default app');
    return db;
  } catch (err) {
    console.warn('⚠️ [rtdbService] Firebase Admin SDK initialization fallback warning:', err.message);
    return null;
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
 * Server-side Firebase Realtime Database Service.
 * Uses Firebase Admin SDK for authenticated, rule-bypassing database access.
 */
export const rtdbService = {
  getData: async (path) => {
    try {
      const cleanPath = String(path || '').replace(/^\/|\/$/g, '');
      const instance = getDbInstance();
      if (instance) {
        const ref = cleanPath ? instance.ref(cleanPath) : instance.ref();
        const snapshot = await ref.once('value');
        return snapshot.val();
      }
      // Fallback REST request
      const url = cleanPath ? `${databaseURL}/${cleanPath}.json` : `${databaseURL}/.json`;
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.error(`🚨 [Backend RTDB getData Error] Path: ${path}:`, err.message);
      return null;
    }
  },

  setData: async (path, data) => {
    try {
      const cleanPath = String(path || '').replace(/^\/|\/$/g, '');
      const sanitizedData = sanitizeForRtdb(data);
      const instance = getDbInstance();
      if (instance) {
        const ref = cleanPath ? instance.ref(cleanPath) : instance.ref();
        await ref.set(sanitizedData);
        return true;
      }
      const url = cleanPath ? `${databaseURL}/${cleanPath}.json` : `${databaseURL}/.json`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanitizedData),
      });
      return res.ok;
    } catch (err) {
      console.error(`🚨 [Backend RTDB setData Error] Path: ${path}:`, err.message);
      throw err;
    }
  },

  updateData: async (path, updates) => {
    try {
      const cleanPath = String(path || '').replace(/^\/|\/$/g, '');
      if (!updates || typeof updates !== 'object') {
        throw new Error('Updates payload must be a non-null object.');
      }

      // Strict validation for update keys to catch empty paths and [object Object] before reaching Firebase
      for (const key of Object.keys(updates)) {
        if (typeof key !== 'string' || key.trim() === '') {
          throw new Error(`Invalid RTDB update key: empty string or non-string key detected in updateData('${path}').`);
        }
        if (key.includes('[object Object]')) {
          throw new Error(`Invalid RTDB update key: '[object Object]' detected in path '${key}'.`);
        }
      }

      const sanitizedUpdates = sanitizeForRtdb(updates);
      const instance = getDbInstance();
      if (instance) {
        const ref = cleanPath ? instance.ref(cleanPath) : instance.ref();
        await ref.update(sanitizedUpdates);
        return true;
      }
      const url = cleanPath ? `${databaseURL}/${cleanPath}.json` : `${databaseURL}/.json`;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanitizedUpdates),
      });
      return res.ok;
    } catch (err) {
      console.error(`🚨 [Backend RTDB updateData Error] Path: ${path}:`, err.message);
      throw err;
    }
  },

  updateMultiple: async (updates) => {
    try {
      if (!updates || typeof updates !== 'object') {
        throw new Error('Updates payload must be a non-null object.');
      }
      for (const key of Object.keys(updates)) {
        if (typeof key !== 'string' || key.trim() === '') {
          throw new Error('Invalid RTDB multi-path update key: empty string or non-string key detected.');
        }
        if (key.includes('[object Object]')) {
          throw new Error(`Invalid RTDB multi-path update key: '[object Object]' detected in path '${key}'.`);
        }
      }
      const sanitizedUpdates = sanitizeForRtdb(updates);
      const instance = getDbInstance();
      if (instance) {
        await instance.ref().update(sanitizedUpdates);
        return true;
      }
      const url = `${databaseURL}/.json`;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanitizedUpdates),
      });
      return res.ok;
    } catch (err) {
      console.error('🚨 [Backend RTDB updateMultiple Error]:', err.message);
      throw err;
    }
  },

  removeData: async (path) => {
    try {
      const cleanPath = String(path || '').replace(/^\/|\/$/g, '');
      const instance = getDbInstance();
      if (instance) {
        const ref = cleanPath ? instance.ref(cleanPath) : instance.ref();
        await ref.remove();
        return true;
      }
      const url = cleanPath ? `${databaseURL}/${cleanPath}.json` : `${databaseURL}/.json`;
      const res = await fetch(url, { method: 'DELETE' });
      return res.ok;
    } catch (err) {
      console.error(`🚨 [Backend RTDB removeData Error] Path: ${path}:`, err.message);
      throw err;
    }
  },
};

/**
 * Retrieves the initialized Firebase Admin App instance.
 */
export function getFirebaseAdminApp() {
  getDbInstance();
  const existingApps = getApps();
  return existingApps.length > 0 ? existingApps[0] : null;
}

/**
 * Retrieves the Firebase Admin Auth instance for server-side token verification.
 */
export function getAdminAuth() {
  const app = getFirebaseAdminApp();
  if (!app) return null;
  try {
    return getAuth(app);
  } catch (err) {
    console.warn('⚠️ [rtdbService] Failed to getAuth instance:', err.message);
    return null;
  }
}

