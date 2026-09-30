export type ExpoSQLiteDatabase<TSchema = unknown> = {
  $client: unknown;
  $schema?: TSchema;
} & Record<string, unknown>;

export function drizzle<TSchema = unknown>(client: unknown, _config: unknown = {}): ExpoSQLiteDatabase<TSchema> {
  return { $client: client } as ExpoSQLiteDatabase<TSchema>;
}
