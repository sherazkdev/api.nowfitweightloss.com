import type { Redis } from "ioredis";
import type { CacheResource } from "./types.js";
import { CACHE_VERSION_KEYS } from "./types.js";

export function prefixKey(envPrefix: string, key: string): string {
  return `${envPrefix}${key}`;
}

export async function getCacheVersion(redis: Redis, resource: CacheResource): Promise<number> {
  const raw = await redis.get(CACHE_VERSION_KEYS[resource]);
  if (!raw) return 1;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export async function bumpCacheVersion(redis: Redis, resource: CacheResource): Promise<number> {
  return redis.incr(CACHE_VERSION_KEYS[resource]);
}

export async function bumpCacheVersions(
  redis: Redis,
  resources: CacheResource[],
): Promise<void> {
  if (resources.length === 0) return;
  const pipeline = redis.pipeline();
  for (const resource of resources) {
    pipeline.incr(CACHE_VERSION_KEYS[resource]);
  }
  await pipeline.exec();
}

export function buildPublicCacheKey(
  resource: CacheResource,
  parts: string[],
  version: number,
): string {
  const normalized = parts.map((part) => part.replace(/:/g, "_")).join(":");
  return `public:${resource}:${normalized}:v${version}`;
}

export function buildAdminCacheKey(resource: CacheResource, parts: string[], version: number): string {
  const normalized = parts.map((part) => part.replace(/:/g, "_")).join(":");
  return `admin:${resource}:${normalized}:v${version}`;
}

export function lockKeyFor(cacheKey: string): string {
  return `lock:${cacheKey}`;
}
