import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import type { ResultAsync} from 'neverthrow';
import { errAsync, okAsync } from 'neverthrow';
import { bucketName, s3Client } from '../config/s3.ts';
import { config } from '../config/app.ts';
import type { ExternalServiceError} from '@flashly/shared';
import { StorageError, safeAsync } from '@flashly/shared';

type AudioCacheKeyOptions = {
    text: string;
    voiceId: string;
    modelId: string;
    outputFormat: string;
};

export type CachedAudioResult = {
    audio: Buffer;
    contentType: string;
    storageKey: string;
    cacheHit: boolean;
};

type CachedAudioLookup = {
    audio: Buffer;
    contentType: string;
    storageKey: string;
};

function normalizeAudioText(text: string): string {
    return text.trim();
}

function computeCacheHash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
}

function buildCacheFingerprint(options: AudioCacheKeyOptions): string {
    return JSON.stringify({
        v: 1,
        text: normalizeAudioText(options.text),
        voiceId: options.voiceId,
        modelId: options.modelId,
        outputFormat: options.outputFormat,
    });
}

function buildStorageKey(hash: string): string {
    return `${config.AUDIO_CACHE_PREFIX}/${hash}`;
}

function getObjectProperty(value: unknown, key: string): unknown {
    if (typeof value !== 'object' || value === null) {
        return undefined;
    }
    return Reflect.get(value, key);
}

function getErrorName(error: unknown): string | undefined {
    const name = getObjectProperty(error, 'name');
    return typeof name === 'string' ? name : undefined;
}

function getErrorHttpStatusCode(error: unknown): number | undefined {
    const metadata = getObjectProperty(error, '$metadata');
    const httpStatusCode = getObjectProperty(metadata, 'httpStatusCode');
    return typeof httpStatusCode === 'number' ? httpStatusCode : undefined;
}

function isNotFoundError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
        return false;
    }

    if (getErrorName(error) === 'NotFound') {
        return true;
    }

    return getErrorHttpStatusCode(error) === 404;
}

function isAudioContentType(value: string): boolean {
    const normalized = value.split(';')[0]?.trim().toLowerCase() ?? '';
    return normalized.startsWith('audio/');
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

export function buildAudioCacheKey(options: AudioCacheKeyOptions): { storageKey: string; fingerprint: string } {
    const fingerprint = buildCacheFingerprint(options);
    const hash = computeCacheHash(fingerprint);
    return { storageKey: buildStorageKey(hash), fingerprint };
}

/**
 * Get cached audio from S3 with neverthrow Result types
 */
export function getCachedAudio(
    options: AudioCacheKeyOptions
): ResultAsync<CachedAudioLookup, StorageError> {
    const { storageKey } = buildAudioCacheKey(options);

    return safeAsync(
        s3Client.send(
            new GetObjectCommand({
                Bucket: bucketName,
                Key: storageKey,
            }),
        ),
        (error) => {
            if (isNotFoundError(error)) {
                return new StorageError('Audio cache entry not found', { cause: error });
            }
            return new StorageError('Failed to retrieve cached audio', { cause: error });
        }
    ).andThen((response) => {
        const body = response.Body;
        if (!body || !(body instanceof Readable)) {
            return errAsync(
                new StorageError('Invalid response body from S3')
            );
        }

        return safeAsync(
            streamToBuffer(body),
            (error) => new StorageError('Failed to stream audio data', { cause: error })
        ).andThen((audio) => {
            if (!audio.length) {
                return errAsync(new StorageError('Cached audio is empty'));
            }

            const contentType = response.ContentType ?? 'audio/mpeg';
            if (!isAudioContentType(contentType)) {
                return errAsync(
                    new StorageError(`Invalid content type in cache: ${contentType}`, {
                        context: { contentType, storageKey }
                    })
                );
            }

            return okAsync({
                audio,
                contentType,
                storageKey,
            });
        });
    });
}

/**
 * Store audio in S3 cache with neverthrow Result types
 */
export function storeCachedAudio(options: {
    storageKey: string;
    audio: Buffer;
    contentType: string;
    metadata?: Record<string, string>;
}): ResultAsync<void, StorageError> {
    return safeAsync(
        s3Client.send(
            new PutObjectCommand({
                Bucket: bucketName,
                Key: options.storageKey,
                Body: options.audio,
                ContentType: options.contentType,
                Metadata: options.metadata,
            }),
        ),
        (error) => new StorageError('Failed to store audio in cache', { cause: error })
    ).map(() => undefined);
}

/**
 * Get existing cached audio or create and store new audio with neverthrow Result types
 */
export function getOrCreateCachedAudio(
    options: AudioCacheKeyOptions & {
        generateAudio: () => ResultAsync<{ audio: ArrayBuffer; contentType: string }, StorageError | ExternalServiceError>;
    },
): ResultAsync<CachedAudioResult, StorageError | ExternalServiceError> {
    // Try to get from cache first
    return getCachedAudio(options)
        .map(
            (cached): CachedAudioResult => ({
                ...cached,
                cacheHit: true,
            })
        )
        .orElse(() => {
            // Cache miss - generate new audio
            const { storageKey, fingerprint } = buildAudioCacheKey(options);

            return options.generateAudio().andThen((generated) => {
                // Validate generated audio
                const contentType = generated.contentType ?? 'audio/mpeg';
                if (!isAudioContentType(contentType)) {
                    return errAsync(
                        new StorageError(`Unexpected audio content type: ${contentType || 'unknown'}`, {
                            context: { contentType }
                        })
                    );
                }

                if (!generated.audio.byteLength) {
                    return errAsync(new StorageError('Generated audio was empty'));
                }

                const audio = Buffer.from(generated.audio);

                // Store in cache (fire and forget - errors shouldn't block the response)
                storeCachedAudio({
                    storageKey,
                    audio,
                    contentType,
                    metadata: {
                        cacheFingerprint: fingerprint,
                        modelId: options.modelId,
                        outputFormat: options.outputFormat,
                        voiceId: options.voiceId,
                    },
                }).match(
                    () => {
                        // Success - log if needed
                    },
                    (error) => {
                        // Log cache storage error but don't fail the request
                        console.error('Failed to store audio in cache:', error);
                    }
                );

                return okAsync({
                    audio,
                    contentType,
                    storageKey,
                    cacheHit: false,
                });
            });
        });
}
