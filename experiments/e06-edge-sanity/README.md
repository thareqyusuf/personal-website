# E06: Does the edge behave under light load?

**Question.** At a polite, steady rate through Cloudflare, are there errors, challenges or rate
limiting? What's the latency distribution from one real home connection?

**Prediction.** 0 errors, 0 challenges, ~100 % HIT, p50 ≈ your RTT to the PoP plus a few ms, and a
p99 2–5× the p50 from home Wi-Fi and ISP jitter.

## Run

```bash
D=experiments/e06-edge-sanity/results/raw/$(date -u +%Y-%m-%dT%H%M%SZ); mkdir -p "$D"
k6 run -e RATE=20 -e OUT="$D/k6_root_20.json" experiments/e06-edge-sanity/load.js
node experiments/lib/k6.mjs e06 "$D"
```

Don't go above ~50 req/s: Cloudflare treats DoS-like tests as a separate category with its own
notification process, and this experiment is about behaviour, not capacity.

## Threats to validity

- One location (yours). E01 covers geography.
- Home Wi-Fi adds jitter; use a cable if you can, and note which.
