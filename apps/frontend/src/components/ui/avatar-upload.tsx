import { Suspense, lazy, memo, useCallback, useOptimistic, useState } from 'react';
import { useUploadFile } from '@better-upload/client';
import { UploadButton } from '@/components/ui/upload-button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User } from 'lucide-react';
import { toast } from 'sonner';
import type { AvatarUploadedFile } from '@/types/upload';
import { getFileReaderResultAsString } from '@/utils/file-helpers';
import { useTranslation } from 'react-i18next';

const CropDialogLoading = memo(() => {
    const { t } = useTranslation();
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 flex items-center space-x-3">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-sm">{t('web.avatar.loadingEditor')}</span>
            </div>
        </div>
    );
});

const AvatarCropDialog = lazy(() =>
    import('@/components/ui/avatar-crop-dialog').then((module) => ({
        default: module.AvatarCropDialog,
    })),
);

const cropDialogLoadingFallback = <CropDialogLoading />;

interface AvatarUploadProps {
    currentImage?: string;
    onUploadSuccess?: (url: string) => void;
    onUploadError?: (error: string) => void;
}

// Helper function to ensure we have a full URL for avatars
const getFullAvatarUrl = (imageUrl: string | null | undefined): string | null => {
    if (!imageUrl) return null;

    // If it's already a full URL, return as-is
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        return imageUrl;
    }

    // If it looks like an S3 object key, construct the full URL
    if (imageUrl.startsWith('avatars/')) {
        return `${import.meta.env.VITE_S3_PUBLIC_URL}/${imageUrl}`;
    }

    // For any other case, return as-is (might be a relative URL or base64)
    return imageUrl;
};

export function AvatarUpload({ currentImage, onUploadSuccess, onUploadError }: Readonly<AvatarUploadProps>) {
    const fullCurrentImageUrl = getFullAvatarUrl(currentImage);
    const [previousUrl, setPreviousUrl] = useState<string | null>(fullCurrentImageUrl);
    const [cropDialogOpen, setCropDialogOpen] = useState(false);
    const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null);
    const { t } = useTranslation();

    // Optimistic avatar URL for immediate preview
    const [optimisticAvatarUrl, setOptimisticAvatarUrl] = useOptimistic(
        fullCurrentImageUrl,
        (_currentUrl, newUrl: string | null) => newUrl,
    );

    const { control } = useUploadFile({
        api: `${import.meta.env.VITE_AUTH_URL}/api/upload`, onUploadComplete: (data) => {
            if (data.file && typeof data.file === 'object') {
                // Type assertion is safe here as we've validated the object structure
                const uploadedFile = data.file as AvatarUploadedFile;
                // Use the full URL if provided by the server, otherwise construct it
                const fileUrl =
                    uploadedFile.url || `${import.meta.env.VITE_S3_PUBLIC_URL}/${uploadedFile.objectKey}`;

                setOptimisticAvatarUrl(fileUrl);
                setPreviousUrl(fileUrl); // Update previous URL to new uploaded image
                onUploadSuccess?.(fileUrl);
                toast.success(t('web.avatar.uploadSuccess'));
            }
        }, route: 'avatar',
    });

    const handleFileSelection = useCallback(
        (file: File) => {
            const reader = new FileReader();
            reader.addEventListener('load', (e) => {
                const result = getFileReaderResultAsString(e.target?.result ?? null);
                if (result) {
                    setSelectedImageSrc(result);
                    setPreviousUrl(optimisticAvatarUrl);
                    setOptimisticAvatarUrl(result);
                    setCropDialogOpen(true);
                }
            });
            reader.readAsDataURL(file);
        },
        [optimisticAvatarUrl, setOptimisticAvatarUrl],
    );

    const handleCropComplete = useCallback(
        (croppedFile: File) => {
            // Show optimistic preview of cropped image immediately
            const reader = new FileReader();
            reader.addEventListener('load', (e) => {
                const croppedImageUrl = getFileReaderResultAsString(e.target?.result ?? null);
                if (croppedImageUrl) {
                    setOptimisticAvatarUrl(croppedImageUrl);
                }
            });
            reader.readAsDataURL(croppedFile);

            // Upload the cropped file
            control.upload(croppedFile).catch((error) => {
                console.error('Avatar upload error:', error);
                let errorMessage = error.message || t('web.avatar.uploadFailed');

                // Handle authentication errors specifically
                if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
                    errorMessage = t('web.avatar.authRequired');
                }

                // Revert optimistic update on upload failure
                setOptimisticAvatarUrl(previousUrl);

                onUploadError?.(errorMessage);
                toast.error(errorMessage);
            });
        },
        [control, t, previousUrl, onUploadError, setOptimisticAvatarUrl],
    );

    const handleCropCancel = useCallback(() => {
        setSelectedImageSrc(null);
        // Revert to previous avatar
        setOptimisticAvatarUrl(previousUrl);
    }, [previousUrl, setOptimisticAvatarUrl]);

    const handleUploadOverride = useCallback(
        (file: File) => {
            handleFileSelection(file);
            // Don't upload immediately, let the crop dialog handle it
            return Promise.resolve();
        },
        [handleFileSelection],
    );

    return (
        <div className="flex flex-col items-center space-y-4">
            <div className="relative">
                <Avatar className="h-24 w-24">
                    <AvatarImage src={optimisticAvatarUrl || undefined} alt={t('web.avatar.alt')} />
                    <AvatarFallback className="text-xl">
                        <User className="h-8 w-8" />
                    </AvatarFallback>
                </Avatar>

                {control.isPending && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    </div>
                )}
            </div>

            <div className="flex flex-col items-center space-y-2">
                <UploadButton
                    control={control}
                    accept="image/jpeg,image/png,image/webp"
                    uploadOverride={handleUploadOverride}
                />
                <p className="text-xs text-muted-foreground text-center">
                    {t('web.avatar.fileHint')}
                </p>
            </div>

            {selectedImageSrc && (
                <Suspense fallback={cropDialogLoadingFallback}>
                    <AvatarCropDialog
                        open={cropDialogOpen}
                        onOpenChange={setCropDialogOpen}
                        imageSrc={selectedImageSrc}
                        onCropComplete={handleCropComplete}
                        onCancel={handleCropCancel}
                    />
                </Suspense>
            )}
        </div>
    );
}
