/**
 * Type definitions for file uploads
 */

export interface UploadedFile {
    url?: string;
    objectKey?: string;
    name?: string;
    size?: number;
}

export interface AvatarUploadedFile {
    url?: string;
    objectKey?: string;
}

export interface DocumentUploadedFile {
    name: string;
    url?: string;
    objectKey?: string;
    size?: number;
}
