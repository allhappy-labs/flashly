/**
 * Upload Service - Handles file uploads to storage
 *
 * This service supports multiple storage backends:
 * - Local filesystem (development)
 * - AWS S3 (production)
 * - Cloudinary (alternative production)
 */

import { mkdir, readdir, writeFile, unlink, stat } from 'fs/promises';
import { join, resolve, sep } from 'path';
import { existsSync } from 'fs';
import { ResultAsync } from 'neverthrow';
import {
    safeAsync,
    errorFactory,
    createId,
    isAppError,
    type AppError,
} from '@flashly/shared';
import type { UploadImageInput, UploadAudioInput } from './upload-schema.ts';

// ============================================================================
// CONFIGURATION
// ============================================================================

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const SAFE_PATH_SEGMENT_PATTERN = /^[a-zA-Z0-9_-]+$/;
const SAFE_EXTENSION_PATTERN = /^[a-z0-9]{1,10}$/;

// Ensure upload directory exists
async function ensureUploadDir() {
    if (!existsSync(UPLOAD_DIR)) {
        await mkdir(UPLOAD_DIR, { recursive: true });
    }
}

// ============================================================================
// TYPES
// ============================================================================

export interface UploadResult {
    id: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    storageKey: string;
    url: string;
}

export interface DeleteResult {
    success: boolean;
}

// ============================================================================
// UPLOAD SERVICE
// ============================================================================

export class UploadService {
    private toAppError(error: unknown, fallbackMessage: string): AppError {
        if (isAppError(error)) {
            return error;
        }
        return errorFactory.database(fallbackMessage, { cause: error });
    }

    private resolvePathInUploadDir(relativePath: string): string {
        const uploadRoot = resolve(UPLOAD_DIR);
        const targetPath = resolve(uploadRoot, relativePath);
        if (targetPath !== uploadRoot && !targetPath.startsWith(`${uploadRoot}${sep}`)) {
            throw errorFactory.forbidden('Invalid upload path');
        }
        return targetPath;
    }

    private getUserDirectory(userId: string): string {
        if (!SAFE_PATH_SEGMENT_PATTERN.test(userId)) {
            throw errorFactory.validation('Invalid user ID for upload path', { field: 'userId' });
        }
        return this.resolvePathInUploadDir(userId);
    }

    private getUploadId(uploadId: string): string {
        const normalized = uploadId.trim();
        if (!SAFE_PATH_SEGMENT_PATTERN.test(normalized)) {
            throw errorFactory.validation('Invalid upload ID', { field: 'uploadId' });
        }
        return normalized;
    }

    /**
     * Upload an image file
     */
    uploadImage(
        userId: string,
        data: UploadImageInput,
        fileBuffer: Buffer
    ): ResultAsync<UploadResult, AppError> {
        // Validate file size
        if (fileBuffer.length > MAX_FILE_SIZE) {
            return ResultAsync.fromPromise(
                Promise.reject(new Error('File too large')),
                () => errorFactory.validation('File size exceeds maximum allowed size')
            );
        }

        // Validate file type matches buffer
        if (!data.fileType.startsWith('image/')) {
            return ResultAsync.fromPromise(
                Promise.reject(new Error('Invalid file type')),
                () => errorFactory.validation('Invalid image file type')
            );
        }

        // Validate file content matches declared type (magic byte check)
        if (!this.validateImageType(fileBuffer, data.fileType)) {
            return ResultAsync.fromPromise(
                Promise.reject(new Error('File content does not match declared type')),
                () => errorFactory.validation('File content does not match declared type')
            );
        }

        return safeAsync(
            async () => {
                await ensureUploadDir();
                const userDirectory = this.getUserDirectory(userId);
                await mkdir(userDirectory, { recursive: true });

                const uploadId = createId();
                const fileExt = this.getFileExtension(data.fileName, data.fileType);
                const storageKey = `${userId}/${uploadId}.${fileExt}`;
                const filePath = join(userDirectory, `${uploadId}.${fileExt}`);

                // Write file to disk
                await writeFile(filePath, fileBuffer);

                // Generate URL
                const url = `${BASE_URL}/uploads/${storageKey}`;

                return {
                    id: uploadId,
                    fileName: data.fileName,
                    fileType: data.fileType,
                    fileSize: data.fileSize,
                    storageKey,
                    url,
                };
            },
            (error) => this.toAppError(error, 'Failed to upload image')
        );
    }

    /**
     * Upload an audio file
     */
    uploadAudio(
        userId: string,
        data: UploadAudioInput,
        fileBuffer: Buffer
    ): ResultAsync<UploadResult, AppError> {
        // Validate file size
        if (fileBuffer.length > MAX_FILE_SIZE) {
            return ResultAsync.fromPromise(
                Promise.reject(new Error('File too large')),
                () => errorFactory.validation('File size exceeds maximum allowed size')
            );
        }

        // Validate file type matches buffer
        if (!data.fileType.startsWith('audio/')) {
            return ResultAsync.fromPromise(
                Promise.reject(new Error('Invalid file type')),
                () => errorFactory.validation('Invalid audio file type')
            );
        }

        return safeAsync(
            async () => {
                await ensureUploadDir();
                const userDirectory = this.getUserDirectory(userId);
                await mkdir(userDirectory, { recursive: true });

                const uploadId = createId();
                const fileExt = this.getFileExtension(data.fileName, data.fileType);
                const storageKey = `${userId}/${uploadId}.${fileExt}`;
                const filePath = join(userDirectory, `${uploadId}.${fileExt}`);

                // Write file to disk
                await writeFile(filePath, fileBuffer);

                // Generate URL
                const url = `${BASE_URL}/uploads/${storageKey}`;

                return {
                    id: uploadId,
                    fileName: data.fileName,
                    fileType: data.fileType,
                    fileSize: data.fileSize,
                    storageKey,
                    url,
                };
            },
            (error) => this.toAppError(error, 'Failed to upload audio')
        );
    }

    /**
     * Delete an uploaded file
     */
    deleteFile(storageKey: string): ResultAsync<DeleteResult, AppError> {
        return safeAsync(
            async () => {
                const normalizedStorageKey = storageKey.trim().replace(/\\/g, '/');
                if (
                    normalizedStorageKey.length === 0
                    || normalizedStorageKey.includes('..')
                    || normalizedStorageKey.startsWith('/')
                ) {
                    throw errorFactory.validation('Invalid storage key', { field: 'storageKey' });
                }

                const filePath = this.resolvePathInUploadDir(normalizedStorageKey);

                // Check if file exists
                const fileStats = await stat(filePath).catch(() => null);
                if (!fileStats) {
                    throw errorFactory.notFound('File not found');
                }

                // Delete file
                await unlink(filePath);

                return { success: true };
            },
            (error) => this.toAppError(error, 'Failed to delete file')
        );
    }

    deleteFileForUser(userId: string, uploadId: string): ResultAsync<DeleteResult, AppError> {
        return safeAsync(
            async () => {
                const userDirectory = this.getUserDirectory(userId);
                const normalizedUploadId = this.getUploadId(uploadId);
                const userFiles = await readdir(userDirectory).catch(() => null);

                if (!userFiles) {
                    throw errorFactory.notFound('File not found');
                }

                const matchedFileName = userFiles.find((fileName) => {
                    return fileName === normalizedUploadId || fileName.startsWith(`${normalizedUploadId}.`);
                });

                if (!matchedFileName) {
                    throw errorFactory.notFound('File not found');
                }

                const filePath = this.resolvePathInUploadDir(`${userId}/${matchedFileName}`);
                await unlink(filePath);

                return { success: true };
            },
            (error) => this.toAppError(error, 'Failed to delete file')
        );
    }

    /**
     * Get file extension from filename
     */
    private getFileExtension(fileName: string, fileType: string): string {
        const parts = fileName.split('.');
        if (parts.length > 1) {
            const candidate = parts[parts.length - 1].toLowerCase();
            if (SAFE_EXTENSION_PATTERN.test(candidate)) {
                return candidate;
            }
        }

        const extensionByType: Record<string, string> = {
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'image/webp': 'webp',
            'audio/mp3': 'mp3',
            'audio/mpeg': 'mp3',
            'audio/wav': 'wav',
            'audio/ogg': 'ogg',
            'audio/m4a': 'm4a',
            'audio/mp4': 'm4a',
        };

        return extensionByType[fileType] ?? 'bin';
    }

    /**
     * Validate file type from buffer (magic numbers)
     */
    private validateImageType(buffer: Buffer, declaredType: string): boolean {
        // Simple validation - check file signature
        const signatures: Record<string, number[]> = {
            'image/jpeg': [0xFF, 0xD8, 0xFF],
            'image/png': [0x89, 0x50, 0x4E, 0x47],
            'image/gif': [0x47, 0x49, 0x46],
            'image/webp': [0x52, 0x49, 0x46, 0x46],
        };

        const signature = signatures[declaredType];
        if (!signature) return true; // Allow unknown types

        return signature.every((byte, index) => buffer[index] === byte);
    }
}

// Export singleton instance
export const uploadService = new UploadService();
