import type { Redis } from "ioredis";
import type { Db } from "mongodb";
import type { AppEnv } from "@weightloss/config";
import type { AdminDocument } from "@weightloss/contracts";
import { normalizeEmail } from "@weightloss/shared";
import { findAdminByEmailNormalized, findAdminById, findApiKeyByHash, touchApiKeyLastUsed, verifyApiKeyPlainText } from "@weightloss/database";
import { signAccessToken, verifyAccessToken } from "./jwt.js";
import { hashPassword, verifyPassword } from "./password.js";
import {
  RefreshSessionStore,
  decodeRefreshCookieValue,
  encodeRefreshCookieValue,
} from "./refresh-sessions.js";
import type { AdminAuthProfile, LoginSuccess, RefreshRotationResult } from "./types.js";

function toAuthProfile(admin: AdminDocument): AdminAuthProfile {
  return {
    id: admin.id,
    name: admin.name,
    email: admin.email,
  };
}

export class AuthService {
  readonly refreshSessions: RefreshSessionStore;

  constructor(
    private readonly env: AppEnv,
    private readonly db: Db,
    authRedis: Redis,
  ) {
    this.refreshSessions = new RefreshSessionStore(authRedis, env);
  }

  refreshCookieName(): string {
    return this.env.REFRESH_COOKIE_NAME;
  }

  refreshTtlSeconds(): number {
    return this.refreshSessions.refreshTtlSeconds();
  }

  encodeRefreshCookie(sessionId: string, refreshToken: string): string {
    return encodeRefreshCookieValue(sessionId, refreshToken);
  }

  decodeRefreshCookie(value: string | undefined) {
    return decodeRefreshCookieValue(value);
  }

  async login(email: string, password: string): Promise<LoginSuccess | null> {
    const admin = await findAdminByEmailNormalized(this.db, normalizeEmail(email));
    if (!admin || !admin.isActive) return null;

    const valid = await verifyPassword(admin.passwordHash, password);
    if (!valid) return null;

    const access = await signAccessToken(this.env, admin.id, admin.tokenVersion);
    const refresh = await this.refreshSessions.create(admin.id, admin.tokenVersion);

    return {
      accessToken: access.token,
      expiresIn: access.expiresIn,
      tokenType: "Bearer",
      admin: toAuthProfile(admin),
      sessionId: refresh.sessionId,
      refreshToken: refresh.refreshToken,
    };
  }

  async refresh(refreshCookieValue: string | undefined): Promise<
    (RefreshRotationResult & { admin: AdminAuthProfile }) | null
  > {
    const decoded = decodeRefreshCookieValue(refreshCookieValue);
    if (!decoded) return null;

    const rotated = await this.refreshSessions.rotate(decoded.sessionId, decoded.refreshToken);
    if (!rotated) return null;

    const admin = await findAdminById(this.db, rotated.adminId);
    if (!admin || !admin.isActive) {
      await this.refreshSessions.revoke(rotated.sessionId, rotated.adminId);
      return null;
    }

    if (admin.tokenVersion !== rotated.tokenVersion) {
      await this.refreshSessions.revokeAllForAdmin(admin.id);
      return null;
    }

    const access = await signAccessToken(this.env, admin.id, admin.tokenVersion);

    return {
      accessToken: access.token,
      expiresIn: access.expiresIn,
      tokenType: "Bearer",
      sessionId: rotated.sessionId,
      refreshToken: rotated.refreshToken,
      admin: toAuthProfile(admin),
    };
  }

  async logout(refreshCookieValue: string | undefined): Promise<void> {
    const decoded = decodeRefreshCookieValue(refreshCookieValue);
    if (!decoded) return;
    await this.refreshSessions.revoke(decoded.sessionId);
  }

  async verifyBearerToken(token: string): Promise<AdminDocument | null> {
    const verified = await verifyAccessToken(this.env, token);
    if (!verified) return null;

    const admin = await findAdminById(this.db, verified.adminId);
    if (!admin || !admin.isActive) return null;
    if (admin.tokenVersion !== verified.tokenVersion) return null;

    return admin;
  }

  async verifyApiKey(plainKey: string): Promise<AdminDocument | null> {
    const trimmed = plainKey.trim();
    if (!trimmed) return null;

    const keyHash = verifyApiKeyPlainText(trimmed);
    const apiKey = await findApiKeyByHash(this.db, keyHash);
    if (!apiKey) return null;

    const admin = await findAdminById(this.db, apiKey.adminId);
    if (!admin || !admin.isActive) return null;

    void touchApiKeyLastUsed(this.db, apiKey.id);
    return admin;
  }

  async changePassword(
    admin: AdminDocument,
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
  ): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
    if (newPassword.length < 8) {
      return { ok: false, code: "VALIDATION_ERROR", message: "New password must be at least 8 characters" };
    }

    if (newPassword !== confirmPassword) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "New password and confirmation do not match",
      };
    }

    if (newPassword === currentPassword) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "New password must differ from the current password",
      };
    }

    const valid = await verifyPassword(admin.passwordHash, currentPassword);
    if (!valid) {
      return { ok: false, code: "INVALID_CREDENTIALS", message: "Current password is incorrect" };
    }

    const passwordHash = await hashPassword(newPassword);
    const nextVersion = admin.tokenVersion + 1;

    await this.db.collection<AdminDocument>("admins").updateOne(
      { id: admin.id },
      {
        $set: {
          passwordHash,
          tokenVersion: nextVersion,
          updatedAt: new Date(),
        },
      },
    );

    await this.refreshSessions.revokeAllForAdmin(admin.id);
    return { ok: true };
  }
}

export function createAuthService(env: AppEnv, db: Db, authRedis: Redis): AuthService {
  return new AuthService(env, db, authRedis);
}
