import { z } from 'zod';

/**
 * Upload validation schemas
 */

export const UploadImageSchema = z.object({
    fileName: z.string().min(1).max(255),
    fileType: z.string().regex(/^image\/(jpeg|jpg|png|gif|webp)$/),
    fileSize: z.number().max(5 * 1024 * 1024), // 5MB max
});

export const UploadAudioSchema = z.object({
    fileName: z.string().min(1).max(255),
    fileType: z.string().regex(/^audio\/(mp3|mpeg|wav|ogg|m4a|mp4)$/),
    fileSize: z.number().max(10 * 1024 * 1024), // 10MB max
});

export const DeleteUploadSchema = z.object({
    uploadId: z.string(),
});

// Infer types
export type UploadImageInput = z.infer<typeof UploadImageSchema>;
export type UploadAudioInput = z.infer<typeof UploadAudioSchema>;
export type DeleteUploadInput = z.infer<typeof DeleteUploadSchema>;
