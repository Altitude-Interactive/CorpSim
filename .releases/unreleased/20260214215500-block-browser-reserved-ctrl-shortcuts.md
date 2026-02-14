---
type: patch
area: web
summary: Prevent control manager from overriding browser-reserved Ctrl shortcuts
---

- Block shortcut handling for browser-reserved key combos like `Ctrl+T`, `Ctrl+W`, `Ctrl+R`, and tab switching combinations.
- Reject custom shortcut bindings that use browser-reserved key combos.
- Show inline feedback in shortcut edit mode when a reserved combo is attempted.
