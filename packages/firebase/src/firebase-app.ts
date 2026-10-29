import type { AppEnv } from "@weightloss/config";
import admin from "firebase-admin";
import {
  isFirebaseAndroidConfigured,
  isFirebaseIosConfigured,
  normalizePrivateKey,
} from "./config.js";

export const FIREBASE_ANDROID_APP_NAME = "firebase-android";
export const FIREBASE_IOS_APP_NAME = "firebase-ios";

let initialized = false;

function getExistingApp(name?: string): admin.app.App | null {
  try {
    return name ? admin.app(name) : admin.app();
  } catch {
    return null;
  }
}

function initAndroidApp(env: AppEnv, useNamedApp: boolean): void {
  if (getExistingApp(useNamedApp ? FIREBASE_ANDROID_APP_NAME : undefined)) return;

  const credential = admin.credential.cert({
    projectId: env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: normalizePrivateKey(env.FIREBASE_PRIVATE_KEY),
  });

  if (useNamedApp) {
    admin.initializeApp({ credential }, FIREBASE_ANDROID_APP_NAME);
  } else {
    admin.initializeApp({ credential });
  }
}

function initIosApp(env: AppEnv, useNamedApp: boolean): void {
  if (getExistingApp(useNamedApp ? FIREBASE_IOS_APP_NAME : undefined)) return;

  const credential = admin.credential.cert({
    projectId: env.FIREBASE_IOS_PROJECT_ID,
    clientEmail: env.FIREBASE_IOS_CLIENT_EMAIL,
    privateKey: normalizePrivateKey(env.FIREBASE_IOS_PRIVATE_KEY),
  });

  if (useNamedApp) {
    admin.initializeApp({ credential }, FIREBASE_IOS_APP_NAME);
  } else {
    admin.initializeApp({ credential });
  }
}

export function initFirebase(env: AppEnv): boolean {
  if (initialized) return true;

  const android = isFirebaseAndroidConfigured(env);
  const ios = isFirebaseIosConfigured(env);
  if (!android && !ios) return false;

  const dualProject = android && ios;

  if (android) {
    initAndroidApp(env, dualProject);
  }
  if (ios) {
    initIosApp(env, dualProject);
  }

  initialized = true;
  return true;
}

export function getFirebaseAdminApps(env: AppEnv): admin.app.App[] {
  initFirebase(env);
  const apps: admin.app.App[] = [];
  const android = isFirebaseAndroidConfigured(env);
  const ios = isFirebaseIosConfigured(env);
  const dualProject = android && ios;

  if (android) {
    const app = getExistingApp(dualProject ? FIREBASE_ANDROID_APP_NAME : undefined);
    if (app) apps.push(app);
  }
  if (ios) {
    const app = getExistingApp(dualProject ? FIREBASE_IOS_APP_NAME : undefined);
    if (app) apps.push(app);
  }

  return apps;
}

export function getFirebaseAdmin(): admin.app.App {
  const app = getExistingApp(undefined) ?? getExistingApp(FIREBASE_ANDROID_APP_NAME);
  if (!app) {
    throw new Error("Firebase Admin SDK is not initialized");
  }
  return app;
}

export function getFirebaseMessagingForPlatform(
  env: AppEnv,
  platform: "android" | "ios",
): admin.messaging.Messaging {
  initFirebase(env);

  const android = isFirebaseAndroidConfigured(env);
  const ios = isFirebaseIosConfigured(env);
  const dualProject = android && ios;

  if (platform === "ios") {
    if (!ios) {
      throw new Error("Firebase iOS project is not configured");
    }
    const app = getExistingApp(dualProject ? FIREBASE_IOS_APP_NAME : undefined);
    if (!app) throw new Error("Firebase iOS Admin app is not initialized");
    return app.messaging();
  }

  if (!android) {
    throw new Error("Firebase Android project is not configured");
  }
  const app = getExistingApp(dualProject ? FIREBASE_ANDROID_APP_NAME : undefined);
  if (!app) throw new Error("Firebase Android Admin app is not initialized");
  return app.messaging();
}

/** @deprecated Use getFirebaseMessagingForPlatform */
export function getFirebaseMessaging(): admin.messaging.Messaging {
  return getFirebaseAdmin().messaging();
}
