---
type: Script
title: Instagram — Story viewer
description: Plays any public profile's active story without following it, with a tray, keyboard navigation and downloads.
repo: https://github.com/chirag127/ig-story-viewer-userscript
install: https://github.com/chirag127/ig-story-viewer-userscript/raw/main/ig-story-viewer-userscript.user.js
version: "1.0.0"
tags: [userscript, instagram, stories, viewer, download]
timestamp: 2026-11-09T00:00:00Z
---

# Instagram — Story viewer

Resolves a username to a pk through `web_profile_info`, then requests
`/api/v1/feed/reels_media/?reel_ids=<pk>`. The reel tray is a fallback for accounts you
already follow.

## Method

| Step | Call |
|------|------|
| Resolve | `GET /api/v1/users/web_profile_info/?username=` |
| Reel | `GET /api/v1/feed/reels_media/?reel_ids=` |
| Seen (optional) | `POST /api/v1/media/seen/` |

Items render in a tray; `←`/`J`, `→`/`K`/`Space`, `D` and `Esc` drive the overlay.
Downloads go blob-first and fall back to a new tab. `@grant none`.

## Limitations

- Public accounts only; private reels come back empty without an approved follow.
- Stories expire after 24 h.
- The `media/seen` payload is undocumented; failures are logged as harmless.
- Signed CDN URLs expire, so download promptly.

## Risk

Read-only by default. The optional seen ping records a view on your account.
