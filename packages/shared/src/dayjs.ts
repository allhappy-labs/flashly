import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime.js";
import utc from "dayjs/plugin/utc.js";
import "dayjs/locale/en.js";
import "dayjs/locale/de.js";
import "dayjs/locale/es.js";
import "dayjs/locale/fr.js";
import "dayjs/locale/uk.js";

dayjs.extend(utc);
dayjs.extend(relativeTime);

const localeMap: Record<string, string> = {
  en: "en",
  de: "de",
  es: "es",
  fr: "fr",
  uk: "uk",
};

export function resolveDayjsLocale(locale?: string) {
  if (!locale) return "en";
  const normalized = locale.toLowerCase().replace("_", "-");
  const base = normalized.split("-")[0];
  return localeMap[base] ?? "en";
}

export function setDayjsLocale(locale?: string) {
  const resolved = resolveDayjsLocale(locale);
  dayjs.locale(resolved);
  return resolved;
}

export { dayjs };
