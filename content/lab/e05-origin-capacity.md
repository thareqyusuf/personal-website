---
title: "E05: How much load the origin can take"
short: "Origin capacity"
id: e05
dir: e05-origin-capacity
status: planned        # planned | running | complete
weight: 6
question: "Where does nginx on a 1 vCPU droplet stop keeping latency low, and how much headroom is that?"
prediction: "A knee around 3–8k requests/s for HTML, 100–1000× more than a front-page traffic spike would send to the origin."
method: "k6 at fixed arrival rates against a loopback-only listener on the droplet, with vmstat alongside."
---

## What I learned

<!-- After a run: what the numbers say, and where the prediction was wrong. Then set status. -->

Not run yet.
