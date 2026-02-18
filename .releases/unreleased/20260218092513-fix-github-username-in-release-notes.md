---
type: patch
area: ci
summary: Use GitHub's built-in release notes generation for correct usernames
---

- Switch from custom release notes script to GitHub's `generate_release_notes: true`
- Follows Dokploy's proven approach for accurate username mentions
- Simpler, more maintainable, no custom API calls needed
- Fixes issue where `@contact` was shown instead of `@BENZOOgataga`
