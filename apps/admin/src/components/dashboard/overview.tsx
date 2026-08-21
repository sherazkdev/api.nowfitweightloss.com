"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { DashboardCard } from "@/components/charts/dashboard-charts";
import {
  DashboardChartEmptyState,
  DashboardChartSkeleton,
} from "@/components/dashboard/chart-chrome";
import { DashboardApiKeys } from "@/components/dashboard/api-keys-panel";
import {
  DistributionDonut,
  ExercisesByLevelChart,
  MealsByCategoryChart,
  MealsCreatedChart,
} from "@/components/dashboard/recharts-charts";
import { SecondaryButton } from "@/components/ui/buttons";
import { ApiError } from "@/lib/api-client";
import { fetchDashboard, formatStatValue, type DashboardApiData } from "@/lib/dashboard-api";
import { adminPath } from "@/lib/admin-path";
import { useDeferredEffect } from "@/lib/use-deferred-effect";
import type { IconName } from "@/lib/icons";
import {
  categoryBars,
  hasPreviousTrend,
  levelBars,
  mealsCreatedSeries,
  withChartTones,
} from "@/lib/dashboard-chart-utils";

function AddLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="inline-flex h-8 items-center gap-1.5 rounded-[8px] bg-[var(--text-primary)] px-3 text-[13px] text-[var(--page-bg)]"
    >
      <Icon name="plus" size={14} />
      {children}
    </Link>
  );
}

function StatTile({
  href,
  icon,
  label,
  value,
}: {
  href: string;
  icon: IconName;
  label: string;
  value: string;
}) {
  return (
    <Link href={href} className="block min-w-0">
      <article className="wl-enter rounded-[16px] border border-[var(--border)] bg-[var(--card-bg)] px-3 py-3 transition-colors duration-150 hover:bg-[var(--surface-hover)] md:px-4">
        <span className="mb-2 flex size-7 items-center justify-center rounded-full bg-[var(--pastel-blue)] text-[var(--static-black)]">
          <Icon name={icon} size={14} />
        </span>
        <p className="text-[12px] leading-[18px] text-[var(--text-muted)]">{label}</p>
        <p className="mt-0.5 text-[20px] font-semibold leading-7 tracking-tight">{value}</p>
        <p className="mt-0.5 text-[12px] leading-[18px] text-[var(--text-muted)]">{value} total</p>
      </article>
    </Link>
  );
}

export function DashboardOverview() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<DashboardApiData | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setData(await fetchDashboard());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to load dashboard.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useDeferredEffect(() => {
    void load();
  }, []);

  const mealsSeries = useMemo(() => (data ? mealsCreatedSeries(data.mealsTrend) : []), [data]);
  const categoryData = useMemo(() => (data ? categoryBars(data.mealsByCategory) : []), [data]);
  const levelData = useMemo(() => (data ? levelBars(data.exercisesByLevel) : []), [data]);
  const genderItems = useMemo(() => (data ? withChartTones(data.contentByGender) : []), [data]);
  const difficultyItems = useMemo(
    () => (data ? withChartTones(data.contentByDifficulty) : []),
    [data],
  );
  const showPrevious = data ? hasPreviousTrend(data.mealsTrend) : false;

  if (loading && !data) {
    return (
      <div className="grid grid-cols-12 gap-3 pb-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <DashboardChartSkeleton key={index} className="col-span-6 h-[108px] xl:col-span-3" />
        ))}
        <DashboardChartSkeleton className="col-span-12 h-[280px] lg:col-span-6" />
        <DashboardChartSkeleton className="col-span-12 h-[280px] lg:col-span-6" />
        <DashboardChartSkeleton className="col-span-12 h-[240px] lg:col-span-6" />
        <DashboardChartSkeleton className="col-span-12 h-[220px] sm:col-span-6 lg:col-span-3" />
        <DashboardChartSkeleton className="col-span-12 h-[220px] sm:col-span-6 lg:col-span-3" />
        <DashboardChartSkeleton className="col-span-12 h-[160px]" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-3 pb-6">
      {error ? (
        <div className="col-span-12 flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-[rgb(255_71_71/0.25)] bg-[rgb(255_71_71/0.08)] px-4 py-3 text-[13px] text-[var(--bright-red)]">
          <span className="inline-flex items-start gap-2">
            <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
            {error}
          </span>
          <SecondaryButton type="button" onClick={() => void load()}>
            Try again
          </SecondaryButton>
        </div>
      ) : null}

      {data ? (
        <>
          <div className="col-span-6 xl:col-span-3">
            <StatTile
              href={adminPath("/meal/meals")}
              icon="meal"
              label="Total Meals"
              value={formatStatValue(data.stats.totalMeals)}
            />
          </div>
          <div className="col-span-6 xl:col-span-3">
            <StatTile
              href={adminPath("/meal/categories")}
              icon="mealCategory"
              label="Meal Categories"
              value={formatStatValue(data.stats.mealCategories)}
            />
          </div>
          <div className="col-span-6 xl:col-span-3">
            <StatTile
              href={adminPath("/workout/exercises")}
              icon="exercise"
              label="Total Exercises"
              value={formatStatValue(data.stats.totalExercises)}
            />
          </div>
          <div className="col-span-6 xl:col-span-3">
            <StatTile
              href={adminPath("/workout/levels")}
              icon="workoutLevel"
              label="Workout Levels"
              value={formatStatValue(data.stats.workoutLevels)}
            />
          </div>

          <div className="col-span-12 lg:col-span-6">
            <DashboardCard
              title="Meals created"
              extra={<span className="text-[12px] text-[var(--text-muted)]">Last 6 months</span>}
            >
              {mealsSeries.length > 0 ? (
                <div className="h-[220px] md:h-[260px]" role="img" aria-label="Meals created over the last 6 months">
                  <MealsCreatedChart data={mealsSeries} showPrevious={showPrevious} />
                </div>
              ) : (
                <DashboardChartEmptyState
                  icon={<Icon name="meal" size={18} />}
                  title="No meal activity yet"
                  description="Create your first meal to start seeing creation activity."
                  action={<AddLink href={adminPath("/meal/meals/new")}>Add Meal</AddLink>}
                />
              )}
            </DashboardCard>
          </div>

          <div className="col-span-12 lg:col-span-6">
            <DashboardCard
              title="Meals by category"
              extra={
                <Link
                  href={adminPath("/meal/categories")}
                  className="text-[12px] text-[var(--bright-purple)] hover:underline"
                >
                  View all
                </Link>
              }
            >
              {categoryData.length > 0 ? (
                <div className="min-h-[220px] md:min-h-[260px]">
                  <MealsByCategoryChart data={categoryData} />
                </div>
              ) : (
                <DashboardChartEmptyState
                  icon={<Icon name="mealCategory" size={18} />}
                  title="No category split yet"
                  description="Assign meals to categories to see this chart."
                  action={<AddLink href={adminPath("/meal/meals/new")}>Add Meal</AddLink>}
                />
              )}
            </DashboardCard>
          </div>

          <div className="col-span-12 lg:col-span-6">
            <DashboardCard title="Exercises by level">
              {levelData.length > 0 ? (
                <div className="h-[220px] md:h-[260px]" role="img" aria-label="Exercises grouped by workout level">
                  <ExercisesByLevelChart data={levelData} />
                </div>
              ) : (
                <DashboardChartEmptyState
                  icon={<Icon name="exercise" size={18} />}
                  title="No exercises available yet"
                  description="Add your first exercise to start tracking exercises by level."
                  action={<AddLink href={adminPath("/workout/exercises/new")}>Add an exercise</AddLink>}
                />
              )}
            </DashboardCard>
          </div>

          <div className="col-span-12 sm:col-span-6 lg:col-span-3">
            <DashboardCard title="By gender">
              {genderItems.length > 0 ? (
                <DistributionDonut data={genderItems} />
              ) : (
                <DashboardChartEmptyState title="No gender data" description="Gender split appears after meals or exercises are saved." />
              )}
            </DashboardCard>
          </div>

          <div className="col-span-12 sm:col-span-6 lg:col-span-3">
            <DashboardCard title="By difficulty">
              {difficultyItems.length > 0 ? (
                <DistributionDonut data={difficultyItems} />
              ) : (
                <DashboardChartEmptyState title="No difficulty data" description="Difficulty split appears after meals or exercises are saved." />
              )}
            </DashboardCard>
          </div>

          <div className="col-span-12">
            <DashboardApiKeys />
          </div>
        </>
      ) : null}
    </div>
  );
}
