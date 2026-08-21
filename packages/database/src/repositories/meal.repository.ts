import type {
  Gender,
  LocaleMap,
  MealCopy,
  MealDifficulty,
  MealDocument,
  MealIngredient,
  MealInstruction,
  NutritionRange,
} from "@weightloss/contracts";
import { withEnglishMealCopy } from "@weightloss/contracts";
import { normalizeSearchText } from "@weightloss/shared";
import type { Db } from "mongodb";
import { COLLECTIONS } from "../collections.js";
import { nextSequenceId } from "../counters.js";
import { userWeightMongoClause } from "../weight-filter.js";

export type MealListFilters = {
  categoryId?: number;
  gender?: Gender;
  isChallenge?: boolean;
  search?: string;
  activeOnly?: boolean;
  userWeight?: number;
  limit?: number;
  page?: number;
};

export type MealWriteInput = {
  categoryIds: number[];
  title: string;
  shortTitle?: string | null;
  description?: string | null;
  image?: string | null;
  imageKey?: string | null;
  nutrition: NutritionRange;
  minWeight: number;
  maxWeight: number;
  prepTimeMinutes: number;
  difficulty: MealDifficulty;
  servingSize?: string | null;
  gender: Gender;
  isChallenge: boolean;
  isActive: boolean;
  sortOrder: number;
  ingredients: MealIngredient[];
  instructions: MealInstruction[];
  translations?: LocaleMap<MealCopy>;
};

function mealCopyFromInput(input: MealWriteInput): MealCopy {
  return {
    title: input.title.trim(),
    shortTitle: input.shortTitle ?? null,
    description: input.description ?? null,
    servingSize: input.servingSize ?? null,
    ingredients: input.ingredients.map((item) => ({ name: item.name, unit: item.unit })),
    instructions: input.instructions.map((item) => ({ text: item.text })),
  };
}

function buildMealQuery(filters: MealListFilters): Record<string, unknown> {
  const query: Record<string, unknown> = {};

  if (filters.categoryId) {
    query.categoryIds = { $in: [filters.categoryId] };
  }
  if (filters.gender) {
    query.gender = filters.gender === "both" ? "both" : { $in: [filters.gender, "both"] };
  }
  if (typeof filters.isChallenge === "boolean") {
    query.isChallenge = filters.isChallenge;
  }
  if (filters.search?.trim()) {
    query.titleNormalized = {
      $regex: normalizeSearchText(filters.search.trim()),
      $options: "i",
    };
  }
  if (filters.activeOnly) query.isActive = true;
  if (typeof filters.userWeight === "number") {
    Object.assign(query, userWeightMongoClause(filters.userWeight));
  }

  return query;
}

export async function listMeals(
  db: Db,
  filters: MealListFilters = {},
): Promise<{ items: MealDocument[]; total: number }> {
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 200);
  const page = Math.max(filters.page ?? 1, 1);
  const skip = (page - 1) * limit;
  const query = buildMealQuery(filters);
  const collection = db.collection<MealDocument>(COLLECTIONS.meals);

  const [items, total] = await Promise.all([
    collection
      .find(query)
      .sort({ sortOrder: 1, id: 1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    collection.countDocuments(query),
  ]);

  return { items, total };
}

export async function findMealById(db: Db, id: number): Promise<MealDocument | null> {
  return db.collection<MealDocument>(COLLECTIONS.meals).findOne({ id });
}

export async function createMeal(db: Db, input: MealWriteInput): Promise<MealDocument> {
  const now = new Date();
  const id = await nextSequenceId(db, "meals");
  const meal: MealDocument = {
    id,
    categoryIds: input.categoryIds,
    title: input.title.trim(),
    titleNormalized: normalizeSearchText(input.title),
    shortTitle: input.shortTitle ?? null,
    description: input.description ?? null,
    image: input.image ?? null,
    imageKey: input.imageKey ?? null,
    nutrition: input.nutrition,
    minWeight: input.minWeight,
    maxWeight: input.maxWeight,
    prepTimeMinutes: input.prepTimeMinutes,
    difficulty: input.difficulty,
    servingSize: input.servingSize ?? null,
    gender: input.gender,
    isChallenge: input.isChallenge,
    isActive: input.isActive,
    sortOrder: input.sortOrder,
    ingredients: input.ingredients,
    instructions: input.instructions,
    translations: withEnglishMealCopy(mealCopyFromInput(input), input.translations),
    createdAt: now,
    updatedAt: now,
  };

  await db.collection<MealDocument>(COLLECTIONS.meals).insertOne(meal);
  return meal;
}

export async function updateMeal(
  db: Db,
  id: number,
  input: MealWriteInput,
): Promise<MealDocument | null> {
  const existing = await findMealById(db, id);
  if (!existing) return null;

  const now = new Date();
  const meal: MealDocument = {
    ...existing,
    categoryIds: input.categoryIds,
    title: input.title.trim(),
    titleNormalized: normalizeSearchText(input.title),
    shortTitle: input.shortTitle ?? null,
    description: input.description ?? null,
    image: input.image ?? null,
    imageKey: input.imageKey ?? null,
    nutrition: input.nutrition,
    minWeight: input.minWeight,
    maxWeight: input.maxWeight,
    prepTimeMinutes: input.prepTimeMinutes,
    difficulty: input.difficulty,
    servingSize: input.servingSize ?? null,
    gender: input.gender,
    isChallenge: input.isChallenge,
    isActive: input.isActive,
    sortOrder: input.sortOrder,
    ingredients: input.ingredients,
    instructions: input.instructions,
    translations: withEnglishMealCopy(mealCopyFromInput(input), input.translations),
    updatedAt: now,
  };

  await db.collection<MealDocument>(COLLECTIONS.meals).replaceOne({ id }, meal);
  return meal;
}

export async function deleteMeal(db: Db, id: number): Promise<boolean> {
  const result = await db.collection<MealDocument>(COLLECTIONS.meals).deleteOne({ id });
  return result.deletedCount === 1;
}
