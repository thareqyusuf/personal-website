# E08: Full page load in a real browser

**Question.** What does a reader actually experience, including fonts, CSS and JS? How much does a
repeat visit save?

**Prediction.** First view ≈ 230 KB (HTML ~6 KB compressed, CSS ~3 KB, JS ~3 KB, fonts 90 + 25 KB, more
if the italic loads), 6 requests, LCP < 1 s near a PoP and < 1.5 s from far away on a cache miss.
Repeat view: only the HTML is re-fetched; everything else comes from the browser cache (immutable).

## Run (WebPageTest, free account, 30 locations)

1. webpagetest.org → URL `https://thareqyusuf.com/`, test 3 locations: one in Asia, one in Europe,
   one in the US. Settings: Chrome, Cable, **3 runs**, **First View and Repeat View**.
2. Record the **median** run per location.
3. Copy `template.json` to `data/lab/e08/<UTC stamp>.json` and fill in the numbers and the result links.

Alternative without an account: `npx lighthouse https://thareqyusuf.com --preset=desktop --output=json`
(one location: yours).

## Threats to validity

- WebPageTest's "Cable" profile is an emulated connection, not a real one.
- The first run can warm the PoP for runs 2 and 3; that's why the median, not the first run, is recorded.
