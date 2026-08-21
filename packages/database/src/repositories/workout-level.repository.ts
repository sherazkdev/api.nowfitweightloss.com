import type { LocaleMap, NamedCopy, WorkoutLevelDocument } from "@weightloss/contracts";
import { withEnglishNamedCopy } from "@weightloss/contracts";
import { normalizeSlug } from "@weightloss/shared";
import type { Db } from "mongodb";
import { COLLECTIONS } from "../collections.js";
import { nextSequenceId } from "../counters.js";

export type WorkoutLevelWriteInput = {
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

export type WorkoutLevelListOptions = {
  activeOnly?: boolean;
};

export async function listWorkoutLevels(
  db: Db,
  options: WorkoutLevelListOptions = {},
): Promise<WorkoutLevelDocument[]> {
  const query: Record<string, unknown> = {};
  if (options.activeOnly) query.isActive = true;

  return db
    .collection<WorkoutLevelDocument>(COLLECTIONS.workoutLevels)
    .find(query)
    .sort({ sortOrder: 1, id: 1 })
    .toArray();
}

export async function findWorkoutLevelById(
  db: Db,
  id: number,
  options: WorkoutLevelListOptions = {},
): Promise<WorkoutLevelDocument | null> {
  const query: Record<string, unknown> = { id };
  if (options.activeOnly) query.isActive = true;
  return db.collection<WorkoutLevelDocument>(COLLECTIONS.workoutLevels).findOne(query);
}

export async function createWorkoutLevel(
  db: Db,
  input: WorkoutLevelWriteInput,
): Promise<WorkoutLevelDocument> {
  const now = new Date();
  const id = await nextSequenceId(db, "workoutLevels");
  const level: WorkoutLevelDocument = {
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

  await db.collection<WorkoutLevelDocument>(COLLECTIONS.workoutLevels).insertOne(level);
  return level;
}

export async function updateWorkoutLevel(
  db: Db,
  id: number,
  input: WorkoutLevelWriteInput,
): Promise<WorkoutLevelDocument | null> {
  const existing = await findWorkoutLevelById(db, id);
  if (!existing) return null;

  const level: WorkoutLevelDocument = {
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

  await db.collection<WorkoutLevelDocument>(COLLECTIONS.workoutLevels).replaceOne({ id }, level);
  return level;
}

export async function deleteWorkoutLevel(db: Db, id: number): Promise<boolean> {
  const result = await db.collection<WorkoutLevelDocument>(COLLECTIONS.workoutLevels).deleteOne({ id });
  return result.deletedCount === 1;
}
