export { dayjs, setDayjsLocale, resolveDayjsLocale } from './dayjs';

// Export error handling utilities
export {
    AppError,
    NetworkError,
    ApiError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ValidationError,
    DatabaseError,
    StorageError,
    AuthenticationError,
    ExternalServiceError,
    ConfigurationError,
    SyncError,
    ConflictError,
    ERROR_CODES,
    errorFactory,
    safeAsync,
    safeSync,
    safeFetch,
    safeJson,
    safeValidate,
    combineResults,
    combineResultAsyncs,
    partitionResults,
    isAppError,
    isError,
    isSuccess,
    withTimeout,
    retry,
    parallel,
    sequence,
} from './errors';
export type { ErrorCode } from './errors';
export { i18nResources, supportedLocales, translations, getLocaleName, LOCALE_NAMES } from './i18n/index';
export type { SupportedLocale } from './i18n/index';
export {
    DEFAULT_OPENROUTER_MODEL,
    GENERATION_ESTIMATE,
    MATERIAL_TYPE_COMPLEXITY,
} from './constants';
export {
    FLASHCARD_MATERIAL_TYPE_INSTRUCTIONS,
    FLASHCARD_PROMPT_TEMPLATE,
} from './prompts';
export {
    FLASHCARD_MATERIAL_TYPE_ACCENT_KEYS,
    FLASHCARD_MATERIAL_TYPE_GROUPS,
    FLASHCARD_MATERIAL_TYPE_ICON_KEYS,
    FLASHCARD_MATERIAL_TYPE_META,
    FLASHCARD_MATERIAL_TYPE_TRANSLATION_KEYS,
} from './material-types';
export type {
    FlashcardMaterialAccentKey,
    FlashcardMaterialTypeIconKey,
    FlashcardMaterialTypeMeta,
} from './material-types';
export {
    FLASHCARD_FORMATS,
    FLASHCARD_MATERIAL_TYPES,
    FlashcardSchema,
    DeckMetadataSchema,
    FlashcardsResponseSchema,
    FlashcardInputError,
    FlashcardResponseError,
    buildFlashcardPrompt,
    buildDeckTranslationPrompt,
    validateBaseDeckLocale,
    parseFlashcardsResponse,
    parseFlashcardsJsonl,
} from './flashcards';
export type {
    FlashcardFormat,
    FlashcardMaterialType,
    FlashcardsResponse,
    LanguageExample,
    OpenRouterUsage,
    FlashcardGenerationResult,
    MediaFailureType,
    MediaFailure,
    GenerationFailures,
    FlashcardPromptOptions,
    FlashcardPromptConfig,
    DeckTranslationPromptOptions,
} from './flashcards';
export {
    QuizEnrichmentSchema,
    OptionalQuizEnrichmentSchema,
    NullableQuizEnrichmentSchema,
    QuizEnrichmentProposalSchema,
    normalizeQuizEnrichment,
    buildQuizEnrichmentPrompt,
} from './quiz-enrichment';
export type {
    QuizEnrichment,
    QuizEnrichmentSourceCard,
    QuizEnrichmentProposal,
} from './quiz-enrichment';
export { generateFlashcardsWithOpenRouter } from './openrouter';
export type { OpenRouterRequestOptions } from './openrouter';
export {
    ELEVENLABS_BASE_URL,
    ELEVENLABS_DEFAULT_MODEL_ID,
    ELEVENLABS_DEFAULT_OUTPUT_FORMAT,
    ELEVENLABS_DEFAULT_VOICE_NAME,
    ELEVENLABS_V3_LANGUAGES,
    arrayBufferToBase64,
    attachAudioToFlashcards,
    buildAudioDataUrl,
    fetchElevenLabsVoices,
    generateElevenLabsSpeechDataUrl,
    requestElevenLabsSpeech,
    requestElevenLabsSpeechViaProxy,
    resolveElevenLabsVoiceId,
    stripMarkdown,
    stripMarkdownBold,
} from './tts';
export type {
    ElevenLabsAudioUrlOptions,
    ElevenLabsLanguage,
    ElevenLabsProxyOptions,
    ElevenLabsSpeechOptions,
    ElevenLabsVoice,
    ElevenLabsVoiceOptions,
    FlashcardAudioAttachOptions,
    FlashcardWithMedia,
} from './tts';
export { resolveGenerationTiming } from './generation-estimate';
export {
    estimateGenerationSecondsMultiFactor,
    calculateWeightedBatchAverage,
    resolveEnhancedGenerationTiming,
} from './generation-estimate';
export type { BatchEstimate } from './generation-estimate';
export type {
    MultiFactorEstimateInput,
    EnhancedBatchEstimate,
} from './generation-estimate';
export {
    EXPORT_CONFIG_FILE_NAME,
    EXPORT_FORMAT_VERSION,
    ExportConfigSchema,
    parseExportConfig,
} from './export';
export type { ExportConfig } from './export';
export {
    DECK_TRANSFER_FORMAT_IDS,
    getDeckTransferFormatAdapter,
    listDeckTransferFormats,
} from './deck-transfer';
export {
    MarketplaceLicenseSchema,
    MarketplaceMetadataSchema,
    ROMANIZATION_PREFERENCES,
} from './marketplace-metadata';
export type {
    MarketplaceLicense,
    MarketplaceMetadata,
    RomanizationPreference,
} from './marketplace-metadata';
export type {
    DeckTransferCard,
    DeckTransferDeck,
    DeckTransferExportOptions,
    DeckTransferFormatAdapter,
    DeckTransferFormatDescriptor,
    DeckTransferFormatId,
    DeckTransferImportOptions,
    DeckTransferPayload,
} from './deck-transfer';
export {
    batch,
    parallel as parallelLimit,
    rateLimit,
    debounce,
    throttle,
    ResultCache,
    poll,
    CircuitBreaker,
    retryWithBackoff,
} from './async-utils';
export { createId } from './utils/ids';
export {
    expectOk,
    expectErr,
    expectErrorCode,
    expectStatusCode,
    okSuccess,
    errError,
    createMockError,
    createMockService,
    registerResultMatchers,
    registerResultMatchersVitest,
    waitForResult,
    unwrapResult,
    createResultSpy,
} from './test-utils';
export type {
    SuccessType,
    ErrorType,
    AsyncSuccessType,
    AsyncErrorType,
    SuccessUnion,
    ErrorUnion,
    ServiceMethod,
    ServiceMethods,
    ToResultAsync,
    ToResultAsyncObject,
    ErrorCodes,
    ErrorsFromCodes,
    MapSuccess,
    MapError,
    MapResult,
    ConditionalResult,
    RequireSuccess,
    PartialSuccess,
    ApiResult,
    PaginatedResult,
    InferSuccess,
    InferError,
    AssertOk,
    AssertErr,
} from './types';
