import type {
  NotificationDeliveryDocument,
  NotificationDeliveryStatus,
  UserDeviceDocument,
} from "@weightloss/contracts";
import { formatReminderSchedule } from "@weightloss/shared";
import type { Db } from "mongodb";
import { COLLECTIONS } from "../collections.js";

export type DeliveryLogStatusFilter = "delivered" | "failed" | "partial" | "skipped";

export type AdminDeliveryLogFilters = {
  status?: DeliveryLogStatusFilter;
  platform?: "android" | "ios";
  search?: string;
  days?: number;
  page?: number;
  limit?: number;
  cursor?: number;
};

export type AdminDeliveryLogRow = {
  id: number;
  createdAt: string;
  firebaseUid: string;
  reminderId: number;
  notification: string;
  schedule: string;
  gender: "male" | "female";
  platform: "android" | "ios" | "unknown" | "mixed";
  platformLabel: string;
  tokenCount: number;
  successCount: number;
  failureCount: number;
  status: NotificationDeliveryStatus;
  errorMessage: string | null;
  slotKey: string;
};

export type AdminDeliveryLogStats = {
  totalAttempts: number;
  delivered: number;
  failed: number;
  skipped: number;
  partial: number;
  successRatePercent: number;
  failureRatePercent: number;
  tokensDelivered: number;
  tokensFailed: number;
};

export type AdminDeliveryLogAnalytics = {
  deliveryRate: Array<{ label: string; value: number; color: string }>;
  failureReasons: Array<{ reason: string; count: number }>;
  queue: {
    skippedRecent: number;
    schedulerEnabled: boolean;
    mode: "cron";
  };
};

export type AdminDeliveryLogSummary = {
  stats: AdminDeliveryLogStats;
  analytics: AdminDeliveryLogAnalytics;
  computedAt: string;
};

export type AdminDeliveryLogListResult = {
  items: AdminDeliveryLogRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    nextCursor: number | null;
  };
};

function deliveryCollection(db: Db) {
  return db.collection<NotificationDeliveryDocument>(COLLECTIONS.notificationDeliveries);
}

function deviceCollection(db: Db) {
  return db.collection<UserDeviceDocument>(COLLECTIONS.userDevices);
}

function startOfDaysAgo(days: number): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (days - 1));
  return date;
}

function notificationLabel(doc: Pick<NotificationDeliveryDocument, "gender" | "hour" | "minute">): string {
  return `Workout reminder • ${doc.gender} • ${formatReminderSchedule(doc.hour, doc.minute)}`;
}

function categorizeFailure(errorMessage: string | null): string {
  if (!errorMessage) return "Unknown error";
  const message = errorMessage.toLowerCase();
  if (message.includes("no registered") || message.includes("invalid") || message.includes("registration")) {
    return "Invalid token";
  }
  if (message.includes("permission")) return "Permission denied";
  if (message.includes("timeout")) return "Timeout";
  return "Unknown error";
}

async function resolvePlatformMap(
  db: Db,
  uids: string[],
): Promise<Map<string, { platform: AdminDeliveryLogRow["platform"]; label: string }>> {
  if (uids.length === 0) return new Map();

  const devices = await deviceCollection(db)
    .find({ firebaseUid: { $in: uids } })
    .sort({ lastSeenAt: -1 })
    .toArray();

  const grouped = new Map<string, UserDeviceDocument[]>();
  for (const device of devices) {
    const list = grouped.get(device.firebaseUid) ?? [];
    list.push(device);
    grouped.set(device.firebaseUid, list);
  }

  const result = new Map<string, { platform: AdminDeliveryLogRow["platform"]; label: string }>();
  for (const uid of uids) {
    const userDevices = grouped.get(uid) ?? [];
    if (userDevices.length === 0) {
      result.set(uid, { platform: "unknown", label: "Unknown" });
      continue;
    }

    const platforms = new Set(userDevices.map((device) => device.platform));
    if (platforms.size > 1) {
      result.set(uid, { platform: "mixed", label: "Mixed platforms" });
      continue;
    }

    const platform = userDevices[0]!.platform;
    result.set(uid, {
      platform,
      label: platform === "android" ? "Android" : "iOS",
    });
  }

  return result;
}

async function buildBaseQuery(db: Db, filters: AdminDeliveryLogFilters): Promise<Record<string, unknown>> {
  const query: Record<string, unknown> = {};
  const days = Math.min(90, Math.max(1, filters.days ?? 30));
  query.createdAt = { $gte: startOfDaysAgo(days) };

  if (filters.status) query.status = filters.status;

  if (filters.platform) {
    const uids = await deviceCollection(db).distinct("firebaseUid", { platform: filters.platform });
    query.firebaseUid = { $in: uids };
  }

  if (filters.cursor && Number.isInteger(filters.cursor) && filters.cursor > 0) {
    query.id = { $lt: filters.cursor };
  }

  const search = filters.search?.trim();
  if (search) {
    const id = Number(search.replace(/^#/, ""));
    if (Number.isInteger(id) && id > 0) {
      query.$or = [{ id }, { reminderId: id }];
    } else if (query.firebaseUid && typeof query.firebaseUid === "object" && "$in" in query.firebaseUid) {
      query.$and = [
        { firebaseUid: query.firebaseUid },
        { firebaseUid: { $regex: search, $options: "i" } },
      ];
      delete query.firebaseUid;
    } else {
      query.firebaseUid = { $regex: search, $options: "i" };
    }
  }

  return query;
}

function serializeRow(
  doc: NotificationDeliveryDocument,
  platformInfo: { platform: AdminDeliveryLogRow["platform"]; label: string },
): AdminDeliveryLogRow {
  return {
    id: doc.id,
    createdAt: doc.createdAt.toISOString(),
    firebaseUid: doc.firebaseUid,
    reminderId: doc.reminderId,
    notification: notificationLabel(doc),
    schedule: formatReminderSchedule(doc.hour, doc.minute),
    gender: doc.gender,
    platform: platformInfo.platform,
    platformLabel: platformInfo.label,
    tokenCount: doc.tokenCount,
    successCount: doc.successCount,
    failureCount: doc.failureCount,
    status: doc.status,
    errorMessage: doc.errorMessage,
    slotKey: doc.slotKey,
  };
}

export async function getAdminDeliveryLogSummary(
  db: Db,
  options: { days?: number; schedulerEnabled: boolean },
): Promise<AdminDeliveryLogSummary> {
  const days = Math.min(90, Math.max(1, options.days ?? 30));
  const since = startOfDaysAgo(days);
  const recentSkippedSince = startOfDaysAgo(1);

  const [statusFacet, failureRows, skippedRecent] = await Promise.all([
    deliveryCollection(db)
      .aggregate<{
        totals?: Array<{ count: number }>;
        delivered?: Array<{ count: number }>;
        failed?: Array<{ count: number }>;
        skipped?: Array<{ count: number }>;
        partial?: Array<{ count: number }>;
        tokensDelivered?: Array<{ total: number }>;
        tokensFailed?: Array<{ total: number }>;
      }>([
        { $match: { createdAt: { $gte: since } } },
        {
          $facet: {
            totals: [{ $count: "count" }],
            delivered: [{ $match: { status: "delivered" } }, { $count: "count" }],
            failed: [{ $match: { status: "failed" } }, { $count: "count" }],
            skipped: [{ $match: { status: "skipped" } }, { $count: "count" }],
            partial: [{ $match: { status: "partial" } }, { $count: "count" }],
            tokensDelivered: [{ $group: { _id: null, total: { $sum: "$successCount" } } }],
            tokensFailed: [{ $group: { _id: null, total: { $sum: "$failureCount" } } }],
          },
        },
      ])
      .toArray(),
    deliveryCollection(db)
      .aggregate<{ _id: string | null; count: number }>([
        {
          $match: {
            createdAt: { $gte: since },
            status: { $in: ["failed", "skipped"] },
          },
        },
        { $group: { _id: "$errorMessage", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 6 },
      ])
      .toArray(),
    deliveryCollection(db).countDocuments({
      status: "skipped",
      createdAt: { $gte: recentSkippedSince },
    }),
  ]);

  const facet = statusFacet[0] ?? {};
  const totalAttempts = facet.totals?.[0]?.count ?? 0;
  const delivered = facet.delivered?.[0]?.count ?? 0;
  const failed = facet.failed?.[0]?.count ?? 0;
  const skipped = facet.skipped?.[0]?.count ?? 0;
  const partial = facet.partial?.[0]?.count ?? 0;
  const tokensDelivered = facet.tokensDelivered?.[0]?.total ?? 0;
  const tokensFailed = facet.tokensFailed?.[0]?.total ?? 0;
  const successCount = delivered + partial;
  const successRatePercent = totalAttempts
    ? Math.round((successCount / totalAttempts) * 1000) / 10
    : 100;
  const failureRatePercent = totalAttempts
    ? Math.round(((failed + skipped) / totalAttempts) * 1000) / 10
    : 0;

  const failureReasons = failureRows.map((row) => ({
    reason: categorizeFailure(row._id),
    count: row.count,
  }));

  const mergedReasons = new Map<string, number>();
  for (const item of failureReasons) {
    mergedReasons.set(item.reason, (mergedReasons.get(item.reason) ?? 0) + item.count);
  }

  return {
    stats: {
      totalAttempts,
      delivered: successCount,
      failed,
      skipped,
      partial,
      successRatePercent,
      failureRatePercent,
      tokensDelivered,
      tokensFailed,
    },
    analytics: {
      deliveryRate: [
        { label: "Delivered", value: successCount, color: "var(--bright-purple)" },
        { label: "Failed", value: failed, color: "var(--bright-red)" },
        { label: "Skipped", value: skipped, color: "var(--black-20)" },
      ].filter((item) => item.value > 0),
      failureReasons: [...mergedReasons.entries()]
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      queue: {
        skippedRecent,
        schedulerEnabled: options.schedulerEnabled,
        mode: "cron",
      },
    },
    computedAt: new Date().toISOString(),
  };
}

export async function listAdminDeliveryLogs(
  db: Db,
  filters: AdminDeliveryLogFilters,
): Promise<AdminDeliveryLogListResult> {
  const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
  const useCursor = Boolean(filters.cursor);
  const page = Math.max(1, filters.page ?? 1);
  const query = await buildBaseQuery(db, filters);

  const [filteredTotal, pageDocs] = await Promise.all([
    deliveryCollection(db).countDocuments(query),
    (useCursor
      ? deliveryCollection(db).find(query).sort({ createdAt: -1, id: -1 }).limit(limit)
      : deliveryCollection(db)
          .find(query)
          .sort({ createdAt: -1, id: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
    ).toArray(),
  ]);

  const platformMap = await resolvePlatformMap(
    db,
    [...new Set(pageDocs.map((doc) => doc.firebaseUid))],
  );

  const nextCursor =
    pageDocs.length === limit ? (pageDocs[pageDocs.length - 1]?.id ?? null) : null;

  return {
    items: pageDocs.map((doc) =>
      serializeRow(doc, platformMap.get(doc.firebaseUid) ?? { platform: "unknown", label: "Unknown" }),
    ),
    pagination: {
      page,
      limit,
      total: filteredTotal,
      totalPages: Math.max(1, Math.ceil(filteredTotal / limit)),
      nextCursor,
    },
  };
}

export function adminDeliveryLogCacheKey(filters: AdminDeliveryLogFilters): string[] {
  return [
    "list",
    filters.status ?? "all",
    filters.platform ?? "all",
    filters.search?.trim() ?? "",
    String(filters.days ?? 30),
    filters.cursor ? "cursor" : String(filters.page ?? 1),
    filters.cursor ? String(filters.cursor) : "",
    String(filters.limit ?? 25),
  ];
}

export function adminDeliveryLogSummaryCacheKey(days: number): string[] {
  return ["summary", String(days)];
}
