export type SQLiteDatabase = {
  execAsync: (sql: string) => Promise<void>;
  getAllAsync: <T = unknown>(sql: string) => Promise<T[]>;
};

export async function openDatabaseAsync(_name: string): Promise<SQLiteDatabase> {
  return {
    execAsync: async () => undefined,
    getAllAsync: async () => [],
  };
}
