/**
 * Stats Overview - Display user statistics cards
 */

import { useTranslation } from 'react-i18next';
import { BookOpen, Brain, Target, TrendingUp, Flame } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';

export interface StatsOverviewProps {
  totalDecks: number;
  totalCards: number;
  cardsStudied: number;
  cardsLearned: number;
  averageAccuracy: number;
  studyStreak: number;
}

export function StatsOverview({
  totalDecks,
  totalCards,
  cardsStudied,
  cardsLearned,
  averageAccuracy,
  studyStreak,
}: StatsOverviewProps) {
  const { t } = useTranslation();

  const stats = [
    {
      label: t('analytics.stats.decks'),
      value: totalDecks,
      icon: BookOpen,
      color: 'text-blue-500',
    },
    {
      label: t('analytics.stats.cards'),
      value: totalCards,
      icon: Brain,
      color: 'text-purple-500',
    },
    {
      label: t('analytics.stats.studied'),
      value: cardsStudied,
      icon: Target,
      color: 'text-green-500',
    },
    {
      label: t('analytics.stats.mastered'),
      value: cardsLearned,
      icon: TrendingUp,
      color: 'text-emerald-500',
    },
    {
      label: t('analytics.stats.accuracy'),
      value: `${averageAccuracy}%`,
      icon: Brain,
      color: 'text-accent',
    },
    {
      label: t('analytics.stats.streak'),
      value: studyStreak,
      icon: Flame,
      color: 'text-red-500',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="p-4">
            <stat.icon className={`h-5 w-5 ${stat.color} mb-2`} />
            <div className="text-2xl font-bold">{stat.value}</div>
            <div className="text-xs text-muted-foreground">{stat.label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
