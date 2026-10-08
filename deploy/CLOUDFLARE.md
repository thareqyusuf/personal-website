# Going live: VPS + Cloudflare, step by step

About an hour end to end. Do these in order; each step says how to check it worked.

## 0. Pick the VPS

- 1 vCPU / 1 GB is plenty: nginx serving static files out of page cache does tens of thousands of requests per second, and the edge absorbs most traffic anyway.
- **Region:** put it near your readers *and* near a big Cloudflare data center, since the edge→origin leg only matters on a cache miss. From Jakarta, Singapore is ~10–15 ms away and is a major hub. A Jakarta VPS is closer for you but usually costs more for a worse network.
- Ubuntu 24.04 or Debian 12. Point an SSH key at it.

## 1. Domain on Cloudflare

1. Add the domain to Cloudflare and switch nameservers at your registrar.
2. DNS: `A example.com → <VPS IPv4>` (and `AAAA` if you have IPv6), **Proxied** (orange cloud). Add `CNAME www → example.com`, also Proxied.

## 2. TLS between Cloudflare and the origin

1. **SSL/TLS → Overview:** mode **Full (strict)**.
2. **SSL/TLS → Origin Server → Create Certificate** (RSA or ECDSA, hostnames `example.com, *.example.com`, 15 years). Save the two PEMs on the VPS:
   ```
   sudo install -d -m 700 /etc/ssl/cloudflare
   sudo tee /etc/ssl/cloudflare/origin.pem   # paste certificate
   sudo tee /etc/ssl/cloudflare/origin.key   # paste private key
   ```
3. **Authenticated Origin Pulls** (SSL/TLS → Origin Server → toggle on, zone-level). Download Cloudflare's origin-pull CA to the box:
   ```
   sudo curl -fsSo /etc/ssl/cloudflare/authenticated_origin_pull_ca.pem \
     https://developers.cloudflare.com/ssl/static/authenticated_origin_pull_ca.pem
   ```
4. **Edge Certificates:** Always Use HTTPS on, minimum TLS 1.2, TLS 1.3 on, HSTS optional (once you're sure).

## 3. Bootstrap the VPS

On your laptop, make the CI deploy key (no passphrase; it's jailed by `site-deploy-gate`):
```
ssh-keygen -t ed25519 -N '' -C github-actions -f deploy_key
```
On the VPS, from a checkout of this repo:
```
sudo DEPLOY_PUBKEY="$(cat deploy_key.pub)" ./deploy/bootstrap.sh
```
It prints the host key line for `DEPLOY_KNOWN_HOSTS` at the end.

Check: `curl -sk https://<VPS IP>/` from your laptop should **hang or be refused** (443 only accepts Cloudflare IPs), and `https://example.com/` should show "First deploy pending."

## 4. Cache rules (the "edge caching" part)

**Caching → Cache Rules**, in this order:

| # | Name | Match | Action |
|---|---|---|---|
| 1 | Bypass probe | `URI Path equals /__probe` | **Bypass cache** |
| 2 | Cache the site | `Hostname equals example.com` | **Eligible for cache**. Edge TTL: *use cache-control header if present*. Browser TTL: *respect origin* |

Without rule 2, Cloudflare only caches by file extension and never caches HTML. With it, the `s-maxage` values nginx sends decide edge TTLs (see the table in `content/colophon.md`).

Also worth turning on:
- **Speed → Optimization → Protocol:** HTTP/3 (QUIC) on, 0-RTT on (static GETs are safe to replay).
- **Caching → Tiered Cache:** Smart Tiered Caching on (fewer origin hits; note that it makes "Edge to origin" in the probe measure the upper tier).
- **Rules → Snippets/Workers:** none needed.

Check (twice, the second should be HIT):
```
curl -sI https://example.com/ | grep -iE 'cf-cache-status|cache-control|age'
curl -s  https://example.com/__probe     # {"origin":"sin-1","srtt_us":...}
curl -sI https://example.com/__probe | grep -i cf-cache-status   # BYPASS or DYNAMIC, never HIT
```

## 5. CI secrets

GitHub repo → Settings → Secrets and variables → Actions:

| Secret | Value |
|---|---|
| `DEPLOY_HOST` | VPS IP or a non-proxied hostname (SSH can't go through the orange cloud) |
| `DEPLOY_SSH_KEY` | contents of `deploy_key` (private) |
| `DEPLOY_KNOWN_HOSTS` | the line bootstrap.sh printed |
| `CF_ZONE_ID` | Overview page of the zone, right sidebar |
| `CF_API_TOKEN` | My Profile → API Tokens → Create → Custom: *Zone · Cache Purge · Purge*, scoped to this zone only |

Repository **variable** `SITE_URL` = `https://example.com` turns on the post-deploy smoke test.

Create an environment named `production` (Settings → Environments) if you want manual approval before deploys.

Push to `main`. The Actions log ends with `active: <sha>` and a purge.

## 6. Comments (giscus)

1. Make the repo public (giscus needs public Discussions), enable **Discussions**, create a category `Comments` (type *Announcement*, so only giscus creates threads).
2. Install the giscus GitHub app on the repo: https://github.com/apps/giscus
3. On https://giscus.app enter the repo; copy `data-repo-id` and `data-category-id` into `[params.giscus]` in `hugo.toml`.

## Rollback

```
ssh -i deploy_key deploy@<host> activate <older-sha>
```
then purge the cache from the dashboard (or re-run the workflow's purge step). The last 5 releases are kept on disk.
