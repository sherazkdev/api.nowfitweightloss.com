import type {
  ExerciseDocument,
  Locale,
  MealCategoryDocument,
  MealDocument,
  WorkoutCategoryDocument,
  WorkoutLevelDocument,
} from "@weightloss/contracts";
import { pickExerciseCopy, pickMealCopy, pickNamedCopy } from "@weightloss/contracts";
import { legacyNutrition, toLegacySnake } from "./legacy.js";

function localizedNamed<T extends { name: string; description: string | null; translations?: MealCategoryDocument["translations"] }>(
  doc: T,
  locale: Locale,
): T {
  const copy = pickNamedCopy(doc.name, doc.description, doc.translations, locale);
  return { ...doc, name: copy.name, description: copy.description };
}

function localizedMeal(doc: MealDocument, locale: Locale): MealDocument {
  const copy = pickMealCopy(
    {
      title: doc.title,
      shortTitle: doc.shortTitle,
      description: doc.description,
      servingSize: doc.servingSize,
      ingredients: doc.ingredients.map((item) => ({ name: item.name, unit: item.unit })),
      instructions: doc.instructions.map((item) => ({ text: item.text })),
    },
    doc.translations,
    locale,
  );
  return {
    ...doc,
    title: copy.title,
    shortTitle: copy.shortTitle,
    description: copy.description,
    servingSize: copy.servingSize,
    ingredients: doc.ingredients.map((item, index) => ({
      ...item,
      name: copy.ingredients[index]?.name ?? item.name,
      unit: copy.ingredients[index]?.unit ?? item.unit,
    })),
    instructions: doc.instructions.map((item, index) => ({
      ...item,
      text: copy.instructions[index]?.text ?? item.text,
    })),
  };
}

function localizedExercise(doc: ExerciseDocument, locale: Locale): ExerciseDocument {
  const copy = pickExerciseCopy(
    {
      title: doc.title,
      shortDescription: doc.shortDescription,
      description: doc.description,
      targetBodyParts: doc.targetBodyParts.map((item) => ({ name: item.name })),
      howToDo: doc.howToDo.map((item) => ({ text: item.text })),
      tips: doc.tips.map((item) => ({ tip: item.tip })),
      levelSections: doc.levelSections.map((item) => ({ notes: item.notes })),
    },
    doc.translations,
    locale,
  );
  return {
    ...doc,
    title: copy.title,
    shortDescription: copy.shortDescription,
    description: copy.description,
    targetBodyParts: doc.targetBodyParts.map((item, index) => ({
      ...item,
      name: copy.targetBodyParts[index]?.name ?? item.name,
    })),
    howToDo: doc.howToDo.map((item, index) => ({
      ...item,
      text: copy.howToDo[index]?.text ?? item.text,
    })),
    tips: doc.tips.map((item, index) => ({
      ...item,
      tip: copy.tips[index]?.tip ?? item.tip,
    })),
    levelSections: doc.levelSections.map((item, index) => ({
      ...item,
      notes: copy.levelSections[index]?.notes ?? item.notes,
    })),
  };
}

export function serializePublicMealCategory(doc: MealCategoryDocument, locale: Locale) {
  const localized = localizedNamed(doc, locale);
  return toLegacySnake({
    id: localized.id,
    name: localized.name,
    slug: localized.slug,
    description: localized.description,
    icon: localized.icon,
    image: localized.image,
    sortOrder: localized.sortOrder,
    isActive: localized.isActive,
  });
}

export function serializePublicMealListItem(doc: MealDocument, locale: Locale) {
  const localized = localizedMeal(doc, locale);
  return toLegacySnake({
    id: localized.id,
    categoryIds: localized.categoryIds,
    title: localized.title,
    shortTitle: localized.shortTitle,
    description: localized.description,
    image: localized.image,
    nutrition: legacyNutrition(localized.nutrition),
    minWeight: localized.minWeight,
    maxWeight: localized.maxWeight,
    prepTimeMinutes: localized.prepTimeMinutes,
    difficulty: localized.difficulty,
    servingSize: localized.servingSize,
    gender: localized.gender,
    isChallenge: localized.isChallenge,
    sortOrder: localized.sortOrder,
    isActive: localized.isActive,
  });
}

export function serializePublicMealDetail(doc: MealDocument, locale: Locale) {
  const localized = localizedMeal(doc, locale);
  return {
    ...serializePublicMealListItem(localized, locale),
    ingredients: localized.ingredients.map((item) =>
      toLegacySnake({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        sortOrder: item.sortOrder,
      }),
    ),
    instructions: localized.instructions.map((item) =>
      toLegacySnake({
        step: item.step,
        text: item.text,
      }),
    ),
  };
}

export function serializePublicWorkoutLevel(doc: WorkoutLevelDocument, locale: Locale) {
  const localized = localizedNamed(doc, locale);
  return toLegacySnake({
    id: localized.id,
    name: localized.name,
    slug: localized.slug,
    description: localized.description,
    icon: localized.icon,
    image: localized.image,
    sortOrder: localized.sortOrder,
    isActive: localized.isActive,
  });
}

export function serializePublicWorkoutCategory(doc: WorkoutCategoryDocument, locale: Locale) {
  const localized = localizedNamed(doc, locale);
  return toLegacySnake({
    id: localized.id,
    levelIds: localized.levelIds,
    name: localized.name,
    slug: localized.slug,
    description: localized.description,
    image: localized.image,
    gender: localized.gender,
    isChallenge: localized.isChallenge,
    sortOrder: localized.sortOrder,
    isActive: localized.isActive,
  });
}

export function serializePublicExerciseListItem(doc: ExerciseDocument, locale: Locale) {
  const localized = localizedExercise(doc, locale);
  return toLegacySnake({
    id: localized.id,
    categoryIds: localized.categoryIds,
    levelIds: localized.levelIds,
    title: localized.title,
    slug: localized.slug,
    shortDescription: localized.shortDescription,
    description: localized.description,
    image: localized.image,
    difficulty: localized.difficulty,
    caloriesMin: localized.caloriesMin,
    caloriesMax: localized.caloriesMax,
    repsMin: localized.repsMin,
    repsMax: localized.repsMax,
    setsMin: localized.setsMin,
    setsMax: localized.setsMax,
    durationMin: localized.durationMin,
    durationMax: localized.durationMax,
    gender: localized.gender,
    isChallenge: localized.isChallenge,
    sortOrder: localized.sortOrder,
    isActive: localized.isActive,
  });
}

export function serializePublicExerciseDetail(
  doc: ExerciseDocument,
  locale: Locale,
  levelId?: number,
) {
  const localized = localizedExercise(doc, locale);
  const section = levelId
    ? localized.levelSections.find((item) => item.levelId === levelId)
    : undefined;
  const overridden = section
    ? {
        ...localized,
        durationMin: section.customDurationMin,
        durationMax: section.customDurationMax,
        setsMin: section.customSetsMin,
        setsMax: section.customSetsMax,
        repsMin: section.customRepsMin,
        repsMax: section.customRepsMax,
        caloriesMin: section.customCaloriesMin,
        caloriesMax: section.customCaloriesMax,
      }
    : localized;
  return {
    ...serializePublicExerciseListItem(overridden, locale),
    videoUrl: overridden.videoUrl,
    animationUrl: overridden.animationUrl,
    restTimeMin: overridden.restTimeMin,
    restTimeMax: overridden.restTimeMax,
    minWeight: overridden.minWeight,
    maxWeight: overridden.maxWeight,
    targetBodyParts: overridden.targetBodyParts.map((item) =>
      toLegacySnake(item as unknown as Record<string, unknown>),
    ),
    howToDo: overridden.howToDo.map((item) => toLegacySnake(item as unknown as Record<string, unknown>)),
    tips: overridden.tips.map((item) => toLegacySnake(item as unknown as Record<string, unknown>)),
    levelSections: overridden.levelSections.map((item) =>
      toLegacySnake(item as unknown as Record<string, unknown>),
    ),
  };
}
