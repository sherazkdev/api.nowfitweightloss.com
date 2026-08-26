import path from "node:path";
import { mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { loadEnvSafe } from "@weightloss/config";
import { closeMongo, connectMongo, getMongo } from "@weightloss/database";
import { seedAdminIfNeeded } from "@weightloss/auth";
import { createFastifyLoggerOptions, createLogger } from "@weightloss/logger";
import { registerInfrastructure, readinessCheck } from "./infrastructure.js";
import { registerAdminAuthRoutes } from "./routes/admin-auth.js";
import { registerAdminApiKeyRoutes } from "./routes/admin-api-keys.js";
import { registerAdminDataRoutes } from "./routes/admin-data.js";
import { registerAdminMealCategoryRoutes } from "./routes/admin-meal-categories.js";
import { registerAdminWorkoutLevelRoutes } from "./routes/admin-workout-levels.js";
import { registerAdminWorkoutCategoryRoutes } from "./routes/admin-workout-categories.js";
import { registerAdminExerciseRoutes } from "./routes/admin-exercises.js";
import { registerSwagger } from "./plugins/swagger.js";
import { registerSwaggerSecurityDefaults } from "./plugins/swagger-security-defaults.js";
import { registerSecurityHeaders } from "./plugins/security.js";
import { registerMetrics } from "./plugins/metrics.js";
import { registerAdminMealsRoutes } from "./routes/admin-meals.js";
import { registerAdminDashboardRoutes } from "./routes/admin-dashboard.js";

import { registerPublicApiSurfaces } from "./routes/public-content.js";

import { registerAdminMediaRoutes } from "./routes/admin-media.js";
import { registerAdminJobRoutes } from "./routes/admin-jobs.js";
import { registerAdminSystemRoutes } from "./routes/admin-system.js";
import { registerPublicOpenApi } from "./plugins/public-openapi.js";
import { registerWorkoutReminderRoutes } from "./routes/workout-reminders.js";
import { registerAdminWorkoutReminderRoutes } from "./routes/admin-workout-reminders.js";
import { registerAdminDeviceRoutes } from "./routes/admin-devices.js";
import { registerAdminFcmRoutes } from "./routes/admin-fcm.js";
import { registerAdminDeliveryLogRoutes } from "./routes/admin-delivery-logs.js";
import { initFirebase, isFirebaseConfigured } from "@weightloss/firebase";
import { renderApiLandingHtml } from "./views/landing-page.js";

const env = loadEnvSafe();
const log = createLogger({ name: "weightloss-api", level: env.LOG_LEVEL });

const app = Fastify({
  logger: createFastifyLoggerOptions({ name: "weightloss-api", level: env.LOG_LEVEL }),
  genReqId: () => randomUUID(),
  requestIdHeader: "x-request-id",
  disableRequestLogging: false,
  trustProxy: env.TRUST_PROXY,
});

registerSwaggerSecurityDefaults(app);

app.addHook("onRequest", async (request) => {
  request.startTime = Date.now();
});

app.addHook("onResponse", async (request, reply) => {
  const durationMs = Date.now() - (request.startTime ?? Date.now());
  if (durationMs > env.SLOW_REQUEST_MS) {
    request.log.warn(
      {
        route: request.routeOptions.url,
        method: request.method,
        statusCode: reply.statusCode,
        durationMs,
        cacheHit: request.cacheHit,
      },
      "slow_request",
    );
  }
});

app.get("/health", async () => ({
  success: true,
  data: { status: "ok", service: "weightloss-api", version: env.APP_VERSION },
}));

app.get("/ready", async (_request, reply) => {
  try {
    await readinessCheck();
    return reply.send({
      success: true,
      data: { status: "ready", mongo: "ok", redis: "ok" },
    });
  } catch {
    return reply.status(503).send({
      success: false,
      error: { code: "DEPENDENCY_UNAVAILABLE", message: "Dependencies are not ready" },
    });
  }
});

app.get("/", async (request, reply) => {
  const accept = request.headers.accept ?? "";
  if (accept.includes("text/html")) {
    const adminUrl = env.ADMIN_PUBLIC_URL.replace(/\/$/, "");
    return reply
      .type("text/html")
      .send(
        renderApiLandingHtml({
          docsEnabled: env.API_DOCS_ENABLED,
          appVersion: env.APP_VERSION,
          adminUrl,
        }),
      );
  }

  return {
    success: true,
    data: {
      message: "Weight Loss App API",
      version: env.APP_VERSION,
      admin: env.ADMIN_PUBLIC_URL,
      publicApi: "/api/v1",
      ...(env.API_DOCS_ENABLED
        ? { docs: { public: "/docs/public", admin: "/docs" } }
        : {}),
      health: "/health",
      ready: "/ready",
      metrics: "/metrics",
    },
  };
});

async function main() {
  try {
    await connectMongo(env);
    log.info({ database: env.MONGODB_DB }, "mongo_connected");

    await app.register(cookie, {
      secret: env.COOKIE_SECRET,
      hook: "onRequest",
    });

    await app.register(cors, {
      origin: env.ALLOWED_ORIGINS,
      credentials: true,
    });

    await mkdir(env.UPLOAD_ROOT, { recursive: true });
    if (env.STORAGE_DRIVER === "local") {
      for (const folder of [
        "meals",
        "meal-categories",
        "workout-levels",
        "workout-categories",
        "exercises",
        "imports",
        "exports",
      ]) {
        await mkdir(path.join(env.UPLOAD_ROOT, folder), { recursive: true });
      }

      await app.register(fastifyStatic, {
        root: path.resolve(env.UPLOAD_ROOT),
        prefix: "/uploads/",
        decorateReply: false,
      });
    } else {
      log.info({ driver: env.STORAGE_DRIVER }, "storage_driver_active");
    }

    await app.register(multipart, {
      limits: {
        fileSize: env.MAX_IMAGE_UPLOAD_MB * 1024 * 1024,
        files: 1,
      },
    });

    await registerInfrastructure(app, env);
    registerSecurityHeaders(app, env);
    registerMetrics(app, env);
    log.info("redis_connected");

    if (env.API_DOCS_ENABLED) {
      if (env.NODE_ENV === "production") {
        log.warn("api_docs_enabled_in_production");
      }
      await registerSwagger(app, env);
    } else {
      log.info("api_docs_disabled");
    }

    const seed = await seedAdminIfNeeded(getMongo().db, env);
    if (seed.created) {
      log.info({ email: seed.email }, "admin_seed_created");
    } else {
      log.info({ email: seed.email }, "admin_seed_skipped");
    }

    await registerAdminAuthRoutes(app);
    await registerAdminApiKeyRoutes(app);
    await registerAdminDataRoutes(app);
    await registerPublicApiSurfaces(app);
    await registerAdminDashboardRoutes(app);
    await registerAdminMealsRoutes(app);
    await registerAdminMealCategoryRoutes(app);
    await registerAdminWorkoutLevelRoutes(app);
    await registerAdminWorkoutCategoryRoutes(app);
    await registerAdminExerciseRoutes(app);
    await registerAdminMediaRoutes(app);
    await registerAdminJobRoutes(app);
    await registerAdminSystemRoutes(app);
    await registerWorkoutReminderRoutes(app);
    await registerAdminWorkoutReminderRoutes(app);
    await registerAdminDeviceRoutes(app);
    await registerAdminFcmRoutes(app);
    await registerAdminDeliveryLogRoutes(app);
    await registerPublicOpenApi(app, env);

    if (isFirebaseConfigured(env)) {
      initFirebase(env);
      log.info({ projectId: env.FIREBASE_PROJECT_ID }, "firebase_initialized");
    } else {
      log.warn("firebase_not_configured_workout_reminders_disabled");
    }

    await app.listen({ host: env.API_HOST, port: env.API_PORT });
    log.info({ port: env.API_PORT, host: env.API_HOST }, "api_started");
  } catch (error) {
    log.fatal({ err: error }, "api_start_failed");
    process.exit(1);
  }
}

const shutdown = async (signal: string) => {
  log.info({ signal }, "api_shutting_down");
  await app.close();
  await closeMongo();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

void main();
