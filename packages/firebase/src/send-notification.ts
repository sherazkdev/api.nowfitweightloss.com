import type { AppEnv } from "@weightloss/config";
import {
  getFirebaseMessagingForPlatform,
  initFirebase,
} from "./firebase-app.js";
import {
  isFirebaseAndroidConfigured,
  isFirebaseConfigured,
  isFirebaseIosConfigured,
} from "./config.js";

export type WorkoutReminderPushPayload = {
  reminderId: number;
  gender: "male" | "female";
};

export type PushDeviceToken = {
  token: string;
  platform: "android" | "ios";
};

export type SendPushResult = {
  successCount: number;
  failureCount: number;
};

async function sendMulticastForPlatform(
  env: AppEnv,
  platform: "android" | "ios",
  tokens: string[],
  payload: WorkoutReminderPushPayload,
): Promise<SendPushResult> {
  if (tokens.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  const messaging = getFirebaseMessagingForPlatform(env, platform);
  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: {
      title: "Workout Reminder",
      body: "Time for your workout!",
    },
    data: {
      type: "workout_reminder",
      reminder_id: String(payload.reminderId),
      gender: payload.gender,
    },
  });

  return {
    successCount: response.successCount,
    failureCount: response.failureCount,
  };
}

export async function sendWorkoutReminderPush(
  env: AppEnv,
  devices: PushDeviceToken[],
  payload: WorkoutReminderPushPayload,
): Promise<SendPushResult> {
  if (devices.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  if (!isFirebaseConfigured(env)) {
    throw new Error("Firebase is not configured");
  }

  initFirebase(env);

  const androidTokens: string[] = [];
  const iosTokens: string[] = [];

  for (const device of devices) {
    if (device.platform === "ios") {
      iosTokens.push(device.token);
    } else {
      androidTokens.push(device.token);
    }
  }

  let successCount = 0;
  let failureCount = 0;

  if (androidTokens.length > 0) {
    if (!isFirebaseAndroidConfigured(env)) {
      failureCount += androidTokens.length;
    } else {
      const result = await sendMulticastForPlatform(env, "android", androidTokens, payload);
      successCount += result.successCount;
      failureCount += result.failureCount;
    }
  }

  if (iosTokens.length > 0) {
    if (!isFirebaseIosConfigured(env)) {
      failureCount += iosTokens.length;
    } else {
      const result = await sendMulticastForPlatform(env, "ios", iosTokens, payload);
      successCount += result.successCount;
      failureCount += result.failureCount;
    }
  }

  return { successCount, failureCount };
}
