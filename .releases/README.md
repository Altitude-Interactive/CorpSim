# Release Planning

All non-doc changes must include one release entry in `.releases/unreleased/`.

## Entry format

Create a markdown file with frontmatter:

```md
---
type: patch|minor|major
area: api|web|sim|db|worker|ops|ci
summary: Short one-line summary
---

- Optional extra context
```

## Commands

- Create entry:
  `pnpm release:entry --type patch --area api --summary "Fix world write guard edge case"`
- Cut release (single bump commit workflow):
  `pnpm release:cut`
