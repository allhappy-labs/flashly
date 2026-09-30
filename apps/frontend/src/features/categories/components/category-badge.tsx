/**
 * Category Badge - Display category badge with icon
 */

import * as React from 'react';
import { Folder } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { Category } from '../types/category.types';

export interface CategoryBadgeProps {
  category: Category | null;
  className?: string;
  showIcon?: boolean;
}

export function CategoryBadge({
  category,
  className,
  showIcon = false,
}: CategoryBadgeProps) {
  if (!category) {
    return null;
  }

  return (
    <Badge variant="secondary" className={className}>
      {showIcon && <Folder className="h-3 w-3 mr-1" />}
      {category.name}
    </Badge>
  );
}
