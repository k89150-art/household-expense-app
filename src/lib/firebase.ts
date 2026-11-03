import { getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { initializeValidatedFirebaseApp } from "@/lib/firebaseConfig";

const { resolved: firebaseRuntime, app } = initializeValidatedFirebaseApp(
  {
    appEnv: process.env.NEXT_PUBLIC_APP_ENV,
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    emulatorHost: process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST,
  },
  getApps(),
  initializeApp,
);

export { app };
export const auth = getAuth(app);
export const db = getFirestore(app);
export const firebaseProjectId = firebaseRuntime.firebase.projectId;

if (firebaseRuntime.emulator) {
  const { host, authPort, firestorePort } = firebaseRuntime.emulator;
  connectAuthEmulator(auth, `http://${host}:${authPort}`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, firestorePort);
}
