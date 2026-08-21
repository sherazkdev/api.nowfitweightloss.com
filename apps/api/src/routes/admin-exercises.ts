import { z } from "zod";
import type { FastifyInstance, FastifyReply } from "fastify";
import {
  createExercise,
  deleteExercise,
  findExerciseById,
  getMongo,
  listExercises,
  updateExercise,
  type ExerciseWriteInput,
} from "@weightloss/database";
import type { ExerciseCopy } from "@weightloss/contracts";
import { bumpContentCache } from "../lib/cache-bump.js";
import { englishExerciseTranslations, fillExerciseTranslationsLater } from "../lib/localize-after-save.js";
import { requireAdminAuth } from "../plugins/auth.js";
import { formatZodError } from "../schemas/taxonomy.js";

const genderSchema = z.enum(["male", "female", "both"]);
const difficultySchema = z.enum(["Beginner", "Intermediate", "Advanced"]);

const exerciseBodySchema = z.object({
  categoryIds: z.array(z.number().int().positive()).default([]),
  levelIds: z.array(z.number().int().positive()).min(1),
  title: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(120),
  shortDescription: z.string().trim().max(500).nullable().optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  image: z.preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? null : val),
    z.union([z.string().url(), z.string().startsWith("/uploads/"), z.null()]).optional(),
  ),
  imageKey: z.string().trim().nullable().optional(),
  videoUrl: z.preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? null : val),
    z.union([z.string().url(), z.string().startsWith("/uploads/"), z.null()]).optional(),
  ),
  videoKey: z.string().trim().nullable().optional(),
  animationUrl: z.preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? null : val),
    z.union([z.string().url(), z.string().startsWith("/uploads/"), z.null()]).optional(),
  ),
  animationKey: z.string().trim().nullable().optional(),
  difficulty: difficultySchema,
  caloriesMin: z.number().finite().nonnegative(),
  caloriesMax: z.number().finite().nonnegative(),
  repsMin: z.number().finite().nonnegative(),
  repsMax: z.number().finite().nonnegative(),
  setsMin: z.number().finite().nonnegative(),
  setsMax: z.number().finite().nonnegative(),
  durationMin: z.number().finite().nonnegative(),
  durationMax: z.number().finite().nonnegative(),
  restTimeMin: z.number().finite().nonnegative(),
  restTimeMax: z.number().finite().nonnegative(),
  minWeight: z.number().finite().nonnegative(),
  maxWeight: z.number().finite().nonnegative(),
  gender: genderSchema,
  isChallenge: z.boolean(),
  sortOrder: z.number().int().nonnegative(),
  isActive: z.boolean(),
  targetBodyParts: z.array(z.object({
    name: z.string().trim().min(1),
    imageUrl: z.union([z.string().url(), z.string().startsWith("/uploads/"), z.null()]).optional(),
    imageKey: z.string().trim().nullable().optional(),
    sortOrder: z.number().int().nonnegative(),
  })).default([]),
  howToDo: z.array(z.object({
    step: z.number().int().positive(),
    text: z.string().trim().min(1),
  })).default([]),
  tips: z.array(z.object({
    tip: z.string().trim().min(1),
    sortOrder: z.number().int().nonnegative(),
  })).default([]),
  levelSections: z.array(z.object({
    levelId: z.number().int().positive(),
    customDurationMin: z.number().finite().nonnegative(),
    customDurationMax: z.number().finite().nonnegative(),
    customSetsMin: z.number().finite().nonnegative(),
    customSetsMax: z.number().finite().nonnegative(),
    customRepsMin: z.number().finite().nonnegative(),
    customRepsMax: z.number().finite().nonnegative(),
    customCaloriesMin: z.number().finite().nonnegative(),
    customCaloriesMax: z.number().finite().nonnegative(),
    notes: z.string().trim().nullable().optional(),
    sortOrder: z.number().int().nonnegative(),
  })).default([]),
  translations: z
    .record(
      z.string(),
      z.object({
        title: z.string().trim().max(200).optional(),
        shortDescription: z.string().trim().max(500).nullable().optional(),
        description: z.string().trim().max(5000).nullable().optional(),
        targetBodyParts: z.array(z.object({ name: z.string().trim().optional() })).optional(),
        howToDo: z.array(z.object({ text: z.string().trim().optional() })).optional(),
        tips: z.array(z.object({ tip: z.string().trim().optional() })).optional(),
        levelSections: z.array(z.object({ notes: z.string().trim().nullable().optional() })).optional(),
      }),
    )
    .optional(),
});

function validationError(reply: FastifyReply, message: string, requestId: string) {
  return reply.status(422).send({
    success: false,
    error: { code: "VALIDATION_ERROR", message },
    requestId,
  });
}

function exerciseCopyFromBody(data: z.infer<typeof exerciseBodySchema>): ExerciseCopy {
  const targetBodyParts = data.targetBodyParts.map((item) => ({
    name: item.name,
    imageUrl: item.imageUrl ?? null,
    imageKey: item.imageKey ?? null,
    sortOrder: item.sortOrder,
  }));
  const levelSections = data.levelSections.map((item) => ({
    ...item,
    notes: item.notes ?? null,
  }));
  return {
    title: data.title.trim(),
    shortDescription: data.shortDescription ?? null,
    description: data.description ?? null,
    targetBodyParts: targetBodyParts.map((item) => ({ name: item.name })),
    howToDo: data.howToDo.map((item) => ({ text: item.text })),
    tips: data.tips.map((item) => ({ tip: item.tip })),
    levelSections: levelSections.map((item) => ({ notes: item.notes })),
  };
}

function toExerciseWriteInput(data: z.infer<typeof exerciseBodySchema>): ExerciseWriteInput {
  const targetBodyParts = data.targetBodyParts.map((item) => ({
    name: item.name,
    imageUrl: item.imageUrl ?? null,
    imageKey: item.imageKey ?? null,
    sortOrder: item.sortOrder,
  }));
  const levelSections = data.levelSections.map((item) => ({
    ...item,
    notes: item.notes ?? null,
  }));
  return {
    ...data,
    shortDescription: data.shortDescription ?? null,
    description: data.description ?? null,
    image: data.image ?? null,
    imageKey: data.imageKey ?? null,
    videoUrl: data.videoUrl ?? null,
    videoKey: data.videoKey ?? null,
    animationUrl: data.animationUrl ?? null,
    animationKey: data.animationKey ?? null,
    targetBodyParts,
    levelSections,
    translations: englishExerciseTranslations(exerciseCopyFromBody(data)),
  };
}

export async function registerAdminExerciseRoutes(app: FastifyInstance) {
  app.get("/api/admin/exercises", { preHandler: requireAdminAuth }, async (request, reply) => {
    const { db } = getMongo();
    const result = await listExercises(db, { limit: 200 });
    return reply.send({ success: true, data: result });
  });

  app.get("/api/admin/exercises/:id", { preHandler: requireAdminAuth }, async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) return validationError(reply, "Invalid exercise id", request.id);

    const { db } = getMongo();
    const item = await findExerciseById(db, id);
    if (!item) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Exercise not found" },
        requestId: request.id,
      });
    }

    return reply.send({ success: true, data: item });
  });

  app.post("/api/admin/exercises", { preHandler: requireAdminAuth }, async (request, reply) => {
    const parsed = exerciseBodySchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, formatZodError(parsed.error), request.id);

    const { db } = getMongo();
    const input = toExerciseWriteInput(parsed.data);
    const item = await createExercise(db, input);
    await bumpContentCache(app, ["exercises"]);
    fillExerciseTranslationsLater(exerciseCopyFromBody(parsed.data), async (translations) => {
      await updateExercise(db, item.id, { ...input, translations });
      await bumpContentCache(app, ["exercises"]);
    });
    return reply.status(201).send({ success: true, data: item });
  });

  app.put("/api/admin/exercises/:id", { preHandler: requireAdminAuth }, async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) return validationError(reply, "Invalid exercise id", request.id);

    const parsed = exerciseBodySchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, formatZodError(parsed.error), request.id);

    const { db } = getMongo();
    const input = toExerciseWriteInput(parsed.data);
    const item = await updateExercise(db, id, input);
    if (!item) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Exercise not found" },
        requestId: request.id,
      });
    }

    await bumpContentCache(app, ["exercises"]);
    fillExerciseTranslationsLater(exerciseCopyFromBody(parsed.data), async (translations) => {
      await updateExercise(db, id, { ...input, translations });
      await bumpContentCache(app, ["exercises"]);
    });
    return reply.send({ success: true, data: item });
  });

  app.delete("/api/admin/exercises/:id", { preHandler: requireAdminAuth }, async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) return validationError(reply, "Invalid exercise id", request.id);

    const { db } = getMongo();
    const deleted = await deleteExercise(db, id);
    if (!deleted) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Exercise not found" },
        requestId: request.id,
      });
    }

    await bumpContentCache(app, ["exercises"]);
    return reply.send({ success: true, data: { id } });
  });
}
