"use client";

import { useCallback, useMemo, useState } from "react";
import { Pill } from "@/components/ui/badges";
import { IconButton, SecondaryButton } from "@/components/ui/buttons";
import { ConfirmDeleteModal, EmptyState, SkeletonState, StatCard } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { DevicesAnalyticsPanel } from "@/components/notifications/devices-analytics";
import { cn } from "@/lib/cn";
import { ApiError } from "@/lib/api-client";
import { useDeferredEffect } from "@/lib/use-deferred-effect";
import {
  deleteDeviceAdmin,
  fetchDevicesAdmin,
  fetchDevicesSummaryAdmin,
  formatRelativeTime,
  shortUid,
  type DeviceAnalytics,
  type DeviceRow,
  type DeviceStats,
} from "@/lib/devices-api";

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex min-w-[140px] flex-1 flex-col gap-1 sm:max-w-[180px]">
      <span className="text-[11px] leading-4 text-[var(--text-muted)]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-2 text-[13px] outline-none focus:border-[var(--bright-purple)]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PlatformBadge({ platform }: { platform: "android" | "ios" }) {
  return (
    <Pill
      className={cn(
        platform === "android"
          ? "bg-[rgb(149_164_252/0.18)] text-[var(--bright-purple)]"
          : "bg-[rgb(179_215_255/0.22)] text-[var(--chart-blue)]",
      )}
    >
      {platform === "android" ? "Android" : "iOS"}
    </Pill>
  );
}

function StatusBadge({ status }: { status: "active" | "stale" }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
        status === "active"
          ? "bg-[rgb(161_227_203/0.22)] text-[var(--bright-green,#16a34a)]"
          : "bg-[var(--black-05)] text-[var(--text-muted)]",
      )}
    >
      {status === "active" ? "Active" : "Stale"}
    </span>
  );
}

export default function DevicesPage() {
  const [platform, setPlatform] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<DeviceRow[]>([]);
  const [stats, setStats] = useState<DeviceStats>({
    total: 0,
    active: 0,
    stale: 0,
    activePercent: 0,
    android: 0,
    ios: 0,
    androidPercent: 0,
    iosPercent: 0,
  });
  const [analytics, setAnalytics] = useState<DeviceAnalytics>({
    healthSplit: [],
    platformSplit: { android: 0, ios: 0, androidPercent: 0, iosPercent: 0 },
    activity: { registeredToday: 0, refreshedToday: 0 },
  });
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeviceRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError("");
      try {
        const filters = {
          platform: platform === "all" ? undefined : (platform as "android" | "ios"),
          status: status === "all" ? undefined : (status as "active" | "stale"),
          search,
          page,
          limit: 25,
        };
        const [summary, list] = await Promise.all([
          fetchDevicesSummaryAdmin(),
          fetchDevicesAdmin(filters),
        ]);
        setRows(list.items);
        setStats(summary.stats);
        setAnalytics(summary.analytics);
        setTotalPages(list.pagination.totalPages);
        setTotal(list.pagination.total);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load devices");
        setRows([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, platform, search, status],
  );

  useDeferredEffect(() => {
    void loadData();
  }, [loadData]);

  const hasFilters = platform !== "all" || status !== "all" || search.trim().length > 0;

  const pageLabel = useMemo(() => {
    if (total === 0) return "0 devices";
    const start = (page - 1) * 25 + 1;
    const end = Math.min(page * 25, total);
    return `${start}–${end} of ${total}`;
  }, [page, total]);

  const resetFilters = () => {
    setPlatform("all");
    setStatus("all");
    setSearch("");
    setPage(1);
  };

  const copyToken = async (row: DeviceRow) => {
    try {
      await navigator.clipboard.writeText(row.fcmToken);
      setCopiedId(row.id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setError("Could not copy token to clipboard");
    }
  };

  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
      <div className="min-w-0 flex-1">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[18px] font-semibold leading-7 tracking-tight">Registered Devices</h1>
            <p className="text-[13px] leading-5 text-[var(--text-muted)]">
              Monitor FCM tokens and device activity across all users.
            </p>
          </div>
          <SecondaryButton onClick={() => void loadData(true)} disabled={loading || refreshing}>
            {refreshing ? "Refreshing…" : "Refresh data"}
          </SecondaryButton>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Devices" value={stats.total} hint="All registered" />
          <StatCard
            label="Active Tokens"
            value={stats.active}
            tone="green"
            hint={`${stats.activePercent}% healthy`}
          />
          <StatCard
            label="Android"
            value={stats.android}
            tone="purple"
            hint={`${stats.androidPercent}% of devices`}
          />
          <StatCard label="iOS" value={stats.ios} hint={`${stats.iosPercent}% of devices`} />
        </div>

        <div className="mb-4 rounded-[14px] border border-[var(--border)] bg-[var(--card-bg)] p-3 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-[11px] leading-4 text-[var(--text-muted)]">Search</span>
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="User UID, device ID or token"
                className="h-8 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] outline-none focus:border-[var(--bright-purple)]"
              />
            </label>
            <FilterSelect
              label="Platform"
              value={platform}
              onChange={(value) => {
                setPlatform(value);
                setPage(1);
              }}
              options={[
                { value: "all", label: "All platforms" },
                { value: "android", label: "Android" },
                { value: "ios", label: "iOS" },
              ]}
            />
            <FilterSelect
              label="Token status"
              value={status}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
              options={[
                { value: "all", label: "All statuses" },
                { value: "active", label: "Active" },
                { value: "stale", label: "Stale" },
              ]}
            />
            {hasFilters ? (
              <button
                type="button"
                className="h-8 text-[12px] text-[var(--bright-purple)] hover:underline"
                onClick={resetFilters}
              >
                Reset filters
              </button>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className="mb-4 flex items-start gap-2 rounded-[12px] border border-[rgb(255_71_71/0.25)] bg-[rgb(255_71_71/0.08)] px-4 py-3 text-[13px] text-[var(--bright-red)]">
            <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-[16px] border border-[var(--border)] bg-[var(--card-bg)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <h2 className="text-[14px] font-semibold leading-5">All Devices</h2>
            <span className="text-[12px] text-[var(--text-muted)]">{pageLabel}</span>
          </div>

          {loading ? (
            <SkeletonState rows={8} />
          ) : rows.length === 0 ? (
            <EmptyState
              title={hasFilters ? "No devices match filters" : "No devices registered yet"}
              description={
                hasFilters
                  ? "Try clearing filters to see all registered devices."
                  : "Devices appear when mobile users grant notification permission."
              }
              action={
                hasFilters ? (
                  <SecondaryButton onClick={resetFilters}>Reset filters</SecondaryButton>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[880px] w-full text-left">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[12px] text-[var(--text-muted)]">
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Platform</th>
                    <th className="hidden px-4 py-3 font-medium md:table-cell">FCM Token</th>
                    <th className="px-4 py-3 font-medium">Last Seen</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-[var(--border)] last:border-b-0">
                      <td className="px-4 py-3">
                        <div className="flex min-w-[140px] items-center gap-2">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--black-05)]">
                            <Icon name="broadcast" size={16} />
                          </span>
                          <div>
                            <p className="text-[13px] font-medium leading-5">Device #{row.id}</p>
                            <p className="font-mono text-[11px] leading-4 text-[var(--text-muted)]">
                              {shortUid(row.firebaseUid)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <PlatformBadge platform={row.platform} />
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <div className="flex items-center gap-2">
                          <code className="text-[11px] text-[var(--text-secondary)]">{row.fcmTokenMasked}</code>
                          <IconButton
                            aria-label="Copy FCM token"
                            onClick={() => void copyToken(row)}
                          >
                            <Icon name={copiedId === row.id ? "check" : "copy"} size={14} />
                          </IconButton>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[var(--text-secondary)]">
                        {formatRelativeTime(row.lastSeenAt)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <IconButton aria-label="Copy token" onClick={() => void copyToken(row)}>
                            <Icon name="copy" size={16} />
                          </IconButton>
                          <IconButton
                            aria-label={`Delete device ${row.id}`}
                            onClick={() => setDeleteTarget(row)}
                          >
                            <Icon name="trash" size={16} />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && totalPages > 1 ? (
            <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] px-4 py-3">
              <SecondaryButton disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                Previous
              </SecondaryButton>
              <span className="text-[12px] text-[var(--text-muted)]">
                Page {page} of {totalPages}
              </span>
              <SecondaryButton
                disabled={page >= totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              >
                Next
              </SecondaryButton>
            </div>
          ) : null}
        </div>

        <div className="mt-4 xl:hidden">
          <DevicesAnalyticsPanel stats={stats} analytics={analytics} />
        </div>
      </div>

      <aside className="hidden w-full shrink-0 xl:block xl:w-[300px] 2xl:w-[320px]">
        <div className="xl:sticky xl:top-4">
          <DevicesAnalyticsPanel stats={stats} analytics={analytics} />
        </div>
      </aside>

      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        resource="device"
        name={deleteTarget ? `Device #${deleteTarget.id}` : undefined}
        deleting={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          setDeleting(true);
          void deleteDeviceAdmin(deleteTarget.id)
            .then(() => {
              setDeleteTarget(null);
              return loadData(true);
            })
            .catch((err) => {
              setError(err instanceof ApiError ? err.message : "Failed to delete device");
            })
            .finally(() => setDeleting(false));
        }}
      />
    </div>
  );
}
