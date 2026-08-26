import {
  DEFAULT_LOCALE,
  mergeLocaleMaps,
  SUPPORTED_LOCALES,
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

function hasGeneratedLocales(map?: LocaleMap<unknown>): boolean {
  return SUPPORTED_LOCALES.every((locale) => {
    if (locale === DEFAULT_LOCALE) return true;
    return map?.[locale] != null;
  });
}

export async function persistNamedImportLocalizations(
  db: Db,
  collection: CollectionName,
  id: number,
  english: NamedCopy,
  provided?: LocaleMap<NamedCopy>,
  existing?: LocaleMap<NamedCopy>,
) {
  try {
    const already = mergeLocaleMaps(existing, provided);
    if (hasGeneratedLocales(already)) return;
    const generated = await localizeNamedCopy(english, already);
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
  existing?: LocaleMap<MealCopy>,
) {
  try {
    const already = mergeLocaleMaps(existing, provided);
    if (hasGeneratedLocales(already)) return;
    const generated = await localizeMealCopy(english, already);
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
  existing?: LocaleMap<ExerciseCopy>,
) {
  try {
    const already = mergeLocaleMaps(existing, provided);
    if (hasGeneratedLocales(already)) return;
    const generated = await localizeExerciseCopy(english, already);
    const translations = withEnglishExerciseCopy(english, mergeLocaleMaps(generated, provided));
    await writeTranslations(db, collection, id, translations);
  } catch {
    /* English copy already stored by import */
  }
}
