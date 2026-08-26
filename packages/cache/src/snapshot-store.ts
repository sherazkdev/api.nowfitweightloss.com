import type { Redis } from "ioredis";
import { prefixKey } from "./keys.js";

export type SnapshotStoreOptions = {
  redis: Redis;
  keyPrefix: string;
  ttlSeconds: number;
};

function snapshotKey(keyPrefix: string, name: string): string {
  return prefixKey(keyPrefix, `snapshot:${name}`);
}

export async function writeSnapshot<T>(
  options: SnapshotStoreOptions,
  name: string,
  value: T,
): Promise<void> {
  await options.redis.set(
    snapshotKey(options.keyPrefix, name),
    JSON.stringify(value),
    "EX",
    options.ttlSeconds,
  );
}

export async function readSnapshot<T>(
  options: SnapshotStoreOptions,
  name: string,
): Promise<T | null> {
  const raw = await options.redis.get(snapshotKey(options.keyPrefix, name));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function readSnapshotFresh<T>(
  options: SnapshotStoreOptions,
  name: string,
  maxAgeMs: number,
): Promise<{ value: T; ageMs: number } | null> {
  const key = snapshotKey(options.keyPrefix, name);
  const pipeline = options.redis.pipeline();
  pipeline.get(key);
  pipeline.ttl(key);
  const results = await pipeline.exec();
  const raw = results?.[0]?.[1];
  const ttlSeconds = results?.[1]?.[1];
  if (typeof raw !== "string" || typeof ttlSeconds !== "number" || ttlSeconds <= 0) {
    return null;
  }

  const ageMs = Math.max(0, (options.ttlSeconds - ttlSeconds) * 1000);
  if (ageMs > maxAgeMs) return null;

  try {
    return { value: JSON.parse(raw) as T, ageMs };
  } catch {
    return null;
  }
}
