const DECK_MODE_TO_SCREEN = {
  browse: 'Browse',
  learn: 'LearnSetup',
  match: 'Match',
  overview: 'DeckOverview',
  study: 'Study',
  test: 'Test',
  write: 'Write',
} as const;

type DeckMode = keyof typeof DECK_MODE_TO_SCREEN;

export type DeckDeepLinkTarget =
  | { screen: 'DeckList' }
  | {
      screen: (typeof DECK_MODE_TO_SCREEN)[DeckMode] | 'DeckOverview';
      params: { deckId: string };
    };

export type AuthDeepLinkParams = Readonly<{
  token: string | null;
  ott: string | null;
  error: string | null;
  errorDescription: string | null;
}>;

function isDeckMode(value: string | undefined): value is DeckMode {
  return typeof value === 'string' && value in DECK_MODE_TO_SCREEN;
}

function decodeUrlSegment(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function getFlashlySegments(url: string) {
  if (!url.toLowerCase().startsWith('flashly://')) {
    return [];
  }

  const withoutScheme = url.slice('flashly://'.length);
  const pathOnly = withoutScheme.split(/[?#]/, 1)[0] ?? '';

  return pathOnly
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map(decodeUrlSegment);
}

function readParam(inputUrl: string, key: string): string | null {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`[?#&]${escapedKey}=([^&#]+)`, 'i');
  const match = inputUrl.match(pattern);
  if (!match) {
    return null;
  }

  try {
    return decodeURIComponent(match[1] ?? '');
  } catch {
    return match[1] ?? null;
  }
}

export function isImportFileLink(url: string): boolean {
  const trimmedUrl = url.trim();
  if (/^content:\/\/[^/?#]+(?:[/?#]|$)/i.test(trimmedUrl)) {
    return true;
  }
  if (!/^file:\/\//i.test(trimmedUrl)) {
    return false;
  }

  const pathOnly = trimmedUrl.split(/[?#]/, 1)[0] ?? '';
  const decodedPath = decodeUrlSegment(pathOnly);
  return decodedPath.toLowerCase().endsWith('.flashly');
}

export function isAuthDeepLink(url: string): boolean {
  return url.includes('flashly://auth');
}

export function parseAuthDeepLink(url: string): AuthDeepLinkParams | null {
  if (!isAuthDeepLink(url)) {
    return null;
  }

  return {
    token: readParam(url, 'token'),
    ott: readParam(url, 'ott'),
    error: readParam(url, 'error'),
    errorDescription:
      readParam(url, 'error_description')
      ?? readParam(url, 'errorDescription')
      ?? readParam(url, 'message')
      ?? readParam(url, 'reason'),
  };
}

export function resolveDeckDeepLink(url: string): DeckDeepLinkTarget | null {
  const segments = getFlashlySegments(url);
  if (segments[0]?.toLowerCase() !== 'decks') {
    return null;
  }

  if (segments.length === 1) {
    return { screen: 'DeckList' };
  }

  const deckId = segments[1];
  if (!deckId) {
    return { screen: 'DeckList' };
  }

  const routeSegment = segments[2]?.toLowerCase();
  const screen = isDeckMode(routeSegment) ? DECK_MODE_TO_SCREEN[routeSegment] : undefined;

  return {
    screen: screen ?? 'DeckOverview',
    params: { deckId },
  };
}
