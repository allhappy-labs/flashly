import { memo, useEffect, useState } from 'react';
import { AlertCircle, Search, Trash2 } from 'lucide-react';
import type { FlashcardsResponse, MediaFailure, QuizEnrichment } from '@flashly/shared/src';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MarkdownContent } from '@/components/ui/markdown';
import { ImageWithLoading } from '@/components/ui/image-with-loading';
import { AudioProgressButton } from './audio-progress-button';
import { GenderIconButton } from './gender-icon-button';
import { QuizEnrichmentEditor, type QuizEnrichmentEditorLabels } from './quiz-enrichment-editor';
import type { AudioPlaybackState } from '../use-audio-preview-player';

export type FlashcardPreviewLabels = {
  pos: string;
  category: string;
  gender: string;
  playAudio: string;
  stopAudio: string;
  audioError: string;
  imageError: string;
  imageAlt: (front: string) => string;
  editFront: string;
  frontPlaceholder: string;
  deleteCard: string;
    quiz: QuizEnrichmentEditorLabels;
};

type FlashcardPreviewCardProps = {
  cardIndex: number;
  card: FlashcardsResponse['flashcards'][number];
  audioState: AudioPlaybackState;
  onToggleAudio: (url: string) => void;
  onImageClick?: (card: FlashcardsResponse['flashcards'][number]) => void;
  onUpdateFront: (index: number, front: string) => void;
  onRemoveCard: (index: number) => void;
  labels: FlashcardPreviewLabels;
  audioFailure?: MediaFailure;
  imageFailure?: MediaFailure;
  isRetrying?: boolean;
    allowCardEditing?: boolean;
    allowCardRemoval?: boolean;
    onUpdateQuiz?: (index: number, quiz: QuizEnrichment) => void;
    onRemoveQuiz?: (index: number) => void;
    onRegenerateQuiz?: (index: number) => void;
    isRegeneratingQuiz?: boolean;
    isQuizMutationDisabled?: boolean;
};

const FlashcardPreviewCard = memo(
  function FlashcardPreviewCard(props: Readonly<FlashcardPreviewCardProps>) {
    const [isEditingFront, setIsEditingFront] = useState(false);
    const [frontDraft, setFrontDraft] = useState(props.card.front ?? '');
    const audioUrl = typeof props.card.audioUrl === 'string' ? props.card.audioUrl.trim() : '';
    const hasAudio = audioUrl.length > 0;
    const isActive = hasAudio && props.audioState.activeUrl === audioUrl;
    const progress = isActive ? props.audioState.progress : 0;
    const isPlaying = isActive && props.audioState.isPlaying;
    const imageUrl = typeof props.card.imageUrl === 'string' ? props.card.imageUrl.trim() : '';
    const pos = typeof props.card.pos === 'string' ? props.card.pos.trim() : '';
    const category = typeof props.card.category === 'string' ? props.card.category.trim() : '';
    const gender = typeof props.card.gender === 'string' ? props.card.gender.trim() : '';
    const hasMeta = Boolean(pos || category);
    const hasFailures = Boolean(props.audioFailure || props.imageFailure);

    useEffect(() => {
      if (isEditingFront) {
        return;
      }
      setFrontDraft(props.card.front ?? '');
    }, [props.card.front, isEditingFront]);

    const commitFrontEdit = () => {
      const nextFront = frontDraft.trim();
      if (!nextFront) {
        setFrontDraft(props.card.front ?? '');
        setIsEditingFront(false);
        return;
      }
      const currentFront = (props.card.front ?? '').trim();
      if (nextFront !== currentFront) {
        props.onUpdateFront(props.cardIndex, nextFront);
      }
      setIsEditingFront(false);
    };

    return (
      <Card className={`p-0 ${hasFailures ? 'border-destructive/50 bg-destructive/5' : ''}`}>
        <CardContent className="p-4 space-y-3">
          {(props.audioFailure || props.imageFailure) && (
            <div className="flex items-center gap-2 text-destructive text-xs">
              <AlertCircle className="h-3 w-3" />
              <span>
                {props.audioFailure && props.labels.audioError}
                {props.audioFailure && props.imageFailure && ' • '}
                {props.imageFailure && props.labels.imageError}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => props.onImageClick?.(props.card)}
            className="relative overflow-hidden rounded-md border border-border/60 hover:border-primary/50 transition-colors group w-full"
          >
              <div className="h-32 w-full">
                <ImageWithLoading
                  src={imageUrl || null}
                  alt={props.labels.imageAlt(props.card.front ?? '')}
                  className="h-32 w-full"
                  loading="lazy"
                />
              </div>
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <Search className="h-8 w-8 text-white drop-shadow-lg" />
              </div>
          </button>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2 min-w-0 flex-1">
                            {isEditingFront && props.allowCardEditing !== false ? (
                <Input
                  value={frontDraft}
                  onChange={(event) => setFrontDraft(event.target.value)}
                  onBlur={commitFrontEdit}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      event.currentTarget.blur();
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      setFrontDraft(props.card.front ?? '');
                      setIsEditingFront(false);
                    }
                  }}
                  autoFocus
                  placeholder={props.labels.frontPlaceholder}
                  aria-label={props.labels.editFront}
                />
                            ) : props.allowCardEditing === false ? (
                                <MarkdownContent value={props.card.front ?? ''} className="font-medium" cloze />
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setIsEditingFront(true)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setIsEditingFront(true);
                    }
                  }}
                  className="cursor-text rounded-sm px-1 -mx-1 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={props.labels.editFront}
                >
                  <MarkdownContent value={props.card.front ?? ''} className="font-medium" cloze />
                </div>
              )}
                            <MarkdownContent
                                value={props.card.back ?? ''}
                                className="text-sm text-muted-foreground"
                                cloze
                            />
            </div>
            <div className="flex items-center gap-2">
                            {props.allowCardRemoval !== false ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => props.onRemoveCard(props.cardIndex)}
                aria-label={props.labels.deleteCard}
                title={props.labels.deleteCard}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              ) : null}
                            {gender ? <GenderIconButton gender={gender} size={36} /> : null}
              {hasAudio ? (
                <AudioProgressButton
                  isPlaying={isPlaying}
                  progress={progress}
                  onClick={() => props.onToggleAudio(audioUrl)}
                  labelPlay={props.labels.playAudio}
                  labelStop={props.labels.stopAudio}
                />
              ) : null}
            </div>
          </div>
          {hasMeta ? (
            <div className="flex flex-wrap gap-2">
              {pos ? (
                <Badge variant="secondary" className="gap-1 text-[11px] font-medium">
                                    <span className="uppercase tracking-wide text-muted-foreground">
                                        {props.labels.pos}
                                    </span>
                  <span>{pos}</span>
                </Badge>
              ) : null}
              {category ? (
                <Badge variant="secondary" className="gap-1 text-[11px] font-medium">
                                    <span className="uppercase tracking-wide text-muted-foreground">
                                        {props.labels.category}
                                    </span>
                  <span>{category}</span>
                </Badge>
              ) : null}
            </div>
          ) : null}
                    {props.card.quiz && props.onUpdateQuiz && props.onRemoveQuiz ? (
                        <QuizEnrichmentEditor
                            quiz={props.card.quiz}
                            labels={props.labels.quiz}
                            onChange={(quiz) => props.onUpdateQuiz?.(props.cardIndex, quiz)}
                            onRemove={() => props.onRemoveQuiz?.(props.cardIndex)}
                            onRegenerate={
                                props.onRegenerateQuiz ? () => props.onRegenerateQuiz?.(props.cardIndex) : undefined
                            }
                            isRegenerating={props.isRegeneratingQuiz}
                            disabled={props.isRegeneratingQuiz || props.isQuizMutationDisabled}
                        />
                    ) : null}
        </CardContent>
      </Card>
    );
  },
  (prev, next) => {
    if (prev.card !== next.card) return false;
    if (prev.labels !== next.labels) return false;
    if (prev.onToggleAudio !== next.onToggleAudio) return false;
    if (prev.onImageClick !== next.onImageClick) return false;
    if (prev.onUpdateFront !== next.onUpdateFront) return false;
    if (prev.onRemoveCard !== next.onRemoveCard) return false;
    if (prev.audioFailure !== next.audioFailure) return false;
    if (prev.imageFailure !== next.imageFailure) return false;
    if (prev.isRetrying !== next.isRetrying) return false;
        if (prev.allowCardEditing !== next.allowCardEditing) return false;
        if (prev.allowCardRemoval !== next.allowCardRemoval) return false;
        if (prev.onUpdateQuiz !== next.onUpdateQuiz) return false;
        if (prev.onRemoveQuiz !== next.onRemoveQuiz) return false;
        if (prev.onRegenerateQuiz !== next.onRegenerateQuiz) return false;
        if (prev.isRegeneratingQuiz !== next.isRegeneratingQuiz) return false;
        if (prev.isQuizMutationDisabled !== next.isQuizMutationDisabled) return false;
    if (prev.cardIndex !== next.cardIndex) return false;

    const prevAudioUrl = typeof prev.card.audioUrl === 'string' ? prev.card.audioUrl.trim() : '';
    const nextAudioUrl = typeof next.card.audioUrl === 'string' ? next.card.audioUrl.trim() : '';

    const prevIsActive = prevAudioUrl.length > 0 && prev.audioState.activeUrl === prevAudioUrl;
    const nextIsActive = nextAudioUrl.length > 0 && next.audioState.activeUrl === nextAudioUrl;

    if (prevIsActive !== nextIsActive) return false;
    if (!prevIsActive && !nextIsActive) return true;

    return (
      prev.audioState.progress === next.audioState.progress &&
      prev.audioState.isPlaying === next.audioState.isPlaying
    );
  },
);

FlashcardPreviewCard.displayName = 'FlashcardPreviewCard';

export { FlashcardPreviewCard };
