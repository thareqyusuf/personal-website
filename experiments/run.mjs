#!/usr/bin/env node
// Runner for the Globalping-based experiments. Node >= 18, no npm install needed.
//
//   node experiments/run.mjs e00 [--from Jakarta] [--curl results.csv]   calibrate instruments
//   node experiments/run.mjs e01                                         edge latency map
//   node experiments/run.mjs e02                                         e01 + cost of a cache miss
//   node experiments/run.mjs e03 [--purge]                               cold start after purge/deploy
//   node experiments/run.mjs e04 --start | (no flag = tick)               cache retention over a week
//   node experiments/run.mjs e07                                         ping: origin vs edge (needs ORIGIN_IP)
//   add --dry-run to print the API requests without sending them
//
// Env: GLOBALPING_TOKEN (optional, doubles the hourly budget), ORIGIN_IP (e07; also redacted
// from every file written), CF_API_TOKEN + CF_ZONE_ID (e03 --purge).

import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as gp from "./lib/globalping.mjs";
import { ROOT, stamp, context, saveRaw, saveSummary, expDir, median, ms, mode, groupBy } from "./lib/results.mjs";

const cfg = JSON.parse(readFileSync(join(ROOT, "experiments/config.json"), "utf8"));
const argv = process.argv.slice(2);
const id = argv[0];
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, dflt) => { const i = argv.indexOf(`--${name}`); return i > -1 ? argv[i + 1] : dflt; };
const DRY = flag("dry-run");
const N = Number(opt("probes", cfg.probes_per_city));

async function measure(body) {
  if (DRY) { console.log(JSON.stringify(body)); return { id: "dry-run", results: [] }; }
  return gp.run(body);
}

const regionOf = (city = "") =>
  cfg.cities.find((c) => city.toLowerCase().includes(c.magic.toLowerCase()) || c.magic.toLowerCase().includes(city.toLowerCase()))?.region;
// Position of a probe's city in config.json, so tables follow the configured order (by region).
const orderOf = (city = "") => {
  const i = cfg.cities.findIndex((c) => city.toLowerCase().includes(c.magic.toLowerCase()) || c.magic.toLowerCase().includes(city.toLowerCase()));
  return i < 0 ? 999 : i;
};
const probeKey = (e) => [e.probe?.city, e.probe?.asn, e.probe?.network, e.probe?.latitude, e.probe?.longitude].join("|");

// Run `path` on the same probes as an earlier measurement if Globalping accepts that, else on `locs`.
async function again(prev, locs, path, notes) {
  if (DRY) return measure(gp.httpBody({ host: cfg.host, path, locations: prev.id }));
  try { return await measure(gp.httpBody({ host: cfg.host, path, locations: prev.id })); }
  catch (e) {
    notes.add(`Probe reuse was refused (${String(e.message).slice(0, 80)}); later rounds used new probes in the same cities.`);
    return measure(gp.httpBody({ host: cfg.host, path, locations: locs }));
  }
}

// ---------------------------------------------------------------- E01 / E02: edge map
async function edgeMap(withProbe) {
  const locs = cfg.cities.map((c) => ({ magic: c.magic, limit: N }));
  const notes = new Set();
  const raw = { context: context({ experiment: withProbe ? "e02" : "e01", probes_per_city: N }), batches: [] };
  const rows = [];
  for (const batch of gp.batches(locs)) {
    console.error(`  batch: ${batch.map((b) => b.magic).join(", ")}`);
    const r1 = await measure(gp.httpBody({ host: cfg.host, path: "/", locations: batch }));
    const r2 = await again(r1, batch, "/", notes);
    const r3 = withProbe ? await again(r1, batch, "/__probe", notes) : null;
    raw.batches.push({ batch, r1, r2, r3 });
    const by2 = new Map(r2.results.map((e) => [probeKey(e), e]));
    const by3 = new Map((r3?.results || []).map((e) => [probeKey(e), e]));
    for (const e1 of r1.results) {
      const k = probeKey(e1);
      const a = gp.extractHttp(e1), b = by2.has(k) ? gp.extractHttp(by2.get(k)) : null, c = by3.has(k) ? gp.extractHttp(by3.get(k)) : null;
      rows.push({ a, b, c });
    }
  }
  if (DRY) return;
  const s = stamp();
  saveRaw(withProbe ? "e02" : "e01", s, raw);

  const ok = rows.filter((r) => r.b && !r.b.failed);
  const failed = rows.length - ok.length;
  if (failed) notes.add(`${failed} of ${rows.length} probes failed or could not be matched across rounds; they are excluded.`);
  const builds = [...new Set(ok.map((r) => r.b.build).filter(Boolean))];
  const groups = [...groupBy(ok, (r) => `${r.b.city}, ${r.b.country}`).entries()]
    .sort((x, y) => orderOf(x[1][0].b.city) - orderOf(y[1][0].b.city) || x[0].localeCompare(y[0]));

  const e01 = {
    caption: "Second request from each probe (the first one warms that PoP). RTT is the TCP handshake time. Values are medians across probes in that city.",
    columns: ["Region", "City", "PoP", "Cache", "RTT ms", "TLS ms", "TTFB ms", "Probes"],
    rows: groups.map(([city, rs]) => [
      regionOf(rs[0].b.city) || rs[0].b.continent || "", city, mode(rs.map((r) => r.b.pop)), mode(rs.map((r) => r.b.cache)),
      ms(median(rs.map((r) => r.b.tcp))), ms(median(rs.map((r) => r.b.tls))), ms(median(rs.map((r) => r.b.ttfb))), rs.length,
    ]),
  };
  const first = {
    caption: "First request from each probe, before it warmed anything. MISS here means that PoP did not have the page.",
    columns: ["City", "PoP", "Cache", "TTFB ms"],
    rows: groups.map(([city, rs]) => [city, mode(rs.map((r) => r.a.pop)), mode(rs.map((r) => r.a.cache)), ms(median(rs.map((r) => r.a.ttfb)))]),
  };
  const base = { run_at: raw.context.run_at, build: builds.join(", ") || null, tool: "Globalping HTTP (HTTPS GET)", notes: [...notes] };
  saveSummary("e01", s, { title: "Edge latency map", ...base, tables: [e01, first] });

  if (withProbe) {
    const e02 = {
      caption: "/__probe is never cached, so it always travels to the droplet. Miss penalty = TTFB(/__probe) − TTFB(/ from cache), same probe. Last hop = droplet's kernel srtt to Cloudflare.",
      columns: ["Region", "City", "PoP", "TTFB cached ms", "TTFB /__probe ms", "Miss penalty ms", "Last hop ms"],
      rows: groups.map(([city, rs]) => {
        const both = rs.filter((r) => r.c && !r.c.failed);
        return [
          regionOf(rs[0].b.city) || "", city, mode(rs.map((r) => r.b.pop)),
          ms(median(rs.map((r) => r.b.ttfb))), ms(median(both.map((r) => r.c.ttfb))),
          ms(median(both.map((r) => r.c.ttfb - r.b.ttfb))), ms(median(both.map((r) => r.c.origin_srtt_ms))),
        ];
      }),
    };
    saveSummary("e02", s, { title: "Cost of a cache miss", ...base, tables: [e02] });
  }
}

// ---------------------------------------------------------------- E00: calibrate
async function e00() {
  const from = opt("from", "Jakarta");
  const locs = [{ magic: from, limit: 3 }];
  const r1 = await measure(gp.httpBody({ host: cfg.host, path: "/", locations: locs }));
  if (DRY) return;
  const r2 = await again(r1, locs, "/", new Set()); // second request = warm PoP, same probes
  console.log("\nFirst raw result (check these field names against lib/globalping.mjs):\n");
  console.log(JSON.stringify(r2.results[0], (k, v) => (k === "rawBody" || k === "rawHeaders" || k === "rawOutput" ? `<${String(v).length} chars>` : v), 2));
  const s = stamp();
  saveRaw("e00", s, { context: context({ experiment: "e00", from }), r1, r2 });
  const rows = r2.results.map(gp.extractHttp).filter((r) => !r.failed);
  const t1 = {
    caption: `Globalping, ${from}: do the phases add up? If dns+tcp+tls+firstByte+download ≈ total, firstByte excludes the handshakes.`,
    columns: ["Probe network", "PoP", "Cache", "DNS", "TCP", "TLS", "First byte", "Download", "Sum of phases", "Total"],
    rows: rows.map((r) => [r.network, r.pop, r.cache, r.dns, r.tcp, r.tls, r.ttfb, r.download, (r.dns ?? 0) + r.tcp + (r.tls ?? 0) + r.ttfb + (r.download ?? 0), r.total]),
  };
  const tables = [t1];
  const csv = opt("curl");
  if (csv && existsSync(csv)) {
    const lines = readFileSync(csv, "utf8").trim().split("\n");
    const head = lines.shift().split(",");
    const col = (name) => lines.map((l) => Number(l.split(",")[head.indexOf(name)]) * 1000);
    tables.push({
      caption: `curl from your machine, ${lines.length} requests (medians). tcp = connect − dns, tls = appconnect − connect, ttfb = starttransfer − appconnect.`,
      columns: ["Path", "DNS", "TCP (RTT)", "TLS", "TTFB after handshake", "Total"],
      rows: [...groupBy(lines.map((l, i) => ({ l, i })), (x) => x.l.split(",")[head.indexOf("path")]).keys()].map((p) => {
        const idx = lines.map((l, i) => (l.split(",")[head.indexOf("path")] === p ? i : -1)).filter((i) => i > -1);
        const pick = (name) => idx.map((i) => col(name)[i]);
        const dns = pick("dns"), con = pick("connect"), app = pick("appconnect"), st = pick("starttransfer"), tot = pick("total");
        return [p, ms(median(dns)), ms(median(con.map((c, i) => c - dns[i]))), ms(median(app.map((a, i) => a - con[i]))), ms(median(st.map((x, i) => x - app[i]))), ms(median(tot))];
      }),
    });
  }
  saveSummary("e00", s, { title: "Instrument calibration", run_at: new Date().toISOString(), tool: "Globalping HTTP, curl", notes: ["Footer probe readings are recorded by hand in the notes of this file."], tables });
}

// ---------------------------------------------------------------- E03: cold start
async function e03() {
  if (flag("purge") && !DRY) {
    const { CF_API_TOKEN, CF_ZONE_ID } = process.env;
    if (!CF_API_TOKEN || !CF_ZONE_ID) throw new Error("--purge needs CF_API_TOKEN and CF_ZONE_ID");
    const r = await fetch(`https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache`, {
      method: "POST", headers: { authorization: `Bearer ${CF_API_TOKEN}`, "content-type": "application/json" }, body: JSON.stringify({ purge_everything: true }),
    });
    if (!(await r.json()).success) throw new Error("purge failed");
    console.error("  purged; waiting 10 s for it to propagate");
    await new Promise((r) => setTimeout(r, 10_000));
  }
  const locs = cfg.cities.map((c) => ({ magic: c.magic, limit: 1 }));
  const notes = new Set(["Run immediately after a purge or deploy; otherwise the first request is not cold."]);
  const raw = { context: context({ experiment: "e03", purged_by_script: flag("purge") }), batches: [] };
  const rows = [];
  for (const batch of gp.batches(locs)) {
    const r1 = await measure(gp.httpBody({ host: cfg.host, path: "/", locations: batch }));
    const r2 = await again(r1, batch, "/", notes);
    raw.batches.push({ r1, r2 });
    const by2 = new Map(r2.results.map((e) => [probeKey(e), e]));
    for (const e of r1.results) rows.push({ a: gp.extractHttp(e), b: by2.has(probeKey(e)) ? gp.extractHttp(by2.get(probeKey(e))) : null });
  }
  if (DRY) return;
  const s = stamp();
  saveRaw("e03", s, raw);
  const ok = rows.filter((r) => r.b && !r.a.failed && !r.b.failed);
  saveSummary("e03", s, {
    title: "Cold start after a purge", run_at: raw.context.run_at, tool: "Globalping HTTP", notes: [...notes],
    tables: [{
      caption: "Same probe, two requests seconds apart. Cold penalty = first TTFB − second TTFB. Cities are in request order: the first city to miss pays for the upper tier too.",
      columns: ["City", "PoP", "1st cache", "1st TTFB ms", "2nd cache", "2nd TTFB ms", "Cold penalty ms"],
      rows: ok.map((r) => [`${r.a.city}, ${r.a.country}`, r.a.pop, r.a.cache, ms(r.a.ttfb), r.b.cache, ms(r.b.ttfb), ms(r.a.ttfb - r.b.ttfb)]),
    }],
  });
}

// ---------------------------------------------------------------- E04: retention
// Geometric schedule: checks at 1, 3, 7, 15, 31, 63, 127 h after start, so idle gaps double
// (1, 2, 4, … 64 h). Each check is itself a request, so it measures "does the page survive an idle gap
// of X hours at this PoP", which is exactly what a sporadic reader experiences.
const SCHEDULE_H = [1, 3, 7, 15, 31, 63, 127];
async function e04() {
  const dir = expDir("e04"), statePath = join(dir, "state.json");
  const locs = cfg.retention_cities.map((m) => ({ magic: m, limit: 1 }));
  if (flag("start")) {
    const r0 = await measure(gp.httpBody({ host: cfg.host, path: "/", locations: locs }));
    if (DRY) return;
    const base = r0.results.map(gp.extractHttp);
    const state = {
      started_at: new Date().toISOString(), stamp: stamp(), anchor_id: r0.id, build_at_start: base.find((r) => r.build)?.build || null,
      schedule_h: SCHEDULE_H, done: [], last_seen: Object.fromEntries(base.map((r) => [`${r.city}, ${r.country}`, { at: new Date().toISOString(), pop: r.pop }])), obs: [],
    };
    writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n");
    saveRaw("e04", `${state.stamp}-start`, { context: context({ experiment: "e04" }), r0 });
    console.error(`  started; next check in ${SCHEDULE_H[0]} h. Don't deploy or purge until ${SCHEDULE_H.at(-1)} h from now.`);
    return;
  }
  if (!existsSync(statePath)) throw new Error("run with --start first");
  const st = JSON.parse(readFileSync(statePath, "utf8"));
  const elapsedH = (Date.now() - Date.parse(st.started_at)) / 3.6e6;
  const due = SCHEDULE_H.filter((h) => h <= elapsedH && !st.done.includes(h));
  if (!due.length) { console.error(`  nothing due (${elapsedH.toFixed(1)} h elapsed)`); return; }
  const h = due.at(-1);
  let res;
  try { res = await measure(gp.httpBody({ host: cfg.host, path: "/", locations: st.anchor_id })); }
  catch { res = await measure(gp.httpBody({ host: cfg.host, path: "/", locations: locs })); }
  if (DRY) return;
  const now = new Date().toISOString();
  for (const r of res.results.map(gp.extractHttp).filter((r) => !r.failed)) {
    const key = `${r.city}, ${r.country}`, prev = st.last_seen[key];
    const gap = prev ? (Date.now() - Date.parse(prev.at)) / 3.6e6 : null;
    st.obs.push({ at: now, check_h: h, city: key, gap_h: gap && Math.round(gap * 10) / 10, pop: r.pop, cache: r.cache, age: r.age, build: r.build,
      valid: !st.build_at_start || r.build === st.build_at_start });
    st.last_seen[key] = { at: now, pop: r.pop };
  }
  st.done.push(...due);
  writeFileSync(statePath, JSON.stringify(st, null, 2) + "\n");
  saveRaw("e04", `${st.stamp}-check-${h}h`, { context: context({ experiment: "e04", check_h: h }), res });
  const cities = [...groupBy(st.obs, (o) => o.city).entries()];
  saveSummary("e04", st.stamp, {
    title: "Cache retention on a low-traffic site", run_at: st.started_at, build: st.build_at_start, tool: "Globalping HTTP, scheduled",
    notes: [`Checks done: ${st.done.join(", ")} h after start (of ${SCHEDULE_H.join(", ")}).`,
      ...(st.obs.some((o) => !o.valid) ? ["Some checks saw a different build: a deploy purged the cache mid-experiment. Those rows are marked invalid."] : [])],
    tables: [{
      caption: "Columns are checks, in hours after the start. Each cell: cache status at that PoP, and how long the page had been idle there before the check. HIT = survived that gap; MISS or EXPIRED = evicted during it.",
      columns: ["City", "PoP", ...SCHEDULE_H.map((x) => `${x} h`), "Longest gap kept"],
      rows: cities.map(([city, os]) => {
        const cell = (hh) => { const o = os.find((x) => x.check_h === hh); return o ? (o.valid ? `${o.cache} after ${o.gap_h} h` : "invalid (deploy)") : ""; };
        const kept = os.filter((o) => o.valid && o.cache === "HIT").map((o) => o.gap_h);
        return [city, mode(os.map((o) => o.pop)), ...SCHEDULE_H.map(cell), kept.length ? `${Math.max(...kept)} h` : "none"];
      }),
    }],
  });
}

// ---------------------------------------------------------------- E07: path to origin vs edge
async function e07() {
  const ip = process.env.ORIGIN_IP;
  if (!ip && !DRY) throw new Error("set ORIGIN_IP to the droplet's public IPv4 (it is redacted from every file written)");
  const locs = cfg.cities.map((c) => ({ magic: c.magic, limit: 1 }));
  const raw = { context: context({ experiment: "e07" }), batches: [] };
  const rows = [];
  for (const batch of gp.batches(locs)) {
    const a = await measure(gp.pingBody({ target: ip || "<origin>", locations: batch }));
    const b = await measure(gp.pingBody({ target: cfg.host, locations: a.id }))
      .catch(() => measure(gp.pingBody({ target: cfg.host, locations: batch })));
    raw.batches.push({ a, b });
    const byB = new Map(b.results.map((e) => [probeKey(e), e]));
    for (const e of a.results) rows.push({ o: gp.extractPing(e), e: byB.has(probeKey(e)) ? gp.extractPing(byB.get(probeKey(e))) : null });
  }
  if (DRY) return;
  const s = stamp();
  saveRaw("e07", s, raw);
  saveSummary("e07", s, {
    title: "Path to the origin vs path to the edge", run_at: raw.context.run_at, tool: "Globalping ping, 16 packets",
    notes: ["Origin = the droplet's public IP over the plain internet (the address itself is not published). Edge = thareqyusuf.com, which resolves to the nearest Cloudflare PoP."],
    tables: [{
      caption: "Ping RTT in ms (min / avg). Compare 'origin avg' with E02's miss penalty: if the miss penalty is much larger, the Cloudflare path to the origin is slower than the plain internet.",
      columns: ["Region", "City", "Origin min", "Origin avg", "Origin loss %", "Edge min", "Edge avg"],
      rows: rows.sort((a, b) => orderOf(a.o.city) - orderOf(b.o.city)).map((r) => [regionOf(r.o.city) || "", `${r.o.city}, ${r.o.country}`, ms(r.o.min), ms(r.o.avg), r.o.loss, ms(r.e?.min), ms(r.e?.avg)]),
    }],
  });
}

const RUN = { e00, e01: () => edgeMap(false), e02: () => edgeMap(true), e03, e04, e07 };
if (!RUN[id]) {
  console.error(`usage: node experiments/run.mjs <${Object.keys(RUN).join("|")}> [--dry-run]\n(e05, e06, e08, e09, e10 have their own scripts; see experiments/README.md)`);
  process.exit(2);
}
RUN[id]().catch((e) => { console.error(`\n${id} failed: ${e.message}`); process.exit(1); });
