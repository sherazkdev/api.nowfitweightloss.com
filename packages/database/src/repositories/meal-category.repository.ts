import type { LocaleMap, MealCategoryDocument, NamedCopy } from "@weightloss/contracts";
import { withEnglishNamedCopy } from "@weightloss/contracts";
import { normalizeSlug } from "@weightloss/shared";
import type { Db } from "mongodb";
import { COLLECTIONS } from "../collections.js";
import { nextSequenceId } from "../counters.js";

export type MealCategoryWriteInput = {
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  image?: string | null;
  imageKey?: string | null;
  sortOrder: number;
  isActive: boolean;
  translations?: LocaleMap<NamedCopy>;
};

export type MealCategoryListOptions = {
  activeOnly?: boolean;
};

export async function listMealCategories(
  db: Db,
  options: MealCategoryListOptions = {},
): Promise<MealCategoryDocument[]> {
  const query: Record<string, unknown> = {};
  if (options.activeOnly) query.isActive = true;

  return db
    .collection<MealCategoryDocument>(COLLECTIONS.mealCategories)
    .find(query)
    .sort({ sortOrder: 1, id: 1 })
    .toArray();
}

export async function findMealCategoryById(
  db: Db,
  id: number,
  options: MealCategoryListOptions = {},
): Promise<MealCategoryDocument | null> {
  const query: Record<string, unknown> = { id };
  if (options.activeOnly) query.isActive = true;
  return db.collection<MealCategoryDocument>(COLLECTIONS.mealCategories).findOne(query);
}

export async function createMealCategory(
  db: Db,
  input: MealCategoryWriteInput,
): Promise<MealCategoryDocument> {
  const now = new Date();
  const id = await nextSequenceId(db, "mealCategories");
  const category: MealCategoryDocument = {
    id,
    name: input.name.trim(),
    slug: input.slug.trim(),
    slugNormalized: normalizeSlug(input.slug),
    description: input.description ?? null,
    icon: input.icon ?? null,
    image: input.image ?? null,
    imageKey: input.imageKey ?? null,
    sortOrder: input.sortOrder,
    isActive: input.isActive,
    translations: withEnglishNamedCopy(input.name, input.description ?? null, input.translations),
    createdAt: now,
    updatedAt: now,
  };

  await db.collection<MealCategoryDocument>(COLLECTIONS.mealCategories).insertOne(category);
  return category;
}

export async function updateMealCategory(
  db: Db,
  id: number,
  input: MealCategoryWriteInput,
): Promise<MealCategoryDocument | null> {
  const existing = await findMealCategoryById(db, id);
  if (!existing) return null;

  const category: MealCategoryDocument = {
    ...existing,
    name: input.name.trim(),
    slug: input.slug.trim(),
    slugNormalized: normalizeSlug(input.slug),
    description: input.description ?? null,
    icon: input.icon ?? null,
    image: input.image ?? null,
    imageKey: input.imageKey ?? null,
    sortOrder: input.sortOrder,
    isActive: input.isActive,
    translations: withEnglishNamedCopy(input.name, input.description ?? null, input.translations),
    updatedAt: new Date(),
  };

  await db.collection<MealCategoryDocument>(COLLECTIONS.mealCategories).replaceOne({ id }, category);
  return category;
}

export async function deleteMealCategory(db: Db, id: number): Promise<boolean> {
  const result = await db.collection<MealCategoryDocument>(COLLECTIONS.mealCategories).deleteOne({ id });
  return result.deletedCount === 1;
}
