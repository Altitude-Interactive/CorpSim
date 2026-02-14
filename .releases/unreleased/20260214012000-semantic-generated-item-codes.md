---
type: patch
area: sim
summary: Replace generated icon item codes with semantic cyberpunk code prefixes and update lookups.
---

- Change generated item codes from `ICON_XX_YY` to semantic `CP_<CATEGORY>_<NN>` prefixes per icon pack.
- Update icon resolution and dev catalog metadata lookups to resolve generated assets by shared catalog metadata instead of regex parsing.
- Align seed auto-unlock logic for generated fabrication recipes with the new `FABRICATE_CP_` code pattern.
