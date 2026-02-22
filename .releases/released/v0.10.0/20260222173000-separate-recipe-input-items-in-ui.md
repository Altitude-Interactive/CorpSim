---
type: patch
area: web
summary: Improve recipe input readability with explicit separators and quantity labels
---

- Added a reusable `ItemQuantityList` UI component that renders item inputs with clear separators and `xN` quantities.
- Updated developer and production recipe sections to use the shared list component, preventing concatenated input labels.
