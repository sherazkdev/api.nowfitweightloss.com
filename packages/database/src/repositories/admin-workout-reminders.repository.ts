import type { ReminderGender, WorkoutReminderDocument } from "@weightloss/contracts";
import {
  computeNextReminderRun,
  formatNextRunLabel,
  formatReminderSchedule,
  getZonedDateParts,
  isReminderDueWithinHours,
} from "@weightloss/shared";
import type { Db } from "mongodb";
import { COLLECTIONS } from "../collections.js";
import {
  deleteWorkoutReminder,
  findWorkoutReminderById,
  setWorkoutReminderEnabled,
} from "./workout-reminder.repository.js";

export type AdminWorkoutReminderFilters = {
  gender?: ReminderGender;
  status?: "enabled" | "paused";
  timezone?: string;
  search?: string;
  page?: number;
  limit?: number;
  cursor?: number;
  totalHint?: number;
};

export type AdminWorkoutReminderRow = {
  id: number;
  firebaseUid: string;
  hour: number;
  minute: number;
  days: number[];
  enabled: boolean;
  gender: ReminderGender;
  timezone: string;
  schedule: string;
  nextRun: string | null;
  nextRunLabel: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminWorkoutReminderStats = {
  total: number;
  enabled: number;
  paused: number;
  dueToday: number;
  enabledPercent: number;
};

export type AdminWorkoutReminderAnalytics = {
  statusSplit: Array<{ label: string; value: number; color: string }>;
  genderSplit: { male: number; female: number; malePercent: number; femalePercent: number };
  upcomingToday: Array<{ time: string; timezone: string; count: number }>;
};

export type AdminWorkoutReminderListResult = {
  stats: AdminWorkoutReminderStats;
  analytics: AdminWorkoutReminderAnalytics;
  items: AdminWorkoutReminderRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    nextCursor: number | null;
  };
  timezones: string[];
};

export type AdminWorkoutReminderSummary = {
  stats: AdminWorkoutReminderStats;
  analytics: AdminWorkoutReminderAnalytics;
  timezones: string[];
  computedAt: string;
};

type ScheduleDoc = Pick<
  WorkoutReminderDocument,
  "hour" | "minute" | "days" | "timezone" | "createdAt" | "enabled"
>;

type FacetCounts = {
  totals?: Array<{ count: number }>;
  enabledCount?: Array<{ count: number }>;
  maleCount?: Array<{ count: number }>;
  femaleCount?: Array<{ count: number }>;
};

function collection(db: Db) {
  return db.collection<WorkoutReminderDocument>(COLLECTIONS.workoutReminders);
}

function serializeRow(doc: WorkoutReminderDocument): AdminWorkoutReminderRow {
  const nextRun = computeNextReminderRun(doc);
  return {
    id: doc.id,
    firebaseUid: doc.firebaseUid,
    hour: doc.hour,
    minute: doc.minute,
    days: doc.days,
    enabled: doc.enabled,
    gender: doc.gender,
    timezone: doc.timezone,
    schedule: formatReminderSchedule(doc.hour, doc.minute),
    nextRun,
    nextRunLabel: nextRun ? formatNextRunLabel(nextRun) : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function buildQuery(filters: AdminWorkoutReminderFilters): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  if (filters.gender) query.gender = filters.gender;
  if (filters.status === "enabled") query.enabled = true;
  if (filters.status === "paused") query.enabled = false;
  if (filters.timezone) query.timezone = filters.timezone;

  if (filters.cursor && Number.isInteger(filters.cursor) && filters.cursor > 0) {
    query.id = { $lt: filters.cursor };
  }

  const search = filters.search?.trim();
  if (search) {
    const id = Number(search.replace(/^#/, ""));
    if (Number.isInteger(id) && id > 0) {
      query.id = id;
    } else {
      query.firebaseUid = { $regex: search, $options: "i" };
    }
  }

  return query;
}

function hasListFilters(filters: AdminWorkoutReminderFilters): boolean {
  return Boolean(
    filters.gender ||
      filters.status ||
      filters.timezone ||
      filters.search?.trim() ||
      filters.cursor,
  );
}

async function resolveFilteredTotal(
  db: Db,
  query: Record<string, unknown>,
  filters: AdminWorkoutReminderFilters,
): Promise<number> {
  if (hasListFilters(filters)) {
    return collection(db).countDocuments(query);
  }
  if (filters.totalHint != null && filters.totalHint >= 0) {
    return filters.totalHint;
  }
  return collection(db).estimatedDocumentCount();
}

function countFromFacet(rows?: Array<{ count: number }>): number {
  return rows?.[0]?.count ?? 0;
}

function buildUpcomingToday(docs: ScheduleDoc[]) {
  const upcomingMap = new Map<string, { time: string; timezone: string; count: number }>();
  for (const doc of docs) {
    const zoned = getZonedDateParts(doc.timezone);
    const dayAllowed =
      doc.days.length === 0
        ? getZonedDateParts(doc.timezone, doc.createdAt).dateKey === zoned.dateKey
        : doc.days.includes(zoned.weekday);
    if (!dayAllowed) continue;

    const key = `${formatReminderSchedule(doc.hour, doc.minute)}|${doc.timezone}`;
    const existing = upcomingMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      upcomingMap.set(key, {
        time: formatReminderSchedule(doc.hour, doc.minute),
        timezone: doc.timezone,
        count: 1,
      });
    }
  }

  return [...upcomingMap.values()]
    .sort((a, b) => a.time.localeCompare(b.time) || b.count - a.count)
    .slice(0, 8);
}

async function loadAdminWorkoutReminderMeta(db: Db): Promise<{
  stats: AdminWorkoutReminderStats;
  analytics: AdminWorkoutReminderAnalytics;
  timezones: string[];
}> {
  const scheduleProjection = {
    hour: 1,
    minute: 1,
    days: 1,
    timezone: 1,
    createdAt: 1,
    enabled: 1,
  } as const;

  const HEAVY_META_THRESHOLD = 50_000;

  const [facetRows, timezoneRows] = await Promise.all([
    collection(db)
      .aggregate<{ totals: Array<{ count: number }>; enabledCount: Array<{ count: number }>; maleCount: Array<{ count: number }>; femaleCount: Array<{ count: number }> }>([
        {
          $facet: {
            totals: [{ $count: "count" }],
            enabledCount: [{ $match: { enabled: true } }, { $count: "count" }],
            maleCount: [{ $match: { gender: "male" } }, { $count: "count" }],
            femaleCount: [{ $match: { gender: "female" } }, { $count: "count" }],
          },
        },
      ])
      .toArray(),
    collection(db).distinct("timezone"),
  ]);

  const facet = (facetRows[0] ?? {}) as FacetCounts;
  const total = countFromFacet(facet.totals);
  const enabled = countFromFacet(facet.enabledCount);

  let enabledSchedule: ScheduleDoc[] = [];
  if (total <= HEAVY_META_THRESHOLD) {
    enabledSchedule = (await collection(db)
      .find({ enabled: true }, { projection: scheduleProjection })
      .toArray()) as ScheduleDoc[];
  }

  const paused = total - enabled;
  const male = countFromFacet(facet.maleCount);
  const female = countFromFacet(facet.femaleCount);
  const genderTotal = male + female;

  let dueToday = 0;
  let upcomingToday: AdminWorkoutReminderAnalytics["upcomingToday"] = [];

  if (total <= HEAVY_META_THRESHOLD) {
    dueToday = enabledSchedule.filter((doc) =>
      isReminderDueWithinHours({ ...doc, enabled: true }, 24),
    ).length;
    upcomingToday = buildUpcomingToday(enabledSchedule);
  }

  return {
    stats: {
      total,
      enabled,
      paused,
      dueToday,
      enabledPercent: total ? Math.round((enabled / total) * 100) : 0,
    },
    analytics: {
      statusSplit: [
        { label: "Enabled", value: enabled, color: "var(--bright-purple)" },
        { label: "Paused", value: paused, color: "var(--black-20)" },
      ],
      genderSplit: {
        male,
        female,
        malePercent: genderTotal ? Math.round((male / genderTotal) * 100) : 0,
        femalePercent: genderTotal ? Math.round((female / genderTotal) * 100) : 0,
      },
      upcomingToday,
    },
    timezones: timezoneRows.filter(Boolean).sort() as string[],
  };
}

export async function getAdminWorkoutReminderSummary(db: Db): Promise<AdminWorkoutReminderSummary> {
  const meta = await loadAdminWorkoutReminderMeta(db);
  return {
    ...meta,
    computedAt: new Date().toISOString(),
  };
}

export async function listAdminWorkoutReminderItems(
  db: Db,
  filters: AdminWorkoutReminderFilters,
): Promise<Pick<AdminWorkoutReminderListResult, "items" | "pagination">> {
  const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
  const useCursor = Boolean(filters.cursor);
  const page = Math.max(1, filters.page ?? 1);
  const query = buildQuery(filters);

  const [filteredTotal, pageDocs] = await Promise.all([
    resolveFilteredTotal(db, query, filters),
    (useCursor
      ? collection(db).find(query).sort({ id: -1 }).limit(limit)
      : collection(db)
          .find(query)
          .sort({ id: -1 })
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

export async function listAdminWorkoutReminders(
  db: Db,
  filters: AdminWorkoutReminderFilters,
): Promise<AdminWorkoutReminderListResult> {
  const [meta, itemsResult] = await Promise.all([
    loadAdminWorkoutReminderMeta(db),
    listAdminWorkoutReminderItems(db, { ...filters, totalHint: filters.totalHint ?? undefined }),
  ]);

  return {
    stats: meta.stats,
    analytics: meta.analytics,
    timezones: meta.timezones,
    items: itemsResult.items,
    pagination: itemsResult.pagination,
  };
}

export async function toggleAdminWorkoutReminder(
  db: Db,
  id: number,
  enabled: boolean,
): Promise<AdminWorkoutReminderRow | null> {
  const existing = await findWorkoutReminderById(db, id);
  if (!existing) return null;
  const updated = await setWorkoutReminderEnabled(db, id, existing.firebaseUid, enabled);
  return updated ? serializeRow(updated) : null;
}

export async function deleteAdminWorkoutReminder(db: Db, id: number): Promise<boolean> {
  const existing = await findWorkoutReminderById(db, id);
  if (!existing) return false;
  return deleteWorkoutReminder(db, id, existing.firebaseUid);
}

export function adminWorkoutReminderCacheKey(filters: AdminWorkoutReminderFilters): string[] {
  return [
    "list",
    filters.gender ?? "all",
    filters.status ?? "all",
    filters.timezone ?? "all",
    filters.search?.trim() ?? "",
    filters.cursor ? "cursor" : String(filters.page ?? 1),
    filters.cursor ? String(filters.cursor) : "",
    String(filters.limit ?? 25),
  ];
}

export function adminWorkoutReminderSummaryCacheKey(): string[] {
  return ["summary"];
}

export const WORKOUT_REMINDER_SUMMARY_SNAPSHOT = "workoutReminders:summary";
