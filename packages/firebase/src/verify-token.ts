import { initFirebase, getFirebaseAdmin } from "./firebase-app.js";
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

  try {
    const decoded = await getFirebaseAdmin().auth().verifyIdToken(token);
    return { uid: decoded.uid };
  } catch {
    return null;
  }
}
