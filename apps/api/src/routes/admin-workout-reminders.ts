import { z } from "zod";
import type { FastifyInstance, FastifyReply } from "fastify";
import {
  adminWorkoutReminderCacheKey,
  adminWorkoutReminderSummaryCacheKey,
  deleteAdminWorkoutReminder,
  getMongo,
  listAdminWorkoutReminderItems,
  toggleAdminWorkoutReminder,
} from "@weightloss/database";
import { bumpCacheResources } from "../lib/cache-bump.js";
import {
  getAdminWorkoutReminderSummary,
  loadWorkoutReminderSummary,
} from "../lib/notification-snapshots.js";
import { requireAdminAuth } from "../plugins/auth.js";

const listQuerySchema = z.object({
  gender: z.enum(["male", "female"]).optional(),
  status: z.enum(["enabled", "paused"]).optional(),
  timezone: z.string().trim().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.coerce.number().int().positive().optional(),
});

const toggleBodySchema = z.object({
  enabled: z.boolean(),
});

const adminDocsSecurity: Array<{ [securityLabel: string]: string[] }> = [
  { BearerAuth: [] },
  { ApiKeyAuth: [] },
];

function validationError(reply: FastifyReply, message: string) {
  return reply.status(422).send({
    success: false,
    error: { code: "VALIDATION_ERROR", message },
  });
}

export async function registerAdminWorkoutReminderRoutes(app: FastifyInstance) {
  app.get(
    "/api/admin/workout-reminders/summary",
    {
      preHandler: requireAdminAuth,
      schema: {
        tags: ["Reminders"],
        summary: "Workout reminder stats + analytics",
        security: adminDocsSecurity,
      },
    },
    async (request, reply) => {
      const result = await app.cache.adminGetOrSet(
        "workoutReminders",
        adminWorkoutReminderSummaryCacheKey(),
        app.cache.summaryTtl(),
        async () => {
          const { db } = getMongo();
          const loaded = await loadWorkoutReminderSummary(app.env, app.redis.cache, () =>
            getAdminWorkoutReminderSummary(db),
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
    "/api/admin/workout-reminders",
    {
      preHandler: requireAdminAuth,
      schema: {
        tags: ["Reminders"],
        summary: "List workout reminders",
        description: "Paginated admin list. Filter with gender, status, timezone, search.",
        security: adminDocsSecurity,
        querystring: {
          type: "object",
          additionalProperties: true,
          properties: {
            gender: { type: "string", enum: ["male", "female"] },
            status: { type: "string", enum: ["enabled", "paused"], description: "enabled or paused" },
            timezone: { type: "string", description: "IANA timezone, e.g. Asia/Karachi" },
            search: { type: "string", description: "Search uid / reminder fields" },
            page: { type: "integer", minimum: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100 },
            cursor: { type: "integer", minimum: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = listQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return validationError(reply, "Invalid query parameters");
      }

      const snapshot = await loadWorkoutReminderSummary(app.env, app.redis.cache, async () => {
        const { db } = getMongo();
        return getAdminWorkoutReminderSummary(db);
      });

      const listFilters = {
        ...parsed.data,
        totalHint: snapshot.data.stats.total,
      };

      const result = await app.cache.adminGetOrSet(
        "workoutReminders",
        adminWorkoutReminderCacheKey(listFilters),
        app.cache.notificationsTtl(),
        async () => {
          const { db } = getMongo();
          return listAdminWorkoutReminderItems(db, listFilters);
        },
      );

      request.cacheHit = result.hit;
      reply.header("X-Cache-Hit", result.hit ? "1" : "0");

      return reply.send({ success: true, data: result.value });
    },
  );

  app.patch(
    "/api/admin/workout-reminders/:id/toggle",
    {
      preHandler: requireAdminAuth,
      schema: {
        tags: ["Reminders"],
        summary: "Enable or pause a reminder",
        security: adminDocsSecurity,
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", description: "Reminder id" } },
        },
        body: {
          type: "object",
          required: ["enabled"],
          properties: { enabled: { type: "boolean" } },
        },
      },
    },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id);
      if (!Number.isInteger(id) || id < 1) {
        return validationError(reply, "Invalid reminder id");
      }

      const parsed = toggleBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return validationError(reply, "Invalid request body");
      }

      const { db } = getMongo();
      const updated = await toggleAdminWorkoutReminder(db, id, parsed.data.enabled);
      if (!updated) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Reminder not found" },
        });
      }

      await bumpCacheResources(app, ["workoutReminders", "dashboard"]);

      return reply.send({ success: true, data: updated });
    },
  );

  app.delete(
    "/api/admin/workout-reminders/:id",
    {
      preHandler: requireAdminAuth,
      schema: {
        tags: ["Reminders"],
        summary: "Delete a workout reminder",
        security: adminDocsSecurity,
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", description: "Reminder id" } },
        },
      },
    },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id);
      if (!Number.isInteger(id) || id < 1) {
        return validationError(reply, "Invalid reminder id");
      }

      const { db } = getMongo();
      const deleted = await deleteAdminWorkoutReminder(db, id);
      if (!deleted) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Reminder not found" },
        });
      }

      await bumpCacheResources(app, ["workoutReminders", "dashboard"]);

      return reply.send({ success: true, message: "Reminder deleted" });
    },
  );
}
