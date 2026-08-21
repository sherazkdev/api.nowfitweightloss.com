import { z } from "zod";
import type { FastifyInstance, FastifyReply } from "fastify";
import {
  createWorkoutCategory,
  deleteWorkoutCategory,
  findWorkoutCategoryById,
  getMongo,
  listWorkoutCategories,
  updateWorkoutCategory,
} from "@weightloss/database";
import { bumpContentCache } from "../lib/cache-bump.js";
import { englishNamedTranslations, fillNamedTranslationsLater } from "../lib/localize-after-save.js";
import { requireAdminAuth } from "../plugins/auth.js";
import { formatZodError, namedTranslationsSchema } from "../schemas/taxonomy.js";

const genderSchema = z.enum(["male", "female", "both"]);

const workoutCategoryBodySchema = z.object({
  levelIds: z.array(z.number().int().positive()).min(1),
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(120),
  description: z.string().trim().max(5000).nullable().optional(),
  image: z.preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? null : val),
    z.union([z.string().url(), z.string().startsWith("/uploads/"), z.null()]).optional(),
  ),
  imageKey: z.string().trim().nullable().optional(),
  gender: genderSchema,
  isChallenge: z.boolean(),
  sortOrder: z.number().int().nonnegative(),
  isActive: z.boolean(),
  translations: namedTranslationsSchema,
});

function validationError(reply: FastifyReply, message: string, requestId: string) {
  return reply.status(422).send({
    success: false,
    error: { code: "VALIDATION_ERROR", message },
    requestId,
  });
}

export async function registerAdminWorkoutCategoryRoutes(app: FastifyInstance) {
  app.get("/api/admin/workout-categories", { preHandler: requireAdminAuth }, async (request, reply) => {
    const { db } = getMongo();
    const result = await listWorkoutCategories(db, { limit: 200 });
    return reply.send({ success: true, data: result });
  });

  app.get("/api/admin/workout-categories/:id", { preHandler: requireAdminAuth }, async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) return validationError(reply, "Invalid category id", request.id);

    const { db } = getMongo();
    const item = await findWorkoutCategoryById(db, id);
    if (!item) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Workout category not found" },
        requestId: request.id,
      });
    }

    return reply.send({ success: true, data: item });
  });

  app.post("/api/admin/workout-categories", { preHandler: requireAdminAuth }, async (request, reply) => {
    const parsed = workoutCategoryBodySchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, formatZodError(parsed.error), request.id);

    const { db } = getMongo();
    const named = { name: parsed.data.name, description: parsed.data.description ?? null };
    const item = await createWorkoutCategory(db, {
      ...parsed.data,
      description: named.description,
      image: parsed.data.image ?? null,
      imageKey: parsed.data.imageKey ?? null,
      translations: englishNamedTranslations(named.name, named.description),
    });
    await bumpContentCache(app, ["workoutCategories"]);
    fillNamedTranslationsLater(named, async (translations) => {
      await updateWorkoutCategory(db, item.id, {
        ...parsed.data,
        description: named.description,
        image: parsed.data.image ?? null,
        imageKey: parsed.data.imageKey ?? null,
        translations,
      });
      await bumpContentCache(app, ["workoutCategories"]);
    });
    return reply.status(201).send({ success: true, data: item });
  });

  app.put("/api/admin/workout-categories/:id", { preHandler: requireAdminAuth }, async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) return validationError(reply, "Invalid category id", request.id);

    const parsed = workoutCategoryBodySchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, formatZodError(parsed.error), request.id);

    const { db } = getMongo();
    const named = { name: parsed.data.name, description: parsed.data.description ?? null };
    const item = await updateWorkoutCategory(db, id, {
      ...parsed.data,
      description: named.description,
      image: parsed.data.image ?? null,
      imageKey: parsed.data.imageKey ?? null,
      translations: englishNamedTranslations(named.name, named.description),
    });
    if (!item) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Workout category not found" },
        requestId: request.id,
      });
    }

    await bumpContentCache(app, ["workoutCategories"]);
    fillNamedTranslationsLater(named, async (translations) => {
      await updateWorkoutCategory(db, id, {
        ...parsed.data,
        description: named.description,
        image: parsed.data.image ?? null,
        imageKey: parsed.data.imageKey ?? null,
        translations,
      });
      await bumpContentCache(app, ["workoutCategories"]);
    });
    return reply.send({ success: true, data: item });
  });

  app.delete("/api/admin/workout-categories/:id", { preHandler: requireAdminAuth }, async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) return validationError(reply, "Invalid category id", request.id);

    const { db } = getMongo();
    const deleted = await deleteWorkoutCategory(db, id);
    if (!deleted) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Workout category not found" },
        requestId: request.id,
      });
    }

    await bumpContentCache(app, ["workoutCategories"]);
    return reply.send({ success: true, data: { id } });
  });
}
