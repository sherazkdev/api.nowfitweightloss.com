import { Redis } from "ioredis";
import type { AppEnv } from "@weightloss/config";
import { resolveRedisUrls } from "@weightloss/config";

export type RedisRole = "cache" | "auth" | "queue";

export type RedisClients = {
  cache: Redis;
  auth: Redis;
  queue: Redis;
};

let clients: RedisClients | null = null;

function createClient(url: string, env: AppEnv, role: RedisRole): Redis {
  const client = new Redis(url, {
    maxRetriesPerRequest: role === "queue" ? null : 3,
    enableReadyCheck: true,
    lazyConnect: false,
    keyPrefix: env.REDIS_KEY_PREFIX,
  });

  client.on("error", () => {
    // Connection errors are handled per operation; avoid crashing the process.
  });

  return client;
}

export async function connectRedis(env: AppEnv): Promise<RedisClients> {
  if (clients) return clients;

  const urls = resolveRedisUrls(env);
  clients = {
    cache: createClient(urls.cache, env, "cache"),
    auth: createClient(urls.auth, env, "auth"),
    queue: createClient(urls.queue, env, "queue"),
  };

  await Promise.all([clients.cache.ping(), clients.auth.ping(), clients.queue.ping()]);
  return clients;
}

export function getRedis(): RedisClients {
  if (!clients) {
    throw new Error("Redis is not connected. Call connectRedis() first.");
  }
  return clients;
}

export async function pingRedis(clientsRef: RedisClients): Promise<void> {
  await Promise.all([clientsRef.cache.ping(), clientsRef.auth.ping(), clientsRef.queue.ping()]);
}

export async function closeRedis(): Promise<void> {
  if (!clients) return;
  await Promise.all([
    clients.cache.quit(),
    clients.auth.quit(),
    clients.queue.quit(),
  ]);
  clients = null;
}

export function resetRedisForTests(): void {
  clients = null;
}

export { Redis };
