# E04: How long does a low-traffic page stay cached at a PoP?

**Question.** The HTML has a 7-day edge TTL, but Cloudflare evicts by popularity (LRU), not by TTL.
For a site with a handful of readers, how long does the page actually survive an idle gap at, say,
the London PoP?

**Prediction.** Hours to about a day at busy PoPs far from Singapore (LHR, FRA, EWR, SFO). Longer at
SIN, which is also the upper tier. Nowhere near 7 days.

## Method

Checks at 1, 3, 7, 15, 31, 63 and 127 h after the start, so the idle gaps double: 1, 2, 4, 8, 16,
32, 64 h. Each check requests `/` once per city and records `cf-cache-status` and `age`. HIT means
the page survived that idle gap; MISS or EXPIRED means it was evicted somewhere inside it.

**Observer effect, handled:** every check is itself a request, so it resets the PoP's LRU clock. That
is why the gaps double. Each observation answers "does the page survive X idle hours?", which is
exactly what a sporadic reader experiences.

## Run

```bash
node experiments/run.mjs e04 --start      # warm request + state.json
node experiments/run.mjs e04              # "tick": runs whichever check is due; safe to run hourly
```

Easiest: start it, then enable the hourly schedule in `.github/workflows/lab.yml` (uncomment the
`schedule:` block) for ~6 days. Ticks commit `state.json` and the summary without deploying.

**Don't deploy or purge during the run.** The script records the build it sees and marks checks
after a deploy as invalid.

## Threats to validity

- Different probes in the same city may reach different PoPs; the table shows the PoP per check.
- Other visitors (you, crawlers) also refresh the cache in some cities. Note any traffic spikes.
