/**
 * Category Sidebar - Display hierarchical category navigation
 */

import * as React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Folder } from 'lucide-react';
import { clsx } from 'clsx';

import { ScrollArea } from '@/components/ui/scroll-area';
import { useCategoryTree } from '../hooks/use-categories';
import type { CategoryTree } from '../types/category.types';

export interface CategorySidebarProps {
  currentCategory?: string | null;
  onCategoryChange?: (slug: string) => void;
}

export function CategorySidebar({ currentCategory, onCategoryChange }: CategorySidebarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: categories, isLoading } = useCategoryTree();

  const handleCategoryClick = (slug: string) => {
    if (onCategoryChange) {
      onCategoryChange(slug);
    } else {
      navigate({ to: `/categories/${slug}` });
    }
  };

  const renderCategory = (category: CategoryTree, depth = 0) => {
    const isActive = currentCategory === category.slug;
    const hasChildren = category.children && category.children.length > 0;

    return (
      <div key={category.id}>
        <button
          onClick={() => handleCategoryClick(category.slug)}
          className={clsx(
            'w-full text-left px-3 py-2 rounded-md text-sm transition-colors hover:bg-accent/50 flex items-center gap-2',
            isActive && 'bg-accent font-medium'
          )}
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
        >
          {category.icon || <Folder className="h-4 w-4 shrink-0" />}
          <span className="flex-1 truncate">{category.name}</span>
          {category.deckCount > 0 && (
            <span className="text-xs text-muted-foreground">({category.deckCount})</span>
          )}
        </button>

        {hasChildren && (
          <div className="mt-1">
            {category.children.map((child) => renderCategory(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-8 bg-muted rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (!categories || categories.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        {t('categories.empty')}
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-8rem)]">
      <div className="p-4 space-y-1">
        <div className="mb-4">
          <h3 className="font-semibold mb-1">{t('categories.title')}</h3>
        </div>
        {categories.map((category) => renderCategory(category))}
      </div>
    </ScrollArea>
  );
}
