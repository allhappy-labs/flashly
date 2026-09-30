import type { ReactNode } from 'react';
import type { FlashcardsResponse } from '@flashly/shared/src';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MarkdownContent } from '@/components/ui/markdown';
import { ProgressStatusCard } from './progress-status-card';

type ProgressSection = Readonly<{
  key: 'flashcards' | 'audio' | 'images';
  title: string;
  progressPercent: number;
  footer: ReactNode;
}>;

type GenerationProgressModalProps = Readonly<{
  open: boolean;
  title: string;
  description: string;
  closeLabel: string;
  sections: ReadonlyArray<ProgressSection>;
  streamingPreviewLabel: string;
  previewCard: FlashcardsResponse['flashcards'][number] | null;
  interruptConfirmOpen: boolean;
  interruptTitle: string;
  interruptDescription: string;
  preserveLabel: string;
  preserveGeneratedOnInterrupt: boolean;
  continueLabel: string;
  interruptLabel: string;
  onCloseAttempt: () => void;
  onInterruptConfirmOpenChange: (open: boolean) => void;
  onPreserveChange: (next: boolean) => void;
  onInterruptConfirm: () => void;
}>;

export function GenerationProgressModal(props: GenerationProgressModalProps) {
  return (
    <>
      <Dialog
        open={props.open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            props.onCloseAttempt();
          }
        }}
      >
        <DialogContent
          className="max-w-2xl max-h-[90vh] overflow-y-auto"
          showCloseButton={false}
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            props.onCloseAttempt();
          }}
          onPointerDownOutside={(event) => {
            event.preventDefault();
            props.onCloseAttempt();
          }}
        >
          <DialogHeader>
            <DialogTitle>{props.title}</DialogTitle>
            <DialogDescription>{props.description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {props.sections.map((section) => (
              <ProgressStatusCard
                key={section.key}
                title={section.title}
                progressPercent={section.progressPercent}
                footer={section.footer}
              />
            ))}

            {props.previewCard && (
              <div className="space-y-2 rounded-xl border border-border/70 p-4">
                <div className="text-xs uppercase text-muted-foreground">
                  {props.streamingPreviewLabel}
                </div>
                <MarkdownContent value={props.previewCard.front ?? ''} className="font-medium" cloze />
                <MarkdownContent
                  value={props.previewCard.back ?? ''}
                  className="text-sm text-muted-foreground"
                  cloze
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={props.onCloseAttempt}>
              {props.closeLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={props.interruptConfirmOpen} onOpenChange={props.onInterruptConfirmOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{props.interruptTitle}</DialogTitle>
            <DialogDescription>{props.interruptDescription}</DialogDescription>
          </DialogHeader>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={props.preserveGeneratedOnInterrupt}
              onCheckedChange={props.onPreserveChange}
            />
            <span>{props.preserveLabel}</span>
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => props.onInterruptConfirmOpenChange(false)}>
              {props.continueLabel}
            </Button>
            <Button type="button" variant="destructive" onClick={props.onInterruptConfirm}>
              {props.interruptLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
