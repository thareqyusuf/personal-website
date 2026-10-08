---
title: "E04: How long a low-traffic page stays cached"
short: "Cache retention"
id: e04
dir: e04-retention
status: planned        # planned | running | complete
weight: 5
question: "The edge TTL is 7 days, but Cloudflare evicts unpopular content early. How long does this site's page survive an idle gap at a PoP?"
prediction: "Hours to about a day at big PoPs far from Singapore; longer at SIN. Nowhere near 7 days."
method: "Checks after idle gaps of 1, 2, 4, 8, 16, 32 and 64 hours, recording HIT or MISS per city."
---

## What I learned

<!-- After a run: what the numbers say, and where the prediction was wrong. Then set status. -->

Not run yet.
