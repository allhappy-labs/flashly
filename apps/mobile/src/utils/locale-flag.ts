const LOCALE_TO_FLAG_REGION: Record<string, string> = {
  en: 'US',
  de: 'DE',
  uk: 'UA',
  es: 'ES',
  fr: 'FR',
};

export function getLocaleFlagEmoji(locale: string): string | null {
  const normalized = locale.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const [language, region] = normalized.split('-');
  const resolvedRegion = (region || LOCALE_TO_FLAG_REGION[language] || language).toUpperCase();
  if (resolvedRegion.length !== 2) {
    return null;
  }

  const baseCodePoint = 127397;
  return String.fromCodePoint(
    resolvedRegion.charCodeAt(0) + baseCodePoint,
    resolvedRegion.charCodeAt(1) + baseCodePoint
  );
}
