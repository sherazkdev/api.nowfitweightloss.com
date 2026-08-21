"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DataTable } from "@/components/ui/data-table";
import { ChallengeBadge, DifficultyBadge, GenderBadge, StatusBadge } from "@/components/ui/badges";
import { IdCell, NameCell } from "@/components/ui/cells";
import { EmptyState } from "@/components/ui/feedback";
import { DataActionBar } from "@/components/data/data-action-bar";
import { PrimaryLink } from "@/components/ui/buttons";
import { ApiError } from "@/lib/api-client";
import { adminPath } from "@/lib/admin-path";
import { useDeferredEffect } from "@/lib/use-deferred-effect";
import { deleteExercise, fetchExercisesAdmin } from "@/lib/exercises-api";
import { fetchWorkoutCategoriesAdmin } from "@/lib/workout-categories-api";
import { fetchWorkoutLevelsAdmin } from "@/lib/workout-levels-api";
import type { Exercise, WorkoutCategory, WorkoutLevel } from "@/lib/types";

export default function ExercisesPage() {
  const searchParams = useSearchParams();
  const [level, setLevel] = useState("all");
  const [category, setCategory] = useState("all");
  const [gender, setGender] = useState("all");
  const [challenge, setChallenge] = useState("all");
  const [rows, setRows] = useState<Exercise[]>([]);
  const [levels, setLevels] = useState<WorkoutLevel[]>([]);
  const [categories, setCategories] = useState<WorkoutCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const levelNameById = useMemo(
    () => new Map(levels.map((item) => [item.id, item.name])),
    [levels],
  );

  const loadRows = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const [exerciseData, levelData, categoryData] = await Promise.all([
        fetchExercisesAdmin(),
        fetchWorkoutLevelsAdmin(),
        fetchWorkoutCategoriesAdmin(),
      ]);
      setRows(exerciseData);
      setLevels(levelData);
      setCategories(categoryData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load exercises");
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useDeferredEffect(() => {
    void loadRows();
  }, [loadRows, searchParams]);

  const filteredRows = useMemo(
    () =>
      rows.filter((exercise) => {
        if (level !== "all" && !exercise.levelIds.includes(level)) return false;
        if (category !== "all" && !exercise.categoryIds.includes(category)) return false;
        if (gender !== "all" && exercise.gender !== gender) return false;
        if (challenge === "yes" && !exercise.challenge) return false;
        if (challenge === "no" && exercise.challenge) return false;
        return true;
      }),
    [rows, category, challenge, gender, level],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold leading-7 tracking-tight">Exercises</h1>
          <p className="text-[13px] text-[var(--text-muted)]">Manage workout exercises and their metadata.</p>
        </div>
        <div className="flex items-center gap-2">
          <DataActionBar
            variant="toolbar"
            resource="exercises"
            addHref="/admin/workout/exercises/new"
            addLabel="Add Exercise"
            refreshing={loading || refreshing}
            onRefresh={() => void loadRows(true)}
          />
        </div>
      </div>

      {error ? <p className="text-[13px] text-[var(--bright-red)]">{error}</p> : null}

      {!loading && filteredRows.length === 0 && !error ? (
        <EmptyState
          title="No exercises yet"
          description="Create an exercise or import JSON from Raw Upload."
          action={<PrimaryLink href="/admin/data/raw-upload?resource=exercises">Raw Upload</PrimaryLink>}
        />
      ) : (
        <div className="rounded-[16px] border border-[var(--border)] bg-[var(--card-bg)] p-2 sm:p-3">
        <DataTable
          title=""
          resourceLabel="Exercise"
          rows={filteredRows}
          loading={loading}
          getRowId={(row) => row.id}
          getRowName={(row) => row.title}
          addHref="/admin/workout/exercises/new"
          addLabel="Add Exercise"
          showAdd={false}
          editHref={(row) => adminPath(`/workout/exercises/${row.id}/edit`)}
          onDelete={async (row) => {
            await deleteExercise(row.id);
            await loadRows(true);
          }}
          filters={[
            {
              key: "level",
              label: "Workout Level",
              value: level,
              onChange: setLevel,
              options: [
                { value: "all", label: "All levels" },
                ...levels.map((item) => ({ value: item.id, label: item.name })),
              ],
            },
            {
              key: "category",
              label: "Workout Category",
              value: category,
              onChange: setCategory,
              options: [
                { value: "all", label: "All categories" },
                ...categories.map((item) => ({ value: item.id, label: item.name })),
              ],
            },
            {
              key: "gender",
              label: "Gender",
              value: gender,
              onChange: setGender,
              options: [
                { value: "all", label: "All genders" },
                { value: "male", label: "Male" },
                { value: "female", label: "Female" },
                { value: "both", label: "Both" },
              ],
            },
            {
              key: "challenge",
              label: "Challenge",
              value: challenge,
              onChange: setChallenge,
              options: [
                { value: "all", label: "All" },
                { value: "yes", label: "Challenge" },
                { value: "no", label: "Standard" },
              ],
            },
          ]}
          columns={[
            { key: "id", header: "ID", render: (row) => <IdCell value={`#${row.id}`} /> },
            { key: "title", header: "Exercise", render: (row) => <NameCell name={row.title} /> },
            {
              key: "level",
              header: "Level",
              render: (row) => levelNameById.get(row.levelIds[0] ?? "") ?? "—",
            },
            {
              key: "difficulty",
              header: "Difficulty",
              render: (row) => <DifficultyBadge difficulty={row.difficulty} />,
            },
            {
              key: "duration",
              header: "Duration",
              hideBelow: "lg",
              render: (row) => `${row.durationMin}–${row.durationMax} min`,
            },
            {
              key: "gender",
              header: "Gender",
              hideBelow: "xl",
              render: (row) => <GenderBadge gender={row.gender} />,
            },
            {
              key: "challenge",
              header: "Challenge",
              hideBelow: "xl",
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
