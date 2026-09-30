import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { i18nResources } from "@flashly/shared";
import { LANGUAGE_STORAGE_KEY, supportedLanguages } from "../constants";

function detectLanguageCode() {
  const locale = Localization.getLocales?.()[0];
  const langCode = locale?.languageCode;
  if (langCode && i18nResources[langCode as keyof typeof i18nResources]) {
    return langCode;
  }
  return "en";
}

export async function loadPreferredLanguage() {
  const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored ?? null;
}

export async function initI18n(preferredLanguage?: string | null) {
  if (i18n.isInitialized) return i18n;

  const lng = preferredLanguage || (await loadPreferredLanguage()) || detectLanguageCode();

  await i18n.use(initReactI18next).init({
    compatibilityJSON: "v4",
    resources: i18nResources,
    lng,
    fallbackLng: "en",
    react: { useSuspense: false },
    returnNull: false,
    interpolation: { escapeValue: false },
  });

  return i18n;
}

export { supportedLanguages };
export default i18n;
