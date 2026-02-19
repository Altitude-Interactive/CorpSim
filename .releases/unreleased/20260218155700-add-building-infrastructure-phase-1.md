---
type: minor
area: sim
summary: Add building infrastructure domain layer for capital-based production system
---

- Add Building model with BuildingType and BuildingStatus enums to Prisma schema
- Add BUILDING_OPERATING_COST and BUILDING_ACQUISITION ledger entry types
- Implement building acquisition, operating cost application, and reactivation services
- Add production capacity tracking based on active buildings
- Buildings have weekly operating costs (7 ticks interval)
- Buildings deactivate when company cannot afford operating costs
- Create comprehensive test suite (12 passing tests)
- Prepare foundation for infrastructure-based production requirements
