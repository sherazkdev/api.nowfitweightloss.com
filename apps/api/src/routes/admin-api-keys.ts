import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { createApiKey, getMongo, listApiKeys, revokeApiKey } from "@weightloss/database";
import { requireAdmin } from "../plugins/auth.js";

const createBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
});

const apiKeyListItemSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    id: { type: "integer" },
    name: { type: "string" },
    prefix: { type: "string" },
    adminId: { type: "integer" },
    isActive: { type: "boolean" },
    createdAt: { type: "string" },
    lastUsedAt: { anyOf: [{ type: "string" }, { type: "null" }] },
    revokedAt: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
} as const;

export async function registerAdminApiKeyRoutes(app: FastifyInstance) {
  app.get(
    "/api/admin/api-keys",
    {
      preHandler: requireAdmin,
      schema: {
        tags: ["API Keys"],
        summary: "List API keys",
        description: "Returns masked API keys. Requires Bearer JWT (not x-api-key).",
        security: [{ BearerAuth: [] }],
        response: {
          200: {
            description: "API key list",
            type: "object",
            additionalProperties: true,
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                additionalProperties: true,
                properties: {
                  items: { type: "array", items: apiKeyListItemSchema },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { db } = getMongo();
      const items = await listApiKeys(db, request.admin!.id);
      return reply.send({
        success: true,
        data: {
          items: items.map((item) => ({
            ...item,
            createdAt: item.createdAt.toISOString(),
            lastUsedAt: item.lastUsedAt ? item.lastUsedAt.toISOString() : null,
            revokedAt: item.revokedAt ? item.revokedAt.toISOString() : null,
          })),
        },
      });
    },
  );

  app.post(
    "/api/admin/api-keys",
    {
      preHandler: requireAdmin,
      schema: {
        tags: ["API Keys"],
        summary: "Generate API key",
        description:
          "Creates a new x-api-key token. The full key is returned once — save it securely. Requires Bearer JWT.",
        security: [{ BearerAuth: [] }],
        body: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", description: "Label for this key, e.g. Swagger testing" },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = createBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(422).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Name is required" },
          requestId: request.id,
        });
      }

      const { db } = getMongo();
      const created = await createApiKey(db, {
        name: parsed.data.name,
        adminId: request.admin!.id,
      });

      return reply.status(201).send({
        success: true,
        data: {
          id: created.apiKey.id,
          name: created.apiKey.name,
          prefix: created.apiKey.prefix,
          token: created.plainKey,
          createdAt: created.apiKey.createdAt,
        },
      });
    },
  );

  app.delete(
    "/api/admin/api-keys/:id",
    {
      preHandler: requireAdmin,
      schema: {
        tags: ["API Keys"],
        summary: "Revoke API key",
        security: [{ BearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
      },
    },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id);
      if (!Number.isInteger(id) || id <= 0) {
        return reply.status(422).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid API key id" },
          requestId: request.id,
        });
      }

      const { db } = getMongo();
      const revoked = await revokeApiKey(db, id, request.admin!.id);
      if (!revoked) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "API key not found" },
          requestId: request.id,
        });
      }

      return reply.send({ success: true, data: { id } });
    },
  );
}
