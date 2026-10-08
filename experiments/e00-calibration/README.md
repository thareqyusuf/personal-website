# E00: Do the instruments agree?

**Question.** Before trusting any map, check the rulers. Does Globalping's `firstByte` include the
TCP and TLS handshakes? Does curl from your laptop agree with Globalping probes in your city? Does
the footer probe agree with both?

**Prediction.**
- Globalping phases are disjoint: dns + tcp + tls + firstByte + download ≈ total (within a few ms).
- From Jakarta, curl's TCP connect ≈ Globalping's `tcp` for a Jakarta probe on a similar ISP, ±10 ms.
- The footer's "round trip to the edge" (fastest of 5 HTTP requests) is 0–5 ms above the TCP RTT.
- Known footer issues to confirm: (1) a reload within 60 s is served from the browser cache, yet
  "Time to first byte" still shows a tiny number like `300 µs`; (2) "Edge to origin" shows only the
  last hop (~1–2 ms), even when the PoP is HKG.

## Run

```bash
# 1. curl from your laptop (new connection per request)
mkdir -p experiments/e00-calibration/results/raw
experiments/e00-calibration/curl-timing.sh 20 > experiments/e00-calibration/results/raw/curl.csv

# 2. Globalping from your city, plus the curl table, into one summary
node experiments/run.mjs e00 --from Jakarta --curl experiments/e00-calibration/results/raw/curl.csv
```

It prints one raw Globalping result. Check the field names against `lib/globalping.mjs`. If anything
is named differently, fix it there before running other experiments.

3. **Footer by hand.** In a private window, open the site, wait 3 s, and copy the footer. Then reload
   (Ctrl+R) within 60 s and copy it again. Then do a hard reload (Ctrl+Shift+R). Paste all three into
   the `notes` array of the new `data/lab/e00/<stamp>.json`.

## Threats to validity

- Globalping probes in "Jakarta" may be in data centers, not on your ISP; `Jakarta+eyeball` may help.
- curl's `starttransfer` is cumulative; the summary subtracts `appconnect` so it compares like with like.
