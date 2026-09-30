/**
 * UnsavedChangesBanner - Banner warning about unsaved changes
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Save, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { UnsavedChangesBannerProps } from '../types/editor.types';

export function UnsavedChangesBanner({
  hasChanges,
  onDiscard,
  onSave,
  isSaving = false,
}: UnsavedChangesBannerProps) {
  const { t } = useTranslation();

  if (!hasChanges) return null;

  return (
    <Alert variant="default" className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
      <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
      <AlertTitle className="text-yellow-800 dark:text-yellow-500">
        {t('decks.unsavedChanges')}
      </AlertTitle>
      <AlertDescription className="mt-2">
        <div className="space-y-3">
          <p className="text-sm text-yellow-700 dark:text-yellow-400">
            {t('decks.unsavedChangesWarning')}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onDiscard}
              className="h-8"
              disabled={isSaving}
            >
              <X className="h-4 w-4 mr-1" />
              {t('common.discard')}
            </Button>
            <Button size="sm" onClick={onSave} className="h-8" disabled={isSaving}>
              <Save className="h-4 w-4 mr-1" />
              {isSaving ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}
