# CorpSim Roadmap

## Core Simulation (Implemented)

* Economy engine (items, recipes, companies, inventory)
* Market orders, region-scoped matching and settlement
* Ledger / accounting system (cash + reserved cash semantics)
* Production jobs system (tick completion)
* Contracts system (generation + fulfillment)
* Research tech tree + unlock gating
* Player identity + company ownership enforcement
* Worker loop + deterministic bots
* Market analytics (region-scoped candles + KPIs)
* Regions + logistics (region inventory + shipments)
* Maintenance mode simulation pause (full world pause during maintenance)
* Item tier lockers and specialization-aware visibility gates

## Identity, Access, and Onboarding (Implemented / Active)

* Better Auth integration (email/password)
* Username support with deterministic Player mapping (`auth user id -> Player.id`)
* Two-factor authentication (TOTP + trust device)
* Session-guarded API routes (header-based identity removed)
* Onboarding flow (post-signup company setup + onboarding gate)
* Profile management popup in-app (sign-out included)

## UX, Controls, and Feedback (Implemented / Active)

* Toast manager for notifications and popups (blur and solid backdrop variants)
* Unified control manager for keyboard shortcuts (`Ctrl + <key>`)
* Shortcut help panel and per-player key remapping via local storage
* Page-search command, inventory quick preview, and gameplay navigation shortcuts
* UI sound hooks for key actions and important popups
* Player registry/catalog page for development visibility

## Economy Depth Expansion (Next Targets)

* Arbitrage mechanics (player + optional AI)
* Warehouses + storage capacity limits
* Storage costs / depreciation
* Quality tiers / product differentiation
* Item spoilage / decay mechanics
* Resource scarcity simulation
* Supply chain complexity (multi-stage production)
* Industrial specialization bonuses
* Dynamic demand curves

## Business Simulation Systems (Planned)

* Company leveling / reputation
* Branding / product lines
* Marketing campaigns
* Pricing automation tools
* Workforce / employee simulation
* Energy / operational cost modeling
* Taxes / regulation simulation
* Corporate loans / credit system
* Bankruptcy mechanics
* Insurance systems

## Auth & Security Hardening (Next Targets)

* Auth rate limiting and abuse protection tuning
* Account recovery and email verification flows
* Session/device management UX improvements
* Audit trail expansion for sensitive account events
* Optional development fallback identity mode behind explicit env flag

## Multiplayer Economy Layer (Future)

* Persistent player accounts
* Company transfers / mergers
* Player-to-player contracts
* Corporate alliances / consortiums
* Shareholding / takeover mechanics
* Competitive leaderboards
* Anti-cheat / exploit detection

## Logistics & World Simulation (Expansion)

* Transport infrastructure tiers
* Shipping delays / disruptions
* Fuel / logistics cost volatility
* Regional events (strikes, disasters)
* Trade tariffs / borders
* Infrastructure investment system
* Private logistics networks
* Warehousing automation

## Market & Finance Tools (Expansion)

* Advanced charts / indicators
* Historical analytics dashboards
* Forecasting tools
* Automated trading agents (player-defined)
* Financial reporting exports
* Budget planning tools
* Profitability analysis modules

## AI / Bots Evolution (Planned)

* Adaptive economic bots
* Competitive corporate AI
* Market-making per-region balancing improvements
* NPC corporations with long-term strategy
* AI research progression
* AI logistics planning

## Technical Infrastructure (Active / Planned)

* Database schema readiness gate before game boot
* Startup validation for migration drift and schema mismatches
* Observability / metrics stack
* Replayable simulation ticks
* Snapshot/backtesting system
* Horizontal worker scaling
* Caching layer refinement
* Event bus architecture
* Data lifecycle tooling (backup/restore, safe reset guardrails)

## UX / ERP Interface Evolution

* Unified corporate dashboard
* Notification/event center expansion
* Task automation panel
* Scenario simulation sandbox
* Bulk operations tooling
* Accessibility improvements

## Content Expansion

* Additional industries / sectors
* Properties buying on a StreetMap
* UI sounds (with option to mute them completely for low end PCs)
* Service economy layer
* Technology era progression
* Energy sector simulation
* Finance sector simulation
* Consumer market simulation

## Long-Term Vision

* Long-term persistence
* Fully player-driven economy
* Persistent world cycles
* Optional seasonal resets
* Modding/API ecosystem
* Mobile-friendly UI
* Public release / monetization strategy
