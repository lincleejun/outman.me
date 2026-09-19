---
name: share-page
description: Publish an HTML page (report, diff, mockup, chart) to share.outman.cc and hand back the link. Use whenever a page is meant for someone else to open — never publish to a third-party artifact host.
---

# share-page

When output is an HTML page someone else will open, publish it under our own domain.

1. Write a **self-contained** page (inline CSS, inline SVG, data-URI images; no external scripts except cdnjs/jsdelivr).
2. Run:
   ```bash
   ~/workspace/personal/outman.me/scripts/share.sh page.html
   ```
3. Reply with the printed `https://share.outman.cc/share/<id>` link. Say it expires 90 days after publishing.

The script reads `SHARE_TOKEN` from the repo `.env` if it is not already in the shell.
