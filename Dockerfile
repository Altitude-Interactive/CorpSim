FROM node:20-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

FROM base AS build

COPY . .

RUN pnpm install --frozen-lockfile

# Prisma schema validation requires DATABASE_URL to exist during generate.
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/corpsim"
RUN pnpm -C packages/db generate

RUN pnpm -C apps/web build

FROM base AS runtime-base

ENV NODE_ENV="production"
WORKDIR /app

COPY --from=build /app /app

FROM runtime-base AS api

CMD ["pnpm", "-C", "apps/api", "start"]

FROM runtime-base AS worker

CMD ["pnpm", "-C", "apps/worker", "start"]

FROM runtime-base AS web

CMD ["pnpm", "-C", "apps/web", "start"]
