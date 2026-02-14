---
type: patch
area: web
summary: Move world diagnostics and simulation controls off player world status into development catalog.
---

- Remove developer diagnostics mode and simulation advance/reset controls from `/world`.
- Keep world status focused on player-safe operational snapshot and integrity status only.
- Add development-only simulation controls and diagnostic details to `/dev/catalog`.
