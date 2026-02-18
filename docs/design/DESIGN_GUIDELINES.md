# CorpSim — UI Design Reference

## Core UX Direction

CorpSim uses a dark-only ERP-style dashboard. The entire game is operated from a unified dashboard rather than separated game screens. The UI prioritizes data clarity, operational control, and immersion through realistic management tooling.

Primary inspiration: management dashboards, ERP software, trading terminals, and SimCompanies grid interaction.

---

## Theme Rules (Dark Only)

### Base Colors

* Background: #0B0F14
* Surface Level 1: #0F1620
* Surface Level 2: #121B26
* Borders: #1E2A3A
* Text Primary: #E6EDF3
* Text Secondary: #9AA7B5
* Accent: single blue/cyan accent only

Status colors must remain functional:

* Success = green
* Warning = amber
* Danger = red
* Info = blue

Avoid pure white backgrounds or excessive gradients.

---

## Typography

Recommended fonts:

* Inter / Geist / system-ui

Hierarchy:

* Page title: 20–24px
* Section titles: 16–18px
* Body text: 13–14px
* Tables/data dense mode: 12–13px

Enable tabular numbers for financial data.

---

## Layout Architecture

### Application Shell

Three fixed zones:

1. Sidebar

   * Module navigation
   * Compact icons + labels
   * Always visible on desktop

2. Top Bar

   * Company context
   * Tick/time indicator
   * Global search / command palette
   * Quick actions

3. Main Workspace

   * Dynamic content panels
   * Cards, grids, tables, charts

Spacing should remain compact but readable.

---

## Primary Modules (Sidebar)

### Overview

* Company summary
* KPIs
* Alerts

### Operations

* Facilities grid (SimCompanies-like interaction)
* Production management
* Inventory

### Market

* Order book
* Orders management
* Trade history

### Finance

* Ledger
* Cashflow analytics

### Analytics

* Price charts
* Production metrics

### Administration (later)

* Simulation controls
* Debug tools

---

## Grid-Based Interaction

Facilities and production use a grid system:

* Click = open detail panel
* Drag/drop = layout management
* Context menu = quick actions

Grid must remain functional first, aesthetic second.

---

## Component Library

Mandatory UI base: ShadCN.

Preferred components:

* Card
* Data tables
* Command palette
* Dialogs / Sheets
* Tabs
* Dropdowns
* Badges
* Alerts
* Toast notifications

Avoid custom components unless necessary.

### Form Input Guidelines

**Placeholder Text:**
* Use descriptive placeholders with examples instead of prefilled values
* Example: `"Enter price (e.g., 1.50)"` not a prefilled `"1.00"`
* Empty initial state helps users understand field purpose
* Placeholders should explain what value is expected

**Labels:**
* Add explicit labels above inputs for clarity
* Use `htmlFor`/`id` attributes for accessibility (screen readers)
* Labels should be independent of default values

**Toast Notifications:**
* Use for completion feedback (research complete, production finished)
* Show actionable information (e.g., "Unlocked recipes: X, Y, Z")
* Truncate long lists with `"+ N more"` pattern
* Deduplicate repeated items in multi-item toasts

**Time Display:**
* Show countdown timers for time-based systems ("Next week in 42s")
* Include tooltips explaining time units and progression
* Update in real-time for dynamic feedback

---

## Data Visualization

Focus on clarity over style:

* Financial graphs
* Production rates
* Market prices
* Capacity utilization

Use consistent colors across charts.

---

## Interaction Principles

* Minimal animation
* Immediate feedback on actions
* Keyboard shortcuts encouraged
* Dense information presentation
* No gamified flashy UI

This should feel like operating a professional management system.

---

## Responsiveness

Primary target:

* Desktop first

Secondary:

* Tablet usable

Mobile support optional initially.

---

## Future Visual Enhancements (Optional)

* Subtle industrial textures
* Data-driven ambient indicators
* Optional immersive overlays

These must never reduce readability.

---

## Absolute Constraints

* Dark theme only
* ERP realism priority
* Modular component design
* No temporary UI shortcuts
* Dashboard is the central interaction hub
