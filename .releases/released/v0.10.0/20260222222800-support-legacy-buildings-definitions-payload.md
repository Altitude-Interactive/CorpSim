---
type: patch
area: web
summary: Accept legacy object-shaped buildings definitions payloads
---

- Make `getBuildingTypeDefinitions` tolerant to both array and object-map payload shapes.
- Automatically inject `buildingType` from object keys when legacy payload omits it.
- Prevent runtime parsing crashes in acquire/buildings dialogs during mixed-version dev runs.
