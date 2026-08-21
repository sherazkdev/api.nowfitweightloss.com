import type { FastifyInstance } from "fastify";
import type { AppEnv } from "@weightloss/config";
import { getMongo, pingMongo } from "@weightloss/database";
import { createAuthService, type AuthService } from "@weightloss/auth";
import { createStorageProvider, type StorageProvider } from "@weightloss/storage";
import { createQueueConnection, createQueueService, type QueueService } from "@weightloss/queue";
import {
  CacheService,
  RateLimiter,
  closeRedis,
  connectRedis,
  createCacheService,
  getRedis,
  pingRedis,
  type RedisClients,
} from "@weightloss/cache";
import { resolveRequestIp } from "./lib/request-ip.js";

declare module "fastify" {
  interface FastifyInstance {
    env: AppEnv;
    redis: RedisClients;
    cache: CacheService;
    rateLimiter: RateLimiter;
    auth: AuthService;
    storage: StorageProvider;
    queues: QueueService;
    queueConnection: import("ioredis").Redis;
  }

  interface FastifyRequest {
    startTime?: number;
    cacheHit?: boolean;
    rateLimit?: {
      limit: number;
      remaining: number;
      resetMs: number;
    };
  }
}

export async function registerInfrastructure(app: FastifyInstance, env: AppEnv) {
  const redis = await connectRedis(env);
  const cache = createCacheService(redis.cache, env);
  const rateLimiter = new RateLimiter(env);
  const { db } = getMongo();
  const auth = createAuthService(env, db, redis.auth);
  const storage = createStorageProvider(env);
  const queueConnection = createQueueConnection(env);
  const queues = createQueueService(env, queueConnection);

  app.decorate("env", env);
  app.decorate("redis", redis);
  app.decorate("cache", cache);
  app.decorate("rateLimiter", rateLimiter);
  app.decorate("auth", auth);
  app.decorate("storage", storage);
  app.decorate("queues", queues);
  app.decorate("queueConnection", queueConnection);

  app.addHook("onRequest", async (request, reply) => {
    const path = request.url.split("?")[0] ?? request.url;
    if (path === "/health" || path === "/ready" || path === app.env.METRICS_PATH) return;

    const isAdmin = path.startsWith("/api/admin");
    const bucket = isAdmin ? "admin" : "public";
    const identifier = `ip:${resolveRequestIp(request, env)}`;

    const result = await rateLimiter.check(redis.cache, bucket, identifier);
    request.rateLimit = {
      limit: result.limit,
      remaining: result.remaining,
      resetMs: result.resetMs,
    };

    reply.header("X-RateLimit-Limit", String(result.limit));
    reply.header("X-RateLimit-Remaining", String(result.remaining));

    if (!result.allowed) {
      return reply.status(429).send({
        success: false,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests",
        },
        requestId: request.id,
      });
    }
  });

  app.addHook("onClose", async () => {
    await app.queues.close();
    await queueConnection.quit();
    await closeRedis();
  });
}

export async function readinessCheck(): Promise<{ mongo: boolean; redis: boolean }> {
  const { db } = getMongo();
  await pingMongo(db);
  await pingRedis(getRedis());
  return { mongo: true, redis: true };
}
