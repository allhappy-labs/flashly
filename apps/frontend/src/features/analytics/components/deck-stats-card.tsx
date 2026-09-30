/**
 * Deck Stats Card - Display statistics for a single deck
 */

import * as React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { BookOpen, Target, TrendingUp, Brain } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export interface DeckStatsCardProps {
  deckId: string;
  deckName: string;
  totalCards: number;
  cardsStudied: number;
  cardsLearned: number;
  cardsReviewing: number;
  averageAccuracy: number;
  masteryLevel: number;
  lastStudiedAt: Date | string | null;
}

export function DeckStatsCard({
  deckId,
  deckName,
  totalCards,
  cardsStudied,
  cardsLearned,
  cardsReviewing,
  averageAccuracy,
  masteryLevel,
  lastStudiedAt,
}: DeckStatsCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const studiedPercent = totalCards > 0 ? Math.round((cardsStudied / totalCards) * 100) : 0;

  const formatDate = (date: Date | string | null) => {
    if (!date) return t('analytics.never');
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
      Math.floor((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      'day'
    );
  };

  return (
    <Card
      className="group hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => navigate({ to: `/deck-editor/${deckId}` })}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold line-clamp-1 group-hover:text-primary transition-colors">
                {deckName}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t('analytics.lastStudied')}: {formatDate(lastStudiedAt)}
              </p>
            </div>
          </div>

          {/* Mastery Level */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span>{t('analytics.masteryLevel')}</span>
              <span className="font-semibold">{masteryLevel}%</span>
            </div>
            <Progress value={masteryLevel} className="h-2" />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1">
              <BookOpen className="h-3 w-3 text-muted-foreground" />
              <span>{cardsStudied}/{totalCards} {t('analytics.cards')}</span>
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              <span>{cardsLearned} {t('analytics.mastered.short')}</span>
            </div>
            <div className="flex items-center gap-1">
              <Brain className="h-3 w-3 text-blue-500" />
              <span>{cardsReviewing} {t('analytics.learning.short')}</span>
            </div>
            <div className="flex items-center gap-1">
              <Target className="h-3 w-3 text-accent" />
              <span>{averageAccuracy}% {t('analytics.accuracy')}</span>
            </div>
          </div>

          {/* Studied Progress */}
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t('analytics.progress')}</span>
              <span className="font-medium">{studiedPercent}%</span>
            </div>
            <Progress value={studiedPercent} className="h-1 mt-1" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
