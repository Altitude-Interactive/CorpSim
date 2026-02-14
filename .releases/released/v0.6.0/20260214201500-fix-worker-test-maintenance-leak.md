---
type: patch
area: api
summary: Reset maintenance state after worker integration tests to prevent cross-suite 503s
---

- Add worker integration test cleanup that disables maintenance mode after each test run.
- Prevent downstream write integration tests from inheriting maintenance-on state.
