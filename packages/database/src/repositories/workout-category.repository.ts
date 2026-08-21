import type { Gender, LocaleMap, NamedCopy, WorkoutCategoryDocument } from "@weightloss/contracts";
import { withEnglishNamedCopy } from "@weightloss/contracts";
import { normalizeSlug } from "@weightloss/shared";
import type { Db } from "mongodb";
import { COLLECTIONS } from "../collections.js";
import { nextSequenceId } from "../counters.js";

export type WorkoutCategoryListFilters = {
  activeOnly?: boolean;
  levelId?: number;
  gender?: Gender;
  isChallenge?: boolean;
  limit?: number;
  page?: number;
};

export type WorkoutCategoryWriteInput = {
  levelIds: number[];
  name: string;
  slug: string;
  description?: string | null;
  image?: string | null;
  imageKey?: string | null;
  gender: Gender;
  isChallenge: boolean;
  sortOrder: number;
  isActive: boolean;
  translations?: LocaleMap<NamedCopy>;
};

function buildWorkoutCategoryQuery(filters: WorkoutCategoryListFilters): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  if (filters.activeOnly) query.isActive = true;
  if (filters.levelId) query.levelIds = { $in: [filters.levelId] };
  if (filters.gender) {
    query.gender = filters.gender === "both" ? "both" : { $in: [filters.gender, "both"] };
  }
  if (typeof filters.isChallenge === "boolean") query.isChallenge = filters.isChallenge;
  return query;
}

export async function listWorkoutCategories(
  db: Db,
  filters: WorkoutCategoryListFilters = {},
): Promise<{ items: WorkoutCategoryDocument[]; total: number }> {
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 200);
  const page = Math.max(filters.page ?? 1, 1);
  const skip = (page - 1) * limit;
  const query = buildWorkoutCategoryQuery(filters);
  const collection = db.collection<WorkoutCategoryDocument>(COLLECTIONS.workoutCategories);

  const [items, total] = await Promise.all([
    collection.find(query).sort({ sortOrder: 1, id: 1 }).skip(skip).limit(limit).toArray(),
    collection.countDocuments(query),
  ]);

  return { items, total };
}

export async function findWorkoutCategoryById(
  db: Db,
  id: number,
  options: { activeOnly?: boolean } = {},
): Promise<WorkoutCategoryDocument | null> {
  const query: Record<string, unknown> = { id };
  if (options.activeOnly) query.isActive = true;
  return db.collection<WorkoutCategoryDocument>(COLLECTIONS.workoutCategories).findOne(query);
}

export async function createWorkoutCategory(
  db: Db,
  input: WorkoutCategoryWriteInput,
): Promise<WorkoutCategoryDocument> {
  const now = new Date();
  const id = await nextSequenceId(db, "workoutCategories");
  const category: WorkoutCategoryDocument = {
    id,
    levelIds: input.levelIds,
    name: input.name.trim(),
    slug: input.slug.trim(),
    slugNormalized: normalizeSlug(input.slug),
    description: input.description ?? null,
    image: input.image ?? null,
    imageKey: input.imageKey ?? null,
    gender: input.gender,
    isChallenge: input.isChallenge,
    sortOrder: input.sortOrder,
    isActive: input.isActive,
    translations: withEnglishNamedCopy(input.name, input.description ?? null, input.translations),
    createdAt: now,
    updatedAt: now,
  };

  await db.collection<WorkoutCategoryDocument>(COLLECTIONS.workoutCategories).insertOne(category);
  return category;
}

export async function updateWorkoutCategory(
  db: Db,
  id: number,
  input: WorkoutCategoryWriteInput,
): Promise<WorkoutCategoryDocument | null> {
  const existing = await findWorkoutCategoryById(db, id);
  if (!existing) return null;

  const category: WorkoutCategoryDocument = {
    ...existing,
    levelIds: input.levelIds,
    name: input.name.trim(),
    slug: input.slug.trim(),
    slugNormalized: normalizeSlug(input.slug),
    description: input.description ?? null,
    image: input.image ?? null,
    imageKey: input.imageKey ?? null,
    gender: input.gender,
    isChallenge: input.isChallenge,
    sortOrder: input.sortOrder,
    isActive: input.isActive,
    translations: withEnglishNamedCopy(input.name, input.description ?? null, input.translations),
    updatedAt: new Date(),
  };

  await db.collection<WorkoutCategoryDocument>(COLLECTIONS.workoutCategories).replaceOne({ id }, category);
  return category;
}

export async function deleteWorkoutCategory(db: Db, id: number): Promise<boolean> {
  const result = await db.collection<WorkoutCategoryDocument>(COLLECTIONS.workoutCategories).deleteOne({ id });
  return result.deletedCount === 1;
}
