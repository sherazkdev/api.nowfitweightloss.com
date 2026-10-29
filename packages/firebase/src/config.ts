import type { AppEnv } from "@weightloss/config";

function hasServiceAccountTriple(projectId: string, clientEmail: string, privateKey: string): boolean {
  return Boolean(projectId.trim() && clientEmail.trim() && privateKey.trim());
}

/** Android / default mobile Firebase project (FIREBASE_*). */
export function isFirebaseAndroidConfigured(env: AppEnv): boolean {
  return hasServiceAccountTriple(
    env.FIREBASE_PROJECT_ID,
    env.FIREBASE_CLIENT_EMAIL,
    env.FIREBASE_PRIVATE_KEY,
  );
}

/** iOS mobile Firebase project (FIREBASE_IOS_*), when separate from Android. */
export function isFirebaseIosConfigured(env: AppEnv): boolean {
  return hasServiceAccountTriple(
    env.FIREBASE_IOS_PROJECT_ID,
    env.FIREBASE_IOS_CLIENT_EMAIL,
    env.FIREBASE_IOS_PRIVATE_KEY,
  );
}

/** At least one Firebase project is configured for push / auth. */
export function isFirebaseConfigured(env: AppEnv): boolean {
  return isFirebaseAndroidConfigured(env) || isFirebaseIosConfigured(env);
}

export function normalizePrivateKey(value: string): string {
  return value.replace(/\\n/g, "\n").trim();
}
