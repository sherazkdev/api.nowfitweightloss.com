import type { FastifyReply, FastifyRequest } from "fastify";
import type { AdminDocument } from "@weightloss/contracts";

declare module "fastify" {
  interface FastifyRequest {
    admin?: AdminDocument;
    authMethod?: "bearer" | "api-key";
  }
}

export function getBearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

export function getApiKey(request: FastifyRequest): string | null {
  const header = request.headers["x-api-key"];
  if (typeof header === "string" && header.trim()) return header.trim();
  if (Array.isArray(header) && header[0]?.trim()) return header[0].trim();
  return null;
}

function unauthorized(reply: FastifyReply, request: FastifyRequest, message: string) {
  return reply.status(401).send({
    success: false,
    error: {
      code: "UNAUTHORIZED",
      message,
    },
    requestId: request.id,
  });
}

export async function requireAdminAuth(request: FastifyRequest, reply: FastifyReply) {
  const bearer = getBearerToken(request);
  if (bearer) {
    const admin = await request.server.auth.verifyBearerToken(bearer);
    if (admin) {
      request.admin = admin;
      request.authMethod = "bearer";
      return;
    }
  }

  const apiKey = getApiKey(request);
  if (apiKey) {
    const admin = await request.server.auth.verifyApiKey(apiKey);
    if (admin) {
      request.admin = admin;
      request.authMethod = "api-key";
      return;
    }
  }

  return unauthorized(
    reply,
    request,
    "Authentication required. Send Bearer JWT or x-api-key header.",
  );
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const token = getBearerToken(request);
  if (!token) {
    return unauthorized(reply, request, "Authentication required");
  }

  const admin = await request.server.auth.verifyBearerToken(token);
  if (!admin) {
    return unauthorized(reply, request, "Invalid or expired access token");
  }

  request.admin = admin;
  request.authMethod = "bearer";
}

export function setRefreshCookie(reply: FastifyReply, value: string, maxAgeSeconds: number) {
  const env = reply.server.env;
  reply.setCookie(env.REFRESH_COOKIE_NAME, value, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    path: "/api/admin",
    domain: env.COOKIE_DOMAIN || undefined,
    maxAge: maxAgeSeconds,
    signed: false,
  });
}

export function clearRefreshCookie(reply: FastifyReply) {
  const env = reply.server.env;
  reply.clearCookie(env.REFRESH_COOKIE_NAME, {
    path: "/api/admin",
    domain: env.COOKIE_DOMAIN || undefined,
  });
}
