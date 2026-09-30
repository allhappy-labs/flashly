/**
 * Category Types
 */

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  icon: string | null;
  displayOrder: number;
  deckCount: number;
  createdAt: Date | string;
}

export interface CategoryTree {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  icon: string | null;
  displayOrder: number;
  deckCount: number;
  createdAt: Date | string;
  children: CategoryTree[];
}

export interface CategoryDecksResponse {
  decks: Array<{
    id: string;
    name: string;
    description: string | null;
    cardCount: number;
    downloadCount: number;
    viewCount: number;
  }>;
  total: number;
}
