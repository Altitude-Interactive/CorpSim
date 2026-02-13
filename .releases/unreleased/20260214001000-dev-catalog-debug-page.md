---
type: minor
area: web
summary: Add a development-only dynamic catalog page for inspecting live items, recipes, research, and consistency.
---

- Add hidden `/dev/catalog` page that loads game definitions dynamically from API endpoints.
- Restrict the page to development mode only by returning `404` outside `NODE_ENV=development`.
- Include structural consistency checks for item, recipe, and research references.
