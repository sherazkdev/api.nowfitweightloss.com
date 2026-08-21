import type { FastifyRequest } from "fastify";
import type { AppEnv } from "@weightloss/config";
import { clientIp } from "@weightloss/cache";

export function resolveRequestIp(request: FastifyRequest, env: AppEnv): string {
  if (env.TRUST_PROXY) {
    const forwarded = clientIp(request.headers);
    if (forwarded !== "unknown") return forwarded;
  }

  return request.ip || "unknown";
}
