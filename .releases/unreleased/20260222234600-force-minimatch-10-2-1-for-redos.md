---
type: patch
area: ci
summary: Force minimatch 10.2.1 across workspace to resolve ReDoS advisory
---

- Add pnpm override to pin all minimatch resolutions to 10.2.1.
- Regenerate lockfile so eslint and related transitive dependencies no longer resolve minimatch versions below 10.2.1.
