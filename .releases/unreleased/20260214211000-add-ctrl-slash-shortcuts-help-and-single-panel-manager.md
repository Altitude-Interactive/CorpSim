---
type: minor
area: web
summary: Add Ctrl+/ shortcuts help panel and enforce one active shortcut overlay
---

- Add a `Ctrl+/` overlay that lists available keyboard shortcuts with readable labels.
- Route keyboard overlays through shared control-panel state so opening one shortcut panel closes others.
- Register metadata for `Ctrl+K` and `Ctrl+I` so both appear in the shortcuts help list.
