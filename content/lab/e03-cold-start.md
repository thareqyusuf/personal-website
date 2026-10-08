---
title: "E03: Cold start right after a deploy"
short: "Cold start after a deploy"
id: e03
dir: e03-cold-start
status: planned        # planned | running | complete
weight: 4
question: "Every deploy empties the cache. What does the first reader in each city pay, and do later cities pay less?"
prediction: "The first city pays the full miss penalty. Later cities still miss locally but are faster, because the upper tier near Singapore already has the page."
method: "Purge everything, then two requests per city in sequence."
---

## What I learned

<!-- After a run: what the numbers say, and where the prediction was wrong. Then set status. -->

Not run yet.
