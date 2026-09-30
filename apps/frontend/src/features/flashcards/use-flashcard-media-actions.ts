import { useCallback, type Dispatch, type SetStateAction } from 'react';
import {
    ELEVENLABS_DEFAULT_MODEL_ID,
    ELEVENLABS_DEFAULT_OUTPUT_FORMAT,
    ELEVENLABS_DEFAULT_VOICE_NAME,
    attachAudioToFlashcards,
    generateElevenLabsSpeechDataUrl,
    stripMarkdown,
    type FlashcardMaterialType,
    type FlashcardsResponse,
    type GenerationFailures,
    type MediaFailure,
} from '@flashly/shared/src';
import type { TFunction } from 'i18next';
import { toast } from 'sonner';

import type { ProviderTransport } from '@/config/provider-transport';
import { getUnsplashDownloadService } from '@/services/unsplash-download-service';
import { getElevenLabsSettings } from '@/utils/elevenlabs-settings';
import { createLogger } from '@/utils/logger';
import { findUnsplashImageUrl, normalizeUnsplashQuery } from '@/utils/unsplash';
import { getUnsplashSettings } from '@/utils/unsplash-settings';
import { attachImagesToFlashcards } from './utils/attach-images-to-flashcards';

const logger = createLogger('flashcard-generator-media', {
    debugEnabled: import.meta.env.DEV || import.meta.env.VITE_ENABLE_FLASHCARD_GENERATOR_DEBUG === 'true',
});

type UseFlashcardMediaActionsParams = Readonly<{
    flashcards: FlashcardsResponse | null;
    streamedCards: FlashcardsResponse['flashcards'];
    retryingCardIds: Set<string>;
    userId: string | undefined;
    elevenLabsApiKey: string;
    elevenLabsVoiceName: string;
    elevenLabsModelId: string;
    ttsProxyUrl: string;
    materialType: FlashcardMaterialType;
    selectedLanguageId: string | undefined;
    isGeneratingAudio: boolean;
    setIsGeneratingAudio: Dispatch<SetStateAction<boolean>>;
    setAudioProgress: Dispatch<SetStateAction<{ completed: number; total: number }>>;
    isGeneratingImages: boolean;
    setIsGeneratingImages: Dispatch<SetStateAction<boolean>>;
    setImageProgress: Dispatch<SetStateAction<{ completed: number; total: number }>>;
    setMediaFailures: Dispatch<SetStateAction<GenerationFailures>>;
    setRetryingCardIds: Dispatch<SetStateAction<Set<string>>>;
    getStableCardId: (card: FlashcardsResponse['flashcards'][number]) => string;
    onUpdateWithAudio: (cards: FlashcardsResponse['flashcards']) => void;
    onUpdateWithImages: (cards: FlashcardsResponse['flashcards']) => void;
    requestSettingsOpen: () => void;
    unsplashTransport: ProviderTransport;
    unsplashImageWidth: number;
    unsplashImageQuality: number;
    getAudioAbortSignal?: () => AbortSignal | undefined;
    getImageAbortSignal?: () => AbortSignal | undefined;
    onAudioTaskStarted?: () => void;
    onAudioTaskProgress?: (state: { completed: number; total: number }) => void;
    onAudioTaskCompleted?: () => void;
    onAudioTaskFailed?: (error: string) => void;
    onAudioTaskCancelled?: () => void;
    onImageTaskStarted?: () => void;
    onImageTaskProgress?: (state: { completed: number; total: number }) => void;
    onImageTaskCompleted?: () => void;
    onImageTaskFailed?: (error: string) => void;
    onImageTaskCancelled?: () => void;
    t: TFunction;
}>;

function isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError';
}

export function useFlashcardMediaActions(params: UseFlashcardMediaActionsParams) {
    const handleGenerateAudio = useCallback(async () => {
        if (!params.flashcards || params.isGeneratingAudio) {
            return;
        }

        const latestElevenLabs = getElevenLabsSettings(params.userId);
        const resolvedApiKey = latestElevenLabs.apiKey.trim() || params.elevenLabsApiKey.trim();
        const resolvedVoiceName =
            latestElevenLabs.voiceName.trim() || params.elevenLabsVoiceName.trim() || ELEVENLABS_DEFAULT_VOICE_NAME;
        const resolvedModelId =
            latestElevenLabs.modelId.trim() || params.elevenLabsModelId.trim() || ELEVENLABS_DEFAULT_MODEL_ID;

        if (!resolvedApiKey && !params.ttsProxyUrl) {
            logger.warn('missing ElevenLabs key and proxy URL');
            toast.error(params.t('web.flashcards.missingElevenLabsKey'));
            params.requestSettingsOpen();
            return;
        }

        const audioFailures: MediaFailure[] = [];
        let didCancel = false;
        let didFail = false;
        const audioAbortSignal = params.getAudioAbortSignal?.();

        try {
            logger.debug('starting audio generation', {
                cards: params.flashcards.flashcards.length,
                hasApiKey: Boolean(resolvedApiKey),
                hasProxyUrl: Boolean(params.ttsProxyUrl),
                voiceName: resolvedVoiceName,
                modelId: resolvedModelId,
            });
            params.onAudioTaskStarted?.();
            params.setIsGeneratingAudio(true);
            params.setAudioProgress({ completed: 0, total: params.flashcards.flashcards.length });

            const updatedCards = await attachAudioToFlashcards(params.flashcards.flashcards, {
                apiKey: resolvedApiKey || undefined,
                proxyUrl: resolvedApiKey ? undefined : params.ttsProxyUrl || undefined,
                voiceName: resolvedVoiceName,
                modelId: resolvedModelId,
                outputFormat: ELEVENLABS_DEFAULT_OUTPUT_FORMAT,
                languageId: params.materialType === 'Language' ? params.selectedLanguageId : undefined,
                concurrency: 2,
                abortSignal: audioAbortSignal,
                onProgress: ({ completed, total }) => {
                    params.setAudioProgress({ completed, total });
                    params.onAudioTaskProgress?.({ completed, total });
                },
                onError: ({ error, index, card }) => {
                    if (!card) {
                        return;
                    }
                    const cardId = params.getStableCardId(card);
                    audioFailures.push({
                        cardId,
                        cardIndex: index,
                        card,
                        errorType: 'audio',
                        errorMessage: error instanceof Error ? error.message : String(error),
                        timestamp: Date.now(),
                    });
                },
            });

            const cardsWithAudio = updatedCards.filter(
                (card) => typeof card.audioUrl === 'string' && card.audioUrl.length > 0,
            ).length;

            params.onUpdateWithAudio(updatedCards);
            params.setMediaFailures((prev) => ({ ...prev, audio: audioFailures }));

            if (audioFailures.length > 0) {
                const successCount = updatedCards.length - audioFailures.length;
                toast.error(
                    params.t('web.flashcards.audioGenerationPartialFailure', {
                        success: successCount,
                        failed: audioFailures.length,
                        total: updatedCards.length,
                    }),
                );
            } else {
                toast.success(
                    params.t('web.flashcards.audioGenerationSuccess', {
                        count: cardsWithAudio,
                    }),
                );
            }
            params.onAudioTaskCompleted?.();
        } catch (error) {
            if (audioAbortSignal?.aborted || isAbortError(error)) {
                didCancel = true;
                params.onAudioTaskCancelled?.();
                return;
            }

            didFail = true;
            logger.error('audio generation failed', error);
            params.onAudioTaskFailed?.(error instanceof Error ? error.message : String(error));
            toast.error(params.t('web.flashcards.audioGenerationFailed'));
        } finally {
            params.setIsGeneratingAudio(false);
            if (!didCancel && !didFail && audioAbortSignal?.aborted) {
                params.onAudioTaskCancelled?.();
            }
        }
    }, [
        params.elevenLabsApiKey,
        params.elevenLabsModelId,
        params.elevenLabsVoiceName,
        params.getAudioAbortSignal,
        params.flashcards,
        params.getStableCardId,
        params.isGeneratingAudio,
        params.materialType,
        params.onUpdateWithAudio,
        params.onAudioTaskCancelled,
        params.onAudioTaskCompleted,
        params.onAudioTaskFailed,
        params.onAudioTaskProgress,
        params.onAudioTaskStarted,
        params.requestSettingsOpen,
        params.selectedLanguageId,
        params.setAudioProgress,
        params.setIsGeneratingAudio,
        params.setMediaFailures,
        params.t,
        params.ttsProxyUrl,
        params.userId,
    ]);

    const handleGenerateImages = useCallback(async () => {
        if (!params.flashcards || params.isGeneratingImages) {
            return;
        }

        const latestUnsplash = getUnsplashSettings(params.userId);
        const resolvedUnsplashAccessKey = latestUnsplash.accessKey.trim();
        if (params.unsplashTransport === 'direct' && !resolvedUnsplashAccessKey) {
            toast.error(params.t('web.flashcards.missingUnsplashKey'));
            params.requestSettingsOpen();
            return;
        }

        const imageFailures: MediaFailure[] = [];
        let didCancel = false;
        let didFail = false;
        const imageAbortSignal = params.getImageAbortSignal?.();
        try {
            params.onImageTaskStarted?.();
            params.setIsGeneratingImages(true);
            params.setImageProgress({ completed: 0, total: params.flashcards.flashcards.length });

            const updatedCards = await attachImagesToFlashcards(params.flashcards.flashcards, {
                unsplashTransport: params.unsplashTransport,
                unsplashAccessKey: resolvedUnsplashAccessKey,
                width: params.unsplashImageWidth,
                quality: params.unsplashImageQuality,
                abortSignal: imageAbortSignal,
                onProgress: ({ completed, total }) => {
                    params.setImageProgress({ completed, total });
                    params.onImageTaskProgress?.({ completed, total });
                },
                onError: ({ error, index, card }) => {
                    const cardId = params.getStableCardId(card);
                    imageFailures.push({
                        cardId,
                        cardIndex: index,
                        card,
                        errorType: 'image',
                        errorMessage: error instanceof Error ? error.message : String(error),
                        timestamp: Date.now(),
                    });
                },
            });

            const cardsWithImages = updatedCards.filter(
                (card) => typeof card.imageUrl === 'string' && card.imageUrl.length > 0,
            ).length;

            params.onUpdateWithImages(updatedCards);
            params.setMediaFailures((prev) => ({ ...prev, image: imageFailures }));

            if (imageFailures.length > 0) {
                const successCount = updatedCards.length - imageFailures.length;
                toast.error(
                    params.t('web.flashcards.imageGenerationPartialFailure', {
                        success: successCount,
                        failed: imageFailures.length,
                        total: updatedCards.length,
                    }),
                );
            } else {
                toast.success(
                    params.t('web.flashcards.imageGenerationSuccess', {
                        count: cardsWithImages,
                    }),
                );
            }
            params.onImageTaskCompleted?.();
        } catch (error) {
            if (imageAbortSignal?.aborted || isAbortError(error)) {
                didCancel = true;
                params.onImageTaskCancelled?.();
                return;
            }
            didFail = true;
            logger.error('image generation failed', error);
            params.onImageTaskFailed?.(error instanceof Error ? error.message : String(error));
            toast.error(params.t('web.flashcards.imageGenerationFailed'));
        } finally {
            params.setIsGeneratingImages(false);
            if (!didCancel && !didFail && imageAbortSignal?.aborted) {
                params.onImageTaskCancelled?.();
            }
        }
    }, [
        params.flashcards,
        params.getStableCardId,
        params.getImageAbortSignal,
        params.isGeneratingImages,
        params.onImageTaskCancelled,
        params.onImageTaskCompleted,
        params.onImageTaskFailed,
        params.onImageTaskProgress,
        params.onImageTaskStarted,
        params.onUpdateWithImages,
        params.requestSettingsOpen,
        params.setImageProgress,
        params.setIsGeneratingImages,
        params.setMediaFailures,
        params.t,
        params.unsplashImageQuality,
        params.unsplashImageWidth,
        params.unsplashTransport,
        params.userId,
    ]);

    const handleRetryAudio = useCallback(async (failure: MediaFailure) => {
        const cardId = failure.cardId;
        if (params.retryingCardIds.has(cardId)) {
            return;
        }

        const latestElevenLabs = getElevenLabsSettings(params.userId);
        const resolvedApiKey = latestElevenLabs.apiKey.trim() || params.elevenLabsApiKey.trim();
        const resolvedVoiceName =
            latestElevenLabs.voiceName.trim() || params.elevenLabsVoiceName.trim() || ELEVENLABS_DEFAULT_VOICE_NAME;
        const resolvedModelId =
            latestElevenLabs.modelId.trim() || params.elevenLabsModelId.trim() || ELEVENLABS_DEFAULT_MODEL_ID;

        if (!resolvedApiKey && !params.ttsProxyUrl) {
            toast.error(params.t('web.flashcards.missingElevenLabsKey'));
            return;
        }

        params.setRetryingCardIds((prev) => new Set([...prev, cardId]));
        try {
            const updatedCard = { ...failure.card };
            const textToSpeak = stripMarkdown(updatedCard.front ?? '');

            const audioUrl = await generateElevenLabsSpeechDataUrl({
                text: textToSpeak,
                apiKey: resolvedApiKey || undefined,
                proxyUrl: resolvedApiKey ? undefined : params.ttsProxyUrl || undefined,
                voiceName: resolvedVoiceName,
                modelId: resolvedModelId,
                outputFormat: ELEVENLABS_DEFAULT_OUTPUT_FORMAT,
                languageId: params.materialType === 'Language' ? params.selectedLanguageId : undefined,
            });

            updatedCard.audioUrl = audioUrl;
            const updatedCards = params.streamedCards.map((card) => {
                if (params.getStableCardId(card) === cardId) {
                    return updatedCard;
                }
                return card;
            });

            params.onUpdateWithAudio(updatedCards);
            params.setMediaFailures((prev) => ({
                ...prev,
                audio: prev.audio.filter((entry) => entry.cardId !== cardId),
            }));

            toast.success(params.t('web.flashcards.audioRetrySuccess'));
        } catch (error) {
            logger.error('audio retry failed', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            params.setMediaFailures((prev) => ({
                ...prev,
                audio: prev.audio.map((entry) =>
                    entry.cardId === cardId
                        ? { ...entry, errorMessage, timestamp: Date.now() }
                        : entry,
                ),
            }));
            toast.error(params.t('web.flashcards.audioRetryFailed'));
        } finally {
            params.setRetryingCardIds((prev) => {
                const next = new Set(prev);
                next.delete(cardId);
                return next;
            });
        }
    }, [
        params.elevenLabsApiKey,
        params.elevenLabsModelId,
        params.elevenLabsVoiceName,
        params.getStableCardId,
        params.materialType,
        params.onUpdateWithAudio,
        params.retryingCardIds,
        params.selectedLanguageId,
        params.setMediaFailures,
        params.setRetryingCardIds,
        params.streamedCards,
        params.t,
        params.ttsProxyUrl,
        params.userId,
    ]);

    const handleRetryImage = useCallback(async (failure: MediaFailure) => {
        const cardId = failure.cardId;
        if (params.retryingCardIds.has(cardId)) {
            return;
        }

        const latestUnsplash = getUnsplashSettings(params.userId);
        const resolvedUnsplashAccessKey = latestUnsplash.accessKey.trim();
        if (params.unsplashTransport === 'direct' && !resolvedUnsplashAccessKey) {
            toast.error(params.t('web.flashcards.missingUnsplashKey'));
            params.requestSettingsOpen();
            return;
        }

        params.setRetryingCardIds((prev) => new Set([...prev, cardId]));
        try {
            const updatedCard = { ...failure.card };
            const searchQuery = normalizeUnsplashQuery(
                updatedCard.front ?? '',
                updatedCard.back ?? '',
                typeof updatedCard.imageQuery === 'string' ? updatedCard.imageQuery : null,
            );

            if (!searchQuery) {
                throw new Error(params.t('web.flashcards.noImagesFound'));
            }

            const imageUrlResult = await findUnsplashImageUrl(searchQuery, {
                transport: params.unsplashTransport,
                accessKey: resolvedUnsplashAccessKey,
                width: params.unsplashImageWidth,
                quality: params.unsplashImageQuality,
            });

            imageUrlResult.match(
                (imageResult) => {
                    if (!imageResult?.url) {
                        throw new Error(params.t('web.flashcards.noImagesFound'));
                    }

                    updatedCard.imageUrl = imageResult.url;
                    if (imageResult.downloadLocation) {
                        const service = getUnsplashDownloadService();
                        service.triggerDownload(imageResult.downloadLocation, {
                            transport: params.unsplashTransport,
                            accessKey: resolvedUnsplashAccessKey,
                        });
                    }

                    const updatedCards = params.streamedCards.map((card) => {
                        if (params.getStableCardId(card) === cardId) {
                            return updatedCard;
                        }
                        return card;
                    });

                    params.onUpdateWithImages(updatedCards);
                    params.setMediaFailures((prev) => ({
                        ...prev,
                        image: prev.image.filter((entry) => entry.cardId !== cardId),
                    }));

                    toast.success(params.t('web.flashcards.imageRetrySuccess'));
                },
                (error) => {
                    logger.error('image retry failed', error);
                    params.setMediaFailures((prev) => ({
                        ...prev,
                        image: prev.image.map((entry) =>
                            entry.cardId === cardId
                                ? { ...entry, errorMessage: error.message, timestamp: Date.now() }
                                : entry,
                        ),
                    }));
                    toast.error(params.t('web.flashcards.imageRetryFailed'));
                },
            );
        } finally {
            params.setRetryingCardIds((prev) => {
                const next = new Set(prev);
                next.delete(cardId);
                return next;
            });
        }
    }, [
        params.getStableCardId,
        params.onUpdateWithImages,
        params.requestSettingsOpen,
        params.retryingCardIds,
        params.setMediaFailures,
        params.setRetryingCardIds,
        params.streamedCards,
        params.t,
        params.unsplashImageQuality,
        params.unsplashImageWidth,
        params.unsplashTransport,
        params.userId,
    ]);

    return {
        handleGenerateAudio,
        handleGenerateImages,
        handleRetryAudio,
        handleRetryImage,
    };
}
