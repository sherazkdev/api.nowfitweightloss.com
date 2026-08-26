import type { AppEnv } from "@weightloss/config";

export function isFirebaseConfigured(env: AppEnv): boolean {
  return Boolean(
    env.FIREBASE_PROJECT_ID.trim() &&
      env.FIREBASE_CLIENT_EMAIL.trim() &&
      env.FIREBASE_PRIVATE_KEY.trim(),
  );
}

export function normalizePrivateKey(value: string): string {
  return value.replace(/\\n/g, "\n").trim();
}
