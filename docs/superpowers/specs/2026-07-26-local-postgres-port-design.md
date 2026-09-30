# Local PostgreSQL Port Design

## Goal

Run Flashly's local PostgreSQL database alongside the existing bet PostgreSQL
container without either project interrupting the other. Flashly will use host
port `5433`; bet will remain on host port `5432`.

## Scope

- Make the host-side PostgreSQL port configurable in
  `docker-compose.dev.yml`, defaulting to `5433`.
- Update `apps/api/.env.example` to document the Flashly development database
  URL on port `5433`.
- Update the ignored local `apps/api/.env` database URL to port `5433`.
- Leave `docker-compose.yml` unchanged because production containers connect
  to PostgreSQL over the Compose network on container port `5432`.
- Do not stop, reconfigure, or otherwise change the bet PostgreSQL container.

## Configuration

The development Compose port mapping will be:

```yaml
ports:
  - "${POSTGRES_PORT:-5433}:5432"
```

The API's local and example database URLs will target:

```text
postgresql://postgres:postgres@localhost:5433/flashly_db
```

`POSTGRES_PORT` provides an escape hatch if port `5433` is occupied on another
developer's machine, while `5433` remains the zero-configuration default.

## Startup and Data Flow

1. Docker Compose starts `flashly-postgres-dev`, publishing its internal
   PostgreSQL port `5432` on host port `5433`.
2. The API connects to `localhost:5433` using its local `DATABASE_URL`.
3. Database initialization creates `flashly_db` when necessary.
4. `drizzle-kit push` synchronizes the Better Auth and application schema.
5. Better Auth can insert magic-link verification tokens into Flashly's own
   database before invoking the configured email provider.

The existing named development volume remains the source of Flashly database
data. Changing the published host port does not recreate or discard that data.

## Failure Handling

- If port `5433` is already occupied, Compose fails explicitly and the
  developer can set `POSTGRES_PORT` plus the matching `DATABASE_URL` port.
- If PostgreSQL is not ready, initialization and connection checks must fail
  visibly rather than falling back to another database.
- No database container or volume is removed as part of this change.

## Verification

1. Render the development Compose configuration and confirm the published
   PostgreSQL port is `5433`.
2. Start the Flashly PostgreSQL and Redis services and confirm both are
   healthy.
3. Run the API database initialization and schema synchronization command.
4. Restart the API and confirm its root endpoint returns HTTP 200.
5. Verify a Better Auth verification record can be inserted through the local
   magic-link flow. Sending an actual email requires explicit confirmation at
   action time.
6. Confirm `bet-postgres-1` remains running and published on host port `5432`.

## Non-Goals

- Changing production PostgreSQL networking.
- Migrating or deleting existing database volumes.
- Reconfiguring the bet project.
- Changing the login UI or email-provider configuration.
