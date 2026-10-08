// Turn k6 handleSummary JSON files (+ optional vmstat logs) into a results table.
//   node experiments/lib/k6.mjs e05 experiments/e05-origin-capacity/results/raw/<run-folder>
//   node experiments/lib/k6.mjs e06 experiments/e06-edge-sanity/results/raw/<run-folder>
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { saveSummary, ms } from "./results.mjs";

const [, , id, dir] = process.argv;
if (!id || !dir || !existsSync(dir)) { console.error("usage: node experiments/lib/k6.mjs <e05|e06> <results folder>"); process.exit(2); }

// vmstat: average CPU busy (100 - idle) and steal over the run, skipping the first sample (since-boot averages).
function cpu(file) {
  if (!existsSync(file)) return [null, null];
  const lines = readFileSync(file, "utf8").trim().split("\n").filter((l) => /^\s*\d/.test(l)).slice(1);
  if (!lines.length) return [null, null];
  const head = readFileSync(file, "utf8").split("\n").find((l) => l.includes(" id ")).trim().split(/\s+/);
  const col = (name) => lines.map((l) => Number(l.trim().split(/\s+/)[head.indexOf(name)]));
  const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  return [Math.round(100 - avg(col("id"))), head.includes("st") ? Math.round(avg(col("st"))) : null];
}

const files = readdirSync(dir).filter((f) => f.startsWith("k6") && f.endsWith(".json"));
const rows = files.map((f) => {
  const j = JSON.parse(readFileSync(join(dir, f), "utf8"));
  const m = j.data.metrics, d = m.http_req_duration.values;
  const [busy, steal] = cpu(join(dir, f.replace(/^k6/, "vmstat").replace(/\.json$/, ".txt")));
  const path = new URL(j.url).pathname;
  return {
    path, rate: j.rate,
    row: [path, j.rate, ms(m.http_reqs.values.rate), ms(d.med), ms(d["p(90)"]), ms(d["p(99)"]), ms(d["p(99.9)"]),
      ms((m.http_req_failed?.values.rate || 0) * 100), m.dropped_iterations?.values.count || 0,
      ...(id === "e05" ? [busy, steal] : [m.cf_hit ? ms(m.cf_hit.values.rate * 100) : null])],
  };
}).sort((a, b) => a.path.localeCompare(b.path) || a.rate - b.rate);

const ctxFile = join(dir, "context.txt");
const notes = existsSync(ctxFile) ? [readFileSync(ctxFile, "utf8").trim().split("\n").join("; ")] : [];
const s = basename(dir).replace(/:/g, "");
const run_at = new Date(statSync(dir).mtime).toISOString();

if (id === "e05") {
  notes.push("k6 runs on the same vCPU as nginx, so the load generator competes with the server. Dropped iterations > 0 means k6, not nginx, ran out of capacity at that rate.");
  saveSummary("e05", s, {
    title: "Origin capacity", run_at, tool: "k6 constant-arrival-rate on the droplet, loopback listener", notes,
    tables: [{
      caption: "Each row is a 60 s step at a fixed arrival rate. CPU busy and steal are from vmstat during the step (steal = time the hypervisor gave our vCPU to someone else).",
      columns: ["Path", "Target req/s", "Achieved req/s", "p50 ms", "p90 ms", "p99 ms", "p99.9 ms", "Errors %", "Dropped", "CPU busy %", "Steal %"],
      rows: rows.map((r) => r.row),
    }],
  });
} else {
  saveSummary("e06", s, {
    title: "Edge sanity under light load", run_at, tool: "k6 constant-arrival-rate from a laptop through Cloudflare", notes,
    tables: [{
      caption: "Polite load through the edge: are there errors, challenges or rate limiting, and what does the latency distribution look like from one place?",
      columns: ["Path", "Target req/s", "Achieved req/s", "p50 ms", "p90 ms", "p99 ms", "p99.9 ms", "Errors %", "Dropped", "Cache HIT %"],
      rows: rows.map((r) => r.row),
    }],
  });
}
