// Writing results: raw output for the record, summary tables for the site.
//
//   experiments/<dir>/results/raw/<stamp>.json   everything the tool returned (origin IP redacted)
//   data/lab/<id>/<stamp>.json                   { id, title, run_at, build, tool, notes, tables }
//
// Hugo reads data/lab/<id>/*.json; layouts/lab/single.html renders the newest one.

import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const stamp = (d = new Date()) => d.toISOString().replace(/:/g, "").replace(/\.\d+Z$/, "Z"); // 2026-10-10T090000Z

export function expDir(id) {
  const d = readdirSync(join(ROOT, "experiments")).find((n) => n.startsWith(`${id}-`));
  if (!d) throw new Error(`no experiments/${id}-* directory`);
  return join(ROOT, "experiments", d);
}

// Never let the droplet's IP into a committed file.
export function redact(text) {
  const ip = process.env.ORIGIN_IP;
  return ip ? text.split(ip).join("<origin>") : text;
}

function write(path, obj) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, redact(JSON.stringify(obj, null, 2)) + "\n");
  console.error(`  wrote ${path.replace(ROOT + "/", "")}`);
}

export function context(extra = {}) {
  let sha = null;
  try { sha = execSync("git rev-parse --short=7 HEAD", { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch {}
  return { run_at: new Date().toISOString(), repo_sha: sha, node: process.version, runner: process.env.GITHUB_ACTIONS ? "github-actions" : "local", ...extra };
}

export function saveRaw(id, s, raw) { write(join(expDir(id), "results", "raw", `${s}.json`), raw); }

export function saveSummary(id, s, summary) { write(join(ROOT, "data", "lab", id, `${s}.json`), { id, ...summary }); }

// --- small stats helpers -------------------------------------------------------------------
export function quantile(xs, q) {
  const v = xs.filter((x) => typeof x === "number" && isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const pos = (v.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return v[lo] + (v[hi] - v[lo]) * (pos - lo);
}
export const median = (xs) => quantile(xs, 0.5);
export const ms = (x) => (x === null || x === undefined ? null : Math.round(x * 10) / 10);
export const mode = (xs) => {
  const c = new Map(); for (const x of xs.filter(Boolean)) c.set(x, (c.get(x) || 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
};

export function groupBy(rows, key) {
  const m = new Map();
  for (const r of rows) { const k = key(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
  return m;
}
