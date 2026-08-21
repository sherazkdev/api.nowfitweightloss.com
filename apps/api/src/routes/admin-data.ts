import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { clientIp } from "@weightloss/cache";
import { extractRawRecords, getMongo, importRawRecords, type RawImportResource } from "@weightloss/database";
import { bumpContentCache } from "../lib/cache-bump.js";
import { requireAdminAuth } from "../plugins/auth.js";

const rawImportResourceSchema = z.enum([
  "meal-categories",
  "meals",
  "workout-levels",
  "workout-categories",
  "exercises",
]);

const rawUploadBodySchema = z.object({
  resource: rawImportResourceSchema,
  records: z.array(z.unknown()).optional(),
  payload: z.string().optional(),
});

function extractRecordsFromBody(body: z.infer<typeof rawUploadBodySchema>): unknown[] {
  if (body.records && body.records.length > 0) {
    return body.records;
  }

  if (!body.payload?.trim()) {
    throw new Error("records or payload is required");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body.payload);
  } catch {
    throw new Error("Invalid JSON payload");
  }

  const records = extractRawRecords(parsed);
  if (!records || records.length === 0) {
    throw new Error("No records found in JSON payload");
  }

  return records;
}

export async function registerAdminDataRoutes(app: FastifyInstance) {
  app.post("/api/admin/raw-upload", { preHandler: requireAdminAuth }, async (request, reply) => {
    const importLimit = await app.rateLimiter.check(
      app.redis.cache,
      "import",
      `admin:${request.admin!.id}:ip:${clientIp(request.headers)}`,
    );

    reply.header("X-RateLimit-Limit", String(importLimit.limit));
    reply.header("X-RateLimit-Remaining", String(importLimit.remaining));

    if (!importLimit.allowed) {
      return reply.status(429).send({
        success: false,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many import requests",
        },
        requestId: request.id,
      });
    }

    const parsed = rawUploadBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid raw upload request",
        },
        requestId: request.id,
      });
    }

    let records: unknown[];
    try {
      records = extractRecordsFromBody(parsed.data);
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error instanceof Error ? error.message : "Invalid payload",
        },
        requestId: request.id,
      });
    }

    const { db } = getMongo();
    const result = await importRawRecords(
      db,
      parsed.data.resource as RawImportResource,
      records,
    );

    const cacheMap: Record<RawImportResource, import("@weightloss/cache").CacheResource> = {
      "meal-categories": "mealCategories",
      meals: "meals",
      "workout-levels": "workoutLevels",
      "workout-categories": "workoutCategories",
      exercises: "exercises",
    };
    await bumpContentCache(app, [cacheMap[parsed.data.resource as RawImportResource]]);

    return reply.send({
      success: true,
      data: {
        resource: parsed.data.resource,
        ...result,
        saved: result.inserted + result.updated,
      },
    });
  });
}
