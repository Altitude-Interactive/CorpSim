---
type: patch
area: web
summary: Remap shortcut help trigger to character slash across layouts
---

- Remove physical key-code fallback for shortcut help to avoid mapping to unrelated symbols on some keyboard layouts.
- Keep shift-tolerant matching for `Ctrl+/` so layouts that require shift for `/` still work.
