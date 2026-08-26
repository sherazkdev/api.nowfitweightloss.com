"use client";

import { useCallback, useMemo, useState } from "react";
import { GenderBadge } from "@/components/ui/badges";
import { IconButton, SecondaryButton } from "@/components/ui/buttons";
import { ConfirmDeleteModal, EmptyState, SkeletonState, StatCard } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { ReminderDaysCell, ReminderToggle } from "@/components/notifications/reminder-cells";
import { WorkoutRemindersAnalyticsPanel } from "@/components/notifications/workout-reminders-analytics";
import { cn } from "@/lib/cn";
import { ApiError } from "@/lib/api-client";
import { useDeferredEffect } from "@/lib/use-deferred-effect";
import {
  deleteWorkoutReminderAdmin,
  fetchWorkoutRemindersAdmin,
  fetchWorkoutRemindersSummaryAdmin,
  shortUid,
  toggleWorkoutReminderAdmin,
  type WorkoutReminderAnalytics,
  type WorkoutReminderRow,
  type WorkoutReminderStats,
} from "@/lib/workout-reminders-api";

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

export default function WorkoutRemindersPage() {
  const [gender, setGender] = useState("all");
  const [status, setStatus] = useState("all");
  const [timezone, setTimezone] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<WorkoutReminderRow[]>([]);
  const [stats, setStats] = useState<WorkoutReminderStats>({
    total: 0,
    enabled: 0,
    paused: 0,
    dueToday: 0,
    enabledPercent: 0,
  });
  const [analytics, setAnalytics] = useState<WorkoutReminderAnalytics>({
    statusSplit: [],
    genderSplit: { male: 0, female: 0, malePercent: 0, femalePercent: 0 },
    upcomingToday: [],
  });
  const [timezones, setTimezones] = useState<string[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [pendingToggle, setPendingToggle] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkoutReminderRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError("");
      try {
        const filters = {
          gender: gender === "all" ? undefined : (gender as "male" | "female"),
          status: status === "all" ? undefined : (status as "enabled" | "paused"),
          timezone: timezone === "all" ? undefined : timezone,
          search,
          page,
          limit: 25,
        };
        const [summary, list] = await Promise.all([
          fetchWorkoutRemindersSummaryAdmin(),
          fetchWorkoutRemindersAdmin(filters),
        ]);
        setRows(list.items);
        setStats(summary.stats);
        setAnalytics(summary.analytics);
        setTimezones(summary.timezones);
        setTotalPages(list.pagination.totalPages);
        setTotal(list.pagination.total);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load workout reminders");
        setRows([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [gender, page, search, status, timezone],
  );

  useDeferredEffect(() => {
    void loadData();
  }, [loadData]);

  const hasFilters = gender !== "all" || status !== "all" || timezone !== "all" || search.trim().length > 0;

  const pageLabel = useMemo(() => {
    if (total === 0) return "0 reminders";
    const start = (page - 1) * 25 + 1;
    const end = Math.min(page * 25, total);
    return `${start}–${end} of ${total}`;
  }, [page, total]);

  const resetFilters = () => {
    setGender("all");
    setStatus("all");
    setTimezone("all");
    setSearch("");
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
      <div className="min-w-0 flex-1">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[18px] font-semibold leading-7 tracking-tight">Workout Reminders</h1>
            <p className="text-[13px] leading-5 text-[var(--text-muted)]">
              Manage scheduled workout notifications across all users.
            </p>
          </div>
          <SecondaryButton onClick={() => void loadData(true)} disabled={loading || refreshing}>
            {refreshing ? "Refreshing…" : "Refresh data"}
          </SecondaryButton>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Reminders" value={stats.total} hint="All schedules" />
          <StatCard
            label="Enabled"
            value={stats.enabled}
            tone="purple"
            hint={`${stats.enabledPercent}% active`}
          />
          <StatCard label="Due Today" value={stats.dueToday} tone="green" hint="Next 24 hours" />
          <StatCard label="Paused" value={stats.paused} hint="Notifications off" />
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
                placeholder="UID or reminder ID"
                className="h-8 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] outline-none focus:border-[var(--bright-purple)]"
              />
            </label>
            <FilterSelect
              label="Gender"
              value={gender}
              onChange={(value) => {
                setGender(value);
                setPage(1);
              }}
              options={[
                { value: "all", label: "All genders" },
                { value: "male", label: "Male" },
                { value: "female", label: "Female" },
              ]}
            />
            <FilterSelect
              label="Status"
              value={status}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
              options={[
                { value: "all", label: "All statuses" },
                { value: "enabled", label: "Enabled" },
                { value: "paused", label: "Paused" },
              ]}
            />
            <FilterSelect
              label="Timezone"
              value={timezone}
              onChange={(value) => {
                setTimezone(value);
                setPage(1);
              }}
              options={[
                { value: "all", label: "All timezones" },
                ...timezones.map((tz) => ({ value: tz, label: tz })),
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
            <h2 className="text-[14px] font-semibold leading-5">All Reminders</h2>
            <span className="text-[12px] text-[var(--text-muted)]">{pageLabel}</span>
          </div>

          {loading ? (
            <SkeletonState rows={8} />
          ) : rows.length === 0 ? (
            <EmptyState
              title={hasFilters ? "No reminders match filters" : "No workout reminders yet"}
              description={
                hasFilters
                  ? "Try clearing filters to see all reminders from the database."
                  : "Reminders will appear here when mobile users create schedules."
              }
              action={
                hasFilters ? (
                  <SecondaryButton onClick={resetFilters}>Reset filters</SecondaryButton>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[920px] w-full text-left">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[12px] text-[var(--text-muted)]">
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Schedule</th>
                    <th className="hidden px-4 py-3 font-medium md:table-cell">Days</th>
                    <th className="px-4 py-3 font-medium">Gender</th>
                    <th className="hidden px-4 py-3 font-medium lg:table-cell">Timezone</th>
                    <th className="hidden px-4 py-3 font-medium xl:table-cell">Next Run</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-[var(--border)] last:border-b-0">
                      <td className="px-4 py-3">
                        <div className="min-w-[140px]">
                          <p className="text-[13px] font-medium leading-5">User #{row.id}</p>
                          <p className="font-mono text-[11px] leading-4 text-[var(--text-muted)]">
                            {shortUid(row.firebaseUid)}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[13px] font-medium">{row.schedule}</td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <ReminderDaysCell days={row.days} />
                      </td>
                      <td className="px-4 py-3">
                        <GenderBadge gender={row.gender} />
                      </td>
                      <td className="hidden max-w-[160px] truncate px-4 py-3 text-[12px] lg:table-cell">
                        {row.timezone}
                      </td>
                      <td className="hidden px-4 py-3 text-[12px] xl:table-cell">
                        {row.nextRunLabel ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <ReminderToggle
                          enabled={row.enabled}
                          disabled={pendingToggle === row.id}
                          onChange={(enabled) => {
                            setPendingToggle(row.id);
                            void toggleWorkoutReminderAdmin(row.id, enabled)
                              .then(() => loadData(true))
                              .catch((err) => {
                                setError(
                                  err instanceof ApiError ? err.message : "Failed to update reminder",
                                );
                              })
                              .finally(() => setPendingToggle(null));
                          }}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <IconButton aria-label={`Delete reminder ${row.id}`} onClick={() => setDeleteTarget(row)}>
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
          <WorkoutRemindersAnalyticsPanel stats={stats} analytics={analytics} />
        </div>
      </div>

      <aside className="hidden w-full shrink-0 xl:block xl:w-[300px] 2xl:w-[320px]">
        <div className="xl:sticky xl:top-4">
          <WorkoutRemindersAnalyticsPanel stats={stats} analytics={analytics} />
        </div>
      </aside>

      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        resource="reminder"
        name={deleteTarget ? `Reminder #${deleteTarget.id}` : undefined}
        deleting={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          setDeleting(true);
          void deleteWorkoutReminderAdmin(deleteTarget.id)
            .then(() => {
              setDeleteTarget(null);
              return loadData(true);
            })
            .catch((err) => {
              setError(err instanceof ApiError ? err.message : "Failed to delete reminder");
            })
            .finally(() => setDeleting(false));
        }}
      />
    </div>
  );
}
