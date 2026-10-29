export {
  isFirebaseConfigured,
  isFirebaseAndroidConfigured,
  isFirebaseIosConfigured,
  normalizePrivateKey,
} from "./config.js";
export {
  initFirebase,
  getFirebaseAdmin,
  getFirebaseMessaging,
  getFirebaseMessagingForPlatform,
  getFirebaseAdminApps,
  FIREBASE_ANDROID_APP_NAME,
  FIREBASE_IOS_APP_NAME,
} from "./firebase-app.js";
export { verifyFirebaseIdToken, type FirebaseAuthUser } from "./verify-token.js";
export {
  sendWorkoutReminderPush,
  type SendPushResult,
  type WorkoutReminderPushPayload,
  type PushDeviceToken,
} from "./send-notification.js";
