/**
 * ReviewsSection - Display all reviews for a deck
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpDown, MessageSquare } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ReviewCard } from './review-card';
import { ReviewDialog } from './review-dialog';
import { RatingStars } from './rating-stars';
import { useReviews } from '../hooks/use-reviews';
import { useMarkReviewHelpful } from '../hooks/use-mark-review-helpful';
import { useSubmitReview } from '../hooks/use-submit-review';

export interface ReviewsSectionProps {
  deckId: string;
  stats?: {
    averageRating: number;
    totalRatings: number;
    distribution: {
      1: number;
      2: number;
      3: number;
      4: number;
      5: number;
    };
  };
}

export function ReviewsSection({ deckId, stats }: ReviewsSectionProps) {
  const { t } = useTranslation();
  const [reviewDialogOpen, setReviewDialogOpen] = React.useState(false);
  const [sortBy, setSortBy] = React.useState<'recent' | 'helpful'>('recent');
  const [page, setPage] = React.useState(1);

  const {
    data: reviewsData,
    isLoading,
  } = useReviews(deckId, { page, limit: 10, sortBy });

  const { mutate: markHelpful, isPending: isMarking } = useMarkReviewHelpful();
  const { mutate: submitReview, isPending: isSubmitting } = useSubmitReview({
    onSuccess: () => {
      setReviewDialogOpen(false);
    },
  });

  const handleMarkHelpful = (reviewId: string) => {
    markHelpful({ reviewId, deckId });
  };

  const handleSubmitReview = (data: { rating: number; title?: string; content: string }) => {
    submitReview({ deckId, input: data });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 bg-muted rounded animate-pulse" />
        ))}
      </div>
    );
  }

  const totalReviews = reviewsData?.total || 0;
  const totalPages = reviewsData?.totalPages || 1;
  const reviews = reviewsData?.reviews || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          <h2 className="text-xl font-semibold">
            {t('reviews.title')} ({totalReviews})
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {/* Sort */}
          <Select value={sortBy} onValueChange={(value: 'recent' | 'helpful') => setSortBy(value)}>
            <SelectTrigger className="w-[140px]">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">{t('reviews.sort.recent')}</SelectItem>
              <SelectItem value="helpful">{t('reviews.sort.helpful')}</SelectItem>
            </SelectContent>
          </Select>

          {/* Write Review Button */}
          <Button onClick={() => setReviewDialogOpen(true)}>
            {t('reviews.write.button')}
          </Button>
        </div>
      </div>

      {/* Rating Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-muted rounded-lg">
          {/* Average Rating */}
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-4xl font-bold">{stats.averageRating.toFixed(1)}</div>
              <RatingStars rating={stats.averageRating} size="sm" />
              <div className="text-sm text-muted-foreground mt-1">
                {stats.totalRatings} {t('reviews.ratings')}
              </div>
            </div>
          </div>

          {/* Distribution */}
          <div className="space-y-1">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = stats.distribution[star as keyof typeof stats.distribution];
              const percentage = stats.totalRatings > 0 ? (count / stats.totalRatings) * 100 : 0;

              return (
                <div key={star} className="flex items-center gap-2 text-sm">
                  <span className="w-8">{star} ★</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-400 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-muted-foreground">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">{t('reviews.empty.title')}</h3>
          <p className="text-sm text-muted-foreground mb-4">{t('reviews.empty.description')}</p>
          <Button onClick={() => setReviewDialogOpen(true)}>
            {t('reviews.write.first')}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              {...review}
              onMarkHelpful={handleMarkHelpful}
              isMarkingHelpful={isMarking}
            />
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                {t('common.previous')}
              </Button>
              <span className="flex items-center px-4">
                {t('common.page')} {page} {t('common.of')} {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                {t('common.next')}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Review Dialog */}
      <ReviewDialog
        open={reviewDialogOpen}
        onOpenChange={setReviewDialogOpen}
        onSubmit={handleSubmitReview}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
