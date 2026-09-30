import { BookPlus, ChevronDown, Download, Image, Loader2, Volume2 } from 'lucide-react';
import type { FlashcardsResponse, SupportedLocale } from '@flashly/shared/src';

import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { DeckTransferFormatId } from '@flashly/shared/src';

export type GeneratedDeckEntry = Readonly<{
    locale: SupportedLocale;
    flashcards: FlashcardsResponse;
}>;

export type GeneratedResultsActionLabels = Readonly<{
    appendButton: string;
    appending: string;
    addToMyDecks: string;
    addingToMyDecks: string;
    downloadZip: string;
    downloadZipFor: (language: string) => string;
    downloadFlashly: string;
    exportAnkiCsv: string;
    exportQuizletTxt: string;
    generateAudio: string;
    generatingAudio: string;
    generateImages: string;
    generatingImages: string;
}>;

type GeneratedResultsActionsProps = Readonly<{
    showHostedDeckActions: boolean;
    isAppendMode: boolean;
    isAppendingToDeck: boolean;
    isAppendDeckLoading: boolean;
    hasAppendDeckError: boolean;
    appendableGeneratedCardsCount: number;
    onAppendToDeck: () => void;
    isSavingToMyDecks: boolean;
    onAddToMyDecks: () => void;
    isBulkGenerationEnabled: boolean;
    generatedDecks: readonly GeneratedDeckEntry[];
    defaultDownloadDeck: GeneratedDeckEntry;
    onDownloadZip: (deck: FlashcardsResponse, locale: SupportedLocale) => void;
    onDownloadTransfer: (formatId: DeckTransferFormatId) => void;
    getLocaleLabel: (locale: SupportedLocale) => string;
    isGeneratingAudio: boolean;
    isGeneratingImages: boolean;
    hasMissingAudio: boolean;
    hasMissingImages: boolean;
    onGenerateAudio: () => void;
    onGenerateImages: () => void;
    labels: GeneratedResultsActionLabels;
}>;

export function GeneratedResultsActions(props: GeneratedResultsActionsProps) {
    const showMultiDeckDownload = props.isBulkGenerationEnabled && props.generatedDecks.length > 1;

    return (
        <div className="flex flex-wrap items-center gap-2">
            {props.showHostedDeckActions && props.isAppendMode ? (
                <Button
                    type="button"
                    onClick={props.onAppendToDeck}
                    disabled={
                        props.isAppendingToDeck
                        || props.isAppendDeckLoading
                        || props.hasAppendDeckError
                        || props.appendableGeneratedCardsCount === 0
                    }
                >
                    {props.isAppendingToDeck ? (
                        <>
                            {props.labels.appending}
                            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                        </>
                    ) : props.labels.appendButton}
                </Button>
            ) : null}

            {props.showHostedDeckActions && !props.isAppendMode ? (
                <Button
                    type="button"
                    onClick={props.onAddToMyDecks}
                    disabled={props.isSavingToMyDecks}
                >
                    {props.isSavingToMyDecks ? (
                        <>
                            {props.labels.addingToMyDecks}
                            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                        </>
                    ) : (
                        <>
                            <BookPlus className="h-4 w-4" />
                            <span className="ml-2">{props.labels.addToMyDecks}</span>
                        </>
                    )}
                </Button>
            ) : null}

            {showMultiDeckDownload ? (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button type="button" variant="outline">
                            <Download className="h-4 w-4" />
                            <span className="ml-2">{props.labels.downloadZip}</span>
                            <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        {props.generatedDecks.map((deck) => (
                            <DropdownMenuItem key={deck.locale} onClick={() => props.onDownloadZip(deck.flashcards, deck.locale)}>
                                <Download className="h-4 w-4" />
                                <span className="ml-2">
                                    {props.labels.downloadZipFor(props.getLocaleLabel(deck.locale))}
                                </span>
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            ) : (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button type="button" variant="outline">
                            <Download className="h-4 w-4" />
                            <span className="ml-2">{props.labels.downloadZip}</span>
                            <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        <DropdownMenuItem
                            onClick={() => props.onDownloadZip(props.defaultDownloadDeck.flashcards, props.defaultDownloadDeck.locale)}
                        >
                            {props.labels.downloadFlashly}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => props.onDownloadTransfer('anki-csv')}>
                            {props.labels.exportAnkiCsv}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => props.onDownloadTransfer('quizlet-txt')}>
                            {props.labels.exportQuizletTxt}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )}

            <Button
                type="button"
                variant="outline"
                onClick={props.onGenerateAudio}
                disabled={props.isGeneratingAudio || !props.hasMissingAudio}
            >
                {props.isGeneratingAudio ? (
                    <>
                        {props.labels.generatingAudio}
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    </>
                ) : (
                    <>
                        <Volume2 className="h-4 w-4" />
                        <span className="ml-2">{props.labels.generateAudio}</span>
                    </>
                )}
            </Button>

            <Button
                type="button"
                variant="outline"
                onClick={props.onGenerateImages}
                disabled={props.isGeneratingImages || !props.hasMissingImages}
            >
                {props.isGeneratingImages ? (
                    <>
                        {props.labels.generatingImages}
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    </>
                ) : (
                    <>
                        <Image className="h-4 w-4" />
                        <span className="ml-2">{props.labels.generateImages}</span>
                    </>
                )}
            </Button>
        </div>
    );
}
