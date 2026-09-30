import { getRelativeLocaleUrl } from "astro:i18n";
import { z } from "zod";
import config from "../../config/config.json";
import languagesJSON from "../../config/language.json";

// Zod schema for validating config settings at runtime
const ConfigSettingsSchema = z.object({
    default_language: z.string(),
    disable_languages: z.array(z.string()),
    default_language_in_subdir: z.boolean().optional(),
});

const ConfigSiteSchema = z.object({
    trailing_slash: z.boolean().optional(),
});

type ConfigSettings = z.infer<typeof ConfigSettingsSchema>;
type ConfigSite = z.infer<typeof ConfigSiteSchema>;

// Validate config structure - will throw at build time if invalid
const validatedSettings: ConfigSettings = ConfigSettingsSchema.parse(config.settings);
const validatedSite: ConfigSite = ConfigSiteSchema.parse(config.site);
const { default_language } = validatedSettings;

const locales: Record<string, Record<string, unknown>> = {};

// Load menu and dictionary dynamically
languagesJSON.forEach((language) => {
  const { languageCode } = language;
  import(`../../config/menu.${languageCode}.json`).then((menu) => {
    import(`../../i18n/${languageCode}.json`).then((dictionary) => {
      locales[languageCode] = { ...menu, ...dictionary };
    });
  });
});

// Extract all languages from the locales object
const languages = Object.keys(locales);

// Export the locales and languages
export { languages, locales };

export function getLangFromUrl(url: URL): string {
  const [, lang] = url.pathname.split("/");
  if (locales.hasOwnProperty(lang)) {
    return lang;
  }
  return default_language;
}

export const getTranslations = async (lang: string) => {
  const {
    default_language: configuredDefaultLanguage,
    disable_languages,
  } = validatedSettings;

  if (disable_languages.includes(lang)) {
    lang = configuredDefaultLanguage;
  }

  let language = languagesJSON.find((l) => l.languageCode === lang);

  if (!language) {
    lang = configuredDefaultLanguage;
    language = languagesJSON.find(
      (l) => l.languageCode === configuredDefaultLanguage,
    );
  }

  if (!language) {
    throw new Error("Default language not found");
  }

  const contentDir = language.contentDir;

  let menu, dictionary;
  try {
    menu = await import(`../../config/menu.${lang}.json`);
    dictionary = await import(`../../i18n/${lang}.json`);
  } catch  {
    menu = await import(`../../config/menu.${configuredDefaultLanguage}.json`);
    dictionary = await import(`../../i18n/${configuredDefaultLanguage}.json`);
  }

  return { ...menu.default, ...dictionary.default, contentDir };
};

const supportedLang = ["", ...languagesJSON.map((lang) => lang.languageCode)];
const disabledLanguages = validatedSettings.disable_languages;

// Filter out disabled languages from supportedLang
const filteredSupportedLang = supportedLang.filter(
  (lang) => !disabledLanguages.includes(lang),
);

export { filteredSupportedLang as supportedLang };

export const slugSelector = (url: string, lang: string) => {
  const {
    default_language: configuredDefaultLanguage,
    default_language_in_subdir = false,
  } = validatedSettings;
  const { trailing_slash = false } = validatedSite;

  let constructedUrl;

  // Determine the initial URL structure based on language
  if (url === "/") {
    constructedUrl = lang === configuredDefaultLanguage ? "/" : `/${lang}`;
  } else {
    constructedUrl = getRelativeLocaleUrl(lang, url, {
      normalizeLocale: false,
    });
  }

  // Add language path if necessary
  if (lang === configuredDefaultLanguage && default_language_in_subdir) {
    constructedUrl = `/${lang}${constructedUrl}`;
  }

  // Adjust for trailing slash
  if (trailing_slash) {
    if (!constructedUrl.endsWith("/")) {
      constructedUrl += "/";
    }
  } else {
    if (constructedUrl.endsWith("/") && constructedUrl !== "/") {
      constructedUrl = constructedUrl.slice(0, -1);
    }
  }

  return constructedUrl;
};
