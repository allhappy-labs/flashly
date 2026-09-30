/**
 * ReviewCard - Display a single review
 */

import { useTranslation } from 'react-i18next';
import { ThumbsUp, User } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RatingStars } from './rating-stars';

export interface ReviewCardProps {
  id: string;
  userId: string;
  rating: number;
  title: string | null;
  content: string;
  helpfulCount: number;
  createdAt: Date | string;
  authorName: string | null;
  onMarkHelpful?: (reviewId: string) => void;
  isMarkingHelpful?: boolean;
  canMarkHelpful?: boolean;
}

export function ReviewCard({
  id,
  rating,
  title,
  content,
  helpfulCount,
  createdAt,
  authorName,
  onMarkHelpful,
  isMarkingHelpful = false,
  canMarkHelpful = true,
}: ReviewCardProps) {
  const { t } = useTranslation();

  const createdDate = new Date(createdAt);
  const timeAgo = Number.isNaN(createdDate.getTime())
    ? ''
    : new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(
      Math.round((createdDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      'day'
    );

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="font-medium">
                  {authorName || t('reviews.anonymous')}
                </span>
              </div>
              <RatingStars rating={rating} size="sm" />
              <span className="text-xs text-muted-foreground">{timeAgo}</span>
            </div>

            {/* Title */}
            {title && (
              <h4 className="font-semibold mb-1">{title}</h4>
            )}

            {/* Content */}
            <p className="text-sm text-muted-foreground line-clamp-4">{content}</p>
          </div>

          {/* Helpful button */}
          {canMarkHelpful && onMarkHelpful && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMarkHelpful(id)}
              disabled={isMarkingHelpful}
              className="shrink-0"
            >
              <ThumbsUp className="h-4 w-4 mr-1" />
              {helpfulCount}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
