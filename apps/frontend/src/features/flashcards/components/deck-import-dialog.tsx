import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, FileArchive, RefreshCw } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
    detectMissingAssets,
    mergeCardsByFront,
    type ImportConfirmOptions,
    type MissingAssets,
    type DeckZipParseResult,
} from '@/utils/deck-zip';
import type { FlashcardsResponse } from '@flashly/shared/src';

interface DeckImportDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: (options: ImportConfirmOptions) => void;
    parsedZip: DeckZipParseResult | null;
    existingCards: FlashcardsResponse['flashcards'];
}

/**
 * Analysis of merge operation
 */
interface MergeAnalysis {
    newCards: number;
    duplicateCards: number;
    totalCards: number;
}

export function DeckImportDialog({
    open,
    onClose,
    onConfirm,
    parsedZip,
    existingCards,
}: DeckImportDialogProps) {
    const { t } = useTranslation();

    // State for user selections
    const [mode, setMode] = useState<'create' | 'update'>('create');
    const [regenerateAudio, setRegenerateAudio] = useState(false);
    const [regenerateImages, setRegenerateImages] = useState(false);
    const [regenerateExisting, setRegenerateExisting] = useState(false);
    const [useAsBaseDeck, setUseAsBaseDeck] = useState(false);

    // Analyze missing assets
    const missingAssets = useMemo<MissingAssets>(() => {
        if (!parsedZip) {
            return { missingImages: 0, missingAudio: 0, totalCards: 0, hasImages: 0, hasAudio: 0 };
        }
        return detectMissingAssets(parsedZip.cards);
    }, [parsedZip]);

    // Analyze merge results
    const mergeAnalysis = useMemo<MergeAnalysis>(() => {
        if (!parsedZip) {
            return { newCards: 0, duplicateCards: 0, totalCards: 0 };
        }
        const merged = mergeCardsByFront(existingCards, parsedZip.cards);
        const newCards = merged.length - existingCards.length;
        const duplicateCards = parsedZip.cards.length - newCards;
        return {
            newCards,
            duplicateCards,
            totalCards: merged.length,
        };
    }, [parsedZip, existingCards]);

    // Auto-check regeneration if there are missing assets
    useEffect(() => {
        if (parsedZip) {
            setRegenerateAudio(missingAssets.missingAudio > 0);
            setRegenerateImages(missingAssets.missingImages > 0);
        }
    }, [parsedZip, missingAssets.missingAudio, missingAssets.missingImages]);

    const handleConfirm = useCallback(() => {
        onConfirm({
            mode,
            regenerate: {
                audio: regenerateAudio,
                images: regenerateImages,
                regenerateExisting,
            },
            useAsBaseDeck,
        });
    }, [mode, regenerateAudio, regenerateImages, regenerateExisting, useAsBaseDeck, onConfirm]);

    const canUpdate = existingCards.length > 0;

    return (
        <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileArchive className="h-5 w-5" />
                        {t('web.flashcards.deckImport.title')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('web.flashcards.deckImport.description')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* File info */}
                    {parsedZip && (
                        <div className="rounded-md bg-muted p-3 text-sm">
                            <div className="font-medium">{parsedZip.fileName}</div>
                            <div className="text-muted-foreground">
                                {parsedZip.cards.length} {t('web.flashcards.allCardsTitle', {
                                    count: parsedZip.cards.length,
                                })}
                            </div>
                        </div>
                    )}

                    {/* Use as Base Deck option */}
                    {parsedZip && parsedZip.locale && (
                        <div className="rounded-md bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 p-3 text-sm mt-3">
                            <div className="flex items-start gap-2">
                                <Checkbox
                                    id="use-as-base-deck"
                                    checked={useAsBaseDeck}
                                    onCheckedChange={(checked) => setUseAsBaseDeck(checked === true)}
                                />
                                <div className="space-y-1">
                                    <label htmlFor="use-as-base-deck" className="font-medium text-purple-900 dark:text-purple-100 cursor-pointer">
                                        {t('web.flashcards.deckImport.useAsBaseDeck')}
                                    </label>
                                    <div className="text-purple-700 dark:text-purple-300 text-xs">
                                        {t('web.flashcards.deckImport.useAsBaseDeckDescription')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Mode selection - only show when there are existing cards */}
                    {existingCards.length > 0 && (
                        <div className="space-y-2">
                            <Label>{t('web.flashcards.deckImport.modeLabel')}</Label>
                            <div className="space-y-2">
                            <button
                                type="button"
                                onClick={() => setMode('create')}
                                className={`w-full rounded-md border p-3 text-left text-sm transition-colors ${
                                    mode === 'create'
                                        ? 'border-primary bg-primary/5'
                                        : 'border-border hover:bg-muted'
                                } ${!canUpdate && 'cursor-default'}`}
                                disabled={!canUpdate}
                            >
                                <div className="flex items-start gap-2">
                                    <div
                                        className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border ${
                                            mode === 'create' ? 'border-primary bg-primary' : 'border-muted-foreground'
                                        }`}
                                    >
                                        {mode === 'create' && <Check className="h-3 w-3 text-primary-foreground" />}
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-medium">{t('web.flashcards.deckImport.modeCreate')}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {t('web.flashcards.deckImport.modeCreateDescription')}
                                        </div>
                                    </div>
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => setMode('update')}
                                disabled={!canUpdate}
                                className={`w-full rounded-md border p-3 text-left text-sm transition-colors ${
                                    mode === 'update'
                                        ? 'border-primary bg-primary/5'
                                        : 'border-border hover:bg-muted'
                                } ${!canUpdate && 'cursor-not-allowed opacity-50'}`}
                            >
                                <div className="flex items-start gap-2">
                                    <div
                                        className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border ${
                                            mode === 'update' ? 'border-primary bg-primary' : 'border-muted-foreground'
                                        }`}
                                    >
                                        {mode === 'update' && <Check className="h-3 w-3 text-primary-foreground" />}
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-medium">{t('web.flashcards.deckImport.modeUpdate')}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {t('web.flashcards.deckImport.modeUpdateDescription')}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        </div>
                        </div>
                    )}

                    {/* Merge preview (only show in update mode) */}
                    {mode === 'update' && parsedZip && (
                        <div className="rounded-md bg-muted p-3 text-sm">
                            <div className="font-medium">{t('web.flashcards.deckImport.mergePreview')}</div>
                            <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                                <div>
                                    {t('web.flashcards.deckImport.newCards', { count: mergeAnalysis.newCards })}
                                </div>
                                <div>
                                    {t('web.flashcards.deckImport.duplicateCards', {
                                        count: mergeAnalysis.duplicateCards,
                                    })}
                                </div>
                                <div className="pt-1">
                                    {t('web.flashcards.deckImport.totalCards', {
                                        count: mergeAnalysis.totalCards,
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Asset regeneration */}
                    <div className="space-y-2">
                        <Label>{t('web.flashcards.deckImport.regenerateLabel')}</Label>
                        <div className="space-y-2 rounded-md border p-3">
                            {/* Missing assets indicator */}
                            {(missingAssets.missingAudio > 0 || missingAssets.missingImages > 0) ? (
                                <div className="mb-3 text-xs text-muted-foreground">
                                    <p className="mb-2">{t('web.flashcards.deckImport.missingAssets')}</p>
                                    <ul className="space-y-1">
                                        {missingAssets.missingAudio > 0 && (
                                            <li>{t('web.flashcards.deckImport.missingAudioCount', {
                                                count: missingAssets.missingAudio,
                                            })}</li>
                                        )}
                                        {missingAssets.missingImages > 0 && (
                                            <li>{t('web.flashcards.deckImport.missingImageCount', {
                                                count: missingAssets.missingImages,
                                            })}</li>
                                        )}
                                    </ul>
                                </div>
                            ) : (
                                <div className="mb-3 text-xs text-green-600 dark:text-green-400">
                                    {t('web.flashcards.deckImport.allMediaPresent')}
                                </div>
                            )}

                            {/* Audio checkbox */}
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="regenerate-audio"
                                    checked={regenerateAudio}
                                    onCheckedChange={(checked) => setRegenerateAudio(checked === true)}
                                />
                                <label
                                    htmlFor="regenerate-audio"
                                    className="flex-1 cursor-pointer text-sm font-medium"
                                >
                                    {t('web.flashcards.deckImport.regenerateAudio')}
                                </label>
                                <RefreshCw className="h-4 w-4 text-muted-foreground" />
                            </div>

                            {/* Images checkbox */}
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="regenerate-images"
                                    checked={regenerateImages}
                                    onCheckedChange={(checked) => setRegenerateImages(checked === true)}
                                />
                                <label
                                    htmlFor="regenerate-images"
                                    className="flex-1 cursor-pointer text-sm font-medium"
                                >
                                    {t('web.flashcards.deckImport.regenerateImages')}
                                </label>
                                <RefreshCw className="h-4 w-4 text-muted-foreground" />
                            </div>

                            {/* Regenerate existing checkbox */}
                            {(regenerateAudio || regenerateImages) &&
                             ((regenerateAudio && missingAssets.hasAudio > 0 && missingAssets.missingAudio > 0) ||
                              (regenerateImages && missingAssets.hasImages > 0 && missingAssets.missingImages > 0)) && (
                                <div className="ml-6 mt-2">
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            id="regenerate-existing"
                                            checked={regenerateExisting}
                                            onCheckedChange={(checked) => setRegenerateExisting(checked === true)}
                                        />
                                        <label
                                            htmlFor="regenerate-existing"
                                            className="cursor-pointer text-xs text-muted-foreground"
                                        >
                                            {t('web.flashcards.deckImport.regenerateExisting')}
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        {t('web.flashcards.deckImport.cancelButton')}
                    </Button>
                    <Button onClick={handleConfirm}>
                        {t('web.flashcards.deckImport.importButton')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
