import type { CacheResource } from "@weightloss/cache";
import type { FastifyInstance } from "fastify";

export async function bumpCacheResources(app: FastifyInstance, resources: CacheResource[]) {
  if (!app.cache.enabled) return;
  await app.cache.bumpVersions(resources);
}

export async function bumpContentCache(app: FastifyInstance, resources: CacheResource[]) {
  const unique = [...new Set<CacheResource>([...resources, "dashboard"])];
  await bumpCacheResources(app, unique);
}
