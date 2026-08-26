import type { AppEnv } from "@weightloss/config";
import { initFirebase, getFirebaseMessaging } from "./firebase-app.js";
import { isFirebaseConfigured } from "./config.js";

export type WorkoutReminderPushPayload = {
  reminderId: number;
  gender: "male" | "female";
};

export type SendPushResult = {
  successCount: number;
  failureCount: number;
};

export async function sendWorkoutReminderPush(
  env: AppEnv,
  tokens: string[],
  payload: WorkoutReminderPushPayload,
): Promise<SendPushResult> {
  if (tokens.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  if (!isFirebaseConfigured(env)) {
    throw new Error("Firebase is not configured");
  }

  initFirebase(env);

  const response = await getFirebaseMessaging().sendEachForMulticast({
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
