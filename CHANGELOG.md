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
