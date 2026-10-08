# E02: What does a cache miss cost, by region?

**Question.** When the PoP doesn't have the page, how much longer does the reader wait? Is that
close to the napkin math of "one round trip to Singapore"?

**Prediction (miss penalty, warm connections):** Singapore ~2–5 ms, Jakarta ~15–40 ms, Tokyo ~70 ms,
London/Frankfurt ~160 ms, US West ~180 ms, US East ~230 ms. If Cloudflare must open a new connection
to the origin, up to 3× those numbers.

## Method

`/__probe` is `no-store` and excluded from the cache rule, so every request to it travels
PoP → upper tier → droplet. For each probe: miss penalty = TTFB(`/__probe`) − TTFB(`/` served from
cache), measured seconds apart from the same probe. The table also shows the droplet's own view of
the last hop (`srtt_us` from the response body).

## Run

```bash
node experiments/run.mjs e02          # runs e01 too: ~120 tests
```

## Threats to validity

- `/__probe` takes a slightly different path than a real miss would: dynamic requests may skip the
  tiered-cache upper tier. E03 measures a real miss to compare.
- Cloudflare may keep warm connections to the origin from some PoPs and not others, which shows up
  as bimodal penalties within one region.
