/**
 * Template Types
 */

export interface Template {
  id: string;
  name: string;
  description: string | null;
  materialType: string | null;
  deckType: string | null;
  locale: string | null;
  cardCount: number;
  downloadCount: number;
  previewCards: Array<{
    front: string;
    back: string;
    imageUrl: string | null;
    category: string | null;
  }>;
}
