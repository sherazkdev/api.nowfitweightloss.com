import type { AppEnv } from "@weightloss/config";
import { readSnapshot, type SnapshotStoreOptions } from "@weightloss/cache";
import type { Redis } from "ioredis";
import {
  getAdminDeviceSummary,
  getAdminWorkoutReminderSummary,
  USER_DEVICES_SUMMARY_SNAPSHOT,
  WORKOUT_REMINDER_SUMMARY_SNAPSHOT,
  type AdminDeviceSummary,
  type AdminWorkoutReminderSummary,
} from "@weightloss/database";

export function snapshotStoreOptions(env: AppEnv, redis: Redis): SnapshotStoreOptions {
  return {
    redis,
    keyPrefix: env.REDIS_KEY_PREFIX,
    ttlSeconds: env.CACHE_ADMIN_SUMMARY_TTL_SECONDS,
  };
}

export async function readWorkoutReminderSummarySnapshot(
  env: AppEnv,
  redis: Redis,
): Promise<AdminWorkoutReminderSummary | null> {
  return readSnapshot<AdminWorkoutReminderSummary>(
    snapshotStoreOptions(env, redis),
    WORKOUT_REMINDER_SUMMARY_SNAPSHOT,
  );
}

export async function readDeviceSummarySnapshot(
  env: AppEnv,
  redis: Redis,
): Promise<AdminDeviceSummary | null> {
  return readSnapshot<AdminDeviceSummary>(
    snapshotStoreOptions(env, redis),
    USER_DEVICES_SUMMARY_SNAPSHOT,
  );
}

export async function loadWorkoutReminderSummary(
  env: AppEnv,
  redis: Redis,
  loader: () => Promise<AdminWorkoutReminderSummary>,
): Promise<{ data: AdminWorkoutReminderSummary; source: "snapshot" | "live" }> {
  const snapshot = await readWorkoutReminderSummarySnapshot(env, redis);
  if (snapshot) {
    return { data: snapshot, source: "snapshot" };
  }
  return { data: await loader(), source: "live" };
}

export async function loadDeviceSummary(
  env: AppEnv,
  redis: Redis,
  loader: () => Promise<AdminDeviceSummary>,
): Promise<{ data: AdminDeviceSummary; source: "snapshot" | "live" }> {
  const snapshot = await readDeviceSummarySnapshot(env, redis);
  if (snapshot) {
    return { data: snapshot, source: "snapshot" };
  }
  return { data: await loader(), source: "live" };
}

export { getAdminWorkoutReminderSummary, getAdminDeviceSummary };
