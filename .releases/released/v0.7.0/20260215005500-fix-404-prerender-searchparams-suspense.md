---
type: patch
area: web
summary: Fix Next.js production build failure from useSearchParams in always-mounted layout components
---

- Remove `useSearchParams` usage from global auth/profile layout components that render during not-found prerender.
- Parse query string from `window.location.search` on client navigation instead, avoiding Suspense requirement on `/_not-found`.
