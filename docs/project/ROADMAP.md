Read AGENTS.md and docs/design/DESIGN_GUIDELINES.md.

Next goal: Regional Markets v2. Market orders and trades become region-scoped; analytics/candles become region-scoped; logistics enables arbitrage. Keep deterministic, bounded, and migration-safe.

Scope:

1) Schema + migration
Update:
- MarketOrder: add regionId (required)
- Trade: add regionId (required)
- ItemTickCandle: add regionId (required), unique becomes (itemId, regionId, tick)
Update indexes accordingly for query performance.

Rules:
- A market order belongs to a region order book.
- A trade occurs in the region where it matched.
- Shipments remain the only way to move inventory between regions.

2) Sim: region-scoped matching and settlement
- Matching runs per (regionId, itemId).
- When placing an order:
  - order.regionId must equal the company’s regionId (v2 rule, no “remote trading” yet).
  - BUY reserves cash as before.
  - SELL reserves inventory in that region only.
- Settlement updates inventory in that region only.
- All invariants remain valid (inventory keys now include regionId).

3) API changes
Market writes:
- POST /v1/market/orders:
  - regionId optional in request; if omitted, default to company.regionId
  - reject if regionId != company.regionId (403)
Market reads:
- GET /v1/market/orders:
  - add regionId filter (default ALL or company region depending on route; choose one and document)
Trades:
- If a trades endpoint exists, add regionId filter and return regionId in DTOs.
Analytics:
- GET /v1/market/candles:
  - require regionId (or default), include regionId
- GET /v1/market/analytics/summary:
  - require regionId (or default)

4) UI
- Market page:
  - add region selector (defaults to active company region)
  - show separate order books per region
  - “My Orders” is filtered by companyId + regionId
- Analytics page:
  - add region selector
  - show candles for that region
- Logistics page:
  - add “Arbitrage helper” panel (read-only v2):
    - for a selected item, compare lastPriceCents across regions and show deltas

5) Bots
- Liquidity bot becomes region-aware:
  - maintain minimal liquidity in each region for configured items (caps per region)
- Optional: one simple arbitrage bot (OFF by default):
  - if price diff > threshold and has stock, ship to higher-priced region (respect fees/time)

6) Tests (required)
- Unit:
  - matching only matches within same region
  - placing SELL in region requires inventory there
- API integration:
  - place BUY/SELL in CORE -> tick -> trade has regionId=CORE
  - attempt to place order in another region => 403
  - candles are created with regionId and unique key works
- Web:
  - typecheck/lint/build only (no UI tests required)

Constraints:
- No cross-region remote trading in v2.
- Keep request contracts backward compatible where possible (regionId defaulting).
- Full gates green: typecheck, lint, test, api:test, web:build, worker:once.

Proceed.
