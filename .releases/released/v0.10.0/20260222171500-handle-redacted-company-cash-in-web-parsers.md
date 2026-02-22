---
type: patch
area: web
summary: Accept optional redacted company cash fields in API parsers
---

- Updated web API parsers to treat `cashCents` as optional in company summary and player registry company payloads.
- Prevents admin developer page failures when backend redacts non-owned company cash values.
