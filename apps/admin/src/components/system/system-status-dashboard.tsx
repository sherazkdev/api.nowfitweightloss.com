"use client";

import { useCallback, useState, type ReactNode } from "react";
import Link from "next/link";
import { SecondaryButton } from "@/components/ui/buttons";
import { Icon } from "@/components/ui/icon";
import { ApiError } from "@/lib/api-client";
import { adminPath } from "@/lib/admin-path";
import { fetchSystemStatus, type SystemStatusApi } from "@/lib/system-api";
import type { IconName } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { useDeferredEffect } from "@/lib/use-deferred-effect";

function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatCheckedAt(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-[10px] bg-[var(--black-05)]", className)} />;
}

function StatusDot({
  tone,
}: {
  tone: "healthy" | "failed" | "warning" | "info";
}) {
  const color =
    tone === "healthy"
      ? "var(--status-active)"
      : tone === "failed"
        ? "var(--bright-red)"
        : tone === "warning"
          ? "var(--bright-orange)"
          : "var(--bright-blue)";
  return (
    <span className="inline-flex size-2 shrink-0 rounded-full" style={{ background: color }} />
  );
}

function StatusCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: IconName;
  label: string;
  value: string;
  hint: string;
  tone: "healthy" | "failed" | "warning" | "info";
}) {
  return (
    <article className="rounded-[14px] border border-[var(--border)] bg-[var(--card-bg)] px-3 py-3 md:px-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-[var(--pastel-blue)] text-[var(--static-black)]">
          <Icon name={icon} size={14} />
        </span>
        <StatusDot tone={tone} />
      </div>
      <p className="text-[12px] leading-[18px] text-[var(--text-muted)]">{label}</p>
      <p className="mt-0.5 text-[18px] font-semibold leading-7 tracking-tight">{value}</p>
      <p className="mt-0.5 text-[12px] leading-[18px] text-[var(--text-muted)]">{hint}</p>
    </article>
  );
}

function ResourceRow({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex min-h-11 items-center justify-between gap-3 rounded-[10px] px-3 py-2.5 transition-colors hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
    >
      <span className="min-w-0">
        <span className="block truncate font-mono text-[13px] leading-5">{title}</span>
        <span className="block truncate text-[12px] leading-[18px] text-[var(--text-muted)]">
          {description}
        </span>
      </span>
      <Icon name="caretRight" size={14} className="shrink-0 text-[var(--text-muted)]" />
    </a>
  );
}

function Card({
  title,
  icon,
  children,
  action,
}: {
  title: string;
  icon: IconName;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-[16px] border border-[var(--border)] bg-[var(--card-bg)] p-4 md:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon name={icon} size={16} />
          <h2 className="text-[14px] font-semibold leading-5">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function SystemStatusDashboard() {
  const [data, setData] = useState<SystemStatusApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      setData(await fetchSystemStatus());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to load system status.");
      if (!silent) setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useDeferredEffect(() => {
    void load();
  }, [load]);

  const apiBase = data?.api.publicUrl.replace(/\/$/, "") ?? "";
  const overallTone =
    data?.status === "healthy" ? "healthy" : data?.status === "degraded" ? "warning" : "failed";

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4 pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[18px] font-semibold leading-7 tracking-tight">System Status</h1>
          <p className="mt-1 text-[13px] leading-5 text-[var(--text-muted)]">
            API health, dependencies, cache versions, and background queues.
          </p>
        </div>
        <SecondaryButton
          type="button"
          className="w-full sm:w-auto"
          disabled={loading || refreshing}
          onClick={() => void load(true)}
        >
          <Icon name="history" size={14} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </SecondaryButton>
      </div>

      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-[rgb(255_71_71/0.25)] bg-[rgb(255_71_71/0.08)] px-4 py-3 text-[13px] text-[var(--bright-red)]">
          <span className="inline-flex items-start gap-2">
            <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
            {error}
          </span>
          <SecondaryButton type="button" onClick={() => void load()}>
            Try again
          </SecondaryButton>
        </div>
      ) : null}

      {loading && !data ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-[118px]" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
            <Skeleton className="h-52 lg:col-span-2" />
          </div>
        </>
      ) : null}

      {data ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatusCard
              icon="heartbeat"
              label="Overall status"
              value={data.status === "healthy" ? "Healthy" : "Degraded"}
              hint={`Last checked ${formatCheckedAt(data.checkedAt)}`}
              tone={overallTone}
            />
            <StatusCard
              icon="snowflake"
              label="MongoDB"
              value={data.dependencies.mongo.ok ? "Connected" : "Disconnected"}
              hint={
                data.dependencies.mongo.ok
                  ? `${data.dependencies.mongo.latencyMs} ms`
                  : data.dependencies.mongo.error || "Unable to reach MongoDB"
              }
              tone={data.dependencies.mongo.ok ? "healthy" : "failed"}
            />
            <StatusCard
              icon="broadcast"
              label="Redis"
              value={data.dependencies.redis.ok ? "Connected" : "Disconnected"}
              hint={
                data.dependencies.redis.ok
                  ? `${data.dependencies.redis.latencyMs} ms`
                  : data.dependencies.redis.error || "Unable to reach Redis"
              }
              tone={data.dependencies.redis.ok ? "healthy" : "failed"}
            />
            <StatusCard
              icon="clock"
              label="API uptime"
              value={formatUptime(data.api.uptimeSeconds)}
              hint={`${data.api.name} v${data.api.version} (${data.api.nodeEnv})`}
              tone="info"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Card
              title="Background jobs"
              icon="history"
              action={
                <Link
                  href={adminPath("/data/jobs")}
                  className="text-[12px] leading-[18px] text-[var(--bright-purple)] hover:underline"
                >
                  View job history
                </Link>
              }
            >
              <dl className="grid grid-cols-3 gap-2">
                <div className="rounded-[10px] bg-[var(--page-bg)] px-3 py-3 text-center">
                  <dt className="text-[12px] text-[var(--text-muted)]">Waiting</dt>
                  <dd className="mt-1 text-[20px] font-semibold leading-7">{data.queues.totals.waiting}</dd>
                </div>
                <div className="rounded-[10px] bg-[var(--page-bg)] px-3 py-3 text-center">
                  <dt className="text-[12px] text-[var(--text-muted)]">Active</dt>
                  <dd className="mt-1 text-[20px] font-semibold leading-7">{data.queues.totals.active}</dd>
                </div>
                <div className="rounded-[10px] bg-[var(--page-bg)] px-3 py-3 text-center">
                  <dt className="text-[12px] text-[var(--text-muted)]">Failed</dt>
                  <dd
                    className="mt-1 text-[20px] font-semibold leading-7"
                    style={{ color: data.queues.totals.failed ? "var(--bright-red)" : undefined }}
                  >
                    {data.queues.totals.failed}
                  </dd>
                </div>
              </dl>
            </Card>

            <Card title="Storage & cache" icon="file">
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-[12px] text-[var(--text-muted)]">Storage</dt>
                  <dd className="mt-0.5 break-all text-[13px] leading-5">
                    {data.storage.driver} — {data.storage.uploadRoot}
                  </dd>
                </div>
                <div>
                  <dt className="text-[12px] text-[var(--text-muted)]">Cache</dt>
                  <dd className="mt-0.5 inline-flex flex-wrap items-center gap-2 text-[13px] leading-5">
                    <span className="inline-flex items-center gap-1.5">
                      <StatusDot tone={data.cache.enabled ? "healthy" : "warning"} />
                      {data.cache.enabled ? "Enabled" : "Disabled"}
                    </span>
                    <span className="text-[var(--text-muted)]">TTL {data.cache.listTtlSeconds}s</span>
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-[12px] leading-[18px] text-[var(--text-muted)]">Cache versions</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(data.cache.versions).map(([key, version]) => (
                  <span
                    key={key}
                    className="inline-flex h-6 items-center rounded-full bg-[var(--page-bg)] px-2.5 text-[11px] leading-[18px]"
                  >
                    {key} v{version}
                  </span>
                ))}
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Card title="Developer tools & resources" icon="bug">
              <div className="-mx-1">
                <ResourceRow href={`${apiBase}/health`} title="GET /health" description="Health check endpoint" />
                <ResourceRow href={`${apiBase}/ready`} title="GET /ready" description="Readiness probe" />
                {data.features.metricsEnabled ? (
                  <ResourceRow
                    href={`${apiBase}${data.features.metricsPath}`}
                    title={`GET ${data.features.metricsPath}`}
                    description="Prometheus metrics (Bearer token in production)"
                  />
                ) : null}
                <ResourceRow
                  href={`${apiBase}${data.features.publicOpenApi}`}
                  title={`GET ${data.features.publicOpenApi}`}
                  description="OpenAPI specification"
                />
                {data.features.publicDocsUi ? (
                  <ResourceRow
                    href={`${apiBase}${data.features.publicDocsUi}`}
                    title="Public API docs UI"
                    description="Interactive public documentation"
                  />
                ) : null}
              </div>
            </Card>

            <Card title="Response metrics" icon="dashboard">
              <p className="text-[13px] leading-5 text-[var(--text-muted)]">
                Average latency, P95, request counts, and error rate are not returned as structured
                fields yet.
              </p>
              {data.features.metricsEnabled ? (
                <a
                  href={`${apiBase}${data.features.metricsPath}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex text-[12px] text-[var(--bright-purple)] hover:underline"
                >
                  Open Prometheus metrics
                </a>
              ) : (
                <p className="mt-3 text-[12px] text-[var(--text-muted)]">Metrics endpoint is disabled.</p>
              )}
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
