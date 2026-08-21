import { apiDelete, apiGet, apiPost, refreshAccessToken } from "@/lib/api-client";

export type ApiKeyItem = {
  id: number;
  name: string;
  prefix: string;
  adminId: number;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export type ApiKeyCreated = {
  id: number;
  name: string;
  prefix: string;
  token: string;
  createdAt: string;
};

export type RefreshSession = {
  accessToken: string;
  expiresIn: number;
  tokenType: string;
};

export { refreshAccessToken };

export async function fetchApiKeys() {
  return apiGet<{ items: ApiKeyItem[] }>("/api/admin/api-keys");
}

export async function createApiKey(name: string) {
  return apiPost<ApiKeyCreated>("/api/admin/api-keys", { name });
}

export async function revokeApiKey(id: number) {
  return apiDelete<{ id: number }>(`/api/admin/api-keys/${id}`);
}
