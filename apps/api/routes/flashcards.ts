import { type MultipartFile } from '@fastify/multipart';
import { type FastifyPluginAsyncZod, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
    FlashcardsResponseSchema,
    buildFlashcardPrompt,
    attachAudioToFlashcards,
    buildAudioDataUrl,
    requestElevenLabsSpeech,
    resolveElevenLabsVoiceId,
} from '@flashly/shared';
import { extractTextFromUpload } from '../lib/flashcards/text-extraction.ts';
import { storeFlashcardUpload } from '../services/flashcard-uploads.ts';
import { generateFlashcards } from '../services/flashcards.ts';
import { config } from '../config/app.ts';
import { autumnClient } from '../lib/billing/autumn.ts';
import { getOrCreateCachedAudio } from '../services/audio-cache.ts';
import { buildRateLimitKey } from '../lib/utils/rate-limit-key.ts';

const ErrorResponseSchema = z.object({
    error: z.string(),
    message: z.string(),
});

const flashcardsRoute: FastifyPluginAsyncZod = async (fastify) => {
    fastify.withTypeProvider<ZodTypeProvider>().post(
        '/api/flashcards',
        {
            config: {
                rateLimit: {
                    keyGenerator: (req) => buildRateLimitKey(req, 'flashcards'),
                    max: config.FLASHCARD_RATE_LIMIT_MAX,
                    timeWindow: '10 minute',
                },
            },
            schema: {
                response: {
                    200: FlashcardsResponseSchema,
                    400: ErrorResponseSchema,
                    401: ErrorResponseSchema,
                    403: ErrorResponseSchema,
                    413: ErrorResponseSchema,
                    415: ErrorResponseSchema,
                    422: ErrorResponseSchema,
                    500: ErrorResponseSchema,
                    502: ErrorResponseSchema,
                    503: ErrorResponseSchema,
                    504: ErrorResponseSchema,
                },
            },
        },
        async function (request, reply) {
            const startTime = Date.now();
            const fields: Record<string, string> = {};
            let filePart: MultipartFile | null = null;
            let hasExtraFile = false;
            let didGenerateAudio = false;

            const forbiddenKeyFields = [
                'openRouterApiKey',
                'openrouterApiKey',
                'openRouterKey',
                'ttsApiKey',
                'elevenLabsApiKey',
                'elevenlabsApiKey',
            ];

            for await (const part of request.parts()) {
                if (part.type === 'file') {
                    if (filePart) {
                        hasExtraFile = true;
                        await part.toBuffer();
                        continue;
                    }
                    filePart = part;
                } else {
                    fields[part.fieldname] = String(part.value ?? '').trim();
                }
            }

            if (hasExtraFile) {
                return reply.code(400).send({
                    error: 'MULTIPLE_FILES',
                    message: 'Only one file can be uploaded at a time.',
                });
            }

            if (!filePart) {
                return reply.code(400).send({
                    error: 'NO_FILE',
                    message: 'A file upload is required.',
                });
            }

            const session = await fastify.requireAuthSession(request, reply);
            if (!session) {
                return;
            }

            const forbiddenField = forbiddenKeyFields.find((key) => fields[key]);
            if (forbiddenField) {
                return reply.code(400).send({
                    error: 'USER_KEYS_NOT_ALLOWED',
                    message: 'User-provided API keys must be used client-side and are not accepted here.',
                });
            }

            const flashcardCheck = await autumnClient.check({
                customer_id: session.user.id,
                feature_id: 'flashcards_generation',
                required_balance: 1,
            });

            if (flashcardCheck.error || !flashcardCheck.data) {
                fastify.log.error(
                    { err: flashcardCheck.error, requestId: request.id },
                    'Autumn flashcard usage check failed',
                );
                return reply.code(500).send({
                    error: 'USAGE_CHECK_FAILED',
                    message: 'Unable to check usage limits at this time.',
                });
            }

            if (!flashcardCheck.data.allowed) {
                return reply.code(403).send({
                    error: 'USAGE_LIMIT_REACHED',
                    message: 'Flashcard generation limit reached.',
                });
            }

            const buffer = await filePart.toBuffer();
            const extractedResult = await extractTextFromUpload(buffer, filePart.filename, filePart.mimetype);

            if (extractedResult.isErr()) {
                const error = extractedResult.error;
                return reply.code(error.statusCode as 400 | 401 | 403 | 415 | 422 | 500 | 502 | 503 | 504).send({
                    error: error.code,
                    message: error.message,
                });
            }

            const extracted = extractedResult.value;

            if (!extracted.text) {
                return reply.code(400).send({
                    error: 'EMPTY_FILE',
                    message: 'No readable text was found in the uploaded file.',
                });
            }

            if (extracted.text.length > config.FLASHCARD_MAX_SOURCE_CHARS) {
                return reply.code(413).send({
                    error: 'SOURCE_TEXT_TOO_LARGE',
                    message: `Extracted text exceeds the maximum allowed length of ${config.FLASHCARD_MAX_SOURCE_CHARS} characters.`,
                });
            }

            const uploadResult = await storeFlashcardUpload(buffer, {
                contentType: filePart.mimetype,
                filename: filePart.filename,
                sizeBytes: buffer.length,
            });

            if (uploadResult.isErr()) {
                fastify.log.error(
                    { err: uploadResult.error, requestId: request.id },
                    'Flashcard upload storage failed',
                );
                return reply.code(500).send({
                    error: uploadResult.error.code,
                    message: uploadResult.error.message,
                });
            }

            const { prompt, format, materialType } = buildFlashcardPrompt(
                {
                    customInstruction: fields.instruction || fields.customInstruction,
                    documentText: extracted.text,
                    format: fields.format,
                    materialType: fields.materialType,
                },
                {
                    defaultFormat: config.FLASHCARD_DEFAULT_FORMAT,
                    defaultMaterialType: config.FLASHCARD_DEFAULT_MATERIAL_TYPE,
                    formats: config.FLASHCARD_FORMATS,
                    materialTypes: config.FLASHCARD_MATERIAL_TYPES,
                    template: config.FLASHCARD_PROMPT_TEMPLATE,
                },
            );

            fastify.log.info(
                {
                    charCount: extracted.text.length,
                    fileBytes: buffer.length,
                    fileType: extracted.type,
                    format,
                    materialType,
                    pageCount: extracted.pageCount,
                    requestId: request.id,
                    checksum: uploadResult.value.checksum,
                    storageKey: uploadResult.value.storageKey,
                    stored: uploadResult.value.stored,
                },
                'Generating flashcards via OpenRouter',
            );

            const flashcardResult = await generateFlashcards(prompt);

            if (flashcardResult.isErr()) {
                const error = flashcardResult.error;
                fastify.log.error({ err: error, requestId: request.id }, 'Flashcard generation failed');

                const statusCode = error.statusCode ?? 500;
                return reply.code(statusCode as 400 | 401 | 403 | 415 | 422 | 500 | 502 | 503 | 504).send({
                    error: error.code,
                    message: error.message,
                });
            }

            const result = flashcardResult.value;

            const includeAudio = fields.includeAudio === 'true';
            if (includeAudio) {
                const audioCheck = await autumnClient.check({
                    customer_id: session.user.id,
                    feature_id: 'audio_for_cards',
                    required_balance: 1,
                });

                if (audioCheck.error || !audioCheck.data) {
                    fastify.log.error(
                        { err: audioCheck.error, requestId: request.id },
                        'Autumn audio usage check failed',
                    );
                    return reply.code(500).send({
                        error: 'USAGE_CHECK_FAILED',
                        message: 'Unable to check usage limits at this time.',
                    });
                }

                if (!audioCheck.data.allowed) {
                    return reply.code(403).send({
                        error: 'USAGE_LIMIT_REACHED',
                        message: 'Audio generation limit reached.',
                    });
                }

                if (!config.ELEVENLABS_API_KEY) {
                    return reply.code(503).send({
                        error: 'ELEVENLABS_NOT_CONFIGURED',
                        message: 'ElevenLabs is not configured on this server.',
                    });
                }

                const voiceName = fields.ttsVoiceName || config.ELEVENLABS_VOICE_NAME;
                const modelId = fields.ttsModelId || config.ELEVENLABS_MODEL_ID;
                const outputFormat = fields.ttsOutputFormat || config.ELEVENLABS_OUTPUT_FORMAT;
                let resolvedVoiceId = fields.ttsVoiceId || config.ELEVENLABS_VOICE_ID;

                if (!resolvedVoiceId) {
                    const voiceResult = await resolveElevenLabsVoiceId({
                        apiKey: config.ELEVENLABS_API_KEY,
                        baseUrl: config.ELEVENLABS_BASE_URL,
                        voiceName,
                    });

                    if (voiceResult.isErr()) {
                        fastify.log.error(
                            { err: voiceResult.error, requestId: request.id },
                            'ElevenLabs voice resolution failed',
                        );
                    } else {
                        resolvedVoiceId = voiceResult.value;
                    }
                }

                if (resolvedVoiceId) {
                    const voiceId = resolvedVoiceId;
                    let audioCacheMisses = 0;

                    const audioCards = await attachAudioToFlashcards(result.flashcards.flashcards, {
                        apiKey: config.ELEVENLABS_API_KEY,
                        baseUrl: config.ELEVENLABS_BASE_URL,
                        modelId,
                        outputFormat,
                        voiceId,
                        voiceName,
                        concurrency: 2,
                        generateAudioUrl: async (text) => {
                            const cacheResult = await getOrCreateCachedAudio({
                                text,
                                voiceId,
                                modelId,
                                outputFormat,
                                generateAudio: () => requestElevenLabsSpeech({
                                    apiKey: config.ELEVENLABS_API_KEY ?? '',
                                    baseUrl: config.ELEVENLABS_BASE_URL,
                                    modelId,
                                    outputFormat,
                                    voiceId,
                                    text,
                                }),
                            });

                            if (cacheResult.isErr()) {
                                fastify.log.error(
                                    { err: cacheResult.error, requestId: request.id },
                                    'Audio cache retrieval failed',
                                );
                                throw new Error(cacheResult.error.message);
                            }

                            if (!cacheResult.value.cacheHit) {
                                audioCacheMisses += 1;
                            }

                            const base64 = cacheResult.value.audio.toString('base64');
                            return buildAudioDataUrl(base64, cacheResult.value.contentType);
                        },
                    });

                    result.flashcards = { flashcards: audioCards };
                    didGenerateAudio = audioCacheMisses > 0;
                }
            }

            fastify.log.info(
                {
                    durationMs: Date.now() - startTime,
                    flashcardCount: result.flashcards.flashcards.length,
                    model: result.model,
                    requestId: request.id,
                    usage: result.usage,
                },
                'Flashcards generated successfully',
            );

            const flashcardTrack = await autumnClient.track({
                customer_id: session.user.id,
                feature_id: 'flashcards_generation',
                value: 1,
            });

            if (flashcardTrack.error) {
                fastify.log.error(
                    { err: flashcardTrack.error, requestId: request.id },
                    'Autumn flashcard usage tracking failed',
                );
            }

            if (didGenerateAudio) {
                const audioTrack = await autumnClient.track({
                    customer_id: session.user.id,
                    feature_id: 'audio_for_cards',
                    value: 1,
                });

                if (audioTrack.error) {
                    fastify.log.error(
                        { err: audioTrack.error, requestId: request.id },
                        'Autumn audio usage tracking failed',
                    );
                }
            }

            return reply.code(200).send(result.flashcards);
        },
    );
};

export default flashcardsRoute;
