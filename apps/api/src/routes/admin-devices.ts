import { z } from "zod";
import type { FastifyInstance, FastifyReply } from "fastify";
import {
  adminDeviceCacheKey,
  adminDeviceSummaryCacheKey,
  deleteAdminUserDevice,
  getMongo,
  listAdminUserDeviceItems,
} from "@weightloss/database";
import { bumpCacheResources } from "../lib/cache-bump.js";
import { getAdminDeviceSummary, loadDeviceSummary } from "../lib/notification-snapshots.js";
import { requireAdminAuth } from "../plugins/auth.js";

const listQuerySchema = z.object({
  platform: z.enum(["android", "ios"]).optional(),
  status: z.enum(["active", "stale"]).optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.coerce.number().int().positive().optional(),
});

function validationError(reply: FastifyReply, message: string) {
  return reply.status(422).send({
    success: false,
    error: { code: "VALIDATION_ERROR", message },
  });
}

export async function registerAdminDeviceRoutes(app: FastifyInstance) {
  app.get(
    "/api/admin/devices/summary",
    { preHandler: requireAdminAuth },
    async (request, reply) => {
      const result = await app.cache.adminGetOrSet(
        "userDevices",
        adminDeviceSummaryCacheKey(),
        app.cache.summaryTtl(),
        async () => {
          const { db } = getMongo();
          const loaded = await loadDeviceSummary(app.env, app.redis.cache, () =>
            getAdminDeviceSummary(db),
          );
          return loaded.data;
        },
      );

      request.cacheHit = result.hit;
      reply.header("X-Cache-Hit", result.hit ? "1" : "0");

      return reply.send({ success: true, data: result.value });
    },
  );

  app.get(
    "/api/admin/devices",
    { preHandler: requireAdminAuth },
    async (request, reply) => {
      const parsed = listQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return validationError(reply, "Invalid query parameters");
      }

      const snapshot = await loadDeviceSummary(app.env, app.redis.cache, async () => {
        const { db } = getMongo();
        return getAdminDeviceSummary(db);
      });

      const listFilters = {
        ...parsed.data,
        totalHint: snapshot.data.stats.total,
      };

      const result = await app.cache.adminGetOrSet(
        "userDevices",
        adminDeviceCacheKey(listFilters),
        app.cache.notificationsTtl(),
        async () => {
          const { db } = getMongo();
          return listAdminUserDeviceItems(db, listFilters);
        },
      );

      request.cacheHit = result.hit;
      reply.header("X-Cache-Hit", result.hit ? "1" : "0");

      return reply.send({ success: true, data: result.value });
    },
  );

  app.delete(
    "/api/admin/devices/:id",
    { preHandler: requireAdminAuth },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id);
      if (!Number.isInteger(id) || id < 1) {
        return validationError(reply, "Invalid device id");
      }

      const { db } = getMongo();
      const deleted = await deleteAdminUserDevice(db, id);
      if (!deleted) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Device not found" },
        });
      }

      await bumpCacheResources(app, ["userDevices", "dashboard"]);

      return reply.send({ success: true, message: "Device deleted" });
    },
  );
}
