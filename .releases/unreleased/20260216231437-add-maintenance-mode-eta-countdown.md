---
type: minor
area: api, web
summary: Add optional ETA countdown to maintenance mode
---

- Add optional `eta` timestamp field to MaintenanceState schema
- Display live countdown in minutes, hours, or days based on time remaining
- Update maintenance script to support `--eta` parameter
- Countdown updates every second in the UI
- API and database support for ETA timestamp storage
