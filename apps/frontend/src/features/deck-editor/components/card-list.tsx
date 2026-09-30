/**
 * CardList - List of cards in a deck
 */

import { useTranslation } from 'react-i18next';
import { MoreVertical, ArrowUp, ArrowDown } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Card as CardType } from '@/types/api.types';

export interface CardListProps {
  cards: CardType[];
  onEdit: (card: CardType) => void;
  onDelete: (card: CardType) => void;
  onMoveUp?: (card: CardType) => void;
  onMoveDown?: (card: CardType) => void;
  deletingCardId?: string;
  isLoading?: boolean;
}

export function CardList({
  cards,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  deletingCardId,
  isLoading = false,
}: CardListProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-32 bg-muted rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">📝</div>
        <h3 className="text-lg font-semibold mb-2">{t('decks.cards.empty.title')}</h3>
        <p className="text-sm text-muted-foreground">{t('decks.cards.empty.description')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {cards.map((card, index) => (
        <Card
          key={card.id}
          className="group hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => onEdit(card)}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-muted-foreground">#{index + 1}</span>
                  {card.category && (
                    <Badge variant="secondary" className="text-xs">
                      {card.category}
                    </Badge>
                  )}
                  {card.pos && (
                    <Badge variant="outline" className="text-xs">
                      {card.pos}
                    </Badge>
                  )}
                  {card.gender && (
                    <Badge variant="outline" className="text-xs">
                      {card.gender}
                    </Badge>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="font-medium line-clamp-2">{card.front}</p>
                  <p className="text-sm text-muted-foreground line-clamp-2">{card.back}</p>
                </div>
                {(card.imageUrl || card.audioUrl) && (
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    {card.imageUrl && <span>🖼️ Image</span>}
                    {card.audioUrl && <span>🔊 Audio</span>}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1">
                {/* Reorder buttons */}
                {onMoveUp && index > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveUp(card);
                    }}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                )}
                {onMoveDown && index < cards.length - 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveDown(card);
                    }}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                )}

                {/* More options */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(card)}>
                      {t('common.edit')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onDelete(card)}
                      disabled={deletingCardId === card.id}
                      className="text-destructive focus:text-destructive"
                    >
                      {t('common.delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
