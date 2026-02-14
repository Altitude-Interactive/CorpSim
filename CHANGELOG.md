# Changelog

All notable changes to CorpSim are documented in this file.

## 0.1.0 - 2026-02-12

### Minor
- [api,web,ops,ci] Add tag-driven app version surfacing, release-cut tooling, and CI release-discipline gates.

### Patch
- [web] Apply ERP-themed styling to the unsupported device screen
- [web] Replace unsupported-device technical wording with player-facing copy
- [web] Align version badge placement with ERP navigation layout
- [ops] Declare root app version metadata for release tooling consistency
- [db] Precreate maintenance state table before dependent migration
- [ci] Publish GitHub releases only when package version increases

## 0.2.0 - 2026-02-12

### Minor
- [ci] Publish GHCR app images automatically during release workflow

### Patch
- [ci] Set git identity before creating release tags in CI
- [ci] Allow CI to publish existing version when release tag is missing
- [ops] Use tag-first image variables in preview compose deployment

## 0.2.1 - 2026-02-13

### Patch
- [ops] Remove local build fallback from preview compose services
- [web] Fix production proxy response decoding and maintenance/version endpoint fallbacks

## 0.3.0 - 2026-02-13

### Minor
- [worker] Migrate worker runtime to BullMQ scheduler/processor architecture with typed Redis queue config
- [sim] Add deterministic baseline demand sink consumption to create persistent market pull
- [sim] Add deterministic organizational capacity workforce system with allocation, delayed hiring, salary ledgering, and API/UI management.

### Patch
- [ci] Add release smoke checks for web version, maintenance, and world health endpoints
- [api] Consolidate API/web contracts and workspace package boundaries for simulation services
- [db] Stabilize Prisma client generation during install and dev startup
- [ci] Enforce import boundary checks in CI and document BullMQ worker decision
- [worker] Harden BullMQ tick processing with DB idempotency keys, global leases, and persisted control state
- [worker] Make prisma generate resilient to Windows engine lock errors and skip unchanged schema generation
- [worker] Add deterministic worker preflight, tick execution retention cleanup, control reset ops path, and CI worker integration gate
- [web] Keep market filter controls single-line and responsive to prevent wrapped labels.

## 0.3.1 - 2026-02-13

### Patch
- [ci] Fix verify workflow worker integration test command to use pnpm --dir with exec.
- [web] Force patched glob versions to mitigate CVE-2025-64756 in transitive tooling.
- [web] Upgrade Next.js to a patched version for CVE-2026-23864 deserialization DoS.

## 0.4.0 - 2026-02-14

### Minor
- [web] Add item icons across ERP screens and align seeded item/recipe naming with a coherent component-manufacturing theme.
- [sim] Add cyberpunk-themed components and implant production chain with coherent icon mappings and market seeding.
- [web] Add a development-only dynamic catalog page for inspecting live items, recipes, research, and consistency.
- [sim] Integrate all cyberpunk icon-pack items into economy with generated recipes, pricing, and dynamic icon resolution.
- [web] Add centralized UI sound feedback with unlock-safe playback, settings, and event/action cues.
- [web] Scale player pages for large economies with paginated market tables and unlocked-item-only selectors.

### Patch
- [ci] Ignore generated Next.js next-env typings in root ESLint to unblock verify pipeline.
- [web] Add item search, filters, and page-size pagination controls to the development catalog.
- [web] Optimize dev catalog performance with pagination for heavy tables and on-demand consistency checks.
- [web] Improve dev catalog input responsiveness with deferred search and precomputed item index rows.
- [sim] Replace generated icon item codes with semantic cyberpunk code prefixes and update lookups.
- [sim] Replace numbered generated item display names with descriptive names and curated produce naming.
- [web] Move world diagnostics and simulation controls off player world status into development catalog.
- [web] Add warning placeholder and developer diagnostics when item icons are missing.
- [web] Optimize large catalog loading and rendering for items, recipes, and research data.
- [sim] Restore production recipe visibility and job creation for legacy companies missing recipe unlock rows.
- [web] Optimize heavy data pages with pagination, deferred search, and bounded dropdown rendering.
- [web] Add table skeleton loading states across market and other player pages with heavy data loads.
- [web] Sanitize frontend API error messages to hide internal IDs and technical details.
- [web] Improve market and large-list page responsiveness with lighter refresh paths and faster item rendering.
- [web] Reduce abrupt page resizing during search by stabilizing paginated table heights.
- [sim] Exclude zero-quantity inventory rows from company inventory reads.
- [web] Prevent search-status text from causing layout jumps on data-heavy pages.
- [web] Set Market page table pagination defaults to 10 rows per page.
- [web] Default production recipe pagination to 10 rows per page.
- [web] Reduce heavy-page loading flicker by keeping background refreshes non-disruptive.

## 0.5.0 - 2026-02-14

### Minor
- [web] Add hidden public player registry page with company holdings and item codes

## 0.5.1 - 2026-02-14

### Patch
- [api] Fix player registry endpoint payload shape for catalog

## 0.5.2 - 2026-02-14

### Patch
- [web] Fix player registry badge variant for web typecheck
