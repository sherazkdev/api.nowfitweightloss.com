import { createHash, randomBytes } from "node:crypto";
import type { ApiKeyDocument } from "@weightloss/contracts";
import type { Db } from "mongodb";
import { COLLECTIONS } from "../collections.js";
import { nextSequenceId } from "../counters.js";

export type ApiKeyCreateResult = {
  apiKey: ApiKeyDocument;
  plainKey: string;
};

export type ApiKeyListItem = {
  id: number;
  name: string;
  prefix: string;
  adminId: number;
  isActive: boolean;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
};

function hashApiKey(plainKey: string): string {
  return createHash("sha256").update(plainKey).digest("hex");
}

function generatePlainApiKey(): string {
  return `wl_${randomBytes(32).toString("hex")}`;
}

export async function createApiKey(
  db: Db,
  input: { name: string; adminId: number },
): Promise<ApiKeyCreateResult> {
  const plainKey = generatePlainApiKey();
  const now = new Date();
  const id = await nextSequenceId(db, "apiKeys");
  const apiKey: ApiKeyDocument = {
    id,
    name: input.name.trim(),
    keyHash: hashApiKey(plainKey),
    prefix: plainKey.slice(0, 12),
    adminId: input.adminId,
    isActive: true,
    createdAt: now,
    lastUsedAt: null,
    revokedAt: null,
  };

  await db.collection<ApiKeyDocument>(COLLECTIONS.apiKeys).insertOne(apiKey);
  return { apiKey, plainKey };
}

export async function findApiKeyByHash(db: Db, keyHash: string): Promise<ApiKeyDocument | null> {
  return db.collection<ApiKeyDocument>(COLLECTIONS.apiKeys).findOne({ keyHash, isActive: true });
}

export async function listApiKeys(db: Db, adminId?: number): Promise<ApiKeyListItem[]> {
  const query = adminId ? { adminId } : {};
  const items = await db
    .collection<ApiKeyDocument>(COLLECTIONS.apiKeys)
    .find(query)
    .sort({ createdAt: -1, id: -1 })
    .toArray();

  return items.map((item) => ({
    id: item.id,
    name: item.name,
    prefix: item.prefix,
    adminId: item.adminId,
    isActive: item.isActive,
    createdAt: item.createdAt,
    lastUsedAt: item.lastUsedAt,
    revokedAt: item.revokedAt,
  }));
}

export async function revokeApiKey(db: Db, id: number, adminId: number): Promise<boolean> {
  const now = new Date();
  const result = await db.collection<ApiKeyDocument>(COLLECTIONS.apiKeys).updateOne(
    { id, adminId, isActive: true },
    {
      $set: {
        isActive: false,
        revokedAt: now,
      },
    },
  );
  return result.matchedCount === 1;
}

export async function touchApiKeyLastUsed(db: Db, id: number): Promise<void> {
  await db
    .collection<ApiKeyDocument>(COLLECTIONS.apiKeys)
    .updateOne({ id }, { $set: { lastUsedAt: new Date() } });
}

export function verifyApiKeyPlainText(plainKey: string): string {
  return hashApiKey(plainKey);
}
