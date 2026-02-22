---
type: patch
area: web
summary: Wrap search-params dependent layout clients in Suspense to fix Next build prerendering
---

- Wrapped `AuthRouteGate` and `GuidedTutorialOverlay` with React `Suspense` boundaries so `useSearchParams()` does not fail static prerender checks.
- Preserved existing runtime behavior by keeping current loading/empty fallbacks.
