import { csvRowsToObjects, normalizeCsvHeader, normalizeSlug } from "@weightloss/shared";
import type { RawImportResource } from "./raw-import.js";
import {
  exerciseTranslationsFromCsvRow,
  mealTranslationsFromCsvRow,
  namedTranslationsFromCsvRow,
} from "./import-translations.js";

function bool(value: string | undefined, fallback = false): boolean {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "active"].includes(normalized)) return true;
  if (["0", "false", "no", "inactive"].includes(normalized)) return false;
  return fallback;
}

function num(value: string | undefined, fallback = 0): number {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function ids(value: string | undefined): number[] {
  if (!value?.trim()) return [];
  return value
    .split(/[|;]/)
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isInteger(id) && id > 0);
}

function slugOf(row: Record<string, string>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = row[key]?.trim();
    if (value) return normalizeSlug(value);
  }
  return undefined;
}

function mapMealCategory(row: Record<string, string>) {
  return {
    id: num(row.id) || undefined,
    name: row.name || row.title,
    slug: slugOf(row, "slug", "name", "title"),
    description: row.description || null,
    sortOrder: num(row.sort_order),
    isActive: bool(row.is_active, true),
    image: row.image || null,
    translations: namedTranslationsFromCsvRow(row),
  };
}

function mapWorkoutLevel(row: Record<string, string>) {
  return {
    id: num(row.id) || undefined,
    name: row.name || row.title,
    slug: slugOf(row, "slug", "name", "title"),
    description: row.description || null,
    sortOrder: num(row.sort_order),
    isActive: bool(row.is_active, true),
    image: row.image || null,
    translations: namedTranslationsFromCsvRow(row),
  };
}

function mapWorkoutCategory(row: Record<string, string>) {
  return {
    id: num(row.id) || undefined,
    levelIds: ids(row.level_ids),
    name: row.name || row.title,
    slug: slugOf(row, "slug", "name", "title"),
    description: row.description || null,
    gender: row.gender || "both",
    isChallenge: bool(row.challenge),
    sortOrder: num(row.sort_order),
    isActive: bool(row.is_active, true),
    image: row.image || null,
    translations: namedTranslationsFromCsvRow(row),
  };
}

function mapMeal(row: Record<string, string>) {
  return {
    id: num(row.id) || undefined,
    categoryIds: ids(row.category_ids),
    title: row.title || row.name,
    slug: slugOf(row, "slug", "name", "title"),
    shortTitle: row.short_title || null,
    description: row.description || null,
    gender: row.gender || "both",
    isChallenge: bool(row.challenge),
    sortOrder: num(row.sort_order),
    isActive: bool(row.is_active, true),
    difficulty: row.difficulty || "Easy",
    prepTimeMinutes: num(row.prep_time_minutes),
    servingSize: row.serving_size || null,
    image: row.image || null,
    nutrition: {
      caloriesMin: num(row.calories_min),
      caloriesMax: num(row.calories_max),
      proteinMin: num(row.protein_min),
      proteinMax: num(row.protein_max),
      carbsMin: num(row.carbs_min),
      carbsMax: num(row.carbs_max),
      fatsMin: num(row.fats_min),
      fatsMax: num(row.fats_max),
      fiberMin: num(row.fiber_min),
      fiberMax: num(row.fiber_max),
      sugarMin: num(row.sugar_min),
      sugarMax: num(row.sugar_max),
      sodiumMin: num(row.sodium_min),
      sodiumMax: num(row.sodium_max),
    },
    translations: mealTranslationsFromCsvRow(row),
  };
}

function mapExercise(row: Record<string, string>) {
  return {
    id: num(row.id) || undefined,
    categoryIds: ids(row.category_ids),
    levelIds: ids(row.level_ids),
    title: row.title || row.name,
    slug: slugOf(row, "slug", "name", "title"),
    shortDescription: row.short_description || null,
    description: row.description || null,
    difficulty: row.difficulty || "Beginner",
    gender: row.gender || "both",
    isChallenge: bool(row.challenge),
    sortOrder: num(row.sort_order),
    isActive: bool(row.is_active, true),
    caloriesMin: num(row.calories_min),
    caloriesMax: num(row.calories_max),
    repsMin: num(row.reps_min),
    repsMax: num(row.reps_max),
    setsMin: num(row.sets_min),
    setsMax: num(row.sets_max),
    durationMin: num(row.duration_min),
    durationMax: num(row.duration_max),
    restTimeMin: num(row.rest_time_min),
    restTimeMax: num(row.rest_time_max),
    minWeight: num(row.min_weight),
    maxWeight: num(row.max_weight),
    image: row.image || null,
    videoUrl: row.video_url || null,
    translations: exerciseTranslationsFromCsvRow(row),
  };
}

export function csvToRawRecords(
  resource: RawImportResource,
  headers: string[],
  rows: string[][],
): unknown[] {
  const objects = csvRowsToObjects(headers, rows);

  switch (resource) {
    case "meal-categories":
      return objects.map(mapMealCategory);
    case "workout-levels":
      return objects.map(mapWorkoutLevel);
    case "workout-categories":
      return objects.map(mapWorkoutCategory);
    case "meals":
      return objects.map(mapMeal);
    case "exercises":
      return objects.map(mapExercise);
    default:
      return objects;
  }
}

export function validateCsvHeaders(resource: RawImportResource, headers: string[]): string | null {
  const normalized = headers.map(normalizeCsvHeader);
  const requiredByResource: Record<RawImportResource, string[]> = {
    "meal-categories": ["name"],
    meals: ["title"],
    "workout-levels": ["name"],
    "workout-categories": ["name"],
    exercises: ["title"],
  };

  const required = requiredByResource[resource] ?? ["name"];
  const missing = required.filter(
    (field) => !normalized.includes(field) && !(field === "name" && normalized.includes("title")),
  );
  if (missing.length > 0) {
    return `Missing required column(s): ${missing.join(", ")}`;
  }
  return null;
}

export function validateCsvRecord(resource: RawImportResource, record: unknown): string | null {
  const row = record as Record<string, unknown>;
  switch (resource) {
    case "meal-categories":
    case "workout-levels":
    case "workout-categories":
      if (!String(row.name ?? "").trim()) return "Name is required";
      return null;
    case "meals":
    case "exercises":
      if (!String(row.title ?? "").trim()) return "Title is required";
      return null;
    default:
      return null;
  }
}

export function filterCsvRecords(
  resource: RawImportResource,
  records: unknown[],
  skipInvalid: boolean,
): { valid: unknown[]; skipped: number } {
  if (!skipInvalid) {
    return { valid: records, skipped: 0 };
  }

  const valid: unknown[] = [];
  let skipped = 0;
  for (const record of records) {
    if (validateCsvRecord(resource, record)) {
      skipped += 1;
      continue;
    }
    valid.push(record);
  }
  return { valid, skipped };
}
