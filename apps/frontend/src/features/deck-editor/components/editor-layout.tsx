/**
 * EditorLayout - Two-column layout for deck editor
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';

import { Button } from '@/components/ui/button';
import type { EditorLayoutProps } from '../types/editor.types';

export function EditorLayout({ children }: EditorLayoutProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate({ to: '/my-decks' })}
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">{t('common.back')}</span>
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{t('decks.editorTitle')}</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Metadata (1/3) */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              {React.Children.toArray(children)[0]}
            </div>
          </div>

          {/* Right Column - Cards (2/3) */}
          <div className="lg:col-span-2">
            {React.Children.toArray(children)[1] || (
              <div className="text-center py-12 text-muted-foreground">
                {t('decks.cardsPlaceholder')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
