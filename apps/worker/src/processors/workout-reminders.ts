import type { AppEnv } from "@weightloss/config";
import type { WorkoutReminderDocument } from "@weightloss/contracts";
import {
  getMongo,
  listEnabledWorkoutReminders,
  listUserDeviceTokens,
  markWorkoutReminderSent,
  recordNotificationDelivery,
} from "@weightloss/database";
import { sendWorkoutReminderPush, isFirebaseConfigured, initFirebase } from "@weightloss/firebase";
import { createLogger } from "@weightloss/logger";
import { buildReminderSlotKey, getZonedDateParts } from "@weightloss/shared";

function shouldSendReminder(
  reminder: WorkoutReminderDocument,
  now = new Date(),
): { send: boolean; slotKey?: string } {
  const zoned = getZonedDateParts(reminder.timezone, now);
  if (zoned.hour !== reminder.hour || zoned.minute !== reminder.minute) {
    return { send: false };
  }

  const slotKey = buildReminderSlotKey(zoned.dateKey, reminder.hour, reminder.minute);

  if (reminder.days.length === 0) {
    const createdZoned = getZonedDateParts(reminder.timezone, reminder.createdAt);
    if (createdZoned.dateKey !== zoned.dateKey) {
      return { send: false };
    }
  } else if (!reminder.days.includes(zoned.weekday)) {
    return { send: false };
  }

  if (reminder.lastSentSlot === slotKey) {
    return { send: false };
  }

  return { send: true, slotKey };
}

export async function processWorkoutReminders(env: AppEnv): Promise<void> {
  const log = createLogger({ name: "workout-reminder-cron", level: env.LOG_LEVEL });

  if (!env.WORKOUT_REMINDERS_CRON_ENABLED || !isFirebaseConfigured(env)) {
    return;
  }

  initFirebase(env);
  const { db } = getMongo();
  const reminders = await listEnabledWorkoutReminders(db);

  for (const reminder of reminders) {
    const decision = shouldSendReminder(reminder);
    if (!decision.send || !decision.slotKey) continue;

    const tokens = await listUserDeviceTokens(db, reminder.firebaseUid);
    if (tokens.length === 0) {
      await recordNotificationDelivery(db, {
        firebaseUid: reminder.firebaseUid,
        reminderId: reminder.id,
        gender: reminder.gender,
        hour: reminder.hour,
        minute: reminder.minute,
        tokenCount: 0,
        successCount: 0,
        failureCount: 0,
        slotKey: decision.slotKey,
        errorMessage: "No registered device tokens",
      });
      log.warn({ reminderId: reminder.id, uid: reminder.firebaseUid }, "no_device_tokens");
      continue;
    }

    try {
      const result = await sendWorkoutReminderPush(env, tokens, {
        reminderId: reminder.id,
        gender: reminder.gender,
      });

      await markWorkoutReminderSent(db, reminder.id, decision.slotKey);
      await recordNotificationDelivery(db, {
        firebaseUid: reminder.firebaseUid,
        reminderId: reminder.id,
        gender: reminder.gender,
        hour: reminder.hour,
        minute: reminder.minute,
        tokenCount: tokens.length,
        successCount: result.successCount,
        failureCount: result.failureCount,
        slotKey: decision.slotKey,
      });

      log.info(
        {
          reminderId: reminder.id,
          uid: reminder.firebaseUid,
          successCount: result.successCount,
          failureCount: result.failureCount,
        },
        "workout_reminder_sent",
      );
    } catch (error) {
      await recordNotificationDelivery(db, {
        firebaseUid: reminder.firebaseUid,
        reminderId: reminder.id,
        gender: reminder.gender,
        hour: reminder.hour,
        minute: reminder.minute,
        tokenCount: tokens.length,
        successCount: 0,
        failureCount: tokens.length,
        slotKey: decision.slotKey,
        errorMessage: error instanceof Error ? error.message : "Send failed",
      });
      log.error({ err: error, reminderId: reminder.id }, "workout_reminder_send_failed");
    }
  }
}
