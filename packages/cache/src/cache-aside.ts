import type { Redis } from "ioredis";
import { lockKeyFor } from "./keys.js";
import { sleep, ttlWithJitter } from "./time.js";
import type { CacheLookupResult } from "./types.js";

export type CacheAsideOptions<T> = {
  redis: Redis;
  key: string;
  ttlSeconds: number;
  lockMs: number;
  enabled: boolean;
  loader: () => Promise<T>;
  serialize?: (value: T) => string;
  deserialize?: (raw: string) => T;
};

const DEFAULT_SERIALIZE = JSON.stringify;
const DEFAULT_DESERIALIZE = JSON.parse;

export async function cacheGetOrSet<T>(
  options: CacheAsideOptions<T>,
): Promise<CacheLookupResult<T>> {
  const serialize = options.serialize ?? DEFAULT_SERIALIZE;
  const deserialize = options.deserialize ?? DEFAULT_DESERIALIZE;

  if (!options.enabled) {
    const value = await options.loader();
    return { value, hit: false, redisMs: 0 };
  }

  const started = performance.now();

  try {
    const cached = await options.redis.get(options.key);
    if (cached !== null) {
      return {
        value: deserialize(cached) as T,
        hit: true,
        redisMs: performance.now() - started,
      };
    }

    const lockKey = lockKeyFor(options.key);
    const acquired = await options.redis.set(lockKey, "1", "PX", options.lockMs, "NX");

    if (acquired === "OK") {
      try {
        const value = await options.loader();
        const ttl = ttlWithJitter(options.ttlSeconds);
        await options.redis.set(options.key, serialize(value), "EX", ttl);
        return { value, hit: false, redisMs: performance.now() - started };
      } finally {
        await options.redis.del(lockKey);
      }
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await sleep(40 + attempt * 30);
      const retry = await options.redis.get(options.key);
      if (retry !== null) {
        return {
          value: deserialize(retry) as T,
          hit: true,
          redisMs: performance.now() - started,
        };
      }
    }

    const value = await options.loader();
    return { value, hit: false, redisMs: performance.now() - started };
  } catch {
    const value = await options.loader();
    return { value, hit: false, redisMs: performance.now() - started };
  }
}

export async function cacheDelete(redis: Redis, key: string): Promise<void> {
  await redis.del(key);
}

export async function cacheGet<T>(
  redis: Redis,
  key: string,
  deserialize: (raw: string) => T = DEFAULT_DESERIALIZE as (raw: string) => T,
): Promise<T | null> {
  const raw = await redis.get(key);
  if (raw === null) return null;
  return deserialize(raw);
}

export async function cacheSet<T>(
  redis: Redis,
  key: string,
  value: T,
  ttlSeconds: number,
  serialize: (value: T) => string = DEFAULT_SERIALIZE as (value: T) => string,
): Promise<void> {
  await redis.set(key, serialize(value), "EX", ttlWithJitter(ttlSeconds));
}
