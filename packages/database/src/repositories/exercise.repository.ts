import type {
  ExerciseCopy,
  ExerciseDifficulty,
  ExerciseDocument,
  ExerciseHowToStep,
  ExerciseLevelSection,
  ExerciseTargetBodyPart,
  ExerciseTip,
  Gender,
  LocaleMap,
} from "@weightloss/contracts";
import { buildBrowseKeys, withEnglishExerciseCopy } from "@weightloss/contracts";
import { normalizeSearchText, normalizeSlug } from "@weightloss/shared";
import type { Db } from "mongodb";
import { COLLECTIONS } from "../collections.js";
import { nextSequenceId } from "../counters.js";
import { userWeightMongoClause } from "../weight-filter.js";

export type ExerciseListFilters = {
  activeOnly?: boolean;
  categoryId?: number;
  levelId?: number;
  browseKey?: string;
  gender?: Gender;
  isChallenge?: boolean;
  minWeight?: number;
  maxWeight?: number;
  userWeight?: number;
  search?: string;
  limit?: number;
  page?: number;
};

export type ExerciseWriteInput = {
  categoryIds: number[];
  levelIds: number[];
  title: string;
  slug: string;
  shortDescription?: string | null;
  description?: string | null;
  image?: string | null;
  imageKey?: string | null;
  videoUrl?: string | null;
  videoKey?: string | null;
  animationUrl?: string | null;
  animationKey?: string | null;
  difficulty: ExerciseDifficulty;
  caloriesMin: number;
  caloriesMax: number;
  repsMin: number;
  repsMax: number;
  setsMin: number;
  setsMax: number;
  durationMin: number;
  durationMax: number;
  restTimeMin: number;
  restTimeMax: number;
  minWeight: number;
  maxWeight: number;
  gender: Gender;
  isChallenge: boolean;
  sortOrder: number;
  isActive: boolean;
  targetBodyParts: ExerciseTargetBodyPart[];
  howToDo: ExerciseHowToStep[];
  tips: ExerciseTip[];
  levelSections: ExerciseLevelSection[];
  translations?: LocaleMap<ExerciseCopy>;
};

function exerciseCopyFromInput(input: ExerciseWriteInput): ExerciseCopy {
  return {
    title: input.title.trim(),
    shortDescription: input.shortDescription ?? null,
    description: input.description ?? null,
    targetBodyParts: input.targetBodyParts.map((item) => ({ name: item.name })),
    howToDo: input.howToDo.map((item) => ({ text: item.text })),
    tips: input.tips.map((item) => ({ tip: item.tip })),
    levelSections: input.levelSections.map((item) => ({ notes: item.notes })),
  };
}

function buildExerciseQuery(filters: ExerciseListFilters): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  if (filters.activeOnly) query.isActive = true;
  if (filters.categoryId) query.categoryIds = { $in: [filters.categoryId] };
  if (filters.levelId) query.levelIds = { $in: [filters.levelId] };
  if (filters.browseKey?.trim()) query.browseKeys = filters.browseKey.trim();
  if (filters.gender) {
    query.gender = filters.gender === "both" ? "both" : { $in: [filters.gender, "both"] };
  }
  if (typeof filters.isChallenge === "boolean") query.isChallenge = filters.isChallenge;
  if (typeof filters.userWeight === "number") {
    Object.assign(query, userWeightMongoClause(filters.userWeight));
  }
  if (filters.search?.trim()) {
    query.titleNormalized = {
      $regex: normalizeSearchText(filters.search.trim()),
      $options: "i",
    };
  }
  return query;
}

export async function listExercises(
  db: Db,
  filters: ExerciseListFilters = {},
): Promise<{ items: ExerciseDocument[]; total: number }> {
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 200);
  const page = Math.max(filters.page ?? 1, 1);
  const skip = (page - 1) * limit;
  const query = buildExerciseQuery(filters);
  const collection = db.collection<ExerciseDocument>(COLLECTIONS.exercises);

  const [items, total] = await Promise.all([
    collection.find(query).sort({ sortOrder: 1, id: 1 }).skip(skip).limit(limit).toArray(),
    collection.countDocuments(query),
  ]);

  return { items, total };
}

export async function findExerciseById(
  db: Db,
  id: number,
  options: { activeOnly?: boolean } = {},
): Promise<ExerciseDocument | null> {
  const query: Record<string, unknown> = { id };
  if (options.activeOnly) query.isActive = true;
  return db.collection<ExerciseDocument>(COLLECTIONS.exercises).findOne(query);
}

export async function createExercise(db: Db, input: ExerciseWriteInput): Promise<ExerciseDocument> {
  const now = new Date();
  const id = await nextSequenceId(db, "exercises");
  const exercise: ExerciseDocument = {
    id,
    categoryIds: input.categoryIds,
    levelIds: input.levelIds,
    browseKeys: buildBrowseKeys(input.levelIds, input.categoryIds),
    title: input.title.trim(),
    titleNormalized: normalizeSearchText(input.title),
    slug: input.slug.trim(),
    slugNormalized: normalizeSlug(input.slug),
    shortDescription: input.shortDescription ?? null,
    description: input.description ?? null,
    image: input.image ?? null,
    imageKey: input.imageKey ?? null,
    videoUrl: input.videoUrl ?? null,
    videoKey: input.videoKey ?? null,
    animationUrl: input.animationUrl ?? null,
    animationKey: input.animationKey ?? null,
    difficulty: input.difficulty,
    caloriesMin: input.caloriesMin,
    caloriesMax: input.caloriesMax,
    repsMin: input.repsMin,
    repsMax: input.repsMax,
    setsMin: input.setsMin,
    setsMax: input.setsMax,
    durationMin: input.durationMin,
    durationMax: input.durationMax,
    restTimeMin: input.restTimeMin,
    restTimeMax: input.restTimeMax,
    minWeight: input.minWeight,
    maxWeight: input.maxWeight,
    gender: input.gender,
    isChallenge: input.isChallenge,
    sortOrder: input.sortOrder,
    isActive: input.isActive,
    targetBodyParts: input.targetBodyParts,
    howToDo: input.howToDo,
    tips: input.tips,
    levelSections: input.levelSections,
    translations: withEnglishExerciseCopy(exerciseCopyFromInput(input), input.translations),
    createdAt: now,
    updatedAt: now,
  };

  await db.collection<ExerciseDocument>(COLLECTIONS.exercises).insertOne(exercise);
  return exercise;
}

export async function updateExercise(
  db: Db,
  id: number,
  input: ExerciseWriteInput,
): Promise<ExerciseDocument | null> {
  const existing = await findExerciseById(db, id);
  if (!existing) return null;

  const exercise: ExerciseDocument = {
    ...existing,
    categoryIds: input.categoryIds,
    levelIds: input.levelIds,
    browseKeys: buildBrowseKeys(input.levelIds, input.categoryIds),
    title: input.title.trim(),
    titleNormalized: normalizeSearchText(input.title),
    slug: input.slug.trim(),
    slugNormalized: normalizeSlug(input.slug),
    shortDescription: input.shortDescription ?? null,
    description: input.description ?? null,
    image: input.image ?? null,
    imageKey: input.imageKey ?? null,
    videoUrl: input.videoUrl ?? null,
    videoKey: input.videoKey ?? null,
    animationUrl: input.animationUrl ?? null,
    animationKey: input.animationKey ?? null,
    difficulty: input.difficulty,
    caloriesMin: input.caloriesMin,
    caloriesMax: input.caloriesMax,
    repsMin: input.repsMin,
    repsMax: input.repsMax,
    setsMin: input.setsMin,
    setsMax: input.setsMax,
    durationMin: input.durationMin,
    durationMax: input.durationMax,
    restTimeMin: input.restTimeMin,
    restTimeMax: input.restTimeMax,
    minWeight: input.minWeight,
    maxWeight: input.maxWeight,
    gender: input.gender,
    isChallenge: input.isChallenge,
    sortOrder: input.sortOrder,
    isActive: input.isActive,
    targetBodyParts: input.targetBodyParts,
    howToDo: input.howToDo,
    tips: input.tips,
    levelSections: input.levelSections,
    translations: withEnglishExerciseCopy(exerciseCopyFromInput(input), input.translations),
    updatedAt: new Date(),
  };

  await db.collection<ExerciseDocument>(COLLECTIONS.exercises).replaceOne({ id }, exercise);
  return exercise;
}

export async function deleteExercise(db: Db, id: number): Promise<boolean> {
  const result = await db.collection<ExerciseDocument>(COLLECTIONS.exercises).deleteOne({ id });
  return result.deletedCount === 1;
}
