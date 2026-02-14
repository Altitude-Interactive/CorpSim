---
type: patch
area: web
summary: Add warning placeholder and developer diagnostics when item icons are missing.
---

- Show a warning placeholder icon when an item icon mapping is missing or an icon asset fails to load.
- Emit deduplicated development console warnings for missing icon mappings and broken icon asset paths.
- Add structured icon resolution metadata to support fallback and diagnostics behavior.
