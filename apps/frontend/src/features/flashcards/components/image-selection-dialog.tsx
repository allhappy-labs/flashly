import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Loader2 } from 'lucide-react';
import type { FlashcardsResponse } from '@flashly/shared/src';
import { toast } from 'sonner';
import type { ProviderTransport } from '@/config/provider-transport';
import type { UnsplashImage } from '@/utils/unsplash';
import { findUnsplashImages, normalizeUnsplashQuery } from '@/utils/unsplash';
import { getUnsplashSettings } from '@/utils/unsplash-settings';
import { getUnsplashDownloadService } from '@/services/unsplash-download-service';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImageWithLoading } from '@/components/ui/image-with-loading';

type ImageSelectionDialogProps = Readonly<{
    unsplashTransport: ProviderTransport;
    settingsUserId?: string;
    requestSettingsOpen: () => void;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    card: FlashcardsResponse['flashcards'][number];
    currentImageUrl: string;
    onImageSelect: (imageUrl: string, downloadLocation?: string) => void;
}>;

export function ImageSelectionDialog(props: ImageSelectionDialogProps) {
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    const [inputValue, setInputValue] = useState('');
    const [images, setImages] = useState<UnsplashImage[]>([]);
    const [selectedImageUrl, setSelectedImageUrl] = useState(props.currentImageUrl);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (props.open) {
            const initialQuery = normalizeUnsplashQuery(
                props.card.front ?? '',
                props.card.back ?? '',
                typeof props.card.imageQuery === 'string' ? props.card.imageQuery : null,
            );
            setSearchQuery(initialQuery);
            setInputValue(initialQuery);
            setSelectedImageUrl(props.currentImageUrl);
        }
    }, [props.card, props.currentImageUrl, props.open]);

    useEffect(() => {
        if (!props.open || !inputValue) return;

        const abortController = new AbortController();
        const signal = abortController.signal;

        const fetchImages = async () => {
            setIsLoading(true);
            setError(null);

            const accessKey = getUnsplashSettings(props.settingsUserId).accessKey.trim();
            if (props.unsplashTransport === 'direct' && !accessKey) {
                toast.error(t('web.flashcards.missingUnsplashKey'));
                props.requestSettingsOpen();
                setIsLoading(false);
                return;
            }

            const result = await findUnsplashImages(inputValue, {
                transport: props.unsplashTransport,
                accessKey,
                count: 12,
                abortSignal: signal,
            });

            if (!signal.aborted) {
                result.match(
                    (fetchedImages) => {
                        setImages(fetchedImages);
                        setIsLoading(false);
                    },
                    (err) => {
                        setError(err.message);
                        setIsLoading(false);
                    }
                );
            }
        };

        const timeoutId = setTimeout(fetchImages, 500);
        return () => {
            clearTimeout(timeoutId);
            abortController.abort();
        };
    }, [
        inputValue,
        props.open,
        props.requestSettingsOpen,
        props.settingsUserId,
        props.unsplashTransport,
        t,
    ]);

    const handleSelect = useCallback(async () => {
        if (selectedImageUrl) {
            const selectedImage = images.find(img => img.url === selectedImageUrl);
            const accessKey = getUnsplashSettings(props.settingsUserId).accessKey.trim();
            if (props.unsplashTransport === 'direct' && !accessKey) {
                toast.error(t('web.flashcards.missingUnsplashKey'));
                props.requestSettingsOpen();
                return;
            }

            // Trigger download in background (non-blocking)
            if (selectedImage?.downloadLocation) {
                const service = getUnsplashDownloadService();
                const trackingResult = await service.triggerDownload(selectedImage.downloadLocation, {
                    transport: props.unsplashTransport,
                    accessKey,
                });
                if (trackingResult.isErr()) {
                    setError(trackingResult.error.message);
                    return;
                }
            }

            props.onImageSelect(selectedImageUrl, selectedImage?.downloadLocation);
            props.onOpenChange(false);
        }
    }, [
        images,
        props.onImageSelect,
        props.onOpenChange,
        props.requestSettingsOpen,
        props.settingsUserId,
        props.unsplashTransport,
        selectedImageUrl,
        t,
    ]);

    return (
        <Dialog open={props.open} onOpenChange={props.onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>
                        {t('web.flashcards.imageSelection.title')}{' '}
                        <a
                            href="https://unsplash.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                        >
                            {t('web.flashcards.imageSelection.onUnsplash')}
                        </a>
                    </DialogTitle>
                    <DialogDescription>{t('web.flashcards.imageSelection.description')}</DialogDescription>
                </DialogHeader>

                <div className="flex gap-2">
                    <Input
                        type="text"
                        placeholder={t('web.flashcards.imageSelection.searchPlaceholder')}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        className="flex-1"
                    />
                </div>

                <div className="flex-1 overflow-y-auto min-h-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-64">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                            <p className="text-muted-foreground mb-4">{t('web.flashcards.imageSelection.error')}</p>
                            <Button variant="outline" onClick={() => setSearchQuery(searchQuery)}>
                                {t('web.flashcards.imageSelection.retry')}
                            </Button>
                        </div>
                    ) : images.length === 0 ? (
                        <div className="flex items-center justify-center h-64">
                            <p className="text-muted-foreground">{t('web.flashcards.imageSelection.noResults')}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {images.map((image) => (
                                <button
                                    key={image.id}
                                    type="button"
                                    onClick={() => setSelectedImageUrl(image.url)}
                                    onDoubleClick={() => {
                                        setSelectedImageUrl(image.url);
                                        handleSelect();
                                    }}
                                    className={`
                                        relative aspect-[3/2] rounded-lg overflow-hidden border-2 transition-all group
                                        ${
                                            selectedImageUrl === image.url
                                                ? 'border-primary ring-2 ring-primary/20'
                                                : 'border-border hover:border-primary/50'
                                        }
                                    `}
                                >
                                    <div className="w-full h-full">
                                        <ImageWithLoading
                                            src={image.thumbUrl}
                                            alt={image.description ?? image.author}
                                            className="w-full h-full"
                                            loading="lazy"
                                        />
                                    </div>
                                    {selectedImageUrl === image.url && (
                                        <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                                            <Check className="h-4 w-4" />
                                        </div>
                                    )}
                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <a
                                            href={image.authorUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full px-3 py-1 transition-colors"
                                        >
                                            <span className="text-white text-xs font-medium">
                                                {image.author}
                                            </span>
                                        </a>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => props.onOpenChange(false)}>
                        {t('common.cancel')}
                    </Button>
                    <Button onClick={handleSelect} disabled={!selectedImageUrl || isLoading}>
                        {t('web.flashcards.imageSelection.selectButton')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
