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

/* ------------------------------------------------------------------ boot */

clock();
life();
b64();
// Measure after load so the probe doesn't compete with the page it's measuring.
if (document.readyState === "complete") probe();
else addEventListener("load", () => setTimeout(probe, 50), { once: true });
