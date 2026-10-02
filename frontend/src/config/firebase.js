import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  databaseURL:
    import.meta.env.VITE_FIREBASE_DATABASE_URL ||
    'https://brainsync-07-default-rtdb.asia-southeast1.firebasedatabase.app',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'brainsync-07.appspot.com',
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '470734580927',
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase App Singleton (Guarantees single instance)
const app = initializeApp(firebaseConfig);

// Export Auth, Firestore, Realtime Database, and Storage Services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app, firebaseConfig.databaseURL);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
