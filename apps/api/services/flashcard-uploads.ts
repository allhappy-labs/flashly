import { createHash } from 'node:crypto';
import { CopyObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { bucketName, s3Client } from '../config/s3.ts';
import { config } from '../config/app.ts';
import type { ResultAsync} from 'neverthrow';
import { okAsync, errAsync } from 'neverthrow';
import { StorageError, safeAsync } from '@flashly/shared';

export interface FlashcardUploadResult {
    checksum: string;
    storageKey: string;
    stored: boolean;
    lastModified?: Date;
}

export class FlashcardStorageError extends Error {
    readonly code: string;

    constructor(message: string, code: string) {
        super(message);
        this.code = code;
    }
}

function computeSha256(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
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

function getRetentionMs(): number {
    return config.FLASHCARD_UPLOAD_RETENTION_HOURS * 60 * 60 * 1000;
}

export function storeFlashcardUpload(
    buffer: Buffer,
    options: {
        contentType?: string;
        filename?: string;
        sizeBytes?: number;
    },
): ResultAsync<FlashcardUploadResult, StorageError> {
    const checksum = computeSha256(buffer);
    const storageKey = `${config.FLASHCARD_UPLOAD_PREFIX}/${checksum}`;
    const retentionMs = getRetentionMs();
    const now = Date.now();

    // Check if file already exists
    const checkExisting = safeAsync(
        s3Client.send(
            new HeadObjectCommand({
                Bucket: bucketName,
                Key: storageKey,
            }),
        ),
        (error) => {
            if (isNotFoundError(error)) {
                return new StorageError('File not found in S3', { cause: error });
            }
            return new StorageError('Failed to check existing uploads.', { cause: error });
        }
    );

    return checkExisting
        .andThen((head) => {
            const lastModified = head.LastModified;
            const ageMs = lastModified ? now - lastModified.getTime() : retentionMs + 1;

            if (ageMs < retentionMs) {
                return okAsync({
                    checksum,
                    lastModified,
                    storageKey,
                    stored: false,
                });
            }

            // File exists but is expired, refresh it
            return safeAsync(
                s3Client.send(
                    new CopyObjectCommand({
                        Bucket: bucketName,
                        CopySource: `${bucketName}/${storageKey}`,
                        Key: storageKey,
                        MetadataDirective: 'COPY',
                    }),
                ),
                (error) => new StorageError('Failed to refresh existing upload.', { cause: error })
            ).map(() => ({
                checksum,
                lastModified: new Date(),
                storageKey,
                stored: false,
            }));
        })
        .orElse((error) => {
            // File doesn't exist, proceed with upload
            if (error.code === 'FILE_NOT_FOUND') {
                return safeAsync(
                    s3Client.send(
                        new PutObjectCommand({
                            Bucket: bucketName,
                            ContentType: options.contentType || 'application/octet-stream',
                            Key: storageKey,
                            Metadata: {
                                checksum,
                                filename: options.filename ?? 'upload',
                                sizeBytes: String(options.sizeBytes ?? buffer.length),
                                uploadedAt: new Date().toISOString(),
                            },
                            Body: buffer,
                        }),
                    ),
                    (uploadError) => new StorageError('Failed to store uploaded file.', { cause: uploadError })
                ).map(() => ({
                    checksum,
                    lastModified: new Date(),
                    storageKey,
                    stored: true,
                }));
            }

            // Some other error occurred
            return errAsync(error);
        });
}
