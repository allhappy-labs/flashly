import type { ChangeEvent } from 'react';
import {
    ELEVENLABS_V3_LANGUAGES,
    type FlashcardFormat,
    type FlashcardMaterialType,
    type SupportedLocale,
} from '@flashly/shared/src';
import { useTranslation } from 'react-i18next';

import { locales } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FileDropzone, type FileDropzonePreview } from '@/components/ui/file-dropzone';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LanguageCombobox } from '@/components/ui/language-combobox';
import { MaterialTypeCombobox } from '@/components/ui/material-type-combobox';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox';
import { FlashcardFormatSelector } from './flashcard-format-selector';

type FlashcardGeneratorFormProps = Readonly<{
    apiKey: string;
    onRequestSettingsOpen: () => void;
    materialInputKey: number;
    materialFileName: string;
    materialFileSizeLabel?: string;
    materialPreview?: FileDropzonePreview;
    onMaterialFileSelect: (file: File) => void;
    onClearMaterial?: () => void;
    deckName: string;
    onDeckNameChange: (event: ChangeEvent<HTMLInputElement>) => void;
    isBulkGenerationEnabled: boolean;
    normalizedTargetLocales: SupportedLocale[];
    onTargetLocalesChange: (locales: SupportedLocale[]) => void;
    bulkLocaleOptions: readonly SupportedLocale[];
    baseLocale: SupportedLocale;
    isAppendMode: boolean;
    isExistingDeckQuizMode: boolean;
    existingDeckQuizCardCount: number;
    cardCount: number;
    maxCardCount: number;
    onCardCountChange: (event: ChangeEvent<HTMLInputElement>) => void;
    includeQuiz: boolean;
    onIncludeQuizChange: (checked: boolean) => void;
    format: FlashcardFormat;
    onFormatChange: (value: FlashcardFormat) => void;
    materialType: FlashcardMaterialType;
    onMaterialTypeChange: (value: FlashcardMaterialType) => void;
    isGenerating: boolean;
    selectedLanguageId?: string;
    onSelectedLanguageChange: (value: string | undefined) => void;
    customInstruction: string;
    onCustomInstructionChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
    onGenerate: () => void;
    onClearResults: () => void;
    isGeneratingAudio: boolean;
    isGeneratingImages: boolean;
    isAppendModeBlocked: boolean;
    error: string | null;
}>;

export function FlashcardGeneratorForm(props: FlashcardGeneratorFormProps) {
    const { t } = useTranslation();
    const isGeneratingAny = props.isGenerating || props.isGeneratingAudio || props.isGeneratingImages;

    return (
        <>
            {!props.apiKey.trim() && (
                <div className="rounded-xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
                    {t('web.flashcards.openRouterHint')}{' '}
                    <button type="button" className="underline" onClick={props.onRequestSettingsOpen}>
                        {t('web.flashcards.settingsLink')}
                    </button>
                    {t('web.flashcards.openRouterHintSuffix')}
                </div>
            )}

            <div className="space-y-2">
                <Label htmlFor="material-file">{t('web.flashcards.sourceMaterial')}</Label>
                <FileDropzone
                    key={props.materialInputKey}
                    id="material-file"
                    accept=".txt,.md,.flashly"
                    title={t('web.flashcards.sourceDropTitle')}
                    description={t('web.flashcards.sourceDropDescription')}
                    fileName={props.materialFileName}
                    fileSizeLabel={props.materialFileSizeLabel}
                    preview={props.materialPreview}
                    onFileSelect={props.onMaterialFileSelect}
                    onClear={props.materialFileName ? props.onClearMaterial : undefined}
                />
                {!props.materialFileName && (
                    <p className="text-xs text-muted-foreground">{t('web.flashcards.sourceOptional')}</p>
                )}
            </div>

            <div className="space-y-2">
                <Label htmlFor="deck-name">{t('web.flashcards.deckName')}</Label>
                <Input
                    id="deck-name"
                    placeholder={t('web.flashcards.deckNamePlaceholder')}
                    value={props.deckName}
                    onChange={props.onDeckNameChange}
                />
            </div>

            {props.isBulkGenerationEnabled && (
                <div className="space-y-2">
                    <Label>{t('web.flashcards.bulkLanguagesLabel')}</Label>
                    <MultiSelectCombobox<SupportedLocale>
                        id="bulk-languages"
                        value={props.normalizedTargetLocales}
                        onChange={props.onTargetLocalesChange}
                        options={props.bulkLocaleOptions.map((locale) => ({
                            value: locale,
                            label: locales[locale] ?? locale,
                            disabled: locale === props.baseLocale,
                        }))}
                        requiredValues={[props.baseLocale]}
                        placeholder={t('web.flashcards.selectLanguagesPlaceholder')}
                        searchPlaceholder="Search languages..."
                        maxDisplayItems={2}
                        disabled={props.isAppendMode}
                    />
                    <p className="text-xs text-muted-foreground">
                        {props.isAppendMode
                            ? t('web.flashcards.append.bulkDisabledHint')
                            : t('web.flashcards.bulkLanguagesHint')}
                    </p>
                </div>
            )}

            {props.isExistingDeckQuizMode ? (
                <p className="text-sm text-muted-foreground">
                    {t('web.flashcards.quizEnrichmentSelectedCards', { count: props.existingDeckQuizCardCount })}
                </p>
            ) : (
                <div className="space-y-2">
                    <Label htmlFor="card-count">{t('web.flashcards.cardCount')}</Label>
                    <Input
                        id="card-count"
                        type="number"
                        min={0}
                        max={props.maxCardCount}
                        value={props.cardCount}
                        onChange={props.onCardCountChange}
                    />
                    <p className="text-xs text-muted-foreground">{t('web.flashcards.cardCountHint')}</p>
                </div>
            )}

            <div className="space-y-2">
                <Label htmlFor="flashcard-format">{t('web.flashcards.formatLabel')}</Label>
                <FlashcardFormatSelector value={props.format} onChange={props.onFormatChange} />
            </div>

            <div className="space-y-2">
                <Label htmlFor="material-type">{t('web.flashcards.materialType')}</Label>
                <MaterialTypeCombobox
                    id="material-type"
                    value={props.materialType}
                    onChange={props.onMaterialTypeChange}
                    disabled={props.isGenerating}
                />
            </div>

            {props.materialType === 'Language' && (
                <div className="space-y-2">
                    <Label htmlFor="audio-language">{t('web.flashcards.cardLanguage')}</Label>
                    <LanguageCombobox
                        id="audio-language"
                        value={props.selectedLanguageId}
                        onChange={props.onSelectedLanguageChange}
                        placeholder={t('web.flashcards.cardLanguagePlaceholder')}
                        languages={ELEVENLABS_V3_LANGUAGES}
                        allowEmpty={true}
                        emptyLabel={t('web.flashcards.cardLanguageAuto')}
                    />
                    <p className="text-xs text-muted-foreground">{t('web.flashcards.cardLanguageHint')}</p>
                </div>
            )}

            <div className="space-y-2">
                <Label htmlFor="custom-instruction">{t('web.flashcards.customInstruction')}</Label>
                <Textarea
                    id="custom-instruction"
                    rows={3}
                    placeholder={t('web.flashcards.customInstructionPlaceholder')}
                    value={props.customInstruction}
                    onChange={props.onCustomInstructionChange}
                />
            </div>

            {!props.isExistingDeckQuizMode && (
                <div className="flex items-center gap-2">
                    <Checkbox
                        id="include-quiz-enrichment"
                        checked={props.includeQuiz}
                        disabled={isGeneratingAny}
                        onCheckedChange={props.onIncludeQuizChange}
                    />
                    <Label htmlFor="include-quiz-enrichment">{t('web.flashcards.quizEnrichment')}</Label>
                </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
                <Button
                    type="button"
                    onClick={props.onGenerate}
                    disabled={isGeneratingAny || props.isAppendModeBlocked}
                >
                    {isGeneratingAny
                        ? t('web.flashcards.generating')
                        : t('web.flashcards.generateButton')}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    onClick={props.onClearResults}
                    disabled={isGeneratingAny}
                >
                    {t('web.flashcards.clearResults')}
                </Button>
                {props.error && <p className="text-sm text-destructive">{props.error}</p>}
            </div>
        </>
    );
}
