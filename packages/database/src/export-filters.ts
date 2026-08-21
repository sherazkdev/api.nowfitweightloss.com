import type { Gender } from "@weightloss/contracts";
import type { RawImportResource } from "./raw-import.js";

export type ExportScope = "all" | "active" | "inactive" | "challenge";

export type ExportFilters = {
  scope: ExportScope;
  gender: Gender | "all";
  categoryId: number | null;
  workoutLevelId: number | null;
  workoutCategoryId: number | null;
};

export const DEFAULT_EXPORT_FILTERS: ExportFilters = {
  scope: "all",
  gender: "all",
  categoryId: null,
  workoutLevelId: null,
  workoutCategoryId: null,
};

export function exportFiltersToQuery(resource: RawImportResource, filters: ExportFilters) {
  const query: Record<string, unknown> = {};

  if (filters.scope === "active") query.isActive = true;
  if (filters.scope === "inactive") query.isActive = false;
  if (filters.scope === "challenge") query.isChallenge = true;

  if (filters.gender !== "all") {
    query.gender = filters.gender;
  }

  if (resource === "meals" && filters.categoryId) {
    query.categoryId = filters.categoryId;
  }

  if (resource === "workout-categories" && filters.workoutLevelId) {
    query.levelId = filters.workoutLevelId;
  }

  if (resource === "exercises") {
    if (filters.workoutLevelId) query.levelId = filters.workoutLevelId;
    if (filters.workoutCategoryId) query.categoryId = filters.workoutCategoryId;
  }

  return query;
}

export function matchesExportFilters(
  resource: RawImportResource,
  item: {
    isActive?: boolean;
    isChallenge?: boolean;
    gender?: Gender;
    categoryIds?: number[];
    levelIds?: number[];
  },
  filters: ExportFilters,
): boolean {
  if (filters.scope === "active" && item.isActive === false) return false;
  if (filters.scope === "inactive" && item.isActive !== false) return false;
  if (filters.scope === "challenge" && !item.isChallenge) return false;

  if (filters.gender !== "all" && item.gender && item.gender !== "both" && item.gender !== filters.gender) {
    return false;
  }

  if (resource === "meals" && filters.categoryId) {
    if (!item.categoryIds?.includes(filters.categoryId)) return false;
  }

  if (resource === "workout-categories" && filters.workoutLevelId) {
    if (!item.levelIds?.includes(filters.workoutLevelId)) return false;
  }

  if (resource === "exercises") {
    if (filters.workoutLevelId && !item.levelIds?.includes(filters.workoutLevelId)) return false;
    if (filters.workoutCategoryId && !item.categoryIds?.includes(filters.workoutCategoryId)) return false;
  }

  return true;
}
