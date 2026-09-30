/**
 * Author Decks Grid - Display user's public decks
 */

import { useTranslation } from 'react-i18next';
import { BookOpen } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthorDecks } from '../hooks/use-author-profile';

export interface AuthorDecksGridProps {
  userId: string;
  onDeckClick?: (deckId: string) => void;
}

export function AuthorDecksGrid({ userId, onDeckClick }: AuthorDecksGridProps) {
  const { t } = useTranslation();

  const { data: decksData, error, isLoading } = useAuthorDecks(userId, { limit: 12 });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-48 bg-muted rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">{error.message}</p>
      </div>
    );
  }

  const decks = decksData?.decks || [];

  if (decks.length === 0) {
    return (
      <div className="text-center py-12">
        <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold mb-2">{t('users.decks.empty.title')}</h3>
        <p className="text-sm text-muted-foreground">{t('users.decks.empty.description')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {decks.map((deck) => (
          <Card
            key={deck.id}
            className="group hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => onDeckClick?.(deck.id)}
          >
            <CardContent className="p-4">
              <div className="space-y-2">
                <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                  {deck.name}
                </h3>
                {deck.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {deck.description}
                  </p>
                )}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{deck.cardCount} cards</span>
                  <span>{deck.downloadCount} downloads</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {decksData && decksData.total > decks.length && (
        <div className="text-center">
          <Button variant="outline">
            {t('users.decks.loadMore')}
          </Button>
        </div>
      )}
    </div>
  );
}
