import type { FastifyInstance, FastifyReply } from "fastify";
import {
  createWorkoutLevel,
  deleteWorkoutLevel,
  findWorkoutLevelById,
  getMongo,
  listWorkoutLevels,
  updateWorkoutLevel,
} from "@weightloss/database";
import { bumpContentCache } from "../lib/cache-bump.js";
import { englishNamedTranslations, fillNamedTranslationsLater } from "../lib/localize-after-save.js";
import { requireAdminAuth } from "../plugins/auth.js";
import { formatZodError, taxonomyBodySchema } from "../schemas/taxonomy.js";

function validationError(reply: FastifyReply, message: string, requestId: string) {
  return reply.status(422).send({
    success: false,
    error: { code: "VALIDATION_ERROR", message },
    requestId,
  });
}

export async function registerAdminWorkoutLevelRoutes(app: FastifyInstance) {
  app.get("/api/admin/workout-levels", { preHandler: requireAdminAuth }, async (_request, reply) => {
    const { db } = getMongo();
    const items = await listWorkoutLevels(db);
    return reply.send({ success: true, data: { items } });
  });

  app.get("/api/admin/workout-levels/:id", { preHandler: requireAdminAuth }, async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) return validationError(reply, "Invalid level id", request.id);

    const { db } = getMongo();
    const item = await findWorkoutLevelById(db, id);
    if (!item) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Workout level not found" },
        requestId: request.id,
      });
    }

    return reply.send({ success: true, data: item });
  });

  app.post("/api/admin/workout-levels", { preHandler: requireAdminAuth }, async (request, reply) => {
    const parsed = taxonomyBodySchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, formatZodError(parsed.error), request.id);

    const { db } = getMongo();
    const named = { name: parsed.data.name, description: parsed.data.description ?? null };
    const item = await createWorkoutLevel(db, {
      ...parsed.data,
      description: named.description,
      icon: parsed.data.icon ?? null,
      image: parsed.data.image ?? null,
      imageKey: parsed.data.imageKey ?? null,
      translations: englishNamedTranslations(named.name, named.description),
    });
    await bumpContentCache(app, ["workoutLevels"]);
    fillNamedTranslationsLater(named, async (translations) => {
      await updateWorkoutLevel(db, item.id, {
        ...parsed.data,
        description: named.description,
        icon: parsed.data.icon ?? null,
        image: parsed.data.image ?? null,
        imageKey: parsed.data.imageKey ?? null,
        translations,
      });
      await bumpContentCache(app, ["workoutLevels"]);
    });
    return reply.status(201).send({ success: true, data: item });
  });

  app.put("/api/admin/workout-levels/:id", { preHandler: requireAdminAuth }, async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) return validationError(reply, "Invalid level id", request.id);

    const parsed = taxonomyBodySchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, formatZodError(parsed.error), request.id);

    const { db } = getMongo();
    const named = { name: parsed.data.name, description: parsed.data.description ?? null };
    const item = await updateWorkoutLevel(db, id, {
      ...parsed.data,
      description: named.description,
      icon: parsed.data.icon ?? null,
      image: parsed.data.image ?? null,
      imageKey: parsed.data.imageKey ?? null,
      translations: englishNamedTranslations(named.name, named.description),
    });
    if (!item) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Workout level not found" },
        requestId: request.id,
      });
    }

    await bumpContentCache(app, ["workoutLevels"]);
    fillNamedTranslationsLater(named, async (translations) => {
      await updateWorkoutLevel(db, id, {
        ...parsed.data,
        description: named.description,
        icon: parsed.data.icon ?? null,
        image: parsed.data.image ?? null,
        imageKey: parsed.data.imageKey ?? null,
        translations,
      });
      await bumpContentCache(app, ["workoutLevels"]);
    });
    return reply.send({ success: true, data: item });
  });

  app.delete("/api/admin/workout-levels/:id", { preHandler: requireAdminAuth }, async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) return validationError(reply, "Invalid level id", request.id);

    const { db } = getMongo();
    const deleted = await deleteWorkoutLevel(db, id);
    if (!deleted) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Workout level not found" },
        requestId: request.id,
      });
    }

    await bumpContentCache(app, ["workoutLevels"]);
    return reply.send({ success: true, data: { id } });
  });
}
