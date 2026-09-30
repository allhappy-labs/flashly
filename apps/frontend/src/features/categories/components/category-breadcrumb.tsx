/**
 * Category Breadcrumb - Display breadcrumb navigation for categories
 */

import * as React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ChevronRight, Home } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useCategoryTree } from '../hooks/use-categories';
import type { CategoryTree } from '../types/category.types';

export interface CategoryBreadcrumbProps {
  currentSlug?: string | null;
  onCategoryClick?: (slug: string) => void;
}

export function CategoryBreadcrumb({ currentSlug, onCategoryClick }: CategoryBreadcrumbProps) {
  const navigate = useNavigate();
  const { data: categories } = useCategoryTree();

  // Build breadcrumb path
  const buildPath = (categories: CategoryTree[], targetSlug: string): CategoryTree[] => {
    for (const category of categories) {
      if (category.slug === targetSlug) {
        return [category];
      }

      if (category.children.length > 0) {
        const childPath = buildPath(category.children, targetSlug);
        if (childPath.length > 0) {
          return [category, ...childPath];
        }
      }
    }

    return [];
  };

  const handleClick = (slug: string) => {
    if (onCategoryClick) {
      onCategoryClick(slug);
    } else {
      navigate({ to: `/categories/${slug}` });
    }
  };

  if (!currentSlug || !categories) {
    return null;
  }

  const path = buildPath(categories, currentSlug);

  if (path.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2"
        onClick={() => handleClick('')}
      >
        <Home className="h-4 w-4" />
      </Button>

      {path.map((category) => (
        <React.Fragment key={category.id}>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => handleClick(category.slug)}
          >
            {category.name}
          </Button>
        </React.Fragment>
      ))}
    </div>
  );
}
