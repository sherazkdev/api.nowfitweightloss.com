import { z } from "zod";
import type { FastifyInstance, FastifyReply } from "fastify";
import {
  createMeal,
  deleteMeal,
  findMealById,
  getMongo,
  listMeals,
  updateMeal,
  type MealWriteInput,
} from "@weightloss/database";
import type { MealCopy } from "@weightloss/contracts";
import { bumpContentCache } from "../lib/cache-bump.js";
import { englishMealTranslations, fillMealTranslationsLater } from "../lib/localize-after-save.js";
import { requireAdminAuth } from "../plugins/auth.js";

const genderSchema = z.enum(["male", "female", "both"]);
const difficultySchema = z.enum(["Easy", "Medium", "Hard"]);

function fillUnsetMax(min: number, max: number) {
  return max === 0 && min > 0 ? min : max;
}

const nutritionSchema = z
  .object({
    caloriesMin: z.number().finite(),
    caloriesMax: z.number().finite(),
    proteinMin: z.number().finite(),
    proteinMax: z.number().finite(),
    carbsMin: z.number().finite(),
    carbsMax: z.number().finite(),
    fatsMin: z.number().finite(),
    fatsMax: z.number().finite(),
    fiberMin: z.number().finite(),
    fiberMax: z.number().finite(),
    sugarMin: z.number().finite(),
    sugarMax: z.number().finite(),
    sodiumMin: z.number().finite(),
    sodiumMax: z.number().finite(),
  })
  .transform((n) => ({
    caloriesMin: n.caloriesMin,
    caloriesMax: fillUnsetMax(n.caloriesMin, n.caloriesMax),
    proteinMin: n.proteinMin,
    proteinMax: fillUnsetMax(n.proteinMin, n.proteinMax),
    carbsMin: n.carbsMin,
    carbsMax: fillUnsetMax(n.carbsMin, n.carbsMax),
    fatsMin: n.fatsMin,
    fatsMax: fillUnsetMax(n.fatsMin, n.fatsMax),
    fiberMin: n.fiberMin,
    fiberMax: fillUnsetMax(n.fiberMin, n.fiberMax),
    sugarMin: n.sugarMin,
    sugarMax: fillUnsetMax(n.sugarMin, n.sugarMax),
    sodiumMin: n.sodiumMin,
    sodiumMax: fillUnsetMax(n.sodiumMin, n.sodiumMax),
  }));

const ingredientSchema = z.object({
  name: z.string().trim().min(1),
  quantity: z.string().trim().nullable().optional(),
  unit: z.string().trim().nullable().optional(),
  sortOrder: z.number().int().nonnegative(),
});

const instructionSchema = z.object({
  step: z.number().int().positive(),
  text: z.string().trim().min(1),
});

const mealBodySchema = z
  .object({
    categoryIds: z.array(z.number().int().positive()).min(1),
    title: z.string().trim().min(1).max(200),
    shortTitle: z.string().trim().max(120).nullable().optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    image: z.preprocess(
      (val) => (typeof val === "string" && val.trim() === "" ? null : val),
      z.union([z.string().url(), z.string().startsWith("/uploads/"), z.null()]).optional(),
    ),
    imageKey: z.string().trim().nullable().optional(),
    nutrition: nutritionSchema,
    minWeight: z.number().finite().nonnegative(),
    maxWeight: z.number().finite().nonnegative(),
    prepTimeMinutes: z.number().int().nonnegative(),
    difficulty: difficultySchema,
    servingSize: z.string().trim().max(120).nullable().optional(),
    gender: genderSchema,
    isChallenge: z.boolean(),
    isActive: z.boolean(),
    sortOrder: z.number().int().nonnegative(),
    ingredients: z.array(ingredientSchema).default([]),
    instructions: z.array(instructionSchema).default([]),
    translations: z
      .record(
        z.string(),
        z.object({
          title: z.string().trim().max(200).optional(),
          shortTitle: z.string().trim().max(120).nullable().optional(),
          description: z.string().trim().max(5000).nullable().optional(),
          servingSize: z.string().trim().max(120).nullable().optional(),
          ingredients: z.array(z.object({ name: z.string().trim().optional(), unit: z.string().trim().nullable().optional() })).optional(),
          instructions: z.array(z.object({ text: z.string().trim().optional() })).optional(),
        }),
      )
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.minWeight > value.maxWeight) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "minWeight cannot be greater than maxWeight",
        path: ["minWeight"],
      });
    }

    const ranges: Array<[string, number, number]> = [
      ["calories", value.nutrition.caloriesMin, value.nutrition.caloriesMax],
      ["protein", value.nutrition.proteinMin, value.nutrition.proteinMax],
      ["carbs", value.nutrition.carbsMin, value.nutrition.carbsMax],
      ["fats", value.nutrition.fatsMin, value.nutrition.fatsMax],
      ["fiber", value.nutrition.fiberMin, value.nutrition.fiberMax],
      ["sugar", value.nutrition.sugarMin, value.nutrition.sugarMax],
      ["sodium", value.nutrition.sodiumMin, value.nutrition.sodiumMax],
    ];

    for (const [label, min, max] of ranges) {
      if (min > fillUnsetMax(min, max)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} min cannot be greater than max`,
          path: ["nutrition"],
        });
      }
    }
  });

const listQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).optional(),
  page: z.coerce.number().int().positive().optional(),
  category_id: z.coerce.number().int().positive().optional(),
  gender: genderSchema.optional(),
  is_challenge: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
  search: z.string().trim().optional(),
});

function validationError(reply: FastifyReply, message: string, requestId: string) {
  return reply.status(422).send({
    success: false,
    error: { code: "VALIDATION_ERROR", message },
    requestId,
  });
}

function formatZodError(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`).join("; ");
}

function mealCopyFromBody(data: z.infer<typeof mealBodySchema>): MealCopy {
  return {
    title: data.title.trim(),
    shortTitle: data.shortTitle ?? null,
    description: data.description ?? null,
    servingSize: data.servingSize ?? null,
    ingredients: data.ingredients.map((item) => ({ name: item.name, unit: item.unit ?? null })),
    instructions: data.instructions.map((item) => ({ text: item.text })),
  };
}

function toMealWriteInput(data: z.infer<typeof mealBodySchema>): MealWriteInput {
  const nutrition = data.nutrition;
  const copy = mealCopyFromBody(data);
  return {
    ...data,
    shortTitle: data.shortTitle ?? null,
    description: data.description ?? null,
    image: data.image ?? null,
    imageKey: data.imageKey ?? null,
    servingSize: data.servingSize ?? null,
    translations: englishMealTranslations(copy),
    nutrition: {
      caloriesMin: nutrition.caloriesMin,
      caloriesMax: fillUnsetMax(nutrition.caloriesMin, nutrition.caloriesMax),
      proteinMin: nutrition.proteinMin,
      proteinMax: fillUnsetMax(nutrition.proteinMin, nutrition.proteinMax),
      carbsMin: nutrition.carbsMin,
      carbsMax: fillUnsetMax(nutrition.carbsMin, nutrition.carbsMax),
      fatsMin: nutrition.fatsMin,
      fatsMax: fillUnsetMax(nutrition.fatsMin, nutrition.fatsMax),
      fiberMin: nutrition.fiberMin,
      fiberMax: fillUnsetMax(nutrition.fiberMin, nutrition.fiberMax),
      sugarMin: nutrition.sugarMin,
      sugarMax: fillUnsetMax(nutrition.sugarMin, nutrition.sugarMax),
      sodiumMin: nutrition.sodiumMin,
      sodiumMax: fillUnsetMax(nutrition.sodiumMin, nutrition.sodiumMax),
    },
    ingredients: data.ingredients.map((item) => ({
      name: item.name,
      quantity: item.quantity ?? null,
      unit: item.unit ?? null,
      sortOrder: item.sortOrder,
    })),
    instructions: data.instructions,
  };
}

export async function registerAdminMealsRoutes(app: FastifyInstance) {
  app.get(
    "/api/admin/meals",
    {
      preHandler: requireAdminAuth,
      schema: {
        tags: ["Meals"],
        summary: "List meals",
        security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            limit: { type: "integer" },
            page: { type: "integer" },
            category_id: { type: "integer" },
            gender: { type: "string", enum: ["male", "female", "both"] },
            is_challenge: { type: "string", enum: ["true", "false"] },
            search: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return validationError(reply, formatZodError(parsed.error), request.id);
    }

    const { db } = getMongo();
    const result = await listMeals(db, {
      limit: parsed.data.limit,
      page: parsed.data.page,
      categoryId: parsed.data.category_id,
      gender: parsed.data.gender,
      isChallenge: parsed.data.is_challenge,
      search: parsed.data.search,
    });

    return reply.send({
      success: true,
      data: {
        items: result.items,
        total: result.total,
        page: parsed.data.page ?? 1,
        limit: parsed.data.limit ?? 100,
      },
    });
  });

  app.get("/api/admin/meals/:id", { preHandler: requireAdminAuth }, async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) {
      return validationError(reply, "Invalid meal id", request.id);
    }

    const { db } = getMongo();
    const meal = await findMealById(db, id);
    if (!meal) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Meal not found" },
        requestId: request.id,
      });
    }

    return reply.send({ success: true, data: meal });
  });

  app.post(
    "/api/admin/meals",
    {
      preHandler: requireAdminAuth,
      schema: {
        tags: ["Meals"],
        summary: "Create meal",
        security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
      },
    },
    async (request, reply) => {
    const parsed = mealBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return validationError(reply, formatZodError(parsed.error), request.id);
    }

    const { db } = getMongo();
    const input = toMealWriteInput(parsed.data);
    const meal = await createMeal(db, input);
    await bumpContentCache(app, ["meals"]);
    fillMealTranslationsLater(mealCopyFromBody(parsed.data), async (translations) => {
      await updateMeal(db, meal.id, { ...input, translations });
      await bumpContentCache(app, ["meals"]);
    });
    return reply.status(201).send({ success: true, data: meal });
  });

  app.put("/api/admin/meals/:id", { preHandler: requireAdminAuth }, async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) {
      return validationError(reply, "Invalid meal id", request.id);
    }

    const parsed = mealBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return validationError(reply, formatZodError(parsed.error), request.id);
    }

    const { db } = getMongo();
    const input = toMealWriteInput(parsed.data);
    const meal = await updateMeal(db, id, input);
    if (!meal) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Meal not found" },
        requestId: request.id,
      });
    }

    await bumpContentCache(app, ["meals"]);
    fillMealTranslationsLater(mealCopyFromBody(parsed.data), async (translations) => {
      await updateMeal(db, id, { ...input, translations });
      await bumpContentCache(app, ["meals"]);
    });
    return reply.send({ success: true, data: meal });
  });

  app.delete("/api/admin/meals/:id", { preHandler: requireAdminAuth }, async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) {
      return validationError(reply, "Invalid meal id", request.id);
    }

    const { db } = getMongo();
    const deleted = await deleteMeal(db, id);
    if (!deleted) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Meal not found" },
        requestId: request.id,
      });
    }

    await bumpContentCache(app, ["meals"]);
    return reply.send({ success: true, data: { id } });
  });
}
