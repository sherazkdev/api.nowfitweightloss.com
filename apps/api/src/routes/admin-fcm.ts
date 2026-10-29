import { z } from "zod";
import type { FastifyInstance, FastifyReply } from "fastify";
import {
  adminFcmOverviewCacheKey,
  getAdminFcmOverview,
  getMongo,
} from "@weightloss/database";
import { isFirebaseConfigured, sendWorkoutReminderPush, initFirebase } from "@weightloss/firebase";
import { requireAdminAuth } from "../plugins/auth.js";

const testBodySchema = z.object({
  fcm_token: z.string().trim().min(1),
  platform: z.enum(["android", "ios"]).default("android"),
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

export async function registerAdminFcmRoutes(app: FastifyInstance) {
  app.get(
    "/api/admin/fcm/overview",
    {
      preHandler: requireAdminAuth,
      schema: {
        tags: ["FCM"],
        summary: "FCM overview dashboard data",
        security: adminDocsSecurity,
      },
    },
    async (request, reply) => {
      const result = await app.cache.adminGetOrSet(
        "fcmOverview",
        adminFcmOverviewCacheKey(),
        app.cache.notificationsTtl(),
        async () => {
          const { db } = getMongo();
          return getAdminFcmOverview(db, {
            firebaseConfigured: isFirebaseConfigured(app.env),
            schedulerEnabled: app.env.WORKOUT_REMINDERS_CRON_ENABLED,
            apiHealthy: true,
          });
        },
      );

      request.cacheHit = result.hit;
      reply.header("X-Cache-Hit", result.hit ? "1" : "0");

      return reply.send({ success: true, data: result.value });
    },
  );

  app.post(
    "/api/admin/fcm/test-notification",
    {
      preHandler: requireAdminAuth,
      schema: {
        tags: ["FCM"],
        summary: "Send an FCM test push",
        security: adminDocsSecurity,
        body: {
          type: "object",
          required: ["fcm_token"],
          properties: {
            fcm_token: { type: "string", description: "Target device FCM token" },
            platform: { type: "string", enum: ["android", "ios"], default: "android" },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = testBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return validationError(reply, "Invalid request body");
      }

      if (!isFirebaseConfigured(app.env)) {
        return reply.status(503).send({
          success: false,
          error: { code: "FIREBASE_NOT_CONFIGURED", message: "Firebase is not configured" },
        });
      }

      initFirebase(app.env);
      const result = await sendWorkoutReminderPush(
        app.env,
        [{ token: parsed.data.fcm_token, platform: parsed.data.platform }],
        {
          reminderId: 0,
          gender: "male",
        },
      );

      return reply.send({
        success: true,
        data: {
          successCount: result.successCount,
          failureCount: result.failureCount,
        },
      });
    },
  );
}
