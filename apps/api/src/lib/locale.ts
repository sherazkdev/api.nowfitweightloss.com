import { isLocale, parseLocale, type Locale } from "@weightloss/contracts";
import type { FastifyRequest } from "fastify";

export function resolveRequestLocale(request: FastifyRequest): Locale | null {
  const query = request.query as { lang?: unknown };
  if (typeof query.lang !== "string" || !query.lang.trim()) {
    return null;
  }
  const normalized = query.lang.trim().toLowerCase().split(/[-_]/)[0] ?? "";
  if (!isLocale(normalized)) {
    return null;
  }
  return parseLocale(normalized);
}
