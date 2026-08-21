import type { FastifyInstance } from "fastify";

const PUBLIC_ADMIN_PATHS = new Set([
  "/api/admin/login",
  "/api/admin/refresh",
  "/api/admin/logout",
]);

const BEARER_ONLY_PREFIXES = ["/api/admin/api-keys", "/api/admin/change-password"];

/** Inject OpenAPI security on admin routes so Swagger shows Bearer + x-api-key locks. */
export function registerSwaggerSecurityDefaults(app: FastifyInstance) {
  app.addHook("onRoute", (routeOptions) => {
    const url = routeOptions.url;
    if (!url?.startsWith("/api/admin")) return;
    if (PUBLIC_ADMIN_PATHS.has(url)) return;

    routeOptions.schema ??= {};
    if (routeOptions.schema.security) return;

    const bearerOnly = BEARER_ONLY_PREFIXES.some((prefix) => url.startsWith(prefix));
    routeOptions.schema.security = bearerOnly
      ? [{ BearerAuth: [] }]
      : [{ BearerAuth: [] }, { ApiKeyAuth: [] }];
  });
}
