import { z } from "zod";
import type { FastifyInstance, FastifyReply } from "fastify";
import { normalizeEmail } from "@weightloss/shared";
import { resolveRequestIp } from "../lib/request-ip.js";
import { clearRefreshCookie, requireAdmin, setRefreshCookie } from "../plugins/auth.js";

const loginBodySchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
  confirmPassword: z.string().min(8),
});

function invalidCredentials(reply: FastifyReply, requestId: string) {
  return reply.status(401).send({
    success: false,
    error: {
      code: "INVALID_CREDENTIALS",
      message: "Invalid email or password",
    },
    requestId,
  });
}

export async function registerAdminAuthRoutes(app: FastifyInstance) {
  app.post("/api/admin/login", {
    schema: {
      tags: ["Auth"],
      summary: "Admin login",
      description: "Returns Bearer accessToken for Swagger Authorize or admin UI.",
      body: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string" },
        },
      },
      response: {
        200: {
          description: "Login success",
          type: "object",
          additionalProperties: true,
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              additionalProperties: true,
              properties: {
                accessToken: { type: "string" },
                expiresIn: { type: "number" },
                tokenType: { type: "string" },
                admin: { type: "object", additionalProperties: true },
              },
            },
          },
        },
        401: {
          description: "Invalid credentials",
          type: "object",
          additionalProperties: true,
          properties: {
            success: { type: "boolean" },
            error: {
              type: "object",
              additionalProperties: true,
              properties: {
                code: { type: "string" },
                message: { type: "string" },
              },
            },
            requestId: { type: "string" },
          },
        },
        400: {
          description: "Validation error",
          type: "object",
          additionalProperties: true,
        },
        429: {
          description: "Too many login attempts",
          type: "object",
          additionalProperties: true,
        },
      },
    },
  }, async (request, reply) => {
    const parsed = loginBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Email and password are required",
        },
        requestId: request.id,
      });
    }

    const ip = resolveRequestIp(request, app.env);
    const emailNormalized = normalizeEmail(parsed.data.email);
    const loginLimit = await app.rateLimiter.check(
      app.redis.cache,
      "login",
      `ip:${ip}:email:${emailNormalized}`,
    );

    reply.header("X-RateLimit-Limit", String(loginLimit.limit));
    reply.header("X-RateLimit-Remaining", String(loginLimit.remaining));

    if (!loginLimit.allowed) {
      return reply.status(429).send({
        success: false,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many login attempts",
        },
        requestId: request.id,
      });
    }

    const result = await app.auth.login(parsed.data.email, parsed.data.password);
    if (!result) {
      return invalidCredentials(reply, request.id);
    }

    setRefreshCookie(
      reply,
      app.auth.encodeRefreshCookie(result.sessionId, result.refreshToken),
      app.auth.refreshTtlSeconds(),
    );

    return reply.send({
      success: true,
      data: {
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
        tokenType: result.tokenType,
        admin: result.admin,
      },
    });
  });

  app.post("/api/admin/refresh", {
    schema: {
      tags: ["Auth"],
      summary: "Refresh access token",
      description: "Uses refresh cookie from login. Returns new Bearer accessToken.",
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                accessToken: { type: "string" },
                expiresIn: { type: "number" },
                tokenType: { type: "string" },
              },
            },
          },
        },
        default: { type: "object" },
      },
    },
  }, async (request, reply) => {
    const refreshCookie = request.cookies[app.env.REFRESH_COOKIE_NAME];
    const result = await app.auth.refresh(refreshCookie);

    if (!result) {
      clearRefreshCookie(reply);
      return reply.status(401).send({
        success: false,
        error: {
          code: "SESSION_EXPIRED",
          message: "Refresh session is invalid or expired",
        },
        requestId: request.id,
      });
    }

    setRefreshCookie(
      reply,
      app.auth.encodeRefreshCookie(result.sessionId, result.refreshToken),
      app.auth.refreshTtlSeconds(),
    );

    return reply.send({
      success: true,
      data: {
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
        tokenType: result.tokenType,
        admin: result.admin,
      },
    });
  });

  app.post("/api/admin/logout", async (request, reply) => {
    const refreshCookie = request.cookies[app.env.REFRESH_COOKIE_NAME];
    await app.auth.logout(refreshCookie);
    clearRefreshCookie(reply);

    return reply.send({
      success: true,
      data: { loggedOut: true },
    });
  });

  app.post("/api/admin/change-password", { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = changePasswordBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Current password, new password, and confirmation are required",
        },
        requestId: request.id,
      });
    }

    const admin = request.admin;
    if (!admin) {
      return reply.status(401).send({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
        requestId: request.id,
      });
    }

    const result = await app.auth.changePassword(
      admin,
      parsed.data.currentPassword,
      parsed.data.newPassword,
      parsed.data.confirmPassword,
    );

    if (!result.ok) {
      const statusCode = result.code === "INVALID_CREDENTIALS" ? 401 : 400;
      return reply.status(statusCode).send({
        success: false,
        error: {
          code: result.code,
          message: result.message,
        },
        requestId: request.id,
      });
    }

    clearRefreshCookie(reply);

    return reply.send({
      success: true,
      data: {
        passwordChanged: true,
        requiresLogin: true,
      },
    });
  });
}
