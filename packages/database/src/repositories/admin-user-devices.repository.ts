import type { UserDeviceDocument } from "@weightloss/contracts";
import type { Db } from "mongodb";
import { COLLECTIONS } from "../collections.js";

const ACTIVE_MS = 7 * 24 * 60 * 60 * 1000;

export type DeviceStatus = "active" | "stale";

export type AdminDeviceFilters = {
  platform?: "android" | "ios";
  status?: DeviceStatus;
  search?: string;
  page?: number;
  limit?: number;
  cursor?: number;
  totalHint?: number;
};

export type AdminDeviceRow = {
  id: number;
  firebaseUid: string;
  platform: "android" | "ios";
  fcmToken: string;
  fcmTokenMasked: string;
  status: DeviceStatus;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminDeviceStats = {
  total: number;
  active: number;
  stale: number;
  activePercent: number;
  android: number;
  ios: number;
  androidPercent: number;
  iosPercent: number;
};

export type AdminDeviceAnalytics = {
  healthSplit: Array<{ label: string; value: number; color: string }>;
  platformSplit: { android: number; ios: number; androidPercent: number; iosPercent: number };
  activity: {
    registeredToday: number;
    refreshedToday: number;
  };
};

export type AdminDeviceListResult = {
  stats: AdminDeviceStats;
  analytics: AdminDeviceAnalytics;
  items: AdminDeviceRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    nextCursor: number | null;
  };
};

export type AdminDeviceSummary = {
  stats: AdminDeviceStats;
  analytics: AdminDeviceAnalytics;
  computedAt: string;
};

type DeviceFacetRow = {
  totals?: Array<{ count: number }>;
  activeCount?: Array<{ count: number }>;
  androidCount?: Array<{ count: number }>;
  iosCount?: Array<{ count: number }>;
  registeredToday?: Array<{ count: number }>;
  refreshedToday?: Array<{ count: number }>;
};

function collection(db: Db) {
  return db.collection<UserDeviceDocument>(COLLECTIONS.userDevices);
}

function deriveStatus(lastSeenAt: Date): DeviceStatus {
  return Date.now() - lastSeenAt.getTime() <= ACTIVE_MS ? "active" : "stale";
}

function maskToken(token: string): string {
  if (token.length <= 16) return token;
  return `${token.slice(0, 8)}…${token.slice(-6)}`;
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function countFromFacet(rows?: Array<{ count: number }>): number {
  return rows?.[0]?.count ?? 0;
}

function serializeRow(doc: UserDeviceDocument): AdminDeviceRow {
  return {
    id: doc.id,
    firebaseUid: doc.firebaseUid,
    platform: doc.platform,
    fcmToken: doc.fcmToken,
    fcmTokenMasked: maskToken(doc.fcmToken),
    status: deriveStatus(doc.lastSeenAt),
    lastSeenAt: doc.lastSeenAt.toISOString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function buildQuery(filters: AdminDeviceFilters): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  if (filters.platform) query.platform = filters.platform;

  if (filters.cursor && Number.isInteger(filters.cursor) && filters.cursor > 0) {
    query.id = { $lt: filters.cursor };
  }

  const search = filters.search?.trim();
  if (search) {
    const id = Number(search.replace(/^#/, ""));
    if (Number.isInteger(id) && id > 0) {
      query.id = id;
    } else {
      query.$or = [
        { firebaseUid: { $regex: search, $options: "i" } },
        { fcmToken: { $regex: search, $options: "i" } },
      ];
    }
  }

  if (filters.status === "active") {
    query.lastSeenAt = { $gte: new Date(Date.now() - ACTIVE_MS) };
  }
  if (filters.status === "stale") {
    query.lastSeenAt = { $lt: new Date(Date.now() - ACTIVE_MS) };
  }

  return query;
}

function hasListFilters(filters: AdminDeviceFilters): boolean {
  return Boolean(filters.platform || filters.status || filters.search?.trim() || filters.cursor);
}

async function resolveFilteredTotal(
  db: Db,
  query: Record<string, unknown>,
  filters: AdminDeviceFilters,
): Promise<number> {
  if (hasListFilters(filters)) {
    return collection(db).countDocuments(query);
  }
  if (filters.totalHint != null && filters.totalHint >= 0) {
    return filters.totalHint;
  }
  return collection(db).estimatedDocumentCount();
}

async function loadAdminDeviceMeta(db: Db): Promise<{
  stats: AdminDeviceStats;
  analytics: AdminDeviceAnalytics;
}> {
  const activeCutoff = new Date(Date.now() - ACTIVE_MS);
  const todayStart = startOfToday();

  const facetRows = await collection(db)
    .aggregate<DeviceFacetRow>([
      {
        $facet: {
          totals: [{ $count: "count" }],
          activeCount: [{ $match: { lastSeenAt: { $gte: activeCutoff } } }, { $count: "count" }],
          androidCount: [{ $match: { platform: "android" } }, { $count: "count" }],
          iosCount: [{ $match: { platform: "ios" } }, { $count: "count" }],
          registeredToday: [{ $match: { createdAt: { $gte: todayStart } } }, { $count: "count" }],
          refreshedToday: [
            {
              $match: {
                updatedAt: { $gte: todayStart },
                createdAt: { $lt: todayStart },
              },
            },
            { $count: "count" },
          ],
        },
      },
    ])
    .toArray();

  const facet = facetRows[0] ?? {};
  const total = countFromFacet(facet.totals);
  const active = countFromFacet(facet.activeCount);
  const stale = total - active;
  const android = countFromFacet(facet.androidCount);
  const ios = countFromFacet(facet.iosCount);
  const platformTotal = android + ios;

  return {
    stats: {
      total,
      active,
      stale,
      activePercent: total ? Math.round((active / total) * 1000) / 10 : 0,
      android,
      ios,
      androidPercent: platformTotal ? Math.round((android / platformTotal) * 100) : 0,
      iosPercent: platformTotal ? Math.round((ios / platformTotal) * 100) : 0,
    },
    analytics: {
      healthSplit: [
        { label: "Active", value: active, color: "var(--bright-green, #22c55e)" },
        { label: "Stale", value: stale, color: "var(--black-20)" },
      ],
      platformSplit: {
        android,
        ios,
        androidPercent: platformTotal ? Math.round((android / platformTotal) * 100) : 0,
        iosPercent: platformTotal ? Math.round((ios / platformTotal) * 100) : 0,
      },
      activity: {
        registeredToday: countFromFacet(facet.registeredToday),
        refreshedToday: countFromFacet(facet.refreshedToday),
      },
    },
  };
}

export async function getAdminDeviceSummary(db: Db): Promise<AdminDeviceSummary> {
  const meta = await loadAdminDeviceMeta(db);
  return {
    ...meta,
    computedAt: new Date().toISOString(),
  };
}

export async function listAdminUserDeviceItems(
  db: Db,
  filters: AdminDeviceFilters,
): Promise<Pick<AdminDeviceListResult, "items" | "pagination">> {
  const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
  const useCursor = Boolean(filters.cursor);
  const page = Math.max(1, filters.page ?? 1);
  const query = buildQuery(filters);

  const [filteredTotal, pageDocs] = await Promise.all([
    resolveFilteredTotal(db, query, filters),
    (useCursor
      ? collection(db).find(query).sort({ lastSeenAt: -1, id: -1 }).limit(limit)
      : collection(db)
          .find(query)
          .sort({ lastSeenAt: -1, id: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
    ).toArray(),
  ]);

  const nextCursor =
    pageDocs.length === limit ? (pageDocs[pageDocs.length - 1]?.id ?? null) : null;

  return {
    items: pageDocs.map(serializeRow),
    pagination: {
      page,
      limit,
      total: filteredTotal,
      totalPages: Math.max(1, Math.ceil(filteredTotal / limit)),
      nextCursor,
    },
  };
}

export async function listAdminUserDevices(
  db: Db,
  filters: AdminDeviceFilters,
): Promise<AdminDeviceListResult> {
  const [meta, itemsResult] = await Promise.all([
    loadAdminDeviceMeta(db),
    listAdminUserDeviceItems(db, filters),
  ]);

  return {
    stats: meta.stats,
    analytics: meta.analytics,
    items: itemsResult.items,
    pagination: itemsResult.pagination,
  };
}

export async function deleteAdminUserDevice(db: Db, id: number): Promise<boolean> {
  const result = await collection(db).deleteOne({ id });
  return result.deletedCount === 1;
}

export function adminDeviceCacheKey(filters: AdminDeviceFilters): string[] {
  return [
    "list",
    filters.platform ?? "all",
    filters.status ?? "all",
    filters.search?.trim() ?? "",
    filters.cursor ? "cursor" : String(filters.page ?? 1),
    filters.cursor ? String(filters.cursor) : "",
    String(filters.limit ?? 25),
  ];
}

export function adminDeviceSummaryCacheKey(): string[] {
  return ["summary"];
}

export const USER_DEVICES_SUMMARY_SNAPSHOT = "userDevices:summary";

export { maskToken as maskFcmToken };
