FROM node:22-alpine

WORKDIR /repo

RUN corepack enable

# Copy workspace files needed for dependency resolution
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/email-templates/package.json packages/email-templates/

# Install dependencies for the API package (and its workspace deps)
RUN pnpm install --filter @flashly/api... --frozen-lockfile

# Copy source code
COPY . .

WORKDIR /repo/apps/api

# Expose port
EXPOSE ${PORT:-3001}

# Development command (will be overridden by docker-compose)
CMD ["pnpm", "run", "dev"]
