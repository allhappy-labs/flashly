/**
 * Template Gallery - Display available templates
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Wand2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { TemplateCard } from './template-card';
import { CreateFromTemplateDialog } from './create-from-template-dialog';
import { useTemplates } from '../hooks/use-templates';
import type { Template } from '../types/template.types';

export function TemplateGallery({ onDeckCreated }: { onDeckCreated: (deckId: string) => void }) {
  const { t } = useTranslation();
  const [selectedTemplate, setSelectedTemplate] = React.useState<Template | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const { data: templates, error, isLoading } = useTemplates();

  const handleSelectTemplate = (templateId: string) => {
    const template = templates?.find((t) => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
      setDialogOpen(true);
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-64 bg-muted rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">{error.message}</p>
      </div>
    );
  }

  if (!templates || templates.length === 0) {
    return (
      <div className="text-center py-12">
        <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold mb-2">{t('templates.empty.title')}</h3>
        <p className="text-sm text-muted-foreground">{t('templates.empty.description')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Wand2 className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">{t('templates.title')}</h2>
        </div>
        <p className="text-muted-foreground">{t('templates.description')}</p>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onSelect={handleSelectTemplate}
          />
        ))}
      </div>

      {/* Create Dialog */}
      {selectedTemplate && (
        <CreateFromTemplateDialog
          template={selectedTemplate}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onDeckCreated={(deckId) => {
            setDialogOpen(false);
            setSelectedTemplate(null);
            onDeckCreated(deckId);
            toast.success(t('templates.created.success'));
          }}
        />
      )}
    </div>
  );
}
