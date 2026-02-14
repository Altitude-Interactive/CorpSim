---
type: patch
area: sim
summary: Restore production recipe visibility and job creation for legacy companies missing recipe unlock rows.
---

- Add legacy fallback in recipe listing: when a company has incomplete `companyRecipe` state, return the full recipe catalog instead of an empty list.
- Allow production job creation for legacy companies with incomplete `companyRecipe` rows, while preserving strict unlock checks for initialized companies.
