import type { Db } from "mongodb";
import { listExercises } from "./repositories/exercise.repository.js";
import { listMealCategories } from "./repositories/meal-category.repository.js";
import { listMeals } from "./repositories/meal.repository.js";
import { listWorkoutCategories } from "./repositories/workout-category.repository.js";
import { listWorkoutLevels } from "./repositories/workout-level.repository.js";
import type { ExportFilters } from "./export-filters.js";
import { DEFAULT_EXPORT_FILTERS, matchesExportFilters } from "./export-filters.js";
import type { RawImportResource } from "./raw-import.js";

export type ExportColumnDef = {
  key: string;
  label: string;
};

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

function activeLabel(value: boolean | undefined): string {
  return value ? "Active" : "Inactive";
}

function mealListFilters(filters: ExportFilters) {
  return {
    limit: 5000,
    activeOnly: filters.scope === "active" ? true : undefined,
    isChallenge: filters.scope === "challenge" ? true : undefined,
    gender: filters.gender === "all" ? undefined : filters.gender,
    categoryId: filters.categoryId ?? undefined,
  };
}

function exerciseListFilters(filters: ExportFilters) {
  return {
    limit: 5000,
    activeOnly: filters.scope === "active" ? true : undefined,
    isChallenge: filters.scope === "challenge" ? true : undefined,
    gender: filters.gender === "all" ? undefined : filters.gender,
    levelId: filters.workoutLevelId ?? undefined,
    categoryId: filters.workoutCategoryId ?? undefined,
  };
}

function workoutCategoryListFilters(filters: ExportFilters) {
  return {
    limit: 5000,
    activeOnly: filters.scope === "active" ? true : undefined,
    isChallenge: filters.scope === "challenge" ? true : undefined,
    gender: filters.gender === "all" ? undefined : filters.gender,
    levelId: filters.workoutLevelId ?? undefined,
  };
}

export async function countExportRecords(
  db: Db,
  resource: RawImportResource,
  filters: ExportFilters = DEFAULT_EXPORT_FILTERS,
): Promise<number> {
  const result = await exportResourceCsv(db, resource, [{ key: "id", label: "ID" }], filters);
  return result.total;
}

export async function exportResourceCsv(
  db: Db,
  resource: RawImportResource,
  columns: ExportColumnDef[],
  filters: ExportFilters = DEFAULT_EXPORT_FILTERS,
): Promise<{ headers: string[]; rows: string[][]; total: number }> {
  const headers = columns.map((column) => column.label);

  switch (resource) {
    case "meal-categories": {
      const items = (await listMealCategories(db)).filter((item) =>
        matchesExportFilters(resource, item, filters),
      );
      return {
        total: items.length,
        headers,
        rows: items.map((item) => mapMealCategoryRow(item, columns)),
      };
    }
    case "meals": {
      const [{ items }, categories] = await Promise.all([
        listMeals(db, mealListFilters(filters)),
        listMealCategories(db),
      ]);
      const filtered = items.filter((item) => matchesExportFilters(resource, item, filters));
      const categoryName = new Map(categories.map((item) => [item.id, item.name]));
      return {
        total: filtered.length,
        headers,
        rows: filtered.map((item) => mapMealRow(item, columns, categoryName)),
      };
    }
    case "workout-levels": {
      const items = (await listWorkoutLevels(db)).filter((item) =>
        matchesExportFilters(resource, item, filters),
      );
      return {
        total: items.length,
        headers,
        rows: items.map((item) => mapWorkoutLevelRow(item, columns)),
      };
    }
    case "workout-categories": {
      const [{ items }, levels] = await Promise.all([
        listWorkoutCategories(db, workoutCategoryListFilters(filters)),
        listWorkoutLevels(db),
      ]);
      const filtered = items.filter((item) => matchesExportFilters(resource, item, filters));
      const levelName = new Map(levels.map((item) => [item.id, item.name]));
      return {
        total: filtered.length,
        headers,
        rows: filtered.map((item) => mapWorkoutCategoryRow(item, columns, levelName)),
      };
    }
    case "exercises": {
      const [{ items }, levels, categories] = await Promise.all([
        listExercises(db, exerciseListFilters(filters)),
        listWorkoutLevels(db),
        listWorkoutCategories(db, { limit: 5000 }),
      ]);
      const filtered = items.filter((item) => matchesExportFilters(resource, item, filters));
      const levelName = new Map(levels.map((item) => [item.id, item.name]));
      const categoryName = new Map(categories.items.map((item) => [item.id, item.name]));
      return {
        total: filtered.length,
        headers,
        rows: filtered.map((item) => mapExerciseRow(item, columns, levelName, categoryName)),
      };
    }
    default:
      return { headers, rows: [], total: 0 };
  }
}

function mapMealCategoryRow(
  item: Awaited<ReturnType<typeof listMealCategories>>[number],
  columns: ExportColumnDef[],
) {
  return columns.map((column) => {
    switch (column.key) {
      case "id":
        return String(item.id);
      case "name":
        return item.name;
      case "slug":
        return item.slug;
      case "status":
        return activeLabel(item.isActive);
      case "sortOrder":
        return String(item.sortOrder);
      case "created":
        return formatDate(item.createdAt);
      default:
        return "";
    }
  });
}

function mapMealRow(
  item: Awaited<ReturnType<typeof listMeals>>["items"][number],
  columns: ExportColumnDef[],
  categoryName: Map<number, string>,
) {
  return columns.map((column) => {
    switch (column.key) {
      case "id":
        return String(item.id);
      case "title":
        return item.title;
      case "status":
        return activeLabel(item.isActive);
      case "gender":
        return item.gender;
      case "category":
        return categoryName.get(item.categoryIds[0] ?? -1) ?? "";
      case "calories":
        return `${item.nutrition.caloriesMin}-${item.nutrition.caloriesMax}`;
      case "difficulty":
        return item.difficulty;
      case "challenge":
        return item.isChallenge ? "Yes" : "No";
      case "created":
        return formatDate(item.createdAt);
      default:
        return "";
    }
  });
}

function mapWorkoutLevelRow(
  item: Awaited<ReturnType<typeof listWorkoutLevels>>[number],
  columns: ExportColumnDef[],
) {
  return columns.map((column) => {
    switch (column.key) {
      case "id":
        return String(item.id);
      case "name":
        return item.name;
      case "slug":
        return item.slug;
      case "status":
        return activeLabel(item.isActive);
      case "created":
        return formatDate(item.createdAt);
      default:
        return "";
    }
  });
}

function mapWorkoutCategoryRow(
  item: Awaited<ReturnType<typeof listWorkoutCategories>>["items"][number],
  columns: ExportColumnDef[],
  levelName: Map<number, string>,
) {
  return columns.map((column) => {
    switch (column.key) {
      case "id":
        return String(item.id);
      case "name":
        return item.name;
      case "status":
        return activeLabel(item.isActive);
      case "gender":
        return item.gender;
      case "level":
        return levelName.get(item.levelIds[0] ?? -1) ?? "";
      case "challenge":
        return item.isChallenge ? "Yes" : "No";
      case "created":
        return formatDate(item.createdAt);
      default:
        return "";
    }
  });
}

function mapExerciseRow(
  item: Awaited<ReturnType<typeof listExercises>>["items"][number],
  columns: ExportColumnDef[],
  levelName: Map<number, string>,
  categoryName: Map<number, string>,
) {
  return columns.map((column) => {
    switch (column.key) {
      case "id":
        return String(item.id);
      case "title":
        return item.title;
      case "status":
        return activeLabel(item.isActive);
      case "gender":
        return item.gender;
      case "level":
        return levelName.get(item.levelIds[0] ?? -1) ?? "";
      case "category":
        return categoryName.get(item.categoryIds[0] ?? -1) ?? "";
      case "difficulty":
        return item.difficulty;
      case "duration":
        return `${item.durationMin}-${item.durationMax}`;
      case "challenge":
        return item.isChallenge ? "Yes" : "No";
      case "created":
        return formatDate(item.createdAt);
      default:
        return "";
    }
  });
}
