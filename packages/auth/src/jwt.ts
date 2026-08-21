import { randomUUID } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import type { AppEnv } from "@weightloss/config";
import { parseDurationMs } from "@weightloss/cache";
import type { VerifiedAccessToken } from "./types.js";

function accessSecret(env: AppEnv): Uint8Array {
  return new TextEncoder().encode(env.JWT_ACCESS_SECRET);
}

export function accessTokenTtlSeconds(env: AppEnv): number {
  return Math.floor(parseDurationMs(env.JWT_ACCESS_EXPIRES_IN) / 1000);
}

export async function signAccessToken(
  env: AppEnv,
  adminId: number,
  tokenVersion: number,
): Promise<{ token: string; expiresIn: number; jti: string }> {
  const jti = randomUUID();
  const expiresIn = accessTokenTtlSeconds(env);

  const token = await new SignJWT({
    type: "access",
    ver: tokenVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(adminId))
    .setIssuer(env.JWT_ISSUER)
    .setAudience(env.JWT_AUDIENCE)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(env.JWT_ACCESS_EXPIRES_IN)
    .sign(accessSecret(env));

  return { token, expiresIn, jti };
}

export async function verifyAccessToken(
  env: AppEnv,
  token: string,
): Promise<VerifiedAccessToken | null> {
  try {
    const { payload } = await jwtVerify(token, accessSecret(env), {
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    });

    if (payload.type !== "access") return null;

    const adminId = Number(payload.sub);
    const tokenVersion = Number(payload.ver);
    const jti = payload.jti;

    if (!Number.isInteger(adminId) || adminId < 1) return null;
    if (!Number.isInteger(tokenVersion) || tokenVersion < 0) return null;
    if (typeof jti !== "string" || jti.length === 0) return null;

    return { adminId, tokenVersion, jti };
  } catch {
    return null;
  }
}
