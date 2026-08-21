"use client";

import { useCallback, useEffect, useState } from "react";
import { useDeferredEffect } from "@/lib/use-deferred-effect";
import Link from "next/link";
import { DataTable } from "@/components/ui/data-table";
import { IdCell, NameCell } from "@/components/ui/cells";
import { EmptyState } from "@/components/ui/feedback";
import { PrimaryLink, SecondaryButton } from "@/components/ui/buttons";
import { Icon } from "@/components/ui/icon";
import { ApiError } from "@/lib/api-client";
import { fetchJobs, jobDownloadUrl, type DataJobApi } from "@/lib/jobs-api";
import { getAccessToken } from "@/lib/auth-session";
import { getDataResource, type DataResourceId } from "@/lib/data-resources";

function JobStatusBadge({ status }: { status: DataJobApi["status"] }) {
  const tone =
    status === "completed"
      ? "text-[var(--status-active)]"
      : status === "failed"
        ? "text-[var(--bright-red)]"
        : "text-[var(--text-muted)]";
  return <span className={`text-[12px] capitalize leading-[18px] ${tone}`}>{status}</span>;
}

function resourceLabel(resource: string) {
  if ((["meal-categories", "meals", "workout-levels", "workout-categories", "exercises"] as string[]).includes(resource)) {
    return getDataResource(resource as DataResourceId).label;
  }
  return resource;
}

export default function DataJobsPage() {
  const [rows, setRows] = useState<DataJobApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadRows = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      setRows(await fetchJobs());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load jobs");
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useDeferredEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    const hasActive = rows.some(
      (row) => row.status === "queued" || row.status === "processing",
    );
    if (!hasActive) return;
    const timer = window.setInterval(() => {
      void loadRows(true);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [rows, loadRows]);

  async function downloadJob(job: DataJobApi) {
    const token = getAccessToken();
    if (!token) return;
    const response = await fetch(jobDownloadUrl(job.id), {
      credentials: "include",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `export-${job.resource}-${job.id}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold leading-7 tracking-tight">Import / Export Jobs</h1>
          <p className="text-[13px] text-[var(--text-muted)]">Background CSV and raw import job history.</p>
        </div>
        <div className="flex items-center gap-2">
          <SecondaryButton type="button" disabled={loading || refreshing} onClick={() => void loadRows(true)}>
            <Icon name="history" size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </SecondaryButton>
          <PrimaryLink href="/admin/data/import-csv">Import CSV</PrimaryLink>
        </div>
      </div>

      {error ? <p className="text-[13px] text-[var(--bright-red)]">{error}</p> : null}

      {!loading && rows.length === 0 && !error ? (
        <EmptyState title="No jobs yet" description="Run an import or export from Data Management." />
      ) : (
        <div className="rounded-[16px] border border-[var(--border)] bg-[var(--card-bg)] p-2 sm:p-3">
        <DataTable
          title=""
          resourceLabel="Job"
          rows={rows}
          loading={loading}
          getRowId={(row) => String(row.id)}
          getRowName={(row) => `#${row.id}`}
          showAdd={false}
          showRowActions={false}
          searchPlaceholder="Search jobs"
          columns={[
            { key: "id", header: "ID", render: (row) => <IdCell value={`#${row.id}`} /> },
            {
              key: "type",
              header: "Type",
              render: (row) => <NameCell name={row.type.toUpperCase()} />,
            },
            {
              key: "resource",
              header: "Resource",
              render: (row) => resourceLabel(row.resource),
            },
            {
              key: "status",
              header: "Status",
              render: (row) => <JobStatusBadge status={row.status} />,
            },
            {
              key: "progress",
              header: "Progress",
              render: (row) => `${row.progress}%`,
            },
            {
              key: "result",
              header: "Result",
              render: (row) => (
                <span className="text-[12px] leading-[18px] text-[var(--text-muted)]">
                  {row.successful} ok / {row.failed} failed
                </span>
              ),
            },
            {
              key: "actions",
              header: "Actions",
              render: (row) =>
                row.type === "export" && row.status === "completed" && row.resultFileKey ? (
                  <button
                    type="button"
                    className="text-[12px] leading-[18px] text-[var(--bright-purple)] hover:underline"
                    onClick={() => void downloadJob(row)}
                  >
                    Download
                  </button>
                ) : row.errorSummary ? (
                  <span className="text-[12px] text-[var(--bright-red)]">{row.errorSummary}</span>
                ) : (
                  "—"
                ),
            },
          ]}
        />
        </div>
      )}

      <p className="text-[12px] leading-[18px] text-[var(--text-muted)]">
        Quick links:{" "}
        <Link href="/admin/data/import-csv" className="text-[var(--bright-purple)] hover:underline">
          Import CSV
        </Link>
        {" · "}
        <Link href="/admin/data/export-csv" className="text-[var(--bright-purple)] hover:underline">
          Export CSV
        </Link>
        {" · "}
        <Link href="/admin/data/raw-upload" className="text-[var(--bright-purple)] hover:underline">
          Raw Upload
        </Link>
      </p>
    </div>
  );
}
