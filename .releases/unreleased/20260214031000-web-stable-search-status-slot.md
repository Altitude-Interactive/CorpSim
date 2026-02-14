---
type: patch
area: web
summary: Prevent search-status text from causing layout jumps on data-heavy pages.
---

- Add a reusable fixed-height deferred-search status component to keep layout stable while filtering updates.
- Replace conditional `Updating...` text blocks across market, contracts, inventory, production, research, and dev catalog pages.
- Preserve status feedback without changing section height during typing.
