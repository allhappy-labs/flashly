import { useCallback, useState } from 'react';
import { useUploadFile } from '@better-upload/client';
import { UploadButton } from '@/components/ui/upload-button';
import { Download, FileText, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { DocumentUploadedFile } from '@/types/upload';
import { useTranslation } from 'react-i18next';

interface DocumentUploadProps {
    onUploadSuccess?: (fileInfo: { url: string; name: string; size: number }) => void;
    onUploadError?: (error: string) => void;
    maxFiles?: number;
    existingDocuments?: Array<{
        id: string;
        name: string;
        url: string;
        size: number;
    }>;
}

const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export function DocumentUpload({
    onUploadSuccess,
    onUploadError,
    maxFiles = 5,
    existingDocuments = [],
}: Readonly<DocumentUploadProps>) {
    const [uploadedDocuments, setUploadedDocuments] = useState(existingDocuments);
    const { t } = useTranslation();

    const { control } = useUploadFile({
        api: `${import.meta.env.VITE_AUTH_URL}/api/upload`, onUploadComplete: (data) => {
            if (data.file && typeof data.file === 'object') {
                // Type assertion is safe here as we've validated the object structure
                const uploadedFile = data.file as DocumentUploadedFile;
                const fileInfo = {
                    id: crypto.randomUUID(), name: uploadedFile.name, size: uploadedFile.size ?? 0, url: uploadedFile.url || `${import.meta.env.VITE_S3_PUBLIC_URL}/${uploadedFile.objectKey}`,
                };

                setUploadedDocuments((prev) => [...prev, fileInfo]);
                onUploadSuccess?.(fileInfo);
                toast.success(t('web.documents.uploadSuccess'));
            }
        }, route: 'documents',
    });

    const handleUpload = useCallback(
        (file: File) => {
            if (uploadedDocuments.length >= maxFiles) {
                const errorMsg = t('web.documents.maxFiles', { maxFiles });
                onUploadError?.(errorMsg);
                toast.error(errorMsg);
                return Promise.resolve();
            }

            return control.upload(file).catch((error) => {
                console.error('Document upload error:', error);
                let errorMessage = error.message || t('web.documents.uploadFailed');

                // Handle authentication errors specifically
                if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
                    errorMessage = t('web.documents.authRequired');
                }

                onUploadError?.(errorMessage);
                toast.error(errorMessage);
            });
        },
        [control, t, onUploadError, uploadedDocuments.length, maxFiles],
    );

    const handleRemove = useCallback(
        (documentId: string) => {
            setUploadedDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
            toast.success(t('web.documents.removed'));
        },
        [t],
    );

    const createRemoveHandler = useCallback(
        (documentId: string) => () => {
            handleRemove(documentId);
        },
        [handleRemove],
    );

    return (
        <div className="space-y-4">
            <div className="flex flex-col items-center space-y-2">
                <UploadButton control={control} accept=".pdf,.doc,.docx" uploadOverride={handleUpload} />
                <p className="text-xs text-muted-foreground text-center">
                    {t('web.documents.uploadHint', { maxFiles })}
                </p>
            </div>

            {uploadedDocuments.length > 0 && (
                <div className="space-y-2">
                    <h4 className="text-sm font-medium">
                        {t('web.documents.uploadedCount', { uploaded: uploadedDocuments.length, maxFiles })}
                    </h4>
                    <div className="space-y-2">
                        {uploadedDocuments.map((document) => (
                            <Card key={document.id} className="p-0">
                                <CardContent className="p-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                                            <FileText className="h-8 w-8 text-blue-500 flex-shrink-0" />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium truncate" title={document.name}>
                                                    {document.name}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {formatFileSize(document.size)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-1">
                                            <Button variant="ghost" size="sm" title={t('web.documents.download')} asChild>
                                                <a href={document.url} target="_blank" rel="noopener noreferrer">
                                                    <Download className="h-4 w-4" />
                                                </a>
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={createRemoveHandler(document.id)}
                                                title={t('web.documents.remove')}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
