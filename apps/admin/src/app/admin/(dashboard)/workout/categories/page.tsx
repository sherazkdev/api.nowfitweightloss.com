"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DataTable } from "@/components/ui/data-table";
import { ChallengeBadge, GenderBadge, StatusBadge } from "@/components/ui/badges";
import { IdCell, NameCell } from "@/components/ui/cells";
import { EmptyState } from "@/components/ui/feedback";
import { DataActionBar } from "@/components/data/data-action-bar";
import { PrimaryLink } from "@/components/ui/buttons";
import { ApiError } from "@/lib/api-client";
import { adminPath } from "@/lib/admin-path";
import { useDeferredEffect } from "@/lib/use-deferred-effect";
import { deleteWorkoutCategory, fetchWorkoutCategoriesAdmin } from "@/lib/workout-categories-api";
import { fetchWorkoutLevelsAdmin } from "@/lib/workout-levels-api";
import type { WorkoutCategory, WorkoutLevel } from "@/lib/types";

export default function WorkoutCategoriesPage() {
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<WorkoutCategory[]>([]);
  const [levels, setLevels] = useState<WorkoutLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const levelNameById = useMemo(
    () => new Map(levels.map((level) => [level.id, level.name])),
    [levels],
  );

  const loadRows = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const [categoryData, levelData] = await Promise.all([
        fetchWorkoutCategoriesAdmin(),
        fetchWorkoutLevelsAdmin(),
      ]);
      setRows(categoryData);
      setLevels(levelData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load workout categories");
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
          <h1 className="text-[18px] font-semibold leading-7 tracking-tight">Workout Categories</h1>
          <p className="text-[13px] text-[var(--text-muted)]">Group exercises by focus area and level.</p>
        </div>
        <div className="flex items-center gap-2">
          <DataActionBar
            variant="toolbar"
            resource="workout-categories"
            addHref="/admin/workout/categories/new"
            addLabel="Add Category"
            refreshing={loading || refreshing}
            onRefresh={() => void loadRows(true)}
          />
        </div>
      </div>

      {error ? <p className="text-[13px] text-[var(--bright-red)]">{error}</p> : null}

      {!loading && rows.length === 0 && !error ? (
        <EmptyState
          title="No workout categories yet"
          description="Create a category or import JSON from Raw Upload."
          action={<PrimaryLink href="/admin/data/raw-upload?resource=workout-categories">Raw Upload</PrimaryLink>}
        />
      ) : (
        <div className="rounded-[16px] border border-[var(--border)] bg-[var(--card-bg)] p-2 sm:p-3">
        <DataTable
          title=""
          resourceLabel="Workout Category"
          rows={rows}
          loading={loading}
          getRowId={(row) => row.id}
          getRowName={(row) => row.name}
          addHref="/admin/workout/categories/new"
          addLabel="Add Category"
          showAdd={false}
          editHref={(row) => adminPath(`/workout/categories/${row.id}/edit`)}
          onDelete={async (row) => {
            await deleteWorkoutCategory(row.id);
            await loadRows(true);
          }}
          columns={[
            { key: "id", header: "ID", render: (row) => <IdCell value={`#${row.id}`} /> },
            { key: "name", header: "Category", render: (row) => <NameCell name={row.name} /> },
            {
              key: "levels",
              header: "Level",
              render: (row) => levelNameById.get(row.levelIds[0] ?? "") ?? "—",
            },
            { key: "gender", header: "Gender", render: (row) => <GenderBadge gender={row.gender} /> },
            {
              key: "challenge",
              header: "Challenge",
              hideBelow: "lg",
              render: (row) => <ChallengeBadge challenge={row.challenge} />,
            },
            { key: "status", header: "Status", render: (row) => <StatusBadge active={row.active} /> },
          ]}
        />
        </div>
      )}
    </div>
  );
}
