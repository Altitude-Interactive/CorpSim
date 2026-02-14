---
type: minor
area: api, web, db
summary: Add a required first-time tutorial after onboarding company setup
---

- Add a post-onboarding tutorial flow that introduces CorpSim, core economy basics, and key features.
- Persist tutorial completion on the player record and expose tutorial state in onboarding status.
- Enforce tutorial completion in auth route gating so new accounts reach the dashboard only after finishing the walkthrough.
