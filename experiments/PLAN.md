# Test plan: how fast is thareqyusuf.com, and why

This is the design for a set of experiments you run yourself. Each one states a prediction
*before* it is run, so the result can prove the napkin math wrong. Results are published on the
site under [/lab/](https://thareqyusuf.com/lab/), raw data and all.

## What we are trying to learn

1. **How long does a reader wait, depending on where they are?** (edge latency, cache hits)
2. **What does a cache miss cost, and how often does one happen on a low-traffic site?**
3. **How much load can the origin take before latency falls apart, and how much headroom is that?**
4. **What do readers see when something breaks?** (origin down, cache purged)
5. **Is the footer probe telling the truth?** (the instrument itself)

## The system under test

```
reader ──(A)── Cloudflare PoP ──(B)── [upper tier, near origin] ──(C)── nginx on DO SGP1
              cache per PoP          Smart Tiered Cache               1 vCPU / 1 GB
```

- **A** (reader to nearest Cloudflare data center, or PoP): set by the reader's ISP and Cloudflare's routing. Free-plan
  traffic is not guaranteed the closest PoP (a Jakarta reader was served from HKG).
- **B** (lower-tier PoP to upper tier): Cloudflare's network. Only on a miss.
- **C** (upper tier to origin): Singapore to Singapore, ~1–2 ms (`srtt_us` 1692 observed).

Cache policy under test (from `deploy/nginx/snippets/site-locations.conf`):
HTML `max-age=60, s-maxage=604800, stale-while-revalidate=86400`; fingerprinted assets and fonts
`immutable` 1 year; feeds `s-maxage=3600`; `/__probe` `no-store`. Every deploy purges everything.

## Methodology rules (apply to every experiment)

- **Predict first.** Write the prediction in the experiment's README before running it. Don't
  edit it afterwards; add a "what I got wrong" note instead.
- **Report distributions, not averages.** p50 and p90 for latency maps, plus p99 and p99.9 for load
  tests. One sample is an anecdote.
- **Separate latency from throughput.** A fat pipe doesn't make the first byte arrive sooner.
- **Open-model load only.** Use k6 `constant-arrival-rate` / `ramping-arrival-rate`. A closed
  model (fixed number of virtual users) under-measures tail latency through coordinated omission.
- **Watch the observer effect.** Measuring a cache warms it. Experiments that measure caching
  (E03, E04) say how they avoid fooling themselves.
- **Record context.** UTC time, deploy SHA (footer `build ...`), Cloudflare settings changed,
  tool versions. The runners write this into every result file automatically.
- **Keep raw data.** Raw output goes in `experiments/<id>/results/raw/`. Summaries for the site go
  in `data/lab/<id>/`. Never publish only the summary.
- **Don't load-test through Cloudflare.** Cloudflare allows throttled scans of your own site, but
  DoS-like tests need its separate notification process. Heavy load goes to the origin directly (E05).
  Through the edge, stay at a polite rate (E06).
- **Don't publish the origin IP.** Summaries redact it. Raw files that contain it stay out of
  `data/` and out of pages.

## Measurement definitions

| Name | Meaning | Where it comes from |
|---|---|---|
| RTT (A) | One network round trip, reader to PoP | TCP connect time (`timings.tcp` in Globalping, `%{time_connect}` in curl). The handshake is 1 RTT |
| TLS | TLS handshake time | `timings.tls`, `%{time_appconnect} − %{time_connect}` |
| TTFB | Request sent → first response byte | `timings.firstByte` (check against curl in E00, see note) |
| Edge time | TTFB − RTT on a cache HIT | Work done inside Cloudflare. Should be a few ms |
| Miss penalty | TTFB(`/__probe`) − TTFB(`/` HIT) from the same probe | Legs B + C + nginx |
| PoP | Cloudflare data center that answered | Suffix of the `cf-ray` header, e.g. `…-SIN` |
| Cache status | `cf-cache-status` header | HIT, MISS, EXPIRED, REVALIDATED, UPDATING, BYPASS, DYNAMIC |

Note: whether Globalping's `firstByte` includes the TCP/TLS handshakes is the first thing E00
checks. Every derived number above depends on that answer.

## The experiments

| ID | Question | Tool | Cost (Globalping tests) | Run when |
|---|---|---|---|---|
| E00 | Do the instruments agree? (Globalping, curl, the footer probe) | curl, Globalping, browser | ~10 | First, once |
| E01 | Edge latency map on cache hits | Globalping HTTP | 20 cities × 3 probes × 2 rounds = 120 | Monthly |
| E02 | Cost of a cache miss (origin path) by region | Globalping HTTP on `/__probe` | 60 | With E01 |
| E03 | Cold start right after a deploy/purge | Globalping HTTP | 120 | After a deploy |
| E04 | Cache retention on a low-traffic site | Globalping HTTP, doubling intervals | ~8 cities × 7 checks = 56 over a week | Once, no deploys that week |
| E05 | Origin capacity (knee of the latency curve) | k6 on the droplet, loopback | 0 | Once, then after nginx changes |
| E06 | Edge sanity under light load (no 429s/challenges) | k6 from your laptop, 20 rps × 60 s | 0 | Once |
| E07 | Public-internet path to origin vs Cloudflare path | Globalping ping/mtr | 40 | With E02 |
| E08 | Full page load and web vitals, first vs repeat view | WebPageTest (free, 30 locations) / Lighthouse | 0 | After design changes |
| E09 | What readers see when the origin is down | curl + Globalping, nginx stopped | ~40 | Once, at a quiet hour |
| E10 | Security and correctness of the serving config | curl, testssl.sh / SSL Labs | 0 | After config changes |

Globalping free limits: 250 tests/hour without an account, 500/hour with a free token
(`GLOBALPING_TOKEN`). One test = one probe result. Every experiment above fits in one hour's budget.

## Predictions (napkin math, written before any run)

Inputs: RTTs from the project latency table (EU West ↔ Singapore ~160 ms, NA West ↔ Singapore ~180 ms;
NA East ↔ Singapore ~230 ms is an estimate), reader to the nearest PoP 5–30 ms in a metro area with a
Cloudflare PoP.

| Reader | RTT to PoP (A) | TTFB on HIT | Miss penalty (B+C), warm connections | First cold visit (HTML, then CSS/JS/fonts) |
|---|---|---|---|---|
| Singapore | 2–5 ms | ~5–10 ms | ~2–5 ms | ~+5–10 ms |
| Jakarta | 15–55 ms (may be routed to SIN/HKG) | ~20–60 ms | ~15–40 ms | ~+30–80 ms |
| Tokyo | 3–10 ms | ~5–15 ms | ~70 ms | ~+140 ms |
| London / Frankfurt | 3–15 ms | ~5–20 ms | ~160 ms | ~+320 ms |
| US East | 3–15 ms | ~5–20 ms | ~230 ms | ~+460 ms |
| US West | 3–15 ms | ~5–20 ms | ~180 ms | ~+360 ms |

- **E04 prediction:** retention at a PoP with almost no traffic for this site is hours to a couple of
  days, well under the 7-day edge TTL, because Cloudflare evicts by popularity (LRU), not by TTL.
  So a reader in London will often pay the miss penalty, while Singapore will usually hit.
- **E05 prediction:** nginx serving ~6 KB of HTML from page cache, keep-alive, on 1 shared vCPU
  (with k6 on the same vCPU): knee around 3–8k req/s, p99 < 5 ms below the knee. Peak demand from a
  front-page spike: ~10–50 HTML req/s at the edge, × (1 − hit ratio) at the origin, so headroom is
  roughly 100–1000×. The origin is not the bottleneck; the miss path latency is.
- **E09 prediction:** cached URLs keep working while nginx is down. Once something is purged or
  evicted, readers get Cloudflare error 521. `stale-if-error` doesn't help because Cloudflare ignores
  it when `s-maxage` is present.
- **E00 suspected issues in the footer probe:** (1) after a reload within 60 s the page comes from the
  browser cache, and the footer still prints a TTFB (e.g. `300 µs`) as if it were network time; (2)
  "Edge to origin" is the last hop only (upper tier → droplet), not the reader's PoP → origin path.

## Order to run them

1. **E00** (calibrate), then **E10** (make sure the thing under test is configured as intended).
2. **E01 + E02 + E07** in one sitting (same hour, same probes where possible).
3. **E05** (origin capacity), **E06** (edge sanity).
4. **E03** at your next deploy; **E04** across a quiet week.
5. **E08**, **E09** whenever convenient.

## How results reach the site

```
experiments/<id>/run.*  ──writes──►  experiments/<id>/results/raw/<UTC>.json   (raw, may contain IPs)
                         └─writes──►  data/lab/<id>/<UTC>.json                  (summary tables, redacted)
content/lab/<id>.md  ──renders──►  /lab/<id>/   (design + latest summary + list of earlier runs)
```

Commit both, push, and the normal deploy publishes it. The `lab` workflow can run the Globalping
experiments from GitHub Actions and commit the results for you.
