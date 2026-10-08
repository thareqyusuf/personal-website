# E09: What do readers see when the origin is down?

**Question.** If the droplet dies, which pages keep working, and for how long?

**Prediction.**
- Cached pages (`/`): still 200 HIT. The edge doesn't need the origin until the copy expires or is evicted.
- A purged page (`/colophon/`): Cloudflare error **521** (origin refused the connection). The HTML's
  `stale-while-revalidate` doesn't help, and `stale-if-error` wouldn't either: Cloudflare ignores both
  when `s-maxage` is present.
- `/__probe`: 521 throughout the outage.
- Recovery: everything back to 200 within seconds of nginx starting.

## Run (pick a quiet time; the whole thing takes ~2.5 minutes)

```bash
ORIGIN_SSH=root@<droplet IP> CF_API_TOKEN=... CF_ZONE_ID=... experiments/e09-origin-down/run.sh
node experiments/e09-origin-down/summarize.mjs experiments/e09-origin-down/results/raw/<stamp>.csv
```

The script stops nginx over SSH, purges only `/colophon/`, and always restarts nginx on exit, even
on Ctrl-C.

## Follow-up worth testing

If the 521 is confirmed: move the edge TTL out of `Cache-Control` and into Cloudflare's own
`CDN-Cache-Control` header, keep `Cache-Control: public, max-age=60, stale-if-error=86400`, and rerun.
The prediction for that variant: the purged page still 521s (purge removes the stale copy too), but
an *expired* page would be served stale.

## Threats to validity

- Readers' requests during the outage are affected too; that's why this runs at a quiet hour and is short.
