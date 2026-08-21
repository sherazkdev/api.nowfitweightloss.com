import type { AppEnv } from "@weightloss/config";
import { langOpenApiParameter } from "./lang-param.js";

const langParam = { ...langOpenApiParameter };

const ok = (description: string) => ({
  "200": { description },
});

const okCached = (description: string) => ({
  "200": { description },
  "304": { description: "Not modified" },
});

export function buildPublicV1OpenApi(env: AppEnv) {
  const origin = env.API_PUBLIC_URL.replace(/\/$/, "");

  return {
    openapi: "3.0.3",
    info: {
      title: "WeightLoss Public Content API",
      version: "1.0.0",
      description: [
        "Read-only JSON API for meals and workouts. Responses use snake_case field names.",
        "",
        "## Authentication (required)",
        "Every content GET needs **x-api-key** or **Bearer JWT**. Without either, the API returns **401** and no data.",
        "1. Click **Authorize** (or use the panel at the top).",
        "2. Paste an `x-api-key` (`wl_…` from Admin → API Keys) **or** a Bearer access token from login.",
        "3. Then Try it out.",
        "",
        "## How to change language (testers)",
        "1. Expand any **GET** below (start with `/api/v1/meals`).",
        "2. Click **Try it out** (already on if you see input fields).",
        "3. **lang is required** — pick from the dropdown (`en`, `hi`, `es`, …).",
        "4. Click **Execute**.",
        "",
        "Example: `" + origin + "/api/v1/meals?lang=hi`",
        "",
        "If a record has no translation for that locale, the API still returns **English** (fallback). The JSON shape stays a single string per field (`title`, `name`, …), not a 15-key object.",
        "",
        "Requests without `lang` return 422. Requests without x-api-key / Bearer return 401.",
      ].join("\n"),
    },
    servers: [{ url: origin, description: "API origin" }],
    security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
    tags: [
      { name: "Platform", description: "Liveness and readiness" },
      { name: "Content", description: "Public meals and workouts — use lang to localize" },
    ],
    paths: {
      "/health": {
        get: {
          tags: ["Platform"],
          summary: "Liveness",
          description: "Process is up. Does not check Mongo or Redis. No auth.",
          security: [],
          responses: ok("Health payload"),
        },
      },
      "/ready": {
        get: {
          tags: ["Platform"],
          summary: "Readiness",
          description: "Mongo + Redis are reachable. No auth.",
          security: [],
          responses: {
            "200": { description: "Ready" },
            "503": { description: "Dependencies unavailable" },
          },
        },
      },
      "/api/v1/": {
        get: {
          tags: ["Content"],
          summary: "API discovery",
          description: "Lists public endpoints. Requires x-api-key or Bearer JWT. Content GETs also require lang.",
          responses: ok("Meta and endpoint list"),
        },
      },
      "/api/v1/meal-categories": {
        get: {
          tags: ["Content"],
          summary: "List meal categories",
          parameters: [
            langParam,
            { name: "gender", in: "query", schema: { type: "string", enum: ["male", "female", "both"] } },
            { name: "is_challenge", in: "query", schema: { type: "boolean" } },
            { name: "weight", in: "query", schema: { type: "number" } },
          ],
          responses: okCached("Category array"),
        },
      },
      "/api/v1/meal-categories/{categoryId}/meals": {
        get: {
          tags: ["Content"],
          summary: "Meals in a category",
          parameters: [
            { name: "categoryId", in: "path", required: true, schema: { type: "integer" } },
            langParam,
            { name: "page", in: "query", schema: { type: "integer", minimum: 1 } },
            { name: "limit", in: "query", schema: { type: "integer" } },
            { name: "gender", in: "query", schema: { type: "string", enum: ["male", "female", "both"] } },
            { name: "is_challenge", in: "query", schema: { type: "boolean" } },
            { name: "weight", in: "query", schema: { type: "number" } },
            { name: "search", in: "query", schema: { type: "string" } },
          ],
          responses: okCached("Paginated meals"),
        },
      },
      "/api/v1/meals": {
        get: {
          tags: ["Content"],
          summary: "List meals",
          parameters: [
            langParam,
            { name: "page", in: "query", schema: { type: "integer", minimum: 1 } },
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", minimum: 1, maximum: env.MAX_PAGE_SIZE },
            },
            { name: "category_id", in: "query", schema: { type: "integer" } },
            { name: "gender", in: "query", schema: { type: "string", enum: ["male", "female", "both"] } },
            { name: "is_challenge", in: "query", schema: { type: "boolean" } },
            { name: "weight", in: "query", schema: { type: "number" } },
            { name: "search", in: "query", schema: { type: "string", maxLength: 100 } },
          ],
          responses: {
            ...okCached("Paginated meals"),
            "422": { description: "Validation error" },
          },
        },
      },
      "/api/v1/meals/{id}": {
        get: {
          tags: ["Content"],
          summary: "Meal detail",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "integer" } },
            langParam,
          ],
          responses: {
            ...okCached("Meal with ingredients and instructions"),
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/workout-levels": {
        get: {
          tags: ["Content"],
          summary: "List workout levels",
          parameters: [langParam],
          responses: okCached("Level array"),
        },
      },
      "/api/v1/workout-categories": {
        get: {
          tags: ["Content"],
          summary: "List workout categories",
          parameters: [
            langParam,
            { name: "page", in: "query", schema: { type: "integer" } },
            { name: "limit", in: "query", schema: { type: "integer" } },
            { name: "level_id", in: "query", schema: { type: "integer" } },
            { name: "gender", in: "query", schema: { type: "string", enum: ["male", "female", "both"] } },
            { name: "is_challenge", in: "query", schema: { type: "boolean" } },
          ],
          responses: okCached("Paginated categories"),
        },
      },
      "/api/v1/exercises": {
        get: {
          tags: ["Content"],
          summary: "List exercises",
          parameters: [
            langParam,
            { name: "page", in: "query", schema: { type: "integer" } },
            { name: "limit", in: "query", schema: { type: "integer" } },
            { name: "category_id", in: "query", schema: { type: "integer" } },
            { name: "level_id", in: "query", schema: { type: "integer" } },
            { name: "browse_key", in: "query", schema: { type: "string", maxLength: 64 } },
            { name: "gender", in: "query", schema: { type: "string", enum: ["male", "female", "both"] } },
            { name: "is_challenge", in: "query", schema: { type: "boolean" } },
            { name: "weight", in: "query", schema: { type: "number" } },
            { name: "search", in: "query", schema: { type: "string", maxLength: 100 } },
          ],
          responses: okCached("Paginated exercises"),
        },
      },
      "/api/v1/exercises/{id}": {
        get: {
          tags: ["Content"],
          summary: "Exercise detail",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "integer" } },
            langParam,
            { name: "level_id", in: "query", schema: { type: "integer" } },
          ],
          responses: {
            ...okCached("Exercise detail"),
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/workout-levels/{levelId}/categories": {
        get: {
          tags: ["Content"],
          summary: "Categories for a workout level",
          parameters: [
            { name: "levelId", in: "path", required: true, schema: { type: "integer" } },
            langParam,
            { name: "page", in: "query", schema: { type: "integer" } },
            { name: "limit", in: "query", schema: { type: "integer" } },
            { name: "gender", in: "query", schema: { type: "string", enum: ["male", "female", "both"] } },
            { name: "is_challenge", in: "query", schema: { type: "boolean" } },
          ],
          responses: okCached("Paginated categories"),
        },
      },
      "/api/v1/workout-levels/{levelId}/categories/{categoryId}/exercises": {
        get: {
          tags: ["Content"],
          summary: "Exercises for level and category",
          parameters: [
            { name: "levelId", in: "path", required: true, schema: { type: "integer" } },
            { name: "categoryId", in: "path", required: true, schema: { type: "integer" } },
            langParam,
          ],
          responses: okCached("Paginated exercises"),
        },
      },
      "/api/v1/workout-categories/{categoryId}/exercises": {
        get: {
          tags: ["Content"],
          summary: "Exercises in a workout category",
          parameters: [
            { name: "categoryId", in: "path", required: true, schema: { type: "integer" } },
            langParam,
          ],
          responses: okCached("Paginated exercises"),
        },
      },
      "/api/v1/workout-categories/{categoryId}/levels/{levelId}/exercises": {
        get: {
          tags: ["Content"],
          summary: "Exercises for category and level",
          parameters: [
            { name: "categoryId", in: "path", required: true, schema: { type: "integer" } },
            { name: "levelId", in: "path", required: true, schema: { type: "integer" } },
            langParam,
          ],
          responses: okCached("Paginated exercises"),
        },
      },
    },
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "x-api-key",
          description: "API key from Admin → API Keys (prefix wl_). Required unless Bearer JWT is sent.",
        },
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT from POST /api/admin/login (data.accessToken). Required unless x-api-key is sent.",
        },
      },
      parameters: {
        Lang: langOpenApiParameter,
      },
      schemas: {
        ApiSuccess: {
          type: "object",
          properties: {
            success: { type: "boolean", enum: [true] },
            data: {},
          },
        },
        ApiError: {
          type: "object",
          properties: {
            success: { type: "boolean", enum: [false] },
            error: {
              type: "object",
              properties: {
                code: { type: "string" },
                message: { type: "string" },
              },
            },
            requestId: { type: "string" },
          },
        },
      },
    },
  };
}
