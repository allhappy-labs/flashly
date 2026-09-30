import type { ComponentProps, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/button', () => ({
    Button: (props: ComponentProps<'button'>) => (
        <button type={props.type ?? 'button'} disabled={props.disabled}>
            {props.children}
        </button>
    ),
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
    DropdownMenu: (props: Readonly<{ children: ReactNode }>) => <div>{props.children}</div>,
    DropdownMenuTrigger: (props: Readonly<{ children: ReactNode }>) => <div>{props.children}</div>,
    DropdownMenuContent: (props: Readonly<{ children: ReactNode }>) => <div>{props.children}</div>,
    DropdownMenuItem: (props: Readonly<{ children: ReactNode }>) => <div>{props.children}</div>,
    DropdownMenuSeparator: () => <hr />,
}));

import { GeneratedResultsActions } from './generated-results-actions';

const labels = {
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

const defaultDeck: ComponentProps<typeof GeneratedResultsActions>['defaultDownloadDeck'] = {
    locale: 'eng',
    flashcards: {
        flashcards: [
            { front: 'Question', back: 'Answer' },
        ],
    },
};

function renderActions(overrides: Partial<ComponentProps<typeof GeneratedResultsActions>> = {}) {
    const props: ComponentProps<typeof GeneratedResultsActions> = {
        showHostedDeckActions: true,
        isAppendMode: false,
        isAppendingToDeck: false,
        isAppendDeckLoading: false,
        hasAppendDeckError: false,
        appendableGeneratedCardsCount: 1,
        onAppendToDeck: vi.fn(),
        isSavingToMyDecks: false,
        onAddToMyDecks: vi.fn(),
        isBulkGenerationEnabled: false,
        generatedDecks: [defaultDeck],
        defaultDownloadDeck: defaultDeck,
        onDownloadZip: vi.fn(),
        onDownloadTransfer: vi.fn(),
        getLocaleLabel: (locale) => locale,
        isGeneratingAudio: false,
        isGeneratingImages: false,
        hasMissingAudio: true,
        hasMissingImages: true,
        onGenerateAudio: vi.fn(),
        onGenerateImages: vi.fn(),
        labels,
        ...overrides,
    };

    return renderToStaticMarkup(<GeneratedResultsActions {...props} />);
}

describe('generated-results-actions', () => {
    it('renders append state labels and primary actions', () => {
        const markup = renderActions({
            isAppendMode: true,
            isAppendingToDeck: true,
        });

        expect(markup).toContain(labels.appending);
        expect(markup).toContain(labels.downloadZip);
        expect(markup).toContain(labels.generateAudio);
        expect(markup).toContain(labels.generateImages);
    });

    it('renders add to my decks action outside append mode', () => {
        const markup = renderActions({
            isAppendMode: false,
        });

        expect(markup).toContain(labels.addToMyDecks);
    });

    it('omits hosted deck actions in local mode while retaining downloads and media', () => {
        const markup = renderActions({
            showHostedDeckActions: false,
            isAppendMode: false,
        });

        expect(markup).not.toContain(labels.addToMyDecks);
        expect(markup).not.toContain(labels.appendButton);
        expect(markup).toContain(labels.downloadZip);
        expect(markup).toContain(labels.generateAudio);
        expect(markup).toContain(labels.generateImages);
    });

    it('retains Add to My Decks in hosted mode', () => {
        const markup = renderActions({
            showHostedDeckActions: true,
            isAppendMode: false,
        });

        expect(markup).toContain(labels.addToMyDecks);
    });

    it('disables media actions when media already exists', () => {
        const markup = renderActions({
            hasMissingAudio: false,
            hasMissingImages: false,
        });

        const disabledAttributes = markup.match(/disabled=""/g) ?? [];
        expect(disabledAttributes.length).toBeGreaterThanOrEqual(2);
    });

    it('keeps media actions enabled when some cards still need media', () => {
        const markup = renderActions({
            hasMissingAudio: true,
            hasMissingImages: true,
        });

        expect(markup).not.toContain('disabled=""');
    });
});
