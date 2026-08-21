import { Redis } from "ioredis";
import type { AppEnv } from "@weightloss/config";
import { resolveRedisUrls } from "@weightloss/config";

export function createQueueConnection(env: AppEnv): Redis {
  return new Redis(resolveRedisUrls(env).queue, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

export function queueName(env: AppEnv, suffix: string): string {
  // BullMQ rejects ":" in queue names — use a hyphenated prefix.
  const prefix = env.QUEUE_PREFIX.trim().replace(/:+$/g, "").replace(/:/g, "-");
  return `${prefix}-${suffix}`;
}
