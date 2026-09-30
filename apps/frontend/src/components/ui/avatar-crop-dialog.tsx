import { useCallback, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Minus, Plus, RotateCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AvatarCropDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    imageSrc: string;
    onCropComplete: (croppedFile: File) => void;
    onCancel?: () => void;
}

export function AvatarCropDialog({
    open,
    onOpenChange,
    imageSrc,
    onCropComplete,
    onCancel,
}: Readonly<AvatarCropDialogProps>) {
    const { t } = useTranslation();
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [rotation, setRotation] = useState(0);
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const onCropChange = useCallback((crop: { x: number; y: number }) => {
        setCrop(crop);
    }, []);

    const onCropAreaComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const onZoomChange = useCallback((zoom: number) => {
        setZoom(zoom);
    }, []);

    const handleConfirm = useCallback(async () => {
        if (!croppedAreaPixels) {
            toast.error(t('web.avatar.cropSelectArea'));
            return;
        }

        setIsProcessing(true);
        try {
            // Dynamically import the crop utilities to split into separate chunk
            const { default: getCroppedImg } = await import('@/utils/crop-utils');
            const croppedFile = await getCroppedImg(imageSrc, croppedAreaPixels, rotation);
            onCropComplete(croppedFile);
            onOpenChange(false);
        } catch (error) {
            console.error('Crop error:', error);
            toast.error(t('web.avatar.cropFailed'));
        } finally {
            setIsProcessing(false);
        }
    }, [croppedAreaPixels, imageSrc, rotation, onCropComplete, onOpenChange, t]);

    const handleCancel = useCallback(() => {
        onCancel?.();
        onOpenChange(false);
    }, [onCancel, onOpenChange]);

    const handleZoomIn = useCallback(() => {
        setZoom((prev) => Math.min(prev + 0.1, 3));
    }, []);

    const handleZoomOut = useCallback(() => {
        setZoom((prev) => Math.max(prev - 0.1, 1));
    }, []);

    const handleRotate = useCallback(() => {
        setRotation((prev) => (prev + 90) % 360);
    }, []);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {t('web.avatar.cropTitle')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('web.avatar.cropDescription')}
                    </DialogDescription>
                </DialogHeader>

                <div className="relative">
                    <div className="relative h-96 w-full bg-black rounded-md overflow-hidden">
                        <Cropper
                            image={imageSrc}
                            crop={crop}
                            rotation={rotation}
                            zoom={zoom}
                            aspect={1}
                            onCropChange={onCropChange}
                            onCropComplete={onCropAreaComplete}
                            onZoomChange={onZoomChange}
                            cropShape="round"
                            showGrid={false}
                        />
                    </div>

                    <div className="flex items-center justify-center space-x-4 mt-4">
                        <Button variant="outline" size="sm" onClick={handleZoomOut} disabled={zoom <= 1}>
                            <Minus className="h-4 w-4" />
                        </Button>

                        <div className="flex items-center space-x-2">
                            <span className="text-sm text-muted-foreground">
                                {t('web.avatar.zoomLabel')}
                            </span>
                            <span className="text-sm font-medium">{Math.round(zoom * 100)}%</span>
                        </div>

                        <Button variant="outline" size="sm" onClick={handleZoomIn} disabled={zoom >= 3}>
                            <Plus className="h-4 w-4" />
                        </Button>

                        <Button variant="outline" size="sm" onClick={handleRotate}>
                            <RotateCw className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleCancel} disabled={isProcessing}>
                        {t('common.cancel')}
                    </Button>
                    <Button onClick={handleConfirm} disabled={isProcessing}>
                        {isProcessing ? t('web.avatar.processing') : t('web.avatar.cropAndUpload')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
