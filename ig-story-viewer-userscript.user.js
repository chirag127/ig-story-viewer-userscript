// ==UserScript==
// @name         Instagram: Story Viewer
// @namespace    https://github.com/chirag127
// @version      1.0.0
// @description  Opens any public profile's story without following it: resolves the account through Instagram's web_profile_info API, plays the reel_media items in a tray with arrow/J/K navigation, and downloads each item.
// @author       chirag127
// @license      MIT
// @match        https://www.instagram.com/*
// @icon         https://www.instagram.com/favicon.ico
// @homepageURL  https://github.com/chirag127/ig-story-viewer-userscript
// @supportURL   https://github.com/chirag127/ig-story-viewer-userscript/issues
// @downloadURL  https://github.com/chirag127/ig-story-viewer-userscript/raw/main/ig-story-viewer-userscript.user.js
// @updateURL    https://github.com/chirag127/ig-story-viewer-userscript/raw/main/ig-story-viewer-userscript.user.js
// @grant        none
// @noframes
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  const APP_ID = "936619743392459";
  const state = { user: null, items: [], index: 0, open: false, markSeen: false, route: "" };

  /* ---------- utils ---------- */

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function cookie(name) {
    const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : "";
  }

  function isTyping() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = (el.tagName || "").toUpperCase();
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
  }

  function h(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "class") n.className = v;
      else if (k === "style") Object.assign(n.style, v);
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined) n.setAttribute(k, v);
    }
    for (const kid of kids.flat()) {
      if (kid == null) continue;
      n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return n;
  }

  function api(path, opts = {}) {
    const headers = {
      "x-ig-app-id": APP_ID,
      "x-csrftoken": cookie("csrftoken"),
      "x-requested-with": "XMLHttpRequest",
      "referer": location.href
    };
    if (opts.body) headers["content-type"] = "application/x-www-form-urlencoded";
    return fetch(path, { credentials: "include", method: opts.method || "GET", headers, body: opts.body })
      .then(async (r) => {
        let data = null;
        try { data = await r.json(); } catch { /* non-JSON */ }
        return { ok: r.ok, status: r.status, data };
      });
  }

  function img(item) {
    const c = item.image_versions2 && item.image_versions2.candidates;
    return c && c.length ? c[0].url : "";
  }

  function vid(item) {
    const v = item.video_versions;
    return v && v.length ? v[0].url : "";
  }

  function stamp(item) {
    return new Date((item.taken_at || 0) * 1000).toLocaleString();
  }

  function log(msg, kind = "info") {
    const box = document.querySelector("#igsv-log");
    if (!box) return;
    box.prepend(h("div", { class: "igsv-" + kind }, `${new Date().toLocaleTimeString()}  ${msg}`));
    while (box.childElementCount > 100) box.lastChild.remove();
  }

  /* ---------- data ---------- */

  async function resolve(username) {
    const res = await api(`/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`);
    if (!res.ok || !res.data || !res.data.data || !res.data.data.user) return null;
    return res.data.data.user;
  }

  async function fetchStories(userId) {
    const res = await api(`/api/v1/feed/reels_media/?reel_ids=${encodeURIComponent(userId)}`);
    if (res.ok && res.data && res.data.reels_media && res.data.reels_media.length) {
      return res.data.reels_media[0].items || [];
    }
    // Fallback: the tray only holds accounts you already follow, but it is a
    // second chance when reels_media returns an empty reel.
    const tray = await api("/api/v1/feed/reels_tray/");
    const hit = tray.data && tray.data.tray && tray.data.tray.find((t) => String(t.id) === String(userId));
    return hit ? hit.items || [] : [];
  }

  async function open(username) {
    username = (username || "").trim().replace(/^@/, "").replace(/\/+$/, "");
    if (!username) { log("enter a username", "warn"); return; }
    log(`resolving @${username}…`);
    const user = await resolve(username);
    if (!user) { log(`@${username} not found (or private without access)`, "bad"); return; }
    if (user.is_private) log("account is private — stories may be empty", "warn");
    const items = await fetchStories(user.pk);
    if (!items.length) { log(`@${username} has no active story`, "warn"); return; }
    state.user = user;
    state.items = items;
    state.index = 0;
    log(`loaded ${items.length} item(s) from @${username}`, "good");
    buildTray();
    show(0);
  }

  /* ---------- overlay ---------- */

  let overlay, stage, counter, tray, panel;

  function buildOverlay() {
    if (overlay) return;
    overlay = h("div", { id: "igsv-overlay" },
      h("div", { class: "igsv-bar" },
        h("span", { id: "igsv-who" }, ""),
        h("span", { class: "igsv-spacer" }),
        h("button", { class: "igsv-ico", title: "Download (D)", onclick: () => download(state.index) }, "⬇"),
        h("button", { class: "igsv-ico", title: "Close (Esc)", onclick: close }, "×")
      ),
      h("div", { class: "igsv-progress" }, ...[]),
      stage = h("div", { class: "igsv-stage" }),
      h("button", { class: "igsv-nav igsv-prev", title: "Previous (← / J)", onclick: () => show(state.index - 1) }, "‹"),
      h("button", { class: "igsv-nav igsv-next", title: "Next (→ / K)", onclick: () => show(state.index + 1) }, "›"),
      counter = h("div", { class: "igsv-counter" }, "")
    );
    overlay.addEventListener("click", (e) => { if (e.target === overlay || e.target === stage) close(); });
    document.body.append(overlay);
  }

  function show(i) {
    if (!state.items.length) return;
    if (!overlay) buildOverlay();
    state.index = Math.max(0, Math.min(state.items.length - 1, i));
    const item = state.items[state.index];
    stage.textContent = "";
    if (item.video_versions) {
      stage.append(h("video", { src: vid(item), controls: "controls", autoplay: "autoplay", playsinline: "playsinline" }));
    } else {
      stage.append(h("img", { src: img(item), alt: "" }));
    }
    counter.textContent = `${state.index + 1} / ${state.items.length}`;
    overlay.querySelector("#igsv-who").textContent = `@${state.user.username}`;
    const pct = ((state.index + 1) / state.items.length) * 100;
    overlay.querySelector(".igsv-progress").style.setProperty("--p", pct + "%");
    overlay.querySelector(".igsv-prev").disabled = state.index === 0;
    overlay.querySelector(".igsv-next").disabled = state.index === state.items.length - 1;
    for (const [n, node] of [...tray.children].entries()) node.classList.toggle("on", n === state.index);
    if (state.markSeen) markSeen(item);
  }

  function openViewer() {
    if (!state.items.length) return;
    buildOverlay();
    overlay.classList.add("on");
    state.open = true;
    show(state.index);
  }

  function close() {
    if (!overlay) return;
    overlay.classList.remove("on");
    state.open = false;
    for (const v of overlay.querySelectorAll("video")) v.pause();
  }

  async function markSeen(item) {
    const body = new URLSearchParams({
      _csrftoken: cookie("csrftoken"),
      _uuid: crypto.randomUUID(),
      container_module: "feed_timeline",
      reel_media_skipped: "false",
      items: JSON.stringify([{ id: item.id, taken_at: item.taken_at }])
    });
    const res = await api("/api/v1/media/seen/", { method: "POST", body: body.toString() });
    if (!res.ok) log(`seen ping failed (${res.status}) — harmless`, "warn");
  }

  /* ---------- downloads ---------- */

  function filename(item, i) {
    const ext = item.video_versions ? "mp4" : "jpg";
    return `ig-${state.user ? state.user.username : "story"}-${String(i + 1).padStart(2, "0")}.${ext}`;
  }

  async function save(url, name) {
    try {
      const r = await fetch(url, { credentials: "omit" });
      if (!r.ok) throw new Error(r.status);
      const blob = await r.blob();
      const a = h("a", { href: URL.createObjectURL(blob), download: name });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 20000);
      log(`saved ${name}`, "good");
    } catch (e) {
      window.open(url, "_blank");
      log(`blob fetch blocked — opened ${name} in a tab`, "warn");
    }
  }

  function download(i) {
    const item = state.items[i];
    if (!item) return;
    save(item.video_versions ? vid(item) : img(item), filename(item, i));
  }

  async function downloadAll() {
    for (let i = 0; i < state.items.length; i++) {
      const item = state.items[i];
      await save(item.video_versions ? vid(item) : img(item), filename(item, i));
      await sleep(300);
    }
  }

  /* ---------- panel ---------- */

  function buildTray() {
    tray.textContent = "";
    for (const [i, item] of state.items.entries()) {
      const thumb = item.video_versions ? (item.thumbnail_url || img(item)) : img(item);
      tray.append(h("button", { class: "igsv-thumb" + (i === state.index ? " on" : ""), title: `Item ${i + 1} — ${stamp(item)}`, onclick: () => { show(i); openViewer(); } },
        h("img", { src: thumb, loading: "lazy", alt: "" }),
        item.video_versions ? h("span", { class: "igsv-vid" }, "▶") : null
      ));
    }
  }

  function build() {
    if (document.getElementById("igsv-panel")) return;
    panel = h("div", { id: "igsv-panel" },
      h("div", { class: "igsv-hdr" },
        h("span", { class: "igsv-dot" }),
        h("strong", {}, "Story viewer"),
        h("span", { class: "igsv-spacer" }),
        h("button", { class: "igsv-min", title: "Collapse", onclick: collapse }, "–"),
        h("button", { class: "igsv-x", title: "Hide", onclick: () => { panel.style.display = "none"; chip.style.display = "block"; } }, "×")
      ),
      h("div", { class: "igsv-body" },
        h("form", { class: "igsv-row", onsubmit: (e) => { e.preventDefault(); open(panel.querySelector("#igsv-user").value); } },
          h("input", { id: "igsv-user", type: "text", placeholder: "@username", autocomplete: "off" }),
          h("button", { class: "igsv-btn", type: "submit" }, "Load")
        ),
        h("div", { class: "igsv-row" },
          h("button", { class: "igsv-btn igsv-ghost", onclick: openViewer }, "Play"),
          h("button", { class: "igsv-btn igsv-ghost", onclick: downloadAll }, "Download all"),
          h("label", { class: "igsv-check" }, h("input", { type: "checkbox", onchange: (e) => (state.markSeen = e.target.checked) }), " mark seen")
        ),
        h("div", { class: "igsv-tray" }, tray = h("div", { class: "igsv-strip" })),
        h("div", { class: "igsv-log", id: "igsv-log" })
      )
    );
    Object.assign(panel.style, { position: "fixed", right: "18px", bottom: "18px", width: "360px", maxHeight: "70vh" });
    chip = h("button", { id: "igsv-chip", onclick: () => { chip.style.display = "none"; panel.style.display = "flex"; } }, "IG · story");
    document.body.append(panel, chip);
    chip.style.display = "none";
    drag(panel.querySelector(".igsv-hdr"), panel);
  }

  function collapse() {
    panel.classList.toggle("igsv-collapsed");
    panel.querySelector(".igsv-min").textContent = panel.classList.contains("igsv-collapsed") ? "+" : "–";
  }

  function drag(handle, box) {
    let on = false, sx = 0, sy = 0, ox = 0, oy = 0;
    handle.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      on = true; sx = e.clientX; sy = e.clientY;
      const r = box.getBoundingClientRect(); ox = r.left; oy = r.top;
      box.style.right = "auto"; box.style.bottom = "auto";
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener("pointermove", (e) => {
      if (!on) return;
      box.style.left = Math.max(0, Math.min(innerWidth - 60, ox + e.clientX - sx)) + "px";
      box.style.top = Math.max(0, Math.min(innerHeight - 40, oy + e.clientY - sy)) + "px";
    });
    handle.addEventListener("pointerup", () => (on = false));
  }

  /* ---------- route ---------- */

  function routeTick() {
    if (location.href === state.route) return;
    state.route = location.href;
    if (!document.getElementById("igsv-panel")) build();
    else if (!document.body.contains(panel)) document.body.append(panel, chip);
    if (overlay && !document.body.contains(overlay)) document.body.append(overlay);

    const story = location.pathname.match(/^\/stories\/([^/]+)\//);
    if (story) {
      const box = panel.querySelector("#igsv-user");
      if (box) box.value = "@" + story[1];
      if (!state.open && !state.items.length) open(story[1]);
      return;
    }
    const profile = location.pathname.match(/^\/([A-Za-z0-9._]+)\/?$/);
    if (profile && !["explore", "reels", "direct", "accounts"].includes(profile[1])) {
      const box = panel.querySelector("#igsv-user");
      if (box && !box.value) box.value = "@" + profile[1];
    }
  }

  function boot() {
    if (document.documentElement.dataset.igsvBooted) return;
    document.documentElement.dataset.igsvBooted = "1";
    document.head.append(h("style", {}, `
      #igsv-panel,#igsv-chip{font:12px/1.45 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#e8e8e8;background:#181818;border:1px solid #2c2c2c;border-radius:10px;box-shadow:0 12px 40px #000a;z-index:2147483000}
      #igsv-panel{display:flex;flex-direction:column;overflow:hidden;resize:both}
      #igsv-panel.igsv-collapsed{max-height:none}
      #igsv-panel.igsv-collapsed .igsv-body{display:none}
      .igsv-hdr{display:flex;align-items:center;gap:8px;padding:9px 10px;background:#111;border-bottom:1px solid #2c2c2c;cursor:grab;user-select:none}
      .igsv-dot{width:8px;height:8px;border-radius:50%;background:#065fd4;box-shadow:0 0 0 3px #065fd433}
      .igsv-spacer{flex:1}
      .igsv-hdr button{background:none;border:0;color:#aaa;font-size:15px;cursor:pointer}
      .igsv-body{display:flex;flex-direction:column;gap:8px;padding:10px;overflow:auto}
      .igsv-row{display:flex;gap:6px;align-items:center}
      #igsv-user{flex:1;background:#111;border:1px solid #333;color:#eee;border-radius:6px;padding:6px 8px;font-size:12px;outline:none}
      #igsv-user:focus{border-color:#065fd4}
      .igsv-btn{background:#065fd4;border:1px solid #065fd4;color:#fff;border-radius:6px;padding:6px 10px;font-size:11px;cursor:pointer}
      .igsv-ghost{background:#222;border-color:#333;color:#ddd}
      .igsv-check{display:flex;align-items:center;gap:4px;color:#9a9a9a;font-size:11px}
      .igsv-tray{min-height:64px}
      .igsv-strip{display:flex;gap:5px;overflow-x:auto;padding-bottom:4px}
      .igsv-thumb{position:relative;flex:0 0 auto;width:52px;height:74px;padding:0;border:2px solid transparent;border-radius:6px;overflow:hidden;background:#222;cursor:pointer}
      .igsv-thumb img{width:100%;height:100%;object-fit:cover}
      .igsv-thumb.on{border-color:#065fd4}
      .igsv-vid{position:absolute;right:2px;bottom:2px;background:#000a;border-radius:4px;padding:0 3px;font-size:9px;color:#fff}
      .igsv-log{height:90px;overflow:auto;background:#101010;border:1px solid #262626;border-radius:6px;padding:5px;font:10px/1.5 ui-monospace,Consolas,monospace}
      .igsv-good{color:#5fd68a}.igsv-bad{color:#ff7b72}.igsv-warn{color:#f0b429}
      #igsv-chip{position:fixed;right:18px;bottom:18px;display:none;background:#181818;color:#fff;border:1px solid #065fd4;border-radius:999px;padding:7px 12px;font-size:11px;cursor:pointer}
      #igsv-overlay{position:fixed;inset:0;z-index:2147483200;display:none;background:#000d;backdrop-filter:blur(3px)}
      #igsv-overlay.on{display:flex;flex-direction:column}
      .igsv-bar{display:flex;align-items:center;gap:8px;padding:10px 14px;color:#eee;font-size:13px}
      .igsv-bar .igsv-ico{background:#ffffff14;border:1px solid #ffffff22;color:#fff;border-radius:6px;width:30px;height:28px;cursor:pointer;font-size:15px}
      .igsv-progress{height:3px;background:#ffffff1f;margin:0 14px;border-radius:2px;overflow:hidden}
      .igsv-progress::after{content:"";display:block;height:100%;width:var(--p,0%);background:#065fd4;transition:width .2s}
      .igsv-stage{flex:1;display:flex;align-items:center;justify-content:center;min-height:0;padding:10px}
      .igsv-stage img,.igsv-stage video{max-width:100%;max-height:100%;object-fit:contain;border-radius:8px}
      .igsv-nav{position:absolute;top:50%;transform:translateY(-50%);background:#181818cc;border:1px solid #333;color:#fff;width:42px;height:42px;border-radius:50%;font-size:26px;line-height:1;cursor:pointer}
      .igsv-nav:disabled{opacity:.3}
      .igsv-prev{left:16px}.igsv-next{right:16px}
      .igsv-counter{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);background:#000a;color:#ddd;padding:3px 10px;border-radius:999px;font-size:11px}
    `));
    build();
    routeTick();
    new MutationObserver(() => {
      if (panel && !document.body.contains(panel) && document.body) document.body.append(panel);
    }).observe(document.documentElement, { childList: true, subtree: true });
    setInterval(routeTick, 800);

    document.addEventListener("keydown", (e) => {
      if (isTyping()) return;
      if (e.key === "Escape") { if (state.open) close(); else { panel.style.display = "none"; chip.style.display = "block"; } return; }
      if (!state.open) return;
      if (e.key === "ArrowLeft" || e.key.toLowerCase() === "j") { e.preventDefault(); show(state.index - 1); }
      else if (e.key === "ArrowRight" || e.key.toLowerCase() === "k" || e.key === " ") { e.preventDefault(); show(state.index + 1); }
      else if (e.key.toLowerCase() === "d") { e.preventDefault(); download(state.index); }
    }, true);
  }

  boot();
})();
