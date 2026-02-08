# CorpSim

CorpSim is a SimCompanies-inspired economic management webgame focused on a persistent economy, ERP-style dashboard interaction, and simulated companies (bots).

## Documentation

* Project rules and architecture: `AGENTS.md`
* UI design guidelines: `docs/design/DESIGN_GUIDELINES.md`

## Tech Stack

* Node.js + TypeScript
* PostgreSQL + Prisma
* Redis + BullMQ
* Next.js + ShadCN UI (dark theme only)
* Docker Compose / Dokploy deployment

## Repository Structure

```
apps/       # frontend, API, worker
packages/   # shared libraries and database
scripts/    # simulation helpers
docs/       # project documentation
```

## Local Setup

```
pnpm install
cp .env.example .env
```

Start infrastructure if needed:

```
docker compose up -d
```

## Run API (Local)

```
pnpm install
pnpm -C packages/db generate
pnpm api:dev
```

API endpoints are served at `http://localhost:3000` (health check: `GET /health`).

Refer to AGENTS.md for development rules and architecture decisions.
