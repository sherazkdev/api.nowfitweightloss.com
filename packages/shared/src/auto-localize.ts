import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type ExerciseCopy,
  type Locale,
  type LocaleMap,
  type MealCopy,
  type NamedCopy,
} from "@weightloss/contracts";

const TARGET_LOCALES = SUPPORTED_LOCALES.filter((locale) => locale !== DEFAULT_LOCALE);
const SEP = "\n⟦WL⟧\n";
const MYMEMORY_MAX = 450;
const CACHE_LIMIT = 4000;

const TL: Record<Locale, string> = {
  en: "en",
  bn: "bn",
  de: "de",
  es: "es",
  fr: "fr",
  hi: "hi",
  id: "id",
  it: "it",
  ja: "ja",
  ko: "ko",
  ms: "ms",
  pt: "pt",
  ru: "ru",
  tr: "tr",
  zh: "zh-CN",
};

const cache = new Map<string, string>();

function cacheKey(locale: Locale, text: string) {
  return `${locale}\0${text}`;
}

function cacheGet(locale: Locale, text: string): string | undefined {
  return cache.get(cacheKey(locale, text));
}

function cacheSet(locale: Locale, text: string, value: string) {
  if (cache.size >= CACHE_LIMIT) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  cache.set(cacheKey(locale, text), value);
}

function collect(value: unknown, into: string[]) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) into.push(trimmed);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collect(item, into);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collect(item, into);
  }
}

function applyMap<T>(value: T, translated: Map<string, string>): T {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return value;
    return (translated.get(trimmed) ?? value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => applyMap(item, translated)) as T;
  }
  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      next[key] = applyMap(item, translated);
    }
    return next as T;
  }
  return value;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function splitTranslated(translated: string, expected: number): string[] | null {
  const parts = translated.split(/\n?⟦WL⟧\n?/).map((part) => part.trim());
  return parts.length === expected ? parts : null;
}

function chunkByLength(texts: string[], maxChars: number): string[][] {
  const chunks: string[][] = [];
  let current: string[] = [];
  let size = 0;
  for (const text of texts) {
    const extra = text.length + (current.length > 0 ? SEP.length : 0);
    if (current.length > 0 && size + extra > maxChars) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    if (text.length > maxChars) {
      if (current.length > 0) {
        chunks.push(current);
        current = [];
        size = 0;
      }
      chunks.push([text.slice(0, maxChars)]);
      continue;
    }
    current.push(text);
    size += extra;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

async function googleTranslate(text: string, tl: string): Promise<string> {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "en");
  url.searchParams.set("tl", tl);
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", text);

  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`google_http_${response.status}`);
  const data = (await response.json()) as unknown;
  if (!Array.isArray(data) || !Array.isArray(data[0])) throw new Error("google_shape");
  const translated = (data[0] as unknown[])
    .map((chunk) => (Array.isArray(chunk) ? String(chunk[0] ?? "") : ""))
    .join("")
    .trim();
  if (!translated) throw new Error("google_empty");
  return translated;
}

async function myMemoryTranslate(text: string, tl: string): Promise<string> {
  const url = new URL("https://api.mymemory.translated.net/get");
  url.searchParams.set("q", text);
  url.searchParams.set("langpair", `en|${tl}`);

  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`mymemory_http_${response.status}`);

  const body = asObject(await response.json());
  const data = asObject(body?.responseData);
  const translated = typeof data?.translatedText === "string" ? data.translatedText.trim() : "";
  const status = body?.responseStatus;
  const ok = status === 200 || status === "200";
  if (!ok || !translated || translated.toUpperCase().includes("MYMEMORY WARNING")) {
    throw new Error("mymemory_rejected");
  }
  return translated;
}

async function translateBatch(texts: string[], locale: Locale): Promise<string[]> {
  const tl = TL[locale];
  const joined = texts.join(SEP);

  try {
    const translated = await googleTranslate(joined, tl);
    const parts = texts.length === 1 ? [translated] : splitTranslated(translated, texts.length);
    if (parts) return parts.map((part, index) => part || texts[index]!);
  } catch {
    /* official free API next */
  }

  const chunks = chunkByLength(texts, MYMEMORY_MAX);
  const output = [...texts];
  await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const payload = chunk.length === 1 ? chunk[0]! : chunk.join(SEP);
        const translated = await myMemoryTranslate(payload, tl);
        const parts = chunk.length === 1 ? [translated] : splitTranslated(translated, chunk.length);
        if (!parts) throw new Error("mymemory_split");
        chunk.forEach((source, index) => {
          const position = texts.indexOf(source);
          if (position >= 0) output[position] = parts[index] || source;
        });
      } catch {
        await Promise.all(
          chunk.map(async (source) => {
            try {
              const position = texts.indexOf(source);
              if (position >= 0) output[position] = await myMemoryTranslate(source, tl);
            } catch {
              /* keep English */
            }
          }),
        );
      }
    }),
  );
  return output;
}

async function translateJoined(texts: string[], locale: Locale): Promise<string[]> {
  if (texts.length === 0) return [];

  const output = texts.map((text) => cacheGet(locale, text) ?? "");
  const missing = texts.filter((text, index) => !output[index]);
  if (missing.length === 0) return output;

  const translated = await translateBatch(missing, locale);
  missing.forEach((source, index) => {
    const value = translated[index] || source;
    cacheSet(locale, source, value);
    const position = texts.indexOf(source);
    if (position >= 0) output[position] = value;
  });

  return output.map((value, index) => value || texts[index]!);
}

async function dictionaryFor(copy: object, locale: Locale): Promise<Map<string, string>> {
  const collected: string[] = [];
  collect(copy, collected);
  const unique = [...new Set(collected)];
  const translated = await translateJoined(unique, locale);
  const map = new Map<string, string>();
  unique.forEach((source, index) => {
    map.set(source, translated[index] ?? source);
  });
  return map;
}

async function localizeCopy<T extends object>(
  english: T,
  existing?: LocaleMap<T>,
): Promise<LocaleMap<T>> {
  const translations: LocaleMap<T> = { ...existing, [DEFAULT_LOCALE]: english };
  const missing = TARGET_LOCALES.filter((locale) => !existing?.[locale]);
  if (missing.length === 0) return translations;

  const results = await Promise.all(
    missing.map(async (locale) => {
      const map = await dictionaryFor(english, locale);
      return [locale, applyMap(english, map)] as const;
    }),
  );
  for (const [locale, copy] of results) {
    translations[locale] = copy;
  }
  return translations;
}

export async function localizeNamedCopy(
  copy: NamedCopy,
  existing?: LocaleMap<NamedCopy>,
): Promise<LocaleMap<NamedCopy>> {
  return localizeCopy(
    {
      name: copy.name?.trim() ?? "",
      description: copy.description?.trim() ? copy.description : null,
    },
    existing,
  );
}

export async function localizeMealCopy(
  copy: MealCopy,
  existing?: LocaleMap<MealCopy>,
): Promise<LocaleMap<MealCopy>> {
  return localizeCopy(copy, existing);
}

export async function localizeExerciseCopy(
  copy: ExerciseCopy,
  existing?: LocaleMap<ExerciseCopy>,
): Promise<LocaleMap<ExerciseCopy>> {
  return localizeCopy(copy, existing);
}
