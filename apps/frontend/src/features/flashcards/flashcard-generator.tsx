import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useReducer, useState, type ReactNode } from 'react';
import {
    FLASHCARD_FORMATS,
    FLASHCARD_MATERIAL_TYPES,
    FLASHCARD_PROMPT_TEMPLATE,
    ELEVENLABS_V3_LANGUAGES,
    buildFlashcardPrompt,
    resolveEnhancedGenerationTiming,
    calculateWeightedBatchAverage,
    estimateGenerationSecondsMultiFactor,
    buildDeckTranslationPrompt,
    type BatchEstimate,
    type MultiFactorEstimateInput,
    type EnhancedBatchEstimate,
    type FlashcardFormat,
    type FlashcardMaterialType,
    type FlashcardsResponse,
    type LanguageExample,
    type GenerationFailures,
    type QuizEnrichment,
    type QuizEnrichmentProposal,
    type QuizEnrichmentSourceCard,
} from '@flashly/shared/src';
import type { QuizEnrichmentGenerationResult } from './quiz-enrichment-generation';
import { isSupportedLocale, supportedLocales, type SupportedLocale } from '@flashly/shared/src/i18n/supported-locales';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import { useNavigate, useSearch } from '@tanstack/react-router';

import { type FileDropzonePreview } from '@/components/ui/file-dropzone';
import type { ProviderTransport } from '@/config/provider-transport';
import { DEFAULT_OPENROUTER_MODEL, getOpenRouterSettings } from '@/utils/openrouter-settings';
import { getElevenLabsSettings } from '@/utils/elevenlabs-settings';
import { createLogger } from '@/utils/logger';
import { getUnsplashSettings } from '@/utils/unsplash-settings';
import { locales } from '@/i18n';
import { AppendModeBanner } from './components/append-mode-banner';
import { readDeckZipFile, type ImportConfirmOptions, type DeckZipParseResult } from '@/utils/deck-zip';
import { type FlashcardPreviewLabels } from './components/flashcard-preview-card';
import { GenerationProgressModal } from './components/generation-progress-modal';
import { useAudioPreviewPlayer } from './use-audio-preview-player';
import { createDeckFileDropzonePreview } from './components/deck-preview-adapter';
import { FlashcardGeneratorForm } from './components/flashcard-generator-form';
import { useDeckWithCards } from '@/features/deck-editor/hooks/use-deck-with-cards';
import type { Card as DeckEditorCard } from '@/types/api.types';
import {
    getStableCardId,
    isFlashcardFormatValue,
    isFlashcardMaterialTypeValue,
    normalizeFrontKey,
} from './utils/flashcard-generator-utils';
import { normalizeAppendDeckId, getDeckZipErrorCode } from './utils/flashcard-generator-io-utils';
import { getDeckImportMessageDescriptor } from './utils/deck-import-errors';
import { processDeckImport } from './utils/deck-import-processing';
import { hasGenerationInput } from './utils/generation-input';
import { claimQuizReviewRevision, mergeGeneratedQuizReviews, updateQuizReview } from './utils/quiz-enrichment-review-state';
import {
    generationSessionReducer,
    initialGenerationSessionState,
    isAnyTaskRunning,
    type GenerationTaskId,
} from './utils/generation-session-reducer';
import { flashcardsReducer, initialFlashcardsState } from './utils/flashcards-state-reducer';
import { useFlashcardDownloadActions } from './use-flashcard-download-actions';
import { useFlashcardAppendActions } from './use-flashcard-append-actions';
import { useFlashcardMediaActions } from './use-flashcard-media-actions';
import { useFlashcardSaveActions } from './use-flashcard-save-actions';
import { useFlashcardQuizActions, type QuizReview } from './use-flashcard-quiz-actions';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const MAX_CARD_COUNT = 300;
const BATCH_SIZE = 50;
const BASE_PREVIOUS_QUESTIONS = 100;
const PREVIEW_LIMIT = 2;
const UNSPLASH_IMAGE_WIDTH = 640;
const UNSPLASH_IMAGE_QUALITY = 80;
const BASE_LOCALE: SupportedLocale = 'eng';
const logger = createLogger('flashcard-generator', {
    debugEnabled: import.meta.env.DEV || import.meta.env.VITE_ENABLE_FLASHCARD_GENERATOR_DEBUG === 'true',
});

function getObjectProperty(value: unknown, key: string): unknown {
    if (typeof value !== 'object' || value === null) {
        return undefined;
    }
    return Reflect.get(value, key);
}

function isLanguageExample(value: unknown): value is LanguageExample {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }
    return (
        typeof getObjectProperty(value, 'target') === 'string' &&
        typeof getObjectProperty(value, 'english') === 'string' &&
        typeof getObjectProperty(value, 'romanization') === 'string'
    );
}

function getErrorCode(value: unknown): string | null {
    const code = getObjectProperty(value, 'code');
    return typeof code === 'string' ? code : null;
}

function resolveGenerationErrorMessage(error: unknown, t: TFunction): string {
    const code = getErrorCode(error)?.toUpperCase();
    if (code === 'INSUFFICIENT_SOURCE') {
        return t('web.flashcards.generateInsufficientSource');
    }
    if (code === 'PARSE_ERROR' || code === 'INVALID_JSON' || code === 'INVALID_JSONL' || code === 'MODEL_ERROR') {
        return t('web.flashcards.generateResponseInvalid');
    }
    if (error instanceof Error && error.message === t('web.flashcards.noCardsGenerated')) {
        return t('web.flashcards.noCardsGenerated');
    }
    return t('web.flashcards.generateFailed');
}

function isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError';
}

function createAbortError(): Error {
    const error = new Error('Operation aborted');
    error.name = 'AbortError';
    return error;
}

function formatDuration(seconds: number | null): string {
    if (seconds === null) {
        return '--';
    }
    const safeSeconds = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(safeSeconds / 60);
    const remaining = safeSeconds % 60;
    if (minutes > 0) {
        return `${minutes}m ${remaining}s`;
    }
    return `${remaining}s`;
}

function toOptionalTrimmedString(value: string | null | undefined): string | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function toOptionalTags(value: string | null | undefined): string[] | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }
    const normalizedTags = value
        .split(/[;,]/)
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
    return normalizedTags.length > 0 ? normalizedTags : undefined;
}

function parseQuizCardIds(value: unknown): string[] {
    if (typeof value !== 'string') {
        return [];
    }
    const cardIds = new Set<string>();
    for (const segment of value.split(',')) {
        const cardId = segment.trim();
        if (cardId) {
            cardIds.add(cardId);
        }
    }
    return Array.from(cardIds);
}

function mapDeckCardsToFlashcards(cards: readonly DeckEditorCard[]): FlashcardsResponse['flashcards'] {
    return cards.map((card) => ({
        front: card.front,
        back: card.back,
        imageUrl: toOptionalTrimmedString(card.imageUrl),
        audioUrl: toOptionalTrimmedString(card.audioUrl),
        category: toOptionalTrimmedString(card.category),
        pos: toOptionalTrimmedString(card.pos),
        gender: toOptionalTrimmedString(card.gender),
        example: toOptionalTrimmedString(card.example),
        tags: toOptionalTags(card.tags),
    }));
}

function mapQuizReviewCards(
    cards: readonly DeckEditorCard[],
    reviews: ReadonlyMap<string, QuizEnrichment | null>,
): FlashcardsResponse['flashcards'] {
    return cards
        .filter((card) => reviews.has(card.id))
        .map((card) => {
            const review = reviews.get(card.id);
            return {
                front: card.front,
                back: card.back,
                imageUrl: toOptionalTrimmedString(card.imageUrl),
                audioUrl: toOptionalTrimmedString(card.audioUrl),
                category: toOptionalTrimmedString(card.category),
                pos: toOptionalTrimmedString(card.pos),
                gender: toOptionalTrimmedString(card.gender),
                example: toOptionalTrimmedString(card.example),
                tags: toOptionalTags(card.tags),
                ...(review ? { quiz: review } : {}),
            };
        });
}

function getSkippedQuizEnrichmentCardLabels(cards: readonly DeckEditorCard[], omittedCardIds: readonly string[]): string[] {
    const omittedCardIdSet = new Set(omittedCardIds);
    return cards
        .filter((card) => omittedCardIdSet.has(card.id))
        .map((card) => card.front.trim() || card.id);
}

type FlashcardGeneratorProps = Readonly<{
    onRequestSettingsOpen?: () => void;
    settingsUserId?: string;
    isBulkGenerationEnabled: boolean;
    hostedDeckActions: boolean;
    allowTtsProxy: boolean;
    unsplashTransport: ProviderTransport;
}>;

type GeneratorQuizMode = { kind: 'new-cards'; includeQuiz: boolean } | { kind: 'existing-deck'; deckId: string };
type QuizEnrichmentGenerationModule = typeof import('./quiz-enrichment-generation');

const DeckImportDialogLazy = lazy(() =>
    import('./components/deck-import-dialog').then((module) => ({ default: module.DeckImportDialog })),
);

const ImageSelectionDialogLazy = lazy(() =>
    import('./components/image-selection-dialog').then((module) => ({ default: module.ImageSelectionDialog })),
);

const GeneratedResultsPanelLazy = lazy(() =>
    import('./components/generated-results-panel').then((module) => ({ default: module.GeneratedResultsPanel })),
);

export function FlashcardGenerator(props: FlashcardGeneratorProps) {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const routeSearch = useSearch({ strict: false });
    const [apiKey, setApiKey] = useState('');
    const [model, setModel] = useState(DEFAULT_OPENROUTER_MODEL);
    const [cardCount, setCardCount] = useState(10);
    const [deckName, setDeckName] = useState('');
    const [format, setFormat] = useState<FlashcardFormat>(FLASHCARD_FORMATS[0]);
    const [materialType, setMaterialType] = useState<FlashcardMaterialType>(FLASHCARD_MATERIAL_TYPES[0]);
    const [materialText, setMaterialText] = useState('');
    const [materialFileName, setMaterialFileName] = useState('');
    const [materialFileSize, setMaterialFileSize] = useState<number | null>(null);
    const [materialInputKey, setMaterialInputKey] = useState(0);
    const [customInstruction, setCustomInstruction] = useState('');
    const [includeQuiz, setIncludeQuiz] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
    const [isGeneratingImages, setIsGeneratingImages] = useState(false);
    const [flashcardsState, dispatch] = useReducer(flashcardsReducer, initialFlashcardsState);
    const [generationSessionState, dispatchGenerationSession] = useReducer(
        generationSessionReducer,
        initialGenerationSessionState,
    );

    // Convenience getters for backward compatibility
    const flashcards = flashcardsState.flashcards;
    const streamedCards = flashcardsState.streamedCards;
    const generatedDecks = flashcardsState.generatedDecks;
    const [error, setError] = useState<string | null>(null);
    const [generatedCount, setGeneratedCount] = useState(0);
    const [audioProgress, setAudioProgress] = useState({ completed: 0, total: 0 });
    const [imageProgress, setImageProgress] = useState({ completed: 0, total: 0 });
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const generationRunIdRef = useRef(0);
    const preserveGeneratedOnInterruptRef = useRef(false);
    const flashcardAbortControllerRef = useRef<AbortController | null>(null);
    const audioAbortControllerRef = useRef<AbortController | null>(null);
    const imageAbortControllerRef = useRef<AbortController | null>(null);
    const generationStartRef = useRef<number | null>(null);
    const firstBatchEstimateRef = useRef<BatchEstimate | null>(null);
    const [firstBatchEstimate, setFirstBatchEstimate] = useState<BatchEstimate | null>(null);
    const [enhancedBatchEstimate, setEnhancedBatchEstimate] = useState<EnhancedBatchEstimate | null>(null);
    const [batchNumber, setBatchNumber] = useState(0);
    const [targetCardCount, setTargetCardCount] = useState<number | null>(null);
    const [elevenLabsApiKey, setElevenLabsApiKey] = useState('');
    const [elevenLabsVoiceName, setElevenLabsVoiceName] = useState('');
    const [elevenLabsModelId, setElevenLabsModelId] = useState('');
    const [selectedLanguageId, setSelectedLanguageId] = useState<string | undefined>(undefined);
    const ttsProxyUrl = props.allowTtsProxy ? (import.meta.env.VITE_AUTH_URL ?? '') : '';
    const [targetLocales, setTargetLocales] = useState<SupportedLocale[]>([BASE_LOCALE]);
    const { audioState, toggleAudio, stopAudio } = useAudioPreviewPlayer();
    const [imageSelectionCard, setImageSelectionCard] = useState<{
        card: FlashcardsResponse['flashcards'][number];
        currentImageUrl: string;
    } | null>(null);
    const [mediaFailures, setMediaFailures] = useState<GenerationFailures>({
        audio: [],
        image: [],
    });
    const [retryingCardIds, setRetryingCardIds] = useState<Set<string>>(new Set());
    const [isDeckBasedTranslation, setIsDeckBasedTranslation] = useState(false);
    const existingDeckQuizProposalsRef = useRef(new Map<string, QuizEnrichmentProposal>());
    const [existingDeckQuizReviews, setExistingDeckQuizReviews] = useState<Map<string, QuizEnrichment | null>>(
        new Map(),
    );
    const existingDeckQuizReviewRevisionsRef = useRef(new Map<string, number>());
    const [regeneratingQuizCardIds, setRegeneratingQuizCardIds] = useState<Set<string>>(new Set());
    const [existingDeckQuizOmittedCardIds, setExistingDeckQuizOmittedCardIds] = useState<string[]>([]);
    const quizDeckId = useMemo(
        () => (props.hostedDeckActions ? normalizeAppendDeckId(getObjectProperty(routeSearch, 'quizDeckId')) : null),
        [props.hostedDeckActions, routeSearch],
    );
    const appendDeckId = useMemo(
        () =>
            props.hostedDeckActions && quizDeckId === null
            ? normalizeAppendDeckId(getObjectProperty(routeSearch, 'appendDeckId'))
            : null,
        [props.hostedDeckActions, quizDeckId, routeSearch],
    );
    const [isAppendingToDeck, setIsAppendingToDeck] = useState(false);

    // Deck import state
    const [uploadedDeck, setUploadedDeck] = useState<DeckZipParseResult | null>(null);
    const [importDialogOpen, setImportDialogOpen] = useState(false);
    const [deckPreview, setDeckPreview] = useState<FileDropzonePreview | null>(null);
    const appendPrefilledDeckIdRef = useRef<string | null>(null);
    const appendSeededDeckIdRef = useRef<string | null>(null);

    const isAppendMode = appendDeckId !== null;
    const {
        data: appendDeck,
        error: appendDeckError,
        isLoading: isAppendDeckLoading,
    } = useDeckWithCards(appendDeckId ?? '', { executeOnMount: isAppendMode });
    const {
        data: quizDeck,
        error: quizDeckError,
        isLoading: isQuizDeckLoading,
    } = useDeckWithCards(quizDeckId ?? '', { executeOnMount: quizDeckId !== null });
    const selectedExistingDeckQuizCards = useMemo(() => {
        if (!quizDeck) {
            return [];
        }
        const requestedCardIds = parseQuizCardIds(getObjectProperty(routeSearch, 'quizCardIds'));
        if (requestedCardIds.length === 0) {
            return quizDeck.cards;
        }
        const requestedCardIdSet = new Set(requestedCardIds);
        return quizDeck.cards.filter((card) => requestedCardIdSet.has(card.id));
    }, [quizDeck, routeSearch]);
    const generatorQuizMode: GeneratorQuizMode =
        quizDeckId === null ? { kind: 'new-cards', includeQuiz } : { kind: 'existing-deck', deckId: quizDeckId };

    const applyExistingDeckQuizReviews = useCallback(
        (updater: (current: ReadonlyMap<string, QuizEnrichment | null>) => Map<string, QuizEnrichment | null>) => {
            setExistingDeckQuizReviews((current) => {
                const reviews = updater(current);
                if (quizDeckId !== null) {
                    const cards = mapQuizReviewCards(selectedExistingDeckQuizCards, reviews);
                    dispatch({ type: 'SET_FLASHCARDS', payload: cards.length > 0 ? { flashcards: cards } : null });
                }
                return reviews;
            });
        },
        [quizDeckId, selectedExistingDeckQuizCards],
    );

    const existingDeckQuizReviewsForSave = useMemo<QuizReview[]>(
        () => Array.from(existingDeckQuizReviews, ([cardId, quiz]) => ({ cardId, quiz })),
        [existingDeckQuizReviews],
    );

    const existingDeckQuizReviewCardIds = useMemo(
        () =>
            selectedExistingDeckQuizCards.filter((card) => existingDeckQuizReviews.has(card.id)).map((card) => card.id),
        [existingDeckQuizReviews, selectedExistingDeckQuizCards],
    );
    const quizEnrichmentSkippedSummary = useMemo(() => {
        const labels = getSkippedQuizEnrichmentCardLabels(selectedExistingDeckQuizCards, existingDeckQuizOmittedCardIds);
        if (labels.length === 0) {
            return undefined;
        }
        return t('web.flashcards.quizEnrichmentSkipped', { count: labels.length, cards: labels.join(', ') });
    }, [existingDeckQuizOmittedCardIds, selectedExistingDeckQuizCards, t]);

    const seedAppendDeckCards = useCallback(() => {
        if (!appendDeck) {
            return;
        }
        const seededCards = mapDeckCardsToFlashcards(appendDeck.cards);
        const seededDeck: FlashcardsResponse = { flashcards: seededCards };
        dispatch({ type: 'SET_FLASHCARDS', payload: seededDeck });
        dispatch({ type: 'SET_STREAMED_CARDS', payload: seededCards });
        dispatch({ type: 'SET_GENERATED_DECKS', payload: [{ locale: BASE_LOCALE, flashcards: seededDeck }] });
        setGeneratedCount(seededCards.length);
        setError(null);
        setMediaFailures({ audio: [], image: [] });
        setRetryingCardIds(new Set());
        stopAudio();
    }, [appendDeck, stopAudio]);

    const beginGenerationSession = useCallback(() => {
        const nextRunId = generationRunIdRef.current + 1;
        generationRunIdRef.current = nextRunId;
        dispatchGenerationSession({ type: 'SESSION_STARTED', runId: nextRunId });
        return nextRunId;
    }, []);

    const markTaskStarted = useCallback((task: GenerationTaskId) => {
        dispatchGenerationSession({ type: 'TASK_STARTED', task });
    }, []);

    const markTaskProgress = useCallback((task: GenerationTaskId, completed: number, total: number) => {
        dispatchGenerationSession({ type: 'TASK_PROGRESS', task, completed, total });
    }, []);

    const markTaskCompleted = useCallback((task: GenerationTaskId) => {
        dispatchGenerationSession({ type: 'TASK_COMPLETED', task });
    }, []);

    const markTaskFailed = useCallback((task: GenerationTaskId, errorMessage?: string) => {
        dispatchGenerationSession({ type: 'TASK_FAILED', task, error: errorMessage });
    }, []);

    const markTaskCancelled = useCallback((task: GenerationTaskId) => {
        dispatchGenerationSession({ type: 'TASK_CANCELLED', task });
    }, []);

    const handleInterruptConfirmOpenChange = useCallback((open: boolean) => {
        dispatchGenerationSession({ type: open ? 'INTERRUPT_CONFIRM_OPENED' : 'INTERRUPT_CONFIRM_CLOSED' });
    }, []);

    const handleProgressModalCloseAttempt = useCallback(() => {
        dispatchGenerationSession({ type: 'INTERRUPT_CONFIRM_OPENED' });
    }, []);

    const handlePreserveGeneratedOnInterruptChange = useCallback((next: boolean) => {
        dispatchGenerationSession({ type: 'INTERRUPT_PRESERVE_TOGGLED', value: next });
    }, []);

    const hasRunningTasks = useMemo(() => isAnyTaskRunning(generationSessionState), [generationSessionState]);

    const ensureSessionRunId = useCallback(() => {
        if (hasRunningTasks) {
            return generationRunIdRef.current;
        }
        return beginGenerationSession();
    }, [beginGenerationSession, hasRunningTasks]);

    useEffect(() => {
        preserveGeneratedOnInterruptRef.current = generationSessionState.preserveGeneratedOnInterrupt;
    }, [generationSessionState.preserveGeneratedOnInterrupt]);

    const resolveLocaleLabel = useCallback((locale: SupportedLocale, displayLocale: string) => {
        const fallback = locales[locale] ?? locale;
        if (typeof Intl === 'undefined' || typeof Intl.DisplayNames === 'undefined') {
            return fallback;
        }
        try {
            const display = new Intl.DisplayNames([displayLocale], { type: 'language' });
            return display.of(locale) ?? fallback;
        } catch {
            return fallback;
        }
    }, []);

    const promptConfig = useMemo(
        () => ({
            defaultFormat: FLASHCARD_FORMATS[0],
            defaultMaterialType: FLASHCARD_MATERIAL_TYPES[0],
            formats: [...FLASHCARD_FORMATS],
            materialTypes: [...FLASHCARD_MATERIAL_TYPES],
            template: FLASHCARD_PROMPT_TEMPLATE,
        }),
        [],
    );

    const normalizedTargetLocales = useMemo(() => {
        const next = new Set<SupportedLocale>([BASE_LOCALE, ...targetLocales]);
        return Array.from(next);
    }, [targetLocales]);

    const uiLanguageLabel = useMemo(() => {
        const language = i18n.language ?? BASE_LOCALE;
        const locale = isSupportedLocale(language) ? language : BASE_LOCALE;
        return resolveLocaleLabel(locale, language);
    }, [i18n.language, resolveLocaleLabel]);

    const englishLanguageLabel = useMemo(() => resolveLocaleLabel(BASE_LOCALE, BASE_LOCALE), [resolveLocaleLabel]);

    const bulkLocaleOptions = useMemo(() => supportedLocales, []);
    const canUseBulkGeneration = props.isBulkGenerationEnabled && !isAppendMode;

    const appendDeckFrontKeys = useMemo(() => {
        const keys = new Set<string>();
        for (const card of appendDeck?.cards ?? []) {
            const key = normalizeFrontKey(card.front);
            if (key) {
                keys.add(key);
            }
        }
        return keys;
    }, [appendDeck?.cards]);

    const appendableGeneratedCards = useMemo(() => {
        if (!isAppendMode || !appendDeck || !flashcards) {
            return flashcards?.flashcards ?? [];
        }

        const seen = new Set<string>(appendDeckFrontKeys);
        const next: FlashcardsResponse['flashcards'] = [];
        for (const card of flashcards.flashcards) {
            const key = normalizeFrontKey(card.front);
            if (!key || seen.has(key)) {
                continue;
            }
            seen.add(key);
            next.push(card);
        }
        return next;
    }, [appendDeck, appendDeckFrontKeys, flashcards, isAppendMode]);

    const appendDuplicateCount = useMemo(() => {
        if (!flashcards) {
            return 0;
        }
        return Math.max(0, flashcards.flashcards.length - appendableGeneratedCards.length);
    }, [appendableGeneratedCards.length, flashcards]);

    const estimatedSeconds = useMemo(() => {
        const input: MultiFactorEstimateInput = {
            textLength: materialText.length,
            cardCount: cardCount,
            materialType: materialType,
        };
        return estimateGenerationSecondsMultiFactor(input);
    }, [materialText.length, cardCount, materialType]);
    const { remainingSeconds, estimatedTotalSeconds } = useMemo(
        () =>
            resolveEnhancedGenerationTiming({
                elapsedSeconds,
                estimatedSeconds,
                isGenerating,
                firstBatchEstimate,
                enhancedBatchEstimate,
                batchNumber,
                targetCardCount,
                generatedCount,
            }),
        [
            elapsedSeconds,
            estimatedSeconds,
            firstBatchEstimate,
            enhancedBatchEstimate,
            batchNumber,
            generatedCount,
            isGenerating,
            targetCardCount,
        ],
    );
    const progressPercent = useMemo(() => {
        if (flashcards) return 100;
        if (!isGenerating) return 0;

        if (estimatedTotalSeconds) {
            return Math.min(99, Math.round((elapsedSeconds / estimatedTotalSeconds) * 100));
        }

        if (targetCardCount && generatedCount > 0) {
            return Math.min(99, Math.round((generatedCount / Math.max(1, targetCardCount)) * 100));
        }

        // Keep visible movement before first batch timing data is available.
        return Math.min(90, Math.max(5, Math.round((1 - Math.exp(-elapsedSeconds / 8)) * 90)));
    }, [elapsedSeconds, estimatedTotalSeconds, flashcards, generatedCount, isGenerating, targetCardCount]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const refreshSettings = () => {
            const openRouterSettings = getOpenRouterSettings(props.settingsUserId);
            setApiKey(openRouterSettings.apiKey);
            setModel(openRouterSettings.model);

            const elevenLabsSettings = getElevenLabsSettings(props.settingsUserId);
            setElevenLabsApiKey(elevenLabsSettings.apiKey);
            setElevenLabsVoiceName(elevenLabsSettings.voiceName);
            setElevenLabsModelId(elevenLabsSettings.modelId);
        };

        refreshSettings();

        const handleSettingsUpdate = () => refreshSettings();
        window.addEventListener('flashly:settings-updated', handleSettingsUpdate);
        window.addEventListener('storage', handleSettingsUpdate);

        return () => {
            window.removeEventListener('flashly:settings-updated', handleSettingsUpdate);
            window.removeEventListener('storage', handleSettingsUpdate);
        };
    }, [props.settingsUserId]);

    useEffect(() => {
        if (!props.isBulkGenerationEnabled || isAppendMode) {
            setTargetLocales([BASE_LOCALE]);
        }
    }, [isAppendMode, props.isBulkGenerationEnabled]);

    useEffect(() => {
        if (!appendDeck || appendPrefilledDeckIdRef.current === appendDeck.id) {
            return;
        }

        appendPrefilledDeckIdRef.current = appendDeck.id;
        setDeckName(appendDeck.name);

        const deckMaterialType = appendDeck.materialType;
        if (deckMaterialType && isFlashcardMaterialTypeValue(deckMaterialType)) {
            setMaterialType(deckMaterialType);
        }

        const deckFormat = appendDeck.deckType;
        if (deckFormat && isFlashcardFormatValue(deckFormat)) {
            setFormat(deckFormat);
        }

        if (appendDeck.materialType === 'Language' && isSupportedLocale(appendDeck.locale)) {
            setSelectedLanguageId(appendDeck.locale);
        }
    }, [appendDeck]);

    useEffect(() => {
        if (!isAppendMode) {
            appendSeededDeckIdRef.current = null;
            return;
        }
        if (!appendDeck) {
            return;
        }
        if (appendSeededDeckIdRef.current === appendDeck.id) {
            return;
        }
        appendSeededDeckIdRef.current = appendDeck.id;
        seedAppendDeckCards();
    }, [appendDeck, isAppendMode, seedAppendDeckCards]);

    useEffect(() => {
        if (materialType !== 'Language') {
            setSelectedLanguageId(undefined);
        }
    }, [materialType]);

    useEffect(() => {
        if (!isGenerating) return;
        const interval = window.setInterval(() => {
            if (generationStartRef.current === null) return;
            const elapsed = Math.floor((performance.now() - generationStartRef.current) / 1000);
            setElapsedSeconds(elapsed);
        }, 500);

        return () => window.clearInterval(interval);
    }, [isGenerating]);

    useEffect(() => {
        return () => {
            flashcardAbortControllerRef.current?.abort();
            audioAbortControllerRef.current?.abort();
            imageAbortControllerRef.current?.abort();
        };
    }, []);

    const handleCustomInstructionChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setCustomInstruction(event.target.value);
    }, []);

    const handleDeckNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setDeckName(event.target.value);
    }, []);

    const handleTargetLocalesChange = useCallback((locales: SupportedLocale[]) => {
        const withoutBase = locales.filter((locale) => locale !== BASE_LOCALE);
        setTargetLocales(withoutBase);
    }, []);

    const handleCardCountChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const nextValue = Number(event.target.value);
        if (Number.isNaN(nextValue)) {
            setCardCount(0);
            return;
        }
        setCardCount(Math.min(MAX_CARD_COUNT, Math.max(0, nextValue)));
    }, []);

    const handleIncludeQuizChange = useCallback((checked: boolean) => {
        setIncludeQuiz(checked);
    }, []);

    const readMaterialFile = useCallback(
        async (file: File) => {
            // Check for deck .flashly file
            if (file.name.toLowerCase().endsWith('.flashly')) {
                try {
                    const parsed = await readDeckZipFile(file);
                    setUploadedDeck(parsed);

                    // Set file name and size so FileDropzone shows the preview
                    setMaterialFileName(file.name);
                    setMaterialFileSize(file.size);

                    // Create preview for display in FileDropzone
                    const preview = createDeckFileDropzonePreview(
                        parsed,
                        (locale) => (isSupportedLocale(locale) ? locales[locale] : locale),
                        {
                            cards: t('web.flashcards.deckPreview.cards'),
                            language: t('web.flashcards.deckPreview.language'),
                            materialType: t('web.flashcards.deckPreview.materialType'),
                            deckType: t('web.flashcards.deckPreview.deckType'),
                        },
                    );
                    setDeckPreview(preview);

                    setImportDialogOpen(true);
                } catch (error) {
                    let message = t('web.flashcards.deckImport.invalidDeckZip');
                    const deckZipCode = getDeckZipErrorCode(error);
                    if (deckZipCode) {
                        const descriptor = getDeckImportMessageDescriptor(deckZipCode);
                        message = t(descriptor.key);
                        if (descriptor.hintKey) {
                            message = `${message} ${t(descriptor.hintKey)}`;
                        }
                    }
                    toast.error(message);
                    setDeckPreview(null);
                }
                return;
            }

            // Handle text files
            if (!file.name.match(/\.(txt|md)$/i)) {
                toast.error(t('web.flashcards.materialFileInvalid'));
                return;
            }

            setMaterialFileName(file.name);
            setMaterialFileSize(file.size);

            const reader = new FileReader();
            const handleLoad = () => {
                const content = typeof reader.result === 'string' ? reader.result : '';
                setMaterialText(content);
            };
            const handleError = () => {
                const message = t('web.flashcards.materialFileReadError');
                setMaterialText('');
                setMaterialFileName('');
                setMaterialFileSize(null);
                toast.error(message);
            };
            reader.addEventListener('load', handleLoad, { once: true });
            reader.addEventListener('error', handleError, { once: true });
            reader.readAsText(file);
        },
        [t],
    );

    const handleClearMaterial = useCallback(() => {
        setMaterialText('');
        setMaterialFileName('');
        setMaterialFileSize(null);
        setDeckPreview(null);
        setMaterialInputKey((value) => value + 1);
    }, []);

    const handleDeckImport = useCallback(
        async (options: ImportConfirmOptions) => {
            if (!uploadedDeck) return;

            const selectedLanguageLocale = isSupportedLocale(selectedLanguageId) ? selectedLanguageId : null;
            const processed = processDeckImport({
                uploadedDeck,
                options,
                currentFlashcards: flashcards?.flashcards ?? [],
                generatedDecks,
                materialType,
                selectedLanguageLocale,
            });

            // Detect locale from config and set up for bulk generation
            if (processed.detectedLocale) {
                const detectedLocale = processed.detectedLocale;

                // Set material type to Language for bulk generation
                setMaterialType('Language');

                // Pre-select the detected language (locale is now already in ElevenLabs format)
                setSelectedLanguageId(detectedLocale);

                // Show toast indicating source language detected
                toast.success(
                    t('web.flashcards.deckImport.deckLanguageDetected', {
                        language: resolveLocaleLabel(detectedLocale, i18n.language),
                    }),
                );
            }

            // Validate locale compatibility for base deck translation
            if (!processed.ok) {
                toast.error(t('web.flashcards.deckImport.multipleLocalesNotSupported'));
                setImportDialogOpen(false);
                setUploadedDeck(null);
                return;
            }

            if (processed.enableDeckBasedTranslation) {
                setIsDeckBasedTranslation(true);
            }

            // Set cards in state
            dispatch({ type: 'SET_FLASHCARDS', payload: { flashcards: processed.cards } });

            // Set deck name from config
            if (processed.deckName) {
                setDeckName(processed.deckName);
            }

            // Close dialog and clear uploaded deck
            setImportDialogOpen(false);
            setUploadedDeck(null);

            // Regenerate selected assets
            if (processed.missingAudioToRegenerate > 0) {
                toast.info(
                    t('web.flashcards.deckImport.missingAssets', {
                        missingAudio: processed.missingAudioToRegenerate,
                        missingImages: 0,
                    }),
                );
            }

            if (processed.missingImagesToRegenerate > 0) {
                toast.info(
                    t('web.flashcards.deckImport.missingAssets', {
                        missingAudio: 0,
                        missingImages: processed.missingImagesToRegenerate,
                    }),
                );
            }
        },
        [
            uploadedDeck,
            flashcards,
            generatedDecks,
            materialType,
            selectedLanguageId,
            t,
            i18n,
            resolveLocaleLabel,
            setMaterialType,
            setSelectedLanguageId,
            setDeckName,
        ],
    );

    const requestSettingsOpen = useCallback(() => {
        props.onRequestSettingsOpen?.();
    }, [props.onRequestSettingsOpen]);

    const resetGenerationState = useCallback(
        (options?: Readonly<{ resetSession?: boolean; clearDeckBasedTranslation?: boolean }>) => {
        dispatch({ type: 'RESET' });
        setError(null);
        setGeneratedCount(0);
        setElapsedSeconds(0);
        setFirstBatchEstimate(null);
        setEnhancedBatchEstimate(null);
        setBatchNumber(0);
        firstBatchEstimateRef.current = null;
        setTargetCardCount(null);
        setIsGenerating(false);
        setIsGeneratingAudio(false);
        setAudioProgress({ completed: 0, total: 0 });
        setIsGeneratingImages(false);
        setImageProgress({ completed: 0, total: 0 });
        stopAudio();
        setMediaFailures({ audio: [], image: [] });
        setRetryingCardIds(new Set());
        generationStartRef.current = null;
        flashcardAbortControllerRef.current = null;
        audioAbortControllerRef.current = null;
        imageAbortControllerRef.current = null;

        if (options?.clearDeckBasedTranslation ?? true) {
            setIsDeckBasedTranslation(false);
        }

        if (options?.resetSession ?? true) {
            dispatchGenerationSession({ type: 'SESSION_RESET' });
        }
        },
        [stopAudio],
    );

    const handleGenerate = useCallback(async () => {
        setError(null);
        dispatch({ type: 'RESET' });
        setGeneratedCount(0);
        setElapsedSeconds(0);
        setFirstBatchEstimate(null);
        setEnhancedBatchEstimate(null);
        setBatchNumber(0);
        firstBatchEstimateRef.current = null;
        setTargetCardCount(
            generatorQuizMode.kind === 'existing-deck'
            ? selectedExistingDeckQuizCards.length
                : cardCount > 0
                  ? Math.min(MAX_CARD_COUNT, cardCount)
                  : null,
        );
        setIsGeneratingAudio(false);
        setAudioProgress({ completed: 0, total: 0 });
        setIsGeneratingImages(false);
        setImageProgress({ completed: 0, total: 0 });
        stopAudio();
        setMediaFailures({ audio: [], image: [] });
        setRetryingCardIds(new Set());
        firstBatchEstimateRef.current = null;

        if (!apiKey.trim()) {
            const message = t('web.flashcards.missingOpenRouterKey');
            setError(message);
            dispatch({ type: 'SET_FLASHCARDS', payload: null });
            toast.error(message);
            requestSettingsOpen();
            return;
        }
        if (generatorQuizMode.kind === 'new-cards' && (cardCount < 0 || cardCount > MAX_CARD_COUNT)) {
            const message = t('web.flashcards.minCards');
            setError(message);
            toast.error(message);
            return;
        }
        if (!model.trim()) {
            const message = t('web.flashcards.missingModel');
            setError(message);
            toast.error(message);
            return;
        }
        if (generatorQuizMode.kind === 'new-cards' && !hasGenerationInput(materialText, customInstruction)) {
            const message = t('web.flashcards.inputRequired');
            setError(message);
            toast.error(message);
            return;
        }

        if (generatorQuizMode.kind === 'existing-deck') {
            if (isQuizDeckLoading || !quizDeck || quizDeckError) {
                const message = t('web.flashcards.generateFailed');
                setError(message);
                toast.error(message);
                return;
            }
            if (selectedExistingDeckQuizCards.length === 0) {
                const message = t('web.flashcards.quizEnrichmentNoSelectedCards');
                setError(message);
                toast.error(message);
                return;
            }

            const runId = beginGenerationSession();
            markTaskStarted('flashcards');
            const flashcardAbortController = new AbortController();
            flashcardAbortControllerRef.current = flashcardAbortController;
            generationStartRef.current = performance.now();
            setIsGenerating(true);
            existingDeckQuizProposalsRef.current = new Map();
            existingDeckQuizReviewRevisionsRef.current = new Map();
            setExistingDeckQuizOmittedCardIds([]);
            applyExistingDeckQuizReviews(() => new Map());
            const sourceCards: QuizEnrichmentSourceCard[] = selectedExistingDeckQuizCards.map((card) => ({
                id: card.id,
                front: card.front,
                back: card.back,
            }));
            const isStaleRun = () => runId !== generationRunIdRef.current;
            const isCancelled = () => flashcardAbortController.signal.aborted || isStaleRun();
            const requestRevisions = new Map(existingDeckQuizReviewRevisionsRef.current);
            const applyExistingDeckQuizResult = (result: QuizEnrichmentGenerationResult) => {
                existingDeckQuizProposalsRef.current = new Map(
                    result.proposals.map((proposal) => [proposal.cardId, proposal]),
                );
                setExistingDeckQuizOmittedCardIds(result.omittedCardIds);
                const proposals = new Map(result.proposals.map((proposal) => [proposal.cardId, proposal.quiz]));
                applyExistingDeckQuizReviews((current) =>
                    mergeGeneratedQuizReviews(
                        current,
                        proposals,
                        requestRevisions,
                        existingDeckQuizReviewRevisionsRef.current,
                    ),
                );
                setGeneratedCount(result.proposals.length);
                markTaskProgress('flashcards', result.proposals.length, sourceCards.length);
            };
            let quizEnrichmentGeneration: QuizEnrichmentGenerationModule | undefined;

            try {
                quizEnrichmentGeneration = await import('./quiz-enrichment-generation');
                const result = await quizEnrichmentGeneration.generateQuizEnrichmentBatchesWithProgress({
                    apiKey: apiKey.trim(),
                    appName: 'Flashly',
                    baseUrl: OPENROUTER_BASE_URL,
                    model: model.trim(),
                    cards: sourceCards,
                    instruction: customInstruction,
                    siteUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
                    abortSignal: flashcardAbortController.signal,
                    onProposal: (proposal) => {
                        if (isCancelled()) {
                            return;
                        }
                        existingDeckQuizProposalsRef.current.set(proposal.cardId, proposal);
                        const proposals = new Map(
                            Array.from(existingDeckQuizProposalsRef.current, ([cardId, item]) => [cardId, item.quiz]),
                        );
                        applyExistingDeckQuizReviews((current) =>
                            mergeGeneratedQuizReviews(
                                current,
                                proposals,
                                requestRevisions,
                                existingDeckQuizReviewRevisionsRef.current,
                            ),
                        );
                        const proposalCount = existingDeckQuizProposalsRef.current.size;
                        setGeneratedCount(proposalCount);
                        markTaskProgress('flashcards', proposalCount, sourceCards.length);
                    },
                });
                if (isCancelled()) {
                    throw createAbortError();
                }
                applyExistingDeckQuizResult(result);
                markTaskCompleted('flashcards');
                toast.success(t('web.flashcards.quizEnrichmentGenerated', { count: result.proposals.length }));
            } catch (err) {
                if (isCancelled() || isAbortError(err)) {
                    existingDeckQuizProposalsRef.current = new Map();
                    existingDeckQuizReviewRevisionsRef.current = new Map();
                    setExistingDeckQuizOmittedCardIds([]);
                    applyExistingDeckQuizReviews(() => new Map());
                    markTaskCancelled('flashcards');
                    toast.info(t('web.flashcards.progressModal.interrupted'));
                } else {
                    const partialResult = quizEnrichmentGeneration?.getQuizEnrichmentPartialResult(err);
                    if (partialResult) {
                        applyExistingDeckQuizResult(partialResult);
                    }
                    logger.error('existing deck quiz generation failed', err);
                    const message = resolveGenerationErrorMessage(err, t);
                    setError(message);
                    markTaskFailed('flashcards', message);
                    toast.error(message);
                }
            } finally {
                setIsGenerating(false);
                generationStartRef.current = null;
                flashcardAbortControllerRef.current = null;
            }
            return;
        }

        const runId = beginGenerationSession();
        markTaskStarted('flashcards');
        const flashcardAbortController = new AbortController();
        flashcardAbortControllerRef.current = flashcardAbortController;
        generationStartRef.current = performance.now();
        setIsGenerating(true);
        const accumulated: { flashcards: FlashcardsResponse['flashcards'] } = {
            flashcards: [],
        };

        const isStaleRun = () => runId !== generationRunIdRef.current;
        const isCancelled = () => flashcardAbortController.signal.aborted || isStaleRun();

        try {
            const { generateFlashcardsWithProgress } = await import('./flashcard-generation');
            const activeLocales = canUseBulkGeneration ? normalizedTargetLocales : [BASE_LOCALE];
            const shouldGenerateBulk = canUseBulkGeneration && activeLocales.length > 1;
            const baseLanguageLabel = shouldGenerateBulk ? englishLanguageLabel : uiLanguageLabel;
            const combinedInstruction = [customInstruction.trim(), `Preferred language: ${baseLanguageLabel}`]
                .filter(Boolean)
                .join('\n');
            const existingQuestions = new Set<string>(appendDeckFrontKeys);
            const streamedQuestions = new Set<string>();
            let totalGenerated = 0;
            const isAutoCount = cardCount === 0;
            const targetCount = isAutoCount ? MAX_CARD_COUNT : cardCount;

            // Check if deck-based translation - skip AI generation entirely
            if (isDeckBasedTranslation && flashcards?.flashcards.length) {
                // Use existing deck as base - no AI generation needed
                accumulated.flashcards = flashcards.flashcards;
                totalGenerated = flashcards.flashcards.length;
                setGeneratedCount(totalGenerated);
                setTargetCardCount(totalGenerated);
                markTaskProgress('flashcards', totalGenerated, totalGenerated);

                toast.info(
                    t('web.flashcards.usingExistingDeckAsBase', {
                        count: totalGenerated,
                    }),
                );
            } else {
            const maxIterations = isAutoCount ? 1 : Math.max(6, Math.ceil(cardCount / BATCH_SIZE) + 8);
            let consecutiveEmptyBatches = 0;

            for (let iteration = 0; iteration < maxIterations && totalGenerated < targetCount; iteration += 1) {
                if (isCancelled()) {
                    throw createAbortError();
                }
                const remaining = targetCount - totalGenerated;
                const batchCount = isAutoCount ? 0 : Math.min(BATCH_SIZE, remaining);
                const previousQuestionLimit = Math.min(
                    existingQuestions.size,
                    Math.max(BASE_PREVIOUS_QUESTIONS, Math.min(targetCount, MAX_CARD_COUNT)),
                );
                const previousQuestions = Array.from(existingQuestions).slice(-previousQuestionLimit);

                // Find selected language for Language material type
                    const selectedLanguage =
                        materialType === 'Language' && selectedLanguageId
                            ? ELEVENLABS_V3_LANGUAGES.find((lang) => lang.code === selectedLanguageId)
                    : undefined;

                const { prompt } = buildFlashcardPrompt(
                    {
                        customInstruction: combinedInstruction,
                        documentText: materialText,
                        format,
                        materialType,
                        count: batchCount,
                        previousQuestions,
                        includeImages: true,
                        includeQuiz: generatorQuizMode.includeQuiz,
                        languageId: selectedLanguage?.code,
                        languageName: selectedLanguage?.name,
                    },
                    promptConfig,
                );

                const batchStartedAt = performance.now();
                const result = await generateFlashcardsWithProgress({
                    apiKey: apiKey.trim(),
                    appName: 'Flashly',
                    baseUrl: OPENROUTER_BASE_URL,
                    model: model.trim(),
                    prompt,
                    siteUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
                    abortSignal: flashcardAbortController.signal,
                    onCard: (card, allCards) => {
                        if (isCancelled()) {
                            return;
                        }
                        dispatch({ type: 'SET_STREAMED_CARDS', payload: [...accumulated.flashcards, ...allCards] });
                        const key = normalizeFrontKey(card.front);
                        if (!key || existingQuestions.has(key) || streamedQuestions.has(key)) {
                            return;
                        }
                        streamedQuestions.add(key);
                        const nextGeneratedCount = Math.min(targetCount, streamedQuestions.size);
                        setGeneratedCount(nextGeneratedCount);
                        markTaskProgress('flashcards', nextGeneratedCount, targetCount);
                    },
                });
                if (isCancelled()) {
                    throw createAbortError();
                }
                const batchElapsedSeconds = Math.max(1, (performance.now() - batchStartedAt) / 1000);

                const newCards = result.flashcards.flashcards.filter((card) => {
                    const key = normalizeFrontKey(card.front);
                    if (!key || existingQuestions.has(key)) return false;
                    existingQuestions.add(key);
                    streamedQuestions.add(key);
                    return true;
                });

                if (newCards.length === 0) {
                    consecutiveEmptyBatches += 1;
                    if (consecutiveEmptyBatches >= 3) {
                        break;
                    }
                    continue;
                }
                consecutiveEmptyBatches = 0;

                const limitedCards = newCards.slice(0, remaining);
                if (!firstBatchEstimateRef.current && limitedCards.length > 0) {
                    const estimate = { durationSeconds: batchElapsedSeconds, cardCount: limitedCards.length };
                    firstBatchEstimateRef.current = estimate;
                    setFirstBatchEstimate(estimate);
                }

                // Track batch timing for enhanced estimation
                if (limitedCards.length > 0) {
                    const estimate = { durationSeconds: batchElapsedSeconds, cardCount: limitedCards.length };

                    if (!firstBatchEstimateRef.current) {
                        firstBatchEstimateRef.current = estimate;
                        setFirstBatchEstimate(estimate);
                    }

                    // Update enhanced batch estimate
                        setBatchNumber((prev) => prev + 1);
                        setEnhancedBatchEstimate((prev) => {
                        const batches = [...(prev?.batches || []), estimate];
                        return calculateWeightedBatchAverage(batches);
                    });
                }
                accumulated.flashcards.push(...limitedCards);
                totalGenerated = accumulated.flashcards.length;
                setGeneratedCount(totalGenerated);
                markTaskProgress('flashcards', totalGenerated, targetCount);
            }
            } // End of else block for normal generation

            if (accumulated.flashcards.length === 0) {
                throw new Error(t('web.flashcards.noCardsGenerated'));
            }

            if (!isAutoCount && accumulated.flashcards.length < cardCount) {
                toast.error(
                    t('web.flashcards.partialGenerated', {
                        generated: accumulated.flashcards.length,
                        requested: cardCount,
                    }),
                );
            }

            const translationTargets = shouldGenerateBulk
                ? activeLocales.filter((locale) => locale !== BASE_LOCALE)
                : [];

            const translationTasks = translationTargets.map(async (locale) => {
                if (isCancelled()) {
                    throw createAbortError();
                }
                const localeLabel = resolveLocaleLabel(locale, BASE_LOCALE);

                // Build source JSONL with all fields needed for translation
                const sourceJsonl = accumulated.flashcards
                    .map((card) =>
                        JSON.stringify({
                        front: card.front,
                        back: card.back,
                        ...(card.example ? { example: card.example } : {}),
                        }),
                    )
                    .join('\n');

                // Use new helper to build translation prompt
                const sourceLocale = generatedDecks.length > 0 ? generatedDecks[0].locale : BASE_LOCALE;

                const prompt = buildDeckTranslationPrompt({
                    sourceJsonl,
                    targetLocale: locale,
                    materialType: materialType,
                    sourceLanguage: sourceLocale,
                });

                try {
                    const result = await generateFlashcardsWithProgress({
                        apiKey: apiKey.trim(),
                        appName: 'Flashly',
                        baseUrl: OPENROUTER_BASE_URL,
                        model: model.trim(),
                        prompt,
                        siteUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
                        abortSignal: flashcardAbortController.signal,
                    });
                    if (isCancelled()) {
                        throw createAbortError();
                    }

                    // For Language decks, ensure front text is preserved exactly
                    const translatedCards =
                        materialType === 'Language'
                        ? result.flashcards.flashcards.map((card, idx) => ({
                            ...card,
                            front: accumulated.flashcards[idx].front,  // PRESERVE original
                            // Preserve structured example format if present
                                  example:
                                      isLanguageExample(accumulated.flashcards[idx].example) &&
                                isLanguageExample(card.example)
                                ? {
                                    target: card.example.target || card.front,
                                    english: accumulated.flashcards[idx].example.english,
                                    romanization: card.example.romanization,
                                }
                                : card.example,
                        }))
                        : result.flashcards.flashcards;

                    return { locale, flashcards: { flashcards: translatedCards } };
                } catch (error) {
                    logger.error('translation deck generation failed', error);
                    toast.error(
                        t('web.flashcards.translationFailed', {
                            language: localeLabel,
                        }),
                    );
                    return null;
                }
            });

            const translatedResults = await Promise.all(translationTasks);
            if (isCancelled()) {
                throw createAbortError();
            }

            const translatedDecks = translatedResults
                .filter((entry): entry is { locale: SupportedLocale; flashcards: FlashcardsResponse } => Boolean(entry))
                .map((entry) => entry);

            const englishDeck = { flashcards: accumulated.flashcards };
            dispatch({ type: 'SET_FLASHCARDS', payload: englishDeck });
            dispatch({
                type: 'SET_GENERATED_DECKS',
                payload: [{ locale: BASE_LOCALE, flashcards: englishDeck }, ...translatedDecks],
            });
            setGeneratedCount(accumulated.flashcards.length);
            markTaskProgress('flashcards', accumulated.flashcards.length, accumulated.flashcards.length);
            dispatch({ type: 'SET_STREAMED_CARDS', payload: accumulated.flashcards });
            if (generationStartRef.current !== null) {
                const elapsed = Math.floor((performance.now() - generationStartRef.current) / 1000);
                setElapsedSeconds(elapsed);
            }
            markTaskCompleted('flashcards');
            toast.success(t('web.flashcards.generatedSuccess'));
        } catch (err) {
            if (isCancelled() || isAbortError(err)) {
                markTaskCancelled('flashcards');
                toast.info(t('web.flashcards.progressModal.interrupted'));

                if (preserveGeneratedOnInterruptRef.current) {
                    const partialCards = accumulated.flashcards.length > 0 ? accumulated.flashcards : streamedCards;
                    if (partialCards.length > 0) {
                        const partialDeck = { flashcards: partialCards };
                        dispatch({ type: 'SET_FLASHCARDS', payload: partialDeck });
                        dispatch({
                            type: 'SET_GENERATED_DECKS',
                            payload: [{ locale: BASE_LOCALE, flashcards: partialDeck }],
                        });
                        setGeneratedCount(partialCards.length);
                        dispatch({ type: 'SET_STREAMED_CARDS', payload: partialCards });
                    }
                    return;
                }

                resetGenerationState({ resetSession: false });
                return;
            }

            logger.error('flashcard generation failed', err);
            const message = resolveGenerationErrorMessage(err, t);
            setError(message);
            markTaskFailed('flashcards', message);
            toast.error(message);
            setGeneratedCount(0);
        } finally {
            setIsGenerating(false);
            generationStartRef.current = null;
            flashcardAbortControllerRef.current = null;
        }
    }, [
        apiKey,
        beginGenerationSession,
        cardCount,
        customInstruction,
        format,
        canUseBulkGeneration,
        markTaskCancelled,
        markTaskCompleted,
        markTaskFailed,
        markTaskProgress,
        markTaskStarted,
        normalizedTargetLocales,
        generatorQuizMode,
        englishLanguageLabel,
        uiLanguageLabel,
        materialText,
        materialType,
        model,
        promptConfig,
        resolveLocaleLabel,
        selectedLanguageId,
        stopAudio,
        t,
        requestSettingsOpen,
        appendDeckFrontKeys,
        isQuizDeckLoading,
        quizDeck,
        quizDeckError,
        selectedExistingDeckQuizCards,
        applyExistingDeckQuizReviews,
        resetGenerationState,
        streamedCards,
    ]);

    const handleClearResults = useCallback(() => {
        existingDeckQuizProposalsRef.current = new Map();
        existingDeckQuizReviewRevisionsRef.current = new Map();
        setExistingDeckQuizOmittedCardIds([]);
        applyExistingDeckQuizReviews(() => new Map());
        if (isAppendMode && appendDeck) {
            resetGenerationState();
            seedAppendDeckCards();
            return;
        }
        resetGenerationState();
    }, [appendDeck, applyExistingDeckQuizReviews, isAppendMode, resetGenerationState, seedAppendDeckCards]);

    const handleImageClick = useCallback(
        (card: FlashcardsResponse['flashcards'][number]) => {
        const latestUnsplashAccessKey = getUnsplashSettings(props.settingsUserId).accessKey.trim();
        if (props.unsplashTransport === 'direct' && !latestUnsplashAccessKey) {
            toast.error(t('web.flashcards.missingUnsplashKey'));
            requestSettingsOpen();
            return;
        }

        const currentImageUrl = typeof card.imageUrl === 'string' ? card.imageUrl.trim() : '';
        setImageSelectionCard({ card, currentImageUrl });
        },
        [props.settingsUserId, props.unsplashTransport, requestSettingsOpen, t],
    );

    const handleImageSelect = useCallback(
        (newImageUrl: string) => {
        if (!imageSelectionCard) return;

        const targetCardId = getStableCardId(imageSelectionCard.card);

        // Update all three state pieces atomically
            dispatch({
                type: 'SET_GENERATED_DECKS',
                payload: generatedDecks.map((deck) => {
            const updatedCards = deck.flashcards.flashcards.map((card) => {
                if (getStableCardId(card) === targetCardId) {
                    return { ...card, imageUrl: newImageUrl };
                }
                return card;
            });
            return { ...deck, flashcards: { flashcards: updatedCards } };
                }),
            });

            dispatch({
                type: 'SET_FLASHCARDS',
                payload: flashcards
                    ? {
            flashcards: flashcards.flashcards.map((card) => {
                if (getStableCardId(card) === targetCardId) {
                    return { ...card, imageUrl: newImageUrl };
                }
                return card;
            }),
                      }
                    : null,
            });

            dispatch({
                type: 'SET_STREAMED_CARDS',
                payload: streamedCards.map((card) => {
            if (getStableCardId(card) === targetCardId) {
                return { ...card, imageUrl: newImageUrl };
            }
            return card;
                }),
            });

        setImageSelectionCard(null);
        },
        [imageSelectionCard, generatedDecks, flashcards, streamedCards],
    );

    const handleUpdateCardFront = useCallback(
        (index: number, front: string) => {
        if (!flashcards || index < 0 || index >= flashcards.flashcards.length) {
            return;
        }

        const targetCard = flashcards.flashcards[index];
        if (!targetCard) {
            return;
        }
        const targetCardId = getStableCardId(targetCard);
        const nextFront = front.trim();
        if (!nextFront) {
            return;
        }

        dispatch({ type: 'UPDATE_CARD_FRONT_AT_INDEX', payload: { index, front: nextFront } });
        setMediaFailures((prev) => ({
            audio: prev.audio.filter((failure) => failure.cardId !== targetCardId && failure.cardIndex !== index),
            image: prev.image.filter((failure) => failure.cardId !== targetCardId && failure.cardIndex !== index),
        }));
        setRetryingCardIds((prev) => {
            if (!prev.has(targetCardId)) {
                return prev;
            }
            const next = new Set(prev);
            next.delete(targetCardId);
            return next;
        });
        },
        [flashcards],
    );

    const handleRemoveCard = useCallback(
        (index: number) => {
        if (!flashcards || index < 0 || index >= flashcards.flashcards.length) {
            return;
        }

        const targetCard = flashcards.flashcards[index];
        if (!targetCard) {
            return;
        }
        const targetCardId = getStableCardId(targetCard);
        const cardAudioUrl = typeof targetCard.audioUrl === 'string' ? targetCard.audioUrl.trim() : '';

        dispatch({ type: 'REMOVE_CARD_AT_INDEX', payload: { index } });
        setMediaFailures((prev) => ({
            audio: prev.audio
                .filter((failure) => failure.cardId !== targetCardId && failure.cardIndex !== index)
                    .map((failure) =>
                        failure.cardIndex > index ? { ...failure, cardIndex: failure.cardIndex - 1 } : failure,
                    ),
            image: prev.image
                .filter((failure) => failure.cardId !== targetCardId && failure.cardIndex !== index)
                    .map((failure) =>
                        failure.cardIndex > index ? { ...failure, cardIndex: failure.cardIndex - 1 } : failure,
                    ),
        }));
        setRetryingCardIds((prev) => {
            if (!prev.has(targetCardId)) {
                return prev;
            }
            const next = new Set(prev);
            next.delete(targetCardId);
            return next;
        });

        if (cardAudioUrl && audioState.activeUrl === cardAudioUrl) {
            stopAudio();
        }
        },
        [audioState.activeUrl, flashcards, stopAudio],
    );

    const handleUpdateCardQuiz = useCallback(
        (index: number, quiz: QuizEnrichment) => {
            if (generatorQuizMode.kind === 'existing-deck') {
                const cardId = existingDeckQuizReviewCardIds[index];
                if (!cardId) {
                    return;
                }
                existingDeckQuizReviewRevisionsRef.current.set(
                    cardId,
                    (existingDeckQuizReviewRevisionsRef.current.get(cardId) ?? 0) + 1,
                );
                applyExistingDeckQuizReviews((current) => updateQuizReview(current, cardId, quiz));
                return;
            }
            dispatch({ type: 'UPDATE_CARD_QUIZ_AT_INDEX', payload: { index, quiz } });
        },
        [applyExistingDeckQuizReviews, existingDeckQuizReviewCardIds, generatorQuizMode.kind],
    );

    const handleRemoveCardQuiz = useCallback(
        (index: number) => {
            if (generatorQuizMode.kind === 'existing-deck') {
                const cardId = existingDeckQuizReviewCardIds[index];
                if (!cardId) {
                    return;
                }
                existingDeckQuizReviewRevisionsRef.current.set(
                    cardId,
                    (existingDeckQuizReviewRevisionsRef.current.get(cardId) ?? 0) + 1,
                );
                applyExistingDeckQuizReviews((current) => updateQuizReview(current, cardId, null));
                return;
            }
            dispatch({ type: 'UPDATE_CARD_QUIZ_AT_INDEX', payload: { index } });
        },
        [applyExistingDeckQuizReviews, existingDeckQuizReviewCardIds, generatorQuizMode.kind],
    );

    const handleRegenerateCardQuiz = useCallback(
        async (index: number) => {
            if (generatorQuizMode.kind !== 'existing-deck') {
                return;
            }
            const cardId = existingDeckQuizReviewCardIds[index];
            const card = selectedExistingDeckQuizCards.find((candidate) => candidate.id === cardId);
            if (!card || regeneratingQuizCardIds.has(card.id)) {
                return;
            }
            const regenerationRevision = claimQuizReviewRevision(existingDeckQuizReviewRevisionsRef.current, card.id);
            const requestRevisions = new Map<string, number>([[card.id, regenerationRevision]]);
            const applyRegeneratedQuiz = (quiz: QuizEnrichment) => {
                applyExistingDeckQuizReviews((current) =>
                    mergeGeneratedQuizReviews(
                        current,
                        new Map([[card.id, quiz]]),
                        requestRevisions,
                        existingDeckQuizReviewRevisionsRef.current,
                    ),
                );
            };
            setRegeneratingQuizCardIds((current) => new Set(current).add(card.id));
            try {
                const { generateQuizEnrichmentBatchesWithProgress } = await import('./quiz-enrichment-generation');
                const result = await generateQuizEnrichmentBatchesWithProgress({
                    apiKey: apiKey.trim(),
                    appName: 'Flashly',
                    baseUrl: OPENROUTER_BASE_URL,
                    model: model.trim(),
                    cards: [{ id: card.id, front: card.front, back: card.back }],
                    instruction: customInstruction,
                    siteUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
                    onProposal: (proposal) => {
                        if (proposal.cardId === card.id) {
                            applyRegeneratedQuiz(proposal.quiz);
                        }
                    },
                });
                const proposal = result.proposals[0];
                if (!proposal) {
                    toast.error(t('web.flashcards.quizEnrichmentRegenerateFailed'));
                    return;
                }
                applyRegeneratedQuiz(proposal.quiz);
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : t('web.flashcards.quizEnrichmentRegenerateFailed');
                toast.error(message);
            } finally {
                setRegeneratingQuizCardIds((current) => {
                    const next = new Set(current);
                    next.delete(card.id);
                    return next;
                });
            }
        },
        [
            apiKey,
            applyExistingDeckQuizReviews,
            customInstruction,
            existingDeckQuizReviewCardIds,
            generatorQuizMode.kind,
            model,
            regeneratingQuizCardIds,
            selectedExistingDeckQuizCards,
            t,
        ],
    );

    const updateCardsWithAudio = useCallback((cards: FlashcardsResponse['flashcards']) => {
        dispatch({ type: 'UPDATE_WITH_AUDIO', payload: cards });
    }, []);

    const updateCardsWithImages = useCallback((cards: FlashcardsResponse['flashcards']) => {
        dispatch({ type: 'UPDATE_WITH_IMAGES', payload: cards });
    }, []);

    const {
        handleGenerateAudio: handleGenerateAudioBase,
        handleGenerateImages: handleGenerateImagesBase,
        handleRetryAudio,
        handleRetryImage,
    } = useFlashcardMediaActions({
        flashcards,
        streamedCards,
        retryingCardIds,
        userId: props.settingsUserId,
        elevenLabsApiKey,
        elevenLabsVoiceName,
        elevenLabsModelId,
        ttsProxyUrl,
        materialType,
        selectedLanguageId,
        isGeneratingAudio,
        setIsGeneratingAudio,
        setAudioProgress,
        isGeneratingImages,
        setIsGeneratingImages,
        setImageProgress,
        setMediaFailures,
        setRetryingCardIds,
        getStableCardId,
        onUpdateWithAudio: updateCardsWithAudio,
        onUpdateWithImages: updateCardsWithImages,
        requestSettingsOpen,
        unsplashTransport: props.unsplashTransport,
        unsplashImageWidth: UNSPLASH_IMAGE_WIDTH,
        unsplashImageQuality: UNSPLASH_IMAGE_QUALITY,
        getAudioAbortSignal: () => audioAbortControllerRef.current?.signal,
        getImageAbortSignal: () => imageAbortControllerRef.current?.signal,
        onAudioTaskStarted: () => markTaskStarted('audio'),
        onAudioTaskProgress: ({ completed, total }) => markTaskProgress('audio', completed, total),
        onAudioTaskCompleted: () => markTaskCompleted('audio'),
        onAudioTaskFailed: (errorMessage) => markTaskFailed('audio', errorMessage),
        onAudioTaskCancelled: () => markTaskCancelled('audio'),
        onImageTaskStarted: () => markTaskStarted('images'),
        onImageTaskProgress: ({ completed, total }) => markTaskProgress('images', completed, total),
        onImageTaskCompleted: () => markTaskCompleted('images'),
        onImageTaskFailed: (errorMessage) => markTaskFailed('images', errorMessage),
        onImageTaskCancelled: () => markTaskCancelled('images'),
        t,
    });

    const handleGenerateAudio = useCallback(async () => {
        ensureSessionRunId();
        const controller = new AbortController();
        audioAbortControllerRef.current = controller;
        try {
            await handleGenerateAudioBase();
        } finally {
            audioAbortControllerRef.current = null;
        }
    }, [ensureSessionRunId, handleGenerateAudioBase]);

    const handleGenerateImages = useCallback(async () => {
        ensureSessionRunId();
        const controller = new AbortController();
        imageAbortControllerRef.current = controller;
        try {
            await handleGenerateImagesBase();
        } finally {
            imageAbortControllerRef.current = null;
        }
    }, [ensureSessionRunId, handleGenerateImagesBase]);

    const clearAppendPrefilledDeckId = useCallback(() => {
        appendPrefilledDeckIdRef.current = null;
        appendSeededDeckIdRef.current = null;
    }, []);

    const navigateToGenerate = useCallback(() => {
        navigate({
            to: '/generate',
            search: {},
        });
    }, [navigate]);

    const navigateToDeckEditor = useCallback(
        (deckId: string) => {
        navigate({ to: `/deck-editor/${deckId}` });
        },
        [navigate],
    );

    const navigateToMyDecks = useCallback(() => {
        navigate({ to: '/my-decks' });
    }, [navigate]);

    const { handleSaveQuizEnrichments, isSavingQuizEnrichments } = useFlashcardQuizActions({
        deckId: quizDeckId,
        reviews: existingDeckQuizReviewsForSave,
        navigateToDeckEditor,
        t,
    });

    const { handleDownloadZip, handleDownloadTransfer } = useFlashcardDownloadActions({
        deckName,
        flashcards,
        generatedDecks,
        materialType,
        format,
        baseLocale: BASE_LOCALE,
        t,
    });

    const { handleExitAppendMode, handleAppendToDeck } = useFlashcardAppendActions({
        appendDeckId,
        appendDeckName: appendDeck?.name ?? null,
        appendableGeneratedCards,
        isAppendingToDeck,
        setIsAppendingToDeck,
        clearAppendPrefilledDeckId,
        navigateToGenerate,
        navigateToDeckEditor,
        t,
    });

    const fileSizeLabel = useMemo(() => {
        if (materialFileSize === null) return undefined;
        return `${(materialFileSize / 1024).toFixed(1)} KB`;
    }, [materialFileSize]);

    const previewContent = useMemo(() => {
        const trimmedText = materialText.trim();
        if (!trimmedText) return null;
        const lines = trimmedText.split(/\r?\n/).slice(0, 5);
        const leading = lines.slice(0, 2).join('\n');
        const trailing = lines.slice(2).join('\n').trim();
        return {
            leading,
            trailing: trailing.length > 0 ? trailing : undefined,
        };
    }, [materialText]);

    const previewLabels = useMemo<FlashcardPreviewLabels>(
        () => ({
            pos: t('web.flashcards.posLabel'),
            category: t('web.flashcards.categoryLabel'),
            gender: t('web.flashcards.genderLabel'),
            playAudio: t('web.flashcards.audioPlay'),
            stopAudio: t('web.flashcards.audioStop'),
            audioError: `${t('web.flashcards.failureSummary.audio')} ${t('web.flashcards.failureSummary.error')}`,
            imageError: `${t('web.flashcards.failureSummary.image')} ${t('web.flashcards.failureSummary.error')}`,
            imageAlt: (front: string) =>
                t('web.flashcards.imageAlt', {
                    front,
                }),
            editFront: `${t('common.edit')} ${t('card.frontPlaceholder')}`,
            frontPlaceholder: t('card.frontPlaceholder'),
            deleteCard: t('common.delete'),
            quiz: {
                badge: t('web.flashcards.quizEnrichmentBadge'),
                edit: t('web.flashcards.quizEnrichmentEdit'),
                prompt: t('web.flashcards.quizEnrichmentPrompt'),
                option: (index: number) => t('web.flashcards.quizEnrichmentOption', { index }),
                correctAnswer: t('web.flashcards.quizEnrichmentCorrectAnswer'),
                explanation: t('web.flashcards.quizEnrichmentExplanation'),
                addOption: t('web.flashcards.quizEnrichmentAddOption'),
                removeOption: t('web.flashcards.quizEnrichmentRemoveOption'),
                apply: t('web.flashcards.quizEnrichmentApply'),
                cancel: t('web.flashcards.quizEnrichmentCancel'),
                remove: t('web.flashcards.quizEnrichmentRemove'),
                regenerate: t('web.flashcards.quizEnrichmentRegenerate'),
                invalid: t('web.flashcards.quizEnrichmentInvalid'),
            },
        }),
        [t],
    );

    const defaultDownloadDeck = useMemo(() => {
        if (canUseBulkGeneration && generatedDecks.length > 0) {
            return generatedDecks[0];
        }
        if (flashcards) {
            return { locale: BASE_LOCALE, flashcards };
        }
        return null;
    }, [canUseBulkGeneration, flashcards, generatedDecks]);

    const generatedResultsActionLabels = useMemo(
        () => ({
            appendButton: t('web.flashcards.append.appendButton'),
            appending: t('web.flashcards.append.appending'),
            addToMyDecks: t('web.flashcards.addToMyDecks'),
            addingToMyDecks: t('web.flashcards.addingToMyDecks'),
            downloadZip: t('web.flashcards.downloadZip'),
            downloadZipFor: (language: string) => t('web.flashcards.downloadZipFor', { language }),
            downloadFlashly: t('web.flashcards.append.download.flashly'),
            exportAnkiCsv: t('decks.transfer.formats.ankiCsv'),
            exportQuizletTxt: t('decks.transfer.formats.quizletTxt'),
            generateAudio: t('web.flashcards.deckImport.regenerateAudio'),
            generatingAudio: t('web.flashcards.audioGeneration'),
            generateImages: t('web.flashcards.deckImport.regenerateImages'),
            generatingImages: t('web.flashcards.imageGeneration'),
        }),
        [t],
    );

    const generatedDeckLocaleLabel = useCallback(
        (locale: SupportedLocale) => {
        return resolveLocaleLabel(locale, i18n.language ?? BASE_LOCALE);
        },
        [i18n.language, resolveLocaleLabel],
    );

    const { handleAddToMyDecks, isSavingToMyDecks } = useFlashcardSaveActions({
        deckName,
        materialType,
        format,
        generatedDecks,
        defaultDeck: defaultDownloadDeck,
        getLocaleLabel: generatedDeckLocaleLabel,
        openRouterApiKey: apiKey,
        openRouterModel: model,
        openRouterBaseUrl: OPENROUTER_BASE_URL,
        baseLocale: BASE_LOCALE,
        navigateToMyDecks,
        t,
    });

    const isAppendModeBlocked = isAppendMode && (isAppendDeckLoading || !appendDeck || Boolean(appendDeckError));
    const isExistingDeckQuizMode = generatorQuizMode.kind === 'existing-deck';
    const isGeneratorModeBlocked =
        isAppendModeBlocked ||
        (isExistingDeckQuizMode &&
            (isQuizDeckLoading || !quizDeck || Boolean(quizDeckError) || selectedExistingDeckQuizCards.length === 0));
    const latestStreamedCard = useMemo(() => streamedCards.at(-1) ?? null, [streamedCards]);
    const progressModalSections = useMemo(() => {
        const sections: Array<{
            key: 'flashcards' | 'audio' | 'images';
            title: string;
            progressPercent: number;
            footer: ReactNode;
        }> = [];

        if (generationSessionState.tasks.flashcards.phase === 'running') {
            sections.push({
                key: 'flashcards',
                title: t('web.flashcards.generationProgress'),
                progressPercent: progressPercent,
                footer: (
                    <>
                        <span>
                            {t('web.flashcards.elapsed')}: {formatDuration(elapsedSeconds)}
                        </span>
                        <span>
                            {t('web.flashcards.remaining')}: {formatDuration(remainingSeconds)}
                        </span>
                        <span>
                            {t('web.flashcards.generatedCards')}: {generatedCount}
                        </span>
                    </>
                ),
            });
        }

        if (generationSessionState.tasks.audio.phase === 'running') {
            sections.push({
                key: 'audio',
                title: t('web.flashcards.audioGeneration'),
                progressPercent: audioProgress.total ? (audioProgress.completed / audioProgress.total) * 100 : 0,
                footer: (
                    <span>
                        {t('web.flashcards.processedCards')}: {audioProgress.completed}/{audioProgress.total}
                    </span>
                ),
            });
        }

        if (generationSessionState.tasks.images.phase === 'running') {
            sections.push({
                key: 'images',
                title: t('web.flashcards.imageGeneration'),
                progressPercent: imageProgress.total ? (imageProgress.completed / imageProgress.total) * 100 : 0,
                footer: (
                    <span>
                        {t('web.flashcards.processedCards')}: {imageProgress.completed}/{imageProgress.total}
                    </span>
                ),
            });
        }

        return sections;
    }, [
        audioProgress.completed,
        audioProgress.total,
        elapsedSeconds,
        generatedCount,
        generationSessionState.tasks.audio.phase,
        generationSessionState.tasks.flashcards.phase,
        generationSessionState.tasks.images.phase,
        imageProgress.completed,
        imageProgress.total,
        progressPercent,
        remainingSeconds,
        t,
    ]);

    const handleInterruptConfirmed = useCallback(() => {
        dispatchGenerationSession({ type: 'INTERRUPT_CONFIRMED' });
        flashcardAbortControllerRef.current?.abort();
        audioAbortControllerRef.current?.abort();
        imageAbortControllerRef.current?.abort();

        if (!generationSessionState.preserveGeneratedOnInterrupt) {
            resetGenerationState();
        }
    }, [generationSessionState.preserveGeneratedOnInterrupt, resetGenerationState]);

    return (
        <>
            <div className="space-y-6 text-card-foreground">
                {isAppendMode && (
                    <AppendModeBanner
                        title={t('web.flashcards.append.bannerTitle')}
                        loadingMessage={t('web.flashcards.append.loadingDeck')}
                        errorMessage={appendDeckError?.message ?? null}
                        fallbackErrorMessage={t('web.flashcards.append.deckLoadError')}
                        readyMessage={
                            appendDeck
                            ? t('web.flashcards.append.bannerDescription', {
                                deck: appendDeck.name,
                                count: appendDeck.cards.length,
                            })
                                : null
                        }
                        exitLabel={t('web.flashcards.append.exitMode')}
                        onExit={handleExitAppendMode}
                        isLoading={isAppendDeckLoading}
                    />
                )}

                <FlashcardGeneratorForm
                    apiKey={apiKey}
                    onRequestSettingsOpen={requestSettingsOpen}
                    materialInputKey={materialInputKey}
                    materialFileName={materialFileName}
                    materialFileSizeLabel={fileSizeLabel}
                    materialPreview={deckPreview ?? previewContent ?? undefined}
                    onMaterialFileSelect={readMaterialFile}
                    onClearMaterial={handleClearMaterial}
                    deckName={deckName}
                    onDeckNameChange={handleDeckNameChange}
                    isBulkGenerationEnabled={props.isBulkGenerationEnabled}
                    normalizedTargetLocales={normalizedTargetLocales}
                    onTargetLocalesChange={handleTargetLocalesChange}
                    bulkLocaleOptions={bulkLocaleOptions}
                    baseLocale={BASE_LOCALE}
                    isAppendMode={isAppendMode}
                    isExistingDeckQuizMode={isExistingDeckQuizMode}
                    existingDeckQuizCardCount={selectedExistingDeckQuizCards.length}
                    cardCount={cardCount}
                    maxCardCount={MAX_CARD_COUNT}
                    onCardCountChange={handleCardCountChange}
                    includeQuiz={includeQuiz}
                    onIncludeQuizChange={handleIncludeQuizChange}
                    format={format}
                    onFormatChange={setFormat}
                    materialType={materialType}
                    onMaterialTypeChange={setMaterialType}
                    isGenerating={isGenerating}
                    selectedLanguageId={selectedLanguageId}
                    onSelectedLanguageChange={setSelectedLanguageId}
                    customInstruction={customInstruction}
                    onCustomInstructionChange={handleCustomInstructionChange}
                    onGenerate={handleGenerate}
                    onClearResults={handleClearResults}
                    isGeneratingAudio={isGeneratingAudio}
                    isGeneratingImages={isGeneratingImages}
                    isAppendModeBlocked={isGeneratorModeBlocked}
                    error={error}
                />

                {!flashcards && quizEnrichmentSkippedSummary ? (
                    <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                        {quizEnrichmentSkippedSummary}
                    </div>
                ) : null}

                {flashcards && (
                    <Suspense fallback={null}>
                        <GeneratedResultsPanelLazy
                            flashcards={flashcards}
                            previewLimit={PREVIEW_LIMIT}
                            mediaFailures={mediaFailures}
                            retryingCardIds={retryingCardIds}
                            onRetryAudio={handleRetryAudio}
                            onRetryImage={handleRetryImage}
                            audioState={audioState}
                            onToggleAudio={toggleAudio}
                            onImageClick={handleImageClick}
                            onUpdateCardFront={handleUpdateCardFront}
                            onRemoveCard={handleRemoveCard}
                            previewLabels={previewLabels}
                            getStableCardId={getStableCardId}
                            showHostedDeckActions={props.hostedDeckActions}
                            isAppendMode={isAppendMode}
                            appendDuplicateCount={appendDuplicateCount}
                            appendableGeneratedCardsCount={appendableGeneratedCards.length}
                            appendSummaryLabel={(values) => t('web.flashcards.append.summary', values)}
                            isAppendingToDeck={isAppendingToDeck}
                            isAppendDeckLoading={isAppendDeckLoading}
                            hasAppendDeckError={Boolean(appendDeckError)}
                            onAppendToDeck={handleAppendToDeck}
                            isSavingToMyDecks={isSavingToMyDecks}
                            onAddToMyDecks={handleAddToMyDecks}
                            isBulkGenerationEnabled={props.isBulkGenerationEnabled}
                            generatedDecks={generatedDecks}
                            defaultDownloadDeck={defaultDownloadDeck}
                            onDownloadZip={handleDownloadZip}
                            onDownloadTransfer={handleDownloadTransfer}
                            getLocaleLabel={generatedDeckLocaleLabel}
                            isGeneratingAudio={isGeneratingAudio}
                            isGeneratingImages={isGeneratingImages}
                            onGenerateAudio={handleGenerateAudio}
                            onGenerateImages={handleGenerateImages}
                            actionLabels={generatedResultsActionLabels}
                            generatedTitle={t('web.flashcards.generatedTitle')}
                            previewCountLabel={(shown, total) => t('web.flashcards.previewCount', { shown, total })}
                            showAllCardsLabel={(count) => t('web.flashcards.showAllCards', { count })}
                            allCardsTitle={t('web.flashcards.allCardsTitle')}
                            allCardsDescriptionLabel={(count) => t('web.flashcards.allCardsDescription', { count })}
                            isQuizReviewMode={isExistingDeckQuizMode}
                            onUpdateCardQuiz={handleUpdateCardQuiz}
                            onRemoveCardQuiz={handleRemoveCardQuiz}
                            onRegenerateCardQuiz={handleRegenerateCardQuiz}
                            isRegeneratingCardQuiz={(index) => {
                                const cardId = existingDeckQuizReviewCardIds[index];
                                return Boolean(cardId && regeneratingQuizCardIds.has(cardId));
                            }}
                            quizSaveLabel={
                                isExistingDeckQuizMode
                                    ? (count) => t('web.flashcards.quizEnrichmentSave', { count })
                                    : undefined
                            }
                            quizSavingLabel={
                                isExistingDeckQuizMode ? t('web.flashcards.quizEnrichmentSaving') : undefined
                            }
                            isSavingQuizEnrichments={isSavingQuizEnrichments}
                            onSaveQuizEnrichments={isExistingDeckQuizMode ? handleSaveQuizEnrichments : undefined}
                            quizEnrichmentSkippedSummary={isExistingDeckQuizMode ? quizEnrichmentSkippedSummary : undefined}
                        />
                    </Suspense>
                )}
                {imageSelectionCard && (
                    <Suspense fallback={null}>
                        <ImageSelectionDialogLazy
                            unsplashTransport={props.unsplashTransport}
                            settingsUserId={props.settingsUserId}
                            requestSettingsOpen={requestSettingsOpen}
                            open={Boolean(imageSelectionCard)}
                            onOpenChange={(open) => !open && setImageSelectionCard(null)}
                            card={imageSelectionCard.card}
                            currentImageUrl={imageSelectionCard.currentImageUrl}
                            onImageSelect={handleImageSelect}
                        />
                    </Suspense>
                )}
            </div>

            <GenerationProgressModal
                open={hasRunningTasks}
                title={t('web.flashcards.progressModal.title')}
                description={t('web.flashcards.progressModal.description')}
                closeLabel={t('web.flashcards.progressModal.closeButton')}
                sections={progressModalSections}
                streamingPreviewLabel={t('web.flashcards.streamingPreview')}
                previewCard={generationSessionState.tasks.flashcards.phase === 'running' ? latestStreamedCard : null}
                interruptConfirmOpen={hasRunningTasks && generationSessionState.isInterruptConfirmOpen}
                interruptTitle={t('web.flashcards.progressModal.closeWarningTitle')}
                interruptDescription={t('web.flashcards.progressModal.closeWarningDescription')}
                preserveLabel={t('web.flashcards.progressModal.preserveGenerated')}
                preserveGeneratedOnInterrupt={generationSessionState.preserveGeneratedOnInterrupt}
                continueLabel={t('web.flashcards.progressModal.continue')}
                interruptLabel={t('web.flashcards.progressModal.interrupt')}
                onCloseAttempt={handleProgressModalCloseAttempt}
                onInterruptConfirmOpenChange={handleInterruptConfirmOpenChange}
                onPreserveChange={handlePreserveGeneratedOnInterruptChange}
                onInterruptConfirm={handleInterruptConfirmed}
            />

            {/* Deck Import Dialog */}
            <Suspense fallback={null}>
                <DeckImportDialogLazy
                    open={importDialogOpen}
                    onClose={() => setImportDialogOpen(false)}
                    onConfirm={handleDeckImport}
                    parsedZip={uploadedDeck}
                    existingCards={flashcards?.flashcards ?? []}
                />
            </Suspense>
        </>
    );
}
