"use client";

import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/badges";
import { IdCell, NameCell } from "@/components/ui/cells";
import { EmptyState } from "@/components/ui/feedback";
import { DataActionBar } from "@/components/data/data-action-bar";
import { PrimaryLink } from "@/components/ui/buttons";
import { ApiError } from "@/lib/api-client";
import { adminPath } from "@/lib/admin-path";
import { useDeferredEffect } from "@/lib/use-deferred-effect";
import { deleteWorkoutLevel, fetchWorkoutLevelsAdmin } from "@/lib/workout-levels-api";
import type { WorkoutLevel } from "@/lib/types";

export default function WorkoutLevelsPage() {
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<WorkoutLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadRows = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      setRows(await fetchWorkoutLevelsAdmin());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load workout levels");
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useDeferredEffect(() => {
    void loadRows();
  }, [loadRows, searchParams]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold leading-7 tracking-tight">Workout Levels</h1>
          <p className="text-[13px] text-[var(--text-muted)]">Define difficulty tiers for workout content.</p>
        </div>
        <div className="flex items-center gap-2">
          <DataActionBar
            variant="toolbar"
            resource="workout-levels"
            addHref="/admin/workout/levels/new"
            addLabel="Add Level"
            refreshing={loading || refreshing}
            onRefresh={() => void loadRows(true)}
          />
        </div>
      </div>

      {error ? <p className="text-[13px] text-[var(--bright-red)]">{error}</p> : null}

      {!loading && rows.length === 0 && !error ? (
        <EmptyState
          title="No workout levels yet"
          description="Create a level or import JSON from Raw Upload."
          action={<PrimaryLink href="/admin/data/raw-upload?resource=workout-levels">Raw Upload</PrimaryLink>}
        />
      ) : (
        <div className="rounded-[16px] border border-[var(--border)] bg-[var(--card-bg)] p-2 sm:p-3">
        <DataTable
          title=""
          resourceLabel="Workout Level"
          rows={rows}
          loading={loading}
          getRowId={(row) => row.id}
          getRowName={(row) => row.name}
          addHref="/admin/workout/levels/new"
          addLabel="Add Level"
          showAdd={false}
          editHref={(row) => adminPath(`/workout/levels/${row.id}/edit`)}
          onDelete={async (row) => {
            await deleteWorkoutLevel(row.id);
            await loadRows(true);
          }}
          columns={[
            { key: "id", header: "ID", render: (row) => <IdCell value={`#${row.id}`} /> },
            { key: "name", header: "Level", render: (row) => <NameCell name={row.name} /> },
            { key: "slug", header: "Slug", render: (row) => row.slug },
            { key: "sort", header: "Sort", render: (row) => row.sortOrder },
            { key: "status", header: "Status", render: (row) => <StatusBadge active={row.active} /> },
          ]}
        />
        </div>
      )}
    </div>
  );
}
