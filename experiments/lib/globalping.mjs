// Minimal Globalping API client. Node >= 18, no dependencies.
// API: https://globalping.io/docs/api.globalping.io   Limits: https://globalping.io/credits
//
// The response field names used below (results[].probe, results[].result.timings, .headers,
// .statusCode, .rawBody, ping .stats) follow Globalping's v1 API as I understand it. E00 prints a raw
// result so you can confirm them; extract() throws a clear error if a field is missing instead of
// silently writing zeros.

const API = process.env.GLOBALPING_API || "https://api.globalping.io/v1";
const TOKEN = process.env.GLOBALPING_TOKEN || "";
const MAX_PROBES_ANON = 50;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function headers() {
  const h = { "content-type": "application/json", "user-agent": "thareqyusuf.com-lab/1" };
  if (TOKEN) h.authorization = `Bearer ${TOKEN}`;
  return h;
}

export async function create(body) {
  const res = await fetch(`${API}/measurements`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new Error(`Globalping create failed: HTTP ${res.status}: ${text}`);
  const j = JSON.parse(text);
  const left = res.headers.get("x-ratelimit-remaining");
  if (left !== null) process.stderr.write(`  globalping: ${left} tests left this hour\n`);
  return j.id;
}

export async function wait(id, { timeoutMs = 90_000 } = {}) {
  const t0 = Date.now();
  for (;;) {
    const res = await fetch(`${API}/measurements/${id}`, { headers: headers() });
    if (!res.ok) throw new Error(`Globalping get ${id} failed: HTTP ${res.status}`);
    const j = await res.json();
    if (j.status !== "in-progress") return j;
    if (Date.now() - t0 > timeoutMs) throw new Error(`Globalping ${id} still in progress after ${timeoutMs} ms`);
    await sleep(700);
  }
}

export async function run(body) {
  const id = await create(body);
  return wait(id);
}

// Split [{magic, limit}] into batches whose total limit stays under the per-measurement cap.
export function batches(locations, cap = TOKEN ? 500 : MAX_PROBES_ANON) {
  const out = [];
  let cur = [], n = 0;
  for (const loc of locations) {
    if (n + loc.limit > cap && cur.length) { out.push(cur); cur = []; n = 0; }
    cur.push(loc); n += loc.limit;
  }
  if (cur.length) out.push(cur);
  return out;
}

// HTTP measurement. `locations` is either [{magic, limit}] or a previous measurement id (string),
// which asks Globalping to reuse exactly the same probes.
export function httpBody({ host, path = "/", method = "GET", locations }) {
  return {
    type: "http",
    target: host,
    locations,
    measurementOptions: { protocol: "HTTPS", port: 443, request: { method, path } },
  };
}

export function pingBody({ target, locations, packets = 16 }) {
  return { type: "ping", target, locations, measurementOptions: { packets } };
}

const lower = (obj = {}) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v.join(", ") : v]));

function need(v, what) {
  if (v === undefined) throw new Error(`Globalping result is missing ${what}. Run E00 and check the raw JSON; field names may differ from what lib/globalping.mjs expects.`);
  return v;
}

// Flatten one HTTP result into the fields every experiment uses.
export function extractHttp(entry) {
  const p = need(entry.probe, "probe");
  const r = need(entry.result, "result");
  if (r.status === "failed") return { city: p.city, country: p.country, asn: p.asn, network: p.network, failed: true, error: r.rawOutput?.slice(0, 200) };
  const t = need(r.timings, "result.timings");
  const h = lower(r.headers);
  const ray = h["cf-ray"] || "";
  const build = (r.rawBody || "").match(/build ([0-9a-f]{7}|dev)/)?.[1];
  let probe = null;
  if ((r.rawBody || "").startsWith("{")) { try { probe = JSON.parse(r.rawBody); } catch { /* not the probe endpoint */ } }
  return {
    city: p.city, country: p.country, continent: p.continent, asn: p.asn, network: p.network,
    status: r.statusCode, cache: h["cf-cache-status"] || null, age: h["age"] ? Number(h["age"]) : null,
    pop: ray.includes("-") ? ray.split("-").pop() : null,
    dns: t.dns, tcp: need(t.tcp, "timings.tcp"), tls: t.tls, ttfb: need(t.firstByte, "timings.firstByte"),
    download: t.download, total: t.total, build, origin_srtt_ms: probe?.srtt_us ? probe.srtt_us / 1000 : null,
  };
}

export function extractPing(entry) {
  const p = need(entry.probe, "probe");
  const s = entry.result?.stats || {};
  return { city: p.city, country: p.country, asn: p.asn, network: p.network, min: s.min, avg: s.avg, max: s.max, loss: s.loss };
}
