/**
 * Template Card - Display a template in the gallery
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Download } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Template } from '../types/template.types';

export interface TemplateCardProps {
  template: Template;
  onSelect: (templateId: string) => void;
}

export function TemplateCard({ template, onSelect }: TemplateCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="group hover:shadow-lg transition-all cursor-pointer">
      <CardContent className="p-4">
        <div className="space-y-3" onClick={() => onSelect(template.id)}>
          {/* Header */}
          <div className="space-y-1">
            <h3 className="font-semibold line-clamp-1 group-hover:text-primary transition-colors">
              {template.name}
            </h3>
            {template.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {template.description}
              </p>
            )}
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            {template.materialType && (
              <span className="text-xs px-2 py-1 bg-secondary rounded">
                {template.materialType}
              </span>
            )}
            {template.deckType && (
              <span className="text-xs px-2 py-1 bg-secondary rounded">
                {template.deckType}
              </span>
            )}
            {template.locale && (
              <span className="text-xs px-2 py-1 bg-secondary rounded">
                {template.locale.toUpperCase()}
              </span>
            )}
          </div>

          {/* Preview Cards */}
          {template.previewCards.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Preview:</p>
              {template.previewCards.slice(0, 2).map((card, index) => (
                <div
                  key={index}
                  className="text-xs p-2 bg-muted rounded truncate"
                >
                  <span className="font-medium">{card.front}</span>
                  {card.category && (
                    <span className="ml-2 text-muted-foreground">({card.category})</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <BookOpen className="h-3 w-3" />
              <span>{template.cardCount} cards</span>
            </div>
            <div className="flex items-center gap-1">
              <Download className="h-3 w-3" />
              <span>{template.downloadCount} used</span>
            </div>
          </div>
        </div>

        {/* Select Button */}
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onSelect(template.id);
          }}
          className="w-full"
          size="sm"
        >
          {t('templates.useTemplate')}
        </Button>
      </CardContent>
    </Card>
  );
}
