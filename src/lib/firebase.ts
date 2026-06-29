import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyDJACC35H4fylJ_1Fsu5QI3Yoc0wYnjxlU",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "household-expense-app-8102d.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "household-expense-app-8102d",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "household-expense-app-8102d.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "41472809503",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:41472809503:web:d3796bc59e24cb79d0932a",
};

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const firebaseProjectId = firebaseConfig.projectId;
export const auth = getAuth(app);
export const db = getFirestore(app);
