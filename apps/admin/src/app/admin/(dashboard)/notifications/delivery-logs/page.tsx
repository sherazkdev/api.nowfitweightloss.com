"use client";

import { useCallback, useMemo, useState } from "react";
import { Pill } from "@/components/ui/badges";
import { IconButton, SecondaryButton } from "@/components/ui/buttons";
import { EmptyState, SkeletonState, StatCard } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { DeliveryLogsAnalyticsPanel } from "@/components/notifications/delivery-logs-analytics";
import { cn } from "@/lib/cn";
import { ApiError } from "@/lib/api-client";
import { useDeferredEffect } from "@/lib/use-deferred-effect";
import {
  fetchDeliveryLogsAdmin,
  fetchDeliveryLogsSummaryAdmin,
  formatLogTimestamp,
  retryDeliveryLogAdmin,
  shortUid,
  type DeliveryLogAnalytics,
  type DeliveryLogRow,
  type DeliveryLogStats,
} from "@/lib/delivery-logs-api";

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

function StatusBadge({ status }: { status: DeliveryLogRow["status"] }) {
  const styles = {
    delivered: "bg-[rgb(161_227_203/0.22)] text-[var(--bright-green,#16a34a)]",
    partial: "bg-[rgb(179_215_255/0.22)] text-[var(--chart-blue)]",
    failed: "bg-[rgb(255_71_71/0.12)] text-[var(--bright-red)]",
    skipped: "bg-[var(--black-05)] text-[var(--text-muted)]",
  } as const;

  const labels = {
    delivered: "Delivered",
    partial: "Partial",
    failed: "Failed",
    skipped: "Skipped",
  } as const;

  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", styles[status])}>
      {labels[status]}
    </span>
  );
}

function PlatformBadge({ platform }: { platform: DeliveryLogRow["platform"] }) {
  if (platform === "unknown") {
    return <span className="text-[12px] text-[var(--text-muted)]">Unknown</span>;
  }
  if (platform === "mixed") {
    return <Pill>Mixed</Pill>;
  }

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

export default function DeliveryLogsPage() {
  const [status, setStatus] = useState("all");
  const [platform, setPlatform] = useState("all");
  const [days, setDays] = useState("30");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<DeliveryLogRow[]>([]);
  const [stats, setStats] = useState<DeliveryLogStats>({
    totalAttempts: 0,
    delivered: 0,
    failed: 0,
    skipped: 0,
    partial: 0,
    successRatePercent: 0,
    failureRatePercent: 0,
    tokensDelivered: 0,
    tokensFailed: 0,
  });
  const [analytics, setAnalytics] = useState<DeliveryLogAnalytics>({
    deliveryRate: [],
    failureReasons: [],
    queue: { skippedRecent: 0, schedulerEnabled: false, mode: "cron" },
  });
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [retryingId, setRetryingId] = useState<number | null>(null);

  const loadData = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError("");
      try {
        const daysNum = Number(days);
        const filters = {
          status:
            status === "all"
              ? undefined
              : (status as "delivered" | "failed" | "partial" | "skipped"),
          platform: platform === "all" ? undefined : (platform as "android" | "ios"),
          search,
          days: daysNum,
          page,
          limit: 25,
        };
        const [summary, list] = await Promise.all([
          fetchDeliveryLogsSummaryAdmin(daysNum),
          fetchDeliveryLogsAdmin(filters),
        ]);
        setRows(list.items);
        setStats(summary.stats);
        setAnalytics(summary.analytics);
        setTotalPages(list.pagination.totalPages);
        setTotal(list.pagination.total);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load delivery logs");
        setRows([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [days, page, platform, search, status],
  );

  useDeferredEffect(() => {
    void loadData();
  }, [loadData]);

  const hasFilters = status !== "all" || platform !== "all" || search.trim().length > 0;

  const pageLabel = useMemo(() => {
    if (total === 0) return "0 attempts";
    const start = (page - 1) * 25 + 1;
    const end = Math.min(page * 25, total);
    return `${start}–${end} of ${total}`;
  }, [page, total]);

  const resetFilters = () => {
    setStatus("all");
    setPlatform("all");
    setSearch("");
    setPage(1);
  };

  const handleRetry = async (row: DeliveryLogRow) => {
    setRetryingId(row.id);
    try {
      await retryDeliveryLogAdmin(row.id);
      void loadData(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Retry failed");
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
      <div className="min-w-0 flex-1">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[18px] font-semibold leading-7 tracking-tight">Delivery Logs</h1>
            <p className="text-[13px] leading-5 text-[var(--text-muted)]">
              Track every FCM delivery attempt and troubleshoot failures.
            </p>
          </div>
          <SecondaryButton onClick={() => void loadData(true)} disabled={loading || refreshing}>
            {refreshing ? "Refreshing…" : "Refresh data"}
          </SecondaryButton>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Attempts"
            value={stats.totalAttempts}
            hint={`Last ${days} days`}
          />
          <StatCard
            label="Delivered"
            value={stats.delivered}
            tone="green"
            hint={`${stats.successRatePercent}% success`}
          />
          <StatCard label="Failed" value={stats.failed} tone="purple" hint="Hard failures" />
          <StatCard label="Skipped" value={stats.skipped} hint="No device tokens" />
        </div>

        <div className="mb-4 rounded-[14px] border border-[var(--border)] bg-[var(--card-bg)] p-3 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
            <label className="flex min-w-[200px] flex-1 flex-col gap-1">
              <span className="text-[11px] leading-4 text-[var(--text-muted)]">Search</span>
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search user, reminder or log ID"
                className="h-8 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] outline-none focus:border-[var(--bright-purple)]"
              />
            </label>
            <FilterSelect
              label="Status"
              value={status}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
              options={[
                { value: "all", label: "All statuses" },
                { value: "delivered", label: "Delivered" },
                { value: "partial", label: "Partial" },
                { value: "failed", label: "Failed" },
                { value: "skipped", label: "Skipped" },
              ]}
            />
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
              label="Date range"
              value={days}
              onChange={(value) => {
                setDays(value);
                setPage(1);
              }}
              options={[
                { value: "7", label: "Last 7 days" },
                { value: "30", label: "Last 30 days" },
                { value: "90", label: "Last 90 days" },
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
            <h2 className="text-[14px] font-semibold leading-5">All Delivery Attempts</h2>
            <span className="text-[12px] text-[var(--text-muted)]">{pageLabel}</span>
          </div>

          {loading ? (
            <SkeletonState rows={8} />
          ) : rows.length === 0 ? (
            <EmptyState
              title={hasFilters ? "No logs match filters" : "No delivery logs yet"}
              description={
                hasFilters
                  ? "Try clearing filters to see all logged attempts."
                  : "Logs appear when the worker sends workout reminder pushes."
              }
              action={
                hasFilters ? (
                  <SecondaryButton onClick={resetFilters}>Reset filters</SecondaryButton>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full text-left">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[12px] text-[var(--text-muted)]">
                    <th className="px-4 py-3 font-medium">Timestamp</th>
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Notification</th>
                    <th className="hidden px-4 py-3 font-medium md:table-cell">Platform</th>
                    <th className="hidden px-4 py-3 font-medium lg:table-cell">Tokens</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-[var(--border)] last:border-b-0">
                      <td className="px-4 py-3 whitespace-nowrap text-[12px] text-[var(--text-secondary)]">
                        {formatLogTimestamp(row.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="min-w-[120px]">
                          <p className="text-[13px] font-medium leading-5">#{row.reminderId}</p>
                          <p className="font-mono text-[11px] leading-4 text-[var(--text-muted)]">
                            {shortUid(row.firebaseUid)}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[13px] leading-5">{row.notification}</p>
                        {row.errorMessage ? (
                          <p className="mt-0.5 text-[11px] leading-4 text-[var(--bright-red)]">
                            {row.errorMessage}
                          </p>
                        ) : null}
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <PlatformBadge platform={row.platform} />
                      </td>
                      <td className="hidden px-4 py-3 text-[12px] lg:table-cell">
                        {row.successCount}/{row.tokenCount}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {(row.status === "failed" || row.status === "skipped") && (
                            <IconButton
                              aria-label="Retry delivery"
                              title="Retry"
                              disabled={retryingId === row.id}
                              onClick={() => void handleRetry(row)}
                            >
                              <Icon name="history" size={16} />
                            </IconButton>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && totalPages > 1 ? (
            <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3">
              <SecondaryButton disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                Previous
              </SecondaryButton>
              <span className="text-[12px] text-[var(--text-muted)]">
                Page {page} of {totalPages}
              </span>
              <SecondaryButton
                disabled={page >= totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </SecondaryButton>
            </div>
          ) : null}
        </div>
      </div>

      <aside className="w-full shrink-0 xl:sticky xl:top-4 xl:w-[300px]">
        <DeliveryLogsAnalyticsPanel stats={stats} analytics={analytics} />
      </aside>
    </div>
  );
}
