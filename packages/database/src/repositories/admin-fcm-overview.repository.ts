import type { NotificationDeliveryDocument, UserDeviceDocument } from "@weightloss/contracts";
import { formatReminderSchedule } from "@weightloss/shared";
import type { Db } from "mongodb";
import { COLLECTIONS } from "../collections.js";
import { getAdminDeviceSummary } from "./admin-user-devices.repository.js";
import { getAdminWorkoutReminderSummary } from "./admin-workout-reminders.repository.js";

export type FcmFlowNodeStatus = "connected" | "degraded" | "offline";

export type FcmOverviewStats = {
  registeredDevices: number;
  activeDevices: number;
  activeReminders: number;
  enabledReminderPercent: number;
  sentToday: number;
  failedToday: number;
  deliveryRatePercent: number;
  failureRatePercent: number;
};

export type FcmDeliveryChartPoint = {
  date: string;
  label: string;
  delivered: number;
  failed: number;
};

export type FcmRecentDeliveryRow = {
  id: number;
  createdAt: string;
  firebaseUid: string;
  reminderId: number;
  notification: string;
  schedule: string;
  gender: "male" | "female";
  tokenCount: number;
  status: NotificationDeliveryDocument["status"];
};

export type FcmActivityItem = {
  id: string;
  type: "delivery" | "device_registered" | "device_refreshed";
  message: string;
  createdAt: string;
  tone: "success" | "warning" | "info";
};

export type FcmSystemStatus = {
  firebaseAdmin: FcmFlowNodeStatus;
  scheduler: FcmFlowNodeStatus;
  api: FcmFlowNodeStatus;
  firebaseConfigured: boolean;
  schedulerEnabled: boolean;
};

export type FcmOverviewResult = {
  stats: FcmOverviewStats;
  flow: {
    mobileApp: FcmFlowNodeStatus;
    apiServer: FcmFlowNodeStatus;
    firebaseFcm: FcmFlowNodeStatus;
    userDevice: FcmFlowNodeStatus;
  };
  chart: FcmDeliveryChartPoint[];
  recentDeliveries: FcmRecentDeliveryRow[];
  activity: FcmActivityItem[];
  system: FcmSystemStatus;
  computedAt: string;
};

function deliveryCollection(db: Db) {
  return db.collection<NotificationDeliveryDocument>(COLLECTIONS.notificationDeliveries);
}

function deviceCollection(db: Db) {
  return db.collection<UserDeviceDocument>(COLLECTIONS.userDevices);
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function startOfDaysAgo(days: number): Date {
  const date = startOfToday();
  date.setDate(date.getDate() - days);
  return date;
}

function formatChartLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function notificationLabel(doc: Pick<NotificationDeliveryDocument, "gender" | "hour" | "minute">): string {
  return `Workout reminder • ${doc.gender} • ${formatReminderSchedule(doc.hour, doc.minute)}`;
}

function relativeActivityMessage(createdAt: Date, message: string): string {
  const diffMs = Date.now() - createdAt.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return `${message} just now`;
  if (minutes < 60) return `${message} ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${message} ${hours}h ago`;
  return `${message} ${Math.floor(hours / 24)}d ago`;
}

export type FcmOverviewOptions = {
  firebaseConfigured: boolean;
  schedulerEnabled: boolean;
  apiHealthy: boolean;
};

export async function getAdminFcmOverview(db: Db, options: FcmOverviewOptions): Promise<FcmOverviewResult> {
  const todayStart = startOfToday();
  const chartStart = startOfDaysAgo(6);
  const activityStart = startOfDaysAgo(1);

  const [deviceSummary, reminderSummary, todayAgg, chartRows, recentDocs, recentDevices] =
    await Promise.all([
      getAdminDeviceSummary(db),
      getAdminWorkoutReminderSummary(db),
      deliveryCollection(db)
        .aggregate<{ sent: number; failed: number }>([
          { $match: { createdAt: { $gte: todayStart } } },
          {
            $group: {
              _id: null,
              sent: { $sum: "$successCount" },
              failed: { $sum: "$failureCount" },
            },
          },
        ])
        .toArray(),
      deliveryCollection(db)
        .aggregate<{ _id: string; delivered: number; failed: number }>([
          { $match: { createdAt: { $gte: chartStart } } },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
              },
              delivered: { $sum: "$successCount" },
              failed: { $sum: "$failureCount" },
            },
          },
          { $sort: { _id: 1 } },
        ])
        .toArray(),
      deliveryCollection(db).find({}).sort({ createdAt: -1 }).limit(8).toArray(),
      deviceCollection(db)
        .find({ updatedAt: { $gte: activityStart } })
        .sort({ updatedAt: -1 })
        .limit(6)
        .toArray(),
    ]);

  const sentToday = todayAgg[0]?.sent ?? 0;
  const failedToday = todayAgg[0]?.failed ?? 0;
  const attemptsToday = sentToday + failedToday;
  const deliveryRatePercent = attemptsToday
    ? Math.round((sentToday / attemptsToday) * 1000) / 10
    : 100;
  const failureRatePercent = attemptsToday
    ? Math.round((failedToday / attemptsToday) * 1000) / 10
    : 0;

  const chartMap = new Map(chartRows.map((row) => [row._id, row]));
  const chart: FcmDeliveryChartPoint[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = startOfDaysAgo(offset);
    const key = date.toISOString().slice(0, 10);
    const row = chartMap.get(key);
    chart.push({
      date: key,
      label: formatChartLabel(key),
      delivered: row?.delivered ?? 0,
      failed: row?.failed ?? 0,
    });
  }

  const firebaseStatus: FcmFlowNodeStatus = options.firebaseConfigured ? "connected" : "offline";
  const schedulerStatus: FcmFlowNodeStatus = options.schedulerEnabled ? "connected" : "offline";
  const apiStatus: FcmFlowNodeStatus = options.apiHealthy ? "connected" : "degraded";
  const deviceStatus: FcmFlowNodeStatus =
    deviceSummary.stats.active > 0 ? "connected" : deviceSummary.stats.total > 0 ? "degraded" : "offline";

  const activity: FcmActivityItem[] = [
    ...recentDocs.map((doc) => ({
      id: `delivery-${doc.id}`,
      type: "delivery" as const,
      message: relativeActivityMessage(
        doc.createdAt,
        doc.status === "delivered"
          ? "Reminder delivered"
          : doc.status === "failed"
            ? "Reminder delivery failed"
            : doc.status === "skipped"
              ? "Reminder skipped (no tokens)"
              : "Reminder partially delivered",
      ),
      createdAt: doc.createdAt.toISOString(),
      tone:
        doc.status === "delivered"
          ? ("success" as const)
          : doc.status === "failed" || doc.status === "skipped"
            ? ("warning" as const)
            : ("info" as const),
    })),
    ...recentDevices.map((device) => {
      const registered = device.createdAt.getTime() === device.updatedAt.getTime();
      return {
        id: `device-${device.id}`,
        type: registered ? ("device_registered" as const) : ("device_refreshed" as const),
        message: relativeActivityMessage(
          device.updatedAt,
          registered ? "Device token registered" : "Device token refreshed",
        ),
        createdAt: device.updatedAt.toISOString(),
        tone: "info" as const,
      };
    }),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);

  return {
    stats: {
      registeredDevices: deviceSummary.stats.total,
      activeDevices: deviceSummary.stats.active,
      activeReminders: reminderSummary.stats.enabled,
      enabledReminderPercent: reminderSummary.stats.enabledPercent,
      sentToday,
      failedToday,
      deliveryRatePercent,
      failureRatePercent,
    },
    flow: {
      mobileApp: "connected",
      apiServer: apiStatus,
      firebaseFcm: firebaseStatus,
      userDevice: deviceStatus,
    },
    chart,
    recentDeliveries: recentDocs.map((doc) => ({
      id: doc.id,
      createdAt: doc.createdAt.toISOString(),
      firebaseUid: doc.firebaseUid,
      reminderId: doc.reminderId,
      notification: notificationLabel(doc),
      schedule: formatReminderSchedule(doc.hour, doc.minute),
      gender: doc.gender,
      tokenCount: doc.tokenCount,
      status: doc.status,
    })),
    activity,
    system: {
      firebaseAdmin: firebaseStatus,
      scheduler: schedulerStatus,
      api: apiStatus,
      firebaseConfigured: options.firebaseConfigured,
      schedulerEnabled: options.schedulerEnabled,
    },
    computedAt: new Date().toISOString(),
  };
}

export function adminFcmOverviewCacheKey(): string[] {
  return ["overview"];
}
