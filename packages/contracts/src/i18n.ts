export const SUPPORTED_LOCALES = [
  "en",
  "bn",
  "de",
  "es",
  "fr",
  "hi",
  "id",
  "it",
  "ja",
  "ko",
  "ms",
  "pt",
  "ru",
  "tr",
  "zh",
] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_LABELS: Record<Locale, { name: string; native: string }> = {
  en: { name: "English", native: "English" },
  bn: { name: "Bengali", native: "বাংলা" },
  de: { name: "German", native: "Deutsch" },
  es: { name: "Spanish", native: "Español" },
  fr: { name: "French", native: "Français" },
  hi: { name: "Hindi", native: "हिन्दी" },
  id: { name: "Indonesian", native: "Bahasa Indonesia" },
  it: { name: "Italian", native: "Italiano" },
  ja: { name: "Japanese", native: "日本語" },
  ko: { name: "Korean", native: "한국어" },
  ms: { name: "Malay", native: "Bahasa Melayu" },
  pt: { name: "Portuguese", native: "Português" },
  ru: { name: "Russian", native: "Русский" },
  tr: { name: "Turkish", native: "Türkçe" },
  zh: { name: "Chinese", native: "中文" },
};

export type LocaleMap<T> = Partial<Record<Locale, T>>;

export type NamedCopy = {
  name?: string;
  description?: string | null;
};

export type MealCopy = {
  title: string;
  shortTitle: string | null;
  description: string | null;
  servingSize: string | null;
  ingredients: Array<{ name: string; unit: string | null }>;
  instructions: Array<{ text: string }>;
};

export type ExerciseCopy = {
  title: string;
  shortDescription: string | null;
  description: string | null;
  targetBodyParts: Array<{ name: string }>;
  howToDo: Array<{ text: string }>;
  tips: Array<{ tip: string }>;
  levelSections: Array<{ notes: string | null }>;
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function parseLocale(value?: string | null): Locale {
  if (!value) return DEFAULT_LOCALE;
  const normalized = value.trim().toLowerCase().split(/[-_]/)[0];
  return isLocale(normalized) ? normalized : DEFAULT_LOCALE;
}

function hasText(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.some(hasText);
  if (value && typeof value === "object") return Object.values(value).some(hasText);
  return false;
}

export function pruneTranslations<T>(map: LocaleMap<T> | undefined): LocaleMap<T> {
  if (!map) return {};
  const next: LocaleMap<T> = {};
  for (const locale of SUPPORTED_LOCALES) {
    const entry = map[locale];
    if (entry && hasText(entry)) next[locale] = entry;
  }
  return next;
}

/** Merge locale maps. Overlay locale objects replace field-by-field; unknown locales are ignored. */
export function mergeLocaleMaps<T extends object>(
  base?: LocaleMap<T>,
  overlay?: LocaleMap<T>,
): LocaleMap<T> {
  const next: LocaleMap<T> = { ...pruneTranslations(base) };
  const cleaned = pruneTranslations(overlay);
  for (const locale of SUPPORTED_LOCALES) {
    const extra = cleaned[locale];
    if (!extra) continue;
    const prev = next[locale];
    next[locale] = prev ? ({ ...prev, ...extra } as T) : extra;
  }
  return next;
}

export function withEnglishNamedCopy(
  name: string,
  description: string | null,
  translations?: LocaleMap<NamedCopy>,
): LocaleMap<NamedCopy> {
  return {
    ...pruneTranslations(translations),
    en: { name: name.trim(), description },
  };
}

export function withEnglishMealCopy(copy: MealCopy, translations?: LocaleMap<MealCopy>): LocaleMap<MealCopy> {
  return {
    ...pruneTranslations(translations),
    en: copy,
  };
}

export function withEnglishExerciseCopy(
  copy: ExerciseCopy,
  translations?: LocaleMap<ExerciseCopy>,
): LocaleMap<ExerciseCopy> {
  return {
    ...pruneTranslations(translations),
    en: copy,
  };
}

export function pickNamedCopy(
  name: string,
  description: string | null,
  translations: LocaleMap<NamedCopy> | undefined,
  locale: Locale,
): NamedCopy {
  const english: NamedCopy = {
    name: name.trim() || translations?.[DEFAULT_LOCALE]?.name?.trim() || name,
    description: description?.trim()
      ? description
      : translations?.[DEFAULT_LOCALE]?.description?.trim()
        ? translations[DEFAULT_LOCALE]!.description!
        : description,
  };
  if (locale === DEFAULT_LOCALE) return english;
  const overlay = translations?.[locale];
  if (!overlay || !hasText(overlay)) return english;
  return {
    name: overlay.name?.trim() || english.name,
    description: overlay.description?.trim() ? overlay.description : english.description,
  };
}

function englishMealCopy(root: MealCopy, translations: LocaleMap<MealCopy> | undefined): MealCopy {
  const en = translations?.[DEFAULT_LOCALE];
  return {
    title: root.title.trim() || en?.title?.trim() || root.title,
    shortTitle: root.shortTitle?.trim() ? root.shortTitle : (en?.shortTitle?.trim() ? en.shortTitle : root.shortTitle),
    description: root.description?.trim()
      ? root.description
      : en?.description?.trim()
        ? en.description
        : root.description,
    servingSize: root.servingSize?.trim()
      ? root.servingSize
      : en?.servingSize?.trim()
        ? en.servingSize
        : root.servingSize,
    ingredients: root.ingredients,
    instructions: root.instructions,
  };
}

export function pickMealCopy(
  root: MealCopy,
  translations: LocaleMap<MealCopy> | undefined,
  locale: Locale,
): MealCopy {
  const english = englishMealCopy(root, translations);
  if (locale === DEFAULT_LOCALE) return english;
  const overlay = translations?.[locale];
  if (!overlay || !hasText(overlay)) return english;
  return {
    title: overlay.title?.trim() || english.title,
    shortTitle: overlay.shortTitle?.trim() ? overlay.shortTitle : english.shortTitle,
    description: overlay.description?.trim() ? overlay.description : english.description,
    servingSize: overlay.servingSize?.trim() ? overlay.servingSize : english.servingSize,
    ingredients: english.ingredients.map((item, index) => ({
      name: overlay.ingredients?.[index]?.name?.trim() || item.name,
      unit: overlay.ingredients?.[index]?.unit?.trim() ? overlay.ingredients[index]!.unit : item.unit,
    })),
    instructions: english.instructions.map((item, index) => ({
      text: overlay.instructions?.[index]?.text?.trim() || item.text,
    })),
  };
}

function englishExerciseCopy(
  root: ExerciseCopy,
  translations: LocaleMap<ExerciseCopy> | undefined,
): ExerciseCopy {
  const en = translations?.[DEFAULT_LOCALE];
  return {
    title: root.title.trim() || en?.title?.trim() || root.title,
    shortDescription: root.shortDescription?.trim()
      ? root.shortDescription
      : en?.shortDescription?.trim()
        ? en.shortDescription
        : root.shortDescription,
    description: root.description?.trim()
      ? root.description
      : en?.description?.trim()
        ? en.description
        : root.description,
    targetBodyParts: root.targetBodyParts,
    howToDo: root.howToDo,
    tips: root.tips,
    levelSections: root.levelSections,
  };
}

export function pickExerciseCopy(
  root: ExerciseCopy,
  translations: LocaleMap<ExerciseCopy> | undefined,
  locale: Locale,
): ExerciseCopy {
  const english = englishExerciseCopy(root, translations);
  if (locale === DEFAULT_LOCALE) return english;
  const overlay = translations?.[locale];
  if (!overlay || !hasText(overlay)) return english;
  return {
    title: overlay.title?.trim() || english.title,
    shortDescription: overlay.shortDescription?.trim() ? overlay.shortDescription : english.shortDescription,
    description: overlay.description?.trim() ? overlay.description : english.description,
    targetBodyParts: english.targetBodyParts.map((item, index) => ({
      name: overlay.targetBodyParts?.[index]?.name?.trim() || item.name,
    })),
    howToDo: english.howToDo.map((item, index) => ({
      text: overlay.howToDo?.[index]?.text?.trim() || item.text,
    })),
    tips: english.tips.map((item, index) => ({
      tip: overlay.tips?.[index]?.tip?.trim() || item.tip,
    })),
    levelSections: english.levelSections.map((item, index) => ({
      notes: overlay.levelSections?.[index]?.notes?.trim()
        ? overlay.levelSections[index]!.notes
        : item.notes,
    })),
  };
}
