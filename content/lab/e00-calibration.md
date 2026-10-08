---
title: "E00: Instrument calibration"
short: "Do the instruments agree?"
id: e00
dir: e00-calibration
status: planned        # planned | running | complete
weight: 1
question: "Does Globalping's first-byte time include the handshakes, and do curl, Globalping and the footer probe agree?"
prediction: "Globalping's phases add up to its total. curl and Globalping agree within ~10 ms. The footer shows a fake TTFB after a quick reload (browser cache) and reports only the last hop as \"Edge to origin\"."
method: "curl from a laptop (20 fresh connections), Globalping from the same city, and the footer read by hand."
---

## What I learned

<!-- After a run: what the numbers say, and where the prediction was wrong. Then set status. -->

Not run yet.
