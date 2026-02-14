---
type: patch
area: web
summary: Convert profile into in-app popup and route /profile to open it
---

- Add a profile popup panel in the main app shell with account details and sign out.
- Change top bar profile action to open the popup instead of navigating to a dedicated page.
- Redirect `/profile` to `/overview?panel=profile` for compatibility.
