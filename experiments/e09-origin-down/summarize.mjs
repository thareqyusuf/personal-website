// node experiments/e09-origin-down/summarize.mjs experiments/e09-origin-down/results/raw/<stamp>.csv
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { saveSummary } from "../lib/results.mjs";

const file = process.argv[2];
const [head, ...lines] = readFileSync(file, "utf8").trim().split("\n");
const cols = head.split(",");
const recs = lines.map((l) => Object.fromEntries(l.split(",").map((v, i) => [cols[i], v])));
const phases = [...new Set(recs.map((r) => r.phase))];
const paths = [...new Set(recs.map((r) => r.path))];
const cell = (ph, p) => {
  const rs = recs.filter((r) => r.phase === ph && r.path === p);
  const c = new Map(); for (const r of rs) { const k = `${r.status} ${r.cache}`; c.set(k, (c.get(k) || 0) + 1); }
  return [...c.entries()].map(([k, n]) => `${k} ×${n}`).join(", ");
};
saveSummary("e09", basename(file, ".csv"), {
  title: "What readers see when the origin is down", run_at: new Date().toISOString(), tool: "curl from a laptop, nginx stopped over SSH",
  notes: ["Cells show HTTP status and cf-cache-status, with how many of the checks saw that combination."],
  tables: [{ caption: "Phase by URL.", columns: ["Phase", ...paths], rows: phases.map((ph) => [ph, ...paths.map((p) => cell(ph, p))]) }],
});
