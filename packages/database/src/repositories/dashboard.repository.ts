import type { Db } from "mongodb";
import { COLLECTIONS } from "../collections.js";

export type DashboardChartSlice = {
  label: string;
  value: number;
  color?: string;
  emphasis?: boolean;
};

export type DashboardRecentItem = {
  id: number;
  title: string;
  updatedAt: string;
};

export type DashboardLinePoint = {
  month: string;
  current: number;
  previous: number;
};

export type DashboardData = {
  stats: {
    totalMeals: number;
    mealCategories: number;
    totalExercises: number;
    workoutLevels: number;
  };
  mealsByCategory: DashboardChartSlice[];
  exercisesByLevel: DashboardChartSlice[];
  contentByDifficulty: DashboardChartSlice[];
  contentByGender: DashboardChartSlice[];
  mealsTrend: DashboardLinePoint[];
  recentMeals: DashboardRecentItem[];
  recentExercises: DashboardRecentItem[];
};

const CHART_COLORS = [
  "var(--chart-blue)",
  "var(--chart-purple)",
  "var(--chart-orange)",
  "var(--chart-green)",
  "var(--bright-purple)",
];

function withColors(slices: DashboardChartSlice[]): DashboardChartSlice[] {
  return slices.map((slice, index) => ({
    ...slice,
    color: slice.color ?? CHART_COLORS[index % CHART_COLORS.length],
  }));
}

function toIso(value: Date | string | undefined): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) return value;
  return new Date(0).toISOString();
}

async function countByCategory(db: Db): Promise<DashboardChartSlice[]> {
  const grouped = await db
    .collection(COLLECTIONS.meals)
    .aggregate<{ _id: number; value: number }>([
      { $match: { isActive: true } },
      { $unwind: "$categoryIds" },
      { $group: { _id: "$categoryIds", value: { $sum: 1 } } },
      { $sort: { value: -1 } },
      { $limit: 8 },
    ])
    .toArray();

  if (grouped.length === 0) return [];

  const categoryIds = grouped.map((row) => row._id);
  const categories = await db
    .collection<{ id: number; name: string }>(COLLECTIONS.mealCategories)
    .find({ id: { $in: categoryIds } })
    .project({ id: 1, name: 1 })
    .toArray();
  const nameById = new Map(categories.map((item) => [item.id, item.name]));

  return grouped.map((row, index) => ({
    label: nameById.get(row._id) ?? `Category #${row._id}`,
    value: row.value,
    emphasis: index === 0,
  }));
}

async function countExercisesByLevel(db: Db): Promise<DashboardChartSlice[]> {
  const grouped = await db
    .collection(COLLECTIONS.exercises)
    .aggregate<{ _id: number; value: number }>([
      { $match: { isActive: true } },
      { $unwind: "$levelIds" },
      { $group: { _id: "$levelIds", value: { $sum: 1 } } },
      { $sort: { value: -1 } },
      { $limit: 8 },
    ])
    .toArray();

  if (grouped.length === 0) return [];

  const levelIds = grouped.map((row) => row._id);
  const levels = await db
    .collection<{ id: number; name: string }>(COLLECTIONS.workoutLevels)
    .find({ id: { $in: levelIds } })
    .project({ id: 1, name: 1 })
    .toArray();
  const nameById = new Map(levels.map((item) => [item.id, item.name]));

  return grouped.map((row) => ({
    label: nameById.get(row._id) ?? `Level #${row._id}`,
    value: row.value,
  }));
}

async function difficultyBreakdown(db: Db): Promise<DashboardChartSlice[]> {
  const [mealGroups, exerciseGroups] = await Promise.all([
    db
      .collection(COLLECTIONS.meals)
      .aggregate<{ _id: string; value: number }>([
        { $match: { isActive: true, difficulty: { $type: "string", $ne: "" } } },
        { $group: { _id: "$difficulty", value: { $sum: 1 } } },
      ])
      .toArray(),
    db
      .collection(COLLECTIONS.exercises)
      .aggregate<{ _id: string; value: number }>([
        { $match: { isActive: true, difficulty: { $type: "string", $ne: "" } } },
        { $group: { _id: "$difficulty", value: { $sum: 1 } } },
      ])
      .toArray(),
  ]);

  const totals = new Map<string, number>();
  for (const row of [...mealGroups, ...exerciseGroups]) {
    if (!row._id) continue;
    totals.set(row._id, (totals.get(row._id) ?? 0) + row.value);
  }

  return [...totals.entries()]
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));
}

async function genderBreakdown(db: Db): Promise<DashboardChartSlice[]> {
  const [mealGroups, exerciseGroups] = await Promise.all([
    db
      .collection(COLLECTIONS.meals)
      .aggregate<{ _id: string; value: number }>([
        { $match: { isActive: true, gender: { $type: "string", $ne: "" } } },
        { $group: { _id: "$gender", value: { $sum: 1 } } },
      ])
      .toArray(),
    db
      .collection(COLLECTIONS.exercises)
      .aggregate<{ _id: string; value: number }>([
        { $match: { isActive: true, gender: { $type: "string", $ne: "" } } },
        { $group: { _id: "$gender", value: { $sum: 1 } } },
      ])
      .toArray(),
  ]);

  const totals = new Map<string, number>();
  for (const row of [...mealGroups, ...exerciseGroups]) {
    if (!row._id) continue;
    totals.set(row._id, (totals.get(row._id) ?? 0) + row.value);
  }

  const labelMap: Record<string, string> = {
    male: "Male",
    female: "Female",
    both: "Both",
  };

  return [...totals.entries()]
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => ({
      label: labelMap[key] ?? key,
      value,
    }));
}

async function mealsTrend(db: Db): Promise<DashboardLinePoint[]> {
  const since = new Date();
  since.setMonth(since.getMonth() - 5);
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const currentRows = await db
    .collection(COLLECTIONS.meals)
    .aggregate<{ _id: string; value: number }>([
      { $match: { isActive: true, createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%b", date: "$createdAt" } },
          value: { $sum: 1 },
        },
      },
    ])
    .toArray();

  const previousSince = new Date(since);
  previousSince.setMonth(previousSince.getMonth() - 6);

  const previousRows = await db
    .collection(COLLECTIONS.meals)
    .aggregate<{ _id: string; value: number }>([
      {
        $match: {
          isActive: true,
          createdAt: { $gte: previousSince, $lt: since },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%b", date: "$createdAt" } },
          value: { $sum: 1 },
        },
      },
    ])
    .toArray();

  const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const currentMap = new Map(currentRows.map((row) => [row._id, row.value]));
  const previousMap = new Map(previousRows.map((row) => [row._id, row.value]));

  const months = [...new Set([...currentMap.keys(), ...previousMap.keys()])].sort(
    (a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b),
  );

  if (months.length === 0) return [];

  return months.map((month) => ({
    month,
    current: currentMap.get(month) ?? 0,
    previous: previousMap.get(month) ?? 0,
  }));
}

export async function getDashboardData(db: Db): Promise<DashboardData> {
  const [
    totalMeals,
    mealCategories,
    totalExercises,
    workoutLevels,
    mealsByCategory,
    exercisesByLevel,
    contentByDifficulty,
    contentByGender,
    mealsTrendData,
    recentMeals,
    recentExercises,
  ] = await Promise.all([
    db.collection(COLLECTIONS.meals).countDocuments(),
    db.collection(COLLECTIONS.mealCategories).countDocuments(),
    db.collection(COLLECTIONS.exercises).countDocuments(),
    db.collection(COLLECTIONS.workoutLevels).countDocuments(),
    countByCategory(db),
    countExercisesByLevel(db),
    difficultyBreakdown(db),
    genderBreakdown(db),
    mealsTrend(db),
    db
      .collection<{ id: number; title: string; updatedAt: Date }>(COLLECTIONS.meals)
      .find({})
      .project({ id: 1, title: 1, updatedAt: 1 })
      .sort({ updatedAt: -1 })
      .limit(5)
      .toArray(),
    db
      .collection<{ id: number; title: string; updatedAt: Date }>(COLLECTIONS.exercises)
      .find({})
      .project({ id: 1, title: 1, updatedAt: 1 })
      .sort({ updatedAt: -1 })
      .limit(5)
      .toArray(),
  ]);

  return {
    stats: {
      totalMeals,
      mealCategories,
      totalExercises,
      workoutLevels,
    },
    mealsByCategory,
    exercisesByLevel,
    contentByDifficulty: withColors(contentByDifficulty),
    contentByGender: withColors(contentByGender),
    mealsTrend: mealsTrendData,
    recentMeals: recentMeals.map((item) => ({
      id: item.id,
      title: item.title,
      updatedAt: toIso(item.updatedAt),
    })),
    recentExercises: recentExercises.map((item) => ({
      id: item.id,
      title: item.title,
      updatedAt: toIso(item.updatedAt),
    })),
  };
}
