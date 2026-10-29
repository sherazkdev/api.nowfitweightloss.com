import { z } from "zod";
import type { FastifyInstance, FastifyReply } from "fastify";
import {
  adminDeliveryLogCacheKey,
  adminDeliveryLogSummaryCacheKey,
  findNotificationDeliveryById,
  findWorkoutReminderById,
  getAdminDeliveryLogSummary,
  getMongo,
  listAdminDeliveryLogs,
  listUserDevicePushTargets,
  recordNotificationDelivery,
} from "@weightloss/database";
import { initFirebase, isFirebaseConfigured, sendWorkoutReminderPush } from "@weightloss/firebase";
import { buildReminderSlotKey, getZonedDateParts } from "@weightloss/shared";
import { bumpCacheResources } from "../lib/cache-bump.js";
import { requireAdminAuth } from "../plugins/auth.js";

const listQuerySchema = z.object({
  status: z.enum(["delivered", "failed", "partial", "skipped"]).optional(),
  platform: z.enum(["android", "ios"]).optional(),
  search: z.string().trim().optional(),
  days: z.coerce.number().int().positive().max(90).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.coerce.number().int().positive().optional(),
});

const summaryQuerySchema = z.object({
  days: z.coerce.number().int().positive().max(90).optional(),
});

function validationError(reply: FastifyReply, message: string) {
  return reply.status(422).send({
    success: false,
    error: { code: "VALIDATION_ERROR", message },
  });
}

const adminDocsSecurity: Array<{ [securityLabel: string]: string[] }> = [
  { BearerAuth: [] },
  { ApiKeyAuth: [] },
];

export async function registerAdminDeliveryLogRoutes(app: FastifyInstance) {
  app.get(
    "/api/admin/delivery-logs/summary",
    {
      preHandler: requireAdminAuth,
      schema: {
        tags: ["Delivery logs"],
        summary: "Delivery log stats + analytics",
        security: adminDocsSecurity,
        querystring: {
          type: "object",
          additionalProperties: true,
          properties: {
            days: { type: "integer", minimum: 1, maximum: 90, description: "Lookback window (default 30)" },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = summaryQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return validationError(reply, "Invalid query parameters");
      }

      const days = parsed.data.days ?? 30;
      const result = await app.cache.adminGetOrSet(
        "deliveryLogs",
        adminDeliveryLogSummaryCacheKey(days),
        app.cache.summaryTtl(),
        async () => {
          const { db } = getMongo();
          return getAdminDeliveryLogSummary(db, {
            days,
            schedulerEnabled: app.env.WORKOUT_REMINDERS_CRON_ENABLED,
          });
        },
      );

      request.cacheHit = result.hit;
      reply.header("X-Cache-Hit", result.hit ? "1" : "0");

      return reply.send({ success: true, data: result.value });
    },
  );

  app.get(
    "/api/admin/delivery-logs",
    {
      preHandler: requireAdminAuth,
      schema: {
        tags: ["Delivery logs"],
        summary: "List notification delivery logs",
        security: adminDocsSecurity,
        querystring: {
          type: "object",
          additionalProperties: true,
          properties: {
            status: { type: "string", enum: ["delivered", "failed", "partial", "skipped"] },
            platform: { type: "string", enum: ["android", "ios"] },
            search: { type: "string" },
            days: { type: "integer", minimum: 1, maximum: 90 },
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

      const result = await app.cache.adminGetOrSet(
        "deliveryLogs",
        adminDeliveryLogCacheKey(parsed.data),
        app.cache.notificationsTtl(),
        async () => {
          const { db } = getMongo();
          return listAdminDeliveryLogs(db, parsed.data);
        },
      );

      request.cacheHit = result.hit;
      reply.header("X-Cache-Hit", result.hit ? "1" : "0");

      return reply.send({ success: true, data: result.value });
    },
  );

  app.post(
    "/api/admin/delivery-logs/:id/retry",
    {
      preHandler: requireAdminAuth,
      schema: {
        tags: ["Delivery logs"],
        summary: "Retry a failed reminder push",
        security: adminDocsSecurity,
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", description: "Delivery log id" } },
        },
      },
    },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id);
      if (!Number.isInteger(id) || id < 1) {
        return validationError(reply, "Invalid delivery log id");
      }

      if (!isFirebaseConfigured(app.env)) {
        return reply.status(503).send({
          success: false,
          error: { code: "FIREBASE_NOT_CONFIGURED", message: "Firebase is not configured" },
        });
      }

      const { db } = getMongo();
      const logEntry = await findNotificationDeliveryById(db, id);
      if (!logEntry) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Delivery log not found" },
        });
      }

      const reminder = await findWorkoutReminderById(db, logEntry.reminderId);
      if (!reminder) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Reminder no longer exists" },
        });
      }

      const devices = await listUserDevicePushTargets(db, reminder.firebaseUid);
      initFirebase(app.env);

      let successCount = 0;
      let failureCount = 0;
      let errorMessage: string | null = null;

      if (devices.length === 0) {
        errorMessage = "No registered device tokens";
      } else {
        try {
          const result = await sendWorkoutReminderPush(app.env, devices, {
            reminderId: reminder.id,
            gender: reminder.gender,
          });
          successCount = result.successCount;
          failureCount = result.failureCount;
        } catch (error) {
          errorMessage = error instanceof Error ? error.message : "Send failed";
          failureCount = devices.length;
        }
      }

      const zoned = getZonedDateParts(reminder.timezone);
      const slotKey = buildReminderSlotKey(zoned.dateKey, reminder.hour, reminder.minute);

      const created = await recordNotificationDelivery(db, {
        firebaseUid: reminder.firebaseUid,
        reminderId: reminder.id,
        gender: reminder.gender,
        hour: reminder.hour,
        minute: reminder.minute,
        tokenCount: devices.length,
        successCount,
        failureCount,
        slotKey: `${slotKey}:retry:${Date.now()}`,
        errorMessage,
      });

      await bumpCacheResources(app, ["deliveryLogs", "fcmOverview"]);

      return reply.send({ success: true, data: created });
    },
  );
}
