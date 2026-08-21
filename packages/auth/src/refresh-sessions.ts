import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Redis } from "ioredis";
import type { AppEnv } from "@weightloss/config";
import { parseDurationMs } from "@weightloss/cache";
import type { RefreshSessionRecord } from "./types.js";

function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function sessionKey(sessionId: string): string {
  return `refresh:session:${sessionId}`;
}

function adminSessionsKey(adminId: number): string {
  return `refresh:admin:${adminId}`;
}

export class RefreshSessionStore {
  private readonly ttlSeconds: number;

  constructor(
    private readonly redis: Redis,
    env: AppEnv,
  ) {
    this.ttlSeconds = Math.floor(parseDurationMs(env.JWT_REFRESH_EXPIRES_IN) / 1000);
  }

  refreshTtlSeconds(): number {
    return this.ttlSeconds;
  }

  async create(adminId: number, tokenVersion: number): Promise<{ sessionId: string; refreshToken: string }> {
    const sessionId = randomUUID();
    const refreshToken = randomBytes(32).toString("base64url");
    const record: RefreshSessionRecord = {
      adminId,
      tokenVersion,
      refreshTokenHash: hashRefreshToken(refreshToken),
      createdAt: new Date().toISOString(),
    };

    await this.redis
      .multi()
      .setex(sessionKey(sessionId), this.ttlSeconds, JSON.stringify(record))
      .sadd(adminSessionsKey(adminId), sessionId)
      .expire(adminSessionsKey(adminId), this.ttlSeconds)
      .exec();

    return { sessionId, refreshToken };
  }

  async validate(sessionId: string, refreshToken: string): Promise<RefreshSessionRecord | null> {
    const raw = await this.redis.get(sessionKey(sessionId));
    if (!raw) return null;

    let record: RefreshSessionRecord;
    try {
      record = JSON.parse(raw) as RefreshSessionRecord;
    } catch {
      return null;
    }

    if (record.refreshTokenHash !== hashRefreshToken(refreshToken)) {
      return null;
    }

    return record;
  }

  async rotate(
    sessionId: string,
    refreshToken: string,
  ): Promise<{ sessionId: string; refreshToken: string; adminId: number; tokenVersion: number } | null> {
    const record = await this.validate(sessionId, refreshToken);
    if (!record) return null;

    await this.revoke(sessionId, record.adminId);
    const next = await this.create(record.adminId, record.tokenVersion);
    return { ...next, adminId: record.adminId, tokenVersion: record.tokenVersion };
  }

  async revoke(sessionId: string, adminId?: number): Promise<void> {
    const resolvedAdminId =
      adminId ?? (await this.readAdminId(sessionId));

    await this.redis.del(sessionKey(sessionId));
    if (resolvedAdminId !== null) {
      await this.redis.srem(adminSessionsKey(resolvedAdminId), sessionId);
    }
  }

  async revokeAllForAdmin(adminId: number): Promise<void> {
    const sessionIds = await this.redis.smembers(adminSessionsKey(adminId));
    if (sessionIds.length === 0) {
      await this.redis.del(adminSessionsKey(adminId));
      return;
    }

    const pipeline = this.redis.multi();
    for (const sessionId of sessionIds) {
      pipeline.del(sessionKey(sessionId));
    }
    pipeline.del(adminSessionsKey(adminId));
    await pipeline.exec();
  }

  private async readAdminId(sessionId: string): Promise<number | null> {
    const raw = await this.redis.get(sessionKey(sessionId));
    if (!raw) return null;

    try {
      const record = JSON.parse(raw) as RefreshSessionRecord;
      return record.adminId;
    } catch {
      return null;
    }
  }
}

export function encodeRefreshCookieValue(sessionId: string, refreshToken: string): string {
  return `${sessionId}.${refreshToken}`;
}

export function decodeRefreshCookieValue(
  value: string | undefined,
): { sessionId: string; refreshToken: string } | null {
  if (!value) return null;

  const separator = value.indexOf(".");
  if (separator <= 0 || separator >= value.length - 1) return null;

  const sessionId = value.slice(0, separator);
  const refreshToken = value.slice(separator + 1);

  if (!sessionId || !refreshToken) return null;
  return { sessionId, refreshToken };
}
