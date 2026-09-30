export const LANGUAGE_STORAGE_KEY = 'flashly.language';
export const INTRO_SEEN_STORAGE_KEY = 'flashly.introSeen';
export const FSRS_PARAMS_STORAGE_KEY = 'flashly.fsrsParams';
export const HAPTICS_ENABLED_STORAGE_KEY = 'flashly.hapticsEnabled';
export const DAILY_GOAL_STORAGE_KEY = 'flashly.dailyGoal';
export const DAILY_GOAL_ALLOW_EXTRA_STORAGE_KEY = 'flashly.dailyGoalAllowExtra';
export const TIME_GRADING_CONFIG_STORAGE_KEY = 'flashly.timeGradingConfig';
export const TIME_GRADING_EMA_KEY_PREFIX = 'flashly.timeGrading.ema.';
export const STUDY_SWIPE_HINT_DISMISSED_KEY = 'flashly.studySwipeHintDismissed';
export const BROWSE_SWIPE_HINT_DISMISSED_KEY = 'flashly.browseSwipeHintDismissed';
export const DAILY_NEW_CARD_LIMIT = 0;
export const DAILY_REVIEW_LIMIT = 0;
import Constants from 'expo-constants';

const DEFAULT_API_BASE_URL = 'http://localhost:3001';
const DEFAULT_FRONTEND_URL = 'http://localhost:3000/';

function withTrailingSlash(url: string): string {
  return `${url.replace(/\/+$/, '')}/`;
}

export function getApiBaseUrlInfo(): { baseUrl: string; source: 'expo-extra' | 'env' | 'default' } {
  const expoUrl = Constants.expoConfig?.extra?.apiUrl;
  if (typeof expoUrl === 'string' && expoUrl.length > 0) {
    return { baseUrl: expoUrl.replace(/\/+$/, ''), source: 'expo-extra' };
  }

  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (typeof envUrl === 'string' && envUrl.length > 0) {
    return { baseUrl: envUrl.replace(/\/+$/, ''), source: 'env' };
  }

  return { baseUrl: DEFAULT_API_BASE_URL, source: 'default' };
}

export const API_BASE_URL = getApiBaseUrlInfo().baseUrl;

export function getFrontendAppUrlInfo(): { url: string; source: 'expo-extra' | 'env' | 'default' } {
  const expoUrl = Constants.expoConfig?.extra?.frontendUrl;
  if (typeof expoUrl === 'string' && expoUrl.length > 0) {
    return { url: withTrailingSlash(expoUrl), source: 'expo-extra' };
  }

  const envUrl = process.env.EXPO_PUBLIC_FRONTEND_URL;
  if (typeof envUrl === 'string' && envUrl.length > 0) {
    return { url: withTrailingSlash(envUrl), source: 'env' };
  }

  return { url: DEFAULT_FRONTEND_URL, source: 'default' };
}

export const FRONTEND_APP_URL = getFrontendAppUrlInfo().url;

export const supportedLanguages = [
  { code: 'en', labelKey: 'languages.english' },
  { code: 'de', labelKey: 'languages.german' },
  { code: 'uk', labelKey: 'languages.ukrainian' },
  { code: 'es', labelKey: 'languages.spanish' },
  { code: 'fr', labelKey: 'languages.french' },
];

export type DeckAccent = {
  key: string;
  labelKey: string;
  icon: "book-outline" | "globe-outline" | "code-slash-outline" | "flask-outline" | "calculator-outline" | "cash-outline" | "brush-outline" | "earth-outline" | "leaf-outline" | "school-outline" | "musical-notes-outline" | "construct-outline" | "pulse-outline" | "body-outline" | "library-outline" | "people-outline" | "business-outline" | "sparkles-outline" | "trending-up-outline";
  background: string;
  color: string;
};

export const DECK_ACCENTS: DeckAccent[] = [
  { key: "general", labelKey: "deck.accentGeneral", icon: "book-outline", background: "rgba(59, 130, 246, 0.16)", color: "#60a5fa" },
  { key: "language", labelKey: "deck.accentLanguage", icon: "globe-outline", background: "rgba(47, 107, 255, 0.18)", color: "#5b7cfa" },
  { key: "coding", labelKey: "deck.accentCoding", icon: "code-slash-outline", background: "rgba(139, 92, 246, 0.18)", color: "#a78bfa" },
  { key: "science", labelKey: "deck.accentScience", icon: "flask-outline", background: "rgba(34, 197, 94, 0.16)", color: "#34d399" },
  { key: "math", labelKey: "deck.accentMath", icon: "calculator-outline", background: "rgba(249, 115, 22, 0.16)", color: "#fb923c" },
  { key: "business", labelKey: "deck.accentBusiness", icon: "cash-outline", background: "rgba(245, 158, 11, 0.16)", color: "#fbbf24" },
  { key: "art", labelKey: "deck.accentArt", icon: "brush-outline", background: "rgba(236, 72, 153, 0.16)", color: "#f472b6" },
  { key: "geography", labelKey: "deck.accentGeography", icon: "earth-outline", background: "rgba(20, 184, 166, 0.16)", color: "#2dd4bf" },
  { key: "history", labelKey: "deck.accentHistory", icon: "school-outline", background: "rgba(245, 158, 11, 0.16)", color: "#fbbf24" },
  { key: "biology", labelKey: "deck.accentBiology", icon: "leaf-outline", background: "rgba(34, 197, 94, 0.16)", color: "#4ade80" },
  { key: "physics", labelKey: "deck.accentPhysics", icon: "pulse-outline", background: "rgba(239, 68, 68, 0.16)", color: "#f87171" },
  { key: "chemistry", labelKey: "deck.accentChemistry", icon: "flask-outline", background: "rgba(168, 85, 247, 0.16)", color: "#a855f7" },
  { key: "music", labelKey: "deck.accentMusic", icon: "musical-notes-outline", background: "rgba(236, 72, 153, 0.16)", color: "#ec4899" },
  { key: "engineering", labelKey: "deck.accentEngineering", icon: "construct-outline", background: "rgba(99, 102, 241, 0.16)", color: "#818cf8" },
  { key: "dataScience", labelKey: "deck.accentDataScience", icon: "library-outline", background: "rgba(14, 165, 233, 0.16)", color: "#38bdf8" },
  { key: "psychology", labelKey: "deck.accentPsychology", icon: "body-outline", background: "rgba(244, 114, 182, 0.16)", color: "#f472b6" },
  { key: "economics", labelKey: "deck.accentEconomics", icon: "trending-up-outline", background: "rgba(34, 197, 94, 0.16)", color: "#22c55e" },
  { key: "law", labelKey: "deck.accentLaw", icon: "library-outline", background: "rgba(148, 163, 184, 0.16)", color: "#94a3b8" },
  { key: "philosophy", labelKey: "deck.accentPhilosophy", icon: "sparkles-outline", background: "rgba(168, 85, 247, 0.16)", color: "#c084fc" },
  { key: "literature", labelKey: "deck.accentLiterature", icon: "book-outline", background: "rgba(244, 63, 94, 0.16)", color: "#f43f5e" },
  { key: "sociology", labelKey: "deck.accentSociology", icon: "people-outline", background: "rgba(107, 114, 128, 0.16)", color: "#6b7280" },
  { key: "politicalScience", labelKey: "deck.accentPoliticalScience", icon: "business-outline", background: "rgba(217, 119, 6, 0.16)", color: "#ea580c" },
];

export const DEFAULT_DECK_ACCENT_KEY = "general";
