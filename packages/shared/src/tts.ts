import type { ResultAsync} from 'neverthrow';
import { okAsync, errAsync } from 'neverthrow';
import { z } from 'zod';
import {
    NetworkError,
    ApiError,
    ConfigurationError,
    ExternalServiceError,
    ValidationError,
    safeAsync,
} from './errors';

/**
 * Strips markdown bold formatting from text for audio generation.
 * Removes both **bold** and __bold__ syntax.
 * Example: "с**вър**зан" → "свързан"
 * Example: "re**cor**der" → "recorder"
 */
export function stripMarkdownBold(text: string): string {
    if (!text) return text;
    return text
        .replace(/\*\*(.+?)\*\*/g, '$1')  // Remove **bold**
        .replace(/__(.+?)__/g, '$1');     // Remove __bold__
}

/**
 * Strips ALL markdown formatting from text for audio generation.
 * Uses markdown parsing to render to plain text.
 * Example: "с**вър**зан" → "свързан"
 * Example: "re**cor**der with _italics_" → "recorder with italics"
 */
export function stripMarkdown(text: string): string {
    if (!text) return text;

    // Strip markdown formatting using regex
    return text
        // Remove bold (**text** or __text__)
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/__(.+?)__/g, '$1')
        // Remove italic (*text* or _text_)
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/_(.+?)_/g, '$1')
        // Remove strikethrough (~~text~~)
        .replace(/~~(.+?)~~/g, '$1')
        // Remove code (`text` or ```text```)
        .replace(/`(.+?)`/g, '$1')
        .replace(/```(.+?)```/gs, '$1')
        // Remove links [text](url) -> text
        .replace(/\[(.+?)\]\(.+?\)/g, '$1')
        // Remove images ![alt](url) -> alt
        .replace(/!\[(.+?)\]\(.+?\)/g, '$1')
        // Clean up extra whitespace
        .replace(/\s+/g, ' ')
        .trim();
}

export type ElevenLabsVoice = {
    voice_id: string;
    name: string;
    labels?: Record<string, string>;
};

export const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';
export const ELEVENLABS_DEFAULT_MODEL_ID = 'eleven_v3';
export const ELEVENLABS_DEFAULT_OUTPUT_FORMAT = 'mp3_44100_128';
export const ELEVENLABS_DEFAULT_VOICE_NAME = 'Alice - Clear, Engaging Educator';

export type ElevenLabsLanguage = {
    name: string;
    code: string;
};

export const ELEVENLABS_V3_LANGUAGES: ElevenLabsLanguage[] = [
    { name: 'Afrikaans', code: 'afr' },
    { name: 'Arabic', code: 'ara' },
    { name: 'Armenian', code: 'hye' },
    { name: 'Assamese', code: 'asm' },
    { name: 'Azerbaijani', code: 'aze' },
    { name: 'Belarusian', code: 'bel' },
    { name: 'Bengali', code: 'ben' },
    { name: 'Bosnian', code: 'bos' },
    { name: 'Bulgarian', code: 'bul' },
    { name: 'Catalan', code: 'cat' },
    { name: 'Cebuano', code: 'ceb' },
    { name: 'Chichewa', code: 'nya' },
    { name: 'Croatian', code: 'hrv' },
    { name: 'Czech', code: 'ces' },
    { name: 'Danish', code: 'dan' },
    { name: 'Dutch', code: 'nld' },
    { name: 'English', code: 'eng' },
    { name: 'Estonian', code: 'est' },
    { name: 'Filipino', code: 'fil' },
    { name: 'Finnish', code: 'fin' },
    { name: 'French', code: 'fra' },
    { name: 'Galician', code: 'glg' },
    { name: 'Georgian', code: 'kat' },
    { name: 'German', code: 'deu' },
    { name: 'Greek', code: 'ell' },
    { name: 'Gujarati', code: 'guj' },
    { name: 'Hausa', code: 'hau' },
    { name: 'Hebrew', code: 'heb' },
    { name: 'Hindi', code: 'hin' },
    { name: 'Hungarian', code: 'hun' },
    { name: 'Icelandic', code: 'isl' },
    { name: 'Indonesian', code: 'ind' },
    { name: 'Irish', code: 'gle' },
    { name: 'Italian', code: 'ita' },
    { name: 'Japanese', code: 'jpn' },
    { name: 'Javanese', code: 'jav' },
    { name: 'Kannada', code: 'kan' },
    { name: 'Kazakh', code: 'kaz' },
    { name: 'Kirghiz', code: 'kir' },
    { name: 'Korean', code: 'kor' },
    { name: 'Latvian', code: 'lav' },
    { name: 'Lingala', code: 'lin' },
    { name: 'Lithuanian', code: 'lit' },
    { name: 'Luxembourgish', code: 'ltz' },
    { name: 'Macedonian', code: 'mkd' },
    { name: 'Malay', code: 'msa' },
    { name: 'Malayalam', code: 'mal' },
    { name: 'Mandarin Chinese', code: 'cmn' },
    { name: 'Marathi', code: 'mar' },
    { name: 'Nepali', code: 'nep' },
    { name: 'Norwegian', code: 'nor' },
    { name: 'Pashto', code: 'pus' },
    { name: 'Persian', code: 'fas' },
    { name: 'Polish', code: 'pol' },
    { name: 'Portuguese', code: 'por' },
    { name: 'Punjabi', code: 'pan' },
    { name: 'Romanian', code: 'ron' },
    { name: 'Russian', code: 'rus' },
    { name: 'Serbian', code: 'srp' },
    { name: 'Sindhi', code: 'snd' },
    { name: 'Slovak', code: 'slk' },
    { name: 'Slovenian', code: 'slv' },
    { name: 'Somali', code: 'som' },
    { name: 'Spanish', code: 'spa' },
    { name: 'Swahili', code: 'swa' },
    { name: 'Swedish', code: 'swe' },
    { name: 'Tamil', code: 'tam' },
    { name: 'Telugu', code: 'tel' },
    { name: 'Thai', code: 'tha' },
    { name: 'Turkish', code: 'tur' },
    { name: 'Ukrainian', code: 'ukr' },
    { name: 'Urdu', code: 'urd' },
    { name: 'Vietnamese', code: 'vie' },
    { name: 'Welsh', code: 'cym' },
];

type FetchLike = typeof fetch;

function createAbortError(): Error {
    const error = new Error('Operation aborted');
    error.name = 'AbortError';
    return error;
}

function throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) {
        throw createAbortError();
    }
}

function linkAbortSignal(controller: AbortController, signal?: AbortSignal): () => void {
    if (!signal) {
        return () => {};
    }

    if (signal.aborted) {
        controller.abort();
        return () => {};
    }

    const onAbort = () => controller.abort();
    signal.addEventListener('abort', onAbort);
    return () => signal.removeEventListener('abort', onAbort);
}

export type ElevenLabsVoiceOptions = {
    apiKey: string;
    baseUrl?: string;
    timeoutMs?: number;
    fetchImpl?: FetchLike;
    abortSignal?: AbortSignal;
};

export type ElevenLabsSpeechOptions = {
    apiKey: string;
    text: string;
    voiceId?: string;
    voiceName?: string;
    modelId?: string;
    outputFormat?: string;
    languageId?: string;
    baseUrl?: string;
    timeoutMs?: number;
    fetchImpl?: FetchLike;
    abortSignal?: AbortSignal;
};

type ElevenLabsVoicesResponse = {
    voices?: ElevenLabsVoice[];
    detail?: { message: string };
};

// Zod schema for validating ElevenLabs voices response
const ElevenLabsVoicesSchema = z.object({
    voices: z.array(z.object({
        voice_id: z.string(),
        name: z.string(),
        labels: z.record(z.string(), z.string()).optional(),
    })).optional(),
    detail: z.object({
        message: z.string(),
    }).optional(),
});

/**
 * Fetch ElevenLabs voices with neverthrow Result types
 */
export function fetchElevenLabsVoices(
    options: ElevenLabsVoiceOptions
): ResultAsync<ElevenLabsVoice[], ConfigurationError | NetworkError | ApiError | ExternalServiceError> {
    const fetchFn = options.fetchImpl ?? globalThis.fetch;
    if (!fetchFn) {
        return errAsync(
            new ConfigurationError('Fetch is not available in this environment.')
        );
    }

    const controller = new AbortController();
    const unlinkAbortSignal = linkAbortSignal(controller, options.abortSignal);
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15000);
    const baseUrl = normalizeBaseUrl(options.baseUrl ?? ELEVENLABS_BASE_URL);

    return safeAsync<Response, NetworkError | ConfigurationError>(
        fetchFn(`${baseUrl}/voices`, {
            headers: { 'xi-api-key': options.apiKey },
            method: 'GET',
            signal: controller.signal,
        }),
        (error) => {
            clearTimeout(timeout);
            unlinkAbortSignal();
            if (error instanceof Error && error.name === 'AbortError') {
                return new NetworkError('ElevenLabs voices request timed out', { cause: error });
            }
            return new NetworkError(
                `Failed to connect to ElevenLabs: ${error instanceof Error ? error.message : 'Unknown error'}`,
                { cause: error }
            );
        }
    ).andThen((response) => {
        clearTimeout(timeout);
        unlinkAbortSignal();

        if (!response.ok) {
            return safeAsync(
                response.json(),
                (error) => new ValidationError('Failed to parse ElevenLabs error response', { cause: error })
            ).andThen((unknown): ResultAsync<ElevenLabsVoicesResponse, ValidationError> => {
                const result = ElevenLabsVoicesSchema.safeParse(unknown);
                if (!result.success) {
                    const errorMessages = result.error.issues.map((issue) => {
                        const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
                        return `${path}: ${issue.message}`;
                    }).join(', ');
                    return errAsync(
                        new ValidationError('Invalid ElevenLabs error response structure', {
                            cause: new Error(errorMessages)
                        })
                    );
                }
                // Transform the result to match expected types
                // Note: Zod's z.record() produces a slightly different type than our Record<string, string>
                // The assertion is safe here because the data has already been validated by ElevenLabsVoicesSchema
                const transformed: ElevenLabsVoicesResponse = {
                    voices: result.data.voices?.map(v => ({
                        ...v,
                        labels: v.labels as Record<string, string> | undefined,
                    })),
                    detail: result.data.detail,
                };
                return okAsync(transformed);
            }).andThen((payload) => {
                const message = payload.detail?.message ?? `ElevenLabs request failed with status ${response.status}.`;

                return errAsync(
                    new ApiError(message, response.status, {
                        context: { service: 'elevenlabs', endpoint: '/voices' },
                    })
                );
            });
        }

        return safeAsync(
            response.json(),
            (error) => new ValidationError('Failed to parse ElevenLabs voices response', { cause: error })
        ).andThen((unknown): ResultAsync<ElevenLabsVoicesResponse, ValidationError> => {
            const result = ElevenLabsVoicesSchema.safeParse(unknown);
            if (!result.success) {
                const errorMessages = result.error.issues.map((issue) => {
                    const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
                    return `${path}: ${issue.message}`;
                }).join(', ');
                return errAsync(
                    new ValidationError('Invalid ElevenLabs voices response structure', {
                        cause: new Error(errorMessages)
                    })
                );
            }
            // Transform the result to match expected types
            // Note: Zod's z.record() produces a slightly different type than our Record<string, string>
            // The assertion is safe here because the data has already been validated by ElevenLabsVoicesSchema
            const transformed: ElevenLabsVoicesResponse = {
                voices: result.data.voices?.map(v => ({
                    ...v,
                    labels: v.labels as Record<string, string> | undefined,
                })),
                detail: result.data.detail,
            };
            return okAsync(transformed);
        }).map((payload) => payload.voices ?? []);
    });
}

/**
 * Resolve ElevenLabs voice ID from voice name with neverthrow Result types
 */
export function resolveElevenLabsVoiceId(
    options: ElevenLabsVoiceOptions & { voiceId?: string; voiceName?: string }
): ResultAsync<string, ConfigurationError | NetworkError | ApiError | ExternalServiceError> {
    if (options.voiceId?.trim()) {
        return okAsync(options.voiceId.trim());
    }

    const voiceName = options.voiceName?.trim() || ELEVENLABS_DEFAULT_VOICE_NAME;

    return fetchElevenLabsVoices(options).andThen((voices) => {
        const normalized = voiceName.toLowerCase();
        const exact = voices.find((voice) => voice.name.toLowerCase() === normalized);

        if (exact) {
            return okAsync(exact.voice_id);
        }

        const startsWith = voices.find((voice) => voice.name.toLowerCase().startsWith(normalized));
        if (startsWith) {
            return okAsync(startsWith.voice_id);
        }

        return errAsync(
            new ExternalServiceError(
                `ElevenLabs voice "${voiceName}" was not found for this API key.`,
                'elevenlabs',
                { context: { voiceName, availableVoices: voices.map((v) => v.name) } }
            )
        );
    });
}

type SpeechResult = {
    audio: ArrayBuffer;
    contentType: string;
};

type ElevenLabsErrorResponse = {
    detail?: unknown;
};

// Zod schema for validating ElevenLabs error response
const ElevenLabsErrorSchema = z.object({
    detail: z.union([z.string(), z.object({
        message: z.string(),
    })]).optional(),
});

type ElevenLabsProxyResponsePayload = {
    base64?: string;
    contentType?: string;
    error?: string;
    message?: string;
};

/**
 * Request speech from ElevenLabs with neverthrow Result types
 */
export function requestElevenLabsSpeech(
    options: ElevenLabsSpeechOptions
): ResultAsync<SpeechResult, ConfigurationError | NetworkError | ApiError | ExternalServiceError | ValidationError> {
    const fetchFn = options.fetchImpl ?? globalThis.fetch;
    if (!fetchFn) {
        return errAsync(
            new ConfigurationError('Fetch is not available in this environment.')
        );
    }

    return resolveElevenLabsVoiceId({
        apiKey: options.apiKey,
        baseUrl: options.baseUrl,
        timeoutMs: options.timeoutMs,
        fetchImpl: options.fetchImpl,
        abortSignal: options.abortSignal,
        voiceId: options.voiceId,
        voiceName: options.voiceName,
    }).andThen((voiceId) => {
        const controller = new AbortController();
        const unlinkAbortSignal = linkAbortSignal(controller, options.abortSignal);
        const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 20000);
        const baseUrl = normalizeBaseUrl(options.baseUrl ?? ELEVENLABS_BASE_URL);
        const modelId = options.modelId?.trim() || ELEVENLABS_DEFAULT_MODEL_ID;
        const outputFormat = options.outputFormat?.trim() || ELEVENLABS_DEFAULT_OUTPUT_FORMAT;

        return safeAsync(
            fetchFn(`${baseUrl}/text-to-speech/${voiceId}`, {
                method: 'POST',
                headers: {
                    'xi-api-key': options.apiKey,
                    'Content-Type': 'application/json',
                    Accept: 'audio/mpeg',
                },
                body: JSON.stringify({
                    text: options.text,
                    model_id: modelId,
                    output_format: outputFormat,
                    ...(options.languageId ? { language_id: options.languageId } : {}),
                }),
                signal: controller.signal,
            }),
            (error) => {
                clearTimeout(timeout);
                unlinkAbortSignal();
                if (error instanceof Error && error.name === 'AbortError') {
                    return new NetworkError('ElevenLabs speech request timed out', { cause: error });
                }
                return new NetworkError(
                    `Failed to connect to ElevenLabs: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    { cause: error }
                );
            }
        ).andThen((response) => {
            clearTimeout(timeout);
            unlinkAbortSignal();

            if (!response.ok) {
                return safeAsync(
                    response.json(),
                    (error) => new ValidationError('Failed to parse ElevenLabs error response', { cause: error })
                ).andThen((unknown): ResultAsync<ElevenLabsErrorResponse, ValidationError> => {
                    const result = ElevenLabsErrorSchema.safeParse(unknown);
                    if (!result.success) {
                        const errorMessages = result.error.issues.map((issue) => {
                            const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
                            return `${path}: ${issue.message}`;
                        }).join(', ');
                        return errAsync(
                            new ValidationError('Invalid ElevenLabs error response structure', {
                                cause: new Error(errorMessages)
                            })
                        );
                    }
                    return okAsync(result.data);
                }).andThen((payload) => {
                    const detail = payload.detail;
                    const message = getStringProperty(detail, 'message')
                        ?? (typeof detail === 'string' ? detail : null)
                        ?? `ElevenLabs request failed with status ${response.status}.`;

                    return errAsync(
                        new ApiError(message, response.status, {
                            context: {
                                service: 'elevenlabs',
                                endpoint: `/text-to-speech/${voiceId}`,
                                voiceId,
                                modelId,
                                outputFormat,
                            },
                        })
                    );
                });
            }

            return safeAsync(response.arrayBuffer(), (error: unknown) => {
                return new ValidationError('Failed to read audio data from response', { cause: error });
            }).andThen((audio: ArrayBuffer) => {
                const contentType = response.headers.get('content-type') ?? 'audio/mpeg';

                if (!isAudioContentType(contentType)) {
                    const decoded = decodeArrayBufferToText(audio);
                    const detail = extractErrorDetail(decoded);
                    const suffix = detail ? ` Response: ${detail}` : '';
                    return errAsync(
                        new ExternalServiceError(
                            `ElevenLabs returned ${contentType || 'unknown'} instead of audio.${suffix}`,
                            'elevenlabs',
                            { context: { contentType, detail } }
                        )
                    );
                }

                if (audio.byteLength === 0) {
                    return errAsync(
                        new ExternalServiceError('ElevenLabs returned empty audio.', 'elevenlabs')
                    );
                }

                return okAsync({ audio, contentType });
            });
        });
    });
}

function normalizeBaseUrl(value: string): string {
    return value.replace(/\/+$/, '');
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function getStringProperty(value: unknown, key: string): string | null {
    if (!isObjectRecord(value)) {
        return null;
    }

    const property = value[key];
    return typeof property === 'string' ? property : null;
}

function parseProxyResponsePayload(value: unknown): ElevenLabsProxyResponsePayload | null {
    if (!isObjectRecord(value)) {
        return null;
    }

    return {
        base64: getStringProperty(value, 'base64') ?? undefined,
        contentType: getStringProperty(value, 'contentType') ?? undefined,
        error: getStringProperty(value, 'error') ?? undefined,
        message: getStringProperty(value, 'message') ?? undefined,
    };
}

function isAudioContentType(value: string): boolean {
    const normalized = value.split(';')[0]?.trim().toLowerCase() ?? '';
    return normalized.startsWith('audio/');
}

function decodeArrayBufferToText(buffer: ArrayBuffer, limit = 400): string {
    if (!buffer.byteLength) return '';
    if (typeof TextDecoder !== 'function') return '';
    try {
        const decoded = new TextDecoder().decode(buffer);
        if (decoded.length <= limit) return decoded;
        return `${decoded.slice(0, limit)}…`;
    } catch {
        return '';
    }
}

function extractErrorDetail(text: string): string {
    const trimmed = text.trim();
    if (!trimmed) return '';
    try {
        const parsed = JSON.parse(trimmed);
        return (
            getStringProperty(parsed, 'detail')
            ?? getStringProperty(parsed, 'message')
            ?? getStringProperty(parsed, 'error')
            ?? trimmed
        );
    } catch {
        return trimmed;
    }
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bufferCandidate = Reflect.get(globalThis, 'Buffer');
    if (bufferCandidate && (typeof bufferCandidate === 'object' || typeof bufferCandidate === 'function')) {
        const fromMethod = Reflect.get(bufferCandidate, 'from');
        if (typeof fromMethod === 'function') {
            const encodedValue = fromMethod.call(bufferCandidate, new Uint8Array(buffer));
            if (encodedValue && (typeof encodedValue === 'object' || typeof encodedValue === 'function')) {
                const toStringMethod = Reflect.get(encodedValue, 'toString');
                if (typeof toStringMethod === 'function') {
                    const base64 = toStringMethod.call(encodedValue, 'base64');
                    if (typeof base64 === 'string') {
                        return base64;
                    }
                }
            }
        }
    }
    if (typeof btoa !== 'function') {
        throw new Error('Base64 encoder is not available in this environment.');
    }
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let index = 0; index < bytes.length; index += 1) {
        binary += String.fromCharCode(bytes[index]);
    }
    return btoa(binary);
}

export function buildAudioDataUrl(base64: string, contentType: string): string {
    return `data:${contentType};base64,${base64}`;
}

export type ElevenLabsProxyOptions = {
    proxyUrl: string;
    text: string;
    voiceId?: string;
    voiceName?: string;
    modelId?: string;
    outputFormat?: string;
    languageId?: string;
    timeoutMs?: number;
    fetchImpl?: FetchLike;
    abortSignal?: AbortSignal;
};

export async function requestElevenLabsSpeechViaProxy(options: ElevenLabsProxyOptions): Promise<{
    base64: string;
    contentType: string;
}> {
    const fetchFn = options.fetchImpl ?? globalThis.fetch;
    if (!fetchFn) {
        throw new Error('Fetch is not available in this environment.');
    }
    const controller = new AbortController();
    const unlinkAbortSignal = linkAbortSignal(controller, options.abortSignal);
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 20000);
    const proxyUrl = normalizeBaseUrl(options.proxyUrl);

    console.info('[audio] requesting ElevenLabs speech via proxy', {
        proxyUrl,
        voiceId: options.voiceId,
        voiceName: options.voiceName,
        modelId: options.modelId,
        outputFormat: options.outputFormat,
        languageId: options.languageId,
        textLength: options.text.length,
    });

    try {
        const response = await fetchFn(`${proxyUrl}/api/tts/elevenlabs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: options.text,
                voiceId: options.voiceId,
                voiceName: options.voiceName,
                modelId: options.modelId,
                outputFormat: options.outputFormat,
                ...(options.languageId ? { languageId: options.languageId } : {}),
            }),
            signal: controller.signal,
        });
        const payload = parseProxyResponsePayload(await response.json().catch(() => null));
        if (!response.ok || !payload?.base64) {
            const message = payload?.message ?? payload?.error ?? `TTS proxy failed with status ${response.status}.`;
            console.warn('[audio] ElevenLabs proxy request failed', {
                status: response.status,
                message,
            });
            throw new Error(message);
        }
        return {
            base64: payload.base64,
            contentType: payload.contentType ?? 'audio/mpeg',
        };
    } finally {
        clearTimeout(timeout);
        unlinkAbortSignal();
    }
}

export type ElevenLabsAudioUrlOptions = {
    text: string;
    apiKey?: string;
    proxyUrl?: string;
    voiceId?: string;
    voiceName?: string;
    modelId?: string;
    outputFormat?: string;
    languageId?: string;
    baseUrl?: string;
    timeoutMs?: number;
    fetchImpl?: FetchLike;
    abortSignal?: AbortSignal;
};

export async function generateElevenLabsSpeechDataUrl(options: ElevenLabsAudioUrlOptions): Promise<string> {
    throwIfAborted(options.abortSignal);

    if (options.apiKey?.trim()) {
        console.info('[audio] generating speech data URL with API key', {
            textLength: options.text.length,
        });
        const speechResult = await requestElevenLabsSpeech({
            apiKey: options.apiKey.trim(),
            text: options.text,
            voiceId: options.voiceId,
            voiceName: options.voiceName,
            modelId: options.modelId,
            outputFormat: options.outputFormat,
            languageId: options.languageId,
            baseUrl: options.baseUrl,
            timeoutMs: options.timeoutMs,
            fetchImpl: options.fetchImpl,
            abortSignal: options.abortSignal,
        });

        if (speechResult.isErr()) {
            throw speechResult.error;
        }

        const base64 = arrayBufferToBase64(speechResult.value.audio);
        return buildAudioDataUrl(base64, speechResult.value.contentType);
    }

    if (options.proxyUrl?.trim()) {
        console.info('[audio] generating speech data URL with proxy', {
            textLength: options.text.length,
        });
        const proxyResult = await requestElevenLabsSpeechViaProxy({
            proxyUrl: options.proxyUrl,
            text: options.text,
            voiceId: options.voiceId,
            voiceName: options.voiceName,
            modelId: options.modelId,
            outputFormat: options.outputFormat,
            languageId: options.languageId,
            timeoutMs: options.timeoutMs,
            fetchImpl: options.fetchImpl,
            abortSignal: options.abortSignal,
        });
        return buildAudioDataUrl(proxyResult.base64, proxyResult.contentType);
    }

    throw new Error('ElevenLabs API key is missing and no proxy URL is configured.');
}

export type FlashcardWithMedia = {
    front: string;
    back: string;
    id?: number;
    imageUrl?: string;
    imagePath?: string;
    audioUrl?: string;
    audioPath?: string;
    category?: string;
    pos?: string;
    gender?: string;
    example?: string | { target: string; english: string; romanization: string };
    tags?: string[];
};

export type FlashcardAudioAttachOptions = {
    apiKey?: string;
    proxyUrl?: string;
    voiceId?: string;
    voiceName?: string;
    modelId?: string;
    outputFormat?: string;
    languageId?: string;
    baseUrl?: string;
    timeoutMs?: number;
    fetchImpl?: FetchLike;
    abortSignal?: AbortSignal;
    concurrency?: number;
    generateAudioUrl?: (text: string) => Promise<string>;
    onProgress?: (state: { completed: number; total: number; index: number }) => void;
    onError?: (state: { error: Error; index: number; card?: FlashcardWithMedia }) => void;
    shouldSkip?: (card: FlashcardWithMedia) => boolean;
};

export async function attachAudioToFlashcards(
    cards: FlashcardWithMedia[],
    options: FlashcardAudioAttachOptions,
): Promise<FlashcardWithMedia[]> {
    throwIfAborted(options.abortSignal);

    const total = cards.length;
    if (total === 0) return [];

    const results = cards.map((card) => ({ ...card }));
    const concurrency = Math.max(1, options.concurrency ?? 2);
    let nextIndex = 0;
    let completed = 0;

    const trimmedApiKey = options.apiKey?.trim() ?? '';
    console.info('[audio] attaching audio to flashcards', {
        total,
        concurrency,
        hasApiKey: Boolean(trimmedApiKey),
        hasProxyUrl: Boolean(options.proxyUrl?.trim()),
        hasCustomGenerator: typeof options.generateAudioUrl === 'function',
        voiceName: options.voiceName ?? ELEVENLABS_DEFAULT_VOICE_NAME,
        modelId: options.modelId ?? ELEVENLABS_DEFAULT_MODEL_ID,
        outputFormat: options.outputFormat ?? ELEVENLABS_DEFAULT_OUTPUT_FORMAT,
        languageId: options.languageId,
    });

    const shouldResolveVoiceId =
        trimmedApiKey && !options.voiceId?.trim() && typeof options.generateAudioUrl !== 'function';
    let resolvedVoiceId = options.voiceId;
    let shouldSkipAll = false;
    if (shouldResolveVoiceId) {
        throwIfAborted(options.abortSignal);
        const voiceResult = await resolveElevenLabsVoiceId({
            apiKey: trimmedApiKey,
            voiceName: options.voiceName ?? ELEVENLABS_DEFAULT_VOICE_NAME,
            baseUrl: options.baseUrl,
            fetchImpl: options.fetchImpl,
            timeoutMs: options.timeoutMs,
            abortSignal: options.abortSignal,
        });

        if (voiceResult.isErr()) {
            options.onError?.({ error: voiceResult.error, index: -1 });
            shouldSkipAll = true;
        } else {
            resolvedVoiceId = voiceResult.value;
        }
    }

    console.info('[audio] resolved ElevenLabs voice ID', {
        resolvedVoiceId: resolvedVoiceId ?? null,
    });

    const worker = async () => {
        while (true) {
            throwIfAborted(options.abortSignal);
            const index = nextIndex;
            nextIndex += 1;
            if (index >= total) return;

            const card = results[index];
            if (options.shouldSkip?.(card) || card.audioUrl?.trim()) {
                completed += 1;
                options.onProgress?.({ completed, total, index });
                continue;
            }

            const text = stripMarkdown(card.front?.trim() ?? '');
            if (!text) {
                completed += 1;
                options.onProgress?.({ completed, total, index });
                continue;
            }

            if (shouldSkipAll) {
                completed += 1;
                options.onProgress?.({ completed, total, index });
                continue;
            }

            try {
                throwIfAborted(options.abortSignal);
                const audioUrl =
                    typeof options.generateAudioUrl === 'function'
                        ? await options.generateAudioUrl(text)
                        : await generateElevenLabsSpeechDataUrl({
                              text,
                              apiKey: options.apiKey,
                              proxyUrl: options.proxyUrl,
                              voiceId: resolvedVoiceId,
                              voiceName: options.voiceName ?? ELEVENLABS_DEFAULT_VOICE_NAME,
                              modelId: options.modelId ?? ELEVENLABS_DEFAULT_MODEL_ID,
                              outputFormat: options.outputFormat ?? ELEVENLABS_DEFAULT_OUTPUT_FORMAT,
                              languageId: options.languageId,
                              baseUrl: options.baseUrl,
                              timeoutMs: options.timeoutMs,
                              fetchImpl: options.fetchImpl,
                              abortSignal: options.abortSignal,
                          });

                if (audioUrl?.trim()) {
                    results[index] = { ...card, audioUrl };
                }
            } catch (error) {
                const resolvedError = error instanceof Error ? error : new Error('Unable to generate audio.');
                if (options.abortSignal?.aborted || resolvedError.name === 'AbortError') {
                    throw createAbortError();
                }
                console.warn('[audio] failed to generate audio for card', {
                    index,
                    textLength: text.length,
                    hasApiKey: Boolean(trimmedApiKey),
                    hasProxyUrl: Boolean(options.proxyUrl?.trim()),
                    voiceName: options.voiceName ?? ELEVENLABS_DEFAULT_VOICE_NAME,
                    modelId: options.modelId ?? ELEVENLABS_DEFAULT_MODEL_ID,
                    outputFormat: options.outputFormat ?? ELEVENLABS_DEFAULT_OUTPUT_FORMAT,
                    languageId: options.languageId,
                    message: resolvedError.message,
                });
                options.onError?.({ error: resolvedError, index, card });
            } finally {
                completed += 1;
                options.onProgress?.({ completed, total, index });
            }
        }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    return results;
}
