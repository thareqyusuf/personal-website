---
title: "E01: Edge latency map (cache hits)"
short: "Edge latency map"
id: e01
dir: e01-edge-latency
status: planned        # planned | running | complete
weight: 2
question: "From ~20 cities, how long does a reader wait for the home page when Cloudflare already has it, and which data center answers?"
prediction: "RTT 2–15 ms and TTFB within a few ms of RTT in cities with a Cloudflare PoP. Jakarta is the outlier at 15–55 ms because it is often served from SIN or HKG."
method: "Globalping HTTPS GET from 2 probes per city; the second request (warm PoP) is the measurement."
---

## What I learned

<!-- After a run: what the numbers say, and where the prediction was wrong. Then set status. -->

Not run yet.
