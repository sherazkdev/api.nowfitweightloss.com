import type { FastifyInstance } from "fastify";
import type { CacheResource } from "@weightloss/cache";
import { getMongo, pingMongo } from "@weightloss/database";
import { pingRedis, getRedis } from "@weightloss/cache";
import { requireAdminAuth } from "../plugins/auth.js";

const PUBLIC_CACHE_RESOURCES: CacheResource[] = [
  "mealCategories",
  "meals",
  "workoutLevels",
  "workoutCategories",
  "exercises",
];

async function timed<T>(fn: () => Promise<T>): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const started = performance.now();
  try {
    await fn();
    return { ok: true, latencyMs: Math.round(performance.now() - started) };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Math.round(performance.now() - started),
      error: error instanceof Error ? error.message : "Unavailable",
    };
  }
}

export async function registerAdminSystemRoutes(app: FastifyInstance) {
  app.get(
    "/api/admin/system",
    {
      preHandler: requireAdminAuth,
      schema: {
        tags: ["System"],
        summary: "Platform health and runtime status",
        security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
      },
    },
    async (_request, reply) => {
      const env = app.env;
      const { db } = getMongo();

      const [mongo, redis] = await Promise.all([
        timed(() => pingMongo(db)),
        timed(() => pingRedis(getRedis())),
      ]);

      const cacheVersions: Record<string, number> = {};
      for (const resource of PUBLIC_CACHE_RESOURCES) {
        cacheVersions[resource] = await app.cache.getVersion(resource);
      }

      let queues: Record<string, Record<string, number>> = {};
      try {
        queues = await app.queues.getQueueStats();
      } catch {
        queues = {};
      }

      let queueTotals = { waiting: 0, active: 0, failed: 0 };
      for (const counts of Object.values(queues)) {
        queueTotals.waiting += counts.waiting ?? 0;
        queueTotals.active += counts.active ?? 0;
        queueTotals.failed += counts.failed ?? 0;
      }

      const ready = mongo.ok && redis.ok;

      return reply.send({
        success: true,
        data: {
          status: ready ? "healthy" : "degraded",
          checkedAt: new Date().toISOString(),
          api: {
            name: env.APP_NAME,
            version: env.APP_VERSION,
            nodeEnv: env.NODE_ENV,
            uptimeSeconds: Math.floor(process.uptime()),
            publicUrl: env.API_PUBLIC_URL,
            adminUrl: env.ADMIN_PUBLIC_URL,
          },
          dependencies: {
            mongo,
            redis,
          },
          cache: {
            enabled: env.CACHE_ENABLED,
            listTtlSeconds: env.CACHE_LIST_TTL_SECONDS,
            versions: cacheVersions,
          },
          queues: {
            totals: queueTotals,
            byQueue: queues,
          },
          storage: {
            driver: env.STORAGE_DRIVER,
            uploadRoot: env.UPLOAD_ROOT,
            publicMediaBaseUrl: env.PUBLIC_MEDIA_BASE_URL,
          },
          features: {
            metricsEnabled: env.METRICS_ENABLED,
            metricsPath: env.METRICS_PATH,
            apiDocsEnabled: env.API_DOCS_ENABLED,
            publicOpenApi: "/api/v1/openapi.json",
            publicDocsUi: env.API_DOCS_ENABLED ? "/docs/public" : null,
          },
        },
      });
    },
  );
}
