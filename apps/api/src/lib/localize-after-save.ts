import {
  withEnglishExerciseCopy,
  withEnglishMealCopy,
  withEnglishNamedCopy,
  type ExerciseCopy,
  type LocaleMap,
  type MealCopy,
  type NamedCopy,
} from "@weightloss/contracts";
import { localizeExerciseCopy, localizeMealCopy, localizeNamedCopy } from "@weightloss/shared";

export function englishNamedTranslations(name: string, description: string | null): LocaleMap<NamedCopy> {
  return withEnglishNamedCopy(name, description);
}

export function englishMealTranslations(copy: MealCopy): LocaleMap<MealCopy> {
  return withEnglishMealCopy(copy);
}

export function englishExerciseTranslations(copy: ExerciseCopy): LocaleMap<ExerciseCopy> {
  return withEnglishExerciseCopy(copy);
}

function later<T>(produce: () => Promise<T>, apply: (value: T) => Promise<unknown>) {
  void produce()
    .then((value) => apply(value))
    .catch(() => undefined);
}

export function fillNamedTranslationsLater(
  copy: NamedCopy,
  apply: (translations: LocaleMap<NamedCopy>) => Promise<unknown>,
) {
  later(() => localizeNamedCopy(copy), apply);
}

export function fillMealTranslationsLater(
  copy: MealCopy,
  apply: (translations: LocaleMap<MealCopy>) => Promise<unknown>,
) {
  later(() => localizeMealCopy(copy), apply);
}

export function fillExerciseTranslationsLater(
  copy: ExerciseCopy,
  apply: (translations: LocaleMap<ExerciseCopy>) => Promise<unknown>,
) {
  later(() => localizeExerciseCopy(copy), apply);
}
