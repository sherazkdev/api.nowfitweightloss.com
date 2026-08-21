"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { DataTable } from "@/components/ui/data-table";
import { ChallengeBadge, DifficultyBadge, GenderBadge, Pill, StatusBadge } from "@/components/ui/badges";
import { IdCell } from "@/components/ui/cells";
import { EmptyState, StatCard, Thumb } from "@/components/ui/feedback";
import { DataActionBar } from "@/components/data/data-action-bar";
import { PrimaryLink } from "@/components/ui/buttons";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { ApiError } from "@/lib/api-client";
import { adminPath } from "@/lib/admin-path";
import { useDeferredEffect } from "@/lib/use-deferred-effect";
import {
  deleteMeal,
  fetchMealCategories,
  fetchMeals,
  mealDocumentToUi,
  type MealCategoryOption,
} from "@/lib/meals-api";
import type { Meal } from "@/lib/types";

function MealNameCell({ meal }: { meal: Meal }) {
  return (
    <div className="flex min-w-[180px] items-center gap-3">
      {meal.image ? (
        <span className="relative size-10 shrink-0 overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={meal.image} alt="" className="size-full object-cover" />
        </span>
      ) : (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-[var(--border)] bg-[var(--black-05)]">
          <Thumb label={meal.title} />
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium leading-5">{meal.title}</p>
        <p className="truncate text-[12px] leading-[18px] text-[var(--text-muted)]">
          {meal.shortTitle || meal.servingSize || `${meal.prepTimeMinutes} min prep`}
        </p>
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center rounded-full px-3 text-[12px] leading-[18px] transition-colors",
        active
          ? "bg-[var(--text-primary)] text-[var(--page-bg)]"
          : "bg-[var(--black-05)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]",
      )}
    >
      {label}
    </button>
  );
}

export default function MealsPage() {
  const [category, setCategory] = useState("all");
  const [gender, setGender] = useState("all");
  const [challenge, setChallenge] = useState("all");
  const [rows, setRows] = useState<Meal[]>([]);
  const [categories, setCategories] = useState<MealCategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadMeals = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const [mealData, categoryData] = await Promise.all([
        fetchMeals({ categoryId: category, gender, challenge }),
        fetchMealCategories(),
      ]);
      setRows(mealData.items.map(mealDocumentToUi));
      setCategories(categoryData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load meals");
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [category, challenge, gender]);

  useDeferredEffect(() => {
    void loadMeals();
  }, [loadMeals]);

  const categoryMap = useMemo(
    () => new Map(categories.map((item) => [item.id, item.name])),
    [categories],
  );

  const stats = useMemo(() => {
    const active = rows.filter((row) => row.active).length;
    const challengeCount = rows.filter((row) => row.challenge).length;
    return { total: rows.length, active, challenge: challengeCount };
  }, [rows]);

  const hasFilters = category !== "all" || gender !== "all" || challenge !== "all";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[18px] font-semibold leading-7 tracking-tight">Meals</h1>
          <p className="text-[13px] leading-5 text-[var(--text-muted)]">
            Manage meal recipes, nutrition, and categories.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DataActionBar
            variant="toolbar"
            resource="meals"
            addHref="/admin/meal/meals/new"
            addLabel="Add Meal"
            refreshing={loading || refreshing}
            onRefresh={() => void loadMeals(true)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Total meals" value={stats.total} hint="In current filter view" />
        <StatCard label="Active" value={stats.active} tone="green" hint="Visible to users" />
        <StatCard label="Challenge" value={stats.challenge} tone="orange" hint="Challenge meals" />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2.5">
        <span className="mr-1 text-[12px] text-[var(--text-muted)]">Quick filters</span>
        <FilterChip label="All genders" active={gender === "all"} onClick={() => setGender("all")} />
        <FilterChip label="Male" active={gender === "male"} onClick={() => setGender("male")} />
        <FilterChip label="Female" active={gender === "female"} onClick={() => setGender("female")} />
        <FilterChip label="Challenge" active={challenge === "yes"} onClick={() => setChallenge("yes")} />
        <FilterChip label="Standard" active={challenge === "no"} onClick={() => setChallenge("no")} />
        {hasFilters ? (
          <button
            type="button"
            className="ml-auto text-[12px] text-[var(--bright-purple)] hover:underline"
            onClick={() => {
              setCategory("all");
              setGender("all");
              setChallenge("all");
            }}
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-[12px] border border-[rgb(255_71_71/0.25)] bg-[rgb(255_71_71/0.08)] px-4 py-3 text-[13px] text-[var(--bright-red)]">
          <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {!loading && rows.length === 0 && !error ? (
        <div className="min-h-[280px] rounded-[16px] border border-[var(--border)] bg-[var(--card-bg)]">
          <EmptyState
            title={hasFilters ? "No meals match filters" : "No meals yet"}
            description={
              hasFilters
                ? "Clear filters to see all saved meals in the database."
                : "Create your first meal or import sample data from Raw Upload."
            }
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {hasFilters ? (
                  <button
                    type="button"
                    className="inline-flex h-8 items-center rounded-[8px] border border-[var(--border)] px-3 text-[14px] hover:bg-[var(--surface-hover)]"
                    onClick={() => {
                      setCategory("all");
                      setGender("all");
                      setChallenge("all");
                    }}
                  >
                    Clear filters
                  </button>
                ) : (
                  <PrimaryLink href="/admin/meal/meals/new">Add Meal</PrimaryLink>
                )}
                {!hasFilters ? (
                  <>
                    <Link
                      href="/admin/data/import-csv?resource=meals"
                      className="inline-flex h-8 items-center rounded-[8px] border border-[var(--border)] px-3 text-[14px] hover:bg-[var(--surface-hover)]"
                    >
                      Import CSV
                    </Link>
                    <Link
                      href="/admin/data/raw-upload?resource=meals"
                      className="inline-flex h-8 items-center rounded-[8px] border border-[var(--border)] px-3 text-[14px] hover:bg-[var(--surface-hover)]"
                    >
                      Raw Upload
                    </Link>
                  </>
                ) : null}
              </div>
            }
          />
        </div>
      ) : (
        <div className="rounded-[16px] border border-[var(--border)] bg-[var(--card-bg)] p-2 sm:p-3">
          <DataTable
            title=""
            resourceLabel="Meal"
            rows={rows}
            loading={loading}
            getRowId={(row) => row.id}
            getRowName={(row) => row.title}
            addHref="/admin/meal/meals/new"
            addLabel="Add Meal"
            showAdd={false}
            showReorder
            searchPlaceholder="Search meals"
            editHref={(row) => adminPath(`/meal/meals/${row.id}/edit`)}
            onDelete={async (row) => {
              await deleteMeal(row.id);
              await loadMeals(true);
            }}
            filters={[
              {
                key: "category",
                label: "Category",
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
              {
                key: "id",
                header: "ID",
                render: (row) => <IdCell value={`#${row.id}`} />,
              },
              {
                key: "title",
                header: "Meal",
                render: (row) => <MealNameCell meal={row} />,
              },
              {
                key: "categories",
                header: "Category",
                render: (row) => (
                  <Pill className="max-w-[120px] truncate">
                    {categoryMap.get(row.categoryIds[0] ?? "") ?? "—"}
                  </Pill>
                ),
              },
              {
                key: "calories",
                header: "Calories",
                render: (row) => (
                  <span className="inline-flex items-center gap-1 text-[12px]">
                    <Icon name="heartbeat" size={12} className="text-[var(--bright-red)]" />
                    {row.calories}–{row.caloriesMax}
                  </span>
                ),
              },
              {
                key: "difficulty",
                header: "Difficulty",
                hideBelow: "lg",
                render: (row) => <DifficultyBadge difficulty={row.difficulty} />,
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
