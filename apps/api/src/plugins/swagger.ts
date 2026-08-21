import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { FastifyInstance } from "fastify";
import type { AppEnv } from "@weightloss/config";
import { SWAGGER_AUTH_THEME_CSS, SWAGGER_AUTH_THEME_JS } from "./swagger-auth-theme.js";

const ADMIN_DOCS_PREFIXES = [
  "/api/admin/login",
  "/api/admin/api-keys",
  "/api/admin/meals",
  "/api/admin/meal-categories",
  "/api/admin/workout-levels",
  "/api/admin/workout-categories",
  "/api/admin/exercises",
  "/api/admin/media",
];

function isUsefulAdminDocsRoute(url: string) {
  return ADMIN_DOCS_PREFIXES.some((prefix) => url === prefix || url.startsWith(`${prefix}/`));
}

export async function registerSwagger(app: FastifyInstance, env: AppEnv) {
  if (!env.API_DOCS_ENABLED) return;

  const serverUrl = env.API_PUBLIC_URL.replace(/\/$/, "");
  const adminUrl = env.ADMIN_PUBLIC_URL.replace(/\/$/, "");

  await app.register(swagger, {
    transform: ({ schema, url }) => {
      if (!isUsefulAdminDocsRoute(url)) {
        return { schema: { ...schema, hide: true }, url };
      }
      return { schema, url };
    },
    openapi: {
      openapi: "3.0.3",
      info: {
        title: "WeightLoss Admin API",
        description: [
          "Admin login, content CRUD, and media upload.",
          "",
          `**Public content + language dropdown:** ${serverUrl}/docs/public`,
          "On that page: open any GET → Try it out → **lang** dropdown → Execute. Example: `/api/v1/meals?lang=hi`.",
          "",
          "**Authentication (choose one):**",
          "1. **Bearer JWT** — `POST /api/admin/login` → paste `data.accessToken` in Authorize, or use the login panel above.",
          "2. **x-api-key** — create keys in Admin → **API Keys** (`POST /api/admin/api-keys`, Bearer required). Send header `x-api-key: wl_…`",
          "",
          `Manage keys: ${adminUrl}/admin/settings/api-keys`,
        ].join("\n"),
        version: env.APP_VERSION,
      },
      servers: [{ url: serverUrl, description: "API server" }],
      tags: [
        { name: "Auth", description: "Login" },
        { name: "API Keys", description: "Generate and revoke x-api-key tokens (Bearer JWT required)" },
        { name: "Meals", description: "Meal CRUD" },
        { name: "Meal Categories", description: "Meal category CRUD" },
        { name: "Workout", description: "Levels, categories, exercises" },
        { name: "Media", description: "Image uploads" },
      ],
      components: {
        securitySchemes: {
          BearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description:
              "JWT access token from POST /api/admin/login (field: data.accessToken). Paste token only — not the full JSON.",
          },
          ApiKeyAuth: {
            type: "apiKey",
            in: "header",
            name: "x-api-key",
            description:
              "Long-lived API key (prefix wl_). Create via POST /api/admin/api-keys or Admin → API Keys. Works on most admin routes except key management.",
          },
        },
        schemas: {
          ApiSuccess: {
            type: "object",
            properties: {
              success: { type: "boolean", enum: [true] },
              data: { type: "object" },
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
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
      persistAuthorization: true,
      displayRequestDuration: true,
      tryItOutEnabled: true,
      filter: true,
    },
    theme: {
      title: "WeightLoss Admin API",
      css: [{ filename: "auth-panel.css", content: SWAGGER_AUTH_THEME_CSS }],
      js: [{ filename: "auth-panel.js", content: SWAGGER_AUTH_THEME_JS }],
    },
  });
}
