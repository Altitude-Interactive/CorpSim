---
type: patch
area: web
summary: Sanitize frontend API error messages to hide internal IDs and technical details.
---

- Add centralized API error-message sanitization in the web client before surfacing messages in UI toasts and forms.
- Map technical backend errors (such as insufficient inventory with internal item IDs) to player-friendly wording.
- Fallback to generic messages when responses contain likely internal identifiers.
