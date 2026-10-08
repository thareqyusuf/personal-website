// Polite load through Cloudflare, from your laptop. Not a capacity test (that's E05, on the origin).
//   mkdir -p experiments/e06-edge-sanity/results/raw/$(date -u +%Y-%m-%dT%H%M%SZ)
//   k6 run -e OUT=<that folder>/k6_root_20.json experiments/e06-edge-sanity/load.js
import http from "k6/http";
import { check } from "k6";
import { Rate, Counter } from "k6/metrics";

const RATE = Number(__ENV.RATE || 20);      // keep it polite: Cloudflare treats DoS-like tests separately
const URL = __ENV.URL || "https://thareqyusuf.com/";
const cfHit = new Rate("cf_hit");
const blocked = new Counter("blocked_or_challenged"); // 403 / 429 / 503 from the edge

export const options = {
  summaryTrendStats: ["min", "med", "p(90)", "p(99)", "p(99.9)", "max"],
  scenarios: {
    edge: { executor: "constant-arrival-rate", rate: RATE, timeUnit: "1s", duration: __ENV.DURATION || "60s", preAllocatedVUs: 20, maxVUs: 100 },
  },
};

export default function () {
  const r = http.get(URL);
  cfHit.add(r.headers["Cf-Cache-Status"] === "HIT");
  if ([403, 429, 503].includes(r.status)) blocked.add(1);
  check(r, { "status 200": (x) => x.status === 200 });
}

export function handleSummary(data) {
  return { [__ENV.OUT || "summary.json"]: JSON.stringify({ rate: RATE, url: URL, data }) };
}
