/**
 * CardListBatch - Card list with batch selection mode
 */

import { useTranslation } from 'react-i18next';
import { MoreVertical, ArrowUp, ArrowDown } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Card as CardType } from '@/types/api.types';

export interface CardListBatchProps {
  cards: CardType[];
  onEdit: (card: CardType) => void;
  onDelete: (card: CardType) => void;
  onMoveUp?: (card: CardType) => void;
  onMoveDown?: (card: CardType) => void;
  deletingCardId?: string;
  isLoading?: boolean;
  // Batch mode props
  selectionMode: boolean;
  selectedIds: Set<string>;
  onToggleSelection: (cardId: string) => void;
  onToggleSelectAll: () => void;
  isAllSelected: boolean;
}

export function CardListBatch({
  cards,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  deletingCardId,
  isLoading = false,
  selectionMode,
  selectedIds,
  onToggleSelection,
  onToggleSelectAll,
  isAllSelected,
}: CardListBatchProps) {
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
      {/* Select all checkbox (only shown in selection mode) */}
      {selectionMode && cards.length > 0 && (
        <div className="flex items-center gap-2 p-2 bg-muted rounded">
          <Checkbox
            checked={isAllSelected}
            onCheckedChange={onToggleSelectAll}
            aria-label={t('decks.cards.bulk.selectAll')}
          />
          <span className="text-sm font-medium">
            {selectedIds.size > 0
              ? `${selectedIds.size} ${t('decks.cards.bulk.selected')}`
              : t('decks.cards.bulk.selectAll')}
          </span>
        </div>
      )}

      {cards.map((card, index) => {
        const isSelected = selectedIds.has(card.id);

        return (
          <Card
            key={card.id}
            className={`group hover:shadow-md transition-shadow ${
              selectionMode ? 'cursor-pointer' : ''
            } ${isSelected ? 'ring-2 ring-primary' : ''}`}
            onClick={() => selectionMode && onToggleSelection(card.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                {/* Checkbox (selection mode) */}
                {selectionMode && (
                  <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleSelection(card.id)}
                      aria-label={`Select card ${index + 1}`}
                    />
                  </div>
                )}

                {/* Card content */}
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

                {/* Actions (not in selection mode) */}
                {!selectionMode && (
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
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
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
