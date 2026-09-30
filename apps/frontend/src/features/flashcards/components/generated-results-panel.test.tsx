import type { ComponentProps, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { FlashcardsResponse } from '@flashly/shared/src';

vi.mock('@/components/ui/button', () => ({
    Button: (props: ComponentProps<'button'>) => (
        <button type={props.type ?? 'button'} disabled={props.disabled} data-disabled={props.disabled ? 'true' : 'false'}>
            {props.children}
        </button>
    ),
}));

vi.mock('@/components/ui/dialog', () => ({
    Dialog: (props: Readonly<{ children: ReactNode }>) => <div>{props.children}</div>,
    DialogContent: (props: Readonly<{ children: ReactNode }>) => <div>{props.children}</div>,
    DialogDescription: (props: Readonly<{ children: ReactNode }>) => <div>{props.children}</div>,
    DialogHeader: (props: Readonly<{ children: ReactNode }>) => <div>{props.children}</div>,
    DialogTitle: (props: Readonly<{ children: ReactNode }>) => <h4>{props.children}</h4>,
}));

vi.mock('./failure-summary', () => ({
    FailureSummary: () => null,
}));

vi.mock('./generated-results-actions', () => ({
    GeneratedResultsActions: () => (
        <div>
            <button type="button">Add to My decks</button>
            <button type="button">Download ZIP</button>
            <button type="button">Generate audio</button>
        </div>
    ),
}));

vi.mock('./flashcard-preview-card', () => ({
    FlashcardPreviewCard: (props: Readonly<{
        card: { front?: string; quiz?: { prompt?: string } };
        isQuizMutationDisabled?: boolean;
    }>) => (
        <article data-quiz-disabled={props.isQuizMutationDisabled ? 'true' : 'false'}>
            {props.card.front ?? ''}
            {props.card.quiz?.prompt ?? ''}
        </article>
    ),
}));

import { GeneratedResultsPanel } from './generated-results-panel';

const flashcards: FlashcardsResponse = {
    flashcards: [
        {
            id: 1,
            front: 'Card 1',
            back: 'Back 1',
            quiz: {
                prompt: 'Which card is first?',
                options: ['Card 1', 'Card 2'],
                correctAnswer: 'Card 1',
                explanation: 'It is numbered one.',
            },
        },
        { id: 2, front: 'Card 2', back: 'Back 2' },
        { id: 3, front: 'Card 3', back: 'Back 3' },
    ],
};

const previewLabels = {
    pos: 'POS',
    category: 'Category',
    gender: 'Gender',
    playAudio: 'Play',
    stopAudio: 'Stop',
    audioError: 'Audio error',
    imageError: 'Image error',
    imageAlt: (front: string) => `Image for ${front}`,
    editFront: 'Edit front',
    frontPlaceholder: 'Front side',
    deleteCard: 'Delete card',
    quiz: {
        badge: 'Quiz',
        edit: 'Edit quiz',
        prompt: 'Question',
        option: (index: number) => `Option ${index}`,
        correctAnswer: 'Correct answer',
        explanation: 'Explanation',
        addOption: 'Add option',
        removeOption: 'Remove option',
        apply: 'Apply quiz',
        cancel: 'Cancel',
        remove: 'Remove quiz',
        regenerate: 'Regenerate quiz',
        invalid: 'Invalid quiz',
    },
} as const;

const actionLabels = {
    appendButton: 'Append cards',
    appending: 'Appending…',
    addToMyDecks: 'Add to My decks',
    addingToMyDecks: 'Adding to My decks…',
    downloadZip: 'Download ZIP',
    downloadZipFor: (language: string) => `Download ZIP (${language})`,
    downloadFlashly: 'Flashly (.zip)',
    exportAnkiCsv: 'Anki CSV',
    exportQuizletTxt: 'Quizlet TXT',
    generateAudio: 'Generate audio',
    generatingAudio: 'Generating audio…',
    generateImages: 'Generate images',
    generatingImages: 'Generating images…',
} as const;

function renderPanel(overrides: Partial<ComponentProps<typeof GeneratedResultsPanel>> = {}) {
    const props: ComponentProps<typeof GeneratedResultsPanel> = {
        flashcards,
        previewLimit: 2,
        mediaFailures: { audio: [], image: [] },
        retryingCardIds: new Set<string>(),
        onRetryAudio: vi.fn(),
        onRetryImage: vi.fn(),
        audioState: {
            activeUrl: '',
            progress: 0,
            isPlaying: false,
        },
        onToggleAudio: vi.fn(),
        onImageClick: vi.fn(),
        onUpdateCardFront: vi.fn(),
        onRemoveCard: vi.fn(),
        previewLabels,
        getStableCardId: (card) => `card-${card.id ?? card.front}`,
        showHostedDeckActions: true,
        isAppendMode: true,
        appendDuplicateCount: 1,
        appendableGeneratedCardsCount: 2,
        appendSummaryLabel: ({ generated, duplicates, ready }) => `Append summary ${generated}/${duplicates}/${ready}`,
        isAppendingToDeck: false,
        isAppendDeckLoading: false,
        hasAppendDeckError: false,
        onAppendToDeck: vi.fn(),
        isSavingToMyDecks: false,
        onAddToMyDecks: vi.fn(),
        isBulkGenerationEnabled: false,
        generatedDecks: [{ locale: 'eng', flashcards }],
        defaultDownloadDeck: { locale: 'eng', flashcards },
        onDownloadZip: vi.fn(),
        onDownloadTransfer: vi.fn(),
        getLocaleLabel: (locale) => locale,
        isGeneratingAudio: false,
        isGeneratingImages: false,
        onGenerateAudio: vi.fn(),
        onGenerateImages: vi.fn(),
        actionLabels,
        generatedTitle: 'Generated cards',
        previewCountLabel: (shown, total) => `Showing ${shown} of ${total}`,
        showAllCardsLabel: (count) => `Show all ${count}`,
        allCardsTitle: 'All cards',
        allCardsDescriptionLabel: (count) => `All ${count} cards`,
        ...overrides,
    };

    return renderToStaticMarkup(<GeneratedResultsPanel {...props} />);
}

describe('generated-results-panel', () => {
    it('renders generated header, preview counts, and append summary', () => {
        const markup = renderPanel();

        expect(markup).toContain('Generated cards');
        expect(markup).toContain('Showing 2 of 3');
        expect(markup).toContain('Show all 3');
        expect(markup).toContain('Append summary 3/1/2');
        expect(markup).toContain('Which card is first?');
    });

    it('hides append summary when append mode is off', () => {
        const markup = renderPanel({
            isAppendMode: false,
        });

        expect(markup).not.toContain('Append summary');
    });

    it('disables every quiz editor mutation while quiz enrichment is saving', () => {
        const markup = renderPanel({
            isQuizReviewMode: true,
            isSavingQuizEnrichments: true,
        });

        expect(markup).toContain('data-quiz-disabled="true"');
    });

    it('disables Save while a card quiz is regenerating and re-enables it afterward', () => {
        const sharedProps = {
            isQuizReviewMode: true,
            quizSaveLabel: (count: number) => `Save ${count} quizzes`,
            onSaveQuizEnrichments: vi.fn(),
        };
        const regeneratingMarkup = renderPanel({
            ...sharedProps,
            isRegeneratingCardQuiz: (index) => index === 0,
        });
        const idleMarkup = renderPanel({
            ...sharedProps,
            isRegeneratingCardQuiz: () => false,
        });

        expect(regeneratingMarkup).toContain('data-disabled="true">Save 3 quizzes');
        expect(idleMarkup).toContain('data-disabled="false">Save 3 quizzes');
    });

    it('hides generic deck, download, and media actions during quiz review', () => {
        const markup = renderPanel({
            isQuizReviewMode: true,
        });

        expect(markup).not.toContain('Add to My decks');
        expect(markup).not.toContain('Download ZIP');
        expect(markup).not.toContain('Generate audio');
    });

    it('shows the requested cards that did not receive a valid quiz proposal', () => {
        const markup = renderPanel({
            isQuizReviewMode: true,
            quizEnrichmentSkippedSummary: 'No quiz generated for 2 cards: Haus, Baum.',
        });

        expect(markup).toContain('No quiz generated for 2 cards: Haus, Baum.');
    });
});
