import { apiGet } from "@/lib/api-client";

export type DashboardApiData = {
  stats: {
    totalMeals: number;
    mealCategories: number;
    totalExercises: number;
    workoutLevels: number;
  };
  mealsByCategory: Array<{ label: string; value: number; emphasis?: boolean }>;
  exercisesByLevel: Array<{ label: string; value: number }>;
  contentByDifficulty: Array<{ label: string; value: number; color?: string }>;
  contentByGender: Array<{ label: string; value: number; color?: string }>;
  mealsTrend: Array<{ month: string; current: number; previous: number }>;
  recentMeals: Array<{ id: number; title: string; updatedAt: string }>;
  recentExercises: Array<{ id: number; title: string; updatedAt: string }>;
};

export async function fetchDashboard(): Promise<DashboardApiData> {
  return apiGet<DashboardApiData>("/api/admin/dashboard");
}

export function formatStatValue(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function relativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
