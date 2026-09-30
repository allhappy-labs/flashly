import { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { cn } from '@/utils/style-utils';

interface ImageWithLoadingProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
}

export function ImageWithLoading({
  src,
  alt,
  className,
  loading = 'lazy',
}: ImageWithLoadingProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // No source - show Search icon immediately
  if (!src) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-muted text-muted-foreground',
          className
        )}
        role="img"
        aria-label={alt}
      >
        <Search className="h-8 w-8 opacity-50" />
      </div>
    );
  }

  // Error state - show Search icon
  if (hasError) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-muted text-muted-foreground',
          className
        )}
        role="img"
        aria-label={alt}
      >
        <Search className="h-8 w-8 opacity-50" />
      </div>
    );
  }

  // Loading or loaded state
  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Shimmer gradient background + centered spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-r from-muted via-muted-foreground/10 to-muted animate-pulse" />
          <Loader2 className="relative h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Actual image with fade-in */}
      <img
        src={src}
        alt={alt}
        loading={loading}
        className={cn(
          'h-full w-full object-cover transition-opacity duration-300',
          isLoading ? 'opacity-0' : 'opacity-100'
        )}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
      />
    </div>
  );
}
