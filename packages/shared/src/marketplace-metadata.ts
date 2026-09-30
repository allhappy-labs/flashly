import { z } from 'zod';

export const ROMANIZATION_PREFERENCES = ['native_only', 'with_romanization', 'romanized_only'] as const;

export type RomanizationPreference = (typeof ROMANIZATION_PREFERENCES)[number];

export const MarketplaceLicenseSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(120),
  url: z.string().url().optional(),
});

export const MarketplaceMetadataSchema = z.object({
  level: z.string().trim().min(1).max(50).optional().nullable(),
  skills: z.array(z.string().trim().min(1).max(50)).max(20).optional().nullable(),
  regionalVariant: z.string().trim().min(1).max(50).optional().nullable(),
  script: z.string().trim().min(1).max(50).optional().nullable(),
  romanization: z.enum(ROMANIZATION_PREFERENCES).optional().nullable(),
  license: MarketplaceLicenseSchema.optional().nullable(),
});

export type MarketplaceLicense = z.infer<typeof MarketplaceLicenseSchema>;
export type MarketplaceMetadata = z.infer<typeof MarketplaceMetadataSchema>;
