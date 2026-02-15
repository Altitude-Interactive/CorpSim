# CorpSim

[![Verify](https://github.com/Altitude-Interactive/CorpSim/actions/workflows/verify.yml/badge.svg)](https://github.com/Altitude-Interactive/CorpSim/actions/workflows/verify.yml)
[![Contributors](https://img.shields.io/github/contributors/Altitude-Interactive/CorpSim)](https://github.com/Altitude-Interactive/CorpSim/graphs/contributors)
[![Node 20+](https://img.shields.io/badge/node-20.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![pnpm 9+](https://img.shields.io/badge/pnpm-9.x-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![Security Policy](https://img.shields.io/badge/security-policy-blue)](./SECURITY.md)

A SimCompanies-inspired management and economy webgame featuring a persistent simulation environment with AI-driven companies, dynamic market systems, regional trade flows, and a sophisticated ERP-style interface for players to manage their virtual enterprises.

## Contents

- [CorpSim](#corpsim)
  - [Contents](#contents)
  - [Description](#description)
  - [Features](#features)
  - [Tech Stack](#tech-stack)
  - [Getting Started](#getting-started)
  - [Run Services](#run-services)
  - [Simulation Commands](#simulation-commands)
  - [Directory Overview](#directory-overview)
  - [Quality Gates](#quality-gates)
  - [Key Endpoints](#key-endpoints)
  - [Environment Notes](#environment-notes)
  - [Documentation](#documentation)
  - [Contributing](#contributing)
  - [Security](#security)
  - [License](#license)
  - [Release Workflow](#release-workflow)
  - [Acknowledgements](#acknowledgements)

## Description

CorpSim is an ambitious open-source webgame that brings together economy simulation, strategic company management, and persistent multiplayer gameplay. Inspired by SimCompanies, the game creates a living economic world where players compete alongside AI-driven bot companies in dynamic markets with regional trade dynamics.

The game features an authoritative backend simulation engine that continuously processes market transactions, production cycles, and inter-regional trade flows. Players interact through a modern web interface with ERP-style management tools, making strategic decisions about production, specialization, and market participation while the world evolves in real-time.

## Features

- **Authoritative Backend Simulation** - Robust `api` and `worker` services ensure fair, server-side gameplay with no client-side manipulation
- **Persistent World Engine** - Continuous tick-based simulation keeps the economy running 24/7 with AI bot participation
- **Regional Market System** - Dynamic markets with regional price variations and trade flow mechanics
- **Company Operations** - Full production chains, resource management, and strategic specialization options
- **Modern Web Client** - Next.js-powered interface with keyboard controls, overlay management system, and audio feedback
- **Dockerized Infrastructure** - Easy local development setup with PostgreSQL and Redis containerization

## Tech Stack

- **Language & Runtime**: TypeScript + Node.js
- **Backend Framework**: NestJS (API)
- **Frontend Framework**: Next.js (web client)
- **Job Queue**: BullMQ + Redis (simulation jobs)
- **Database**: PostgreSQL + Prisma (schema, migrations, ORM)
- **Monorepo**: pnpm workspaces

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for PostgreSQL and Redis)

### Installation

1. Install dependencies:

```bash
pnpm install
```

2. Create your local environment file:

```bash
cp .env.example .env
```

3. Start local infrastructure:

```bash
docker compose up -d postgres redis
```

4. Generate Prisma client and apply migrations:

```bash
pnpm -C packages/db generate
pnpm -C packages/db migrate:deploy
```

5. Seed initial simulation data:

```bash
pnpm sim:seed
```

Use `pnpm sim:reset` only when you intentionally want to wipe and reseed simulation progress.

## Run Services

Run each in its own terminal:

```bash
pnpm api:dev
pnpm worker:dev
pnpm web:dev
```

Default local ports from `.env.example`:

- API: `http://localhost:4310`
- Web: `http://localhost:4311`

## Simulation Commands

- `pnpm sim:advance --ticks <N>`: advance simulation by `N` ticks.
- `pnpm sim:seed`: seed initial world data.
- `pnpm sim:stats`: quick simulation health snapshot.
- `pnpm sim:reset`: destructive reset (dev-only).

## Directory Overview

The project is organized as a pnpm monorepo with the following structure:

```text
apps/
  api/      # Authoritative REST API server
  web/      # Next.js frontend client
  worker/   # Background simulation and bot runtime
packages/
  db/       # Prisma schema, migrations, and seed data
  shared/   # Shared contracts and TypeScript types
  sim/      # Core simulation and domain logic packages
docs/       # Architecture documentation, design guidelines, and ADRs
scripts/    # Helper scripts for simulation, release, and maintenance
```

## Quality Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm verify`
- `pnpm verify:full`

## Key Endpoints

- `GET /health`
- `GET /health/maintenance`
- `GET /v1/world/health`
- `GET /meta/version`

## Environment Notes

Important env vars you will commonly touch:

- `DATABASE_URL`
- `REDIS_HOST`, `REDIS_PORT`
- `API_PORT`, `WEB_PORT`
- `NEXT_PUBLIC_API_URL`
- `ENFORCE_SCHEMA_READINESS`
- `COMPANY_SPECIALIZATION_CHANGE_COOLDOWN_HOURS`
- `NEXT_PUBLIC_COMPANY_SPECIALIZATION_CHANGE_COOLDOWN_HOURS`

See `.env.example` for the full list.

## Documentation

- Agent/development rules: `docs/agents/AGENTS.md`
- Root agent entrypoint: `AGENTS.md`
- UI design rules: `docs/design/DESIGN_GUIDELINES.md`
- ADR: `docs/adr/0001-worker-runtime-bullmq.md`
- Project docs index: `docs/README.md`

## Contributing

We welcome contributions to CorpSim! Whether you're fixing bugs, adding features, or improving documentation, your help is appreciated.

### How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes following our coding standards
4. Run quality gates: `pnpm typecheck && pnpm lint && pnpm test`
5. Add a release entry in `.releases/unreleased/` (see [CONTRIBUTING.md](./CONTRIBUTING.md))
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to your branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines on:
- Development setup and workflow
- Code style expectations
- Testing requirements
- Release notes process
- Security considerations

## Security

Security reporting process is documented in `SECURITY.md`.

## License

This project does not currently have a license file. Please contact the repository maintainers for licensing information.

## Release Workflow

- Add release entries in `.releases/unreleased/` for non-read-only changes.
- Do not bump `package.json` for normal commits.
- Cut version in dedicated release commit only: `pnpm release:cut`.
- CI workflows:
  - Verify: `.github/workflows/verify.yml`
  - Release: `.github/workflows/release.yml`

## Acknowledgements

CorpSim is inspired by [SimCompanies](https://www.simcompanies.com/), a browser-based business simulation game. We're grateful to the simulation game community for the inspiration and ideas that helped shape this project.

Special thanks to all our [contributors](https://github.com/Altitude-Interactive/CorpSim/graphs/contributors) who have helped improve CorpSim through code contributions, bug reports, and feature suggestions.
