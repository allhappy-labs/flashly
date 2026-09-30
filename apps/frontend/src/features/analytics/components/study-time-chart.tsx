/**
 * Study Time Chart - Display study activity over time
 */

import { useTranslation } from 'react-i18next';
import { Calendar } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';

export interface StudyTimeData {
  date: string;
  studyTime: number; // in minutes
  cardsStudied: number;
}

export interface StudyTimeChartProps {
  data: StudyTimeData[];
  isLoading?: boolean;
}

export function StudyTimeChart({ data, isLoading = false }: StudyTimeChartProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="h-64 bg-muted rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="h-64 flex items-center justify-center text-center">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">{t('analytics.noStudyData.title')}</h3>
            <p className="text-sm text-muted-foreground">{t('analytics.noStudyData.description')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Find max values for scaling
  const maxStudyTime = Math.max(...data.map((d) => d.studyTime), 1);

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="font-semibold mb-4">{t('analytics.studyTime.title')}</h3>

        <div className="space-y-2">
          {data.map((day) => {
            const heightPercent = (day.studyTime / maxStudyTime) * 100;
            const studyMinutes = Math.round(day.studyTime);

            return (
              <div key={day.date} className="flex items-center gap-3">
                <div className="w-20 text-xs text-muted-foreground shrink-0">
                  {new Date(day.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                </div>
                <div className="flex-1 h-8 bg-muted rounded relative overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-primary rounded transition-all"
                    style={{ width: `${heightPercent}%` }}
                  />
                  <div className="absolute inset-0 flex items-center px-2 text-xs font-medium text-white mix-blend-difference">
                    {studyMinutes} min
                  </div>
                </div>
                <div className="w-16 text-xs text-right shrink-0">
                  {day.cardsStudied} {t('analytics.cards')}
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t('analytics.totalStudyTime')}</span>
          <span className="font-semibold">
            {Math.round(data.reduce((sum, d) => sum + d.studyTime, 0))} min
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
