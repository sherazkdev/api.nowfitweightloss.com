import { getFirebaseAdminApps, initFirebase } from "./firebase-app.js";
import type { AppEnv } from "@weightloss/config";
import { isFirebaseConfigured } from "./config.js";

export type FirebaseAuthUser = {
  uid: string;
};

export async function verifyFirebaseIdToken(
  env: AppEnv,
  token: string,
): Promise<FirebaseAuthUser | null> {
  if (!isFirebaseConfigured(env)) {
    throw new Error("Firebase is not configured");
  }

  initFirebase(env);

  for (const app of getFirebaseAdminApps(env)) {
    try {
      const decoded = await app.auth().verifyIdToken(token);
      return { uid: decoded.uid };
    } catch {
      // Try the other Firebase project (Android vs iOS app).
    }
  }

  return null;
}
