import { useMemo, useState } from 'react';
import type {
    DeckTransferFormatId,
    FlashcardsResponse,
    GenerationFailures,
    MediaFailure,
    QuizEnrichment,
    SupportedLocale,
} from '@flashly/shared/src';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { AudioPlaybackState } from '../use-audio-preview-player';
import { FailureSummary } from './failure-summary';
import { FlashcardPreviewCard, type FlashcardPreviewLabels } from './flashcard-preview-card';
import {
    GeneratedResultsActions,
    type GeneratedDeckEntry,
    type GeneratedResultsActionLabels,
} from './generated-results-actions';
import { createFailureLookupMap } from './generated-results-panel-utils';

type GeneratedResultsPanelProps = Readonly<{
    flashcards: FlashcardsResponse;
    previewLimit: number;
    mediaFailures: GenerationFailures;
    retryingCardIds: Set<string>;
    onRetryAudio: (failure: MediaFailure) => void;
    onRetryImage: (failure: MediaFailure) => void;
    audioState: AudioPlaybackState;
    onToggleAudio: (url: string) => void;
    onImageClick: (card: FlashcardsResponse['flashcards'][number]) => void;
    onUpdateCardFront: (index: number, front: string) => void;
    onRemoveCard: (index: number) => void;
    previewLabels: FlashcardPreviewLabels;
    getStableCardId: (card: FlashcardsResponse['flashcards'][number]) => string;
    showHostedDeckActions: boolean;
    isAppendMode: boolean;
    appendDuplicateCount: number;
    appendableGeneratedCardsCount: number;
    appendSummaryLabel: (values: { generated: number; duplicates: number; ready: number }) => string;
    isAppendingToDeck: boolean;
    isAppendDeckLoading: boolean;
    hasAppendDeckError: boolean;
    onAppendToDeck: () => void;
    isSavingToMyDecks: boolean;
    onAddToMyDecks: () => void;
    isBulkGenerationEnabled: boolean;
    generatedDecks: readonly GeneratedDeckEntry[];
    defaultDownloadDeck: GeneratedDeckEntry | null;
    onDownloadZip: (deck: FlashcardsResponse, locale: SupportedLocale) => void;
    onDownloadTransfer: (formatId: DeckTransferFormatId) => void;
    getLocaleLabel: (locale: SupportedLocale) => string;
    isGeneratingAudio: boolean;
    isGeneratingImages: boolean;
    onGenerateAudio: () => void;
    onGenerateImages: () => void;
    actionLabels: GeneratedResultsActionLabels;
    generatedTitle: string;
    previewCountLabel: (shown: number, total: number) => string;
    showAllCardsLabel: (count: number) => string;
    allCardsTitle: string;
    allCardsDescriptionLabel: (count: number) => string;
    isQuizReviewMode?: boolean;
    onUpdateCardQuiz?: (index: number, quiz: QuizEnrichment) => void;
    onRemoveCardQuiz?: (index: number) => void;
    onRegenerateCardQuiz?: (index: number) => void;
    isRegeneratingCardQuiz?: (index: number) => boolean;
    quizSaveLabel?: (count: number) => string;
    quizSavingLabel?: string;
    isSavingQuizEnrichments?: boolean;
    onSaveQuizEnrichments?: () => void;
    quizEnrichmentSkippedSummary?: string;
}>;

export function GeneratedResultsPanel(props: GeneratedResultsPanelProps) {
    const [showAllModal, setShowAllModal] = useState(false);
    const cards = props.flashcards.flashcards;
    const previewCards = cards.slice(0, props.previewLimit);
    const isAnyQuizRegenerating = cards.some((_card, index) => props.isRegeneratingCardQuiz?.(index) ?? false);
    const audioFailuresByCardId = useMemo(
        () => createFailureLookupMap(props.mediaFailures.audio),
        [props.mediaFailures.audio],
    );
    const imageFailuresByCardId = useMemo(
        () => createFailureLookupMap(props.mediaFailures.image),
        [props.mediaFailures.image],
    );

    const renderCard = (card: FlashcardsResponse['flashcards'][number], index: number) => {
        const cardId = props.getStableCardId(card);
        const audioFailure = audioFailuresByCardId.get(cardId);
        const imageFailure = imageFailuresByCardId.get(cardId);
        const isRetrying = props.retryingCardIds.has(cardId);

        return (
            <FlashcardPreviewCard
                key={card.id ?? `${card.front}-${index}`}
                cardIndex={index}
                card={card}
                audioState={props.audioState}
                onToggleAudio={props.onToggleAudio}
                onImageClick={props.onImageClick}
                onUpdateFront={props.onUpdateCardFront}
                onRemoveCard={props.onRemoveCard}
                labels={props.previewLabels}
                audioFailure={audioFailure}
                imageFailure={imageFailure}
                isRetrying={isRetrying}
                allowCardEditing={!props.isQuizReviewMode}
                allowCardRemoval={!props.isQuizReviewMode}
                onUpdateQuiz={props.onUpdateCardQuiz}
                onRemoveQuiz={props.onRemoveCardQuiz}
                onRegenerateQuiz={props.isQuizReviewMode ? props.onRegenerateCardQuiz : undefined}
                isRegeneratingQuiz={props.isRegeneratingCardQuiz?.(index)}
                isQuizMutationDisabled={props.isSavingQuizEnrichments}
            />
        );
    };

    return (
        <div className="space-y-4 rounded-xl border border-border/70 p-4 sm:p-5">
            <FailureSummary
                failures={props.mediaFailures}
                retryingCardIds={props.retryingCardIds}
                onRetryAudio={props.onRetryAudio}
                onRetryImage={props.onRetryImage}
            />
            {props.quizEnrichmentSkippedSummary ? (
                <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                    {props.quizEnrichmentSkippedSummary}
                </div>
            ) : null}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                    <h3 className="text-lg font-semibold">{props.generatedTitle}</h3>
                    <p className="text-sm text-muted-foreground">
                        {props.previewCountLabel(Math.min(props.previewLimit, cards.length), cards.length)}
                    </p>
                </div>
                {props.quizSaveLabel && props.onSaveQuizEnrichments ? (
                    <Button
                        type="button"
                        onClick={props.onSaveQuizEnrichments}
                        disabled={props.isSavingQuizEnrichments || isAnyQuizRegenerating || cards.length === 0}
                    >
                        {props.isSavingQuizEnrichments ? props.quizSavingLabel : props.quizSaveLabel(cards.length)}
                    </Button>
                ) : null}
                {cards.length > props.previewLimit && (
                    <Button type="button" variant="outline" onClick={() => setShowAllModal(true)}>
                        {props.showAllCardsLabel(cards.length)}
                    </Button>
                )}
            </div>

            {!props.isQuizReviewMode && props.defaultDownloadDeck && (
                <GeneratedResultsActions
                    showHostedDeckActions={props.showHostedDeckActions}
                    isAppendMode={props.isAppendMode}
                    isAppendingToDeck={props.isAppendingToDeck}
                    isAppendDeckLoading={props.isAppendDeckLoading}
                    hasAppendDeckError={props.hasAppendDeckError}
                    appendableGeneratedCardsCount={props.appendableGeneratedCardsCount}
                    onAppendToDeck={props.onAppendToDeck}
                    isSavingToMyDecks={props.isSavingToMyDecks}
                    onAddToMyDecks={props.onAddToMyDecks}
                    isBulkGenerationEnabled={props.isBulkGenerationEnabled}
                    generatedDecks={props.generatedDecks}
                    defaultDownloadDeck={props.defaultDownloadDeck}
                    onDownloadZip={props.onDownloadZip}
                    onDownloadTransfer={props.onDownloadTransfer}
                    getLocaleLabel={props.getLocaleLabel}
                    isGeneratingAudio={props.isGeneratingAudio}
                    isGeneratingImages={props.isGeneratingImages}
                    hasMissingAudio={cards.some(
                        (card) => typeof card.audioUrl !== 'string' || card.audioUrl.trim().length === 0,
                    )}
                    hasMissingImages={cards.some(
                        (card) => typeof card.imageUrl !== 'string' || card.imageUrl.trim().length === 0,
                    )}
                    onGenerateAudio={props.onGenerateAudio}
                    onGenerateImages={props.onGenerateImages}
                    labels={props.actionLabels}
                />
            )}

            {props.isAppendMode && (
                <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                    {props.appendSummaryLabel({
                        generated: cards.length,
                        duplicates: props.appendDuplicateCount,
                        ready: props.appendableGeneratedCardsCount,
                    })}
                </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">{previewCards.map(renderCard)}</div>

            {cards.length > props.previewLimit && (
                <Dialog open={showAllModal} onOpenChange={setShowAllModal}>
                    <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>{props.allCardsTitle}</DialogTitle>
                            <DialogDescription>{props.allCardsDescriptionLabel(cards.length)}</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{cards.map(renderCard)}</div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
