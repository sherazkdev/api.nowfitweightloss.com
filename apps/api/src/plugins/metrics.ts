import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AppEnv } from "@weightloss/config";
import { createAppMetrics, type AppMetrics } from "@weightloss/metrics";

declare module "fastify" {
  interface FastifyInstance {
    metrics: AppMetrics | null;
  }
}

function normalizeRoute(request: FastifyRequest): string {
  const route = request.routeOptions.url;
  if (route) return route;
  const path = request.url.split("?")[0] ?? request.url;
  return path.replace(/\d+/g, ":id");
}

function authorizeMetrics(request: FastifyRequest, reply: FastifyReply, token: string): boolean {
  if (!token) return true;
  const header = request.headers.authorization;
  if (header === `Bearer ${token}`) return true;
  reply.status(401).send({
    success: false,
    error: { code: "UNAUTHORIZED", message: "Invalid metrics token" },
    requestId: request.id,
  });
  return false;
}

export function registerMetrics(app: FastifyInstance, env: AppEnv) {
  if (!env.METRICS_ENABLED) {
    app.decorate("metrics", null);
    return;
  }

  const metrics = createAppMetrics();
  app.decorate("metrics", metrics);

  app.addHook("onResponse", async (request, reply) => {
    const path = request.url.split("?")[0] ?? request.url;
    if (path === env.METRICS_PATH || path === "/health" || path === "/ready") return;

    const route = normalizeRoute(request);
    const labels = {
      method: request.method,
      route,
      status: String(reply.statusCode),
    };

    metrics.httpRequests.inc(labels);
    metrics.httpDuration.observe(
      { method: request.method, route },
      Date.now() - (request.startTime ?? Date.now()),
    );
  });

  app.get(env.METRICS_PATH, async (request, reply) => {
    if (!authorizeMetrics(request, reply, env.METRICS_TOKEN)) return;

    try {
      const stats = await app.queues.getQueueStats();
      for (const [queue, counts] of Object.entries(stats)) {
        for (const [state, count] of Object.entries(counts)) {
          metrics.queueJobs.set({ queue, state }, count);
        }
      }
    } catch {
      /* queue stats are best-effort */
    }

    return reply.type("text/plain; version=0.0.4; charset=utf-8").send(metrics.registry.render());
  });
}
