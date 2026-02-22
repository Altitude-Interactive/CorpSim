---
type: minor
area: web,api,sim
summary: Add Buildings Management UI with preflight validation and acquisition flows (Phase 4 & 5)
---

**Phase 4 - Frontend Integration + Preflight + Operator Visibility:**
- Add Buildings page with region/category grouping and status display
- Add building acquisition dialog with cost preview
- Add reusable Storage Meter component with warning thresholds (80%, 95%, 100%)
- Add preflight validation endpoints (canCreateProductionJob, canPlaceBuyOrder)
- Add storage and capacity info endpoints
- Add building type definitions endpoint with balanced costs

**Phase 5 - Acquisition Flows + Balance Pass:**
- Implement transactional building acquisition with ledger entries
- Define BuildingType dataset: Early Workshop, Factory, MegaFactory, Warehouse, HQ
- Add building reactivation flow for INACTIVE buildings
- Implement cost preview showing acquisition cost and weekly operating expenses

**API Layer:**
- Add BuildingsController with full CRUD operations
- Add BuildingsService with ownership validation
- Add buildings API client functions and parsers

**UI Components:**
- Add Dialog, Label, and Progress UI primitives
- Install required @radix-ui packages

- Add Buildings Management UI with preflight validation and acquisition flows (Phase 4 & 5)
