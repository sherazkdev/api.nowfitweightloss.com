import type { CacheResource } from "@weightloss/cache";
import type { RawImportResource } from "@weightloss/database";

const CACHE_MAP: Record<RawImportResource, CacheResource> = {
  "meal-categories": "mealCategories",
  meals: "meals",
  "workout-levels": "workoutLevels",
  "workout-categories": "workoutCategories",
  exercises: "exercises",
};

export function cacheResourcesForImport(resource: RawImportResource): CacheResource[] {
  return [...new Set<CacheResource>([CACHE_MAP[resource], "dashboard"])];
}
