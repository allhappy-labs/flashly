/**
 * Author Stats - Display author statistics
 */

import { useTranslation } from 'react-i18next';
import { BookOpen, Download, Users } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';

export interface AuthorStatsProps {
  deckCount: number;
  downloadCount: number;
  followerCount: number;
}

export function AuthorStats({
  deckCount,
  downloadCount,
  followerCount,
}: AuthorStatsProps) {
  const { t } = useTranslation();

  const stats = [
    {
      label: t('users.stats.decks'),
      value: deckCount,
      icon: BookOpen,
    },
    {
      label: t('users.stats.downloads'),
      value: downloadCount,
      icon: Download,
    },
    {
      label: t('users.stats.followers'),
      value: followerCount,
      icon: Users,
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="p-4 text-center">
            <stat.icon className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <div className="text-2xl font-bold">{stat.value}</div>
            <div className="text-xs text-muted-foreground">{stat.label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
