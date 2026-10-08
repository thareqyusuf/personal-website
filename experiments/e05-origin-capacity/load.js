// k6 open-model load test against the origin's loopback listener.
//   k6 run -e RATE=2000 -e URL=http://127.0.0.1:8081/ -e OUT=out.json load.js
// constant-arrival-rate starts RATE requests per second no matter how slow responses get, so a
// slowing server shows up as latency instead of quietly lowering the load (coordinated omission).
import http from "k6/http";
import { check } from "k6";

const RATE = Number(__ENV.RATE || 1000);
const URL = __ENV.URL || "http://127.0.0.1:8081/";

export const options = {
  discardResponseBodies: true,
  summaryTrendStats: ["min", "med", "p(90)", "p(99)", "p(99.9)", "max"],
  scenarios: {
    load: {
      executor: "constant-arrival-rate",
      rate: RATE,
      timeUnit: "1s",
      duration: __ENV.DURATION || "60s",
      preAllocatedVUs: Number(__ENV.VUS || 50),
      maxVUs: Number(__ENV.MAX_VUS || 300), // 1 GB droplet: keep VUs modest; dropped_iterations tells you if k6 ran short
    },
  },
};

export default function () {
  const r = http.get(URL, { headers: { Host: "thareqyusuf.com" } });
  check(r, { "status 200": (x) => x.status === 200 });
}

export function handleSummary(data) {
  return { [__ENV.OUT || "summary.json"]: JSON.stringify({ rate: RATE, url: URL, data }) };
}
