export type EndpointRow = {
  method: string;
  path: string;
  desc: string;
  auth?: "none" | "public" | "bearer" | "bearer-or-key" | "bearer-only";
  group: string;
};

export const PUBLIC_ENDPOINTS: EndpointRow[] = [
  { method: "GET", path: "/api/v1/", desc: "API discovery (version, pagination, lang, links)", auth: "bearer-or-key", group: "Public v1" },
  { method: "GET", path: "/api/v1/openapi.json", desc: "OpenAPI 3.0 spec", auth: "none", group: "Public v1" },
  { method: "GET", path: "/api/v1/meal-categories", desc: "List active meal categories", auth: "bearer-or-key", group: "Public v1" },
  { method: "GET", path: "/api/v1/meal-categories/:categoryId/meals", desc: "Meals in a category", auth: "bearer-or-key", group: "Public v1" },
  { method: "GET", path: "/api/v1/meals", desc: "List meals with filters", auth: "bearer-or-key", group: "Public v1" },
  { method: "GET", path: "/api/v1/meals/:id", desc: "Meal detail", auth: "bearer-or-key", group: "Public v1" },
  { method: "GET", path: "/api/v1/workout-levels", desc: "List workout levels", auth: "bearer-or-key", group: "Public v1" },
  { method: "GET", path: "/api/v1/workout-levels/:levelId/categories", desc: "Categories for a level", auth: "bearer-or-key", group: "Public v1" },
  { method: "GET", path: "/api/v1/workout-categories", desc: "List workout categories", auth: "bearer-or-key", group: "Public v1" },
  { method: "GET", path: "/api/v1/workout-categories/:categoryId/exercises", desc: "Exercises in a category", auth: "bearer-or-key", group: "Public v1" },
  { method: "GET", path: "/api/v1/exercises", desc: "List exercises with filters", auth: "bearer-or-key", group: "Public v1" },
  { method: "GET", path: "/api/v1/exercises/:id", desc: "Exercise detail", auth: "bearer-or-key", group: "Public v1" },
];

export const PLATFORM_ENDPOINTS: EndpointRow[] = [
  { method: "GET", path: "/health", desc: "Liveness probe", auth: "none", group: "Platform" },
  { method: "GET", path: "/ready", desc: "Mongo + Redis readiness", auth: "none", group: "Platform" },
  { method: "GET", path: "/metrics", desc: "Prometheus metrics", auth: "none", group: "Platform" },
  { method: "GET", path: "/docs", desc: "Admin Swagger UI", auth: "none", group: "Platform" },
  { method: "GET", path: "/docs/public", desc: "Public Swagger UI", auth: "none", group: "Platform" },
];

export const ADMIN_AUTH_ENDPOINTS: EndpointRow[] = [
  { method: "POST", path: "/api/admin/login", desc: "Email/password → Bearer accessToken", auth: "none", group: "Admin auth" },
  { method: "POST", path: "/api/admin/refresh", desc: "Refresh cookie → new accessToken", auth: "none", group: "Admin auth" },
  { method: "POST", path: "/api/admin/logout", desc: "Revoke refresh session", auth: "none", group: "Admin auth" },
  { method: "POST", path: "/api/admin/change-password", desc: "Change password (Bearer only)", auth: "bearer-only", group: "Admin auth" },
];

export const ADMIN_API_KEY_ENDPOINTS: EndpointRow[] = [
  { method: "GET", path: "/api/admin/api-keys", desc: "List your API keys (masked)", auth: "bearer-only", group: "API keys" },
  { method: "POST", path: "/api/admin/api-keys", desc: "Create x-api-key (shown once)", auth: "bearer-only", group: "API keys" },
  { method: "DELETE", path: "/api/admin/api-keys/:id", desc: "Revoke API key", auth: "bearer-only", group: "API keys" },
];

export const ADMIN_CONTENT_ENDPOINTS: EndpointRow[] = [
  { method: "GET", path: "/api/admin/dashboard", desc: "Dashboard stats & trends", auth: "bearer-or-key", group: "Admin content" },
  { method: "GET", path: "/api/admin/system", desc: "System status & queues", auth: "bearer-or-key", group: "Admin content" },
  { method: "GET", path: "/api/admin/meals", desc: "List meals (admin)", auth: "bearer-or-key", group: "Admin content" },
  { method: "POST", path: "/api/admin/meals", desc: "Create meal", auth: "bearer-or-key", group: "Admin content" },
  { method: "PUT", path: "/api/admin/meals/:id", desc: "Update meal", auth: "bearer-or-key", group: "Admin content" },
  { method: "DELETE", path: "/api/admin/meals/:id", desc: "Delete meal", auth: "bearer-or-key", group: "Admin content" },
  { method: "GET", path: "/api/admin/meal-categories", desc: "List meal categories", auth: "bearer-or-key", group: "Admin content" },
  { method: "POST", path: "/api/admin/meal-categories", desc: "Create meal category", auth: "bearer-or-key", group: "Admin content" },
  { method: "PUT", path: "/api/admin/meal-categories/:id", desc: "Update meal category", auth: "bearer-or-key", group: "Admin content" },
  { method: "DELETE", path: "/api/admin/meal-categories/:id", desc: "Delete meal category", auth: "bearer-or-key", group: "Admin content" },
  { method: "GET", path: "/api/admin/workout-levels", desc: "List workout levels", auth: "bearer-or-key", group: "Admin content" },
  { method: "POST", path: "/api/admin/workout-levels", desc: "Create workout level", auth: "bearer-or-key", group: "Admin content" },
  { method: "PUT", path: "/api/admin/workout-levels/:id", desc: "Update workout level", auth: "bearer-or-key", group: "Admin content" },
  { method: "DELETE", path: "/api/admin/workout-levels/:id", desc: "Delete workout level", auth: "bearer-or-key", group: "Admin content" },
  { method: "GET", path: "/api/admin/workout-categories", desc: "List workout categories", auth: "bearer-or-key", group: "Admin content" },
  { method: "POST", path: "/api/admin/workout-categories", desc: "Create workout category", auth: "bearer-or-key", group: "Admin content" },
  { method: "PUT", path: "/api/admin/workout-categories/:id", desc: "Update workout category", auth: "bearer-or-key", group: "Admin content" },
  { method: "DELETE", path: "/api/admin/workout-categories/:id", desc: "Delete workout category", auth: "bearer-or-key", group: "Admin content" },
  { method: "GET", path: "/api/admin/exercises", desc: "List exercises", auth: "bearer-or-key", group: "Admin content" },
  { method: "POST", path: "/api/admin/exercises", desc: "Create exercise", auth: "bearer-or-key", group: "Admin content" },
  { method: "PUT", path: "/api/admin/exercises/:id", desc: "Update exercise", auth: "bearer-or-key", group: "Admin content" },
  { method: "DELETE", path: "/api/admin/exercises/:id", desc: "Delete exercise", auth: "bearer-or-key", group: "Admin content" },
  { method: "POST", path: "/api/admin/media/upload", desc: "Upload image to local storage", auth: "bearer-or-key", group: "Admin content" },
  { method: "POST", path: "/api/admin/data/import-csv", desc: "Queue CSV import job", auth: "bearer-or-key", group: "Admin data" },
  { method: "POST", path: "/api/admin/data/export-csv", desc: "Queue CSV export job", auth: "bearer-or-key", group: "Admin data" },
  { method: "POST", path: "/api/admin/data/raw-import", desc: "Queue raw JSON import", auth: "bearer-or-key", group: "Admin data" },
  { method: "GET", path: "/api/admin/jobs", desc: "Import/export job history", auth: "bearer-or-key", group: "Admin data" },
];

export const ALL_ENDPOINT_GROUPS = [
  { id: "public", title: "Public content API", rows: PUBLIC_ENDPOINTS },
  { id: "platform", title: "Platform & docs", rows: PLATFORM_ENDPOINTS },
  { id: "auth", title: "Admin authentication", rows: ADMIN_AUTH_ENDPOINTS },
  { id: "keys", title: "API keys (x-api-key)", rows: ADMIN_API_KEY_ENDPOINTS },
  { id: "admin", title: "Admin CRUD & jobs", rows: ADMIN_CONTENT_ENDPOINTS },
] as const;

export function endpointRequiresCredential(row: EndpointRow): boolean {
  return row.auth === "bearer" || row.auth === "bearer-or-key" || row.auth === "bearer-only";
}

export function authBadge(auth: EndpointRow["auth"]): { label: string; tone: "green" | "purple" | "muted" | "orange" } {
  switch (auth) {
    case "bearer-or-key":
      return { label: "Bearer or x-api-key", tone: "purple" };
    case "bearer-only":
      return { label: "Bearer JWT only", tone: "orange" };
    case "public":
      return { label: "Public + ETag", tone: "green" };
    case "none":
      return { label: "No auth", tone: "muted" };
    default:
      return { label: "—", tone: "muted" };
  }
}
