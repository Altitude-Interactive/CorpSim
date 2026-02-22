---
type: patch
area: web
summary: Fix local Prisma lock races and restore Buildings/research feedback visibility
---

- Serialize `prisma:generate` runs with a cross-process lock to prevent Windows engine rename collisions when multiple dev scripts start at once.
- Replace deprecated `/workforce` entry points by redirecting to `/buildings` and surfacing Buildings in shared navigation.
- Move research completion toasts into a global app-shell notifier so completion feedback appears even when users are on other pages.
