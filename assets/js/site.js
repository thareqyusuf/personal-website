// Site behaviour. No dependencies; bundled and minified by Hugo (js.Build).
// Every feature degrades to static content when JS is off or a measurement isn't available.

const cfg = (() => {
  try { return JSON.parse(document.getElementById("site-cfg").textContent); }
  catch { return { tz: "UTC", tzLabel: "UTC" }; }
})();

/* ------------------------------------------------------------------ probe */

const COLO = {
  CGK: "Jakarta", SUB: "Surabaya", DPS: "Denpasar", SIN: "Singapore", KUL: "Kuala Lumpur",
  BKK: "Bangkok", MNL: "Manila", SGN: "Ho Chi Minh City", HAN: "Hanoi", HKG: "Hong Kong",
  NRT: "Tokyo", KIX: "Osaka", ICN: "Seoul", TPE: "Taipei", SYD: "Sydney", MEL: "Melbourne",
  PER: "Perth", AKL: "Auckland", BOM: "Mumbai", DEL: "Delhi", MAA: "Chennai", DXB: "Dubai",
  FRA: "Frankfurt", AMS: "Amsterdam", LHR: "London", CDG: "Paris", MAD: "Madrid", ARN: "Stockholm",
  IAD: "Ashburn", EWR: "Newark", ORD: "Chicago", DFW: "Dallas", ATL: "Atlanta", LAX: "Los Angeles",
  SJC: "San Jose", SEA: "Seattle", YYZ: "Toronto", GRU: "São Paulo", JNB: "Johannesburg",
};

const fmtMs = (ms) =>
  ms == null || !isFinite(ms) ? "—"
  : ms < 1 ? `${Math.round(ms * 1000)} µs`
  : ms < 10 ? `${ms.toFixed(1)} ms`
  : `${Math.round(ms)} ms`;

function fmtHumanSeconds(s) {
  const units = [
    ["year", 365.25 * 86400], ["month", 30.44 * 86400], ["day", 86400],
    ["hour", 3600], ["minute", 60], ["second", 1],
  ];
  for (const [name, size] of units) {
    if (s >= size) {
      const v = s / size;
      const shown = v >= 10 ? Math.round(v) : Math.round(v * 10) / 10;
      return `${shown} ${name}${shown === 1 ? "" : "s"}`;
    }
  }
  return `${s.toFixed(2)} seconds`;
}

// Parse a Server-Timing `desc` that is a query string, e.g. cfL4;desc="?proto=TCP&rtt=7337&min_rtt=6855"
function parseDescQuery(desc) {
  const out = {};
  (desc || "").replace(/^\?/, "").split("&").forEach((kv) => {
    const [k, v] = kv.split("=");
    if (k) out[k] = v;
  });
  return out;
}

// Fetch `url` n times in sequence on the already-warm connection and keep the fastest
// request→first-byte time. Minimum, not median: queueing and timers only ever add.
async function sampleMin(url, n) {
  let best = Infinity, last = null;
  for (let i = 0; i < n; i++) {
    const u = new URL(url, location.href);
    u.searchParams.set("_", `${Date.now()}${i}`);
    const t0 = performance.now();
    const res = await fetch(u, { cache: "no-store", credentials: "omit" });
    const body = await res.text();
    const t1 = performance.now();
    if (!res.ok) return { ok: false, status: res.status };
    const e = performance.getEntriesByName(u.href).pop();
    const d = e && e.requestStart > 0 && e.responseStart > 0 ? e.responseStart - e.requestStart : t1 - t0;
    best = Math.min(best, d);
    last = { res, body };
  }
  return { ok: true, ms: best, ...last };
}

async function probe() {
  const root = document.querySelector(".probe");
  if (!root) return;
  const set = (k, v) => root.querySelectorAll(`[data-k="${k}"]`).forEach((el) => (el.textContent = v));

  // 1. This page load, from Navigation Timing.
  const nav = performance.getEntriesByType("navigation")[0];
  if (nav && nav.responseStart > 0) set("ttfb", fmtMs(nav.responseStart - nav.requestStart));
  const proto = nav && nav.nextHopProtocol;
  if (proto) set("proto", proto === "http/1.1" ? "h1.1" : proto);

  let rtt = null, rttSource = "";
  const cfL4 = nav && (nav.serverTiming || []).find((s) => s.name === "cfL4");
  if (cfL4) {
    const q = parseDescQuery(cfL4.description);
    const us = Number(q.min_rtt || q.rtt);
    if (us > 0) { rtt = us / 1000; rttSource = `${q.proto || "transport"} RTT, measured by the edge`; }
  }

  // 2. Which edge served us. /cdn-cgi/trace only exists behind Cloudflare.
  let edge = null;
  try {
    const r = await fetch("/cdn-cgi/trace", { cache: "no-store" });
    const t = r.ok ? await r.text() : "";
    if (t.includes("colo=")) edge = Object.fromEntries(t.trim().split("\n").map((l) => l.split("=")));
  } catch { /* not behind Cloudflare */ }

  if (edge) {
    set("colo", edge.colo);
    set("colo-note", COLO[edge.colo] ? `${COLO[edge.colo]}, for a reader in ${edge.loc}` : `for a reader in ${edge.loc}`);
    if (edge.tls) set("tls", edge.tls.replace("TLSv", "TLS "));
    if (rtt == null) {
      const s = await sampleMin("/cdn-cgi/trace", 5).catch(() => null);
      if (s && s.ok) { rtt = s.ms; rttSource = "http, fastest of 5"; }
    }
  } else {
    set("colo", "origin");
    set("colo-note", "no edge in front of this request");
  }

  // 3. The origin's view: nginx reports the kernel's smoothed RTT for the socket it was reached on.
  //    Behind the edge, that socket is edge→origin. Without an edge, it's you→origin.
  try {
    const r = await fetch(`/__probe?_=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    const p = await r.json();
    const ms = Number(p.srtt_us) / 1000;
    if (edge) {
      set("origin", fmtMs(ms));
      set("origin-note", `${p.origin || cfg.originName}, kernel srtt`);
    } else {
      set("origin", "direct");
      set("origin-note", p.origin || cfg.originName);
      if (rtt == null && ms > 0) { rtt = ms; rttSource = "TCP srtt, measured by the origin"; }
    }
  } catch {
    set("origin", "—");
    set("origin-note", "probe endpoint not reachable");
  }

  if (rtt == null) {
    const s = await sampleMin(location.pathname, 3).catch(() => null);
    if (s && s.ok) { rtt = s.ms; rttSource = "http, fastest of 3"; }
  }
  set("rtt", fmtMs(rtt));
  if (rttSource) set("rtt-note", rttSource);

  // 4. Edge cache state for this URL.
  try {
    const r = await fetch(location.pathname, { method: "HEAD", cache: "no-store" });
    const st = r.headers.get("cf-cache-status");
    const age = r.headers.get("age");
    set("cache", st ? st.toLowerCase() : "none");
    set("age", st ? (age ? `copy is ${fmtHumanSeconds(Number(age))} old` : "for this URL") : "nothing cached in front");
  } catch { set("cache", "—"); }

  root.dataset.state = "done";
}

/* ------------------------------------------------------------------ clock */

function clock() {
  const el = document.querySelector("[data-clock]");
  if (!el) return;
  const dateEl = document.querySelector("[data-clock-date]");
  const noteEl = document.querySelector("[data-clock-note]");
  const tz = cfg.tz || "UTC";
  const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const dateFmt = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "long", day: "numeric", month: "short", year: "numeric" });
  const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "numeric", hour12: false });

  // Offset of the author's zone vs the reader's, in hours.
  const offsetOf = (zone) => {
    const now = new Date();
    const a = new Date(now.toLocaleString("en-US", { timeZone: zone }));
    const b = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
    return (a - b) / 36e5;
  };
  const diff = offsetOf(tz) - -new Date().getTimezoneOffset() / 60;

  const tick = () => {
    const now = new Date();
    el.textContent = timeFmt.format(now);
    if (dateEl) dateEl.textContent = dateFmt.format(now);
    if (noteEl) {
      const h = Number(hourFmt.format(now));
      const rel = diff === 0 ? "Same time zone as you." : `${Math.abs(diff)} h ${diff > 0 ? "ahead of" : "behind"} you.`;
      noteEl.textContent = `${rel} ${h >= 23 || h < 7 ? "I'm probably asleep." : "I'm probably around."}`;
    }
  };
  tick();
  setInterval(tick, 1000);
}

/* ------------------------------------------------------------------ life */

function life() {
  const canvas = document.querySelector("[data-life]");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const CELL = 5;
  const W = Math.floor(canvas.width / CELL), H = Math.floor(canvas.height / CELL);
  let grid = new Uint8Array(W * H);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const ink = () => getComputedStyle(canvas).getPropertyValue("--life-ink").trim() || "#000";

  const glider = (x, y, flip) => {
    const pts = flip ? [[1,0],[0,1],[0,2],[1,2],[2,2]] : [[1,0],[2,1],[0,2],[1,2],[2,2]];
    pts.forEach(([dx, dy]) => (grid[((y + dy) % H) * W + ((x + dx) % W)] = 1));
  };
  const seed = () => {
    grid = new Uint8Array(W * H);
    for (let i = 0; i < 5; i++) glider((Math.random() * W) | 0, (Math.random() * H) | 0, Math.random() < 0.5);
    for (let i = 0; i < W * H * 0.08; i++) grid[(Math.random() * W * H) | 0] = 1;
  };
  const step = () => {
    const next = new Uint8Array(W * H);
    let changed = 0, alive = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (dx || dy) n += grid[((y + dy + H) % H) * W + ((x + dx + W) % W)];
      }
      const i = y * W + x, v = grid[i] ? (n === 2 || n === 3) : n === 3;
      next[i] = v ? 1 : 0; alive += next[i]; changed += next[i] !== grid[i];
    }
    grid = next;
    return { changed, alive };
  };
  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = ink();
    for (let i = 0; i < W * H; i++) if (grid[i]) ctx.fillRect((i % W) * CELL, ((i / W) | 0) * CELL, CELL - 1, CELL - 1);
  };

  seed(); for (let i = 0; i < 6; i++) step(); draw();
  canvas.addEventListener("click", () => { seed(); draw(); });
  if (reduce) return; // one still frame; click still reseeds

  let visible = true, quiet = 0;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);
  setInterval(() => {
    if (!visible || document.hidden) return;
    const { changed, alive } = step();
    quiet = changed < 4 ? quiet + 1 : 0;
    if (alive === 0 || quiet > 40) seed(); // reseed when it settles into still life
    draw();
  }, 160);
}

/* ------------------------------------------------------------------ email */

function b64() {
  document.querySelectorAll("[data-b64]").forEach((box) => {
    const btn = box.querySelector("button");
    btn?.addEventListener("click", () => {
      const addr = atob(box.dataset.b64);
      const a = document.createElement("a");
      a.href = `mailto:${addr}`; a.textContent = addr; a.className = "b64-out";
      box.querySelector(".b64-blob").replaceWith(a);
      btn.remove();
      a.focus();
    });
  });
}

/* --------------------------------------------------------------- preview */
// Preview 1.0. Footnotes, pages on this site and annotated references open in a bordered
// box next to the link on hover or keyboard focus. On touch screens and narrow windows,
// footnotes and references expand inline under their paragraph instead, and page links
// just navigate. Pages are fetched from this origin only and cut to the linked section.
// Nothing here is needed to read the page: without JS, footnotes jump and the
// bibliography at the end of the page holds every note.

function preview() {
  const root = document.querySelector("main");
  if (!root) return;
  const SEL = "a.footnote-ref, a[data-pv-title], a[data-ann], a[href^='#']:not(.footnote-backref)";
  const HEAD = /^H[1-6]$/;
  const pages = new Map();
  let box = null, owner = null, timer = 0;

  const el = (tag, cls, html) => { const e = document.createElement(tag); e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = (s) => { const d = document.createElement("i"); d.textContent = s; return d.innerHTML; };
  const narrow = () => matchMedia("(hover: none), (max-width: 720px)").matches;
  const later = (fn, ms = 250) => { clearTimeout(timer); timer = setTimeout(fn, ms); };

  // A heading plus everything up to the next heading of the same or a higher level.
  const section = (doc, id) => {
    const h = doc.getElementById(id);
    if (!h) return null;
    if (!HEAD.test(h.tagName)) return h.outerHTML;
    let html = h.outerHTML;
    for (let n = h.nextElementSibling; n && !(HEAD.test(n.tagName) && n.tagName <= h.tagName); n = n.nextElementSibling) html += n.outerHTML;
    return html;
  };
  const page = (path) => {
    if (!pages.has(path)) {
      pages.set(path, fetch(path, { credentials: "omit" })
        .then((r) => (r.ok ? r.text() : Promise.reject(r.status)))
        .then((t) => new DOMParser().parseFromString(t, "text/html")));
    }
    return pages.get(path);
  };

  // What the box shows for a link: { kind, html }, or null when there is nothing to show.
  async function fill(a) {
    const id = decodeURIComponent(a.hash.slice(1));
    const d = a.dataset;
    if (a.classList.contains("footnote-ref")) {
      const li = document.getElementById(id);
      if (!li) return null;
      const c = li.cloneNode(true);
      c.querySelectorAll(".footnote-backref").forEach((e) => e.remove());
      return { kind: `Footnote ${a.textContent}`, html: c.innerHTML };
    }
    if (d.ann) {
      const li = document.getElementById(`ann-${d.ann}`);
      return li ? { kind: "Reference", html: li.innerHTML } : null;
    }
    if (d.pvTitle !== undefined) {
      let html = `<p><strong>${esc(d.pvTitle)}</strong>${d.pvMeta ? `<span class="pv-meta">${esc(d.pvMeta)}</span>` : ""}</p>`
        + (d.pvDesc ? `<p>${esc(d.pvDesc)}</p>` : "");
      if (id) { try { html = section(await page(a.pathname), id) || html; } catch { /* summary is enough */ } }
      return { kind: "On this site", html };
    }
    const s = id && section(document, id);
    return s ? { kind: "On this page", html: s } : null;
  }

  function close() {
    clearTimeout(timer);
    if (box) { box.remove(); box = null; }
    if (owner) { owner.removeAttribute("aria-describedby"); owner = null; }
  }
  function place(a) {
    const r = a.getBoundingClientRect(), w = box.offsetWidth, h = box.offsetHeight;
    const x = Math.max(16, Math.min(r.left, document.documentElement.clientWidth - w - 16));
    const below = r.bottom + 8 + h <= innerHeight || r.top < h + 8;
    box.style.left = `${x + scrollX}px`;
    box.style.top = `${(below ? r.bottom + 8 : r.top - 8 - h) + scrollY}px`;
  }
  async function open(a, inline) {
    close();
    owner = a;
    const f = await fill(a).catch(() => null);
    if (owner !== a) return;
    if (!f) { owner = null; return; }
    box = el("aside", inline ? "pv pv-in" : "pv");
    box.id = "pv";
    const head = el("div", "pv-head", `<span>${esc(f.kind)}</span>`);
    const body = el("div", "pv-body", f.html);
    body.querySelectorAll("[id]").forEach((e) => e.removeAttribute("id"));
    box.append(head, body);
    if (inline) {
      const btn = el("button", "pv-close", "Close");
      btn.type = "button";
      btn.addEventListener("click", () => { close(); a.focus(); });
      head.append(btn);
      const blk = a.closest("p, li, dd, h2, h3, h4");
      if (!blk) a.after(box); else if (blk.tagName === "LI") blk.append(box); else blk.after(box);
    } else {
      box.addEventListener("mouseenter", () => clearTimeout(timer));
      box.addEventListener("mouseleave", () => later(close));
      box.addEventListener("focusin", () => clearTimeout(timer));
      box.addEventListener("focusout", (e) => { if (!box.contains(e.relatedTarget)) later(close); });
      document.body.append(box);
      place(a);
    }
    a.setAttribute("aria-describedby", "pv");
  }

  root.querySelectorAll(SEL).forEach((a) => {
    a.addEventListener("mouseenter", () => { if (!narrow()) later(() => open(a, false), 350); });
    a.addEventListener("mouseleave", () => later(close));
    a.addEventListener("focus", () => { if (!narrow()) open(a, false); });
    a.addEventListener("blur", () => later(close));
    a.addEventListener("click", (e) => {
      if (!narrow() || !(a.classList.contains("footnote-ref") || a.dataset.ann)) return;
      e.preventDefault();
      if (owner === a) close(); else open(a, true);
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && box) { const a = owner; close(); a.focus(); }
  });
}

/* ------------------------------------------------------------------ boot */

clock();
life();
b64();
preview();
// Measure after load so the probe doesn't compete with the page it's measuring.
if (document.readyState === "complete") probe();
else addEventListener("load", () => setTimeout(probe, 50), { once: true });
