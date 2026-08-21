import type { FastifyInstance } from "fastify";
import { getDashboardData, getMongo } from "@weightloss/database";
import { requireAdminAuth } from "../plugins/auth.js";

export async function registerAdminDashboardRoutes(app: FastifyInstance) {
  app.get(
    "/api/admin/dashboard",
    {
      preHandler: requireAdminAuth,
      schema: {
        tags: ["Dashboard"],
        summary: "Admin dashboard aggregates",
        description:
          "Live Mongo counts and groupings: stats, meals by category, exercises by level, content by gender/difficulty, recent items. Empty arrays when a series has no rows.",
        security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
      },
    },
    async (request, reply) => {
      const result = await app.cache.adminGetOrSet(
        "dashboard",
        ["summary"],
        app.cache.dashboardTtl(),
        async () => {
          const { db } = getMongo();
          return getDashboardData(db);
        },
      );

      request.cacheHit = result.hit;
      reply.header("X-Cache-Hit", result.hit ? "1" : "0");

      return reply.send({ success: true, data: result.value });
    },
  );
}
