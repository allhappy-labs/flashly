export const FLASHLY_NATIVE_APP_URL = 'flashly://';

export type NativeDeckRoute = 'overview' | 'study' | 'learn' | 'browse' | 'match' | 'write' | 'test';

export function buildNativeDeckDeepLink(deckId: string, route: NativeDeckRoute = 'study') {
  const normalizedDeckId = deckId.trim();
  if (!normalizedDeckId) {
    return FLASHLY_NATIVE_APP_URL;
  }

  return `${FLASHLY_NATIVE_APP_URL}decks/${encodeURIComponent(normalizedDeckId)}/${route}`;
}

export function buildNativeDecksDeepLink() {
  return `${FLASHLY_NATIVE_APP_URL}decks`;
}

export function openNativeDeepLink(url: string) {
  if (typeof window === 'undefined') {
    return;
  }

  window.location.href = url;
}

export function openNativeLearningApp() {
  openNativeDeepLink(FLASHLY_NATIVE_APP_URL);
}

export function openNativeDeckLearning(deckId: string) {
  openNativeDeepLink(buildNativeDeckDeepLink(deckId, 'study'));
}

export function openNativeDecksList() {
  openNativeDeepLink(buildNativeDecksDeepLink());
}
