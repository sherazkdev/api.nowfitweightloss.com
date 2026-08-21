import type { NutritionRange } from "@weightloss/contracts";

function snakeCaseKey(key: string): string {
  return key
    .replace(/([A-Z])/g, "_$1")
    .replace(/-/g, "_")
    .toLowerCase();
}

export function toLegacySnake<T extends Record<string, unknown>>(value: T): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (key === "titleNormalized" || key === "slugNormalized" || key === "browseKeys") continue;
    output[snakeCaseKey(key)] = toLegacyValue(raw);
  }
  return output;
}

function toLegacyValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => toLegacyValue(item));
  if (typeof value === "object") return toLegacySnake(value as Record<string, unknown>);
  return value;
}

export function legacyNutrition(nutrition: NutritionRange) {
  return {
    calories_min: nutrition.caloriesMin,
    calories_max: nutrition.caloriesMax,
    protein_min: nutrition.proteinMin,
    protein_max: nutrition.proteinMax,
    carbs_min: nutrition.carbsMin,
    carbs_max: nutrition.carbsMax,
    fats_min: nutrition.fatsMin,
    fats_max: nutrition.fatsMax,
    fiber_min: nutrition.fiberMin,
    fiber_max: nutrition.fiberMax,
    sugar_min: nutrition.sugarMin,
    sugar_max: nutrition.sugarMax,
    sodium_min: nutrition.sodiumMin,
    sodium_max: nutrition.sodiumMax,
  };
}

export function legacyPaginated<T>(data: T, page: number, limit: number, total: number) {
  return {
    success: true as const,
    data,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export function legacySuccess<T>(data: T) {
  return { success: true as const, data };
}
