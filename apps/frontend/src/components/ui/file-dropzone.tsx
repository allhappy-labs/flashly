import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import { X } from 'lucide-react';

import { cn } from '@/utils/style-utils';

export type FileDropzonePreview = {
    leading: ReactNode;
    trailing?: ReactNode;
};

type FileDropzoneProps = {
    id: string;
    accept?: string;
    title?: ReactNode;
    description?: ReactNode;
    fileName?: string;
    fileSizeLabel?: string;
    preview?: FileDropzonePreview;
    onFileSelect: (file: File) => void;
    onClear?: () => void;
    className?: string;
};

export function FileDropzone({
    id,
    accept,
    title,
    description,
    fileName,
    fileSizeLabel,
    preview,
    onFileSelect,
    onClear,
    className,
}: FileDropzoneProps) {
    const [isDragging, setIsDragging] = useState(false);

    const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback(
        (event: React.DragEvent<HTMLDivElement>) => {
            event.preventDefault();
            setIsDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (file) onFileSelect(file);
        },
        [onFileSelect],
    );

    const handleInputChange = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            if (file) onFileSelect(file);
        },
        [onFileSelect],
    );

    return (
        <div
            className={cn(
                'relative rounded-xl border border-dashed text-sm transition',
                isDragging
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-input bg-muted/30 text-muted-foreground hover:bg-muted/40',
                className,
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <label
                htmlFor={id}
                className="block cursor-pointer px-4 py-4"
            >
                <div className="flex flex-col gap-2">
                    <span className="font-medium text-foreground">{title}</span>
                    {description && <span className="text-xs">{description}</span>}
                </div>
            </label>
            <input
                id={id}
                type="file"
                accept={accept}
                onChange={handleInputChange}
                className="sr-only"
            />
            {fileName && onClear && (
                <button
                    type="button"
                    onClick={onClear}
                    aria-label="Clear file"
                    className="absolute right-2 top-2 z-10 rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                    <X className="h-4 w-4" />
                </button>
            )}
            {fileName && (
                <div className="mx-4 mb-4 mt-0 rounded-lg border bg-background/60 p-3 text-xs text-foreground shadow-xs">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{fileName}</span>
                        {fileSizeLabel && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                {fileSizeLabel}
                            </span>
                        )}
                    </div>
                    {preview && (
                        <div className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                            <div className="h-[8ch] overflow-hidden whitespace-pre-wrap text-foreground/90">
                                {preview.leading}
                            </div>
                            {preview.trailing && (
                                <div className="relative mt-2 max-h-14 overflow-hidden">
                                    <div className="whitespace-pre-wrap text-muted-foreground blur-[0.6px]">
                                        {preview.trailing}
                                    </div>
                                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-background/70 to-background" />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
