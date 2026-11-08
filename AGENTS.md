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
## 🧠 OKF documentation requirement (mandatory)

**Every repository in this collection MUST ship an Open Knowledge Format (OKF) bundle in `okf/`.**

A repository without `okf/` is **incomplete**, even if the script works.

### What must exist

```
okf/
├── bundle.md      overview of the collection
├── index.md       catalogue of concepts
├── concepts/      all shared concept notes
└── scripts/       THIS repository's own script note
```

### Rules

1. **Never hand-edit** a repository's `okf/` copy. The canonical bundle is
   `repos/own/public/userscripts/okf/` in the `c:\ws` monorepo.
2. After changing the canonical bundle, regenerate every copy:
   `node okf/sync-okf.mjs`
3. Verify nothing has drifted: `node okf/sync-okf.mjs --check` — must exit `0`.
4. `README.md` must link to `okf/`. `AGENTS.md` (this file) must restate this requirement.
5. When adding a new script, add its note at `okf/scripts/<repo-name>.md` in the canonical
   bundle first, then sync.

Full detail: [`okf/concepts/okf-requirement.md`](okf/concepts/okf-requirement.md)
