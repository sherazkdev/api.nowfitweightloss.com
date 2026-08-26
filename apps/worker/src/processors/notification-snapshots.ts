import type { AppEnv } from "@weightloss/config";
import { writeSnapshot } from "@weightloss/cache";
import type { Redis } from "ioredis";
import {
  getAdminDeviceSummary,
  getAdminWorkoutReminderSummary,
  getMongo,
  USER_DEVICES_SUMMARY_SNAPSHOT,
  WORKOUT_REMINDER_SUMMARY_SNAPSHOT,
} from "@weightloss/database";

function snapshotStoreOptions(env: AppEnv, redis: Redis) {
  return {
    redis,
    keyPrefix: env.REDIS_KEY_PREFIX,
    ttlSeconds: env.CACHE_ADMIN_SUMMARY_TTL_SECONDS,
  };
}

export async function refreshNotificationSnapshots(env: AppEnv, redis: Redis): Promise<void> {
  const { db } = getMongo();
  const opts = snapshotStoreOptions(env, redis);
  const [workoutSummary, deviceSummary] = await Promise.all([
    getAdminWorkoutReminderSummary(db),
    getAdminDeviceSummary(db),
  ]);

  await Promise.all([
    writeSnapshot(opts, WORKOUT_REMINDER_SUMMARY_SNAPSHOT, workoutSummary),
    writeSnapshot(opts, USER_DEVICES_SUMMARY_SNAPSHOT, deviceSummary),
  ]);
}
