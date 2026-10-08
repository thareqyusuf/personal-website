---
title: "E09: What readers see when the origin is down"
short: "Origin down"
id: e09
dir: e09-origin-down
status: planned        # planned | running | complete
weight: 10
question: "If the droplet dies, which pages keep working?"
prediction: "Cached pages keep working. A page that was purged returns Cloudflare error 521, because `s-maxage` stops Cloudflare from serving stale copies on error."
method: "Stop nginx, purge one page, check three URLs every 3 s, start nginx."
---

## What I learned

<!-- After a run: what the numbers say, and where the prediction was wrong. Then set status. -->

Not run yet.
