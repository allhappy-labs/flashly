# Auth

## Schema generation & migration

The [Better Auth CLI](/docs/concepts/cli) allows you to generate or migrate
your database schema based on your Better Auth configuration and plugins.

To generate the schema required by Better Auth, run the following command:

```bash title="Schema Generation"
npx @better-auth/cli@latest generate --config lib/auth/auth.ts --output lib/auth/auth-schema.ts
```

To generate and apply the migration, run the following commands:

```bash title="Schema Migration"
npx drizzle-kit generate # generate the migration file
npx drizzle-kit migrate # apply the migration
```

## Additional Information

The Drizzle adapter expects the schema you define to match the table names. For example, if your Drizzle schema maps the `user` table to `users`, you need to manually pass the schema and map it to the user table.

```ts
import { betterAuth } from 'better-auth';
import { db } from './drizzle';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { schema } from './schema';

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: 'sqlite', // or "pg" or "mysql"
        schema: {
            ...schema,
            user: schema.users,
        },
    }),
});
```
