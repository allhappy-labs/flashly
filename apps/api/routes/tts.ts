import { type FastifyPluginAsyncZod, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requestElevenLabsSpeech, resolveElevenLabsVoiceId } from '@flashly/shared';
import { config } from '../config/app.ts';
import { autumnClient } from '../lib/billing/autumn.ts';
import { getOrCreateCachedAudio } from '../services/audio-cache.ts';
import { isAppError } from '@flashly/shared';
import { buildRateLimitKey } from '../lib/utils/rate-limit-key.ts';

const ErrorResponseSchema = z.object({
    error: z.string(),
    message: z.string(),
});

const ElevenLabsRequestSchema = z
    .object({
    text: z.string().trim().min(1).max(config.TTS_MAX_TEXT_LENGTH),
    voiceId: z.string().optional(),
    voiceName: z.string().optional(),
    modelId: z.string().optional(),
    outputFormat: z.string().optional(),
})
    .strict();

const ElevenLabsResponseSchema = z.object({
    base64: z.string(),
    contentType: z.string(),
});

const ttsRoute: FastifyPluginAsyncZod = async (fastify) => {
    fastify.withTypeProvider<ZodTypeProvider>().post(
        '/api/tts/elevenlabs',
        {
            config: {
                rateLimit: {
                    keyGenerator: (req) => buildRateLimitKey(req, 'tts'),
                    max: config.TTS_RATE_LIMIT_MAX,
                    timeWindow: '10 minute',
                },
            },
            schema: {
                body: ElevenLabsRequestSchema,
                response: {
                    200: ElevenLabsResponseSchema,
                    400: ErrorResponseSchema,
                    401: ErrorResponseSchema,
                    403: ErrorResponseSchema,
                    500: ErrorResponseSchema,
                    502: ErrorResponseSchema,
                    503: ErrorResponseSchema,
                },
            },
        },
        async function (request, reply) {
            const session = await fastify.requireAuthSession(request, reply);
            if (!session) {
                return;
            }

            const usageCheck = await autumnClient.check({
                customer_id: session.user.id,
                feature_id: 'audio_for_cards',
                required_balance: 1,
            });

            if (usageCheck.error || !usageCheck.data) {
                fastify.log.error(
                    { err: usageCheck.error, requestId: request.id },
                    'Autumn audio usage check failed',
                );
                return reply.code(500).send({
                    error: 'USAGE_CHECK_FAILED',
                    message: 'Unable to check usage limits at this time.',
                });
            }

            if (!usageCheck.data.allowed) {
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

            try {
                const text = request.body.text.trim();
                const modelId = request.body.modelId ?? config.ELEVENLABS_MODEL_ID;
                const outputFormat = request.body.outputFormat ?? config.ELEVENLABS_OUTPUT_FORMAT;
                const voiceName = request.body.voiceName ?? config.ELEVENLABS_VOICE_NAME;

                // Resolve voice ID using neverthrow
                let resolvedVoiceId = request.body.voiceId ?? config.ELEVENLABS_VOICE_ID;
                if (!resolvedVoiceId) {
                    const voiceResult = await resolveElevenLabsVoiceId({
                        apiKey: config.ELEVENLABS_API_KEY,
                        baseUrl: config.ELEVENLABS_BASE_URL,
                        voiceName,
                    });

                    if (voiceResult.isErr()) {
                        fastify.log.error(
                            { err: voiceResult.error, requestId: request.id },
                            'ElevenLabs voice resolution failed'
                        );
                        return reply.code(voiceResult.error.statusCode as 400 | 401 | 403 | 500 | 502 | 503).send({
                            error: voiceResult.error.code,
                            message: voiceResult.error.message,
                        });
                    }

                    resolvedVoiceId = voiceResult.value;
                }

                // Get or create audio using neverthrow
                const cacheResult = await getOrCreateCachedAudio({
                    text,
                    voiceId: resolvedVoiceId,
                    modelId,
                    outputFormat,
                    generateAudio: () =>
                        requestElevenLabsSpeech({
                            apiKey: config.ELEVENLABS_API_KEY ?? '',
                            baseUrl: config.ELEVENLABS_BASE_URL,
                            modelId,
                            outputFormat,
                            voiceId: resolvedVoiceId,
                            text,
                        }),
                });

                if (cacheResult.isErr()) {
                    const error = cacheResult.error;
                    fastify.log.error(
                        { err: error, requestId: request.id },
                        'ElevenLabs TTS generation failed'
                    );
                    return reply.code(error.statusCode as 400 | 401 | 403 | 500 | 502 | 503).send({
                        error: error.code,
                        message: error.message,
                    });
                }

                const audioData = cacheResult.value;
                const base64 = audioData.audio.toString('base64');

                if (audioData.cacheHit) {
                    fastify.log.info(
                        { requestId: request.id, storageKey: audioData.storageKey },
                        'ElevenLabs TTS cache hit',
                    );
                } else {
                    const trackResult = await autumnClient.track({
                        customer_id: session.user.id,
                        feature_id: 'audio_for_cards',
                        value: 1,
                    });

                    if (trackResult.error) {
                        fastify.log.error(
                            { err: trackResult.error, requestId: request.id },
                            'Autumn audio usage tracking failed',
                        );
                    }
                }

                return reply.code(200).send({
                    base64,
                    contentType: audioData.contentType,
                });
            } catch (error) {
                // Handle any unexpected errors
                if (isAppError(error)) {
                    fastify.log.error({ err: error, requestId: request.id }, 'ElevenLabs TTS failed');
                    return reply.code(error.statusCode as 400 | 401 | 403 | 500 | 502 | 503).send({
                        error: error.code,
                        message: error.message,
                    });
                }

                fastify.log.error({ err: error, requestId: request.id }, 'ElevenLabs TTS failed');
                return reply.code(502).send({
                    error: 'ELEVENLABS_TTS_FAILED',
                    message: error instanceof Error ? error.message : 'Unable to generate audio at this time.',
                });
            }
        },
    );
};

export default ttsRoute;
