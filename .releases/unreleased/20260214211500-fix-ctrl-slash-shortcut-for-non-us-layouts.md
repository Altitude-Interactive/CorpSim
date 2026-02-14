---
type: patch
area: web
summary: Fix Ctrl+/ shortcut detection on non-US keyboard layouts
---

- Add optional physical-key matching for control shortcuts using `event.code`.
- Update the shortcuts help binding to use the slash key code and accept both shifted and non-shifted variants.
