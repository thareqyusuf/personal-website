# E03: Cold start right after a deploy

**Question.** Every deploy purges the whole edge. What does the first reader in each city pay, and
does Smart Tiered Cache make later cities cheaper than the first one?

**Prediction.** The first city to ask pays roughly the E02 miss penalty. Cities asked later still
show `MISS` at their own PoP but pay less, because the upper tier near Singapore already has the
page. In Europe and the US, the penalty is still ~1 round trip to Singapore (160–230 ms). The second
request from each probe is a HIT.

## Run

Right after a deploy finishes (or let the script purge):

```bash
CF_API_TOKEN=... CF_ZONE_ID=... node experiments/run.mjs e03 --purge
```

1 probe per city, cities in `config.json` order: Asia first, so watch whether Europe gets cheaper
after Asia has warmed the upper tier.

## Threats to validity

- Purge propagation takes a few seconds; the script waits 10 s.
- Batches run in sequence, so later batches may find the upper tier warm; that is part of what this measures.
