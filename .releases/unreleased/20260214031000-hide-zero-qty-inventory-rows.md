---
type: patch
area: sim
summary: Exclude zero-quantity inventory rows from company inventory reads.
---

- Update inventory read model queries to return only rows with `quantity > 0`, reducing payload size and preventing empty items from showing in player inventory.
