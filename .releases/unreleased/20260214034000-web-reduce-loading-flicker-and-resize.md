---
type: patch
area: web
summary: Reduce heavy-page loading flicker by keeping background refreshes non-disruptive.
---

- Use initial-load-only skeletons on major data-heavy pages (`inventory`, `contracts`, `logistics`, `production`, `finance`, `workforce`, `research`, `analytics`).
- Keep existing table content visible during polling/background refreshes to avoid repeated skeleton swaps and layout jumps.
- Split production loading states between recipes and jobs so job refreshes no longer flicker the recipes section.
