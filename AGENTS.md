# AGENTS.md — ig-story-viewer

Guidance for AI coding agents (and humans) working on this repository.

## 🎯 What this repo is

One userscript, `ig-story-viewer-userscript.user.js`, at the repo root. It opens a public profile's active story without a follow.

## 🔌 Endpoint notes (API-first)

| Step | Request |
|------|---------|
| Resolve username | `GET /api/v1/users/web_profile_info/?username=<name>` → `data.user.pk` |
| Fetch reel | `GET /api/v1/feed/reels_media/?reel_ids=<pk>` → `reels_media[0].items` |
| Fallback | `GET /api/v1/feed/reels_tray/`, match `tray[].id` (only covers followed accounts) |
| Mark seen (optional) | `POST /api/v1/media/seen/` with `items` JSON, `container_module=feed_timeline` |

Headers on every call:

```js
"x-ig-app-id": "936619743392459"
"x-csrftoken": <csrftoken cookie>
"x-requested-with": "XMLHttpRequest"
```

- `reels_media` is empty for private accounts, expired stories, and some regions — handle `[]` as a normal outcome, not an error.
- Media URLs come from `image_versions2.candidates[0].url` and `video_versions[0].url`. Candidates are largest-first; thumbnails may use `thumbnail_url`.
- `@grant none` — nothing is persisted, so no GM storage.

## 🧭 Golden rules

1. One file, zero dependencies, `@grant none`.
2. **Never fire while typing.** `isTyping()` guards the global keys; story keys only act while the overlay is open.
3. Overlay close paths must pause every `<video>` — otherwise audio keeps playing behind the panel.
4. Blob download first, `window.open` fallback; never assume CORS.
5. Bump `@version` on functional changes.

## 🧪 Test with sctl

```bash
sctl install ./ig-story-viewer-userscript.user.js
sctl page goto "https://www.instagram.com/stories/instagram/"
sctl page eval "document.querySelector('#igsv-panel') !== null"
sctl page eval "document.querySelectorAll('.igsv-thumb').length"   # tray count
sctl page press ArrowRight
sctl page press Escape
sctl debug console --level error
```

Use a known-active public story. `document.querySelector('#igsv-overlay').classList.contains('on')` must be true while the viewer is open.

## 🗂️ Layout

| File | Purpose |
|------|---------|
| `ig-story-viewer-userscript.user.js` | The script. Edit this. |
| `README.md` | User-facing docs. |
| `okf/` | Generated scoped bundle. |

## 📌 Known fragility

- `web_profile_info` occasionally answers `401` for logged-out sessions; surface that instead of retrying forever.
- `media/seen` payload shape is undocumented and may change; failures are logged as harmless.
- Instagram's story route is `/stories/<username>/<pk>/`; the username capture must not include the pk.

<!-- okf-requirement -->
## 📚 Documentation lives in ONE place (mandatory)

All documentation for every repository in this workspace is **single-sourced** in the
umbrella repository:

```
c:\ws\docs\okf├── bundle.md            collection overview
├── index.md             catalogue of every concept and script note
├── concepts/            shared knowledge (architecture, testing, metadata, …)
└── scripts/             one note per userscript repository
```

### Rules

1. **Never create an `okf/` folder in this repository.** It is not duplicated here, by
   design. There was once a copy in every repo: 278 files describing 42 unique documents,
   with `concepts/architecture.md` physically present 32 times. Every edit had to be
   propagated to 30 repositories and drift was unavoidable.
2. **Never hand-edit a copy.** There are no copies. Edit the canonical file under
   `c:\ws\docs\okf\`.
3. **This repository's note is** `c:\ws\docs\okf\scripts\<repo-name>.md`. If it does not
   exist, add it before adding the script.
4. **Link, do not paste.** In `README.md`, link to the canonical note with a relative path
   from the workspace, e.g. `[documentation](../../../../../docs/okf/scripts/<repo-name>.md)`.
5. **Verify** with `node c:\ws\scripts\check-okf.mjs` — it exits `0` only when nothing is
   duplicated and every repository is linked and documented.
6. When adding a new script: create the repo, add `docs/okf/scripts/<repo-name>.md`, add it
   to the tables in `docs/okf/bundle.md` and `docs/okf/index.md`, then run the checker.

Full detail: `c:\ws\docs\okf\concepts\okf-requirement.md`.
