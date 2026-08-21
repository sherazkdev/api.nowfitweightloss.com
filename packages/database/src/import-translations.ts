import type {
  ExerciseCopy,
  Locale,
  LocaleMap,
  MealCopy,
  NamedCopy,
} from "@weightloss/contracts";
import { isLocale, mergeLocaleMaps, pruneTranslations } from "@weightloss/contracts";

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function nullableStr(value: unknown): string | null | undefined {
  if (value === null) return null;
  return str(value);
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed: unknown = JSON.parse(value);
      return asObject(parsed);
    } catch {
      return null;
    }
  }
  return asObject(value);
}

function readLocaleMap(raw: unknown): Record<string, unknown> | null {
  const object = parseJsonObject(raw);
  if (!object) return null;
  return object;
}

function namedOverlay(value: unknown): NamedCopy | null {
  const row = asObject(value);
  if (!row) return null;
  const name = str(row.name);
  const description = nullableStr(row.description);
  if (!name && description === undefined) return null;
  const copy: NamedCopy = {};
  if (name) copy.name = name;
  if (description !== undefined) copy.description = description;
  return copy;
}

function mealOverlay(value: unknown): Partial<MealCopy> | null {
  const row = asObject(value);
  if (!row) return null;
  const copy: Partial<MealCopy> = {};
  const title = str(row.title);
  if (title) copy.title = title;
  const shortTitle = nullableStr(row.shortTitle ?? row.short_title);
  if (shortTitle !== undefined) copy.shortTitle = shortTitle;
  const description = nullableStr(row.description);
  if (description !== undefined) copy.description = description;
  const servingSize = nullableStr(row.servingSize ?? row.serving_size);
  if (servingSize !== undefined) copy.servingSize = servingSize;
  const ingredientsRaw = row.ingredients;
  if (Array.isArray(ingredientsRaw)) {
    copy.ingredients = ingredientsRaw
      .map((item) => {
        const ingredient = asObject(item);
        const name = str(ingredient?.name);
        if (!name) return null;
        return { name, unit: nullableStr(ingredient?.unit) ?? null };
      })
      .filter((item): item is { name: string; unit: string | null } => Boolean(item));
  }
  const instructionsRaw = row.instructions;
  if (Array.isArray(instructionsRaw)) {
    copy.instructions = instructionsRaw
      .map((item) => {
        const step = asObject(item);
        const text = str(step?.text);
        return text ? { text } : null;
      })
      .filter((item): item is { text: string } => Boolean(item));
  }
  return Object.keys(copy).length > 0 ? copy : null;
}

function exerciseOverlay(value: unknown): Partial<ExerciseCopy> | null {
  const row = asObject(value);
  if (!row) return null;
  const copy: Partial<ExerciseCopy> = {};
  const title = str(row.title);
  if (title) copy.title = title;
  const shortDescription = nullableStr(row.shortDescription ?? row.short_description);
  if (shortDescription !== undefined) copy.shortDescription = shortDescription;
  const description = nullableStr(row.description);
  if (description !== undefined) copy.description = description;
  const parts = row.targetBodyParts ?? row.target_body_parts;
  if (Array.isArray(parts)) {
    copy.targetBodyParts = parts
      .map((item) => {
        const part = asObject(item);
        const name = str(part?.name);
        return name ? { name } : null;
      })
      .filter((item): item is { name: string } => Boolean(item));
  }
  const howToDo = row.howToDo ?? row.how_to_do;
  if (Array.isArray(howToDo)) {
    copy.howToDo = howToDo
      .map((item) => {
        const step = asObject(item);
        const text = str(step?.text);
        return text ? { text } : null;
      })
      .filter((item): item is { text: string } => Boolean(item));
  }
  if (Array.isArray(row.tips)) {
    copy.tips = row.tips
      .map((item) => {
        const tip = asObject(item);
        const text = str(tip?.tip);
        return text ? { tip: text } : null;
      })
      .filter((item): item is { tip: string } => Boolean(item));
  }
  const sections = row.levelSections ?? row.level_sections;
  if (Array.isArray(sections)) {
    copy.levelSections = sections.map((item) => {
      const section = asObject(item);
      return { notes: nullableStr(section?.notes) ?? null };
    });
  }
  return Object.keys(copy).length > 0 ? copy : null;
}

function mapLocales<T>(raw: unknown, overlay: (value: unknown) => T | null): LocaleMap<T> {
  const source = readLocaleMap(raw);
  if (!source) return {};
  const next: LocaleMap<T> = {};
  for (const [key, value] of Object.entries(source)) {
    const locale = key.trim().toLowerCase().split(/[-_]/)[0];
    if (!isLocale(locale)) continue;
    const copy = overlay(value);
    if (copy) next[locale] = copy;
  }
  return pruneTranslations(next);
}

export function sanitizeNamedTranslations(raw: unknown): LocaleMap<NamedCopy> {
  return mapLocales(raw, namedOverlay);
}

export function sanitizeMealTranslations(raw: unknown): LocaleMap<MealCopy> {
  return mapLocales(raw, (value) => mealOverlay(value) as MealCopy | null);
}

export function sanitizeExerciseTranslations(raw: unknown): LocaleMap<ExerciseCopy> {
  return mapLocales(raw, (value) => exerciseOverlay(value) as ExerciseCopy | null);
}

const NAMED_LOCALE_FIELDS = new Set(["name", "title", "description"]);
const MEAL_LOCALE_FIELDS = new Set(["title", "short_title", "description", "serving_size"]);
const EXERCISE_LOCALE_FIELDS = new Set(["title", "short_description", "description"]);

function localeColumnMatch(
  key: string,
  allowedFields: Set<string>,
): { field: string; locale: Locale } | null {
  const lastUnderscore = key.lastIndexOf("_");
  if (lastUnderscore <= 0) return null;
  const localePart = key.slice(lastUnderscore + 1);
  const field = key.slice(0, lastUnderscore);
  if (!isLocale(localePart) || localePart === "en") return null;
  if (!allowedFields.has(field)) return null;
  return { field, locale: localePart };
}

function assignNamedField(target: NamedCopy, field: string, value: string) {
  if (field === "name" || field === "title") target.name = value;
  if (field === "description") target.description = value;
}

function assignMealField(target: Partial<MealCopy>, field: string, value: string) {
  if (field === "title") target.title = value;
  if (field === "short_title") target.shortTitle = value;
  if (field === "description") target.description = value;
  if (field === "serving_size") target.servingSize = value;
}

function assignExerciseField(target: Partial<ExerciseCopy>, field: string, value: string) {
  if (field === "title") target.title = value;
  if (field === "short_description") target.shortDescription = value;
  if (field === "description") target.description = value;
}

function translationsFromColumns<T extends object>(
  row: Record<string, string>,
  allowedFields: Set<string>,
  assign: (target: T, field: string, value: string) => void,
): LocaleMap<T> {
  const next: LocaleMap<T> = {};
  for (const [key, raw] of Object.entries(row)) {
    const value = raw.trim();
    if (!value) continue;
    const match = localeColumnMatch(key, allowedFields);
    if (!match) continue;
    const current = (next[match.locale] ?? {}) as T;
    assign(current, match.field, value);
    next[match.locale] = current;
  }
  return pruneTranslations(next);
}

export function namedTranslationsFromCsvRow(row: Record<string, string>): LocaleMap<NamedCopy> {
  return mergeLocaleMaps(
    sanitizeNamedTranslations(row.translations),
    translationsFromColumns(row, NAMED_LOCALE_FIELDS, assignNamedField),
  );
}

export function mealTranslationsFromCsvRow(row: Record<string, string>): LocaleMap<MealCopy> {
  return mergeLocaleMaps(
    sanitizeMealTranslations(row.translations),
    translationsFromColumns(
      row,
      MEAL_LOCALE_FIELDS,
      assignMealField as (target: MealCopy, field: string, value: string) => void,
    ),
  );
}

export function exerciseTranslationsFromCsvRow(row: Record<string, string>): LocaleMap<ExerciseCopy> {
  return mergeLocaleMaps(
    sanitizeExerciseTranslations(row.translations),
    translationsFromColumns(
      row,
      EXERCISE_LOCALE_FIELDS,
      assignExerciseField as (target: ExerciseCopy, field: string, value: string) => void,
    ),
  );
}
