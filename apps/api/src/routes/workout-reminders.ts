import { z } from "zod";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { WorkoutReminderDocument } from "@weightloss/contracts";
import {
  createWorkoutReminder,
  deleteWorkoutReminder,
  deleteUserDeviceByToken,
  findWorkoutReminderForUser,
  getMongo,
  listWorkoutRemindersByUser,
  setWorkoutReminderEnabled,
  updateWorkoutReminder,
  upsertUserDevice,
} from "@weightloss/database";
import { isValidIanaTimezone } from "@weightloss/shared";
import { bumpCacheResources } from "../lib/cache-bump.js";
import { requireFirebaseAuth } from "../plugins/firebase-auth.js";

const genderSchema = z.enum(["male", "female"]);
const daySchema = z.number().int().min(0).max(6);

const reminderBodySchema = z.object({
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
  days: z.array(daySchema),
  enabled: z.boolean().default(true),
  gender: genderSchema,
  timezone: z.string().trim().min(1),
});

const toggleBodySchema = z.object({
  enabled: z.boolean(),
});

const deviceBodySchema = z.object({
  fcm_token: z.string().trim().min(1),
  platform: z.enum(["android", "ios"]),
});

const unregisterDeviceBodySchema = z.object({
  fcm_token: z.string().trim().min(1),
});

function serializeReminder(doc: WorkoutReminderDocument) {
  return {
    id: doc.id,
    hour: doc.hour,
    minute: doc.minute,
    days: doc.days,
    enabled: doc.enabled,
    gender: doc.gender,
    timezone: doc.timezone,
  };
}

function validationError(reply: FastifyReply, message: string, errors?: Record<string, string[]>) {
  return reply.status(422).send({
    success: false,
    message,
    ...(errors ? { errors } : {}),
  });
}

function notFound(reply: FastifyReply) {
  return reply.status(404).send({
    success: false,
    message: "Reminder not found",
  });
}

function getFirebaseUid(request: FastifyRequest): string {
  return request.firebaseUid ?? "";
}

function validateReminderBody(body: unknown, reply: FastifyReply) {
  const parsed = reminderBodySchema.safeParse(body);
  if (!parsed.success) {
    validationError(reply, "Validation failed", {
      ...Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.join(".") || "body", [issue.message]]),
      ),
    });
    return null;
  }

  if (!isValidIanaTimezone(parsed.data.timezone)) {
    validationError(reply, "Validation failed", {
      timezone: ["Invalid IANA timezone."],
    });
    return null;
  }

  return parsed.data;
}

export async function registerWorkoutReminderRoutes(app: FastifyInstance) {
  app.get(
    "/api/v1/workout-reminders",
    { preHandler: requireFirebaseAuth },
    async (request, reply) => {
      const genderParsed = genderSchema.safeParse(
        (request.query as Record<string, unknown>).gender,
      );
      if (!genderParsed.success) {
        return validationError(reply, "Validation failed", {
          gender: ["gender must be male or female"],
        });
      }

      const uid = getFirebaseUid(request);
      const result = await app.cache.publicGetOrSet(
        "workoutReminders",
        ["mobile", uid, genderParsed.data],
        app.cache.notificationsTtl(),
        async () => {
          const { db } = getMongo();
          const rows = await listWorkoutRemindersByUser(db, uid, genderParsed.data);
          return rows.map(serializeReminder);
        },
      );

      request.cacheHit = result.hit;
      reply.header("X-Cache-Hit", result.hit ? "1" : "0");

      return reply.send({
        success: true,
        data: result.value,
      });
    },
  );

  app.post(
    "/api/v1/workout-reminders",
    { preHandler: requireFirebaseAuth },
    async (request, reply) => {
      const body = validateReminderBody(request.body, reply);
      if (!body) return;

      const { db } = getMongo();
      const created = await createWorkoutReminder(db, {
        firebaseUid: getFirebaseUid(request),
        gender: body.gender,
        hour: body.hour,
        minute: body.minute,
        days: body.days,
        enabled: body.enabled,
        timezone: body.timezone,
      });

      await bumpCacheResources(app, ["workoutReminders"]);

      return reply.status(201).send({
        success: true,
        data: serializeReminder(created),
      });
    },
  );

  app.put(
    "/api/v1/workout-reminders/:id",
    { preHandler: requireFirebaseAuth },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id);
      if (!Number.isInteger(id) || id < 1) {
        return validationError(reply, "Validation failed", { id: ["Invalid reminder id"] });
      }

      const body = validateReminderBody(request.body, reply);
      if (!body) return;

      const { db } = getMongo();
      const existing = await findWorkoutReminderForUser(db, id, getFirebaseUid(request));
      if (!existing) {
        return notFound(reply);
      }

      const updated = await updateWorkoutReminder(db, id, getFirebaseUid(request), {
        firebaseUid: getFirebaseUid(request),
        gender: body.gender,
        hour: body.hour,
        minute: body.minute,
        days: body.days,
        enabled: body.enabled,
        timezone: body.timezone,
      });

      await bumpCacheResources(app, ["workoutReminders"]);

      return reply.send({
        success: true,
        data: serializeReminder(updated!),
      });
    },
  );

  app.patch(
    "/api/v1/workout-reminders/:id/toggle",
    { preHandler: requireFirebaseAuth },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id);
      if (!Number.isInteger(id) || id < 1) {
        return validationError(reply, "Validation failed", { id: ["Invalid reminder id"] });
      }

      const parsed = toggleBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return validationError(reply, "Validation failed");
      }

      const { db } = getMongo();
      const existing = await findWorkoutReminderForUser(db, id, getFirebaseUid(request));
      if (!existing) {
        return notFound(reply);
      }

      const updated = await setWorkoutReminderEnabled(
        db,
        id,
        getFirebaseUid(request),
        parsed.data.enabled,
      );

      await bumpCacheResources(app, ["workoutReminders"]);

      return reply.send({
        success: true,
        data: serializeReminder(updated!),
      });
    },
  );

  app.delete(
    "/api/v1/workout-reminders/:id",
    { preHandler: requireFirebaseAuth },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id);
      if (!Number.isInteger(id) || id < 1) {
        return validationError(reply, "Validation failed", { id: ["Invalid reminder id"] });
      }

      const { db } = getMongo();
      const deleted = await deleteWorkoutReminder(db, id, getFirebaseUid(request));
      if (!deleted) {
        return notFound(reply);
      }

      await bumpCacheResources(app, ["workoutReminders"]);

      return reply.send({
        success: true,
        message: "Reminder deleted",
      });
    },
  );

  app.post(
    "/api/v1/devices",
    { preHandler: requireFirebaseAuth },
    async (request, reply) => {
      const parsed = deviceBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return validationError(reply, "Validation failed");
      }

      const { db } = getMongo();
      await upsertUserDevice(db, {
        firebaseUid: getFirebaseUid(request),
        fcmToken: parsed.data.fcm_token,
        platform: parsed.data.platform,
      });

      await bumpCacheResources(app, ["userDevices"]);

      return reply.send({
        success: true,
        message: "Device registered",
      });
    },
  );

  app.delete(
    "/api/v1/devices",
    { preHandler: requireFirebaseAuth },
    async (request, reply) => {
      const parsed = unregisterDeviceBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return validationError(reply, "Validation failed");
      }

      const { db } = getMongo();
      await deleteUserDeviceByToken(
        db,
        getFirebaseUid(request),
        parsed.data.fcm_token,
      );

      await bumpCacheResources(app, ["userDevices"]);

      return reply.send({
        success: true,
        message: "Device unregistered",
      });
    },
  );
}
