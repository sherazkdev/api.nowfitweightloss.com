import type { Redis } from "ioredis";
import type { AppEnv } from "@weightloss/config";
import { parseDurationMs } from "./time.js";
import type { RateLimitBucket, RateLimitResult } from "./types.js";

type BucketConfig = {
  max: number;
  windowMs: number;
};

export class RateLimiter {
  private readonly configs: Record<RateLimitBucket, BucketConfig>;
  private readonly enabled: boolean;

  constructor(env: AppEnv) {
    this.enabled = env.RATE_LIMIT_ENABLED;
    this.configs = {
      public: {
        max: env.RATE_LIMIT_PUBLIC_MAX,
        windowMs: parseDurationMs(env.RATE_LIMIT_PUBLIC_WINDOW),
      },
      admin: {
        max: env.RATE_LIMIT_ADMIN_MAX,
        windowMs: parseDurationMs(env.RATE_LIMIT_ADMIN_WINDOW),
      },
      login: {
        max: env.RATE_LIMIT_LOGIN_MAX,
        windowMs: parseDurationMs(env.RATE_LIMIT_LOGIN_WINDOW),
      },
      upload: {
        max: env.RATE_LIMIT_UPLOAD_MAX,
        windowMs: parseDurationMs(env.RATE_LIMIT_UPLOAD_WINDOW),
      },
      import: {
        max: env.RATE_LIMIT_IMPORT_MAX,
        windowMs: parseDurationMs(env.RATE_LIMIT_IMPORT_WINDOW),
      },
    };
  }

  async check(
    redis: Redis,
    bucket: RateLimitBucket,
    identifier: string,
  ): Promise<RateLimitResult> {
    const config = this.configs[bucket];

    if (!this.enabled) {
      return {
        allowed: true,
        limit: config.max,
        remaining: config.max,
        resetMs: config.windowMs,
      };
    }

    const key = `ratelimit:${bucket}:${identifier}`;

    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.pexpire(key, config.windowMs);
      }

      const ttl = await redis.pttl(key);
      const remaining = Math.max(0, config.max - count);

      return {
        allowed: count <= config.max,
        limit: config.max,
        remaining,
        resetMs: ttl > 0 ? ttl : config.windowMs,
      };
    } catch {
      // Fail open for public traffic if Redis is down; auth-specific routes override in Phase 4.
      if (bucket === "login" || bucket === "admin") {
        return {
          allowed: false,
          limit: config.max,
          remaining: 0,
          resetMs: config.windowMs,
        };
      }

      return {
        allowed: true,
        limit: config.max,
        remaining: config.max,
        resetMs: config.windowMs,
      };
    }
  }
}

export function clientIp(headers: Record<string, string | string[] | undefined>): string {
  const forwarded = headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return "unknown";
}
