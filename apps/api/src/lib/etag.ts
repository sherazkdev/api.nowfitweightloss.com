import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { CacheResource } from "@weightloss/cache";

function stableHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

export function buildWeakEtag(
  resource: CacheResource | "meta",
  version: number,
  parts: string[],
  body: unknown,
): string {
  const scope = [resource, `v${version}`, ...parts, stableHash(body)].join(":");
  return `W/"${scope}"`;
}

export function matchesIfNoneMatch(header: string | string[] | undefined, etag: string): boolean {
  if (!header) return false;
  const values = Array.isArray(header) ? header : header.split(",");
  const normalized = etag.replace(/^W\//, "");
  return values.some((item) => {
    const candidate = item.trim().replace(/^W\//, "");
    return candidate === normalized || candidate === etag || item.trim() === etag;
  });
}

export async function sendPublicResponse(
  app: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
  resource: CacheResource | "meta",
  parts: string[],
  body: unknown,
) {
  const version =
    resource === "meta" ? 1 : await app.cache.getVersion(resource as CacheResource);
  const etag = buildWeakEtag(resource, version, parts, body);
  const maxAge = resource === "meta" ? 300 : app.cache.listTtl();

  reply.header("ETag", etag);
  reply.header("Cache-Control", `public, max-age=${maxAge}`);

  if (matchesIfNoneMatch(request.headers["if-none-match"], etag)) {
    return reply.status(304).send();
  }

  return reply.send(body);
}
