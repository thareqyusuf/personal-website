---
title: "E07: Plain-internet path vs Cloudflare's path"
short: "Internet path vs Cloudflare path"
id: e07
dir: e07-network-path
status: planned        # planned | running | complete
weight: 8
question: "Is a cache miss through Cloudflare faster or slower than pinging the droplet directly?"
prediction: "Roughly equal: the Free plan has no smart routing, so the distance to Singapore dominates."
method: "Globalping ping (16 packets) from each city to the droplet and to the site."
---

## What I learned

<!-- After a run: what the numbers say, and where the prediction was wrong. Then set status. -->

Not run yet.
