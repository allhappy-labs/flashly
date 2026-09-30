import { Button } from '@/components/ui/button';
import type { UploadHookControl } from '@better-upload/client';
import { Loader2, Upload } from 'lucide-react';
import { useCallback, useId } from 'react';

interface UploadButtonProps {
    control: UploadHookControl<false>;
    accept?: string;
    metadata?: Record<string, unknown>;
    uploadOverride?: (...args: Parameters<UploadHookControl<false>['upload']>) => void;

    // Add any additional props you need.
}

export function UploadButton({
    control: { upload, isPending },
    accept,
    metadata,
    uploadOverride,
}: Readonly<UploadButtonProps>) {
    const id = useId();

    const handleFileChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            if (e.target.files?.[0] && !isPending) {
                if (uploadOverride) {
                    uploadOverride(e.target.files[0], { metadata });
                } else {
                    upload(e.target.files[0], { metadata });
                }
            }
            e.target.value = '';
        },
        [isPending, uploadOverride, metadata, upload],
    );

    return (
        <Button disabled={isPending} className="relative" type="button">
            <label htmlFor={id} className="absolute inset-0 cursor-pointer" aria-label="Choose file to upload">
                <input
                    id={id}
                    className="absolute inset-0 size-0 opacity-0"
                    type="file"
                    accept={accept}
                    onChange={handleFileChange}
                />
            </label>
            {isPending ? (
                <>
                    <Loader2 className="size-4 animate-spin" />
                    Upload file
                </>
            ) : (
                <>
                    <Upload className="size-4" />
                    Upload file
                </>
            )}
        </Button>
    );
}
