/**
 * Analytics Page - Display user learning analytics
 */

import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { BarChart3 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatsOverview } from '../components/stats-overview';
import { StudyTimeChart } from '../components/study-time-chart';
import { MasteryProgress } from '../components/mastery-progress';
import { DeckStatsCard } from '../components/deck-stats-card';
import { useUserStats, useStudyTimeData } from '../hooks/use-analytics';

export function AnalyticsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: userStats, error: statsError, isLoading: statsLoading } = useUserStats();
  const { data: studyTimeData, isLoading: studyTimeLoading } = useStudyTimeData(30);

  // Get user's decks for deck stats
  // TODO: Create a proper hook to get all user's decks with stats
  // For now, we'll use a placeholder
  const deckStats: Array<ComponentProps<typeof DeckStatsCard>> = [];

  if (statsError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto text-center py-12">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">{t('analytics.error.title')}</h2>
          <p className="text-muted-foreground">{statsError.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <BarChart3 className="h-6 w-6" />
              <h1 className="text-2xl font-bold">{t('analytics.title')}</h1>
            </div>
            <Button variant="outline" onClick={() => navigate({ to: '/my-decks' })}>
              {t('analytics.backToDecks')}
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {statsLoading ? (
          <div className="space-y-6">
            <div className="h-32 bg-muted rounded animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-64 bg-muted rounded animate-pulse" />
              <div className="h-64 bg-muted rounded animate-pulse" />
            </div>
          </div>
        ) : userStats ? (
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Stats Overview */}
            <StatsOverview
              totalDecks={userStats.totalDecks}
              totalCards={userStats.totalCards}
              cardsStudied={userStats.cardsStudied}
              cardsLearned={userStats.cardsLearned}
              averageAccuracy={userStats.averageAccuracy}
              studyStreak={userStats.studyStreak}
            />

            {/* Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Study Time Chart */}
              <StudyTimeChart data={studyTimeData || []} isLoading={studyTimeLoading} />

              {/* Weekly Summary */}
              <Card className="py-6">
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-4">{t('analytics.thisWeek.title')}</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{t('analytics.thisWeek.decksStudied')}</span>
                      <span className="font-semibold">{userStats.decksStudiedThisWeek}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{t('analytics.thisWeek.cardsStudied')}</span>
                      <span className="font-semibold">{userStats.cardsStudiedThisWeek}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{t('analytics.stats.streak')}</span>
                      <span className="font-semibold">{userStats.studyStreak} {t('analytics.days')}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Overall Mastery */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <MasteryProgress
                notStudied={userStats.totalCards - userStats.cardsStudied}
                learning={userStats.cardsReviewing}
                mastered={userStats.cardsLearned}
                total={userStats.totalCards}
              />
            </div>

            {/* Deck Stats */}
            {deckStats.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">{t('analytics.deckStats.title')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {deckStats.map((deck) => (
                    <DeckStatsCard key={deck.deckId} {...deck} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
