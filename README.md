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
pnpm -C packages/db migrate:deploy
pnpm sim:reset
pnpm api:dev
```

API endpoint base URL is env-driven via `API_URL` and listens on `PORT` or `API_PORT` (required). Health check route: `GET /health`.

## Run Web (Local)

```
pnpm web:dev
```

Web port is env-driven via `WEB_PORT` or `PORT` (required), and API base URL is read from `NEXT_PUBLIC_API_URL` (required).
For logistics fee preview in web UI, set `NEXT_PUBLIC_SHIPMENT_BASE_FEE_CENTS` and `NEXT_PUBLIC_SHIPMENT_FEE_PER_UNIT_CENTS` to match API env.

## Run Worker (Local)

```
pnpm worker:dev
```

Run a single batch and exit:

```
pnpm worker:once -- --ticks 3
```

Worker configuration env knobs:

* `TICK_INTERVAL_MS` (default `60000`)
* `SIMULATION_SPEED` (default `1`)
* `MAX_TICKS_PER_RUN` (default `10`)
* `INVARIANTS_CHECK_EVERY_TICKS` (default `10`)
* `ON_INVARIANT_VIOLATION` (`stop` | `pause_bots` | `log_only`, default `stop`)
* `BOT_ENABLED` (default `true`)
* `BOT_COUNT` (default `25`)
* `BOT_ITEMS` (default `IRON_ORE,IRON_INGOT,HAND_TOOLS`)
* `BOT_SPREAD_BPS` (default `500`)
* `BOT_MAX_NOTIONAL_PER_TICK_CENTS` (default `50000`)
* `CONTRACTS_PER_TICK` (default `2`)
* `CONTRACT_TTL_TICKS` (default `50`)
* `CONTRACT_ITEM_CODES` (default all seeded items)
* `CONTRACT_PRICE_BAND_BPS` (default `500`)
* `SHIPMENT_BASE_FEE_CENTS` (default `250`)
* `SHIPMENT_FEE_PER_UNIT_CENTS` (default `15`)

`/v1/world/health` includes invariant issues and always caps returned issues to 50 max.

Regional Markets v2: market orders, trades, and candles are region-scoped (`regionId`). Inventory and production remain region-scoped, and logistics (`/v1/shipments`) is the transport path between regions.

Market API region behavior:

* `GET /v1/market/orders` and `GET /v1/market/trades` accept optional `regionId` (defaults to all regions).
* `GET /v1/market/candles` and `GET /v1/market/analytics/summary` require `regionId`.
* `POST /v1/market/orders` accepts optional `regionId`; if omitted, it uses `company.regionId`. Remote-region placement is rejected (`403`).

## Temporary Player Identity (Pre-Auth)

CorpSim currently uses a temporary identity model while full auth is not yet implemented.

* API identity is resolved from `X-Player-Handle`.
* If the header is missing, API falls back to `PLAYER`.
* Ownership checks are enforced for company-scoped player actions (market writes, production writes, inventory reads).
* This is a pre-auth phase foundation, not a final authentication system.

## Ledger Semantics

CorpSim uses a total-cash model:

* `Company.cashCents` is total cash.
* `Company.reservedCashCents` is cash reserved for open BUY orders.
* `LedgerEntry.deltaCashCents` records changes to `cashCents` only.
* `LedgerEntry.deltaReservedCashCents` records changes to `reservedCashCents` only.
* `LedgerEntry.balanceAfterCents` is the post-event `cashCents` balance.

Refer to AGENTS.md for development rules and architecture decisions.
