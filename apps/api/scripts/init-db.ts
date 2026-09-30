import { Client } from 'pg';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
}

const targetUrl = new URL(databaseUrl);
const targetDb = targetUrl.pathname.replace(/^\/+/, '') || 'postgres';

if (targetDb === 'postgres') {
    console.log('DATABASE_URL already points to postgres; skipping database creation.');
    process.exit(0);
}

const adminUrl = new URL(databaseUrl);
adminUrl.pathname = '/postgres';

function quoteIdentifier(value: string) {
    return `"${value.replace(/"/g, '""')}"`;
}

const adminClient = new Client({ connectionString: adminUrl.toString() });

try {
    await adminClient.connect();

    const existing = await adminClient.query('SELECT 1 FROM pg_database WHERE datname = $1', [targetDb]);

    if (existing.rowCount && existing.rowCount > 0) {
        console.log(`Database "${targetDb}" already exists.`);
    } else {
        await adminClient.query(`CREATE DATABASE ${quoteIdentifier(targetDb)}`);
        console.log(`Database "${targetDb}" created.`);
    }
    console.log('Database is ready. Run "pnpm exec drizzle-kit push" to sync schema.');
} catch (error) {
    console.error('Failed to initialize database:', error);
    process.exitCode = 1;
} finally {
    await adminClient.end();
}
