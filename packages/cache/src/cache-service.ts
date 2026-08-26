import type { AppEnv } from "@weightloss/config";
import type { Redis } from "ioredis";
import { cacheDelete, cacheGet, cacheGetOrSet, cacheSet } from "./cache-aside.js";
import {
  buildAdminCacheKey,
  buildPublicCacheKey,
  bumpCacheVersion,
  bumpCacheVersions,
  getCacheVersion,
} from "./keys.js";
import type { CacheResource } from "./types.js";

export class CacheService {
  constructor(
    private readonly redis: Redis,
    private readonly env: AppEnv,
  ) {}

  get enabled(): boolean {
    return this.env.CACHE_ENABLED;
  }

  detailTtl(): number {
    return this.env.CACHE_DETAIL_TTL_SECONDS;
  }

  listTtl(): number {
    return this.env.CACHE_LIST_TTL_SECONDS;
  }

  dashboardTtl(): number {
    return this.env.CACHE_DASHBOARD_TTL_SECONDS;
  }

  notificationsTtl(): number {
    return this.env.CACHE_ADMIN_NOTIFICATIONS_TTL_SECONDS;
  }

  summaryTtl(): number {
    return this.env.CACHE_ADMIN_SUMMARY_TTL_SECONDS;
  }

  negativeTtl(): number {
    return this.env.CACHE_NEGATIVE_TTL_SECONDS;
  }

  stampedeLockMs(): number {
    return this.env.CACHE_STAMPEDE_LOCK_MS;
  }

  async getVersion(resource: CacheResource): Promise<number> {
    return getCacheVersion(this.redis, resource);
  }

  async bumpVersion(resource: CacheResource): Promise<number> {
    return bumpCacheVersion(this.redis, resource);
  }

  async bumpVersions(resources: CacheResource[]): Promise<void> {
    return bumpCacheVersions(this.redis, resources);
  }

  async publicGetOrSet<T>(
    resource: CacheResource,
    parts: string[],
    ttlSeconds: number,
    loader: () => Promise<T>,
  ) {
    const version = await this.getVersion(resource);
    const key = buildPublicCacheKey(resource, parts, version);
    return cacheGetOrSet({
      redis: this.redis,
      key,
      ttlSeconds,
      lockMs: this.stampedeLockMs(),
      enabled: this.enabled,
      loader,
    });
  }

  async adminGetOrSet<T>(
    resource: CacheResource,
    parts: string[],
    ttlSeconds: number,
    loader: () => Promise<T>,
  ) {
    const version = await this.getVersion(resource);
    const key = buildAdminCacheKey(resource, parts, version);
    return cacheGetOrSet({
      redis: this.redis,
      key,
      ttlSeconds,
      lockMs: this.stampedeLockMs(),
      enabled: this.enabled,
      loader,
    });
  }

  get = cacheGet;
  set = cacheSet;
  del = cacheDelete;
}

export function createCacheService(redis: Redis, env: AppEnv): CacheService {
  return new CacheService(redis, env);
}
