import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import Constants from "expo-constants";

// Firebase config
const firebaseConfig = {
  apiKey: Constants.expoConfig?.extra?.firebaseApiKey || process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: Constants.expoConfig?.extra?.firebaseAuthDomain || process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: Constants.expoConfig?.extra?.firebaseProjectId || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: Constants.expoConfig?.extra?.firebaseStorageBucket || process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: Constants.expoConfig?.extra?.firebaseMessagingSenderId || process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: Constants.expoConfig?.extra?.firebaseAppId || process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  databaseURL: Constants.expoConfig?.extra?.firebaseDatabaseURL || process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
};

console.log('Firestore-only config:', {
  projectId: firebaseConfig.projectId,
  hasApiKey: !!firebaseConfig.apiKey,
  hasAppId: !!firebaseConfig.appId
});

// Initialize Firebase only if not already initialized
let firebaseApp;
let database;

try {
  if (getApps().length === 0) {
    console.log('Initializing new Firebase app (Firestore only)...');
    firebaseApp = initializeApp(firebaseConfig);
  } else {
    console.log('Using existing Firebase app (Firestore only)...');
    firebaseApp = getApps()[0];
  }

  // Only initialize Firestore for now
  database = getFirestore(firebaseApp);
  console.log('Firestore initialized successfully');
  
} catch (error) {
  console.error('Firebase/Firestore initialization error:', error);
  database = null;
}

// Export only database for chat functionality
export { database };
export default firebaseApp;