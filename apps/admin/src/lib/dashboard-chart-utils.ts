import type { DashboardApiData } from "@/lib/dashboard-api";

const CHART_TONES = [
  "var(--chart-blue)",
  "var(--chart-purple)",
  "var(--chart-orange)",
  "var(--chart-green)",
  "var(--bright-purple)",
];

export function withChartTones<T extends { label: string; value: number; color?: string }>(items: T[]) {
  return items.map((item, index) => ({
    ...item,
    color: item.color ?? CHART_TONES[index % CHART_TONES.length],
  }));
}

export function calculatePercentage(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

export function sliceTotal(items: Array<{ value: number }>) {
  return items.reduce((sum, item) => sum + item.value, 0);
}

export function mealsCreatedSeries(trend: DashboardApiData["mealsTrend"]) {
  return trend.map((item) => ({
    date: item.month,
    count: item.current,
    previous: item.previous,
  }));
}

export function hasPreviousTrend(trend: DashboardApiData["mealsTrend"]) {
  return trend.some((item) => item.previous > 0);
}

export function categoryBars(items: DashboardApiData["mealsByCategory"]) {
  return [...items]
    .sort((a, b) => b.value - a.value)
    .map((item) => ({
      category: item.label,
      meals: item.value,
    }));
}

export function levelBars(items: DashboardApiData["exercisesByLevel"]) {
  return [...items]
    .sort((a, b) => b.value - a.value)
    .map((item) => ({
      level: item.label,
      exercises: item.value,
    }));
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}
