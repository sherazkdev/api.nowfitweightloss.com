export type CacheResource =
  | "mealCategories"
  | "meals"
  | "workoutLevels"
  | "workoutCategories"
  | "exercises"
  | "dashboard";

export const CACHE_VERSION_KEYS: Record<CacheResource, string> = {
  mealCategories: "cachever:mealCategories",
  meals: "cachever:meals",
  workoutLevels: "cachever:workoutLevels",
  workoutCategories: "cachever:workoutCategories",
  exercises: "cachever:exercises",
  dashboard: "cachever:dashboard",
};

export type RateLimitBucket = "public" | "admin" | "login" | "upload" | "import";

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
};

export type CacheLookupResult<T> = {
  value: T;
  hit: boolean;
  redisMs: number;
};
