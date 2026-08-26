import type {
  ExerciseCopy,
  ExerciseDocument,
  LocaleMap,
  MealCategoryDocument,
  MealCopy,
  MealDocument,
  MealDifficulty,
  MealIngredient,
  MealInstruction,
  NamedCopy,
  NutritionRange,
  WorkoutCategoryDocument,
  WorkoutLevelDocument,
} from "@weightloss/contracts";
import {
  buildBrowseKeys,
  mergeLocaleMaps,
  withEnglishExerciseCopy,
  withEnglishMealCopy,
  withEnglishNamedCopy,
} from "@weightloss/contracts";
import { normalizeSearchText, normalizeSlug } from "@weightloss/shared";
import type { Db } from "mongodb";
import { COLLECTIONS, type CollectionName } from "./collections.js";
import { nextSequenceId, setSequenceFloor } from "./counters.js";
import {
  persistExerciseImportLocalizations,
  persistMealImportLocalizations,
  persistNamedImportLocalizations,
} from "./import-localize.js";
import {
  sanitizeExerciseTranslations,
  sanitizeMealTranslations,
  sanitizeNamedTranslations,
} from "./import-translations.js";

export type RawImportResource =
  | "meal-categories"
  | "meals"
  | "workout-levels"
  | "workout-categories"
  | "exercises";

export type RawImportError = {
  index: number;
  message: string;
};

export type RawImportResult = {
  inserted: number;
  updated: number;
  failed: number;
  errors: RawImportError[];
};

export type ImportRawRecordsOptions = {
  onLocalizeComplete?: () => Promise<void>;
};

type ResourceConfig = {
  collection: CollectionName;
  counter: import("@weightloss/contracts").CounterName;
};

const RESOURCE_CONFIG: Record<RawImportResource, ResourceConfig> = {
  "meal-categories": { collection: COLLECTIONS.mealCategories, counter: "mealCategories" },
  meals: { collection: COLLECTIONS.meals, counter: "meals" },
  "workout-levels": { collection: COLLECTIONS.workoutLevels, counter: "workoutLevels" },
  "workout-categories": { collection: COLLECTIONS.workoutCategories, counter: "workoutCategories" },
  exercises: { collection: COLLECTIONS.exercises, counter: "exercises" },
};

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function numArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is number => typeof item === "number" && Number.isInteger(item));
}

function nutrition(value: unknown): NutritionRange {
  const n = asObject(value);
  return {
    caloriesMin: num(n?.caloriesMin),
    caloriesMax: num(n?.caloriesMax),
    proteinMin: num(n?.proteinMin),
    proteinMax: num(n?.proteinMax),
    carbsMin: num(n?.carbsMin),
    carbsMax: num(n?.carbsMax),
    fatsMin: num(n?.fatsMin),
    fatsMax: num(n?.fatsMax),
    fiberMin: num(n?.fiberMin),
    fiberMax: num(n?.fiberMax),
    sugarMin: num(n?.sugarMin),
    sugarMax: num(n?.sugarMax),
    sodiumMin: num(n?.sodiumMin),
    sodiumMax: num(n?.sodiumMax),
  };
}

function mealDifficulty(value: unknown): MealDifficulty {
  if (value === "Easy" || value === "Medium" || value === "Hard") return value;
  return "Easy";
}

function gender(value: unknown): "male" | "female" | "both" {
  if (value === "male" || value === "female" || value === "both") return value;
  return "both";
}

type ExistingImport = {
  translations?: LocaleMap<NamedCopy | MealCopy | ExerciseCopy>;
  createdAt?: Date;
} | null;

function createdAtFor(existing: ExistingImport, input: Record<string, unknown>, now: Date): Date {
  if (existing?.createdAt instanceof Date) return existing.createdAt;
  return input.createdAt ? new Date(String(input.createdAt)) : now;
}

const LOCALIZE_CONCURRENCY = 4;

function enqueueLocalizations(
  tasks: Array<() => Promise<void>>,
  onComplete?: () => Promise<void>,
) {
  if (tasks.length === 0) {
    if (onComplete) void onComplete();
    return;
  }

  void (async () => {
    let next = 0;
    const workers = Array.from({ length: Math.min(LOCALIZE_CONCURRENCY, tasks.length) }, async () => {
      while (next < tasks.length) {
        const current = next;
        next += 1;
        await tasks[current]!();
      }
    });
    await Promise.all(workers);
    await onComplete?.();
  })();
}

function namedTranslationsFor(
  name: string,
  description: string | null,
  input: Record<string, unknown>,
  existing: ExistingImport,
): LocaleMap<NamedCopy> {
  return withEnglishNamedCopy(
    name,
    description,
    mergeLocaleMaps(
      existing?.translations as LocaleMap<NamedCopy> | undefined,
      sanitizeNamedTranslations(input.translations),
    ),
  );
}

function mealTranslationsFor(
  copy: MealCopy,
  input: Record<string, unknown>,
  existing: ExistingImport,
): LocaleMap<MealCopy> {
  return withEnglishMealCopy(
    copy,
    mergeLocaleMaps(
      existing?.translations as LocaleMap<MealCopy> | undefined,
      sanitizeMealTranslations(input.translations),
    ),
  );
}

function exerciseTranslationsFor(
  copy: ExerciseCopy,
  input: Record<string, unknown>,
  existing: ExistingImport,
): LocaleMap<ExerciseCopy> {
  return withEnglishExerciseCopy(
    copy,
    mergeLocaleMaps(
      existing?.translations as LocaleMap<ExerciseCopy> | undefined,
      sanitizeExerciseTranslations(input.translations),
    ),
  );
}

async function resolveId(
  db: Db,
  config: ResourceConfig,
  rawId: unknown,
): Promise<number> {
  if (typeof rawId === "number" && Number.isInteger(rawId) && rawId > 0) return rawId;
  return nextSequenceId(db, config.counter);
}

export async function importRawRecords(
  db: Db,
  resource: RawImportResource,
  records: unknown[],
  options?: ImportRawRecordsOptions,
): Promise<RawImportResult> {
  const config = RESOURCE_CONFIG[resource];
  const collection = db.collection(config.collection);
  const now = new Date();

  const result: RawImportResult = {
    inserted: 0,
    updated: 0,
    failed: 0,
    errors: [],
  };

  let maxId = 0;
  const localizeTasks: Array<() => Promise<void>> = [];

  for (let index = 0; index < records.length; index += 1) {
    const input = asObject(records[index]);
    if (!input) {
      result.failed += 1;
      result.errors.push({ index, message: "Record must be a JSON object" });
      continue;
    }

    try {
      const id = await resolveId(db, config, input.id);
      maxId = Math.max(maxId, id);
      const existing = (await collection.findOne(
        { id },
        { projection: { _id: 1, translations: 1, createdAt: 1 } },
      )) as ExistingImport;

      let doc: Record<string, unknown>;
      let localizeImported: (() => Promise<void>) | null = null;
      switch (resource) {
        case "meal-categories": {
          const name = str(input.name);
          const slug = str(input.slug);
          if (!name || !slug) throw new Error("name and slug are required");
          const description = str(input.description);
          const provided = sanitizeNamedTranslations(input.translations);
          const normalized: MealCategoryDocument = {
            id,
            name,
            slug,
            slugNormalized: normalizeSlug(slug),
            description,
            icon: str(input.icon),
            image: str(input.image),
            imageKey: str(input.imageKey),
            sortOrder: num(input.sortOrder),
            isActive: bool(input.isActive, true),
            translations: namedTranslationsFor(name, description, input, existing),
            createdAt: createdAtFor(existing, input, now),
            updatedAt: now,
          };
          doc = normalized;
          localizeImported = () =>
            persistNamedImportLocalizations(
              db,
              config.collection,
              id,
              { name, description },
              provided,
              existing?.translations as LocaleMap<NamedCopy> | undefined,
            );
          break;
        }
        case "workout-levels": {
          const name = str(input.name);
          const slug = str(input.slug);
          if (!name || !slug) throw new Error("name and slug are required");
          const description = str(input.description);
          const provided = sanitizeNamedTranslations(input.translations);
          const normalized: WorkoutLevelDocument = {
            id,
            name,
            slug,
            slugNormalized: normalizeSlug(slug),
            description,
            icon: str(input.icon),
            image: str(input.image),
            imageKey: str(input.imageKey),
            sortOrder: num(input.sortOrder),
            isActive: bool(input.isActive, true),
            translations: namedTranslationsFor(name, description, input, existing),
            createdAt: createdAtFor(existing, input, now),
            updatedAt: now,
          };
          doc = normalized;
          localizeImported = () =>
            persistNamedImportLocalizations(
              db,
              config.collection,
              id,
              { name, description },
              provided,
              existing?.translations as LocaleMap<NamedCopy> | undefined,
            );
          break;
        }
        case "workout-categories": {
          const name = str(input.name);
          const slug = str(input.slug);
          const levelIds = numArray(input.levelIds);
          if (!name || !slug || levelIds.length === 0) {
            throw new Error("name, slug, and levelIds are required");
          }
          const description = str(input.description);
          const provided = sanitizeNamedTranslations(input.translations);
          const normalized: WorkoutCategoryDocument = {
            id,
            levelIds,
            name,
            slug,
            slugNormalized: normalizeSlug(slug),
            description,
            image: str(input.image),
            imageKey: str(input.imageKey),
            gender: gender(input.gender),
            isChallenge: bool(input.isChallenge, false),
            sortOrder: num(input.sortOrder),
            isActive: bool(input.isActive, true),
            translations: namedTranslationsFor(name, description, input, existing),
            createdAt: createdAtFor(existing, input, now),
            updatedAt: now,
          };
          doc = normalized;
          localizeImported = () =>
            persistNamedImportLocalizations(
              db,
              config.collection,
              id,
              { name, description },
              provided,
              existing?.translations as LocaleMap<NamedCopy> | undefined,
            );
          break;
        }
        case "meals": {
          const title = str(input.title);
          const categoryIds = numArray(input.categoryIds);
          if (!title || categoryIds.length === 0) {
            throw new Error("title and categoryIds are required");
          }
          const ingredients = Array.isArray(input.ingredients)
            ? input.ingredients
                .map((item, sortOrder) => {
                  const row = asObject(item);
                  if (!row || !str(row.name)) return null;
                  return {
                    name: str(row.name)!,
                    quantity: str(row.quantity),
                    unit: str(row.unit),
                    sortOrder: num(row.sortOrder, sortOrder + 1),
                  } satisfies MealIngredient;
                })
                .filter(Boolean)
            : [];
          const instructions = Array.isArray(input.instructions)
            ? input.instructions
                .map((item) => {
                  const row = asObject(item);
                  if (!row || !str(row.text)) return null;
                  return {
                    step: num(row.step, 1),
                    text: str(row.text)!,
                  } satisfies MealInstruction;
                })
                .filter(Boolean)
            : [];
          const shortTitle = str(input.shortTitle);
          const description = str(input.description);
          const servingSize = str(input.servingSize);
          const mealIngredients = ingredients as MealIngredient[];
          const mealInstructions = instructions as MealInstruction[];
          const mealCopy: MealCopy = {
            title,
            shortTitle,
            description,
            servingSize,
            ingredients: mealIngredients.map((item) => ({ name: item.name, unit: item.unit })),
            instructions: mealInstructions.map((item) => ({ text: item.text })),
          };
          const providedMeal = sanitizeMealTranslations(input.translations);
          const normalized: MealDocument = {
            id,
            categoryIds,
            title,
            titleNormalized: normalizeSearchText(title),
            shortTitle,
            description,
            image: str(input.image),
            imageKey: str(input.imageKey),
            nutrition: nutrition(input.nutrition),
            minWeight: num(input.minWeight),
            maxWeight: num(input.maxWeight, 999),
            prepTimeMinutes: num(input.prepTimeMinutes),
            difficulty: mealDifficulty(input.difficulty),
            servingSize,
            gender: gender(input.gender),
            isChallenge: bool(input.isChallenge, false),
            isActive: bool(input.isActive, true),
            sortOrder: num(input.sortOrder),
            ingredients: mealIngredients,
            instructions: mealInstructions,
            translations: mealTranslationsFor(mealCopy, input, existing),
            createdAt: createdAtFor(existing, input, now),
            updatedAt: now,
          };
          doc = normalized;
          localizeImported = () =>
            persistMealImportLocalizations(
              db,
              config.collection,
              id,
              mealCopy,
              providedMeal,
              existing?.translations as LocaleMap<MealCopy> | undefined,
            );
          break;
        }
        case "exercises": {
          const title = str(input.title);
          const slug = str(input.slug);
          const levelIds = numArray(input.levelIds);
          const categoryIds = numArray(input.categoryIds);
          if (!title || !slug || levelIds.length === 0) {
            throw new Error("title, slug, and levelIds are required");
          }
          const shortDescription = str(input.shortDescription);
          const description = str(input.description);
          const targetBodyParts = Array.isArray(input.targetBodyParts)
            ? (input.targetBodyParts as ExerciseDocument["targetBodyParts"])
            : [];
          const howToDo = Array.isArray(input.howToDo)
            ? (input.howToDo as ExerciseDocument["howToDo"])
            : [];
          const tips = Array.isArray(input.tips) ? (input.tips as ExerciseDocument["tips"]) : [];
          const levelSections = Array.isArray(input.levelSections)
            ? (input.levelSections as ExerciseDocument["levelSections"])
            : [];
          const exerciseCopy: ExerciseCopy = {
            title,
            shortDescription,
            description,
            targetBodyParts: targetBodyParts.map((item) => ({ name: item.name })),
            howToDo: howToDo.map((item) => ({ text: item.text })),
            tips: tips.map((item) => ({ tip: item.tip })),
            levelSections: levelSections.map((item) => ({ notes: item.notes })),
          };
          const providedExercise = sanitizeExerciseTranslations(input.translations);
          const normalized: ExerciseDocument = {
            id,
            categoryIds,
            levelIds,
            browseKeys: buildBrowseKeys(levelIds, categoryIds),
            title,
            titleNormalized: normalizeSearchText(title),
            slug,
            slugNormalized: normalizeSlug(slug),
            shortDescription,
            description,
            image: str(input.image),
            imageKey: str(input.imageKey),
            videoUrl: str(input.videoUrl),
            videoKey: str(input.videoKey),
            animationUrl: str(input.animationUrl),
            animationKey: str(input.animationKey),
            difficulty:
              input.difficulty === "Beginner" ||
              input.difficulty === "Intermediate" ||
              input.difficulty === "Advanced"
                ? input.difficulty
                : "Beginner",
            caloriesMin: num(input.caloriesMin),
            caloriesMax: num(input.caloriesMax),
            repsMin: num(input.repsMin),
            repsMax: num(input.repsMax),
            setsMin: num(input.setsMin),
            setsMax: num(input.setsMax),
            durationMin: num(input.durationMin),
            durationMax: num(input.durationMax),
            restTimeMin: num(input.restTimeMin),
            restTimeMax: num(input.restTimeMax),
            minWeight: num(input.minWeight),
            maxWeight: num(input.maxWeight, 999),
            gender: gender(input.gender),
            isChallenge: bool(input.isChallenge, false),
            sortOrder: num(input.sortOrder),
            isActive: bool(input.isActive, true),
            targetBodyParts,
            howToDo,
            tips,
            levelSections,
            translations: exerciseTranslationsFor(exerciseCopy, input, existing),
            createdAt: createdAtFor(existing, input, now),
            updatedAt: now,
          };
          doc = normalized;
          localizeImported = () =>
            persistExerciseImportLocalizations(
              db,
              config.collection,
              id,
              exerciseCopy,
              providedExercise,
              existing?.translations as LocaleMap<ExerciseCopy> | undefined,
            );
          break;
        }
        default:
          throw new Error("Unsupported resource");
      }

      const writeResult = await collection.replaceOne({ id }, doc, { upsert: true });

      if (existing) {
        result.updated += 1;
      } else if (writeResult.upsertedCount > 0) {
        result.inserted += 1;
      } else {
        result.updated += 1;
      }

      if (localizeImported) {
        localizeTasks.push(localizeImported);
      }
    } catch (error) {
      result.failed += 1;
      result.errors.push({
        index,
        message: error instanceof Error ? error.message : "Import failed",
      });
    }
  }

  if (maxId > 0) {
    await setSequenceFloor(db, config.counter, maxId);
  }

  enqueueLocalizations(localizeTasks, options?.onLocalizeComplete);

  return result;
}

export function extractRawRecords(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed;
  const record = asObject(parsed);
  if (!record) return null;
  if (Array.isArray(record.records)) return record.records;
  if (Array.isArray(record.data)) return record.data;
  if (Array.isArray(record.items)) return record.items;
  return null;
}
