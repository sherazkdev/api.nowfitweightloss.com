import { z } from "zod";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { CacheResource } from "@weightloss/cache";
import {
  findExerciseById,
  findMealById,
  getMongo,
  listExercises,
  listMealCategories,
  listMeals,
  listWorkoutCategories,
  listWorkoutLevels,
} from "@weightloss/database";
import {
  legacyPaginated,
  legacySuccess,
} from "../serializers/legacy.js";
import {
  serializePublicExerciseDetail,
  serializePublicExerciseListItem,
  serializePublicMealCategory,
  serializePublicMealDetail,
  serializePublicMealListItem,
  serializePublicWorkoutCategory,
  serializePublicWorkoutLevel,
} from "../serializers/public-content.js";

import { sendPublicResponse } from "../lib/etag.js";
import { resolveRequestLocale } from "../lib/locale.js";
import { publicGetRouteSchema } from "../openapi/lang-param.js";
import { requireAdminAuth } from "../plugins/auth.js";
import { SUPPORTED_LOCALES, type Locale } from "@weightloss/contracts";

const genderSchema = z.enum(["male", "female", "both"]);
const SEARCH_MAX = 100;
const langSchema = z.enum(SUPPORTED_LOCALES as unknown as [Locale, ...Locale[]]);

export type PublicContentRouteOptions = {
  deprecated?: boolean;
  includeMeta?: boolean;
};

function paginationSchema(maxPageSize: number) {
  return z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(maxPageSize).optional(),
  });
}

function searchField() {
  return z
    .string()
    .trim()
    .max(SEARCH_MAX, `search must be at most ${SEARCH_MAX} characters`)
    .optional();
}

function validationError(reply: FastifyReply, message: string, requestId: string) {
  return reply.status(422).send({
    success: false,
    error: { code: "VALIDATION_ERROR", message },
    requestId,
  });
}

function formatZodError(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join(".") || "query"}: ${issue.message}`).join("; ");
}

function requireLocale(request: FastifyRequest, reply: FastifyReply): Locale | null {
  const locale = resolveRequestLocale(request);
  if (!locale) {
    validationError(
      reply,
      `lang is required. Use one of: ${SUPPORTED_LOCALES.join(", ")}`,
      request.id,
    );
    return null;
  }
  return locale;
}

async function cachedList<T>(
  app: FastifyInstance,
  request: FastifyRequest,
  resource: CacheResource,
  parts: string[],
  loader: () => Promise<T>,
): Promise<T> {
  const result = await app.cache.publicGetOrSet(resource, parts, app.cache.listTtl(), loader);
  request.cacheHit = result.hit;
  app.metrics?.cacheRequests.inc({
    resource,
    result: result.hit ? "hit" : "miss",
  });
  return result.value;
}

export const PUBLIC_ENDPOINTS = [
  { method: "GET", path: "/meal-categories", description: "List active meal categories" },
  { method: "GET", path: "/meal-categories/:categoryId/meals", description: "Meals in a category" },
  { method: "GET", path: "/meals", description: "List meals with filters and pagination" },
  { method: "GET", path: "/meals/:id", description: "Meal detail with ingredients and instructions" },
  { method: "GET", path: "/workout-levels", description: "List active workout levels" },
  { method: "GET", path: "/workout-levels/:levelId/categories", description: "Categories for a workout level" },
  { method: "GET", path: "/workout-levels/:levelId/categories/:categoryId/exercises", description: "Exercises for level + category" },
  { method: "GET", path: "/workout-categories", description: "List workout categories with filters" },
  { method: "GET", path: "/workout-categories/:categoryId/exercises", description: "Exercises in a workout category" },
  { method: "GET", path: "/workout-categories/:categoryId/levels/:levelId/exercises", description: "Exercises for category + level" },
  { method: "GET", path: "/exercises", description: "List exercises with filters and pagination" },
  { method: "GET", path: "/exercises/:id", description: "Exercise detail" },
  { method: "GET", path: "/workout-reminders", description: "List reminders (Firebase Bearer, query gender=male|female)" },
  { method: "POST", path: "/workout-reminders", description: "Create reminder (hour, minute, days, gender, timezone)" },
  { method: "PUT", path: "/workout-reminders/:id", description: "Update reminder" },
  { method: "PATCH", path: "/workout-reminders/:id/toggle", description: "Enable/disable reminder" },
  { method: "DELETE", path: "/workout-reminders/:id", description: "Delete reminder" },
  { method: "POST", path: "/devices", description: "Register FCM token (fcm_token, platform)" },
  { method: "DELETE", path: "/devices", description: "Unregister FCM token (body fcm_token)" },
] as const;

export async function registerPublicContentRoutes(
  app: FastifyInstance,
  options: PublicContentRouteOptions = {},
) {
  const maxPageSize = app.env.MAX_PAGE_SIZE;
  const defaultPageSize = app.env.DEFAULT_PAGE_SIZE;
  const successorBase = `${app.env.API_PUBLIC_URL.replace(/\/$/, "")}/api/v1`;
  const hide = Boolean(options.deprecated);

  app.addHook("preHandler", requireAdminAuth);

  const paginationQuery = {
    page: { type: "integer", minimum: 1, description: "1-based page" },
    limit: {
      type: "integer",
      minimum: 1,
      maximum: maxPageSize,
      description: `Page size (default ${defaultPageSize}, max ${maxPageSize})`,
    },
  };
  const genderQuery = {
    type: "string",
    enum: ["male", "female", "both"],
    description: "Gender filter",
  };
  const challengeQuery = {
    type: "string",
    enum: ["true", "false"],
    description: "Challenge content only",
  };

  if (options.deprecated) {
    app.addHook("onSend", async (_request, reply, payload) => {
      reply.header("Deprecation", "true");
      reply.header("Sunset", app.env.API_LEGACY_SUNSET);
      reply.header("Link", `<${successorBase}/meals>; rel="successor-version"`);
      return payload;
    });
  } else {
    app.addHook("onSend", async (_request, reply, payload) => {
      reply.header("X-API-Version", "1");
      return payload;
    });
  }

  if (options.includeMeta) {
    app.get(
      "/",
      { schema: publicGetRouteSchema({ summary: "API discovery", hide, langRequired: false }) },
      async (request, reply) => {
      const body = legacySuccess({
        version: "v1",
        format: "legacy_snake_case",
        pagination: {
          page: "1-based page number",
          limit: `default ${defaultPageSize}, max ${maxPageSize}`,
        },
        locale: "lang is required on every content GET (en, hi, es, …). Missing translations fall back to English.",
        endpoints: PUBLIC_ENDPOINTS,
        sdk: "@weightloss/client",
        docs: "docs/PUBLIC-API.md",
        openapi: "/api/v1/openapi.json",
      });
      return sendPublicResponse(app, request, reply, "meta", ["discovery"], body);
    },
    );
  }

  const mealListQuerySchema = paginationSchema(maxPageSize).extend({
    category_id: z.coerce.number().int().positive().optional(),
    gender: genderSchema.optional(),
    is_challenge: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => (value === undefined ? undefined : value === "true")),
    weight: z.coerce.number().finite().nonnegative().optional(),
    search: searchField(),
    lang: langSchema,
  });

  const mealCategoryQuerySchema = z.object({
    lang: langSchema,
    gender: genderSchema.optional(),
    is_challenge: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => (value === undefined ? undefined : value === "true")),
    weight: z.coerce.number().finite().nonnegative().optional(),
  });

  const workoutCategoryQuerySchema = paginationSchema(maxPageSize).extend({
    level_id: z.coerce.number().int().positive().optional(),
    gender: genderSchema.optional(),
    is_challenge: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => (value === undefined ? undefined : value === "true")),
    lang: langSchema,
  });

  const exerciseListQuerySchema = paginationSchema(maxPageSize).extend({
    category_id: z.coerce.number().int().positive().optional(),
    level_id: z.coerce.number().int().positive().optional(),
    browse_key: z.string().trim().max(64).optional(),
    gender: genderSchema.optional(),
    is_challenge: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => (value === undefined ? undefined : value === "true")),
    weight: z.coerce.number().finite().nonnegative().optional(),
    search: searchField(),
    lang: langSchema,
  });

  const detailQuerySchema = z.object({
    lang: langSchema,
    level_id: z.coerce.number().int().positive().optional(),
  });

  app.get(
    "/meal-categories",
    {
      schema: publicGetRouteSchema({
        summary: "List meal categories",
        hide,
        queryProperties: {
          gender: genderQuery,
          is_challenge: challengeQuery,
          weight: { type: "number", description: "User weight — omit categories with 0 matching meals" },
        },
      }),
    },
    async (request, reply) => {
    const parsed = mealCategoryQuerySchema.safeParse(request.query);
    if (!parsed.success) return validationError(reply, formatZodError(parsed.error), request.id);
    const locale = parsed.data.lang;
    const cacheKey = JSON.stringify(parsed.data);

    const data = await cachedList(app, request, "mealCategories", ["list", cacheKey], async () => {
      const { db } = getMongo();
      const items = await listMealCategories(db, { activeOnly: true });
      const hasPlanFilter =
        parsed.data.gender !== undefined ||
        parsed.data.weight !== undefined ||
        parsed.data.is_challenge !== undefined;
      if (!hasPlanFilter) {
        return items.map((item) => serializePublicMealCategory(item, locale));
      }
      const visible = [];
      for (const item of items) {
        const match = await listMeals(db, {
          page: 1,
          limit: 1,
          activeOnly: true,
          categoryId: item.id,
          gender: parsed.data.gender,
          isChallenge: parsed.data.is_challenge,
          userWeight: parsed.data.weight,
        });
        if (match.total > 0) visible.push(item);
      }
      return visible.map((item) => serializePublicMealCategory(item, locale));
    });
    return sendPublicResponse(app, request, reply, "mealCategories", ["list", cacheKey], legacySuccess(data));
  },
  );

  app.get(
    "/meals",
    {
      schema: publicGetRouteSchema({
        summary: "List meals",
        hide,
        queryProperties: {
          ...paginationQuery,
          category_id: { type: "integer", description: "Filter by meal category id" },
          gender: genderQuery,
          is_challenge: challengeQuery,
          weight: { type: "number", description: "User weight for plan filtering" },
          search: { type: "string", maxLength: SEARCH_MAX, description: "Title search" },
        },
      }),
    },
    async (request, reply) => {
    const parsed = mealListQuerySchema.safeParse(request.query);
    if (!parsed.success) return validationError(reply, formatZodError(parsed.error), request.id);

    const page = parsed.data.page ?? 1;
    const limit = parsed.data.limit ?? defaultPageSize;
    const locale = parsed.data.lang;
    const cacheKey = JSON.stringify({ ...parsed.data, lang: locale });

    const payload = await cachedList(app, request, "meals", ["list", cacheKey], async () => {
      const { db } = getMongo();
      const result = await listMeals(db, {
        page,
        limit,
        activeOnly: true,
        categoryId: parsed.data.category_id,
        gender: parsed.data.gender,
        isChallenge: parsed.data.is_challenge,
        userWeight: parsed.data.weight,
        search: parsed.data.search,
      });
      return legacyPaginated(
        result.items.map((item) => serializePublicMealListItem(item, locale)),
        page,
        limit,
        result.total,
      );
    });

    return sendPublicResponse(app, request, reply, "meals", ["list", cacheKey], payload);
  },
  );

  app.get(
    "/meals/:id",
    {
      schema: publicGetRouteSchema({
        summary: "Meal detail",
        hide,
        params: { id: { type: "integer", description: "Meal id" } },
      }),
    },
    async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) return validationError(reply, "Invalid meal id", request.id);

    const locale = requireLocale(request, reply);
    if (!locale) return;
    const meal = await cachedList(app, request, "meals", ["detail", String(id)], async () => {
      const { db } = getMongo();
      return findMealById(db, id);
    });

    if (!meal || !meal.isActive) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Meal not found" },
        requestId: request.id,
      });
    }

    return sendPublicResponse(
      app,
      request,
      reply,
      "meals",
      ["detail", String(id), locale],
      legacySuccess(serializePublicMealDetail(meal, locale)),
    );
  },
  );

  app.get(
    "/workout-levels",
    { schema: publicGetRouteSchema({ summary: "List workout levels", hide }) },
    async (request, reply) => {
    const locale = requireLocale(request, reply);
    if (!locale) return;
    const data = await cachedList(app, request, "workoutLevels", ["list", locale], async () => {
      const { db } = getMongo();
      const items = await listWorkoutLevels(db, { activeOnly: true });
      return items.map((item) => serializePublicWorkoutLevel(item, locale));
    });
    return sendPublicResponse(app, request, reply, "workoutLevels", ["list", locale], legacySuccess(data));
  },
  );

  app.get(
    "/workout-categories",
    {
      schema: publicGetRouteSchema({
        summary: "List workout categories",
        hide,
        queryProperties: {
          ...paginationQuery,
          level_id: { type: "integer", description: "Filter by workout level id" },
          gender: genderQuery,
          is_challenge: challengeQuery,
        },
      }),
    },
    async (request, reply) => {
    const parsed = workoutCategoryQuerySchema.safeParse(request.query);
    if (!parsed.success) return validationError(reply, formatZodError(parsed.error), request.id);

    const page = parsed.data.page ?? 1;
    const limit = parsed.data.limit ?? defaultPageSize;
    const locale = parsed.data.lang;
    const cacheKey = JSON.stringify({ ...parsed.data, lang: locale });

    const payload = await cachedList(app, request, "workoutCategories", ["list", cacheKey], async () => {
      const { db } = getMongo();
      const result = await listWorkoutCategories(db, {
        page,
        limit,
        activeOnly: true,
        levelId: parsed.data.level_id,
        gender: parsed.data.gender,
        isChallenge: parsed.data.is_challenge,
      });
      return legacyPaginated(
        result.items.map((item) => serializePublicWorkoutCategory(item, locale)),
        page,
        limit,
        result.total,
      );
    });

    return sendPublicResponse(app, request, reply, "workoutCategories", ["list", cacheKey], payload);
  },
  );

  app.get(
    "/exercises",
    {
      schema: publicGetRouteSchema({
        summary: "List exercises",
        hide,
        queryProperties: {
          ...paginationQuery,
          category_id: { type: "integer", description: "Workout category id" },
          level_id: { type: "integer", description: "Workout level id" },
          browse_key: { type: "string", maxLength: 64, description: "Body-part / browse key" },
          gender: genderQuery,
          is_challenge: challengeQuery,
          weight: { type: "number", description: "User weight filter" },
          search: { type: "string", maxLength: SEARCH_MAX, description: "Title search" },
        },
      }),
    },
    async (request, reply) => {
    const parsed = exerciseListQuerySchema.safeParse(request.query);
    if (!parsed.success) return validationError(reply, formatZodError(parsed.error), request.id);

    const page = parsed.data.page ?? 1;
    const limit = parsed.data.limit ?? defaultPageSize;
    const locale = parsed.data.lang;
    const cacheKey = JSON.stringify({ ...parsed.data, lang: locale });

    const payload = await cachedList(app, request, "exercises", ["list", cacheKey], async () => {
      const { db } = getMongo();
      const result = await listExercises(db, {
        page,
        limit,
        activeOnly: true,
        categoryId: parsed.data.category_id,
        levelId: parsed.data.level_id,
        browseKey: parsed.data.browse_key,
        gender: parsed.data.gender,
        isChallenge: parsed.data.is_challenge,
        userWeight: parsed.data.weight,
        search: parsed.data.search,
      });
      return legacyPaginated(
        result.items.map((item) => serializePublicExerciseListItem(item, locale)),
        page,
        limit,
        result.total,
      );
    });

    return sendPublicResponse(app, request, reply, "exercises", ["list", cacheKey], payload);
  },
  );

  app.get(
    "/exercises/:id",
    {
      schema: publicGetRouteSchema({
        summary: "Exercise detail",
        hide,
        params: { id: { type: "integer", description: "Exercise id" } },
        queryProperties: {
          level_id: { type: "integer", description: "If set, duration/calories/sets/reps come from that level section" },
        },
      }),
    },
    async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) return validationError(reply, "Invalid exercise id", request.id);

    const parsed = detailQuerySchema.safeParse(request.query);
    if (!parsed.success) return validationError(reply, formatZodError(parsed.error), request.id);
    const locale = parsed.data.lang;
    const exercise = await cachedList(app, request, "exercises", ["detail", String(id)], async () => {
      const { db } = getMongo();
      return findExerciseById(db, id, { activeOnly: true });
    });

    if (!exercise) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Exercise not found" },
        requestId: request.id,
      });
    }

    return sendPublicResponse(
      app,
      request,
      reply,
      "exercises",
      ["detail", String(id), locale, String(parsed.data.level_id ?? "")],
      legacySuccess(serializePublicExerciseDetail(exercise, locale, parsed.data.level_id)),
    );
  },
  );

  const mealListQueryProps = {
    ...paginationQuery,
    category_id: { type: "integer", description: "Filter by meal category id" },
    gender: genderQuery,
    is_challenge: challengeQuery,
    weight: { type: "number", description: "User weight for plan filtering" },
    search: { type: "string", maxLength: SEARCH_MAX, description: "Title search" },
  };
  const exerciseListQueryProps = {
    ...paginationQuery,
    category_id: { type: "integer", description: "Workout category id" },
    level_id: { type: "integer", description: "Workout level id" },
    browse_key: { type: "string", maxLength: 64, description: "Body-part / browse key" },
    gender: genderQuery,
    is_challenge: challengeQuery,
    weight: { type: "number", description: "User weight filter" },
    search: { type: "string", maxLength: SEARCH_MAX, description: "Title search" },
  };

  app.get(
    "/meal-categories/:categoryId/meals",
    {
      schema: publicGetRouteSchema({
        summary: "Meals in a category",
        hide,
        params: { categoryId: { type: "integer" } },
        queryProperties: mealListQueryProps,
      }),
    },
    async (request, reply) => {
      const categoryId = Number((request.params as { categoryId: string }).categoryId);
      if (!Number.isInteger(categoryId) || categoryId <= 0) {
        return validationError(reply, "Invalid category id", request.id);
      }
      const parsed = mealListQuerySchema.safeParse({
        ...(request.query as object),
        category_id: categoryId,
      });
      if (!parsed.success) return validationError(reply, formatZodError(parsed.error), request.id);
      const page = parsed.data.page ?? 1;
      const limit = parsed.data.limit ?? defaultPageSize;
      const locale = parsed.data.lang;
      const cacheKey = JSON.stringify({ ...parsed.data, lang: locale });
      const payload = await cachedList(app, request, "meals", ["list", cacheKey], async () => {
        const { db } = getMongo();
        const result = await listMeals(db, {
          page,
          limit,
          activeOnly: true,
          categoryId,
          gender: parsed.data.gender,
          isChallenge: parsed.data.is_challenge,
          userWeight: parsed.data.weight,
          search: parsed.data.search,
        });
        return legacyPaginated(
          result.items.map((item) => serializePublicMealListItem(item, locale)),
          page,
          limit,
          result.total,
        );
      });
      return sendPublicResponse(app, request, reply, "meals", ["list", cacheKey], payload);
    },
  );

  app.get(
    "/workout-levels/:levelId/categories",
    {
      schema: publicGetRouteSchema({
        summary: "Categories for a workout level",
        hide,
        params: { levelId: { type: "integer" } },
        queryProperties: {
          ...paginationQuery,
          gender: genderQuery,
          is_challenge: challengeQuery,
        },
      }),
    },
    async (request, reply) => {
      const levelId = Number((request.params as { levelId: string }).levelId);
      if (!Number.isInteger(levelId) || levelId <= 0) {
        return validationError(reply, "Invalid level id", request.id);
      }
      const parsed = workoutCategoryQuerySchema.safeParse({
        ...(request.query as object),
        level_id: levelId,
      });
      if (!parsed.success) return validationError(reply, formatZodError(parsed.error), request.id);
      const page = parsed.data.page ?? 1;
      const limit = parsed.data.limit ?? defaultPageSize;
      const locale = parsed.data.lang;
      const cacheKey = JSON.stringify({ ...parsed.data, lang: locale });
      const payload = await cachedList(app, request, "workoutCategories", ["list", cacheKey], async () => {
        const { db } = getMongo();
        const result = await listWorkoutCategories(db, {
          page,
          limit,
          activeOnly: true,
          levelId,
          gender: parsed.data.gender,
          isChallenge: parsed.data.is_challenge,
        });
        return legacyPaginated(
          result.items.map((item) => serializePublicWorkoutCategory(item, locale)),
          page,
          limit,
          result.total,
        );
      });
      return sendPublicResponse(app, request, reply, "workoutCategories", ["list", cacheKey], payload);
    },
  );

  async function respondExercises(
    request: FastifyRequest,
    reply: FastifyReply,
    extra: { category_id?: number; level_id?: number },
  ) {
    const parsed = exerciseListQuerySchema.safeParse({
      ...(request.query as object),
      ...extra,
    });
    if (!parsed.success) return validationError(reply, formatZodError(parsed.error), request.id);
    const page = parsed.data.page ?? 1;
    const limit = parsed.data.limit ?? defaultPageSize;
    const locale = parsed.data.lang;
    const cacheKey = JSON.stringify({ ...parsed.data, lang: locale });
    const payload = await cachedList(app, request, "exercises", ["list", cacheKey], async () => {
      const { db } = getMongo();
      const result = await listExercises(db, {
        page,
        limit,
        activeOnly: true,
        categoryId: parsed.data.category_id,
        levelId: parsed.data.level_id,
        browseKey: parsed.data.browse_key,
        gender: parsed.data.gender,
        isChallenge: parsed.data.is_challenge,
        userWeight: parsed.data.weight,
        search: parsed.data.search,
      });
      return legacyPaginated(
        result.items.map((item) => serializePublicExerciseListItem(item, locale)),
        page,
        limit,
        result.total,
      );
    });
    return sendPublicResponse(app, request, reply, "exercises", ["list", cacheKey], payload);
  }

  app.get(
    "/workout-levels/:levelId/categories/:categoryId/exercises",
    {
      schema: publicGetRouteSchema({
        summary: "Exercises for level and category",
        hide,
        params: { levelId: { type: "integer" }, categoryId: { type: "integer" } },
        queryProperties: exerciseListQueryProps,
      }),
    },
    async (request, reply) => {
      const params = request.params as { levelId: string; categoryId: string };
      const levelId = Number(params.levelId);
      const categoryId = Number(params.categoryId);
      if (!Number.isInteger(levelId) || levelId <= 0) return validationError(reply, "Invalid level id", request.id);
      if (!Number.isInteger(categoryId) || categoryId <= 0) {
        return validationError(reply, "Invalid category id", request.id);
      }
      return respondExercises(request, reply, { level_id: levelId, category_id: categoryId });
    },
  );

  app.get(
    "/workout-categories/:categoryId/exercises",
    {
      schema: publicGetRouteSchema({
        summary: "Exercises in a workout category",
        hide,
        params: { categoryId: { type: "integer" } },
        queryProperties: exerciseListQueryProps,
      }),
    },
    async (request, reply) => {
      const categoryId = Number((request.params as { categoryId: string }).categoryId);
      if (!Number.isInteger(categoryId) || categoryId <= 0) {
        return validationError(reply, "Invalid category id", request.id);
      }
      return respondExercises(request, reply, { category_id: categoryId });
    },
  );

  app.get(
    "/workout-categories/:categoryId/levels/:levelId/exercises",
    {
      schema: publicGetRouteSchema({
        summary: "Exercises for category and level",
        hide,
        params: { categoryId: { type: "integer" }, levelId: { type: "integer" } },
        queryProperties: exerciseListQueryProps,
      }),
    },
    async (request, reply) => {
      const params = request.params as { categoryId: string; levelId: string };
      const categoryId = Number(params.categoryId);
      const levelId = Number(params.levelId);
      if (!Number.isInteger(categoryId) || categoryId <= 0) {
        return validationError(reply, "Invalid category id", request.id);
      }
      if (!Number.isInteger(levelId) || levelId <= 0) return validationError(reply, "Invalid level id", request.id);
      return respondExercises(request, reply, { category_id: categoryId, level_id: levelId });
    },
  );
}

export async function registerPublicApiSurfaces(app: FastifyInstance) {
  await app.register(
    async (scope) => {
      await registerPublicContentRoutes(scope, { includeMeta: true });
    },
    { prefix: "/api/v1" },
  );

  await app.register(
    async (scope) => {
      await registerPublicContentRoutes(scope, { deprecated: true });
    },
    { prefix: "/api" },
  );
}
