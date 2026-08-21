import { createReadStream } from "node:fs";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { FastifyInstance, FastifyReply } from "fastify";
import { clientIp } from "@weightloss/cache";
import {
  countExportRecords,
  createDataJob,
  findDataJobById,
  listDataJobs,
} from "@weightloss/database";
import { getMongo } from "@weightloss/database";
import { requireAdminAuth } from "../plugins/auth.js";
import { runCsvExportNow, runCsvImportNow, runRawImportNow } from "../lib/run-data-jobs.js";

const resourceSchema = z.enum([
  "meal-categories",
  "meals",
  "workout-levels",
  "workout-categories",
  "exercises",
]);

const exportFiltersSchema = z.object({
  scope: z.enum(["all", "active", "inactive", "challenge"]).default("all"),
  gender: z.enum(["all", "male", "female", "both"]).default("all"),
  categoryId: z.number().int().positive().nullable().optional(),
  workoutLevelId: z.number().int().positive().nullable().optional(),
  workoutCategoryId: z.number().int().positive().nullable().optional(),
});

const exportBodySchema = z.object({
  resource: resourceSchema,
  columns: z
    .array(
      z.object({
        key: z.string().trim().min(1),
        label: z.string().trim().min(1),
      }),
    )
    .min(1),
  filters: exportFiltersSchema.optional(),
});

const exportPreviewBodySchema = z.object({
  resource: resourceSchema,
  filters: exportFiltersSchema.optional(),
});

function normalizeExportFilters(input: z.infer<typeof exportFiltersSchema> | undefined) {
  return {
    scope: input?.scope ?? "all",
    gender: input?.gender ?? "all",
    categoryId: input?.categoryId ?? null,
    workoutLevelId: input?.workoutLevelId ?? null,
    workoutCategoryId: input?.workoutCategoryId ?? null,
  } as const;
}

const rawImportBodySchema = z.object({
  resource: resourceSchema,
  payload: z.string().trim().min(2),
});

function validationError(reply: FastifyReply, message: string, requestId: string) {
  return reply.status(422).send({
    success: false,
    error: { code: "VALIDATION_ERROR", message },
    requestId,
  });
}

function serializeJob(job: NonNullable<Awaited<ReturnType<typeof findDataJobById>>>) {
  return {
    id: job.id,
    type: job.type,
    resource: job.resource,
    status: job.status,
    progress: job.progress,
    processed: job.processed,
    successful: job.successful,
    failed: job.failed,
    fileKey: job.fileKey,
    resultFileKey: job.resultFileKey,
    downloadUrl: job.resultFileKey ? `/uploads/${job.resultFileKey}` : null,
    errorSummary: job.errorSummary,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
  };
}

async function ensureImportRateLimit(
  app: FastifyInstance,
  request: import("fastify").FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  const importLimit = await app.rateLimiter.check(
    app.redis.cache,
    "import",
    `admin:${request.admin!.id}:ip:${clientIp(request.headers)}`,
  );

  reply.header("X-RateLimit-Limit", String(importLimit.limit));
  reply.header("X-RateLimit-Remaining", String(importLimit.remaining));

  if (!importLimit.allowed) {
    await reply.status(429).send({
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many import requests",
      },
      requestId: request.id,
    });
    return false;
  }

  return true;
}

async function saveImportPayload(
  app: FastifyInstance,
  folder: "imports",
  filename: string,
  content: string | Buffer,
): Promise<string> {
  const key = `${folder}/${filename}`;
  const destination = app.storage.resolvePath(key);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, content);
  return key;
}

export async function registerAdminJobRoutes(app: FastifyInstance) {
  app.get("/api/admin/jobs", { preHandler: requireAdminAuth }, async (request, reply) => {
    const { db } = getMongo();
    const jobs = await listDataJobs(db, { adminId: request.admin!.id, limit: 25 });
    return reply.send({ success: true, data: { items: jobs.map(serializeJob) } });
  });

  app.get("/api/admin/jobs/:id", { preHandler: requireAdminAuth }, async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) {
      return validationError(reply, "Invalid job id", request.id);
    }

    const { db } = getMongo();
    const job = await findDataJobById(db, id);
    if (!job || job.adminId !== request.admin!.id) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Job not found" },
        requestId: request.id,
      });
    }

    return reply.send({ success: true, data: serializeJob(job) });
  });

  app.get("/api/admin/jobs/:id/download", { preHandler: requireAdminAuth }, async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) {
      return validationError(reply, "Invalid job id", request.id);
    }

    const { db } = getMongo();
    const job = await findDataJobById(db, id);
    if (!job || job.adminId !== request.admin!.id || !job.resultFileKey) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Export file not found" },
        requestId: request.id,
      });
    }

    const filePath = app.storage.resolvePath(job.resultFileKey);
    const stream = createReadStream(filePath);
    reply.header("Content-Type", "text/csv; charset=utf-8");
    reply.header(
      "Content-Disposition",
      `attachment; filename="${path.basename(job.resultFileKey)}"`,
    );
    return reply.send(stream);
  });

  app.post("/api/admin/jobs/import-csv", { preHandler: requireAdminAuth }, async (request, reply) => {
    if (!(await ensureImportRateLimit(app, request, reply))) return;

    const env = app.env;
    const maxBytes = env.MAX_DATA_UPLOAD_MB * 1024 * 1024;
    const multipart = await request.file({ limits: { fileSize: maxBytes } });
    if (!multipart) {
      return validationError(reply, "CSV file is required", request.id);
    }

    const resourceField = multipart.fields.resource;
    const resourceValue =
      resourceField && "value" in resourceField && typeof resourceField.value === "string"
        ? resourceField.value.trim()
        : "";
    const parsedResource = resourceSchema.safeParse(resourceValue);
    if (!parsedResource.success) {
      return validationError(reply, "Invalid resource", request.id);
    }

    const headersField = multipart.fields.hasHeaders;
    const hasHeaders =
      !(headersField && "value" in headersField) || headersField.value !== "false";

    const skipInvalidField = multipart.fields.skipInvalid;
    const skipInvalid =
      !(skipInvalidField && "value" in skipInvalidField) || skipInvalidField.value !== "false";

    const buffer = await multipart.toBuffer();
    const fileKey = await saveImportPayload(
      app,
      "imports",
      `${randomUUID()}.csv`,
      buffer,
    );

    const { db } = getMongo();
    const job = await createDataJob(db, {
      type: "import",
      resource: parsedResource.data,
      adminId: request.admin!.id,
      fileKey,
    });

    try {
      const done = await runCsvImportNow(app, job.id, parsedResource.data, fileKey, {
        hasHeaders,
        skipInvalid,
      });
      if (!done) throw new Error("CSV import did not complete");
      return reply.send({
        success: true,
        data: {
          ...serializeJob(done),
          message: "CSV import complete",
        },
      });
    } catch (error) {
      return reply.status(422).send({
        success: false,
        error: {
          code: "IMPORT_FAILED",
          message: error instanceof Error ? error.message : "CSV import failed",
        },
        requestId: request.id,
      });
    }
  });

  app.post("/api/admin/jobs/export-preview", { preHandler: requireAdminAuth }, async (request, reply) => {
    const parsed = exportPreviewBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return validationError(reply, "Invalid export preview request", request.id);
    }

    const { db } = getMongo();
    const total = await countExportRecords(
      db,
      parsed.data.resource,
      normalizeExportFilters(parsed.data.filters),
    );

    return reply.send({ success: true, data: { total, resource: parsed.data.resource } });
  });

  app.post("/api/admin/jobs/export-csv", { preHandler: requireAdminAuth }, async (request, reply) => {
    const parsed = exportBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return validationError(reply, "Invalid export request", request.id);
    }

    const { db } = getMongo();
    const job = await createDataJob(db, {
      type: "export",
      resource: parsed.data.resource,
      adminId: request.admin!.id,
    });

    try {
      const done = await runCsvExportNow(
        app,
        job.id,
        parsed.data.resource,
        parsed.data.columns,
        normalizeExportFilters(parsed.data.filters),
      );
      if (!done) throw new Error("CSV export did not complete");
      return reply.send({
        success: true,
        data: {
          ...serializeJob(done),
          message: "CSV export complete",
        },
      });
    } catch (error) {
      return reply.status(422).send({
        success: false,
        error: {
          code: "EXPORT_FAILED",
          message: error instanceof Error ? error.message : "CSV export failed",
        },
        requestId: request.id,
      });
    }
  });

  app.post("/api/admin/jobs/raw-import", { preHandler: requireAdminAuth }, async (request, reply) => {
    if (!(await ensureImportRateLimit(app, request, reply))) return;

    const parsed = rawImportBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return validationError(reply, "Invalid raw import request", request.id);
    }

    const fileKey = await saveImportPayload(
      app,
      "imports",
      `${randomUUID()}.json`,
      parsed.data.payload,
    );

    const { db } = getMongo();
    const job = await createDataJob(db, {
      type: "raw",
      resource: parsed.data.resource,
      adminId: request.admin!.id,
      fileKey,
    });

    try {
      const done = await runRawImportNow(app, job.id, parsed.data.resource, parsed.data.payload);
      if (!done) throw new Error("Raw import did not complete");
      return reply.send({
        success: true,
        data: {
          ...serializeJob(done),
          message: "Raw import complete",
        },
      });
    } catch (error) {
      return reply.status(422).send({
        success: false,
        error: {
          code: "IMPORT_FAILED",
          message: error instanceof Error ? error.message : "Raw import failed",
        },
        requestId: request.id,
      });
    }
  });
}
