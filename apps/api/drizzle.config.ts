import { defineConfig } from 'drizzle-kit';
import { config } from './config/app.ts';

export default defineConfig({
    dbCredentials: {
        url: config.DATABASE_URL,
    }, dialect: 'postgresql', out: './migrations', schema: './lib/auth/auth-schema.ts',
});
