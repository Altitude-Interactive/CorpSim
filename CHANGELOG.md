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
