import {
  mergeLocaleMaps,
  withEnglishExerciseCopy,
  withEnglishMealCopy,
  withEnglishNamedCopy,
  type ExerciseCopy,
  type LocaleMap,
  type MealCopy,
  type NamedCopy,
} from "@weightloss/contracts";
import { localizeExerciseCopy, localizeMealCopy, localizeNamedCopy } from "@weightloss/shared";
import type { Db } from "mongodb";
import type { CollectionName } from "./collections.js";

async function writeTranslations(
  db: Db,
  collection: CollectionName,
  id: number,
  translations: LocaleMap<NamedCopy | MealCopy | ExerciseCopy>,
) {
  await db.collection(collection).updateOne(
    { id },
    { $set: { translations, updatedAt: new Date() } },
  );
}

export async function persistNamedImportLocalizations(
  db: Db,
  collection: CollectionName,
  id: number,
  english: NamedCopy,
  provided?: LocaleMap<NamedCopy>,
) {
  try {
    const generated = await localizeNamedCopy(english);
    const translations = withEnglishNamedCopy(
      english.name?.trim() ?? "",
      english.description?.trim() ? english.description : null,
      mergeLocaleMaps(generated, provided),
    );
    await writeTranslations(db, collection, id, translations);
  } catch {
    /* English copy already stored by import */
  }
}

export async function persistMealImportLocalizations(
  db: Db,
  collection: CollectionName,
  id: number,
  english: MealCopy,
  provided?: LocaleMap<MealCopy>,
) {
  try {
    const generated = await localizeMealCopy(english);
    const translations = withEnglishMealCopy(english, mergeLocaleMaps(generated, provided));
    await writeTranslations(db, collection, id, translations);
  } catch {
    /* English copy already stored by import */
  }
}

export async function persistExerciseImportLocalizations(
  db: Db,
  collection: CollectionName,
  id: number,
  english: ExerciseCopy,
  provided?: LocaleMap<ExerciseCopy>,
) {
  try {
    const generated = await localizeExerciseCopy(english);
    const translations = withEnglishExerciseCopy(english, mergeLocaleMaps(generated, provided));
    await writeTranslations(db, collection, id, translations);
  } catch {
    /* English copy already stored by import */
  }
}
