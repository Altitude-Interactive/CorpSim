---
type: patch
area: web
summary: Harden Ctrl+/ shortcut defaults for compact and non-US keyboard layouts
---

- Expand default slash key-code coverage to include compact keyboard and locale-specific slash positions.
- Add a fallback Ctrl+slash-variant detector so players can always open shortcuts help before remapping.
- Keep fallback active only while the shortcut uses default binding; custom player bindings take precedence.
