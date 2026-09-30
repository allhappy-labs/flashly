/**
 * Mastery Progress - Visualize learning progress
 */

import { useTranslation } from 'react-i18next';
import { GraduationCap, BookOpen, Sparkles } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export interface MasteryProgressProps {
  notStudied: number;
  learning: number;
  mastered: number;
  total?: number;
}

export function MasteryProgress({
  notStudied,
  learning,
  mastered,
  total,
}: MasteryProgressProps) {
  const { t } = useTranslation();

  const totalCards = total || notStudied + learning + mastered;
  const masteredPercent = totalCards > 0 ? Math.round((mastered / totalCards) * 100) : 0;
  const learningPercent = totalCards > 0 ? Math.round((learning / totalCards) * 100) : 0;
  const notStudiedPercent = totalCards > 0 ? Math.round((notStudied / totalCards) * 100) : 0;

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="font-semibold mb-4">{t('analytics.mastery.title')}</h3>

        <div className="space-y-4">
          {/* Mastered */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-emerald-500" />
                <span>{t('analytics.mastery.mastered')}</span>
              </div>
              <span className="font-medium">{mastered}</span>
            </div>
            <Progress value={masteredPercent} className="h-2" />
            <div className="text-xs text-muted-foreground text-right">
              {masteredPercent}%
            </div>
          </div>

          {/* Learning */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-blue-500" />
                <span>{t('analytics.mastery.learning')}</span>
              </div>
              <span className="font-medium">{learning}</span>
            </div>
            <Progress value={learningPercent} className="h-2" />
            <div className="text-xs text-muted-foreground text-right">
              {learningPercent}%
            </div>
          </div>

          {/* Not Studied */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-gray-400" />
                <span>{t('analytics.mastery.notStudied')}</span>
              </div>
              <span className="font-medium">{notStudied}</span>
            </div>
            <Progress value={notStudiedPercent} className="h-2" />
            <div className="text-xs text-muted-foreground text-right">
              {notStudiedPercent}%
            </div>
          </div>
        </div>

        {/* Summary */}
        {totalCards > 0 && (
          <div className="mt-6 pt-4 border-t">
            <div className="text-sm text-center">
              <span className="text-muted-foreground">{t('analytics.mastery.totalCards')}: </span>
              <span className="font-semibold">{totalCards}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
