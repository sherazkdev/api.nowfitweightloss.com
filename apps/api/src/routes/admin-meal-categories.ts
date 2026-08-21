import { z } from "zod";
import type { FastifyInstance, FastifyReply } from "fastify";
import {
  createMealCategory,
  deleteMealCategory,
  findMealCategoryById,
  getMongo,
  listMealCategories,
  updateMealCategory,
} from "@weightloss/database";
import { bumpContentCache } from "../lib/cache-bump.js";
import { englishNamedTranslations, fillNamedTranslationsLater } from "../lib/localize-after-save.js";
import { requireAdminAuth } from "../plugins/auth.js";
import { formatZodError, isDuplicateKeyError, taxonomyBodySchema } from "../schemas/taxonomy.js";

function validationError(reply: FastifyReply, message: string, requestId: string) {
  return reply.status(422).send({
    success: false,
    error: { code: "VALIDATION_ERROR", message },
    requestId,
  });
}

export async function registerAdminMealCategoryRoutes(app: FastifyInstance) {
  app.get("/api/admin/meal-categories", { preHandler: requireAdminAuth }, async (_request, reply) => {
    const { db } = getMongo();
    const items = await listMealCategories(db);
    return reply.send({ success: true, data: { items } });
  });

  app.get("/api/admin/meal-categories/:id", { preHandler: requireAdminAuth }, async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) return validationError(reply, "Invalid category id", request.id);

    const { db } = getMongo();
    const item = await findMealCategoryById(db, id);
    if (!item) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Meal category not found" },
        requestId: request.id,
      });
    }

    return reply.send({ success: true, data: item });
  });

  app.post("/api/admin/meal-categories", { preHandler: requireAdminAuth }, async (request, reply) => {
    const parsed = taxonomyBodySchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, formatZodError(parsed.error), request.id);

    const { db } = getMongo();
    const named = { name: parsed.data.name, description: parsed.data.description ?? null };
    let item;
    try {
      item = await createMealCategory(db, {
        ...parsed.data,
        description: named.description,
        icon: parsed.data.icon ?? null,
        image: parsed.data.image ?? null,
        imageKey: parsed.data.imageKey ?? null,
        translations: englishNamedTranslations(named.name, named.description),
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return validationError(reply, "A category with this slug already exists. Use a different slug.", request.id);
      }
      throw error;
    }
    await bumpContentCache(app, ["mealCategories"]);
    fillNamedTranslationsLater(named, async (translations) => {
      await updateMealCategory(db, item.id, {
        ...parsed.data,
        description: named.description,
        icon: parsed.data.icon ?? null,
        image: parsed.data.image ?? null,
        imageKey: parsed.data.imageKey ?? null,
        translations,
      });
      await bumpContentCache(app, ["mealCategories"]);
    });
    return reply.status(201).send({ success: true, data: item });
  });

  app.put("/api/admin/meal-categories/:id", { preHandler: requireAdminAuth }, async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) return validationError(reply, "Invalid category id", request.id);

    const parsed = taxonomyBodySchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, formatZodError(parsed.error), request.id);

    const { db } = getMongo();
    const named = { name: parsed.data.name, description: parsed.data.description ?? null };
    const item = await updateMealCategory(db, id, {
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
        error: { code: "NOT_FOUND", message: "Meal category not found" },
        requestId: request.id,
      });
    }

    await bumpContentCache(app, ["mealCategories"]);
    fillNamedTranslationsLater(named, async (translations) => {
      await updateMealCategory(db, id, {
        ...parsed.data,
        description: named.description,
        icon: parsed.data.icon ?? null,
        image: parsed.data.image ?? null,
        imageKey: parsed.data.imageKey ?? null,
        translations,
      });
      await bumpContentCache(app, ["mealCategories"]);
    });
    return reply.send({ success: true, data: item });
  });

  app.delete("/api/admin/meal-categories/:id", { preHandler: requireAdminAuth }, async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) return validationError(reply, "Invalid category id", request.id);

    const { db } = getMongo();
    const deleted = await deleteMealCategory(db, id);
    if (!deleted) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Meal category not found" },
        requestId: request.id,
      });
    }

    await bumpContentCache(app, ["mealCategories"]);
    return reply.send({ success: true, data: { id } });
  });
}
