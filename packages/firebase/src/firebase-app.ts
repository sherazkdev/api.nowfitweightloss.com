import type { AppEnv } from "@weightloss/config";
import admin from "firebase-admin";
import { isFirebaseConfigured, normalizePrivateKey } from "./config.js";

let initialized = false;

export function initFirebase(env: AppEnv): boolean {
  if (initialized) return true;
  if (!isFirebaseConfigured(env)) return false;

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: normalizePrivateKey(env.FIREBASE_PRIVATE_KEY),
    }),
  });

  initialized = true;
  return true;
}

export function getFirebaseAdmin(): admin.app.App {
  if (!initialized) {
    throw new Error("Firebase Admin SDK is not initialized");
  }
  return admin.app();
}

export function getFirebaseMessaging(): admin.messaging.Messaging {
  return getFirebaseAdmin().messaging();
}
