# Instagram: Story Viewer

Watch **any public profile's story without following it**. A single-file userscript that resolves the account through Instagram's own web API, pulls the active reel, and plays it in a tray with keyboard navigation and one-click downloads.

> Part of the [userscripts collection](https://github.com/chirag127?tab=repositories&q=userscript). One repo, one script.

## ✨ What it does

- 🔎 **Username → user id** via `/api/v1/users/web_profile_info/` — no DOM hunting.
- 🎞️ **Reel by API** via `/api/v1/feed/reels_media/?reel_ids=…`; falls back to the reel tray.
- 🖼️ **Tray of items** with timestamps, image and video badges.
- ⌨️ **Keyboard nav**: `←`/`J` previous, `→`/`K`/`Space` next, `D` download, `Esc` close.
- ⬇️ **Per-item and download-all**, blob-first with a new-tab fallback.
- 👁️ Optional best-effort **mark-as-seen**.
- 🖤 Draggable, collapsible dashboard; opens itself on `/stories/<user>/…` URLs.

## 📦 Install

Read the [userscript install guide](https://github.com/chirag127/userscript-install-guide) once, then:

**[Install ig-story-viewer-userscript.user.js](https://github.com/chirag127/ig-story-viewer-userscript/raw/main/ig-story-viewer-userscript.user.js)**

You must be signed in to Instagram in the same browser — the story endpoints are session-bound even for public accounts.

## 🕹️ Usage

1. Open any Instagram page. The panel is bottom-right; `Alt+Shift+S` toggles it.
2. Type `@username` and press **Load** (a profile or `/stories/` URL pre-fills the field).
3. Press **Play**, or click a tray thumbnail.
4. Navigate with the arrow keys; `D` saves the current item; **Download all** walks the reel.

## ⚠️ Limits

- **Public accounts only.** Private accounts need an approved follow, and Instagram may still return an empty reel.
- Stories expire after 24 h; a profile with no active story returns nothing.
- Videos are MP4 with separate audio-less and audio tracks in some cases; the script saves the first `video_versions` entry, which is the playable one.
- Item order is the server order (oldest → newest); it is not sorted.
- Blob downloads depend on CDN CORS; when blocked the file opens in a tab.

## 🚨 Risk note

Read-only against stories. The optional **mark seen** ping writes a view to your account — turn it off if you want to stay invisible. No follows are created.

## 🧠 Docs

Endpoint notes, rules and test steps: [AGENTS.md](AGENTS.md). Knowledge bundle: [okf/index.md](../../../../../docs/okf/index.md).

## 📄 License

[MIT](LICENSE) © 2026 chirag127

<!-- docs-single-source -->
## 📚 Documentation

Documentation for this repository lives in the umbrella workspace, in exactly **one** place:

| What | Where |
|------|-------|
| This script's note | [`docs/okf/scripts/ig-story-viewer-userscript.md`](../../../../../docs/okf/scripts/ig-story-viewer-userscript.md) |
| All notes, catalogued | [`docs/okf/index.md`](../../../../../docs/okf/index.md) |
| Shared knowledge | [`docs/okf/concepts/`](../../../../../docs/okf/concepts/) |

It is **not** copied into this repository. Nothing in this workspace is duplicated: one
document, one file. Verify with `node c:\ws\scripts\check-okf.mjs`.
