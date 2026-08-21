import bn from "./bn.json";
import de from "./de.json";
import en from "./en.json";
import es from "./es.json";
import fr from "./fr.json";
import hi from "./hi.json";
import id from "./id.json";
import it from "./it.json";
import ja from "./ja.json";
import ko from "./ko.json";
import ms from "./ms.json";
import pt from "./pt.json";
import ru from "./ru.json";
import tr from "./tr.json";
import zh from "./zh.json";
import type { Locale } from "@/lib/locales";

export const localeMessages: Record<Locale, Record<string, string>> = {
  en,
  bn,
  de,
  es,
  fr,
  hi,
  id,
  it,
  ja,
  ko,
  ms,
  pt,
  ru,
  tr,
  zh,
};

export function t(locale: Locale, key: string): string {
  return localeMessages[locale]?.[key] ?? localeMessages.en[key] ?? key;
}
