export const queryKeys = {
  analytics: {
    deck: (deckId: string) => ['analytics', 'deck', deckId] as const,
    mastery: (deckId: string) => ['analytics', 'mastery', deckId] as const,
    studyTime: (days: number) => ['analytics', 'study-time', days] as const,
    user: ['analytics', 'user'] as const,
  },
  categories: {
    decks: (slug: string, params?: Record<string, unknown>) => ['categories', 'decks', slug, params ?? {}] as const,
    list: ['categories', 'list'] as const,
    tree: ['categories', 'tree'] as const,
  },
  decks: {
    byId: (deckId: string) => ['decks', 'by-id', deckId] as const,
    list: (params?: Record<string, unknown>) => ['decks', 'list', params ?? {}] as const,
    marketplace: (params?: Record<string, unknown>) => ['decks', 'marketplace', params ?? {}] as const,
  },
  ratings: {
    deck: (deckId: string) => ['ratings', 'deck', deckId] as const,
    reviews: (deckId: string, params?: Record<string, unknown>) => ['ratings', 'reviews', deckId, params ?? {}] as const,
    user: (deckId: string) => ['ratings', 'user', deckId] as const,
  },
  search: {
    suggestions: (query: string, limit: number) => ['search', 'suggestions', query, limit] as const,
  },
  templates: {
    list: ['templates', 'list'] as const,
  },
  users: {
    decks: (userId: string, params?: Record<string, unknown>) => ['users', 'decks', userId, params ?? {}] as const,
    followers: (userId: string, params?: Record<string, unknown>) => ['users', 'followers', userId, params ?? {}] as const,
    following: (userId: string, params?: Record<string, unknown>) => ['users', 'following', userId, params ?? {}] as const,
    profile: (userId: string) => ['users', 'profile', userId] as const,
  },
};
