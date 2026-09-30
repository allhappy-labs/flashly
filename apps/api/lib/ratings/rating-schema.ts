import { z } from 'zod';

/**
 * Rating and review validation schemas
 */

export const CreateRatingSchema = z.object({
    rating: z.number().int().min(1).max(5),
});

export const CreateReviewSchema = z.object({
    rating: z.number().int().min(1).max(5),
    title: z.string().max(200).optional(),
    content: z.string().min(1).max(2000),
});

export const UpdateReviewSchema = z.object({
    title: z.string().max(200).optional(),
    content: z.string().min(1).max(2000).optional(),
});

export const MarkReviewHelpfulSchema = z.object({
    reviewId: z.string(),
});

// Infer types
export type CreateRatingInput = z.infer<typeof CreateRatingSchema>;
export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;
export type UpdateReviewInput = z.infer<typeof UpdateReviewSchema>;
export type MarkReviewHelpfulInput = z.infer<typeof MarkReviewHelpfulSchema>;
