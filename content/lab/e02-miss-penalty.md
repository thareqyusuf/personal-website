---
title: "E02: What a cache miss costs, by region"
short: "Cost of a cache miss"
id: e02
dir: e02-miss-penalty
status: planned        # planned | running | complete
weight: 3
question: "When the nearby data center doesn't have the page, how much longer does the reader wait?"
prediction: "About one round trip to Singapore: ~2–5 ms from Singapore, ~160 ms from London, ~230 ms from the US East Coast."
method: "TTFB of the never-cached `/__probe` minus TTFB of the cached home page, same probe, seconds apart."
---

## What I learned

<!-- After a run: what the numbers say, and where the prediction was wrong. Then set status. -->

Not run yet.
