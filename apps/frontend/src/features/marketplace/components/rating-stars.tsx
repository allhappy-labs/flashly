/**
 * RatingStars - Display star ratings
 */

import { Star, StarHalf } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface RatingStarsProps {
  rating: number;
  maxRating?: number;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  className?: string;
}

export function RatingStars({
  rating,
  maxRating = 5,
  size = 'md',
  showValue = false,
  className,
}: RatingStarsProps) {
  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const renderStars = () => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < maxRating; i++) {
      if (i < fullStars) {
        // Full star
        stars.push(
          <Star
            key={i}
            className={cn(sizeClasses[size], 'fill-yellow-400 text-yellow-400')}
          />
        );
      } else if (i === fullStars && hasHalfStar) {
        // Half star
        stars.push(
          <StarHalf
            key={i}
            className={cn(sizeClasses[size], 'fill-yellow-400 text-yellow-400')}
          />
        );
      } else {
        // Empty star
        stars.push(
          <Star
            key={i}
            className={cn(sizeClasses[size], 'text-gray-300 dark:text-gray-600')}
          />
        );
      }
    }

    return stars;
  };

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {renderStars()}
      {showValue && (
        <span className="ml-1 text-sm font-medium">{rating.toFixed(1)}</span>
      )}
    </div>
  );
}
