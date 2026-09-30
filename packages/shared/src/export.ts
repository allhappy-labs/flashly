import { z } from 'zod';

export const EXPORT_CONFIG_FILE_NAME = 'deck.config.json';
export const EXPORT_FORMAT_VERSION = 1;

export const ExportConfigSchema = z
  .object({
    version: z.number().int().positive(),
    exportedAt: z.string().optional(),
    deck: z.object({
      name: z.string().min(1),
      description: z.string().optional().nullable(),
      locale: z.string().optional(),
      materialType: z.string().optional(),
      deckType: z.string().optional(),
    }),
    cardCount: z.number().int().nonnegative().optional(),
    app: z
      .object({
        name: z.string().min(1),
        platform: z.string().optional(),
        version: z.string().optional(),
      })
      .optional(),
  })
  .passthrough();

export type ExportConfig = z.infer<typeof ExportConfigSchema>;

export function parseExportConfig(raw: string): ExportConfig | null {
  try {
    const parsed = JSON.parse(raw);
    const result = ExportConfigSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
