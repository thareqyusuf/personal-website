# E01: Edge latency map (cache hits)

**Question.** From around the world, how long does a reader wait for the home page when Cloudflare
already has it? Which PoP answers each city?

**Prediction.** In metros with a Cloudflare PoP: RTT 2–15 ms, TTFB on a HIT ≈ RTT + 1–5 ms of edge
time. Jakarta is the outlier: 15–55 ms, because Free-plan traffic from some Indonesian ISPs lands in SIN
or HKG instead of CGK. The first request's cache status will be MISS in most cities outside Asia
(nobody there has asked for the page recently).

## Method

- `config.json` cities × 2 probes each, HTTPS GET `/`.
- Request 1 warms the PoP; request 2 (same probes) is the measurement. Both are recorded, so the
  first-request table shows which PoPs were cold.
- RTT = Globalping `timings.tcp` (the TCP handshake is exactly one round trip).

## Run

```bash
node experiments/run.mjs e01          # ~80 tests; or run e02, which includes e01
```

## Threats to validity

- Probes are mostly in data centers with good connectivity; real home connections add last-mile latency.
- Two probes per city is a small sample. Use `--probes 3` with a token for a steadier median.
- Time of day matters for congested paths; note the UTC time and compare runs at different times.
